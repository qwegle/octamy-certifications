import { describe, expect, it } from "@jest/globals";
import {
  createScheduledQuestionSnapshot,
  isScheduledAttemptTimedOut,
  isScheduledDeadlineExceeded,
  scheduledAttemptDeadline,
  scheduledAttemptPassed,
  scheduledAttemptRemainingSeconds,
  scheduledDeadlineRemainingSeconds,
  scheduledRetakeAvailableAt,
  scheduledReviewDecision,
  scheduledScorePercentage,
  scoreScheduledQuestionSnapshots,
  toScheduledQuestionPayload,
  type ScheduledSourceQuestion,
} from "../../server/lib/scheduled-exam-attempt";

describe("scheduled exam immutable question snapshots", () => {
  it("keeps rendering and scoring stable after the source question is edited and deactivated", () => {
    const source: ScheduledSourceQuestion & { isActive: boolean } = {
      id: 41,
      question: "Which option is correct?",
      options: ["Distractor", "Original answer"],
      questionType: "multiple_choice",
      questionFormat: "mcq_single",
      imageUrl: "https://cdn.example.test/original.png",
      codeLanguage: null,
      timeLimitSec: 45,
      maxPoints: 1,
      negativeMarks: 0,
      correctAnswer: 1,
      expectedAnswer: null,
      explanation: "The second option is correct.",
      version: 3,
      isActive: true,
    };

    const snapshot = createScheduledQuestionSnapshot(source, 0);

    source.question = "Edited after the learner started";
    (source.options as string[])[1] = "Changed answer text";
    source.correctAnswer = 0;
    source.imageUrl = null;
    source.version = 4;
    source.isActive = false;

    expect(toScheduledQuestionPayload(snapshot)).toEqual({
      id: 41,
      question: "Which option is correct?",
      options: ["Distractor", "Original answer"],
      type: "multiple_choice",
      format: "mcq_single",
      imageUrl: "https://cdn.example.test/original.png",
      codeLanguage: null,
      timeLimitSec: 45,
      maxPoints: 1,
    });
    expect(scoreScheduledQuestionSnapshots([snapshot], { "41": 1 })).toEqual({
      score: 1,
      totalPoints: 1,
      totalQuestions: 1,
      correctAnswers: 1,
      answeredQuestions: 1,
    });
  });

  it("never includes answer keys in the candidate question payload", () => {
    const snapshot = createScheduledQuestionSnapshot({
      id: 7,
      question: "True or false?",
      options: ["False", "True"],
      questionType: "multiple_choice",
      questionFormat: "true_false",
      imageUrl: null,
      codeLanguage: null,
      timeLimitSec: null,
      maxPoints: 1,
      negativeMarks: 0,
      correctAnswer: 1,
      expectedAnswer: "true",
      explanation: "This remains server-side.",
      version: 1,
    }, 0);

    const payload = toScheduledQuestionPayload(snapshot);
    expect(payload).not.toHaveProperty("correctAnswer");
    expect(payload).not.toHaveProperty("expectedAnswer");
    expect(payload).not.toHaveProperty("explanation");
  });

  it("honours immutable weights and negative marks without penalising unanswered items", () => {
    const items = [
      { questionId: 1, correctAnswer: 0, maxPoints: 4, negativeMarks: 1 },
      { questionId: 2, correctAnswer: 1, maxPoints: 2, negativeMarks: 2 },
      { questionId: 3, correctAnswer: 0, maxPoints: 1, negativeMarks: 1 },
    ];

    expect(scoreScheduledQuestionSnapshots(items, { "1": 0, "2": 0 })).toEqual({
      score: 2,
      totalPoints: 7,
      totalQuestions: 3,
      correctAnswers: 1,
      answeredQuestions: 2,
    });
    expect(scheduledScorePercentage(2, 7)).toBe(29);
  });

  it("rejects malformed marks and answer keys before a snapshot can start", () => {
    const base: ScheduledSourceQuestion = {
      id: 9,
      question: "Bad key",
      options: ["A", "B"],
      questionType: "multiple_choice",
      questionFormat: "mcq_single",
      imageUrl: null,
      codeLanguage: null,
      timeLimitSec: null,
      maxPoints: 2,
      negativeMarks: 3,
      correctAnswer: 2,
      expectedAnswer: null,
      explanation: null,
      version: 1,
    };

    expect(() => createScheduledQuestionSnapshot(base, 0)).toThrow("negativeMarks");
    expect(() => createScheduledQuestionSnapshot({ ...base, negativeMarks: 0 }, 0)).toThrow("correctAnswer");
  });
});

describe("scheduled exam authoritative deadline", () => {
  const startedAt = "2026-07-14T10:00:00.000Z";

  it("uses the exam closing window when it arrives before nominal duration", () => {
    const closesAt = "2026-07-14T10:10:00.000Z";
    expect(scheduledAttemptDeadline(startedAt, 60, closesAt).toISOString()).toBe(closesAt);
    expect(scheduledAttemptRemainingSeconds(startedAt, 60, closesAt, Date.parse("2026-07-14T10:09:30.000Z"))).toBe(30);
    expect(isScheduledAttemptTimedOut(startedAt, 60, closesAt, Date.parse("2026-07-14T10:10:15.000Z"))).toBe(false);
    expect(isScheduledAttemptTimedOut(startedAt, 60, closesAt, Date.parse("2026-07-14T10:10:15.001Z"))).toBe(true);
  });

  it("keeps the stored deadline stable if the exam configuration is later extended", () => {
    const storedDeadline = scheduledAttemptDeadline(startedAt, 60, "2026-07-14T10:10:00.000Z");
    const editedExamEndsAt = "2026-07-14T13:00:00.000Z";
    const editedDurationMin = 180;

    expect(scheduledAttemptDeadline(startedAt, editedDurationMin, editedExamEndsAt).toISOString())
      .toBe("2026-07-14T13:00:00.000Z");
    expect(scheduledDeadlineRemainingSeconds(storedDeadline, Date.parse("2026-07-14T10:09:30.000Z"))).toBe(30);
    expect(isScheduledDeadlineExceeded(storedDeadline, Date.parse("2026-07-14T10:10:15.001Z"))).toBe(true);
  });

  it("uses nominal duration when the exam window closes later", () => {
    expect(scheduledAttemptDeadline(
      startedAt,
      30,
      "2026-07-14T12:00:00.000Z",
    ).toISOString()).toBe("2026-07-14T10:30:00.000Z");
  });

  it("uses nominal duration when no closing window is configured", () => {
    expect(scheduledAttemptDeadline(startedAt, 30, null).toISOString())
      .toBe("2026-07-14T10:30:00.000Z");
  });
});

describe("scheduled exam pass-mark snapshot", () => {
  it("uses the pass mark captured at start rather than a later exam edit", () => {
    const passingScoreAtStart = 70;
    const editedExamPassingScore = 95;

    expect(scheduledAttemptPassed(80, false, passingScoreAtStart)).toBe(true);
    expect(scheduledAttemptPassed(80, false, editedExamPassingScore)).toBe(false);
    expect(scheduledAttemptPassed(100, true, passingScoreAtStart)).toBe(false);
  });
});

describe("scheduled exam retake and answer-review policy", () => {
  it("enforces cooldown from the last completed attempt", () => {
    const previous = "2026-07-14T10:00:00.000Z";
    expect(scheduledRetakeAvailableAt(previous, 30, Date.parse("2026-07-14T10:15:00.000Z"))?.toISOString())
      .toBe("2026-07-14T10:30:00.000Z");
    expect(scheduledRetakeAvailableAt(previous, 30, Date.parse("2026-07-14T10:30:00.000Z")))
      .toBeNull();
    expect(scheduledRetakeAvailableAt(previous, 0)).toBeNull();
  });

  it("fails closed until each configured review policy permits answer keys", () => {
    expect(scheduledReviewDecision({
      submitted: false,
      policy: "immediate",
      attemptNumber: 1,
      maxAttempts: 1,
    }).reason).toBe("not_submitted");

    expect(scheduledReviewDecision({
      submitted: true,
      policy: "after_final_attempt",
      attemptNumber: 1,
      maxAttempts: 2,
    })).toMatchObject({ allowed: false, reason: "attempts_remaining" });
    expect(scheduledReviewDecision({
      submitted: true,
      policy: "after_final_attempt",
      attemptNumber: 2,
      maxAttempts: 2,
    })).toMatchObject({ allowed: true, reason: "available" });

    expect(scheduledReviewDecision({
      submitted: true,
      policy: "after_window",
      releaseAt: "2026-07-14T12:00:00.000Z",
      attemptNumber: 1,
      maxAttempts: 1,
      nowMs: Date.parse("2026-07-14T11:59:59.000Z"),
    })).toMatchObject({ allowed: false, reason: "window_open", availableAt: "2026-07-14T12:00:00.000Z" });
    expect(scheduledReviewDecision({
      submitted: true,
      policy: "after_window",
      releaseAt: "2026-07-14T12:00:00.000Z",
      attemptNumber: 1,
      maxAttempts: 1,
      nowMs: Date.parse("2026-07-14T12:00:00.000Z"),
    })).toMatchObject({ allowed: true, reason: "available" });

    expect(scheduledReviewDecision({
      submitted: true,
      policy: "score_only",
      attemptNumber: 1,
      maxAttempts: 1,
    })).toMatchObject({ allowed: false, reason: "score_only" });
    expect(scheduledReviewDecision({
      submitted: true,
      policy: "unexpected",
      attemptNumber: 1,
      maxAttempts: 1,
    })).toMatchObject({ allowed: false, reason: "policy_unavailable" });
  });
});
