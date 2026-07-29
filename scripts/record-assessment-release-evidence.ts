#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import { buildGovernedAssessmentInventory } from "./governed-assessment-inventory";
import {
  governedAssessmentContentManifestSha256,
  governedMachineArtifactReference,
  governedReleaseBundleSha256,
  OFFICER_ITEM_AUTHORSHIP_DISCLOSURE,
  type AssessmentReleaseAttestationMode,
  type GovernedAssessmentInventoryInput,
  type InventoryReleaseBundle,
  type ReleaseMachineArtifact,
  type ReleaseMachineArtifactType,
} from "./lib/governed-assessment-inventory";

const { Client } = pg;
const EVIDENCE_ONLY_BLOCKERS = new Set([
  "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED",
  "BLUEPRINT_REVISION_REQUIRED",
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

const FORBIDDEN_RELEASE_IDENTITY = /(^|[^a-z0-9])(smoke|test|testing|junk|dummy|fixture|automation|automated|bot|robot|system|service account|shared account)([^a-z0-9]|$)|\b(ai|artificial intelligence)\b.*\b(author|authoring|generated|automation)\b|\bassessment authoring\b/i;
const FORBIDDEN_RELEASE_USER_IDS = new Set([3, 5, 6, 7]);

export type ReleaseRoleGrantState = {
  grantId: number;
  userId: number;
  releaseRole: string;
  expiresAt: string | Date | null;
  revokedAt: string | Date | null;
};

export function assertAuthorizedReleasePrincipals(
  roleIds: ReleasePrincipalIds,
  users: Array<{ id: number; name: string; email: string }>,
  authorizations: ReleaseRoleGrantState[],
  now: Date = new Date(),
  mode: AssessmentReleaseAttestationMode = "multi_party",
) {
  const currentAuthorizations = authorizations.filter((grant) => {
    if (grant.revokedAt != null) return false;
    if (grant.expiresAt == null) return true;
    const expiry = new Date(grant.expiresAt);
    return Number.isFinite(expiry.getTime()) && expiry.getTime() > now.getTime();
  });
  if (currentAuthorizations.length === 0) {
    throw new Error("NO_RELEASE_ROLE_AUTHORIZATIONS: no current release-role grants exist; an administrator must grant roles first");
  }
  const usersById = new Map(users.map((user) => [user.id, user]));
  const grants = new Set(currentAuthorizations.map((grant) => `${grant.userId}:${grant.releaseRole}`));
  const principalEntries = Object.entries(roleIds) as Array<[keyof ReleasePrincipalIds, number]>;
  for (const [principal, userId] of principalEntries.filter(([principal]) => mode === "multi_party" || principal === "operator")) {
    const user = usersById.get(userId);
    if (!user) throw new Error(`RELEASE_PRINCIPAL_NOT_FOUND: ${principal} user ${userId} does not exist`);
    if (FORBIDDEN_RELEASE_USER_IDS.has(userId) || FORBIDDEN_RELEASE_IDENTITY.test(`${user.name} ${user.email}`.normalize("NFKC"))) {
      throw new Error(`RELEASE_PRINCIPAL_IDENTITY_FORBIDDEN: ${principal} user ${userId} is an automation, AI-authoring, test, or smoke identity (including confirmed junk identities)`);
    }
    const requiredRole = RELEASE_AUTHORIZATION_ROLES[principal];
    if (!grants.has(`${userId}:${requiredRole}`)) {
      throw new Error(`RELEASE_ROLE_NOT_AUTHORIZED: ${principal} user ${userId} lacks a current, unrevoked, unexpired ${requiredRole} grant; grant that exact role first`);
    }
  }
}

export type RecordAssessmentReleaseEvidenceOptions = {
  databaseUrl: string;
  assessmentSlug: string;
  operator: string;
  operatorUserId: number;
  attestationMode?: AssessmentReleaseAttestationMode;
  accountableOfficerUserId?: number;
  singleOfficerAttestation?: string;
  discloseOfficerItemAuthorship?: boolean;
  accessibilityReviewerUserId?: number;
  contentReviewerUserId?: number;
  rightsReviewerUserId?: number;
  cutScoreApproverUserId?: number;
  qaReviewerUserId?: number;
  publisherUserId?: number;
  rollbackOwnerUserId?: number;
  accessibilityStandard: string;
  accessibilityReference?: string;
  accessibilitySha256?: string;
  formSimulationReference?: string;
  formSimulationSha256?: string;
  formSimulationArtifact?: unknown;
  representativeAttemptQaArtifact?: unknown;
  accessibilityAuditArtifact?: unknown;
  cutScoreMethod: string;
  cutScoreApprovalReference: string;
  cutScoreApprovalSha256: string;
  releaseQaReference?: string;
  releaseQaSha256?: string;
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

export function assertSingleOfficerItemIndependence(
  officerUserId: number,
  questions: Array<{ created_by: number; reviewed_by: number }>,
  discloseOfficerItemAuthorship: boolean,
) {
  if (questions.some((question) => question.created_by === question.reviewed_by)) {
    throw new Error("ITEM_LEVEL_INDEPENDENCE_REQUIRED: every in-scope item author must differ from its recorded independent reviewer");
  }
  const officerIsItemAuthor = questions.some((question) => question.created_by === officerUserId);
  const officerIsRecordedItemReviewer = questions.some((question) => question.reviewed_by === officerUserId);
  if (officerIsRecordedItemReviewer) {
    throw new Error("SELF_APPROVAL_FORBIDDEN: the accountable officer cannot be the recorded independent item reviewer for the same assessment scope");
  }
  if (officerIsItemAuthor && !discloseOfficerItemAuthorship) {
    throw new Error("OFFICER_ITEM_AUTHORSHIP_DISCLOSURE_REQUIRED: use --disclose-officer-item-authorship to record the authorship overlap and absence of independent multi-party release review");
  }
  if (!officerIsItemAuthor && discloseOfficerItemAuthorship) {
    throw new Error("FALSE_OFFICER_ITEM_AUTHORSHIP_DISCLOSURE_FORBIDDEN: the accountable officer did not author any in-scope item");
  }
  return {
    officerIsItemAuthor,
    officerIsRecordedItemReviewer,
    disclosure: officerIsItemAuthor ? OFFICER_ITEM_AUTHORSHIP_DISCLOSURE : null,
  };
}

function releaseMachineArtifact(
  raw: unknown,
  artifactType: ReleaseMachineArtifactType,
  assessmentId: number,
  blueprintRevision: number,
): { reference: string; sha256: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${artifactType} must be a machine-result JSON object`);
  const artifact = raw as Partial<ReleaseMachineArtifact>;
  if (artifact.schemaVersion !== "octamy.release-machine-artifact.v1"
    || artifact.artifactType !== artifactType
    || artifact.assessmentId !== assessmentId
    || artifact.blueprintRevision !== blueprintRevision
    || artifact.passed !== true
    || typeof artifact.generatedAt !== "string"
    || !Number.isFinite(Date.parse(artifact.generatedAt))
    || typeof artifact.summary !== "string"
    || artifact.summary.trim().length < 20
    || !Array.isArray(artifact.checks)
    || artifact.checks.length === 0
    || artifact.checks.some((check) => !check || typeof check.name !== "string" || check.name.trim().length < 3
      || check.passed !== true || typeof check.detail !== "string" || check.detail.trim().length < 3)) {
    throw new Error(`${artifactType} must be a passed current-revision machine artifact with a summary and concrete passed checks`);
  }
  const reference = governedMachineArtifactReference(artifact as ReleaseMachineArtifact);
  return { reference, sha256: createHash("sha256").update(reference, "utf8").digest("hex") };
}

function stableFieldsMatch(existing: Record<string, unknown>, expected: Record<string, unknown>, fields: string[]) {
  return fields.every((field) => String(existing[field]) === String(expected[field]));
}

export type RecordMissingBlueprintRevisionOptions = {
  databaseUrl: string;
  assessmentSlug: string;
  operator: string;
  operatorUserId: number;
  apply?: boolean;
  confirmBlueprintRevisionSnapshot?: boolean;
};

export async function recordMissingBlueprintRevision(options: RecordMissingBlueprintRevisionOptions) {
  const operator = requireString("operator", options.operator, 3, 200);
  const operatorUserId = requireUserId("operatorUserId", options.operatorUserId);
  if (options.apply && !options.confirmBlueprintRevisionSnapshot) {
    throw new Error("--confirm-blueprint-revision-snapshot is required with --apply");
  }
  if (!options.apply && options.confirmBlueprintRevisionSnapshot) {
    throw new Error("--confirm-blueprint-revision-snapshot is valid only with --apply");
  }

  const client = new Client({ connectionString: options.databaseUrl, application_name: "octamy-record-missing-blueprint-revision" });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query(options.apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '2s'");

    const userResult = await client.query<{ id: number; is_admin: boolean; name: string; email: string }>(
      `SELECT id, is_admin, name, email FROM users WHERE id = $1`,
      [operatorUserId],
    );
    const user = userResult.rows[0];
    if (!user?.is_admin) throw new Error("OPERATOR_NOT_AUTHORIZED: --operator-user-id must identify an administrator");
    const authorizationResult = await client.query<ReleaseRoleGrantState>(
      `SELECT grant_row.id AS "grantId", grant_row.user_id AS "userId",
              grant_row.release_role AS "releaseRole", grant_row.expires_at AS "expiresAt",
              revocation.revoked_at AS "revokedAt"
         FROM assessment_release_role_grants grant_row
         LEFT JOIN assessment_release_role_revocations revocation ON revocation.grant_id = grant_row.id
        WHERE grant_row.user_id = $1`,
      [operatorUserId],
    );
    const roleIds: ReleasePrincipalIds = {
      operator: operatorUserId, accessibility: operatorUserId, content: operatorUserId, rights: operatorUserId,
      cutScore: operatorUserId, qa: operatorUserId, publisher: operatorUserId, rollback: operatorUserId,
    };
    assertAuthorizedReleasePrincipals(roleIds, [user], authorizationResult.rows, new Date(), "single_accountable_officer");

    const courseResult = await client.query<{
      id: number; revision: number | null; is_active: boolean; visibility: string; review_status: string;
    }>(
      `SELECT course.id, course.is_active, course.visibility, course.review_status,
              (SELECT max(version.revision) FROM course_question_blueprint_versions version WHERE version.course_id = course.id) AS revision
         FROM courses course
        WHERE course.slug = $1 AND course.product_type = 'assessment'
        ${options.apply ? "FOR UPDATE" : ""}`,
      [options.assessmentSlug],
    );
    const course = courseResult.rows[0];
    if (!course) throw new Error(`Assessment ${options.assessmentSlug} was not found`);
    if (!course.is_active || course.visibility !== "public" || course.review_status !== "approved") {
      throw new Error("BLUEPRINT_REVISION_BACKFILL_SCOPE_FORBIDDEN: snapshot-only mode is restricted to active, public, approved assessments");
    }
    if (options.apply) await client.query("SELECT pg_advisory_xact_lock(7355, $1)", [course.id]);
    if (course.revision != null) {
      await client.query(options.apply ? "COMMIT" : "ROLLBACK");
      transactionOpen = false;
      return { status: "already_recorded", assessmentSlug: options.assessmentSlug, assessmentId: course.id, blueprintRevision: Number(course.revision), blueprintChanged: false, publicationChanged: false };
    }

    const rulesResult = await client.query<{
      bank_id: number; topic_id: number | null; question_count: number; difficulty: string;
      marks_per_question: string | number; negative_marks: string | number; sort_order: number;
    }>(
      `SELECT bank_id, topic_id, question_count, difficulty, marks_per_question, negative_marks, sort_order
         FROM course_question_blueprint WHERE course_id = $1 ORDER BY sort_order, id`,
      [course.id],
    );
    if (rulesResult.rows.length === 0) throw new Error("BLUEPRINT_REQUIRED: cannot snapshot an assessment with no live blueprint rules");
    const items = rulesResult.rows.map((rule) => ({
      bankId: rule.bank_id,
      topicId: rule.topic_id,
      questionCount: Number(rule.question_count),
      difficulty: rule.difficulty,
      marksPerQuestion: Number(rule.marks_per_question),
      negativeMarks: Number(rule.negative_marks),
      sortOrder: Number(rule.sort_order),
    }));
    if (!options.apply) {
      await client.query("ROLLBACK");
      transactionOpen = false;
      return { status: "dry_run", assessmentSlug: options.assessmentSlug, assessmentId: course.id, blueprintRevision: 1, planned: { blueprintRevision: 1 }, blueprintChanged: false, publicationChanged: false };
    }

    await client.query(
      `INSERT INTO course_question_blueprint_versions (course_id, revision, items, change_note, changed_by, created_at)
       VALUES ($1, 1, $2::jsonb, $3, $4, now())`,
      [course.id, JSON.stringify(items), `Immutable snapshot of unchanged published blueprint recorded before release attestation by ${operator}`, operatorUserId],
    );
    await client.query("COMMIT");
    transactionOpen = false;
    return { status: "applied", assessmentSlug: options.assessmentSlug, assessmentId: course.id, blueprintRevision: 1, planned: { blueprintRevision: 1 }, blueprintChanged: false, publicationChanged: false };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export async function recordAssessmentReleaseEvidence(options: RecordAssessmentReleaseEvidenceOptions) {
  const mode = options.attestationMode ?? "multi_party";
  if (mode !== "multi_party" && mode !== "single_accountable_officer") throw new Error("attestationMode must be multi_party or single_accountable_officer");
  const singleOfficer = mode === "single_accountable_officer";
  const operator = requireString("operator", options.operator, 3, 200);
  const accessibilityStandard = requireString("accessibilityStandard", options.accessibilityStandard, 3, 120);
  let accessibilityReference = singleOfficer ? "" : requireString("accessibilityReference", options.accessibilityReference ?? "", 8, 500);
  let formSimulationReference = singleOfficer ? "" : requireString("formSimulationReference", options.formSimulationReference ?? "", 8, 500);
  const cutScoreMethod = requireString("cutScoreMethod", options.cutScoreMethod, 3, 500);
  const cutScoreApprovalReference = requireString("cutScoreApprovalReference", options.cutScoreApprovalReference, 8, 500);
  let releaseQaReference = singleOfficer ? "" : requireString("releaseQaReference", options.releaseQaReference ?? "", 8, 500);
  let takedownProcedure = requireString("takedownProcedure", options.takedownProcedure, 20, 4000);
  if (!singleOfficer && options.discloseOfficerItemAuthorship) {
    throw new Error("--disclose-officer-item-authorship is valid only with single_accountable_officer mode");
  }
  let accessibilitySha256 = singleOfficer ? "" : requireHash("accessibilitySha256", options.accessibilitySha256 ?? "");
  let formSimulationSha256 = singleOfficer ? "" : requireHash("formSimulationSha256", options.formSimulationSha256 ?? "");
  const cutScoreApprovalSha256 = requireHash("cutScoreApprovalSha256", options.cutScoreApprovalSha256);
  let releaseQaSha256 = singleOfficer ? "" : requireHash("releaseQaSha256", options.releaseQaSha256 ?? "");
  if (!/^([0-9a-f]{40}|[0-9a-f]{64})$/.test(options.releaseCommit)) throw new Error("releaseCommit must be an exact lowercase Git commit hash");
  if (options.apply && !options.confirmReleaseEvidence) throw new Error("--confirm-release-evidence is required with --apply");
  if (!options.apply && options.confirmReleaseEvidence) throw new Error("--confirm-release-evidence is valid only with --apply");

  const officerId = singleOfficer ? requireUserId("accountableOfficerUserId", options.accountableOfficerUserId ?? 0) : null;
  const roleIds = singleOfficer ? {
    operator: officerId!, accessibility: officerId!, content: officerId!, rights: officerId!,
    cutScore: officerId!, qa: officerId!, publisher: officerId!, rollback: officerId!,
  } : {
    operator: requireUserId("operatorUserId", options.operatorUserId),
    accessibility: requireUserId("accessibilityReviewerUserId", options.accessibilityReviewerUserId ?? 0),
    content: requireUserId("contentReviewerUserId", options.contentReviewerUserId ?? 0),
    rights: requireUserId("rightsReviewerUserId", options.rightsReviewerUserId ?? 0),
    cutScore: requireUserId("cutScoreApproverUserId", options.cutScoreApproverUserId ?? 0),
    qa: requireUserId("qaReviewerUserId", options.qaReviewerUserId ?? 0),
    publisher: requireUserId("publisherUserId", options.publisherUserId ?? 0),
    rollback: requireUserId("rollbackOwnerUserId", options.rollbackOwnerUserId ?? 0),
  };
  if (singleOfficer && roleIds.operator !== options.operatorUserId) throw new Error("Single accountable officer must also be the named release operator");
  const approvalRoleIds = [roleIds.accessibility, roleIds.content, roleIds.rights, roleIds.cutScore, roleIds.qa, roleIds.publisher];
  if (!singleOfficer && new Set(approvalRoleIds).size !== approvalRoleIds.length) {
    throw new Error("SELF_APPROVAL_FORBIDDEN: accessibility, content, rights, cut-score, QA, and publisher user IDs must all be distinct");
  }

  const client = new Client({ connectionString: options.databaseUrl, application_name: "octamy-record-assessment-release-evidence" });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query(options.apply ? "BEGIN ISOLATION LEVEL SERIALIZABLE" : "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '2s'");

    const distinctIds = Array.from(new Set(Object.values(roleIds)));
    const users = await client.query<{ id: number; is_admin: boolean; name: string; email: string }>(
      `SELECT id, is_admin, name, email FROM users WHERE id = ANY($1::int[])`,
      [distinctIds],
    );
    if (users.rows.length !== distinctIds.length) throw new Error("Every operator/reviewer/signatory user ID must exist");
    if (!users.rows.find((user) => user.id === roleIds.operator)?.is_admin) throw new Error("OPERATOR_NOT_AUTHORIZED: --operator-user-id must identify an administrator");

    const authorizationResult = await client.query<ReleaseRoleGrantState>(
      `SELECT grant_row.id AS "grantId", grant_row.user_id AS "userId",
              grant_row.release_role AS "releaseRole", grant_row.expires_at AS "expiresAt",
              revocation.revoked_at AS "revokedAt"
         FROM assessment_release_role_grants grant_row
         LEFT JOIN assessment_release_role_revocations revocation ON revocation.grant_id = grant_row.id
        WHERE grant_row.user_id = ANY($1::int[])`,
      [distinctIds],
    );
    assertAuthorizedReleasePrincipals(
      roleIds,
      users.rows.map(({ id, name, email }) => ({ id, name, email })),
      authorizationResult.rows,
      new Date(),
      mode,
    );

    const initialReport = await buildGovernedAssessmentInventory({ databaseUrl: options.databaseUrl, assessmentSlugs: [options.assessmentSlug] });
    const assessmentReport = initialReport.assessments.find((assessment: any) => assessment.slug === options.assessmentSlug);
    if (!assessmentReport) throw new Error(`Assessment ${options.assessmentSlug} was not found`);
    const substantiveBlockers = assessmentReport.blockers.filter((blocker: any) => !EVIDENCE_ONLY_BLOCKERS.has(blocker.code));
    if (substantiveBlockers.length > 0) {
      throw new Error(`SUBSTANTIVE_CONTENT_BLOCKERS: ${substantiveBlockers.map((blocker: any) => blocker.code).join(", ")}`);
    }

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
    if (!course) throw new Error(`Assessment ${options.assessmentSlug} was not found`);
    if (course.revision == null) {
      throw new Error("BLUEPRINT_REVISION_REQUIRED: run --record-missing-blueprint-revision-only first; it snapshots the unchanged published blueprint so machine artifacts can bind to revision 1");
    }
    if (options.apply) await client.query("SELECT pg_advisory_xact_lock(7355, $1)", [course.id]);
    if (singleOfficer) {
      const form = releaseMachineArtifact(options.formSimulationArtifact, "form_simulation", course.id, Number(course.revision));
      const qa = releaseMachineArtifact(options.representativeAttemptQaArtifact, "representative_attempt_qa", course.id, Number(course.revision));
      const accessibility = releaseMachineArtifact(options.accessibilityAuditArtifact, "accessibility_content_audit", course.id, Number(course.revision));
      formSimulationReference = form.reference;
      formSimulationSha256 = form.sha256;
      releaseQaReference = qa.reference;
      releaseQaSha256 = qa.sha256;
      accessibilityReference = accessibility.reference;
      accessibilitySha256 = accessibility.sha256;
    }

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
    if (!singleOfficer && !questionsResult.rows.some((question) => question.reviewed_by === roleIds.content)) {
      throw new Error("CONTENT_REVIEWER_NOT_ATTRIBUTABLE: content reviewer must be an in-scope item reviewer");
    }
    const officerIndependence = singleOfficer
      ? assertSingleOfficerItemIndependence(officerId!, questionsResult.rows, options.discloseOfficerItemAuthorship === true)
      : null;
    if (!singleOfficer) {
      const itemAuthorsAndReviewers = new Set(questionsResult.rows.flatMap((question) => [question.created_by, question.reviewed_by]));
      if (itemAuthorsAndReviewers.has(roleIds.accessibility) || itemAuthorsAndReviewers.has(roleIds.rights)) {
        throw new Error("SELF_APPROVAL_FORBIDDEN: accessibility and rights reviewers must be independent from every in-scope item author and content reviewer");
      }
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
    const baseSingleOfficerAttestation = singleOfficer
      ? requireString("singleOfficerAttestation", options.singleOfficerAttestation ?? "", 20, 1000)
      : null;
    const singleOfficerAttestation = officerIndependence?.disclosure
      ? requireString("singleOfficerAttestation", `${baseSingleOfficerAttestation}\n\n${officerIndependence.disclosure}`, 20, 1000)
      : baseSingleOfficerAttestation;
    if (officerIndependence?.disclosure) {
      takedownProcedure = requireString("takedownProcedure", `${takedownProcedure}\n\n${officerIndependence.disclosure}`, 20, 4000);
    }
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
      ...(singleOfficer ? {
        attestationMode: mode,
        accountableOfficerUserId: officerId,
        singleOfficerAttestation,
      } : {}),
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
      attestation_mode: mode,
      accountable_officer_user_id: officerId,
      single_officer_attestation: singleOfficerAttestation,
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
      return {
        status: "dry_run", assessmentSlug: options.assessmentSlug, assessmentId: course.id,
        blueprintRevision: course.revision, contentManifestSha256, planned,
        releaseAttestation: singleOfficer ? {
          mode, accountableOfficerUserId: officerId,
          officerIsItemAuthor: officerIndependence?.officerIsItemAuthor ?? false,
          officerIsRecordedItemReviewer: false,
          independentMultiPartyReleaseReview: false,
          officerItemAuthorshipDisclosure: officerIndependence?.disclosure ?? null,
        } : { mode, independentMultiPartyReleaseReview: true },
        publicationChanged: false,
      };
    }

    if (singleOfficer && planned.releaseBundle) {
      await client.query(
        `INSERT INTO assessment_release_bundles (
          assessment_id, blueprint_revision, content_manifest_sha256,
          form_simulation_reference, form_simulation_sha256,
          cut_score, cut_score_method, cut_score_approval_reference, cut_score_approval_sha256,
          cut_score_approver_user_id, cut_score_approved_at,
          release_qa_reference, release_qa_sha256, qa_reviewer_user_id, qa_accepted_at,
          content_reviewer_user_id, publisher_user_id, publisher_signed_at,
          release_commit, released_at, rollback_owner_user_id,
          takedown_procedure, takedown_procedure_sha256, bundle_sha256,
          attestation_mode, accountable_officer_user_id, single_officer_attestation,
          operator, recorded_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
        [course.id, course.revision, bundle.contentManifestSha256,
          bundle.formSimulationReference, bundle.formSimulationSha256,
          bundle.cutScore, bundle.cutScoreMethod, bundle.cutScoreApprovalReference, bundle.cutScoreApprovalSha256,
          bundle.cutScoreApproverUserId, bundle.cutScoreApprovedAt,
          bundle.releaseQaReference, bundle.releaseQaSha256, bundle.qaReviewerUserId, bundle.qaAcceptedAt,
          bundle.contentReviewerUserId, bundle.publisherUserId, bundle.publisherSignedAt,
          bundle.releaseCommit, bundle.releasedAt, bundle.rollbackOwnerUserId,
          bundle.takedownProcedure, bundle.takedownProcedureSha256, bundle.bundleSha256,
          mode, officerId, singleOfficerAttestation,
          operator, roleIds.operator],
      );
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
    if (planned.releaseBundle && !singleOfficer) {
      await client.query(
        `INSERT INTO assessment_release_bundles (
          assessment_id, blueprint_revision, content_manifest_sha256,
          form_simulation_reference, form_simulation_sha256,
          cut_score, cut_score_method, cut_score_approval_reference, cut_score_approval_sha256,
          cut_score_approver_user_id, cut_score_approved_at,
          release_qa_reference, release_qa_sha256, qa_reviewer_user_id, qa_accepted_at,
          content_reviewer_user_id, publisher_user_id, publisher_signed_at,
          release_commit, released_at, rollback_owner_user_id,
          takedown_procedure, takedown_procedure_sha256, bundle_sha256,
          attestation_mode, accountable_officer_user_id, single_officer_attestation,
          operator, recorded_by_user_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
        [course.id, course.revision, bundle.contentManifestSha256,
          bundle.formSimulationReference, bundle.formSimulationSha256,
          bundle.cutScore, bundle.cutScoreMethod, bundle.cutScoreApprovalReference, bundle.cutScoreApprovalSha256,
          bundle.cutScoreApproverUserId, bundle.cutScoreApprovedAt,
          bundle.releaseQaReference, bundle.releaseQaSha256, bundle.qaReviewerUserId, bundle.qaAcceptedAt,
          bundle.contentReviewerUserId, bundle.publisherUserId, bundle.publisherSignedAt,
          bundle.releaseCommit, bundle.releasedAt, bundle.rollbackOwnerUserId,
          bundle.takedownProcedure, bundle.takedownProcedureSha256, bundle.bundleSha256,
          mode, officerId, singleOfficerAttestation,
          operator, roleIds.operator],
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;
    const verified = await buildGovernedAssessmentInventory({ databaseUrl: options.databaseUrl, assessmentSlugs: [options.assessmentSlug] });
    const verifiedAssessment = verified.assessments.find((assessment: any) => assessment.slug === options.assessmentSlug);
    if (!verifiedAssessment?.releaseReady) throw new Error(`POST_WRITE_VERIFICATION_FAILED: ${verifiedAssessment?.blockers.map((blocker: any) => blocker.code).join(", ")}`);
    return {
      status: Object.values(planned).every((count) => count === 0) ? "already_recorded" : "applied",
      assessmentSlug: options.assessmentSlug, assessmentId: course.id, blueprintRevision: course.revision,
      contentManifestSha256, planned, releaseReady: true,
      releaseAttestation: singleOfficer ? {
        mode, accountableOfficerUserId: officerId,
        officerIsItemAuthor: officerIndependence?.officerIsItemAuthor ?? false,
        officerIsRecordedItemReviewer: false,
        independentMultiPartyReleaseReview: false,
        officerItemAuthorshipDisclosure: officerIndependence?.disclosure ?? null,
      } : { mode, independentMultiPartyReleaseReview: true },
      publicationChanged: false,
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
      assessment: { type: "string" }, operator: { type: "string" }, "operator-user-id": { type: "string" },
      "attestation-mode": { type: "string", default: "multi_party" },
      "accountable-officer-user-id": { type: "string" }, "single-officer-attestation": { type: "string" },
      "disclose-officer-item-authorship": { type: "boolean", default: false },
      "record-missing-blueprint-revision-only": { type: "boolean", default: false },
      "confirm-blueprint-revision-snapshot": { type: "boolean", default: false },
      "form-simulation-artifact": { type: "string" }, "representative-attempt-qa-artifact": { type: "string" }, "accessibility-audit-artifact": { type: "string" },
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
  const optional = (name: keyof typeof values) => typeof values[name] === "string" && values[name] ? values[name] as string : undefined;
  if (values["record-missing-blueprint-revision-only"]) {
    if (values["confirm-release-evidence"]) throw new Error("--confirm-release-evidence cannot be used with snapshot-only mode");
    const result = await recordMissingBlueprintRevision({
      databaseUrl: process.env.DATABASE_URL,
      assessmentSlug: required("assessment"),
      operator: required("operator"),
      operatorUserId: Number(required("operator-user-id")),
      apply: values.apply,
      confirmBlueprintRevisionSnapshot: values["confirm-blueprint-revision-snapshot"],
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (values["confirm-blueprint-revision-snapshot"]) throw new Error("--confirm-blueprint-revision-snapshot requires --record-missing-blueprint-revision-only");
  const mode = required("attestation-mode") as AssessmentReleaseAttestationMode;
  const artifact = (name: keyof typeof values) => {
    const file = optional(name);
    return file ? JSON.parse(readFileSync(file, "utf8")) : undefined;
  };
  const result = await recordAssessmentReleaseEvidence({
    databaseUrl: process.env.DATABASE_URL,
    assessmentSlug: required("assessment"), operator: required("operator"), operatorUserId: Number(required("operator-user-id")),
    attestationMode: mode,
    accountableOfficerUserId: optional("accountable-officer-user-id") ? Number(optional("accountable-officer-user-id")) : undefined,
    singleOfficerAttestation: optional("single-officer-attestation"),
    discloseOfficerItemAuthorship: values["disclose-officer-item-authorship"],
    accessibilityReviewerUserId: optional("accessibility-reviewer-user-id") ? Number(optional("accessibility-reviewer-user-id")) : undefined,
    contentReviewerUserId: optional("content-reviewer-user-id") ? Number(optional("content-reviewer-user-id")) : undefined,
    rightsReviewerUserId: optional("rights-reviewer-user-id") ? Number(optional("rights-reviewer-user-id")) : undefined,
    cutScoreApproverUserId: optional("cut-score-approver-user-id") ? Number(optional("cut-score-approver-user-id")) : undefined,
    qaReviewerUserId: optional("qa-reviewer-user-id") ? Number(optional("qa-reviewer-user-id")) : undefined,
    publisherUserId: optional("publisher-user-id") ? Number(optional("publisher-user-id")) : undefined,
    rollbackOwnerUserId: optional("rollback-owner-user-id") ? Number(optional("rollback-owner-user-id")) : undefined,
    accessibilityStandard: required("accessibility-standard"), accessibilityReference: optional("accessibility-reference"), accessibilitySha256: optional("accessibility-sha256"),
    formSimulationReference: optional("form-simulation-reference"), formSimulationSha256: optional("form-simulation-sha256"),
    formSimulationArtifact: artifact("form-simulation-artifact"), representativeAttemptQaArtifact: artifact("representative-attempt-qa-artifact"), accessibilityAuditArtifact: artifact("accessibility-audit-artifact"),
    cutScoreMethod: required("cut-score-method"), cutScoreApprovalReference: required("cut-score-approval-reference"), cutScoreApprovalSha256: required("cut-score-approval-sha256"),
    releaseQaReference: optional("release-qa-reference"), releaseQaSha256: optional("release-qa-sha256"), releaseCommit: required("release-commit"), takedownProcedure: required("takedown-procedure"),
    apply: values.apply, confirmReleaseEvidence: values["confirm-release-evidence"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/record-assessment-release-evidence\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
