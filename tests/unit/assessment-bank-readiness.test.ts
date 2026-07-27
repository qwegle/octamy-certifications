import { describe, expect, it } from "@jest/globals";
import {
  evaluateAssessmentPublishReadiness,
  hasReadyQuestionInventory,
  isPublishableAssessmentQuestion,
  isPublishedAssessment,
  requiredQuestionInventory,
  requiresAssessmentPublishReadiness,
} from "../../server/lib/assessment-bank-readiness";

describe("assessment bank readiness", () => {
  it("counts only reviewed, active, runtime-compatible questions", () => {
    const publishable = {
      isActive: true,
      reviewStatus: "approved",
      reviewedBy: 12,
      reviewedAt: "2026-07-17T00:00:00.000Z",
      questionFormat: "mcq_single",
      options: ["A", "B", "C", "D"],
      correctAnswer: 2,
    };
    expect(isPublishableAssessmentQuestion(publishable)).toBe(true);
    expect(isPublishableAssessmentQuestion({ ...publishable, reviewedBy: null })).toBe(false);
    expect(isPublishableAssessmentQuestion({ ...publishable, reviewedAt: null })).toBe(false);
    expect(isPublishableAssessmentQuestion({ ...publishable, questionFormat: "short" })).toBe(false);
    expect(isPublishableAssessmentQuestion({ ...publishable, correctAnswer: 4 })).toBe(false);
  });

  it("requires at least 80 and four rotations for certifications", () => {
    expect(requiredQuestionInventory("certification", 10)).toBe(80);
    expect(requiredQuestionInventory("certification", 30)).toBe(120);
    expect(hasReadyQuestionInventory("certification", 20, 79)).toBe(false);
    expect(hasReadyQuestionInventory("certification", 20, 80)).toBe(true);
  });

  it("requires at least 200 and five rotations for practice", () => {
    expect(requiredQuestionInventory("practice", 20)).toBe(200);
    expect(requiredQuestionInventory("practice", 50)).toBe(250);
    expect(hasReadyQuestionInventory("practice", 40, 199)).toBe(false);
    expect(hasReadyQuestionInventory("practice", 40, 200)).toBe(true);
  });

  it("fails publication when the reviewed blueprint is missing or undersupplied", () => {
    expect(evaluateAssessmentPublishReadiness({
      purpose: "certification",
      useBlueprintEngine: false,
      approvedInventory: 0,
      rules: [],
    })).toMatchObject({
      ready: false,
      drawCount: 0,
      requiredInventory: 80,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "BLUEPRINT_ENGINE_REQUIRED" }),
        expect.objectContaining({ code: "BLUEPRINT_REQUIRED" }),
        expect.objectContaining({ code: "ASSESSMENT_INVENTORY_INCOMPLETE" }),
      ]),
    });

    const undersupplied = evaluateAssessmentPublishReadiness({
      purpose: "practice",
      useBlueprintEngine: true,
      approvedInventory: 199,
      rules: [{
        bankId: 8,
        topicId: 12,
        questionCount: 40,
        difficulty: "medium",
        approvedInventory: 199,
      }],
    });
    expect(undersupplied.ready).toBe(false);
    expect(undersupplied.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "BLUEPRINT_RULE_INVENTORY_INCOMPLETE",
        required: 200,
        available: 199,
      }),
      expect.objectContaining({
        code: "ASSESSMENT_INVENTORY_INCOMPLETE",
        required: 200,
        available: 199,
      }),
    ]));
  });

  it("accepts only a blueprint with enough reviewed inventory at every scope", () => {
    expect(evaluateAssessmentPublishReadiness({
      purpose: "certification",
      useBlueprintEngine: true,
      approvedInventory: 80,
      rules: [
        {
          bankId: 3,
          topicId: null,
          questionCount: 10,
          difficulty: "easy",
          approvedInventory: 40,
        },
        {
          bankId: 3,
          topicId: null,
          questionCount: 10,
          difficulty: "hard",
          approvedInventory: 40,
        },
      ],
    })).toMatchObject({
      ready: true,
      drawCount: 20,
      requiredInventory: 80,
      approvedInventory: 80,
      issues: [],
    });
  });

  it("rejects overlapping blueprint scopes that double-count rotation inventory", () => {
    const result = evaluateAssessmentPublishReadiness({
      purpose: "certification",
      useBlueprintEngine: true,
      // This union meets 4 x the 40-item draw globally, and every rule appears
      // sufficient in isolation. The first two scopes still share the same 40
      // easy items, so runtime exclusion cannot provide four rotations for both.
      approvedInventory: 160,
      rules: [
        { bankId: 3, topicId: 9, questionCount: 10, difficulty: "mixed", approvedInventory: 40 },
        { bankId: 3, topicId: 9, questionCount: 10, difficulty: "easy", approvedInventory: 40 },
        { bankId: 4, topicId: 12, questionCount: 20, difficulty: "mixed", approvedInventory: 120 },
      ],
    });

    expect(result.requiredInventory).toBe(160);
    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "BLUEPRINT_RULE_SCOPE_OVERLAP",
        bankId: 3,
        topicId: 9,
        conflictingTopicId: 9,
      }),
    ]));
  });

  it("guards activation, public visibility, and approval transitions for assessments only", () => {
    const draft = {
      productType: "assessment",
      visibility: "private",
      reviewStatus: "draft",
      isActive: false,
      assessmentPurpose: "certification",
      useBlueprintEngine: true,
    };
    expect(requiresAssessmentPublishReadiness(draft, { ...draft, isActive: true })).toBe(true);
    expect(requiresAssessmentPublishReadiness(draft, { ...draft, visibility: "public" })).toBe(true);
    expect(requiresAssessmentPublishReadiness(draft, { ...draft, reviewStatus: "approved" })).toBe(true);
    expect(requiresAssessmentPublishReadiness(draft, { ...draft, visibility: "unlisted" })).toBe(false);
    expect(requiresAssessmentPublishReadiness(
      { ...draft, productType: "video_course" },
      { ...draft, productType: "video_course", isActive: true },
    )).toBe(false);
    expect(requiresAssessmentPublishReadiness(null, {
      ...draft,
      visibility: "public",
    })).toBe(false);
    expect(requiresAssessmentPublishReadiness(null, {
      ...draft,
      visibility: "public",
      isActive: true,
      reviewStatus: "approved",
    })).toBe(true);
  });

  it("revalidates readiness-critical changes while leaving published metadata edits alone", () => {
    const published = {
      productType: "assessment",
      visibility: "public",
      reviewStatus: "approved",
      isActive: true,
      assessmentPurpose: "certification",
      useBlueprintEngine: true,
    };
    expect(isPublishedAssessment(published)).toBe(true);
    expect(requiresAssessmentPublishReadiness(published, {
      ...published,
      useBlueprintEngine: false,
    })).toBe(true);
    expect(requiresAssessmentPublishReadiness(published, {
      ...published,
      assessmentPurpose: "practice",
    })).toBe(true);
    expect(requiresAssessmentPublishReadiness(published, { ...published })).toBe(false);
  });
});
