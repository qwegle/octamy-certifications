import { sql } from "drizzle-orm";
import {
  questionPackSources,
  questionProvenance,
  questions,
} from "@shared/schema";

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
 * The original quantitative practice catalogue was restored after an accidental
 * production-wide retirement stopped Practice Pass availability. Its immutable
 * source provenance predates attributable per-item reviewer fields. Keep this
 * recovery exception tied to that one verified source; all new content must use
 * the normal independent-review path.
 */
export function assessmentRuntimeReviewEligibilitySql() {
  return sql`(
    (${questions.reviewedBy} IS NOT NULL AND ${questions.reviewedAt} IS NOT NULL)
    OR EXISTS (
      SELECT 1
      FROM ${questionProvenance} runtime_provenance
      INNER JOIN ${questionPackSources} runtime_source
        ON runtime_source.id = runtime_provenance.source_id
      WHERE runtime_provenance.question_id = ${questions.id}
        AND runtime_source.source_key = 'octamy-original:quant-science:v1'
        AND runtime_source.rights_review_status = 'verified'
    )
  )`;
}
