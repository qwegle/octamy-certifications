#!/usr/bin/env node

import "dotenv/config";

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import {
  buildInhouseBlueprint,
  INHOUSE_ASSESSMENTS,
  INHOUSE_ORIGINAL_BANK,
} from "../server/content/inhouse-assessment-catalog";

const { Client } = pg;
const LOCK_ID = "5065497136023552";
const SUBJECT_SLUGS = ["mathematics", "physics", "chemistry", "biology", "english", "science"];

type PoolSummary = {
  assessmentSlug: string;
  bankId: number;
  bankSlug: string;
  questions: number;
  easy: number;
  medium: number;
  hard: number;
  blueprintQuestions: number;
};

function optionalClassification(assessment: (typeof INHOUSE_ASSESSMENTS)[number]) {
  const slugs = [assessment.primaryCategorySlug, ...assessment.secondaryCategorySlugs];
  const subjectSlug = slugs.find((slug) => SUBJECT_SLUGS.includes(slug));
  const examFamily = assessment.audienceBandCode === "competitive_exam"
    ? assessment.primaryCategorySlug
    : "school-education";
  return {
    subject: subjectSlug ? subjectSlug.replaceAll("-", " ") : null,
    examFamily,
    gradeBand: assessment.audienceBandCode.replaceAll("_", " "),
  };
}

export async function segregateInhouseQuestionBanks(options: {
  databaseUrl: string;
  operator: string;
  apply: boolean;
  confirmation?: string;
}) {
  if (options.operator.trim().length < 3) throw new Error("--operator must identify who is running the segregation");
  if (options.apply && options.confirmation !== "SEGREGATE") {
    throw new Error("--confirm SEGREGATE is required with --apply");
  }
  const client = new Client({ connectionString: options.databaseUrl });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [LOCK_ID]);
    const schemaCheck = await client.query<{ ready: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'course_question_blueprint' AND column_name = 'bank_id'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_banks' AND column_name = 'bank_kind'
      ) AS ready
    `);
    if (!schemaCheck.rows[0]?.ready) throw new Error("Migration 0016_enterprise_question_pools must be applied first");

    const originalResult = await client.query<{ id: number }>(
      `SELECT id FROM question_banks WHERE owner_type = 'admin' AND owner_id IS NULL AND slug = $1`,
      [INHOUSE_ORIGINAL_BANK.slug],
    );
    if (originalResult.rows.length !== 1) {
      throw new Error(`Expected exactly one source bank named ${INHOUSE_ORIGINAL_BANK.slug}`);
    }
    const originalBankId = originalResult.rows[0].id;
    const sourceCountResult = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM questions WHERE bank_id = $1 AND review_status <> 'retired'`,
      [originalBankId],
    );
    const sourceQuestionsBefore = Number(sourceCountResult.rows[0]?.count || 0);

    await client.query(`
      CREATE TEMP TABLE octamy_pool_map (
        assessment_slug text PRIMARY KEY,
        course_id integer NOT NULL,
        bank_id integer NOT NULL
      ) ON COMMIT DROP
    `);

    for (const assessment of INHOUSE_ASSESSMENTS.filter((item) => item.targetQuestionCount > 0)) {
      const courseResult = await client.query<{ id: number }>(
        `SELECT id FROM courses WHERE slug = $1 AND owner_type = 'admin' AND product_type = 'assessment'`,
        [assessment.slug],
      );
      if (courseResult.rows.length !== 1) throw new Error(`Canonical assessment is missing: ${assessment.slug}`);
      const courseId = courseResult.rows[0].id;
      const poolSlug = `${assessment.slug}-pool-v1`;
      const classification = optionalClassification(assessment);
      const bankValues = [
        `${assessment.title} — Question Pool v1`,
        `Governed first-party pool dedicated to ${assessment.title}. Difficulty is assigned per question; the assessment blueprint controls the selection mix.`,
        classification.subject,
        classification.examFamily,
        classification.gradeBand,
        JSON.stringify(["octamy-inhouse", "assessment-pool", assessment.slug, "version-1"]),
      ];
      const existingBank = await client.query<{ id: number }>(
        `SELECT id FROM question_banks WHERE owner_type = 'admin' AND owner_id IS NULL AND slug = $1 ORDER BY id`,
        [poolSlug],
      );
      if (existingBank.rows.length > 1) throw new Error(`Duplicate admin pool slug: ${poolSlug}`);
      let bankId = existingBank.rows[0]?.id;
      if (bankId) {
        await client.query(`
          UPDATE question_banks SET
            name = $2, description = $3, bank_kind = 'assessment_pool', status = 'active',
            bank_purpose = 'practice',
            subject = $4, exam_family = $5, grade_band = $6, syllabus_version = 'v1',
            tags = $7::json, updated_at = now()
          WHERE id = $1
        `, [bankId, ...bankValues]);
      } else {
        const bankResult = await client.query<{ id: number }>(`
          INSERT INTO question_banks (
            slug, name, description, owner_type, owner_id, visibility,
            bank_kind, status, bank_purpose, subject, exam_family, grade_band, syllabus_version,
            language, tags, question_count, created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, 'admin', NULL, 'private',
            'assessment_pool', 'active', 'practice', $4, $5, $6, 'v1',
            'en', $7::json, 0, NULL, now(), now()
          ) RETURNING id
        `, [poolSlug, ...bankValues]);
        bankId = bankResult.rows[0].id;
      }
      await client.query(
        `INSERT INTO octamy_pool_map (assessment_slug, course_id, bank_id) VALUES ($1, $2, $3)`,
        [assessment.slug, courseId, bankId],
      );

      const blueprint = buildInhouseBlueprint(assessment);
      for (const [index, item] of blueprint.entries()) {
        await client.query(`
          INSERT INTO question_topics (bank_id, parent_id, name, slug, sort_order, created_at, updated_at)
          VALUES ($1, NULL, $2, $3, $4, now(), now())
          ON CONFLICT (bank_id, slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()
        `, [bankId, item.topicName, item.topicSlug, index]);
      }
    }

    await client.query(`
      CREATE TEMP TABLE octamy_question_assignment (
        question_id integer PRIMARY KEY,
        bank_id integer NOT NULL,
        topic_slug text NOT NULL,
        destination_topic_id integer
      ) ON COMMIT DROP
    `);
    await client.query(`
      INSERT INTO octamy_question_assignment (question_id, bank_id, topic_slug)
      SELECT DISTINCT ON (question_id) question_id, bank_id, topic_slug
      FROM (
        SELECT
          question.id AS question_id,
          pool.bank_id,
          source_topic.slug AS topic_slug,
          md5(question.id::text || ':' || pool.assessment_slug) AS assignment_order
        FROM questions question
        INNER JOIN question_topics source_topic ON source_topic.id = question.topic_id
        INNER JOIN question_provenance provenance ON provenance.question_id = question.id
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(provenance.source_metadata -> 'assessmentSlugs', '[]'::jsonb)
        ) AS eligible(assessment_slug)
        INNER JOIN octamy_pool_map pool ON pool.assessment_slug = eligible.assessment_slug
        WHERE question.bank_id = $1 AND question.review_status <> 'retired'
      ) candidate
      ORDER BY question_id, assignment_order, bank_id
    `, [originalBankId]);
    const assignmentCount = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM octamy_question_assignment`,
    );
    if (Number(assignmentCount.rows[0]?.count || 0) !== sourceQuestionsBefore) {
      throw new Error(
        `Segregation coverage failed: ${sourceQuestionsBefore} source questions but ${assignmentCount.rows[0]?.count || 0} eligible assignments`,
      );
    }

    await client.query(`
      UPDATE octamy_question_assignment assignment
      SET destination_topic_id = topic.id
      FROM question_topics topic
      WHERE topic.bank_id = assignment.bank_id AND topic.slug = assignment.topic_slug
    `);
    const missingDestinations = await client.query<{ assessment_slug: string; topic_slug: string; questions: number }>(`
      SELECT pool.assessment_slug, assignment.topic_slug, count(*)::int AS questions
      FROM octamy_question_assignment assignment
      INNER JOIN octamy_pool_map pool ON pool.bank_id = assignment.bank_id
      WHERE assignment.destination_topic_id IS NULL
      GROUP BY pool.assessment_slug, assignment.topic_slug
      ORDER BY questions DESC, pool.assessment_slug
    `);
    if (missingDestinations.rows.length) {
      throw new Error(`Question assignments have missing destination topics: ${JSON.stringify(missingDestinations.rows)}`);
    }

    const movedResult = await client.query(`
      UPDATE questions question
      SET bank_id = assignment.bank_id,
          topic_id = assignment.destination_topic_id,
          updated_at = now()
      FROM octamy_question_assignment assignment
      WHERE question.id = assignment.question_id
    `);
    if ((movedResult.rowCount ?? 0) !== sourceQuestionsBefore) {
      throw new Error(`Only ${movedResult.rowCount ?? 0} of ${sourceQuestionsBefore} source questions could be moved`);
    }

    for (const assessment of INHOUSE_ASSESSMENTS.filter((item) => item.targetQuestionCount > 0)) {
      const mapResult = await client.query<{ course_id: number; bank_id: number }>(
        `SELECT course_id, bank_id FROM octamy_pool_map WHERE assessment_slug = $1`,
        [assessment.slug],
      );
      const { course_id: courseId, bank_id: bankId } = mapResult.rows[0];
      const topicResult = await client.query<{ id: number; slug: string }>(
        `SELECT id, slug FROM question_topics WHERE bank_id = $1`,
        [bankId],
      );
      const topicIds = new Map(topicResult.rows.map((topic) => [topic.slug, topic.id]));
      const blueprint = buildInhouseBlueprint(assessment);
      await client.query(`DELETE FROM course_question_blueprint WHERE course_id = $1`, [courseId]);
      for (const item of blueprint) {
        const topicId = topicIds.get(item.topicSlug);
        if (!topicId) throw new Error(`Destination topic ${item.topicSlug} is missing for ${assessment.slug}`);
        await client.query(`
          INSERT INTO course_question_blueprint (
            course_id, bank_id, topic_id, question_count, difficulty,
            marks_per_question, negative_marks, sort_order, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
        `, [courseId, bankId, topicId, item.questionCount, item.difficulty, item.marksPerQuestion, item.negativeMarks, item.sortOrder]);
      }
      const revisionResult = await client.query<{ revision: number }>(
        `SELECT COALESCE(MAX(revision), 0)::int + 1 AS revision FROM course_question_blueprint_versions WHERE course_id = $1`,
        [courseId],
      );
      await client.query(`
        INSERT INTO course_question_blueprint_versions (course_id, revision, items, change_note, changed_by, created_at)
        SELECT $1, $2, COALESCE(jsonb_agg(jsonb_build_object(
          'bankId', bank_id,
          'topicId', topic_id,
          'questionCount', question_count,
          'difficulty', difficulty,
          'marksPerQuestion', marks_per_question,
          'negativeMarks', negative_marks,
          'sortOrder', sort_order
        ) ORDER BY sort_order), '[]'::jsonb), $3, NULL, now()
        FROM course_question_blueprint WHERE course_id = $1
      `, [courseId, revisionResult.rows[0].revision, `In-house pool segregation by ${options.operator.trim()}`]);
    }

    await client.query(`
      UPDATE question_banks bank
      SET question_count = inventory.count, updated_at = now()
      FROM (
        SELECT bank.id, count(question.id) FILTER (WHERE question.review_status <> 'retired')::int AS count
        FROM question_banks bank
        LEFT JOIN questions question ON question.bank_id = bank.id
        GROUP BY bank.id
      ) inventory
      WHERE bank.id = inventory.id
    `);
    await client.query(
      `UPDATE question_banks SET bank_kind = 'master', status = 'archived', visibility = 'private', updated_at = now() WHERE id = $1`,
      [originalBankId],
    );

    const shortageResult = await client.query<{
      assessment_slug: string;
      bank_id: number;
      topic_id: number | null;
      difficulty: string;
      required: number;
      available: number;
    }>(`
      SELECT
        pool.assessment_slug,
        blueprint.bank_id,
        blueprint.topic_id,
        blueprint.difficulty,
        blueprint.question_count AS required,
        count(question.id)::int AS available
      FROM octamy_pool_map pool
      INNER JOIN course_question_blueprint blueprint ON blueprint.course_id = pool.course_id
      LEFT JOIN questions question
        ON question.bank_id = blueprint.bank_id
       AND (blueprint.topic_id IS NULL OR question.topic_id = blueprint.topic_id)
       AND question.is_active = true
       AND question.review_status = 'approved'
       AND (blueprint.difficulty = 'mixed' OR question.difficulty = blueprint.difficulty)
      GROUP BY pool.assessment_slug, blueprint.id
      HAVING count(question.id) < blueprint.question_count
    `);
    if (shortageResult.rows.length) {
      throw new Error(`Segregation would under-supply ${shortageResult.rows.length} blueprint rules: ${JSON.stringify(shortageResult.rows.slice(0, 10))}`);
    }

    const summaryResult = await client.query<PoolSummary>(`
      SELECT
        pool.assessment_slug AS "assessmentSlug",
        pool.bank_id AS "bankId",
        bank.slug AS "bankSlug",
        count(DISTINCT question.id)::int AS questions,
        count(DISTINCT question.id) FILTER (WHERE question.difficulty = 'easy')::int AS easy,
        count(DISTINCT question.id) FILTER (WHERE question.difficulty = 'medium')::int AS medium,
        count(DISTINCT question.id) FILTER (WHERE question.difficulty = 'hard')::int AS hard,
        COALESCE((SELECT sum(question_count)::int FROM course_question_blueprint WHERE course_id = pool.course_id), 0) AS "blueprintQuestions"
      FROM octamy_pool_map pool
      INNER JOIN question_banks bank ON bank.id = pool.bank_id
      LEFT JOIN questions question ON question.bank_id = pool.bank_id AND question.review_status <> 'retired'
      GROUP BY pool.assessment_slug, pool.course_id, pool.bank_id, bank.slug
      ORDER BY pool.assessment_slug
    `);
    const totalAfter = summaryResult.rows.reduce((sum, bank) => sum + Number(bank.questions), 0);
    if (sourceQuestionsBefore > 0 && totalAfter !== sourceQuestionsBefore) {
      throw new Error(`Question conservation failed: ${sourceQuestionsBefore} before, ${totalAfter} across assessment pools`);
    }

    if (options.apply) await client.query("COMMIT");
    else await client.query("ROLLBACK");
    return {
      mode: options.apply ? "applied" : "dry_run",
      operator: options.operator.trim(),
      sourceBankId: originalBankId,
      sourceQuestionsBefore,
      assessmentPools: summaryResult.rows,
      totalQuestionsAcrossPools: totalAfter,
      validation: "all_blueprints_supplied",
    };
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
      confirm: { type: "string" },
    },
    allowPositionals: false,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!values.operator) throw new Error("--operator <name> is required");
  const result = await segregateInhouseQuestionBanks({
    databaseUrl: process.env.DATABASE_URL,
    operator: values.operator,
    apply: values.apply,
    confirmation: values.confirm,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (["segregate-inhouse-question-banks.ts", "segregate-inhouse-question-banks.js"].includes(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
