#!/usr/bin/env node

import "dotenv/config";

import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg, { type Client } from "pg";
import {
  DEFAULT_QUESTION_PACK_BATCH_SIZE,
  MAX_QUESTION_PACK_BATCH_SIZE,
  MAX_QUESTION_PACK_ROWS,
  normalizeQuestionPackItem,
  type NormalizedQuestionPackItem,
} from "./lib/question-pack-contract";
import { readQuestionPackJsonl, sha256File } from "./lib/question-pack-files";
import {
  QuestionPackValidationError,
  resolvedQuestionPackTopicSlug,
  validateQuestionPack,
  type QuestionPackValidationSummary,
} from "./lib/question-pack-import-validation";

const { Client: PgClient } = pg;

type ImportContext = {
  sourceId: number;
  bankId: number;
  runId: number;
  processedRows: number;
  insertedQuestions: number;
  linkedProvenance: number;
  sourceDuplicateRows: number;
  contentDuplicateRows: number;
};

async function loadImportContext(client: Client, options: {
  sourceKey: string;
  bankSlug: string;
  inputName: string;
  inputSha256: string;
  operator: string;
  batchSize: number;
  maxRows: number;
  validation: QuestionPackValidationSummary;
  resume: boolean;
}): Promise<ImportContext | { completed: true; summary: Record<string, unknown> }> {
  const sourceResult = await client.query<{
    id: number;
    rights_review_status: string;
    commercial_use_allowed: boolean;
    derivatives_allowed: boolean;
  }>(
    `SELECT id, rights_review_status, commercial_use_allowed, derivatives_allowed
       FROM question_pack_sources
      WHERE source_key = $1`,
    [options.sourceKey],
  );
  const source = sourceResult.rows[0];
  if (!source) throw new Error(`Question-pack source is not registered: ${options.sourceKey}`);
  if (source.rights_review_status !== "verified"
    || !source.commercial_use_allowed
    || !source.derivatives_allowed) {
    throw new Error(`Question-pack source rights are not verified: ${options.sourceKey}`);
  }

  const bankResult = await client.query<{ id: number; owner_type: string; owner_id: number | null }>(
    `SELECT id, owner_type, owner_id
       FROM question_banks
      WHERE slug = $1 AND owner_type = 'admin' AND owner_id IS NULL`,
    [options.bankSlug],
  );
  if (bankResult.rows.length > 1) {
    throw new Error(`Multiple admin question banks use slug ${options.bankSlug}; resolve the ownership collision before importing`);
  }
  const bank = bankResult.rows[0];
  if (!bank) throw new Error(`Admin question bank was not found: ${options.bankSlug}`);

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO question_pack_import_runs (
       source_id, bank_id, input_name, input_sha256, status, operator,
       batch_size, max_rows, total_rows, valid_rows, invalid_rows
     ) VALUES ($1, $2, $3, $4, 'importing', $5, $6, $7, $8, $9, 0)
     ON CONFLICT (source_id, bank_id, input_sha256) DO NOTHING
     RETURNING id`,
    [
      source.id,
      bank.id,
      options.inputName,
      options.inputSha256,
      options.operator,
      options.batchSize,
      options.maxRows,
      options.validation.totalRows,
      options.validation.validRows,
    ],
  );

  const runResult = await client.query<{
    id: number;
    status: string;
    input_name: string;
    operator: string;
    batch_size: number;
    max_rows: number;
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    processed_rows: number;
    inserted_questions: number;
    linked_provenance: number;
    source_duplicate_rows: number;
    content_duplicate_rows: number;
    completed_at: Date | null;
  }>(
    `SELECT id, status, input_name, operator, batch_size, max_rows,
            total_rows, valid_rows, invalid_rows, processed_rows,
            inserted_questions, linked_provenance, source_duplicate_rows,
            content_duplicate_rows, completed_at
       FROM question_pack_import_runs
      WHERE source_id = $1 AND bank_id = $2 AND input_sha256 = $3`,
    [source.id, bank.id, options.inputSha256],
  );
  const run = runResult.rows[0];
  if (!run) throw new Error("Import run could not be created or loaded");
  if (run.status === "completed") {
    return {
      completed: true,
      summary: {
        status: "already_completed",
        runId: run.id,
        totalRows: run.total_rows,
        processedRows: run.processed_rows,
        insertedQuestions: run.inserted_questions,
        linkedProvenance: run.linked_provenance,
        completedAt: run.completed_at,
      },
    };
  }
  if (!inserted.rows[0] && !options.resume) {
    throw new Error(`Import run ${run.id} is ${run.status}; pass --resume to continue its committed batch boundary`);
  }
  if (run.total_rows !== options.validation.totalRows
    || run.valid_rows !== options.validation.validRows
    || run.invalid_rows !== 0
    || run.processed_rows > options.validation.validRows) {
    throw new Error(`Import run ${run.id} counters do not match the validated input`);
  }
  await client.query(
    `UPDATE question_pack_import_runs
        SET status = 'importing', failure_code = NULL, failure_message = NULL,
            operator = $2, updated_at = NOW()
      WHERE id = $1`,
    [run.id, options.operator],
  );
  return {
    sourceId: source.id,
    bankId: bank.id,
    runId: run.id,
    processedRows: run.processed_rows,
    insertedQuestions: run.inserted_questions,
    linkedProvenance: run.linked_provenance,
    sourceDuplicateRows: run.source_duplicate_rows,
    contentDuplicateRows: run.content_duplicate_rows,
  };
}

async function ensureTopics(
  client: Client,
  bankId: number,
  topics: QuestionPackValidationSummary["topics"],
): Promise<Map<string, number>> {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(7303, $1)", [bankId]);
    for (const [sortOrder, topic] of topics.entries()) {
      await client.query(
        `INSERT INTO question_topics (bank_id, name, slug, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (bank_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           updated_at = NOW()`,
        [bankId, topic.name, topic.slug, sortOrder],
      );
    }
    const rows = await client.query<{ id: number; slug: string }>(
      "SELECT id, slug FROM question_topics WHERE bank_id = $1",
      [bankId],
    );
    await client.query("COMMIT");
    return new Map(rows.rows.map((row) => [row.slug, row.id]));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

type BatchRow = NormalizedQuestionPackItem & { topicSlug: string; topicId: number };

async function importBatch(client: Client, context: ImportContext, rows: BatchRow[]) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(7304, $1)", [context.bankId]);
    const sourceRecordIds = rows.map((row) => row.sourceRecordId);
    const existingProvenance = await client.query<{
      source_record_id: string;
      source_record_hash: string;
    }>(
      `SELECT source_record_id, source_record_hash
         FROM question_provenance
        WHERE source_id = $1 AND source_record_id = ANY($2::text[])`,
      [context.sourceId, sourceRecordIds],
    );
    const provenanceByRecord = new Map(
      existingProvenance.rows.map((row) => [row.source_record_id, row.source_record_hash]),
    );
    let sourceDuplicates = 0;
    const candidates: BatchRow[] = [];
    for (const row of rows) {
      const existingHash = provenanceByRecord.get(row.sourceRecordId);
      if (!existingHash) {
        candidates.push(row);
        continue;
      }
      if (existingHash !== row.sourceRecordHash) {
        throw new Error(`SOURCE_RECORD_IMMUTABLE: ${row.sourceRecordId} already exists with different content`);
      }
      sourceDuplicates += 1;
    }

    const contentHashes = [...new Set(candidates.map((row) => row.contentHash))];
    const questionPayload = candidates.map((row) => ({
      topic_id: row.topicId,
      question: row.question,
      options: row.options,
      correct_answer: row.correctAnswer,
      question_format: row.questionFormat,
      expected_answer: row.expectedAnswer,
      answer_metadata: row.answerMetadata,
      max_points: row.maxPoints,
      negative_marks: row.negativeMarks,
      time_limit_sec: row.timeLimitSec,
      difficulty: row.difficulty,
      tags: row.tags,
      explanation: row.explanation,
      content_hash: row.contentHash,
    }));
    const insertedQuestions = questionPayload.length === 0
      ? { rows: [] as Array<{ id: number; content_hash: string }> }
      : await client.query<{ id: number; content_hash: string }>(
        `INSERT INTO questions (
           course_id, bank_id, topic_id, question, options, correct_answer,
           is_active, question_type, question_format, expected_answer,
           answer_metadata, max_points, negative_marks, time_limit_sec,
           difficulty, tags, explanation, content_hash,
           review_status, generation_source, reviewed_by, reviewed_at
         )
         SELECT NULL, $1, x.topic_id, x.question, x.options::json, x.correct_answer,
                false, 'multiple_choice', x.question_format, x.expected_answer,
                x.answer_metadata, x.max_points, x.negative_marks, x.time_limit_sec,
                x.difficulty, x.tags::json, x.explanation, x.content_hash,
                'pending', 'imported', NULL, NULL
           FROM jsonb_to_recordset($2::jsonb) AS x(
             topic_id integer, question text, options jsonb, correct_answer integer,
             question_format text, expected_answer text, answer_metadata jsonb,
             max_points integer, negative_marks integer, time_limit_sec integer,
             difficulty text, tags jsonb, explanation text, content_hash text
           )
         ON CONFLICT (bank_id, content_hash)
           WHERE bank_id IS NOT NULL AND content_hash IS NOT NULL
         DO NOTHING
         RETURNING id, content_hash`,
        [context.bankId, JSON.stringify(questionPayload)],
      );

    const questionRows = contentHashes.length === 0
      ? { rows: [] as Array<{ id: number; content_hash: string }> }
      : await client.query<{ id: number; content_hash: string }>(
        `SELECT id, content_hash
           FROM questions
          WHERE bank_id = $1 AND content_hash = ANY($2::text[])`,
        [context.bankId, contentHashes],
      );
    const questionIdByHash = new Map(questionRows.rows.map((row) => [row.content_hash, row.id]));
    if (questionIdByHash.size !== contentHashes.length) {
      throw new Error("A canonical question could not be resolved after deduplication");
    }
    const newlyInsertedHashes = new Set(insertedQuestions.rows.map((row) => row.content_hash));
    const createdDispositionAssigned = new Set<string>();
    const provenancePayload = candidates.map((row) => {
      const mayBeCreated = newlyInsertedHashes.has(row.contentHash)
        && !createdDispositionAssigned.has(row.contentHash);
      if (mayBeCreated) createdDispositionAssigned.add(row.contentHash);
      return {
        question_id: questionIdByHash.get(row.contentHash),
        source_record_id: row.sourceRecordId,
        source_record_hash: row.sourceRecordHash,
        content_hash: row.contentHash,
        disposition: mayBeCreated ? "created" : "deduplicated",
        language: row.provenance.language,
        syllabus: row.provenance.syllabus,
        exam_name: row.provenance.examName,
        exam_year: row.provenance.examYear,
        subject: row.provenance.subject,
        source_topic: row.provenance.sourceTopic,
        objective: row.provenance.objective,
        source_locator: row.provenance.sourceLocator,
        question_origin: row.provenance.questionOrigin,
        answer_evidence: row.provenance.answerEvidence,
        explanation_origin: row.provenance.explanationOrigin,
        source_metadata: row.provenance.sourceMetadata,
      };
    });
    const insertedProvenance = provenancePayload.length === 0
      ? { rowCount: 0 }
      : await client.query(
        `INSERT INTO question_provenance (
           question_id, source_id, import_run_id, source_record_id,
           source_record_hash, content_hash, disposition, language, syllabus,
           exam_name, exam_year, subject, source_topic, objective, source_locator,
           question_origin, answer_evidence, explanation_origin, source_metadata
         )
         SELECT x.question_id, $1, $2, x.source_record_id,
                x.source_record_hash, x.content_hash, x.disposition, x.language,
                x.syllabus, x.exam_name, x.exam_year, x.subject, x.source_topic,
                x.objective, x.source_locator, x.question_origin,
                x.answer_evidence, x.explanation_origin, x.source_metadata
           FROM jsonb_to_recordset($3::jsonb) AS x(
             question_id integer, source_record_id text, source_record_hash text,
             content_hash text, disposition text, language text, syllabus text,
             exam_name text, exam_year integer, subject text, source_topic text,
             objective text, source_locator text, question_origin text,
             answer_evidence text, explanation_origin text, source_metadata jsonb
           )
         ON CONFLICT (source_id, source_record_id) DO NOTHING`,
        [context.sourceId, context.runId, JSON.stringify(provenancePayload)],
      );
    if ((insertedProvenance.rowCount ?? 0) !== provenancePayload.length) {
      throw new Error("A source-record provenance row changed concurrently; retry the import safely");
    }

    const insertedCount = insertedQuestions.rows.length;
    const linkedCount = insertedProvenance.rowCount ?? 0;
    const contentDuplicates = candidates.length - insertedCount;
    const next = {
      processedRows: context.processedRows + rows.length,
      insertedQuestions: context.insertedQuestions + insertedCount,
      linkedProvenance: context.linkedProvenance + linkedCount,
      sourceDuplicateRows: context.sourceDuplicateRows + sourceDuplicates,
      contentDuplicateRows: context.contentDuplicateRows + contentDuplicates,
    };
    await client.query(
      `UPDATE question_pack_import_runs
          SET processed_rows = $2, inserted_questions = $3,
              linked_provenance = $4, source_duplicate_rows = $5,
              content_duplicate_rows = $6, updated_at = NOW()
        WHERE id = $1`,
      [
        context.runId,
        next.processedRows,
        next.insertedQuestions,
        next.linkedProvenance,
        next.sourceDuplicateRows,
        next.contentDuplicateRows,
      ],
    );
    await client.query(
      `UPDATE question_banks
          SET question_count = (
                SELECT count(*)::integer
                  FROM questions
                 WHERE bank_id = $1 AND review_status <> 'retired'
              ),
              updated_at = NOW()
        WHERE id = $1`,
      [context.bankId],
    );
    await client.query("COMMIT");
    Object.assign(context, next);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function importQuestionPack(options: {
  databaseUrl?: string;
  inputPath: string;
  sourceKey: string;
  bankSlug: string;
  operator: string;
  batchSize?: number;
  maxRows?: number;
  commit?: boolean;
  resume?: boolean;
}) {
  const inputPath = path.resolve(options.inputPath);
  const batchSize = options.batchSize ?? DEFAULT_QUESTION_PACK_BATCH_SIZE;
  const maxRows = options.maxRows ?? MAX_QUESTION_PACK_ROWS;
  const operator = options.operator.trim();
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_QUESTION_PACK_BATCH_SIZE) {
    throw new Error(`batchSize must be between 1 and ${MAX_QUESTION_PACK_BATCH_SIZE}`);
  }
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > MAX_QUESTION_PACK_ROWS) {
    throw new Error(`maxRows must be between 1 and ${MAX_QUESTION_PACK_ROWS}`);
  }
  if (operator.length < 3 || operator.length > 200) {
    throw new Error("operator must identify the importer in 3-200 characters");
  }

  const validation = await validateQuestionPack(inputPath, maxRows);
  // Validation and import use separate streaming passes. Refuse a normal file
  // replacement/edit between those passes so the durable run hash still names
  // the bytes whose records were validated.
  if (await sha256File(inputPath) !== validation.inputSha256) {
    throw new Error("QUESTION_PACK_CHANGED: input changed after validation; run validation again");
  }
  if (!options.commit) {
    return {
      status: "validated_only",
      inputPath,
      sourceKey: options.sourceKey,
      bankSlug: options.bankSlug,
      ...validation,
    };
  }
  if (!options.databaseUrl) throw new Error("DATABASE_URL is required with --commit");

  const client = new PgClient({ connectionString: options.databaseUrl });
  let runId: number | undefined;
  let lockedRunId: number | undefined;
  await client.connect();
  try {
    const loaded = await loadImportContext(client, {
      sourceKey: options.sourceKey,
      bankSlug: options.bankSlug,
      inputName: path.basename(inputPath),
      inputSha256: validation.inputSha256,
      operator,
      batchSize,
      maxRows,
      validation,
      resume: options.resume ?? false,
    });
    if ("completed" in loaded) return loaded.summary;
    const context = loaded;
    const runLock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(7305, $1) AS acquired",
      [context.runId],
    );
    if (!runLock.rows[0]?.acquired) {
      throw new Error(`IMPORT_RUN_ACTIVE: import run ${context.runId} is already running`);
    }
    lockedRunId = context.runId;
    runId = context.runId;
    const topicIds = await ensureTopics(client, context.bankId, validation.topics);
    let currentRow = 0;
    let batch: BatchRow[] = [];
    for await (const record of readQuestionPackJsonl(inputPath, maxRows)) {
      currentRow += 1;
      if (currentRow <= context.processedRows) continue;
      const normalized = normalizeQuestionPackItem(record.value);
      if (!normalized.ok) {
        throw new Error(`Validated input changed while importing at line ${record.lineNumber}`);
      }
      const topicSlug = resolvedQuestionPackTopicSlug(normalized.value);
      const topicId = topicIds.get(topicSlug);
      if (!topicId) throw new Error(`Topic was not materialized: ${topicSlug}`);
      batch.push({ ...normalized.value, topicSlug, topicId });
      if (batch.length >= batchSize) {
        await importBatch(client, context, batch);
        batch = [];
      }
    }
    if (batch.length > 0) await importBatch(client, context, batch);
    if (context.processedRows !== validation.totalRows) {
      throw new Error(`Import stopped at ${context.processedRows}/${validation.totalRows} rows`);
    }
    await client.query(
      `UPDATE question_pack_import_runs
          SET status = 'completed', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND status = 'importing'`,
      [context.runId],
    );
    return {
      status: "completed",
      runId: context.runId,
      inputSha256: validation.inputSha256,
      totalRows: validation.totalRows,
      processedRows: context.processedRows,
      insertedQuestions: context.insertedQuestions,
      linkedProvenance: context.linkedProvenance,
      sourceDuplicateRows: context.sourceDuplicateRows,
      contentDuplicateRows: context.contentDuplicateRows,
      governance: { reviewStatus: "pending", isActive: false, certified: false },
    };
  } catch (error) {
    if (runId) {
      await client.query(
        `UPDATE question_pack_import_runs
            SET status = 'failed', failure_code = $2, failure_message = $3,
                updated_at = NOW()
          WHERE id = $1 AND status <> 'completed'`,
        [
          runId,
          error instanceof QuestionPackValidationError ? error.code : "IMPORT_FAILED",
          (error instanceof Error ? error.message : String(error)).slice(0, 4_000),
        ],
      ).catch(() => undefined);
    }
    throw error;
  } finally {
    if (lockedRunId) {
      await client.query("SELECT pg_advisory_unlock(7305, $1)", [lockedRunId]).catch(() => undefined);
    }
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      source: { type: "string" },
      bank: { type: "string" },
      operator: { type: "string" },
      "batch-size": { type: "string", default: String(DEFAULT_QUESTION_PACK_BATCH_SIZE) },
      "max-rows": { type: "string", default: String(MAX_QUESTION_PACK_ROWS) },
      commit: { type: "boolean", default: false },
      resume: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  if (!values.file) throw new Error("--file <questions.jsonl> is required");
  if (!values.source) throw new Error("--source <registered-source-key> is required");
  if (!values.bank) throw new Error("--bank <admin-bank-slug> is required");
  if (!values.operator) throw new Error("--operator <import-operator> is required");
  if (values.resume && !values.commit) throw new Error("--resume is only valid with --commit");

  const result = await importQuestionPack({
    databaseUrl: process.env.DATABASE_URL,
    inputPath: values.file,
    sourceKey: values.source,
    bankSlug: values.bank,
    operator: values.operator,
    batchSize: Number(values["batch-size"]),
    maxRows: Number(values["max-rows"]),
    commit: values.commit,
    resume: values.resume,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/import-question-pack\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    if (error instanceof QuestionPackValidationError) {
      process.stderr.write(`${error.message}\n${JSON.stringify(error.validationErrors, null, 2)}\n`);
    } else {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
    process.exitCode = 1;
  });
}
