#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import { buildGovernedAssessmentInventory } from "./governed-assessment-inventory";
import {
  governedAssessmentContentManifestSha256,
  governedReleaseBundleSha256,
  type GovernedAssessmentInventoryInput,
  type InventoryReleaseBundle,
} from "./lib/governed-assessment-inventory";

const { Client } = pg;
const EVIDENCE_ONLY_BLOCKERS = new Set([
  "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED",
  "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED",
  "RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE",
]);

export type AssessmentReleaseRole =
  | "release_operator"
  | "accessibility_reviewer"
  | "content_reviewer"
  | "rights_reviewer"
  | "cut_score_approver"
  | "qa_reviewer"
  | "publisher"
  | "rollback_owner";

type ReleasePrincipalIds = {
  operator: number;
  accessibility: number;
  content: number;
  rights: number;
  cutScore: number;
  qa: number;
  publisher: number;
  rollback: number;
};

const RELEASE_AUTHORIZATION_ROLES: Record<keyof ReleasePrincipalIds, AssessmentReleaseRole> = {
  operator: "release_operator",
  accessibility: "accessibility_reviewer",
  content: "content_reviewer",
  rights: "rights_reviewer",
  cutScore: "cut_score_approver",
  qa: "qa_reviewer",
  publisher: "publisher",
  rollback: "rollback_owner",
};

const FORBIDDEN_RELEASE_IDENTITY = /(^|[^a-z0-9])(smoke|test|testing|automation|automated|bot|robot|system|service account)([^a-z0-9]|$)|\b(ai|artificial intelligence)\b.*\b(author|authoring|generated|automation)\b|\bassessment authoring\b/i;

export function assertAuthorizedReleasePrincipals(
  roleIds: ReleasePrincipalIds,
  users: Array<{ id: number; name: string; email: string }>,
  activeAuthorizations: Array<{ userId: number; releaseRole: string }>,
) {
  if (activeAuthorizations.length === 0) {
    throw new Error("NO_RELEASE_ROLE_AUTHORIZATIONS: no active release-role grants exist; an administrator must grant roles first");
  }
  const usersById = new Map(users.map((user) => [user.id, user]));
  const grants = new Set(activeAuthorizations.map((grant) => `${grant.userId}:${grant.releaseRole}`));
  for (const [principal, userId] of Object.entries(roleIds) as Array<[keyof ReleasePrincipalIds, number]>) {
    const user = usersById.get(userId);
    if (!user) throw new Error(`RELEASE_PRINCIPAL_NOT_FOUND: ${principal} user ${userId} does not exist`);
    if (FORBIDDEN_RELEASE_IDENTITY.test(`${user.name} ${user.email}`.normalize("NFKC"))) {
      throw new Error(`RELEASE_PRINCIPAL_IDENTITY_FORBIDDEN: ${principal} user ${userId} is an automation, AI-authoring, test, or smoke identity`);
    }
    const requiredRole = RELEASE_AUTHORIZATION_ROLES[principal];
    if (!grants.has(`${userId}:${requiredRole}`)) {
      throw new Error(`RELEASE_ROLE_NOT_AUTHORIZED: ${principal} user ${userId} lacks active ${requiredRole} authorization; grant roles first`);
    }
  }
}

export type RecordAssessmentReleaseEvidenceOptions = {
  databaseUrl: string;
  assessmentSlug: string;
  operator: string;
  operatorUserId: number;
  accessibilityReviewerUserId: number;
  contentReviewerUserId: number;
  rightsReviewerUserId: number;
  cutScoreApproverUserId: number;
  qaReviewerUserId: number;
  publisherUserId: number;
  rollbackOwnerUserId: number;
  accessibilityStandard: string;
  accessibilityReference: string;
  accessibilitySha256: string;
  formSimulationReference: string;
  formSimulationSha256: string;
  cutScoreMethod: string;
  cutScoreApprovalReference: string;
  cutScoreApprovalSha256: string;
  releaseQaReference: string;
  releaseQaSha256: string;
  releaseCommit: string;
  takedownProcedure: string;
  apply?: boolean;
  confirmReleaseEvidence?: boolean;
};

function requireString(name: string, value: string, minimum: number, maximum: number) {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`${name} must be ${minimum}-${maximum} characters`);
  return normalized;
}

function requireHash(name: string, value: string) {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`${name} must be an exact lowercase SHA-256`);
  return value;
}

function requireUserId(name: string, value: number) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must identify an existing user`);
  return value;
}

function stableFieldsMatch(existing: Record<string, unknown>, expected: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => String(existing[field]) === String(expected[field]));
}

export async function recordAssessmentReleaseEvidence(options: RecordAssessmentReleaseEvidenceOptions) {
  const operator = requireString("operator", options.operator, 3, 200);
  const accessibilityStandard = requireString("accessibilityStandard", options.accessibilityStandard, 3, 120);
  const accessibilityReference = requireString("accessibilityReference", options.accessibilityReference, 8, 500);
  const formSimulationReference = requireString("formSimulationReference", options.formSimulationReference, 8, 500);
  const cutScoreMethod = requireString("cutScoreMethod", options.cutScoreMethod, 3, 500);
  const cutScoreApprovalReference = requireString("cutScoreApprovalReference", options.cutScoreApprovalReference, 8, 500);
  const releaseQaReference = requireString("releaseQaReference", options.releaseQaReference, 8, 500);
  const takedownProcedure = requireString("takedownProcedure", options.takedownProcedure, 20, 4000);
  const accessibilitySha256 = requireHash("accessibilitySha256", options.accessibilitySha256);
  const formSimulationSha256 = requireHash("formSimulationSha256", options.formSimulationSha256);
  const cutScoreApprovalSha256 = requireHash("cutScoreApprovalSha256", options.cutScoreApprovalSha256);
  const releaseQaSha256 = requireHash("releaseQaSha256", options.releaseQaSha256);
  if (!/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(options.releaseCommit)) throw new Error("releaseCommit must be an exact lowercase Git commit hash");
  if (options.apply && !options.confirmReleaseEvidence) throw new Error("--confirm-release-evidence is required with --apply");
  if (!options.apply && options.confirmReleaseEvidence) throw new Error("--confirm-release-evidence is valid only with --apply");

  const roleIds = {
    operator: requireUserId("operatorUserId", options.operatorUserId),
    accessibility: requireUserId("accessibilityReviewerUserId", options.accessibilityReviewerUserId),
    content: requireUserId("contentReviewerUserId", options.contentReviewerUserId),
    rights: requireUserId("rightsReviewerUserId", options.rightsReviewerUserId),
    cutScore: requireUserId("cutScoreApproverUserId", options.cutScoreApproverUserId),
    qa: requireUserId("qaReviewerUserId", options.qaReviewerUserId),
    publisher: requireUserId("publisherUserId", options.publisherUserId),
    rollback: requireUserId("rollbackOwnerUserId", options.rollbackOwnerUserId),
  };
  const approvalRoleIds = [roleIds.accessibility, roleIds.content, roleIds.rights, roleIds.cutScore, roleIds.qa, roleIds.publisher];
  if (new Set(approvalRoleIds).size !== approvalRoleIds.length) {
    throw new Error("SELF_APPROVAL_FORBIDDEN: accessibility, content, rights, cut-score, QA, and publisher user IDs must all be distinct");
  }

  const initialReport = await buildGovernedAssessmentInventory({ databaseUrl: options.databaseUrl, assessmentSlugs: [options.assessmentSlug] });
  const assessmentReport = initialReport.assessments.find((assessment: any) => assessment.slug === options.assessmentSlug);
  if (!assessmentReport) throw new Error(`Assessment ${options.assessmentSlug} was not found`);
  const substantiveBlockers = assessmentReport.blockers.filter((blocker: any) => !EVIDENCE_ONLY_BLOCKERS.has(blocker.code));
  if (substantiveBlockers.length > 0) {
    throw new Error(`SUBSTANTIVE_CONTENT_BLOCKERS: ${substantiveBlockers.map((blocker: any) => blocker.code).join(", ")}`);
  }

  const client = new Client({ connectionString: options.databaseUrl, application_name: "octamy-record-assessment-release-evidence" });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query(options.apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '2s'");

    const courseResult = await client.query<{
      id: number; passing_score: number; revision: number | null;
    }>(
      `SELECT course.id, course.passing_score,
              (SELECT max(version.revision) FROM course_question_blueprint_versions version WHERE version.course_id = course.id) AS revision
         FROM courses course
        WHERE course.slug = $1 AND course.product_type = 'assessment'
        ${options.apply ? "FOR UPDATE" : ""}`,
      [options.assessmentSlug],
    );
    const course = courseResult.rows[0];
    if (!course || course.revision == null) throw new Error("A current immutable blueprint revision is required");
    if (options.apply) await client.query("SELECT pg_advisory_xact_lock(7355, $1)", [course.id]);

    const distinctIds = Array.from(new Set(Object.values(roleIds)));
    const users = await client.query<{ id: number; is_admin: boolean; name: string; email: string }>(
      `SELECT id, is_admin, name, email FROM users WHERE id = ANY($1::int[])`,
      [distinctIds],
    );
    if (users.rows.length !== distinctIds.length) throw new Error("Every operator/reviewer/signatory user ID must exist");
    if (!users.rows.find((user) => user.id === roleIds.operator)?.is_admin) throw new Error("OPERATOR_NOT_AUTHORIZED: --operator-user-id must identify an administrator");

    const authorizationResult = await client.query<{ userId: number; releaseRole: string }>(
      `SELECT grant_event.user_id AS "userId", grant_event.release_role AS "releaseRole"
         FROM assessment_release_role_authorizations grant_event
        WHERE grant_event.authorization_action = 'grant'
          AND grant_event.user_id = ANY($1::int[])
          AND NOT EXISTS (
            SELECT 1 FROM assessment_release_role_authorizations revoke_event
             WHERE revoke_event.authorization_action = 'revoke'
               AND revoke_event.supersedes_authorization_id = grant_event.id
          )`,
      [distinctIds],
    );
    assertAuthorizedReleasePrincipals(
      roleIds,
      users.rows.map(({ id, name, email }) => ({ id, name, email })),
      authorizationResult.rows,
    );

    const rulesResult = await client.query<{
      id: number; bank_id: number; topic_id: number | null; question_count: number; difficulty: string;
    }>(
      `SELECT id, bank_id, topic_id, question_count, difficulty
         FROM course_question_blueprint WHERE course_id = $1 ORDER BY sort_order, id`,
      [course.id],
    );
    const questionsResult = await client.query<{
      id: number; version: number; content_hash: string; created_by: number; reviewed_by: number;
    }>(
      `SELECT DISTINCT question.id, question.version, question.content_hash, question.created_by, question.reviewed_by
         FROM questions question
        WHERE question.review_status = 'approved' AND question.is_active = true
          AND EXISTS (
            SELECT 1 FROM course_question_blueprint blueprint
             WHERE blueprint.course_id = $1 AND blueprint.bank_id = question.bank_id
               AND (blueprint.topic_id IS NULL OR blueprint.topic_id = question.topic_id)
               AND (blueprint.difficulty = 'mixed' OR blueprint.difficulty = question.difficulty)
          )
        ORDER BY question.id`,
      [course.id],
    );
    if (!questionsResult.rows.some((question) => question.reviewed_by === roleIds.content)) {
      throw new Error("CONTENT_REVIEWER_NOT_ATTRIBUTABLE: content reviewer must be an in-scope item reviewer");
    }
    const itemAuthorsAndReviewers = new Set(questionsResult.rows.flatMap((question) => [question.created_by, question.reviewed_by]));
    if (itemAuthorsAndReviewers.has(roleIds.accessibility) || itemAuthorsAndReviewers.has(roleIds.rights)) {
      throw new Error("SELF_APPROVAL_FORBIDDEN: accessibility and rights reviewers must be independent from every in-scope item author and content reviewer");
    }
    const sourcesResult = await client.query<{
      question_id: number; source_id: number; evidence_reference: string; evidence_sha256: string; provenance_content_hash: string;
    }>(
      `SELECT question.id AS question_id, source.id AS source_id,
              source.evidence_reference,
              source.provenance #>> '{rightsReview,evidenceSha256}' AS evidence_sha256,
              provenance.content_hash AS provenance_content_hash
         FROM questions question
         INNER JOIN question_provenance provenance ON provenance.question_id = question.id
         INNER JOIN question_pack_sources source ON source.id = provenance.source_id
        WHERE question.id = ANY($1::int[])
        ORDER BY question.id, source.id`,
      [questionsResult.rows.map((question) => question.id)],
    );
    const sourceById = new Map<number, { sourceId: number; evidenceReference: string; evidenceSha256: string }>();
    const sourcesByQuestion = new Map<number, Array<{ sourceId: number; provenanceContentHash: string }>>();
    for (const source of sourcesResult.rows) {
      requireString("source evidence reference", source.evidence_reference, 8, 500);
      requireHash("source evidence hash", source.evidence_sha256);
      sourceById.set(source.source_id, { sourceId: source.source_id, evidenceReference: source.evidence_reference, evidenceSha256: source.evidence_sha256 });
      sourcesByQuestion.set(source.question_id, [...(sourcesByQuestion.get(source.question_id) ?? []), {
        sourceId: source.source_id,
        provenanceContentHash: source.provenance_content_hash,
      }]);
    }
    if (sourceById.size === 0) throw new Error("At least one exact source-rights record is required");

    const manifestInput = {
      id: course.id,
      blueprintRevision: Number(course.revision),
      rules: rulesResult.rows.map((rule) => ({
        id: rule.id, bankId: rule.bank_id, topicId: rule.topic_id, questionCount: rule.question_count, difficulty: rule.difficulty, bank: null,
      })),
      questions: questionsResult.rows.map((question) => ({
        id: question.id, version: question.version, contentHash: question.content_hash,
        sourceLinks: sourcesByQuestion.get(question.id) ?? [],
      })),
    } as Pick<GovernedAssessmentInventoryInput, "id" | "blueprintRevision" | "rules" | "questions">;
    const contentManifestSha256 = governedAssessmentContentManifestSha256(manifestInput);
    const recordedAt = new Date();
    const takedownProcedureSha256 = createHash("sha256").update(takedownProcedure, "utf8").digest("hex");
    const unsignedBundle: Omit<InventoryReleaseBundle, "bundleSha256"> = {
      blueprintRevision: Number(course.revision),
      contentManifestSha256,
      formSimulationReference,
      formSimulationSha256,
      cutScore: Number(course.passing_score),
      cutScoreMethod,
      cutScoreApprovalReference,
      cutScoreApprovalSha256,
      cutScoreApproverUserId: roleIds.cutScore,
      cutScoreApprovedAt: recordedAt,
      releaseQaReference,
      releaseQaSha256,
      qaReviewerUserId: roleIds.qa,
      qaAcceptedAt: recordedAt,
      contentReviewerUserId: roleIds.content,
      publisherUserId: roleIds.publisher,
      publisherSignedAt: recordedAt,
      releaseCommit: options.releaseCommit,
      releasedAt: recordedAt,
      rollbackOwnerUserId: roleIds.rollback,
      takedownProcedure,
      takedownProcedureSha256,
    };
    const bundle = { ...unsignedBundle, bundleSha256: governedReleaseBundleSha256(unsignedBundle) };

    const existingAccessibility = await client.query<Record<string, unknown>>(
      `SELECT * FROM assessment_accessibility_acceptances WHERE assessment_id = $1 AND blueprint_revision = $2`,
      [course.id, course.revision],
    );
    const expectedAccessibility: Record<string, unknown> = {
      reviewer_user_id: roleIds.accessibility, standard: accessibilityStandard,
      evidence_reference: accessibilityReference, evidence_sha256: accessibilitySha256,
      recorded_by_user_id: roleIds.operator,
    };
    if (existingAccessibility.rows[0] && !stableFieldsMatch(existingAccessibility.rows[0], expectedAccessibility, Object.keys(expectedAccessibility))) {
      throw new Error("IMMUTABLE_EVIDENCE_CONFLICT: accessibility acceptance differs from the existing current-revision record");
    }

    const existingRights = await client.query<Record<string, unknown>>(
      `SELECT * FROM assessment_rights_role_reviews WHERE assessment_id = $1 AND blueprint_revision = $2`,
      [course.id, course.revision],
    );
    for (const source of sourceById.values()) {
      const existing = existingRights.rows.find((row) => Number(row.source_id) === source.sourceId);
      const expected: Record<string, unknown> = {
        reviewer_user_id: roleIds.rights, evidence_reference: source.evidenceReference,
        evidence_sha256: source.evidenceSha256, recorded_by_user_id: roleIds.operator,
      };
      if (existing && !stableFieldsMatch(existing, expected, Object.keys(expected))) {
        throw new Error(`IMMUTABLE_EVIDENCE_CONFLICT: rights role record differs for source ${source.sourceId}`);
      }
    }

    const existingBundle = await client.query<Record<string, unknown>>(
      `SELECT * FROM assessment_release_bundles WHERE assessment_id = $1 AND blueprint_revision = $2`,
      [course.id, course.revision],
    );
    const expectedBundle: Record<string, unknown> = {
      content_manifest_sha256: bundle.contentManifestSha256,
      form_simulation_reference: bundle.formSimulationReference,
      form_simulation_sha256: bundle.formSimulationSha256,
      cut_score: bundle.cutScore,
      cut_score_method: bundle.cutScoreMethod,
      cut_score_approval_reference: bundle.cutScoreApprovalReference,
      cut_score_approval_sha256: bundle.cutScoreApprovalSha256,
      cut_score_approver_user_id: bundle.cutScoreApproverUserId,
      release_qa_reference: bundle.releaseQaReference,
      release_qa_sha256: bundle.releaseQaSha256,
      qa_reviewer_user_id: bundle.qaReviewerUserId,
      content_reviewer_user_id: bundle.contentReviewerUserId,
      publisher_user_id: bundle.publisherUserId,
      release_commit: bundle.releaseCommit,
      rollback_owner_user_id: bundle.rollbackOwnerUserId,
      takedown_procedure: bundle.takedownProcedure,
      takedown_procedure_sha256: bundle.takedownProcedureSha256,
      recorded_by_user_id: roleIds.operator,
    };
    if (existingBundle.rows[0] && !stableFieldsMatch(existingBundle.rows[0], expectedBundle, Object.keys(expectedBundle))) {
      throw new Error("IMMUTABLE_EVIDENCE_CONFLICT: release bundle differs from the existing current-revision record");
    }

    const missingRightsSourceIds = Array.from(sourceById.keys()).filter((sourceId) => !existingRights.rows.some((row) => Number(row.source_id) === sourceId));
    const planned = {
      accessibilityAcceptance: existingAccessibility.rowCount === 0 ? 1 : 0,
      rightsRoleReviews: missingRightsSourceIds.length,
      releaseBundle: existingBundle.rowCount === 0 ? 1 : 0,
    };
    if (!options.apply) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return { status: "dry_run", assessmentSlug: options.assessmentSlug, assessmentId: course.id, blueprintRevision: course.revision, contentManifestSha256, planned, publicationChanged: false };
    }

    if (planned.accessibilityAcceptance) {
      await client.query(
        `INSERT INTO assessment_accessibility_acceptances
          (assessment_id, blueprint_revision, reviewer_user_id, standard, evidence_reference, evidence_sha256, accepted_at, operator, recorded_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [course.id, course.revision, roleIds.accessibility, accessibilityStandard, accessibilityReference, accessibilitySha256, recordedAt, operator, roleIds.operator],
      );
    }
    for (const source of sourceById.values()) {
      if (existingRights.rows.some((row) => Number(row.source_id) === source.sourceId)) continue;
      await client.query(
        `INSERT INTO assessment_rights_role_reviews
          (assessment_id, blueprint_revision, source_id, reviewer_user_id, evidence_reference, evidence_sha256, reviewed_at, operator, recorded_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [course.id, course.revision, source.sourceId, roleIds.rights, source.evidenceReference, source.evidenceSha256, recordedAt, operator, roleIds.operator],
      );
    }
    if (planned.releaseBundle) {
      await client.query(
        `INSERT INTO assessment_release_bundles (
          assessment_id, blueprint_revision, content_manifest_sha256,
          form_simulation_reference, form_simulation_sha256,
          cut_score, cut_score_method, cut_score_approval_reference, cut_score_approval_sha256,
          cut_score_approver_user_id, cut_score_approved_at,
          release_qa_reference, release_qa_sha256, qa_reviewer_user_id, qa_accepted_at,
          content_reviewer_user_id, publisher_user_id, publisher_signed_at,
          release_commit, released_at, rollback_owner_user_id,
          takedown_procedure, takedown_procedure_sha256, bundle_sha256, operator, recorded_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [course.id, course.revision, bundle.contentManifestSha256,
          bundle.formSimulationReference, bundle.formSimulationSha256,
          bundle.cutScore, bundle.cutScoreMethod, bundle.cutScoreApprovalReference, bundle.cutScoreApprovalSha256,
          bundle.cutScoreApproverUserId, bundle.cutScoreApprovedAt,
          bundle.releaseQaReference, bundle.releaseQaSha256, bundle.qaReviewerUserId, bundle.qaAcceptedAt,
          bundle.contentReviewerUserId, bundle.publisherUserId, bundle.publisherSignedAt,
          bundle.releaseCommit, bundle.releasedAt, bundle.rollbackOwnerUserId,
          bundle.takedownProcedure, bundle.takedownProcedureSha256, bundle.bundleSha256, operator, roleIds.operator],
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;
    const verified = await buildGovernedAssessmentInventory({ databaseUrl: options.databaseUrl, assessmentSlugs: [options.assessmentSlug] });
    const verifiedAssessment = verified.assessments.find((assessment: any) => assessment.slug === options.assessmentSlug);
    if (!verifiedAssessment?.releaseReady) throw new Error(`POST_WRITE_VERIFICATION_FAILED: ${verifiedAssessment?.blockers.map((blocker: any) => blocker.code).join(", ")}`);
    return { status: Object.values(planned).every((count) => count === 0) ? "already_recorded" : "applied", assessmentSlug: options.assessmentSlug, assessmentId: course.id, blueprintRevision: course.revision, contentManifestSha256, planned, releaseReady: true, publicationChanged: false };
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
      assessment: { type: "string" }, operator: { type: "string" }, "operator-user-id": { type: "string" },
      "accessibility-reviewer-user-id": { type: "string" }, "content-reviewer-user-id": { type: "string" }, "rights-reviewer-user-id": { type: "string" },
      "cut-score-approver-user-id": { type: "string" }, "qa-reviewer-user-id": { type: "string" }, "publisher-user-id": { type: "string" }, "rollback-owner-user-id": { type: "string" },
      "accessibility-standard": { type: "string" }, "accessibility-reference": { type: "string" }, "accessibility-sha256": { type: "string" },
      "form-simulation-reference": { type: "string" }, "form-simulation-sha256": { type: "string" },
      "cut-score-method": { type: "string" }, "cut-score-approval-reference": { type: "string" }, "cut-score-approval-sha256": { type: "string" },
      "release-qa-reference": { type: "string" }, "release-qa-sha256": { type: "string" }, "release-commit": { type: "string" }, "takedown-procedure": { type: "string" },
      apply: { type: "boolean", default: false }, "confirm-release-evidence": { type: "boolean", default: false },
    },
    allowPositionals: false,
    strict: true,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const required = (name: keyof typeof values) => {
    const value = values[name];
    if (typeof value !== "string" || !value) throw new Error(`--${String(name)} is required`);
    return value;
  };
  const result = await recordAssessmentReleaseEvidence({
    databaseUrl: process.env.DATABASE_URL,
    assessmentSlug: required("assessment"), operator: required("operator"), operatorUserId: Number(required("operator-user-id")),
    accessibilityReviewerUserId: Number(required("accessibility-reviewer-user-id")), contentReviewerUserId: Number(required("content-reviewer-user-id")), rightsReviewerUserId: Number(required("rights-reviewer-user-id")),
    cutScoreApproverUserId: Number(required("cut-score-approver-user-id")), qaReviewerUserId: Number(required("qa-reviewer-user-id")), publisherUserId: Number(required("publisher-user-id")), rollbackOwnerUserId: Number(required("rollback-owner-user-id")),
    accessibilityStandard: required("accessibility-standard"), accessibilityReference: required("accessibility-reference"), accessibilitySha256: required("accessibility-sha256"),
    formSimulationReference: required("form-simulation-reference"), formSimulationSha256: required("form-simulation-sha256"),
    cutScoreMethod: required("cut-score-method"), cutScoreApprovalReference: required("cut-score-approval-reference"), cutScoreApprovalSha256: required("cut-score-approval-sha256"),
    releaseQaReference: required("release-qa-reference"), releaseQaSha256: required("release-qa-sha256"), releaseCommit: required("release-commit"), takedownProcedure: required("takedown-procedure"),
    apply: values.apply, confirmReleaseEvidence: values["confirm-release-evidence"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/record-assessment-release-evidence\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
