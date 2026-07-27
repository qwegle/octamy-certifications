import { describe, expect, it } from "@jest/globals";
import {
  governanceAfterQuestionEdit,
  governanceForHumanQuestion,
  governanceForImportedQuestion,
  governanceForQuestionReview,
  isIndependentQuestionReviewer,
  isQuestionAssessmentEligible,
  parseImportGenerationSource,
  questionReviewSeparationIssues,
  requiresIndependentQuestionReview,
} from "../../server/lib/question-review-policy";
import { parseQuestionPackReviewDecision } from "../../scripts/review-question-pack";

const now = new Date("2026-07-14T13:00:00.000Z");

describe("question review governance", () => {
  it("records direct human authoring as an explicit approval", () => {
    expect(governanceForHumanQuestion(42, now)).toEqual({
      generationSource: "human",
      reviewStatus: "approved",
      isActive: true,
      reviewedBy: 42,
      reviewedAt: now,
    });
  });

  it("keeps AI and generic imports inactive pending human review", () => {
    expect(governanceForImportedQuestion("ai_draft")).toEqual({
      generationSource: "ai_draft",
      reviewStatus: "pending",
      isActive: false,
      reviewedBy: null,
      reviewedAt: null,
    });
    expect(governanceForImportedQuestion("imported").generationSource).toBe("imported");
  });

  it("accepts only non-human import provenance values", () => {
    expect(parseImportGenerationSource(undefined)).toBe("imported");
    expect(parseImportGenerationSource(" AI_DRAFT ")).toBe("ai_draft");
    expect(parseImportGenerationSource("imported")).toBe("imported");
    expect(parseImportGenerationSource("human")).toBeNull();
    expect(parseImportGenerationSource("approved")).toBeNull();
  });

  it("invalidates approval after a substantive edit", () => {
    expect(governanceAfterQuestionEdit()).toEqual({
      reviewStatus: "pending",
      isActive: false,
      reviewedBy: null,
      reviewedAt: null,
    });
  });

  it("activates only an explicit approval decision", () => {
    expect(governanceForQuestionReview("approved", 9, now)).toEqual({
      reviewStatus: "approved",
      isActive: true,
      reviewedBy: 9,
      reviewedAt: now,
    });
    expect(governanceForQuestionReview("rejected", 9, now)).toEqual({
      reviewStatus: "rejected",
      isActive: false,
      reviewedBy: 9,
      reviewedAt: now,
    });
  });

  it("requires independent review for every first-party assessment bank", () => {
    expect(requiresIndependentQuestionReview({ ownerType: "admin", bankPurpose: "certification" })).toBe(true);
    expect(requiresIndependentQuestionReview({ ownerType: "admin", bankPurpose: "practice" })).toBe(true);
    expect(requiresIndependentQuestionReview({ ownerType: "creator", bankPurpose: "practice" })).toBe(false);
    expect(isIndependentQuestionReviewer(7, 8)).toBe(true);
    expect(isIndependentQuestionReviewer(7, 7)).toBe(false);
    expect(isIndependentQuestionReviewer(null, 8)).toBe(false);
  });


  it("rejects importer, rights-reviewer, and author self-approval identities", () => {
    expect(questionReviewSeparationIssues({
      authorUserId: 7,
      reviewerUserId: 7,
      reviewerOperator: "Named Import Operator",
      importOperators: [" named import operator "],
      rightsReviewerOperator: "Other Rights Reviewer",
    })).toEqual(expect.arrayContaining([
      "INDEPENDENT_REVIEW_REQUIRED",
      "IMPORTER_SELF_REVIEW_FORBIDDEN",
    ]));
    expect(questionReviewSeparationIssues({
      authorUserId: 7,
      reviewerUserId: 8,
      reviewerOperator: "Named Rights Reviewer",
      importOperators: ["Named Import Operator"],
      rightsReviewerOperator: "named rights reviewer",
    })).toContain("RIGHTS_REVIEWER_SELF_REVIEW_FORBIDDEN");
    expect(questionReviewSeparationIssues({
      authorUserId: 7,
      reviewerUserId: 8,
      reviewerOperator: "Independent Content Reviewer",
      importOperators: ["Named Import Operator"],
      rightsReviewerOperator: "Named Rights Reviewer",
    })).toEqual([]);
  });

  it("requires exact source record, content hash, version, decision, and item-specific note", () => {
    const valid = {
      sourceRecordId: "raes-v1-039",
      contentHash: "a".repeat(64),
      expectedVersion: 1,
      decision: "approved" as const,
      note: "raes-v1-039 independently solved and checked against its primary source.",
    };
    expect(parseQuestionPackReviewDecision(valid)).toEqual(valid);
    expect(() => parseQuestionPackReviewDecision({
      ...valid,
      note: "Generic approval note that is not tied to the exact source record.",
    })).toThrow(/sourceRecordId/);
    expect(() => parseQuestionPackReviewDecision({ ...valid, contentHash: "not-a-hash" })).toThrow();
  });
  it("exposes the exact scheduled-assessment eligibility predicate", () => {
    expect(isQuestionAssessmentEligible({ isActive: true, reviewStatus: "approved" })).toBe(true);
    expect(isQuestionAssessmentEligible({ isActive: false, reviewStatus: "approved" })).toBe(false);
    expect(isQuestionAssessmentEligible({ isActive: true, reviewStatus: "pending" })).toBe(false);
  });
});
