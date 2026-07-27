#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg, { type Client } from "pg";
import { z } from "zod";
import { questionReviewSeparationIssues } from "../server/lib/question-review-policy";

const { Client: PgClient } = pg;
const MAX_DECISIONS = 100_000;
const MAX_DECISION_FILE_BYTES = 256 * 1024 * 1024;

const decisionSchema = z.object({
  sourceRecordId: z.string().trim().min(3).max(300).regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]+$/),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().min(20).max(2_000),
}).strict().superRefine((decision, context) => {
  if (!decision.note.includes(decision.sourceRecordId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "The item-specific review note must include sourceRecordId",
    });
  }
});

export type QuestionPackReviewDecision = z.infer<typeof decisionSchema>;

export function parseQuestionPackReviewDecision(
  value: unknown,
): QuestionPackReviewDecision {
  return decisionSchema.parse(value);
}

async function readDecisionFile(filePathValue: string): Promise<{
  decisions: QuestionPackReviewDecision[];
  sha256: string;
}> {
  const filePath = path.resolve(filePathValue);
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error("Review decision file must not be a symbolic link");
    }
    throw error;
  });
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_DECISION_FILE_BYTES) {
      throw new Error(`Review decision file must be a non-empty regular file no larger than ${MAX_DECISION_FILE_BYTES} bytes`);
    }
    const bytes = await handle.readFile();
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const decisions: QuestionPackReviewDecision[] = [];
    const seen = new Set<string>();
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      if (decisions.length >= MAX_DECISIONS) {
        throw new Error(`Review decision files are limited to ${MAX_DECISIONS} records`);
      }
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        throw new Error(`Invalid JSON on review decision line ${index + 1}`);
      }
      const parsed = decisionSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(`Invalid review decision line ${index + 1}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
      }
      if (seen.has(parsed.data.sourceRecordId)) {
        throw new Error(`Duplicate sourceRecordId in review decisions: ${parsed.data.sourceRecordId}`);
      }
      seen.add(parsed.data.sourceRecordId);
      decisions.push(parsed.data);
    }
    if (decisions.length === 0) throw new Error("Review decision file contains no records");
    return {
      decisions,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } finally {
    await handle.close();
  }
}

type ReviewContext = {
  sourceId: number;
  sourceKey: string;
  rightsReviewerOperator: string;
  bankId: number;
  bankSlug: string;
  reviewerUserId: number;
  reviewerEmail: string;
};

async function loadContext(client: Client, options: {
  sourceKey: string;
  bankSlug: string;
  reviewerUserId: number;
}): Promise<ReviewContext> {
  const result = await client.query<{
    source_id: number;
    source_key: string;
    rights_reviewed_by: string;
    rights_reviewed_at: Date | null;
    rights_review_status: string;
    commercial_use_allowed: boolean;
    derivatives_allowed: boolean;
    evidence_reference: string | null;
    evidence_sha256: string | null;
    acquiring_entity: string | null;
    bank_id: number;
    bank_slug: string;
    reviewer_user_id: number | null;
    reviewer_email: string | null;
  }>(
    `SELECT source.id AS source_id, source.source_key,
            source.rights_reviewed_by, source.rights_reviewed_at,
            source.rights_review_status, source.commercial_use_allowed,
            source.derivatives_allowed, source.evidence_reference,
            source.provenance->'rightsReview'->>'evidenceSha256' AS evidence_sha256,
            source.provenance->'rightsReview'->>'acquiringEntity' AS acquiring_entity,
            bank.id AS bank_id, bank.slug AS bank_slug,
            reviewer.id AS reviewer_user_id, reviewer.email AS reviewer_email
       FROM question_pack_sources source
       INNER JOIN question_banks bank
         ON bank.slug = $2 AND bank.owner_type = 'admin' AND bank.owner_id IS NULL
       LEFT JOIN users reviewer ON reviewer.id = $3
      WHERE source.source_key = $1`,
    [options.sourceKey, options.bankSlug, options.reviewerUserId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Registered source and admin bank could not be resolved");
  if (!row.reviewer_user_id || !row.reviewer_email) {
    throw new Error(`Reviewer user was not found: ${options.reviewerUserId}`);
  }
  if (row.rights_review_status !== "verified"
    || !row.commercial_use_allowed
    || !row.derivatives_allowed
    || !row.rights_reviewed_at
    || !row.rights_reviewed_by?.trim()
    || !row.evidence_reference?.trim()
    || !row.acquiring_entity?.trim()
    || !/^[0-9a-f]{64}$/.test(row.evidence_sha256 ?? "")) {
    throw new Error("Source lacks complete independently recorded rights evidence");
  }
  return {
    sourceId: row.source_id,
    sourceKey: row.source_key,
    rightsReviewerOperator: row.rights_reviewed_by,
    bankId: row.bank_id,
    bankSlug: row.bank_slug,
    reviewerUserId: row.reviewer_user_id,
    reviewerEmail: row.reviewer_email,
  };
}

type QuestionRow = {
  id: number;
  version: number;
  content_hash: string | null;
  created_by: number | null;
  review_status: string;
  is_active: boolean;
  reviewed_by: number | null;
  answer_metadata: Record<string, unknown> | null;
  question_snapshot: Record<string, unknown>;
  provenance_content_hash: string;
  import_operator: string | null;
};

function existingAttestation(row: QuestionRow): Record<string, unknown> | null {
  const evidence = row.answer_metadata?.releaseEvidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return null;
  const attestation = (evidence as Record<string, unknown>).reviewAttestation;
  return attestation && typeof attestation === "object" && !Array.isArray(attestation)
    ? attestation as Record<string, unknown>
    : null;
}

function isAlreadyApplied(
  row: QuestionRow,
  decision: QuestionPackReviewDecision,
  reviewerUserId: number,
): boolean {
  if (row.version !== decision.expectedVersion + 1
    || row.review_status !== decision.decision
    || row.reviewed_by !== reviewerUserId
    || row.content_hash !== decision.contentHash
    || row.is_active !== (decision.decision === "approved")) return false;
  if (decision.decision === "rejected") return true;
  const attestation = existingAttestation(row);
  return attestation?.status === "attested"
    && attestation.reviewerId === reviewerUserId
    && attestation.contentHash === decision.contentHash
    && attestation.contentVersion === decision.expectedVersion
    && attestation.decisionVersion === decision.expectedVersion + 1
    && attestation.note === decision.note;
}

function reviewedMetadata(
  row: QuestionRow,
  decision: QuestionPackReviewDecision,
  reviewerUserId: number,
): Record<string, unknown> {
  const metadata = row.answer_metadata ?? {};
  const releaseEvidence = metadata.releaseEvidence;
  if (!releaseEvidence || typeof releaseEvidence !== "object" || Array.isArray(releaseEvidence)) {
    if (decision.decision === "approved") {
      throw new Error(`${decision.sourceRecordId}: approved decisions require imported releaseEvidence`);
    }
    return metadata;
  }
  const { reviewAttestation: _prior, ...evidence } = releaseEvidence as Record<string, unknown>;
  return {
    ...metadata,
    releaseEvidence: decision.decision === "approved" ? {
      ...evidence,
      reviewAttestation: {
        status: "attested",
        note: decision.note,
        contentHash: decision.contentHash,
        contentVersion: decision.expectedVersion,
        decisionVersion: decision.expectedVersion + 1,
        reviewerId: reviewerUserId,
      },
    } : evidence,
  };
}

async function loadQuestion(
  client: Client,
  context: ReviewContext,
  sourceRecordId: string,
  lock: boolean,
): Promise<QuestionRow> {
  const result = await client.query<QuestionRow>(
    `SELECT question.id, question.version, question.content_hash, question.created_by,
            question.review_status, question.is_active, question.reviewed_by,
            question.answer_metadata, to_jsonb(question) AS question_snapshot,
            provenance.content_hash AS provenance_content_hash,
            import_run.operator AS import_operator
       FROM question_provenance provenance
       INNER JOIN questions question ON question.id = provenance.question_id
       LEFT JOIN question_pack_import_runs import_run ON import_run.id = provenance.import_run_id
      WHERE provenance.source_id = $1
        AND provenance.source_record_id = $2
        AND question.bank_id = $3
      ${lock ? "FOR UPDATE OF question" : ""}`,
    [context.sourceId, sourceRecordId, context.bankId],
  );
  if (result.rows.length !== 1) {
    throw new Error(`${sourceRecordId}: expected exactly one imported question, found ${result.rows.length}`);
  }
  return result.rows[0];
}

export async function reviewQuestionPack(options: {
  databaseUrl: string;
  sourceKey: string;
  bankSlug: string;
  decisionFile: string;
  reviewerUserId: number;
  operator: string;
  apply?: boolean;
  confirmReviewed?: boolean;
}) {
  const operator = options.operator.normalize("NFKC").trim();
  if (operator.length < 3 || operator.length > 200) {
    throw new Error("operator must identify the human content reviewer in 3-200 characters");
  }
  if (!Number.isInteger(options.reviewerUserId) || options.reviewerUserId < 1) {
    throw new Error("reviewerUserId must identify an existing user");
  }
  if (options.apply && !options.confirmReviewed) {
    throw new Error("--confirm-reviewed is required with --apply");
  }
  if (!options.apply && options.confirmReviewed) {
    throw new Error("--confirm-reviewed is valid only with --apply");
  }

  const decisionFile = await readDecisionFile(options.decisionFile);
  const client = new PgClient({ connectionString: options.databaseUrl });
  await client.connect();
  try {
    await client.query(options.apply
      ? "BEGIN ISOLATION LEVEL SERIALIZABLE"
      : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const context = await loadContext(client, options);
      if (options.apply) await client.query("SELECT pg_advisory_xact_lock(7311, $1)", [context.bankId]);
      let applicable = 0;
      let alreadyApplied = 0;
      const appliedQuestionIds: number[] = [];

      for (const decision of decisionFile.decisions) {
        const row = await loadQuestion(client, context, decision.sourceRecordId, options.apply === true);
        if (isAlreadyApplied(row, decision, context.reviewerUserId)) {
          alreadyApplied += 1;
          continue;
        }
        if (row.version !== decision.expectedVersion) {
          throw new Error(`${decision.sourceRecordId}: version is ${row.version}, expected ${decision.expectedVersion}`);
        }
        if (row.content_hash !== decision.contentHash
          || row.provenance_content_hash !== decision.contentHash) {
          throw new Error(`${decision.sourceRecordId}: decision, question and provenance content hashes must match`);
        }
        if (!["draft", "pending"].includes(row.review_status) || row.is_active) {
          throw new Error(`${decision.sourceRecordId}: only inactive draft/pending items can receive a new decision`);
        }
        const separation = questionReviewSeparationIssues({
          authorUserId: row.created_by,
          reviewerUserId: context.reviewerUserId,
          reviewerOperator: operator,
          importOperators: row.import_operator ? [row.import_operator] : [],
          rightsReviewerOperator: context.rightsReviewerOperator,
        });
        if (!row.import_operator) separation.push("IMPORTER_SELF_REVIEW_FORBIDDEN");
        if (separation.length > 0) {
          throw new Error(`${decision.sourceRecordId}: review role separation failed (${Array.from(new Set(separation)).join(", ")})`);
        }
        const metadata = reviewedMetadata(row, decision, context.reviewerUserId);
        applicable += 1;
        if (!options.apply) continue;

        await client.query(
          `INSERT INTO question_versions (question_id, version, snapshot, change_note, changed_by)
           VALUES ($1, $2, $3::json, $4, $5)`,
          [row.id, row.version, JSON.stringify(row.question_snapshot), `Governed pack review ${decision.decision}: ${decision.note}`, context.reviewerUserId],
        );
        const updated = await client.query<{ id: number }>(
          `UPDATE questions
              SET review_status = $2,
                  is_active = ($2 = 'approved'),
                  reviewed_by = $3,
                  reviewed_at = NOW(),
                  answer_metadata = $4::jsonb,
                  version = version + 1,
                  updated_at = NOW()
            WHERE id = $1 AND version = $5 AND content_hash = $6
            RETURNING id`,
          [row.id, decision.decision, context.reviewerUserId, JSON.stringify(metadata), decision.expectedVersion, decision.contentHash],
        );
        if (!updated.rows[0]) throw new Error(`${decision.sourceRecordId}: concurrent review conflict`);
        appliedQuestionIds.push(row.id);
        await client.query(
          `INSERT INTO audit_logs (
             user_id, actor_email, actor_role, action, resource_type,
             resource_id, metadata, status
           ) VALUES ($1, $2, 'admin', 'question.pack_review', 'question', $3, $4::jsonb, 'success')`,
          [
            context.reviewerUserId,
            context.reviewerEmail,
            String(row.id),
            JSON.stringify({
              operator,
              sourceKey: context.sourceKey,
              bankSlug: context.bankSlug,
              sourceRecordId: decision.sourceRecordId,
              decision: decision.decision,
              contentHash: decision.contentHash,
              contentVersion: decision.expectedVersion,
              decisionVersion: decision.expectedVersion + 1,
              decisionFileSha256: decisionFile.sha256,
              note: decision.note,
            }),
          ],
        );
      }

      if (options.apply) await client.query("COMMIT");
      else await client.query("ROLLBACK");
      return {
        status: options.apply ? "applied" : "dry_run",
        sourceKey: context.sourceKey,
        bankSlug: context.bankSlug,
        reviewerUserId: context.reviewerUserId,
        reviewerEmail: context.reviewerEmail,
        operator,
        decisionFileSha256: decisionFile.sha256,
        decisions: decisionFile.decisions.length,
        applicable,
        alreadyApplied,
        appliedQuestionIds,
        publicationChanged: false,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      bank: { type: "string" },
      decisions: { type: "string" },
      "reviewer-user-id": { type: "string" },
      operator: { type: "string" },
      apply: { type: "boolean", default: false },
      "confirm-reviewed": { type: "boolean", default: false },
    },
    allowPositionals: false,
    strict: true,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!values.source) throw new Error("--source <registered-source-key> is required");
  if (!values.bank) throw new Error("--bank <admin-bank-slug> is required");
  if (!values.decisions) throw new Error("--decisions <review-decisions.jsonl> is required");
  if (!values["reviewer-user-id"]) throw new Error("--reviewer-user-id <user-id> is required");
  if (!values.operator) throw new Error("--operator <named-content-reviewer> is required");

  const result = await reviewQuestionPack({
    databaseUrl: process.env.DATABASE_URL,
    sourceKey: values.source,
    bankSlug: values.bank,
    decisionFile: values.decisions,
    reviewerUserId: Number(values["reviewer-user-id"]),
    operator: values.operator,
    apply: values.apply,
    confirmReviewed: values["confirm-reviewed"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/review-question-pack\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
