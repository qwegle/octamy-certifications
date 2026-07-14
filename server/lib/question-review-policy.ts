export type QuestionGenerationSource = "human" | "ai_draft" | "imported";
export type QuestionReviewStatus = "draft" | "pending" | "approved" | "rejected" | "retired";

export interface QuestionGovernanceUpdate {
  generationSource?: QuestionGenerationSource;
  reviewStatus: QuestionReviewStatus;
  isActive: boolean;
  reviewedBy: number | null;
  reviewedAt: Date | null;
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
