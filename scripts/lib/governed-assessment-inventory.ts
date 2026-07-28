import { createHash } from "node:crypto";
import {
  evaluateAssessmentContentAcceptance,
  type AssessmentAcceptanceQuestion,
  type AssessmentAcceptanceReport,
} from "../../server/lib/assessment-content-acceptance";
import type { AssessmentPurpose } from "../../server/lib/assessment-bank-readiness";

export const GOVERNED_INVENTORY_SCHEMA_VERSION = "octamy.governed-assessment-inventory.v2";

export type InventoryIssue = {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  questionId?: number | string;
  bankId?: number;
  sourceId?: number;
};

export type InventoryBank = {
  id: number;
  slug: string;
  purpose: string;
  status: string;
  syllabusVersion: string | null;
};

export type InventoryBlueprintRule = {
  id: number;
  bankId: number;
  topicId: number | null;
  questionCount: number;
  difficulty: string;
  bank: InventoryBank | null;
};

export type InventorySourceLink = {
  sourceId: number;
  sourceKey: string;
  rightsReviewStatus: string;
  commercialUseAllowed: boolean;
  derivativesAllowed: boolean;
  evidenceReference: string | null;
  rightsReviewedAt: Date | string | null;
  rightsReviewedBy: string | null;
  sourceProvenance: unknown;
  provenanceContentHash: string;
};

export type InventoryQuestion = AssessmentAcceptanceQuestion & {
  imageUrl?: string | null;
  imageAltText?: string | null;
  optionMedia?: unknown;
  versionHistoryCount?: number;
  sourceLinks: InventorySourceLink[];
};

export type InventoryAccessibilityAcceptance = {
  blueprintRevision: number;
  reviewerUserId: number;
  standard: string;
  evidenceReference: string;
  evidenceSha256: string;
  acceptedAt: Date | string;
};

export type InventoryRightsRoleReview = {
  blueprintRevision: number;
  sourceId: number;
  reviewerUserId: number;
  evidenceReference: string;
  evidenceSha256: string;
  reviewedAt: Date | string;
};

export type InventoryReleaseBundle = {
  blueprintRevision: number;
  contentManifestSha256: string;
  formSimulationReference: string;
  formSimulationSha256: string;
  cutScore: number;
  cutScoreMethod: string;
  cutScoreApprovalReference: string;
  cutScoreApprovalSha256: string;
  cutScoreApproverUserId: number;
  cutScoreApprovedAt: Date | string;
  releaseQaReference: string;
  releaseQaSha256: string;
  qaReviewerUserId: number;
  qaAcceptedAt: Date | string;
  contentReviewerUserId: number;
  publisherUserId: number;
  publisherSignedAt: Date | string;
  releaseCommit: string;
  releasedAt: Date | string;
  rollbackOwnerUserId: number;
  takedownProcedure: string;
  takedownProcedureSha256: string;
  bundleSha256: string;
};

export type InventoryReleaseEvidence = {
  accessibilityAcceptances: InventoryAccessibilityAcceptance[];
  rightsRoleReviews: InventoryRightsRoleReview[];
  releaseBundles: InventoryReleaseBundle[];
};

export type InventoryEvidenceRepresentation = {
  itemAccessibilityFields: boolean;
  assessmentAccessibilityAcceptance: boolean;
  immutableReleaseBundle: boolean;
  attributableRightsReviewerIdentity: boolean;
};

export type GovernedAssessmentInventoryInput = {
  id: number;
  slug: string;
  title: string;
  ownerType: string;
  productType: string;
  assessmentPurpose: string;
  passingScore: number;
  useBlueprintEngine: boolean;
  visibility: string;
  reviewStatus: string;
  isActive: boolean;
  blueprintRevisionCount: number;
  blueprintRevision: number | null;
  rules: InventoryBlueprintRule[];
  questions: InventoryQuestion[];
  releaseEvidence: InventoryReleaseEvidence;
};

export type GovernedAssessmentInventoryResult = {
  id: number;
  slug: string;
  title: string;
  purpose: AssessmentPurpose;
  ownerType: string;
  catalogState: {
    visibility: string;
    reviewStatus: string;
    isActive: boolean;
    currentlyPublished: boolean;
  };
  status: "release_ready" | "blocked";
  releaseReady: boolean;
  runtimePublishReady: boolean;
  unsafePublished: boolean;
  blueprint: {
    enabled: boolean;
    revisionCount: number;
    currentRevision: number | null;
    ruleCount: number;
    drawCount: number;
    requiredInventory: number;
  };
  inventory: {
    scopedQuestions: number;
    contentAcceptedQuestions: number;
    sourceLinkedQuestions: number;
  };
  evidenceRepresentation: InventoryEvidenceRepresentation;
  contentAcceptance: AssessmentAcceptanceReport;
  issues: InventoryIssue[];
};

function issue(
  issues: InventoryIssue[],
  code: string,
  message: string,
  context: Partial<Pick<InventoryIssue, "questionId" | "bankId" | "sourceId">> = {},
) {
  issues.push({ severity: "blocker", code, message, ...context });
}

function rightsReviewRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const review = (value as Record<string, unknown>).rightsReview;
  return review && typeof review === "object" && !Array.isArray(review)
    ? review as Record<string, unknown>
    : null;
}

function nonEmpty(value: unknown, minimum = 1, maximum = Number.POSITIVE_INFINITY): value is string {
  return typeof value === "string" && value.trim().length >= minimum && value.trim().length <= maximum;
}

function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validUserId(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function iso(value: Date | string): string | null {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function governedAssessmentContentManifestSha256(input: Pick<
  GovernedAssessmentInventoryInput,
  "id" | "blueprintRevision" | "rules" | "questions"
>): string {
  const manifest = {
    assessmentId: input.id,
    blueprintRevision: input.blueprintRevision,
    rules: [...input.rules]
      .sort((left, right) => left.id - right.id)
      .map((rule) => ({
        id: rule.id,
        bankId: rule.bankId,
        topicId: rule.topicId,
        questionCount: rule.questionCount,
        difficulty: rule.difficulty,
      })),
    questions: [...input.questions]
      .sort((left, right) => String(left.id).localeCompare(String(right.id), "en", { numeric: true }))
      .map((question) => ({
        id: question.id,
        version: question.version ?? 1,
        contentHash: question.contentHash ?? null,
        sources: [...question.sourceLinks]
          .sort((left, right) => left.sourceId - right.sourceId)
          .map((source) => ({ sourceId: source.sourceId, provenanceContentHash: source.provenanceContentHash })),
      })),
  };
  return sha256(JSON.stringify(manifest));
}

function releaseBundleCanonicalValue(bundle: Omit<InventoryReleaseBundle, "bundleSha256">) {
  return {
    ...bundle,
    cutScoreApprovedAt: iso(bundle.cutScoreApprovedAt),
    qaAcceptedAt: iso(bundle.qaAcceptedAt),
    publisherSignedAt: iso(bundle.publisherSignedAt),
    releasedAt: iso(bundle.releasedAt),
  };
}

export function governedReleaseBundleSha256(bundle: Omit<InventoryReleaseBundle, "bundleSha256">): string {
  return sha256(JSON.stringify(releaseBundleCanonicalValue(bundle)));
}

function hasMediaAltText(question: InventoryQuestion, issues: InventoryIssue[]) {
  if (question.imageUrl && !nonEmpty(question.imageAltText, 3)) {
    issue(issues, "QUESTION_IMAGE_ALT_TEXT_REQUIRED", "Question media requires meaningful alt text before accessibility acceptance.", { questionId: question.id, bankId: question.bankId });
  }
  if (question.optionMedia == null) return;
  if (!Array.isArray(question.optionMedia)) {
    issue(issues, "OPTION_MEDIA_ACCESSIBILITY_INVALID", "Option media must be an array of media records with non-empty alt text.", { questionId: question.id, bankId: question.bankId });
    return;
  }
  if (question.optionMedia.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return true;
    const media = entry as Record<string, unknown>;
    return !nonEmpty(media.url, 1) || !nonEmpty(media.alt, 3);
  })) {
    issue(issues, "OPTION_MEDIA_ALT_TEXT_REQUIRED", "Every option-media record requires a URL and meaningful alt text.", { questionId: question.id, bankId: question.bankId });
  }
}

function validateRights(question: InventoryQuestion, issues: InventoryIssue[]) {
  if (question.sourceLinks.length === 0) {
    issue(issues, "QUESTION_PROVENANCE_REQUIRED", "No source-register provenance links this question to reviewed rights evidence.", { questionId: question.id, bankId: question.bankId });
    return;
  }
  for (const link of question.sourceLinks) {
    const context = { questionId: question.id, bankId: question.bankId, sourceId: link.sourceId };
    if (link.rightsReviewStatus !== "verified") issue(issues, "SOURCE_RIGHTS_NOT_VERIFIED", `Source ${link.sourceKey} does not have verified rights approval.`, context);
    if (!link.commercialUseAllowed) issue(issues, "SOURCE_COMMERCIAL_USE_NOT_ALLOWED", `Source ${link.sourceKey} does not permit commercial use.`, context);
    if (!link.derivativesAllowed) issue(issues, "SOURCE_DERIVATIVES_NOT_ALLOWED", `Source ${link.sourceKey} does not permit derivative use.`, context);
    if (!link.rightsReviewedAt || !nonEmpty(link.rightsReviewedBy, 3) || !nonEmpty(link.evidenceReference, 8)) {
      issue(issues, "SOURCE_RIGHTS_REVIEW_EVIDENCE_REQUIRED", `Source ${link.sourceKey} lacks a timestamped reviewer identity or exact rights-evidence reference.`, context);
    }
    const review = rightsReviewRecord(link.sourceProvenance);
    if (!nonEmpty(review?.acquiringEntity, 3)) issue(issues, "SOURCE_ACQUIRING_ENTITY_REQUIRED", `Source ${link.sourceKey} lacks the acquiring legal entity.`, context);
    if (!validHash(review?.evidenceSha256)) issue(issues, "SOURCE_RIGHTS_EVIDENCE_HASH_REQUIRED", `Source ${link.sourceKey} lacks a valid rights-evidence SHA-256.`, context);
    if (!question.contentHash || link.provenanceContentHash !== question.contentHash) {
      issue(issues, "PROVENANCE_CONTENT_HASH_MISMATCH", `Source ${link.sourceKey} provenance is not tied to the question's current canonical content hash.`, context);
    }
  }
}

function evidenceValidity(input: GovernedAssessmentInventoryInput) {
  const revision = input.blueprintRevision;
  const authors = new Set(input.questions.map((question) => question.createdBy).filter(validUserId));
  const contentReviewers = new Set(input.questions.map((question) => question.reviewedBy).filter(validUserId));
  const sourceLinks = new Map<number, InventorySourceLink>();
  for (const question of input.questions) for (const source of question.sourceLinks) sourceLinks.set(source.sourceId, source);

  const rightsReviews = revision == null ? [] : input.releaseEvidence.rightsRoleReviews
    .filter((record) => record.blueprintRevision === revision);
  const rightsReviewerIds = new Set(rightsReviews.map((record) => record.reviewerUserId));
  const accessibility = revision == null ? undefined : input.releaseEvidence.accessibilityAcceptances
    .find((record) => record.blueprintRevision === revision);
  const bundle = revision == null ? undefined : input.releaseEvidence.releaseBundles
    .find((record) => record.blueprintRevision === revision);

  const accessibilityValid = Boolean(accessibility
    && validUserId(accessibility.reviewerUserId)
    && nonEmpty(accessibility.standard, 3, 120)
    && nonEmpty(accessibility.evidenceReference, 8, 500)
    && validHash(accessibility.evidenceSha256)
    && iso(accessibility.acceptedAt)
    && !authors.has(accessibility.reviewerUserId)
    && !contentReviewers.has(accessibility.reviewerUserId)
    && !rightsReviewerIds.has(accessibility.reviewerUserId));

  const rightsValid = sourceLinks.size > 0 && Array.from(sourceLinks.values()).every((source) => {
    const record = rightsReviews.find((candidate) => candidate.sourceId === source.sourceId);
    const sourceReview = rightsReviewRecord(source.sourceProvenance);
    return Boolean(record
      && validUserId(record.reviewerUserId)
      && record.evidenceReference === source.evidenceReference
      && validHash(record.evidenceSha256)
      && record.evidenceSha256 === sourceReview?.evidenceSha256
      && iso(record.reviewedAt)
      && !authors.has(record.reviewerUserId)
      && !contentReviewers.has(record.reviewerUserId)
      && record.reviewerUserId !== accessibility?.reviewerUserId);
  });

  let bundleValid = false;
  if (bundle) {
    const { bundleSha256, ...unsignedBundle } = bundle;
    const roleIds = [bundle.contentReviewerUserId, bundle.cutScoreApproverUserId, bundle.qaReviewerUserId, bundle.publisherUserId];
    const roleSet = new Set(roleIds);
    const cutApproved = iso(bundle.cutScoreApprovedAt);
    const qaAccepted = iso(bundle.qaAcceptedAt);
    const publisherSigned = iso(bundle.publisherSignedAt);
    const released = iso(bundle.releasedAt);
    const releaseTime = released ? Date.parse(released) : Number.NaN;
    bundleValid = roleIds.every(validUserId)
      && roleSet.size === roleIds.length
      && validUserId(bundle.rollbackOwnerUserId)
      && contentReviewers.has(bundle.contentReviewerUserId)
      && !rightsReviewerIds.has(bundle.contentReviewerUserId)
      && accessibility?.reviewerUserId !== bundle.contentReviewerUserId
      && bundle.contentManifestSha256 === governedAssessmentContentManifestSha256(input)
      && nonEmpty(bundle.formSimulationReference, 8, 500) && validHash(bundle.formSimulationSha256)
      && bundle.cutScore === input.passingScore
      && nonEmpty(bundle.cutScoreMethod, 3, 500)
      && nonEmpty(bundle.cutScoreApprovalReference, 8, 500) && validHash(bundle.cutScoreApprovalSha256)
      && nonEmpty(bundle.releaseQaReference, 8, 500) && validHash(bundle.releaseQaSha256)
      && /^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(bundle.releaseCommit)
      && nonEmpty(bundle.takedownProcedure, 20, 4000)
      && bundle.takedownProcedureSha256 === sha256(bundle.takedownProcedure)
      && cutApproved != null && qaAccepted != null && publisherSigned != null && released != null
      && Date.parse(cutApproved) <= releaseTime && Date.parse(qaAccepted) <= releaseTime && Date.parse(publisherSigned) <= releaseTime
      && validHash(bundleSha256)
      && bundleSha256 === governedReleaseBundleSha256(unsignedBundle);
    if (bundleValid) {
      const separated = [...rightsReviewerIds, accessibility?.reviewerUserId]
        .filter(validUserId)
        .every((reviewerId) => !roleSet.has(reviewerId));
      bundleValid = separated;
    }
  }

  return { accessibilityValid, rightsValid, bundleValid };
}

export function assertGovernedInventoryReadOnlyMode(mode: string): asserts mode is "dry-run" {
  if (mode !== "dry-run") throw new Error("READ_ONLY_ONLY: governed assessment inventory supports only --mode dry-run and cannot publish, approve, migrate, or mutate data");
}

export function evaluateGovernedAssessmentInventory(input: GovernedAssessmentInventoryInput): GovernedAssessmentInventoryResult {
  const issues: InventoryIssue[] = [];
  const purpose: AssessmentPurpose = input.assessmentPurpose === "practice" ? "practice" : "certification";

  if (input.productType !== "assessment") issue(issues, "ASSESSMENT_PRODUCT_REQUIRED", "Governed release inventory applies only to assessment products.");
  if (!["certification", "practice"].includes(input.assessmentPurpose)) issue(issues, "ASSESSMENT_PURPOSE_INVALID", "Assessment purpose must be explicitly certification or practice.");
  if (input.blueprintRevisionCount < 1 || input.blueprintRevision == null) issue(issues, "BLUEPRINT_REVISION_REQUIRED", "The live blueprint requires at least one immutable revision record.");

  for (const rule of input.rules) {
    if (!rule.bank) {
      issue(issues, "BLUEPRINT_BANK_NOT_FOUND", `Blueprint rule ${rule.id} references a missing bank.`, { bankId: rule.bankId });
      continue;
    }
    if (rule.bank.purpose !== purpose) issue(issues, "BANK_PURPOSE_MISMATCH", `Bank ${rule.bank.slug} is ${rule.bank.purpose}, but assessment ${input.slug} is ${purpose}.`, { bankId: rule.bank.id });
    if (rule.bank.status !== "active") issue(issues, "BANK_NOT_ACTIVE", `Bank ${rule.bank.slug} is ${rule.bank.status}, not active.`, { bankId: rule.bank.id });
    if (!nonEmpty(rule.bank.syllabusVersion, 3)) issue(issues, "BANK_SYLLABUS_VERSION_REQUIRED", `Bank ${rule.bank.slug} has no explicit syllabus version.`, { bankId: rule.bank.id });
  }

  for (const question of input.questions) {
    validateRights(question, issues);
    hasMediaAltText(question, issues);
    if ((question.version ?? 1) > 1 && (question.versionHistoryCount ?? 0) < 1) issue(issues, "QUESTION_VERSION_HISTORY_REQUIRED", "An edited question has no immutable question-version history record.", { questionId: question.id, bankId: question.bankId });
  }

  const evidence = evidenceValidity(input);
  if (!evidence.rightsValid) issue(issues, "RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE", "Every in-scope source requires a current-revision rights-role record whose attributable user is independent from item authorship, content review, and accessibility review and whose evidence hash/reference matches the source register.");
  if (!evidence.accessibilityValid) issue(issues, "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED", "The current blueprint revision requires a hashed assessment-level accessibility acceptance by an attributable independent reviewer.");
  if (!evidence.bundleValid) issue(issues, "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED", "The current blueprint revision requires a valid immutable bundle for exact content, form simulation, cut-score approval, release QA, publisher sign-off, release commit/time, rollback ownership, and takedown procedure.");

  const syllabusVersions = Array.from(new Set(input.rules.map((rule) => rule.bank?.syllabusVersion?.trim()).filter(Boolean))) as string[];
  const contentAcceptance = evaluateAssessmentContentAcceptance({
    assessmentSlug: input.slug,
    purpose,
    syllabusVersion: syllabusVersions.length === 1 ? syllabusVersions[0] : "",
    useBlueprintEngine: input.useBlueprintEngine,
    rules: input.rules.map((rule) => ({ bankId: rule.bankId, topicId: rule.topicId, questionCount: rule.questionCount, difficulty: rule.difficulty })),
    questions: input.questions,
  });
  issues.push(...contentAcceptance.issues);

  const bankBlockerCodes = new Set(["BLUEPRINT_BANK_NOT_FOUND", "BANK_PURPOSE_MISMATCH", "BANK_NOT_ACTIVE", "BANK_SYLLABUS_VERSION_REQUIRED"]);
  const runtimePublishReady = contentAcceptance.releasable && !issues.some((found) => bankBlockerCodes.has(found.code));
  const releaseReady = issues.every((found) => found.severity !== "blocker");
  const currentlyPublished = input.isActive && input.visibility === "public" && input.reviewStatus === "approved";

  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    purpose,
    ownerType: input.ownerType,
    catalogState: { visibility: input.visibility, reviewStatus: input.reviewStatus, isActive: input.isActive, currentlyPublished },
    status: releaseReady ? "release_ready" : "blocked",
    releaseReady,
    runtimePublishReady,
    unsafePublished: currentlyPublished && !releaseReady,
    blueprint: {
      enabled: input.useBlueprintEngine,
      revisionCount: input.blueprintRevisionCount,
      currentRevision: input.blueprintRevision,
      ruleCount: input.rules.length,
      drawCount: contentAcceptance.readiness.drawCount,
      requiredInventory: contentAcceptance.readiness.requiredInventory,
    },
    inventory: {
      scopedQuestions: input.questions.length,
      contentAcceptedQuestions: contentAcceptance.acceptedQuestionCount,
      sourceLinkedQuestions: input.questions.filter((question) => question.sourceLinks.length > 0).length,
    },
    evidenceRepresentation: {
      itemAccessibilityFields: true,
      assessmentAccessibilityAcceptance: evidence.accessibilityValid,
      immutableReleaseBundle: evidence.bundleValid,
      attributableRightsReviewerIdentity: evidence.rightsValid,
    },
    contentAcceptance,
    issues,
  };
}

export type GroupedInventoryIssue = {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  occurrences: number;
  questionIds: Array<number | string>;
  bankIds: number[];
  sourceIds: number[];
};

export function groupInventoryIssues(issues: readonly InventoryIssue[]): GroupedInventoryIssue[] {
  const grouped = new Map<string, GroupedInventoryIssue>();
  for (const found of issues) {
    const key = `${found.severity}\u0000${found.code}\u0000${found.message}`;
    const current = grouped.get(key) ?? { severity: found.severity, code: found.code, message: found.message, occurrences: 0, questionIds: [], bankIds: [], sourceIds: [] };
    current.occurrences += 1;
    if (found.questionId != null && !current.questionIds.includes(found.questionId)) current.questionIds.push(found.questionId);
    if (found.bankId != null && !current.bankIds.includes(found.bankId)) current.bankIds.push(found.bankId);
    if (found.sourceId != null && !current.sourceIds.includes(found.sourceId)) current.sourceIds.push(found.sourceId);
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message));
}
