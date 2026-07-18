import { describe, expect, it } from "@jest/globals";
import {
  assessmentReleaseEvidenceFromCsvRow,
  assessmentReleaseEvidenceFromMetadata,
  evaluateAssessmentContentAcceptance,
  type AssessmentAcceptanceQuestion,
} from "../../server/lib/assessment-content-acceptance";

function acceptedQuestion(id: number, overrides: Partial<AssessmentAcceptanceQuestion> = {}): AssessmentAcceptanceQuestion {
  const correct = String((id + 10) * 10);
  const correctAnswer = id % 3;
  const options = [String((id + 10) * 5), String((id + 10) * 20)];
  options.splice(correctAnswer, 0, correct);
  return {
    id,
    bankId: 4,
    topicId: 9,
    question: `A service receives ${id + 10} requests per second for 10 seconds. How many requests does it receive?`,
    questionFormat: "mcq_single",
    options,
    correctAnswer,
    difficulty: id % 5 === 0 ? "hard" : id % 2 === 0 ? "easy" : "medium",
    explanation: `Multiply the request rate ${id + 10} by the 10-second interval to obtain the keyed answer.`,
    generationSource: "human",
    reviewStatus: "approved",
    isActive: true,
    createdBy: 11,
    reviewedBy: 12,
    reviewedAt: "2026-07-18T00:00:00.000Z",
    version: 2,
    contentHash: "a".repeat(64),
    releaseEvidence: {
      syllabusVersion: "backend-v1",
      objectiveCode: `CAPACITY-${id}`,
      answerValidation: {
        status: "verified",
        method: "independent_calculation",
        reference: `calculation-sheet-${id}`,
      },
      distractorReview: {
        status: "verified",
        note: "Both distractors represent plausible rate/time mistakes.",
      },
      reviewAttestation: {
        status: "attested",
        note: "I independently checked this exact item, answer, explanation, and distractors.",
        contentHash: "a".repeat(64),
        contentVersion: 1,
        decisionVersion: 2,
        reviewerId: 12,
      },
    },
    ...overrides,
  };
}

describe("assessment content acceptance", () => {
  it("round-trips strict CSV release evidence into persisted answer metadata", () => {
    const parsed = assessmentReleaseEvidenceFromCsvRow({
      syllabusVersion: "git-linux-v1",
      objectiveCode: "GIT-DIFF-01",
      answerValidationMethod: "primary_source",
      answerValidationReference: "https://git-scm.com/docs/git-diff",
      distractorReviewNote: "The three distractors are real commands with different effects.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.evidence) return;
    expect(assessmentReleaseEvidenceFromMetadata({ releaseEvidence: parsed.evidence }))
      .toEqual(parsed.evidence);
    expect(assessmentReleaseEvidenceFromCsvRow({
      syllabusVersion: "git-linux-v1",
      objectiveCode: "GIT-DIFF-01",
      answerValidationMethod: "web_search",
      answerValidationReference: "somewhere online",
      distractorReviewNote: "Seems reasonable enough.",
    })).toMatchObject({ ok: false });
  });

  it("rejects loose, short, and stale release evidence metadata", () => {
    const evidence = acceptedQuestion(1).releaseEvidence!;
    expect(assessmentReleaseEvidenceFromMetadata({
      releaseEvidence: { ...evidence, objectiveCode: " " },
    })).toBeNull();
    expect(assessmentReleaseEvidenceFromMetadata({
      releaseEvidence: { ...evidence, unexpectedApproval: true },
    })).toBeNull();

    const stale = acceptedQuestion(1, {
      version: 3,
    });
    const report = evaluateAssessmentContentAcceptance({
      assessmentSlug: "stale-item-review",
      purpose: "certification",
      syllabusVersion: "backend-v1",
      useBlueprintEngine: true,
      rules: [{ bankId: 4, topicId: 9, questionCount: 20, difficulty: "mixed" }],
      questions: [stale],
    });
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ITEM_REVIEW_ATTESTATION_REQUIRED", questionId: 1 }),
    ]));
  });

  it("blocks placeholder content, invalid answers, self-review, and missing factual evidence", () => {
    const report = evaluateAssessmentContentAcceptance({
      assessmentSlug: "python-backend-api-foundations",
      purpose: "certification",
      syllabusVersion: "backend-v1",
      useBlueprintEngine: true,
      rules: [{ bankId: 4, topicId: 9, questionCount: 20, difficulty: "mixed" }],
      questions: [acceptedQuestion(1, {
        question: "What is the primary purpose of machine in modern applications? (NOVICE Level - Q1)",
        correctAnswer: 9,
        createdBy: 12,
        releaseEvidence: null,
      })],
    });
    expect(report.releasable).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "PLACEHOLDER_OR_WEAK_STEM",
      "ANSWER_KEY_INVALID",
      "INDEPENDENT_REVIEW_REQUIRED",
      "SYLLABUS_EVIDENCE_REQUIRED",
      "FACTUAL_ANSWER_VALIDATION_REQUIRED",
      "DISTRACTOR_REVIEW_REQUIRED",
    ]));
  });

  it("detects exact duplicates and concentrated substitution templates", () => {
    const questions = Array.from({ length: 10 }, (_, index) => acceptedQuestion(index + 1));
    questions[9] = acceptedQuestion(10, { question: questions[0].question });
    const report = evaluateAssessmentContentAcceptance({
      assessmentSlug: "capacity-practice",
      purpose: "practice",
      syllabusVersion: "backend-v1",
      useBlueprintEngine: true,
      rules: [{ bankId: 4, topicId: 9, questionCount: 2, difficulty: "mixed" }],
      questions,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_QUESTION",
      "SEMANTIC_TEMPLATE_CONCENTRATION",
    ]));
  });

  it("blocks an exploitable answer-position pattern", () => {
    const questions = Array.from({ length: 80 }, (_, index) => acceptedQuestion(index + 1, {
      question: `Reviewed scenario ${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}: which result is correct?`,
      correctAnswer: 0,
    }));
    const report = evaluateAssessmentContentAcceptance({
      assessmentSlug: "patterned-answer-key",
      purpose: "certification",
      syllabusVersion: "backend-v1",
      useBlueprintEngine: true,
      rules: [{ bankId: 4, topicId: 9, questionCount: 20, difficulty: "mixed" }],
      questions,
    });
    expect(report.releasable).toBe(false);
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "ANSWER_POSITION_CONCENTRATION" }),
    ]));
  });

  it("produces attributable per-assessment evidence for a release-ready certification", () => {
    const questions = Array.from({ length: 80 }, (_, index) => acceptedQuestion(index + 1, {
      question: `For independently reviewed capacity scenario ${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}, which result follows from ${index + 11} units multiplied by 10?`,
    }));
    const report = evaluateAssessmentContentAcceptance({
      assessmentSlug: "backend-capacity-certification",
      purpose: "certification",
      syllabusVersion: "backend-v1",
      useBlueprintEngine: true,
      rules: [{
        bankId: 4,
        topicId: 9,
        questionCount: 20,
        difficulty: "mixed",
        difficultyTargets: { easy: 20, medium: 30, hard: 10 },
      }],
      questions,
    });
    expect(report.releasable).toBe(true);
    expect(report.acceptedQuestionCount).toBe(80);
    expect(report.readiness.ready).toBe(true);
    expect(report.evidence).toMatchObject({
      syllabusVersions: ["backend-v1"],
      authorIds: [11],
      reviewerIds: [12],
    });
    expect(report.evidence.objectiveCodes).toHaveLength(80);
  });

  it("applies the larger practice rotation and explicit difficulty quotas", () => {
    const questions = Array.from({ length: 199 }, (_, index) => acceptedQuestion(index + 1, {
      question: `Objective CAPACITY-${index + 1} asks for the reviewed product of ${index + 11} and 10; which option is correct?`,
    }));
    const report = evaluateAssessmentContentAcceptance({
      assessmentSlug: "backend-capacity-practice",
      purpose: "practice",
      syllabusVersion: "backend-v1",
      useBlueprintEngine: true,
      rules: [{
        bankId: 4,
        topicId: 9,
        questionCount: 40,
        difficulty: "mixed",
        difficultyTargets: { hard: 50 },
      }],
      questions,
    });
    expect(report.releasable).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "BLUEPRINT_RULE_INVENTORY_INCOMPLETE",
      "ASSESSMENT_INVENTORY_INCOMPLETE",
      "DIFFICULTY_QUOTA_INCOMPLETE",
    ]));
  });
});
