import { sql } from "drizzle-orm";
import { questions } from "@shared/schema";

export type QuestionGenerationSource = "human" | "ai_draft" | "imported";
export type QuestionReviewStatus = "draft" | "pending" | "approved" | "rejected" | "retired";

export interface QuestionGovernanceUpdate {
  generationSource?: QuestionGenerationSource;
  reviewStatus: QuestionReviewStatus;
  isActive: boolean;
  reviewedBy: number | null;
  reviewedAt: Date | null;
}

export type QuestionBankReviewContext = {
  ownerType: string;
  bankPurpose: string;
};

/** First-party assessment content always requires a second accountable person. */
export function requiresIndependentQuestionReview(
  bank: QuestionBankReviewContext,
): boolean {
  return bank.ownerType === "admin"
    && (bank.bankPurpose === "certification" || bank.bankPurpose === "practice");
}

export function isIndependentQuestionReviewer(
  createdBy: number | null | undefined,
  reviewerId: number | null | undefined,
): boolean {
  return createdBy != null && reviewerId != null && createdBy !== reviewerId;
}

/** Manual editor submission is itself an explicit human authoring decision. */

export type QuestionReviewSeparationInput = {
  authorUserId: number | null | undefined;
  reviewerUserId: number | null | undefined;
  reviewerOperator: string;
  importOperators: readonly string[];
  rightsReviewerOperator?: string | null;
};

export type QuestionReviewSeparationIssue =
  | "ATTRIBUTABLE_AUTHOR_REQUIRED"
  | "ATTRIBUTABLE_REVIEWER_REQUIRED"
  | "INDEPENDENT_REVIEW_REQUIRED"
  | "IMPORTER_SELF_REVIEW_FORBIDDEN"
  | "RIGHTS_REVIEWER_SELF_REVIEW_FORBIDDEN";

function normalizedOperatorIdentity(value: string | null | undefined): string {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en");
}

/**
 * Batch tooling must enforce the same human separation as the interactive
 * review route. Free-text operator labels are not treated as user identities;
 * they are an additional fail-closed collision check alongside user IDs.
 */
export function questionReviewSeparationIssues(
  input: QuestionReviewSeparationInput,
): QuestionReviewSeparationIssue[] {
  const issues: QuestionReviewSeparationIssue[] = [];
  if (input.authorUserId == null) issues.push("ATTRIBUTABLE_AUTHOR_REQUIRED");
  if (input.reviewerUserId == null) issues.push("ATTRIBUTABLE_REVIEWER_REQUIRED");
  if (input.authorUserId != null
    && input.reviewerUserId != null
    && input.authorUserId === input.reviewerUserId) {
    issues.push("INDEPENDENT_REVIEW_REQUIRED");
  }

  const reviewer = normalizedOperatorIdentity(input.reviewerOperator);
  if (!reviewer) issues.push("ATTRIBUTABLE_REVIEWER_REQUIRED");
  if (reviewer && input.importOperators.some((operator) => (
    normalizedOperatorIdentity(operator) === reviewer
  ))) {
    issues.push("IMPORTER_SELF_REVIEW_FORBIDDEN");
  }
  if (reviewer
    && normalizedOperatorIdentity(input.rightsReviewerOperator)
    && normalizedOperatorIdentity(input.rightsReviewerOperator) === reviewer) {
    issues.push("RIGHTS_REVIEWER_SELF_REVIEW_FORBIDDEN");
  }
  return Array.from(new Set(issues));
}
export function governanceForHumanQuestion(
  reviewerId: number,
  reviewedAt: Date,
): QuestionGovernanceUpdate & { generationSource: "human" } {
  return {
    generationSource: "human",
    reviewStatus: "approved",
    isActive: true,
    reviewedBy: reviewerId,
    reviewedAt,
  };
}

/** File imports are never assessment-eligible until a bank editor reviews them. */
export function governanceForImportedQuestion(
  generationSource: Exclude<QuestionGenerationSource, "human">,
): QuestionGovernanceUpdate & {
  generationSource: Exclude<QuestionGenerationSource, "human">;
  reviewStatus: "pending";
  isActive: false;
  reviewedBy: null;
  reviewedAt: null;
} {
  return {
    generationSource,
    reviewStatus: "pending",
    isActive: false,
    reviewedBy: null,
    reviewedAt: null,
  };
}

/** A substantive edit invalidates the prior review decision. */
export function governanceAfterQuestionEdit(): QuestionGovernanceUpdate {
  return {
    reviewStatus: "pending",
    isActive: false,
    reviewedBy: null,
    reviewedAt: null,
  };
}

export function governanceForQuestionReview(
  status: "approved" | "rejected",
  reviewerId: number,
  reviewedAt: Date,
): QuestionGovernanceUpdate {
  return {
    reviewStatus: status,
    isActive: status === "approved",
    reviewedBy: reviewerId,
    reviewedAt,
  };
}

export function parseImportGenerationSource(
  value: unknown,
): Exclude<QuestionGenerationSource, "human"> | null {
  const source = String(value ?? "").trim().toLocaleLowerCase("en");
  if (!source || source === "imported") return "imported";
  if (source === "ai_draft") return "ai_draft";
  return null;
}

/** Exact predicate scheduled-selection queries must mirror in SQL. */
export function isQuestionAssessmentEligible(question: {
  isActive: boolean;
  reviewStatus: string;
}): boolean {
  return question.isActive && question.reviewStatus === "approved";
}

/**
 * Runtime selection requires attributable review for every exact item version.
 * Rights/provenance verification establishes permission to use a source; it
 * does not establish answer correctness or pedagogical approval.
 */
export function assessmentRuntimeReviewEligibilitySql() {
  return sql`(
    ${questions.reviewedBy} IS NOT NULL
    AND ${questions.reviewedAt} IS NOT NULL
  )`;
}
