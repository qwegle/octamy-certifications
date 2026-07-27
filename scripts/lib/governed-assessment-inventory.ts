import {
  evaluateAssessmentContentAcceptance,
  type AssessmentAcceptanceQuestion,
  type AssessmentAcceptanceReport,
} from "../../server/lib/assessment-content-acceptance";
import type { AssessmentPurpose } from "../../server/lib/assessment-bank-readiness";

export const GOVERNED_INVENTORY_SCHEMA_VERSION = "octamy.governed-assessment-inventory.v1";

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
  useBlueprintEngine: boolean;
  visibility: string;
  reviewStatus: string;
  isActive: boolean;
  blueprintRevisionCount: number;
  rules: InventoryBlueprintRule[];
  questions: InventoryQuestion[];
  evidenceRepresentation: InventoryEvidenceRepresentation;
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

function nonEmpty(value: unknown, minimum = 1): value is string {
  return typeof value === "string" && value.trim().length >= minimum;
}

function hasMediaAltText(question: InventoryQuestion, issues: InventoryIssue[]) {
  if (question.imageUrl && !nonEmpty(question.imageAltText, 3)) {
    issue(
      issues,
      "QUESTION_IMAGE_ALT_TEXT_REQUIRED",
      "Question media requires meaningful alt text before accessibility acceptance.",
      { questionId: question.id, bankId: question.bankId },
    );
  }
  if (question.optionMedia == null) return;
  if (!Array.isArray(question.optionMedia)) {
    issue(
      issues,
      "OPTION_MEDIA_ACCESSIBILITY_INVALID",
      "Option media must be an array of media records with non-empty alt text.",
      { questionId: question.id, bankId: question.bankId },
    );
    return;
  }
  const missingAlt = question.optionMedia.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return true;
    const media = entry as Record<string, unknown>;
    return !nonEmpty(media.url, 1) || !nonEmpty(media.alt, 3);
  });
  if (missingAlt) {
    issue(
      issues,
      "OPTION_MEDIA_ALT_TEXT_REQUIRED",
      "Every option-media record requires a URL and meaningful alt text.",
      { questionId: question.id, bankId: question.bankId },
    );
  }
}

function validateRights(question: InventoryQuestion, issues: InventoryIssue[]) {
  if (question.sourceLinks.length === 0) {
    issue(
      issues,
      "QUESTION_PROVENANCE_REQUIRED",
      "No source-register provenance links this question to reviewed rights evidence.",
      { questionId: question.id, bankId: question.bankId },
    );
    return;
  }

  for (const link of question.sourceLinks) {
    const context = { questionId: question.id, bankId: question.bankId, sourceId: link.sourceId };
    if (link.rightsReviewStatus !== "verified") {
      issue(issues, "SOURCE_RIGHTS_NOT_VERIFIED", `Source ${link.sourceKey} does not have verified rights approval.`, context);
    }
    if (!link.commercialUseAllowed) {
      issue(issues, "SOURCE_COMMERCIAL_USE_NOT_ALLOWED", `Source ${link.sourceKey} does not permit commercial use.`, context);
    }
    if (!link.derivativesAllowed) {
      issue(issues, "SOURCE_DERIVATIVES_NOT_ALLOWED", `Source ${link.sourceKey} does not permit derivative use.`, context);
    }
    if (!link.rightsReviewedAt || !nonEmpty(link.rightsReviewedBy, 3) || !nonEmpty(link.evidenceReference, 8)) {
      issue(
        issues,
        "SOURCE_RIGHTS_REVIEW_EVIDENCE_REQUIRED",
        `Source ${link.sourceKey} lacks a timestamped reviewer identity or exact rights-evidence reference.`,
        context,
      );
    }
    const review = rightsReviewRecord(link.sourceProvenance);
    if (!nonEmpty(review?.acquiringEntity, 3)) {
      issue(issues, "SOURCE_ACQUIRING_ENTITY_REQUIRED", `Source ${link.sourceKey} lacks the acquiring legal entity.`, context);
    }
    if (!nonEmpty(review?.evidenceSha256, 64) || !/^[0-9a-f]{64}$/.test(String(review?.evidenceSha256))) {
      issue(issues, "SOURCE_RIGHTS_EVIDENCE_HASH_REQUIRED", `Source ${link.sourceKey} lacks a valid rights-evidence SHA-256.`, context);
    }
    if (!question.contentHash || link.provenanceContentHash !== question.contentHash) {
      issue(
        issues,
        "PROVENANCE_CONTENT_HASH_MISMATCH",
        `Source ${link.sourceKey} provenance is not tied to the question's current canonical content hash.`,
        context,
      );
    }
  }
}

export function assertGovernedInventoryReadOnlyMode(mode: string): asserts mode is "dry-run" {
  if (mode !== "dry-run") {
    throw new Error("READ_ONLY_ONLY: governed assessment inventory supports only --mode dry-run and cannot publish, approve, migrate, or mutate data");
  }
}

export function evaluateGovernedAssessmentInventory(
  input: GovernedAssessmentInventoryInput,
): GovernedAssessmentInventoryResult {
  const issues: InventoryIssue[] = [];
  const purpose: AssessmentPurpose = input.assessmentPurpose === "practice" ? "practice" : "certification";

  if (input.productType !== "assessment") {
    issue(issues, "ASSESSMENT_PRODUCT_REQUIRED", "Governed release inventory applies only to assessment products.");
  }
  if (!["certification", "practice"].includes(input.assessmentPurpose)) {
    issue(issues, "ASSESSMENT_PURPOSE_INVALID", "Assessment purpose must be explicitly certification or practice.");
  }
  if (input.blueprintRevisionCount < 1) {
    issue(issues, "BLUEPRINT_REVISION_REQUIRED", "The live blueprint requires at least one immutable revision record.");
  }

  for (const rule of input.rules) {
    if (!rule.bank) {
      issue(issues, "BLUEPRINT_BANK_NOT_FOUND", `Blueprint rule ${rule.id} references a missing bank.`, { bankId: rule.bankId });
      continue;
    }
    if (rule.bank.purpose !== purpose) {
      issue(
        issues,
        "BANK_PURPOSE_MISMATCH",
        `Bank ${rule.bank.slug} is ${rule.bank.purpose}, but assessment ${input.slug} is ${purpose}.`,
        { bankId: rule.bank.id },
      );
    }
    if (rule.bank.status !== "active") {
      issue(issues, "BANK_NOT_ACTIVE", `Bank ${rule.bank.slug} is ${rule.bank.status}, not active.`, { bankId: rule.bank.id });
    }
    if (!nonEmpty(rule.bank.syllabusVersion, 3)) {
      issue(issues, "BANK_SYLLABUS_VERSION_REQUIRED", `Bank ${rule.bank.slug} has no explicit syllabus version.`, { bankId: rule.bank.id });
    }
  }

  for (const question of input.questions) {
    validateRights(question, issues);
    hasMediaAltText(question, issues);
    if ((question.version ?? 1) > 1 && (question.versionHistoryCount ?? 0) < 1) {
      issue(
        issues,
        "QUESTION_VERSION_HISTORY_REQUIRED",
        "An edited question has no immutable question-version history record.",
        { questionId: question.id, bankId: question.bankId },
      );
    }
  }

  if (!input.evidenceRepresentation.attributableRightsReviewerIdentity) {
    issue(
      issues,
      "RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE",
      "Rights reviewers are stored as free text, so the system cannot prove rights approval is separate from item authorship/content review.",
    );
  }
  if (!input.evidenceRepresentation.assessmentAccessibilityAcceptance) {
    issue(
      issues,
      "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED",
      "Item media alt text is represented, but no assessment-level accessibility reviewer acceptance record exists in the current schema.",
    );
  }
  if (!input.evidenceRepresentation.immutableReleaseBundle) {
    issue(
      issues,
      "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED",
      "No immutable release bundle records form simulations, cut-score approval, release QA, publisher sign-off, release commit/time, rollback owner, and takedown procedure.",
    );
  }

  const syllabusVersions = Array.from(new Set(
    input.rules.map((rule) => rule.bank?.syllabusVersion?.trim()).filter(Boolean),
  )) as string[];
  const contentAcceptance = evaluateAssessmentContentAcceptance({
    assessmentSlug: input.slug,
    purpose,
    syllabusVersion: syllabusVersions.length === 1 ? syllabusVersions[0] : "",
    useBlueprintEngine: input.useBlueprintEngine,
    rules: input.rules.map((rule) => ({
      bankId: rule.bankId,
      topicId: rule.topicId,
      questionCount: rule.questionCount,
      difficulty: rule.difficulty,
    })),
    questions: input.questions,
  });
  issues.push(...contentAcceptance.issues);

  const bankBlockerCodes = new Set([
    "BLUEPRINT_BANK_NOT_FOUND",
    "BANK_PURPOSE_MISMATCH",
    "BANK_NOT_ACTIVE",
    "BANK_SYLLABUS_VERSION_REQUIRED",
  ]);
  const runtimePublishReady = contentAcceptance.releasable
    && !issues.some((found) => bankBlockerCodes.has(found.code));
  const releaseReady = issues.every((found) => found.severity !== "blocker");
  const currentlyPublished = input.isActive
    && input.visibility === "public"
    && input.reviewStatus === "approved";

  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    purpose,
    ownerType: input.ownerType,
    catalogState: {
      visibility: input.visibility,
      reviewStatus: input.reviewStatus,
      isActive: input.isActive,
      currentlyPublished,
    },
    status: releaseReady ? "release_ready" : "blocked",
    releaseReady,
    runtimePublishReady,
    unsafePublished: currentlyPublished && !releaseReady,
    blueprint: {
      enabled: input.useBlueprintEngine,
      revisionCount: input.blueprintRevisionCount,
      ruleCount: input.rules.length,
      drawCount: contentAcceptance.readiness.drawCount,
      requiredInventory: contentAcceptance.readiness.requiredInventory,
    },
    inventory: {
      scopedQuestions: input.questions.length,
      contentAcceptedQuestions: contentAcceptance.acceptedQuestionCount,
      sourceLinkedQuestions: input.questions.filter((question) => question.sourceLinks.length > 0).length,
    },
    evidenceRepresentation: input.evidenceRepresentation,
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
    const current = grouped.get(key) ?? {
      severity: found.severity,
      code: found.code,
      message: found.message,
      occurrences: 0,
      questionIds: [],
      bankIds: [],
      sourceIds: [],
    };
    current.occurrences += 1;
    if (found.questionId != null && !current.questionIds.includes(found.questionId)) current.questionIds.push(found.questionId);
    if (found.bankId != null && !current.bankIds.includes(found.bankId)) current.bankIds.push(found.bankId);
    if (found.sourceId != null && !current.sourceIds.includes(found.sourceId)) current.sourceIds.push(found.sourceId);
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((left, right) => left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message));
}
