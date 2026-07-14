#!/usr/bin/env node

import "dotenv/config";

import process from "node:process";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import pg from "pg";
import {
  buildInhouseBlueprint,
  INHOUSE_ASSESSMENTS,
  INHOUSE_ORIGINAL_BANK,
  validateInhouseAssessmentCatalog,
} from "../server/content/inhouse-assessment-catalog";
import { ORIGINAL_QUESTION_TEMPLATES } from "../server/content/original-question-factory";

const { Client } = pg;
const CATALOG_LOCK_ID = "5065497136023551";

interface CourseRow {
  id: number;
  slug: string;
  owner_type: string;
  owner_id: number | null;
  product_type: string;
  is_active: boolean;
  review_status: string;
}

export interface InhouseCatalogSyncResult {
  mode: "dry_run" | "applied";
  operator: string;
  bankId: number;
  topicsPrepared: number;
  assessmentsCreated: number;
  assessmentsUpdated: number;
  assessmentsSkippedProtected: Array<{ slug: string; reason: string }>;
  blueprintItemsPrepared: number;
  emptyBlueprintShells: string[];
  releaseState: "private_inactive_pending_review";
  certificationState: "deferred_until_explicit_approval";
}

function assertOperator(value: string): string {
  const operator = value.trim();
  if (operator.length < 3 || operator.length > 200) {
    throw new Error("--operator must identify the catalogue operator in 3-200 characters");
  }
  return operator;
}

export async function syncInhouseAssessmentCatalog(options: {
  databaseUrl: string;
  operator: string;
  apply: boolean;
  confirmDraftOnly: boolean;
}): Promise<InhouseCatalogSyncResult> {
  const operator = assertOperator(options.operator);
  if (options.apply && !options.confirmDraftOnly) {
    throw new Error(
      "--confirm-draft-only is required with --apply; this command may create private, inactive, pending-review shells only",
    );
  }
  const catalogErrors = validateInhouseAssessmentCatalog();
  if (catalogErrors.length > 0) {
    throw new Error(`In-house catalogue definition is invalid:\n- ${catalogErrors.join("\n- ")}`);
  }

  const client = new Client({ connectionString: options.databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [CATALOG_LOCK_ID]);

    const schemaCheck = await client.query<{
      has_categories: boolean;
      has_audience_bands: boolean;
      has_topic_index: boolean;
    }>(`
      SELECT
        to_regclass('categories') IS NOT NULL AS has_categories,
        to_regclass('audience_bands') IS NOT NULL AS has_audience_bands,
        to_regclass('question_topics_bank_slug_unique') IS NOT NULL AS has_topic_index
    `);
    const schema = schemaCheck.rows[0];
    if (!schema?.has_categories || !schema.has_audience_bands || !schema.has_topic_index) {
      throw new Error("Migration 0015_inhouse_assessment_catalog must be applied before catalogue synchronization");
    }

    const requiredCategorySlugs = Array.from(new Set(
      INHOUSE_ASSESSMENTS.flatMap((assessment) => [
        assessment.primaryCategorySlug,
        ...assessment.secondaryCategorySlugs,
      ]),
    ));
    const categoryRows = await client.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM categories WHERE slug = ANY($1::text[]) AND is_active = true`,
      [requiredCategorySlugs],
    );
    const categoryIds = new Map(categoryRows.rows.map((row) => [row.slug, row.id]));
    const missingCategories = requiredCategorySlugs.filter((slug) => !categoryIds.has(slug));
    if (missingCategories.length > 0) {
      throw new Error(`Required active categories are missing: ${missingCategories.join(", ")}`);
    }

    const requiredAudienceCodes = Array.from(new Set(
      INHOUSE_ASSESSMENTS.map((assessment) => assessment.audienceBandCode),
    ));
    const bandRows = await client.query<{ id: number; code: string }>(
      `SELECT id, code FROM audience_bands WHERE code = ANY($1::text[]) AND is_active = true`,
      [requiredAudienceCodes],
    );
    const bandIds = new Map(bandRows.rows.map((row) => [row.code, row.id]));
    const missingBands = requiredAudienceCodes.filter((code) => !bandIds.has(code));
    if (missingBands.length > 0) {
      throw new Error(`Required active audience bands are missing: ${missingBands.join(", ")}`);
    }

    const existingBanks = await client.query<{ id: number }>(
      `SELECT id
         FROM question_banks
        WHERE owner_type = 'admin' AND owner_id IS NULL AND slug = $1
        ORDER BY id`,
      [INHOUSE_ORIGINAL_BANK.slug],
    );
    if (existingBanks.rows.length > 1) {
      throw new Error(`Multiple admin question banks use slug ${INHOUSE_ORIGINAL_BANK.slug}; resolve before syncing`);
    }
    let bankId = existingBanks.rows[0]?.id;
    if (!bankId) {
      const insertedBank = await client.query<{ id: number }>(
        `INSERT INTO question_banks (
           slug, name, description, owner_type, owner_id, visibility, language, tags,
           question_count, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, 'admin', NULL, 'private', 'en', $4::json, 0, NULL, now(), now())
         RETURNING id`,
        [
          INHOUSE_ORIGINAL_BANK.slug,
          INHOUSE_ORIGINAL_BANK.name,
          INHOUSE_ORIGINAL_BANK.description,
          JSON.stringify(INHOUSE_ORIGINAL_BANK.tags),
        ],
      );
      bankId = insertedBank.rows[0].id;
    } else {
      // Never downgrade an existing bank's visibility. Metadata is safe to
      // refresh while its publication decision remains an explicit admin act.
      await client.query(
        `UPDATE question_banks
            SET name = $2, description = $3, tags = $4::json, updated_at = now()
          WHERE id = $1`,
        [
          bankId,
          INHOUSE_ORIGINAL_BANK.name,
          INHOUSE_ORIGINAL_BANK.description,
          JSON.stringify(INHOUSE_ORIGINAL_BANK.tags),
        ],
      );
    }

    const topics = Array.from(new Map(
      ORIGINAL_QUESTION_TEMPLATES.map((template) => [template.topicSlug, template.topic]),
    ).entries()).sort(([left], [right]) => left.localeCompare(right));
    for (const [slug, name] of topics) {
      await client.query(
        `INSERT INTO question_topics (bank_id, parent_id, name, slug, sort_order, created_at, updated_at)
         VALUES ($1, NULL, $2, $3, $4, now(), now())
         ON CONFLICT (bank_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           updated_at = now()`,
        [bankId, name, slug, topics.findIndex(([candidate]) => candidate === slug)],
      );
    }
    const topicRows = await client.query<{ id: number; slug: string }>(
      `SELECT id, slug FROM question_topics WHERE bank_id = $1`,
      [bankId],
    );
    const topicIds = new Map(topicRows.rows.map((row) => [row.slug, row.id]));

    let assessmentsCreated = 0;
    let assessmentsUpdated = 0;
    let blueprintItemsPrepared = 0;
    const assessmentsSkippedProtected: Array<{ slug: string; reason: string }> = [];
    const emptyBlueprintShells: string[] = [];

    for (const assessment of INHOUSE_ASSESSMENTS) {
      const existingResult = await client.query<CourseRow>(
        `SELECT id, slug, owner_type, owner_id, product_type, is_active, review_status
           FROM courses WHERE slug = $1 FOR UPDATE`,
        [assessment.slug],
      );
      const existing = existingResult.rows[0];
      if (existing && (
        existing.owner_type !== "admin"
        || existing.owner_id !== null
        || existing.product_type !== "assessment"
      )) {
        throw new Error(
          `ASSESSMENT_SLUG_OWNERSHIP_CONFLICT: ${assessment.slug} belongs to a non-catalogue product or tenant`,
        );
      }
      if (existing && (existing.is_active || !["draft", "pending"].includes(existing.review_status))) {
        assessmentsSkippedProtected.push({
          slug: assessment.slug,
          reason: existing.is_active
            ? "active assessment is protected from seed mutation"
            : `review status ${existing.review_status} is protected from seed mutation`,
        });
        continue;
      }

      const primaryCategoryId = categoryIds.get(assessment.primaryCategorySlug)!;
      const blueprint = buildInhouseBlueprint(assessment);
      if (blueprint.length === 0) emptyBlueprintShells.push(assessment.slug);
      let courseId: number;
      if (!existing) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO courses (
             title, description, slug, category_id, duration, passing_score, price,
             product_type, content_price, original_price, is_on_sale, sale_end_date,
             level, is_active, is_internship, meta_title, meta_description, thumbnail_url,
             owner_type, owner_id, visibility, language, certification_mode, review_status,
             default_review_policy, subscription_eligible, reseller_eligible, featured_at,
             use_blueprint_engine, created_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, '0.00',
             'assessment', '0.00', NULL, false, NULL,
             $7, false, false, $8, $9, NULL,
             'admin', NULL, 'private', 'en', 'none', 'pending',
             'immediate', false, false, NULL,
             $10, now()
           ) RETURNING id`,
          [
            assessment.title,
            assessment.description,
            assessment.slug,
            primaryCategoryId,
            assessment.durationMinutes,
            assessment.passingScore,
            assessment.level,
            assessment.metaTitle,
            assessment.metaDescription,
            blueprint.length > 0,
          ],
        );
        courseId = inserted.rows[0].id;
        assessmentsCreated += 1;
      } else {
        courseId = existing.id;
        await client.query(
          `UPDATE courses SET
             title = $2,
             description = $3,
             category_id = $4,
             duration = $5,
             passing_score = $6,
             price = '0.00',
             content_price = '0.00',
             original_price = NULL,
             is_on_sale = false,
             sale_end_date = NULL,
             level = $7,
             is_active = false,
             is_internship = false,
             meta_title = $8,
             meta_description = $9,
             owner_type = 'admin',
             owner_id = NULL,
             visibility = 'private',
             language = 'en',
             certification_mode = 'none',
             review_status = 'pending',
             default_review_policy = 'immediate',
             subscription_eligible = false,
             reseller_eligible = false,
             featured_at = NULL,
             use_blueprint_engine = $10
           WHERE id = $1`,
          [
            courseId,
            assessment.title,
            assessment.description,
            primaryCategoryId,
            assessment.durationMinutes,
            assessment.passingScore,
            assessment.level,
            assessment.metaTitle,
            assessment.metaDescription,
            blueprint.length > 0,
          ],
        );
        assessmentsUpdated += 1;
      }

      await client.query(
        `UPDATE course_categories
            SET relation_type = 'secondary'
          WHERE course_id = $1 AND relation_type = 'primary' AND category_id <> $2`,
        [courseId, primaryCategoryId],
      );
      const facetSlugs = Array.from(new Set([
        assessment.primaryCategorySlug,
        ...assessment.secondaryCategorySlugs,
      ]));
      for (const slug of facetSlugs) {
        await client.query(
          `INSERT INTO course_categories (course_id, category_id, relation_type, created_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (course_id, category_id) DO UPDATE SET relation_type = EXCLUDED.relation_type`,
          [courseId, categoryIds.get(slug), slug === assessment.primaryCategorySlug ? "primary" : "secondary"],
        );
      }

      await client.query(`DELETE FROM course_audience_bands WHERE course_id = $1`, [courseId]);
      await client.query(
        `INSERT INTO course_audience_bands (course_id, audience_band_id, created_at)
         VALUES ($1, $2, now())`,
        [courseId, bandIds.get(assessment.audienceBandCode)],
      );

      await client.query(`DELETE FROM course_question_blueprint WHERE course_id = $1`, [courseId]);
      for (const item of blueprint) {
        const topicId = topicIds.get(item.topicSlug);
        if (!topicId) throw new Error(`Prepared topic is missing: ${item.topicSlug}`);
        await client.query(
          `INSERT INTO course_question_blueprint (
             course_id, topic_id, question_count, difficulty, marks_per_question,
             negative_marks, sort_order, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
          [
            courseId,
            topicId,
            item.questionCount,
            item.difficulty,
            item.marksPerQuestion,
            item.negativeMarks,
            item.sortOrder,
          ],
        );
        blueprintItemsPrepared += 1;
      }
    }

    const result: InhouseCatalogSyncResult = {
      mode: options.apply ? "applied" : "dry_run",
      operator,
      bankId,
      topicsPrepared: topics.length,
      assessmentsCreated,
      assessmentsUpdated,
      assessmentsSkippedProtected,
      blueprintItemsPrepared,
      emptyBlueprintShells,
      releaseState: "private_inactive_pending_review",
      certificationState: "deferred_until_explicit_approval",
    };
    if (options.apply) await client.query("COMMIT");
    else await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      operator: { type: "string" },
      apply: { type: "boolean", default: false },
      "confirm-draft-only": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!values.operator) throw new Error("--operator <catalogue-operator> is required");
  const result = await syncInhouseAssessmentCatalog({
    databaseUrl: process.env.DATABASE_URL,
    operator: values.operator,
    apply: values.apply,
    confirmDraftOnly: values["confirm-draft-only"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
