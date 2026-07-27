import { describe, expect, it } from "@jest/globals";
import {
  assertGovernedInventoryReadOnlyMode,
  evaluateGovernedAssessmentInventory,
  groupInventoryIssues,
  type GovernedAssessmentInventoryInput,
} from "../../scripts/lib/governed-assessment-inventory";

function blockedFixture(): GovernedAssessmentInventoryInput {
  return {
    id: 42,
    slug: "test-only-governance-fixture",
    title: "Test-only governance fixture",
    ownerType: "admin",
    productType: "assessment",
    assessmentPurpose: "certification",
    useBlueprintEngine: true,
    visibility: "public",
    reviewStatus: "approved",
    isActive: true,
    blueprintRevisionCount: 0,
    rules: [{
      id: 7,
      bankId: 9,
      topicId: 3,
      questionCount: 20,
      difficulty: "mixed",
      bank: {
        id: 9,
        slug: "test-only-practice-bank",
        purpose: "practice",
        status: "draft",
        syllabusVersion: null,
      },
    }],
    questions: [{
      id: 101,
      bankId: 9,
      topicId: 3,
      question: "Which test-only option demonstrates the expected governed behavior?",
      questionFormat: "mcq_single",
      options: ["First", "Second", "Third"],
      correctAnswer: 0,
      difficulty: "medium",
      explanation: null,
      generationSource: "human",
      reviewStatus: "approved",
      isActive: true,
      createdBy: 5,
      reviewedBy: 5,
      reviewedAt: "2026-07-27T00:00:00.000Z",
      version: 2,
      versionHistoryCount: 0,
      contentHash: "a".repeat(64),
      answerMetadata: null,
      imageUrl: "https://example.invalid/test-only.png",
      imageAltText: null,
      optionMedia: [{ url: "https://example.invalid/option.png", alt: "" }],
      sourceLinks: [],
    }],
    evidenceRepresentation: {
      itemAccessibilityFields: true,
      assessmentAccessibilityAcceptance: false,
      immutableReleaseBundle: false,
      attributableRightsReviewerIdentity: false,
    },
  };
}

describe("governed assessment inventory", () => {
  it("refuses every mode except dry-run", () => {
    expect(() => assertGovernedInventoryReadOnlyMode("dry-run")).not.toThrow();
    expect(() => assertGovernedInventoryReadOnlyMode("publish")).toThrow(/READ_ONLY_ONLY/);
    expect(() => assertGovernedInventoryReadOnlyMode("apply")).toThrow(/READ_ONLY_ONLY/);
  });

  it("fails closed with exact governance reasons and marks unsafe published rows", () => {
    const report = evaluateGovernedAssessmentInventory(blockedFixture());
    const codes = report.issues.map((found) => found.code);

    expect(report.status).toBe("blocked");
    expect(report.releaseReady).toBe(false);
    expect(report.runtimePublishReady).toBe(false);
    expect(report.unsafePublished).toBe(true);
    expect(codes).toEqual(expect.arrayContaining([
      "BLUEPRINT_REVISION_REQUIRED",
      "BANK_PURPOSE_MISMATCH",
      "BANK_NOT_ACTIVE",
      "BANK_SYLLABUS_VERSION_REQUIRED",
      "QUESTION_PROVENANCE_REQUIRED",
      "QUESTION_VERSION_HISTORY_REQUIRED",
      "QUESTION_IMAGE_ALT_TEXT_REQUIRED",
      "OPTION_MEDIA_ALT_TEXT_REQUIRED",
      "RIGHTS_ROLE_SEPARATION_NOT_VERIFIABLE",
      "ASSESSMENT_ACCESSIBILITY_ACCEPTANCE_NOT_REPRESENTED",
      "IMMUTABLE_RELEASE_BUNDLE_NOT_REPRESENTED",
      "INDEPENDENT_REVIEW_REQUIRED",
      "FACTUAL_ANSWER_VALIDATION_REQUIRED",
      "ITEM_REVIEW_ATTESTATION_REQUIRED",
      "BLUEPRINT_RULE_INVENTORY_INCOMPLETE",
      "ASSESSMENT_INVENTORY_INCOMPLETE",
    ]));
  });

  it("groups exact affected identifiers without losing occurrences", () => {
    const grouped = groupInventoryIssues([
      { severity: "blocker", code: "RIGHTS", message: "Missing", questionId: 2, bankId: 7, sourceId: 11 },
      { severity: "blocker", code: "RIGHTS", message: "Missing", questionId: 3, bankId: 7, sourceId: 11 },
    ]);

    expect(grouped).toEqual([{
      severity: "blocker",
      code: "RIGHTS",
      message: "Missing",
      occurrences: 2,
      questionIds: [2, 3],
      bankIds: [7],
      sourceIds: [11],
    }]);
  });
});
