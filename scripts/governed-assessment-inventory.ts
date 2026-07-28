#!/usr/bin/env node

import "dotenv/config";

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import {
  GOVERNED_INVENTORY_SCHEMA_VERSION,
  assertGovernedInventoryReadOnlyMode,
  evaluateGovernedAssessmentInventory,
  groupInventoryIssues,
  type GovernedAssessmentInventoryInput,
  type InventoryAccessibilityAcceptance,
  type InventoryBlueprintRule,
  type InventoryQuestion,
  type InventoryReleaseBundle,
  type InventoryRightsRoleReview,
  type InventorySourceLink,
} from "./lib/governed-assessment-inventory";

const { Client } = pg;

type CourseRow = {
  id: number;
  slug: string;
  title: string;
  owner_type: string;
  product_type: string;
  assessment_purpose: string;
  use_blueprint_engine: boolean;
  visibility: string;
  review_status: string;
  is_active: boolean;
  passing_score: number;
  blueprint_revision_count: string | number;
  blueprint_revision: string | number | null;
};

type RuleRow = {
  id: number;
  course_id: number;
  bank_id: number;
  topic_id: number | null;
  question_count: number;
  difficulty: string;
  bank_found: boolean;
  bank_slug: string | null;
  bank_purpose: string | null;
  bank_status: string | null;
  syllabus_version: string | null;
};

type QuestionRow = Omit<InventoryQuestion, "sourceLinks"> & { course_id: number };
type SourceRow = InventorySourceLink & { course_id: number; question_id: number };
type AccessibilityRow = InventoryAccessibilityAcceptance & { course_id: number };
type RightsRoleRow = InventoryRightsRoleReview & { course_id: number };
type ReleaseBundleRow = InventoryReleaseBundle & { course_id: number };

type SchemaRequirement = { table: string; columns: string[] };

const REQUIRED_SCHEMA: SchemaRequirement[] = [
  { table: "courses", columns: ["id", "slug", "title", "product_type", "assessment_purpose", "passing_score", "use_blueprint_engine", "visibility", "review_status", "is_active", "owner_type"] },
  { table: "course_question_blueprint", columns: ["id", "course_id", "bank_id", "topic_id", "question_count", "difficulty", "sort_order"] },
  { table: "course_question_blueprint_versions", columns: ["course_id", "revision"] },
  { table: "question_banks", columns: ["id", "slug", "bank_purpose", "status", "syllabus_version"] },
  { table: "questions", columns: ["id", "bank_id", "topic_id", "question", "question_format", "options", "correct_answer", "difficulty", "explanation", "generation_source", "review_status", "is_active", "created_by", "reviewed_by", "reviewed_at", "version", "content_hash", "answer_metadata", "image_url", "image_alt_text", "option_media"] },
  { table: "question_versions", columns: ["question_id", "version"] },
  { table: "question_provenance", columns: ["question_id", "source_id", "content_hash"] },
  { table: "question_pack_sources", columns: ["id", "source_key", "rights_review_status", "commercial_use_allowed", "derivatives_allowed", "evidence_reference", "rights_reviewed_at", "rights_reviewed_by", "provenance"] },
  { table: "assessment_accessibility_acceptances", columns: ["assessment_id", "blueprint_revision", "reviewer_user_id", "standard", "evidence_reference", "evidence_sha256", "accepted_at", "recorded_by_user_id"] },
  { table: "assessment_rights_role_reviews", columns: ["assessment_id", "blueprint_revision", "source_id", "reviewer_user_id", "evidence_reference", "evidence_sha256", "reviewed_at", "recorded_by_user_id"] },
  { table: "assessment_release_bundles", columns: ["assessment_id", "blueprint_revision", "content_manifest_sha256", "form_simulation_reference", "form_simulation_sha256", "cut_score", "cut_score_method", "cut_score_approval_reference", "cut_score_approval_sha256", "cut_score_approver_user_id", "cut_score_approved_at", "release_qa_reference", "release_qa_sha256", "qa_reviewer_user_id", "qa_accepted_at", "content_reviewer_user_id", "publisher_user_id", "publisher_signed_at", "release_commit", "released_at", "rollback_owner_user_id", "takedown_procedure", "takedown_procedure_sha256", "bundle_sha256", "recorded_by_user_id"] },
];

function schemaGaps(rows: Array<{ table_name: string; column_name: string }>): string[] {
  const found = new Map<string, Set<string>>();
  for (const row of rows) {
    const columns = found.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    found.set(row.table_name, columns);
  }
  const gaps: string[] = [];
  for (const requirement of REQUIRED_SCHEMA) {
    const columns = found.get(requirement.table);
    if (!columns) {
      gaps.push(`${requirement.table} (table missing)`);
      continue;
    }
    for (const column of requirement.columns) {
      if (!columns.has(column)) gaps.push(`${requirement.table}.${column}`);
    }
  }
  return gaps;
}

function valuesFor<T>(map: Map<number, T[]>, key: number): T[] {
  return map.get(key) ?? [];
}

function mapRows<T extends { course_id: number }>(rows: T[]): Map<number, T[]> {
  const result = new Map<number, T[]>();
  for (const row of rows) result.set(row.course_id, [...valuesFor(result, row.course_id), row]);
  return result;
}

function printSummary(report: any) {
  process.stdout.write([
    `Governed assessment inventory (${report.mode})`,
    `Scope: configured database snapshot; production status ${report.dataScope.productionStatus}`,
    `Database: ${report.dataScope.databaseName}; user: ${report.dataScope.databaseUser}; transaction_read_only: ${report.dataScope.transactionReadOnly}`,
    `Assessments: ${report.summary.assessments}; release-ready: ${report.summary.releaseReady}; blocked: ${report.summary.blocked}; currently published but blocked: ${report.summary.unsafePublished}`,
  ].join("\n") + "\n");
  for (const assessment of report.assessments) {
    const codes = assessment.blockers.map((blocker: any) => `${blocker.code}(${blocker.occurrences})`).join(", ");
    process.stdout.write(`${assessment.status.toUpperCase()} ${assessment.slug}: ${codes || "no blockers"}\n`);
  }
}

export async function buildGovernedAssessmentInventory(options: {
  databaseUrl: string;
  assessmentSlugs?: string[];
}) {
  const client = new Client({ connectionString: options.databaseUrl, application_name: "octamy-governed-assessment-inventory" });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '2s'");

    const scope = await client.query<{
      database_name: string;
      database_user: string;
      transaction_read_only: string;
    }>(`SELECT current_database() AS database_name,
              current_user AS database_user,
              current_setting('transaction_read_only') AS transaction_read_only`);

    const scopeRow = scope.rows[0];
    const requiredTables = REQUIRED_SCHEMA.map((requirement) => requirement.table);
    const capabilities = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position`,
      [requiredTables],
    );
    const gaps = schemaGaps(capabilities.rows);
    const slugs = options.assessmentSlugs?.filter(Boolean) ?? [];
    if (gaps.length > 0) {
      const courseColumns = new Set(capabilities.rows
        .filter((row) => row.table_name === "courses")
        .map((row) => row.column_name));
      const canListAssessmentShells = ["id", "slug", "title", "product_type"]
        .every((column) => courseColumns.has(column));
      const canReadPublicationState = ["is_active", "visibility", "review_status"]
        .every((column) => courseColumns.has(column));
      let legacyRows: Array<{
        id: number;
        slug: string;
        title: string;
        is_active?: boolean;
        visibility?: string;
        review_status?: string;
      }> = [];
      if (canListAssessmentShells && canReadPublicationState) {
        legacyRows = (await client.query(
          `SELECT id, slug, title, is_active, visibility, review_status
             FROM courses
            WHERE product_type = 'assessment'
              AND ($1::text[] = '{}'::text[] OR slug = ANY($1::text[]))
            ORDER BY slug, id`,
          [slugs],
        )).rows;
      } else if (canListAssessmentShells) {
        legacyRows = (await client.query(
          `SELECT id, slug, title
             FROM courses
            WHERE product_type = 'assessment'
              AND ($1::text[] = '{}'::text[] OR slug = ANY($1::text[]))
            ORDER BY slug, id`,
          [slugs],
        )).rows;
      }
      const gapMessage = `Required governance schema is incomplete (${gaps.join(", ")}). No migration was applied; release readiness cannot be established.`;
      const assessments = legacyRows.map((course) => {
        const currentlyPublished = course.is_active === true
          && course.visibility === "public"
          && course.review_status === "approved";
        return {
          id: course.id,
          slug: course.slug,
          title: course.title,
          purpose: "unknown",
          status: "blocked",
          releaseReady: false,
          runtimePublishReady: false,
          unsafePublished: currentlyPublished,
          catalogState: canReadPublicationState ? {
            visibility: course.visibility,
            reviewStatus: course.review_status,
            isActive: course.is_active,
            currentlyPublished,
          } : { assessable: false },
          blockers: [{
            severity: "blocker",
            code: "GOVERNANCE_SCHEMA_INCOMPLETE",
            message: gapMessage,
            occurrences: 1,
            questionIds: [],
            bankIds: [],
            sourceIds: [],
          }],
          warnings: [],
        };
      });
      await client.query("COMMIT");
      transactionOpen = false;
      return {
        schemaVersion: GOVERNED_INVENTORY_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        mode: "dry-run-read-only",
        dataScope: {
          label: "configured_database_snapshot",
          productionStatus: "not_asserted",
          warning: "Counts describe only the configured database snapshot and must not be presented as production inventory without independent environment verification.",
          databaseName: scopeRow?.database_name ?? "unknown",
          databaseUser: scopeRow?.database_user ?? "unknown",
          transactionReadOnly: scopeRow?.transaction_read_only ?? "unknown",
        },
        schema: {
          compatible: false,
          gaps,
          assessmentShellEnumerationComplete: canListAssessmentShells,
        },
        policy: {
          certificationMinimum: "max(80, draw x 4)",
          practiceMinimum: "max(200, draw x 5)",
          publicationMutationSupported: false,
        },
        summary: {
          assessments: assessments.length,
          releaseReady: 0,
          blocked: assessments.length,
          unsafePublished: assessments.filter((assessment) => assessment.unsafePublished).length,
        },
        assessments,
      };
    }

    const courseResult = await client.query<CourseRow>(
      `SELECT course.id, course.slug, course.title, course.owner_type, course.product_type,
              course.assessment_purpose, course.passing_score, course.use_blueprint_engine, course.visibility,
              course.review_status, course.is_active,
              (SELECT count(*) FROM course_question_blueprint_versions version
                WHERE version.course_id = course.id) AS blueprint_revision_count,
              (SELECT max(version.revision) FROM course_question_blueprint_versions version
                WHERE version.course_id = course.id) AS blueprint_revision
         FROM courses course
        WHERE course.product_type = 'assessment'
          AND ($1::text[] = '{}'::text[] OR course.slug = ANY($1::text[]))
        ORDER BY course.slug, course.id`,
      [slugs],
    );
    const courseIds = courseResult.rows.map((row) => row.id);

    const empty = { rows: [] as any[] };
    const rulesResult = courseIds.length === 0 ? empty : await client.query<RuleRow>(
      `SELECT blueprint.id, blueprint.course_id, blueprint.bank_id, blueprint.topic_id,
              blueprint.question_count, blueprint.difficulty,
              (bank.id IS NOT NULL) AS bank_found, bank.slug AS bank_slug,
              bank.bank_purpose, bank.status AS bank_status, bank.syllabus_version
         FROM course_question_blueprint blueprint
         LEFT JOIN question_banks bank ON bank.id = blueprint.bank_id
        WHERE blueprint.course_id = ANY($1::int[])
        ORDER BY blueprint.course_id, blueprint.sort_order, blueprint.id`,
      [courseIds],
    );
    const questionsResult = courseIds.length === 0 ? empty : await client.query(
      `SELECT course.id AS course_id,
              question.id, question.bank_id AS "bankId", question.topic_id AS "topicId",
              question.question, question.question_format AS "questionFormat",
              question.options, question.correct_answer AS "correctAnswer",
              question.difficulty, question.explanation,
              question.generation_source AS "generationSource",
              question.review_status AS "reviewStatus", question.is_active AS "isActive",
              question.created_by AS "createdBy", question.reviewed_by AS "reviewedBy",
              question.reviewed_at AS "reviewedAt", question.version,
              question.content_hash AS "contentHash", question.answer_metadata AS "answerMetadata",
              question.image_url AS "imageUrl", question.image_alt_text AS "imageAltText",
              question.option_media AS "optionMedia",
              (SELECT count(*) FROM question_versions version
                WHERE version.question_id = question.id)::integer AS "versionHistoryCount"
         FROM courses course
         INNER JOIN questions question ON EXISTS (
           SELECT 1 FROM course_question_blueprint blueprint
            WHERE blueprint.course_id = course.id
              AND blueprint.bank_id = question.bank_id
              AND (blueprint.topic_id IS NULL OR blueprint.topic_id = question.topic_id)
              AND (blueprint.difficulty = 'mixed' OR blueprint.difficulty = question.difficulty)
         )
        WHERE course.id = ANY($1::int[])
          AND question.review_status = 'approved'
          AND question.is_active = true
        ORDER BY course.id, question.id`,
      [courseIds],
    );
    const sourcesResult = courseIds.length === 0 ? empty : await client.query(
      `SELECT course.id AS course_id, question.id AS question_id,
              source.id AS "sourceId", source.source_key AS "sourceKey",
              source.rights_review_status AS "rightsReviewStatus",
              source.commercial_use_allowed AS "commercialUseAllowed",
              source.derivatives_allowed AS "derivativesAllowed",
              source.evidence_reference AS "evidenceReference",
              source.rights_reviewed_at AS "rightsReviewedAt",
              source.rights_reviewed_by AS "rightsReviewedBy",
              source.provenance AS "sourceProvenance",
              provenance.content_hash AS "provenanceContentHash"
         FROM courses course
         INNER JOIN questions question ON EXISTS (
           SELECT 1 FROM course_question_blueprint blueprint
            WHERE blueprint.course_id = course.id
              AND blueprint.bank_id = question.bank_id
              AND (blueprint.topic_id IS NULL OR blueprint.topic_id = question.topic_id)
              AND (blueprint.difficulty = 'mixed' OR blueprint.difficulty = question.difficulty)
         )
         INNER JOIN question_provenance provenance ON provenance.question_id = question.id
         INNER JOIN question_pack_sources source ON source.id = provenance.source_id
        WHERE course.id = ANY($1::int[])
          AND question.review_status = 'approved'
          AND question.is_active = true
        ORDER BY course.id, question.id, source.id`,
      [courseIds],
    );
    const accessibilityResult = courseIds.length === 0 ? empty : await client.query<AccessibilityRow>(
      `SELECT acceptance.assessment_id AS course_id,
              acceptance.blueprint_revision AS "blueprintRevision",
              acceptance.reviewer_user_id AS "reviewerUserId",
              acceptance.standard,
              acceptance.evidence_reference AS "evidenceReference",
              acceptance.evidence_sha256 AS "evidenceSha256",
              acceptance.accepted_at AS "acceptedAt"
         FROM assessment_accessibility_acceptances acceptance
        WHERE acceptance.assessment_id = ANY($1::int[])
        ORDER BY acceptance.assessment_id, acceptance.blueprint_revision`,
      [courseIds],
    );
    const rightsRolesResult = courseIds.length === 0 ? empty : await client.query<RightsRoleRow>(
      `SELECT review.assessment_id AS course_id,
              review.blueprint_revision AS "blueprintRevision",
              review.source_id AS "sourceId",
              review.reviewer_user_id AS "reviewerUserId",
              review.evidence_reference AS "evidenceReference",
              review.evidence_sha256 AS "evidenceSha256",
              review.reviewed_at AS "reviewedAt"
         FROM assessment_rights_role_reviews review
        WHERE review.assessment_id = ANY($1::int[])
        ORDER BY review.assessment_id, review.blueprint_revision, review.source_id`,
      [courseIds],
    );
    const releaseBundlesResult = courseIds.length === 0 ? empty : await client.query<ReleaseBundleRow>(
      `SELECT bundle.assessment_id AS course_id,
              bundle.blueprint_revision AS "blueprintRevision",
              bundle.content_manifest_sha256 AS "contentManifestSha256",
              bundle.form_simulation_reference AS "formSimulationReference",
              bundle.form_simulation_sha256 AS "formSimulationSha256",
              bundle.cut_score AS "cutScore",
              bundle.cut_score_method AS "cutScoreMethod",
              bundle.cut_score_approval_reference AS "cutScoreApprovalReference",
              bundle.cut_score_approval_sha256 AS "cutScoreApprovalSha256",
              bundle.cut_score_approver_user_id AS "cutScoreApproverUserId",
              bundle.cut_score_approved_at AS "cutScoreApprovedAt",
              bundle.release_qa_reference AS "releaseQaReference",
              bundle.release_qa_sha256 AS "releaseQaSha256",
              bundle.qa_reviewer_user_id AS "qaReviewerUserId",
              bundle.qa_accepted_at AS "qaAcceptedAt",
              bundle.content_reviewer_user_id AS "contentReviewerUserId",
              bundle.publisher_user_id AS "publisherUserId",
              bundle.publisher_signed_at AS "publisherSignedAt",
              bundle.release_commit AS "releaseCommit",
              bundle.released_at AS "releasedAt",
              bundle.rollback_owner_user_id AS "rollbackOwnerUserId",
              bundle.takedown_procedure AS "takedownProcedure",
              bundle.takedown_procedure_sha256 AS "takedownProcedureSha256",
              bundle.bundle_sha256 AS "bundleSha256"
         FROM assessment_release_bundles bundle
        WHERE bundle.assessment_id = ANY($1::int[])
        ORDER BY bundle.assessment_id, bundle.blueprint_revision`,
      [courseIds],
    );

    const rulesByCourse = mapRows(rulesResult.rows as RuleRow[]);
    const questionsByCourse = mapRows(questionsResult.rows as QuestionRow[]);
    const accessibilityByCourse = mapRows(accessibilityResult.rows as AccessibilityRow[]);
    const rightsRolesByCourse = mapRows(rightsRolesResult.rows as RightsRoleRow[]);
    const releaseBundlesByCourse = mapRows(releaseBundlesResult.rows as ReleaseBundleRow[]);
    const sourcesByCourseQuestion = new Map<string, InventorySourceLink[]>();
    for (const row of sourcesResult.rows as SourceRow[]) {
      const key = `${row.course_id}:${row.question_id}`;
      const { course_id: _courseId, question_id: _questionId, ...link } = row;
      sourcesByCourseQuestion.set(key, [...(sourcesByCourseQuestion.get(key) ?? []), link]);
    }

    const assessments = courseResult.rows.map((course) => {
      const rules: InventoryBlueprintRule[] = valuesFor(rulesByCourse, course.id).map((row) => ({
        id: row.id,
        bankId: row.bank_id,
        topicId: row.topic_id,
        questionCount: row.question_count,
        difficulty: row.difficulty,
        bank: row.bank_found ? {
          id: row.bank_id,
          slug: row.bank_slug!,
          purpose: row.bank_purpose!,
          status: row.bank_status!,
          syllabusVersion: row.syllabus_version,
        } : null,
      }));
      const questions: InventoryQuestion[] = valuesFor(questionsByCourse, course.id).map((row) => {
        const { course_id: _courseId, ...question } = row;
        return {
          ...question,
          bankId: Number(question.bankId),
          correctAnswer: Number(question.correctAnswer),
          version: Number(question.version),
          versionHistoryCount: Number(question.versionHistoryCount),
          sourceLinks: sourcesByCourseQuestion.get(`${course.id}:${question.id}`) ?? [],
        };
      });
      const input: GovernedAssessmentInventoryInput = {
        id: course.id,
        slug: course.slug,
        title: course.title,
        ownerType: course.owner_type,
        productType: course.product_type,
        assessmentPurpose: course.assessment_purpose,
        passingScore: Number(course.passing_score),
        useBlueprintEngine: course.use_blueprint_engine,
        visibility: course.visibility,
        reviewStatus: course.review_status,
        isActive: course.is_active,
        blueprintRevisionCount: Number(course.blueprint_revision_count),
        blueprintRevision: course.blueprint_revision == null ? null : Number(course.blueprint_revision),
        rules,
        questions,
        releaseEvidence: {
          accessibilityAcceptances: valuesFor(accessibilityByCourse, course.id).map(({ course_id: _courseId, ...record }) => record),
          rightsRoleReviews: valuesFor(rightsRolesByCourse, course.id).map(({ course_id: _courseId, ...record }) => record),
          releaseBundles: valuesFor(releaseBundlesByCourse, course.id).map(({ course_id: _courseId, ...record }) => record),
        },
      };
      const evaluated = evaluateGovernedAssessmentInventory(input);
      return {
        ...evaluated,
        blockers: groupInventoryIssues(evaluated.issues.filter((found) => found.severity === "blocker")),
        warnings: groupInventoryIssues(evaluated.issues.filter((found) => found.severity === "warning")),
        issues: undefined,
        contentAcceptance: undefined,
      };
    });

    await client.query("COMMIT");
    transactionOpen = false;
    return {
      schemaVersion: GOVERNED_INVENTORY_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      mode: "dry-run-read-only",
      dataScope: {
        label: "configured_database_snapshot",
        productionStatus: "not_asserted",
        warning: "Counts describe only the configured database snapshot and must not be presented as production inventory without independent environment verification.",
        databaseName: scopeRow?.database_name ?? "unknown",
        databaseUser: scopeRow?.database_user ?? "unknown",
        transactionReadOnly: scopeRow?.transaction_read_only ?? "unknown",
      },
      schema: {
        compatible: true,
        gaps: [],
        assessmentShellEnumerationComplete: true,
      },
      policy: {
        certificationMinimum: "max(80, draw x 4)",
        practiceMinimum: "max(200, draw x 5)",
        publicationMutationSupported: false,
      },
      summary: {
        assessments: assessments.length,
        releaseReady: assessments.filter((assessment) => assessment.releaseReady).length,
        blocked: assessments.filter((assessment) => !assessment.releaseReady).length,
        unsafePublished: assessments.filter((assessment) => assessment.unsafePublished).length,
      },
      assessments,
    };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "dry-run" },
      assessment: { type: "string", multiple: true },
      format: { type: "string", default: "json" },
      "fail-on-unsafe-published": { type: "boolean", default: false },
    },
    allowPositionals: false,
    strict: true,
  });
  const mode = values.mode ?? "dry-run";
  const format = values.format ?? "json";
  assertGovernedInventoryReadOnlyMode(mode);
  if (!new Set(["json", "summary"]).has(format)) throw new Error("--format must be json or summary");
  const databaseUrl = process.env.ASSESSMENT_INVENTORY_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("ASSESSMENT_INVENTORY_DATABASE_URL or DATABASE_URL is required");
  const report = await buildGovernedAssessmentInventory({
    databaseUrl,
    assessmentSlugs: values.assessment,
  });
  if (format === "summary") printSummary(report);
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (values["fail-on-unsafe-published"] && report.summary.unsafePublished > 0) {
    throw new Error(`Governance gate failed: ${report.summary.unsafePublished} published assessment(s) have release blockers`);
  }
}

if (/governed-assessment-inventory\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
