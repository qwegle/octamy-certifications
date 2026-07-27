import { describe, expect, it } from "@jest/globals";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isCredentialEligibleAssessment } from "../../server/lib/certificate-policy";
import {
  publicExamDeadline,
  publicExamSubmissionTiming,
} from "../../server/lib/public-exam-attempt";
import {
  createScheduledQuestionSnapshot,
  scoreScheduledQuestionSnapshots,
  toScheduledQuestionPayload,
} from "../../server/lib/scheduled-exam-attempt";
import { getBadgeFromScore } from "../../server/utils";
import { scoreExam } from "../../server/utils/examScoring";

const source = (relativePath: string) => readFile(path.join(process.cwd(), relativePath), "utf8");

function between(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("candidate-safe assessment payloads and server-only scoring", () => {
  it("removes every answer-key field from scheduled candidate questions", () => {
    const snapshot = createScheduledQuestionSnapshot({
      id: 19,
      question: "Which response is valid?",
      options: ["Distractor", "Answer"],
      questionType: "multiple_choice",
      questionFormat: "mcq_single",
      imageUrl: null,
      codeLanguage: null,
      timeLimitSec: 60,
      maxPoints: 2,
      negativeMarks: 1,
      correctAnswer: 1,
      expectedAnswer: "Answer",
      explanation: "Private scoring evidence",
      version: 4,
    }, 0);

    expect(toScheduledQuestionPayload(snapshot)).toEqual({
      id: 19,
      question: "Which response is valid?",
      options: ["Distractor", "Answer"],
      type: "multiple_choice",
      format: "mcq_single",
      imageUrl: null,
      codeLanguage: null,
      timeLimitSec: 60,
      maxPoints: 2,
    });
    expect(JSON.stringify(toScheduledQuestionPayload(snapshot))).not.toMatch(
      /correctAnswer|expectedAnswer|explanation/,
    );
  });

  it("grades public answers only against the server-held map", () => {
    const serverAnswerMap = { "11": 2, "12": 0, "13": 1 };
    const untrustedClientAnswers = { "11": 2, "12": 3, "999": 0 };

    expect(scoreExam(serverAnswerMap, untrustedClientAnswers)).toEqual({
      totalQuestions: 3,
      correctAnswers: 1,
      score: 33,
    });
  });

  it("grades scheduled answers only against immutable server snapshots", () => {
    expect(scoreScheduledQuestionSnapshots([
      { questionId: 11, correctAnswer: 2, maxPoints: 3, negativeMarks: 1 },
      { questionId: 12, correctAnswer: 0, maxPoints: 1, negativeMarks: 0 },
    ], { "11": 2, "12": 3, "999": 0 })).toEqual({
      score: 3,
      totalPoints: 4,
      totalQuestions: 2,
      correctAnswers: 1,
      answeredQuestions: 2,
    });
  });

  it("keeps correct answers out of both exam clients and the public start response", async () => {
    const [web, mobile, mobileApi, routes] = await Promise.all([
      source("client/src/pages/exam.tsx"),
      source("mobile/src/app/exam/[courseId].tsx"),
      source("mobile/src/features/certifications/api.ts"),
      source("server/routes.ts"),
    ]);

    expect(web).not.toContain("correctAnswer");
    expect(mobile).not.toContain("correctAnswer");
    expect(mobileApi).toContain(
      "const questionSchema = z.object({ id: z.number().int(), options: z.array(z.string()).min(1), question: z.string().min(1) });",
    );

    const publicResponse = between(
      routes,
      "const questionsWithoutAnswers = questionsWithShuffledOptions.map",
      "// EXAM SUBMISSION ENDPOINT",
    );
    expect(publicResponse).toContain("questions: questionsWithoutAnswers");
    expect(publicResponse).not.toContain("correctAnswer:");
  });

  it("contains no client-side scoring path before submission", async () => {
    const [web, mobile, routes] = await Promise.all([
      source("client/src/pages/exam.tsx"),
      source("mobile/src/app/exam/[courseId].tsx"),
      source("server/routes.ts"),
    ]);

    expect(web).not.toMatch(/scoreExam|calculateScore|selected.*===.*correct/i);
    expect(mobile).not.toMatch(/scoreExam|calculateScore|selected.*===.*correct/i);
    const submitRoute = between(routes, 'app.post(\n    "/api/exam/submit"', "// Temporary exam results endpoint");
    expect(submitRoute).toContain("scoreExam(\n          correctAnswersMapping,\n          answersRecord");
    expect(submitRoute).toContain("const passed = score >= passingScore");
  });
});

describe("authoritative configuration, timing, recovery, and credentials", () => {
  it("derives arbitrary deadlines and timeout decisions from configured duration", () => {
    const startedAt = "2026-07-27T10:00:00.000Z";
    expect(publicExamDeadline(startedAt, 37).toISOString()).toBe("2026-07-27T10:37:00.000Z");
    expect(publicExamSubmissionTiming(
      startedAt,
      37,
      Date.parse("2026-07-27T10:37:15.001Z"),
    )).toMatchObject({ elapsedSeconds: 2220, deadlineExceeded: true });
  });

  it("uses blueprint and exam-instance question counts without repeating question IDs", async () => {
    const [routes, storage, scheduledRoutes] = await Promise.all([
      source("server/routes.ts"),
      source("server/storage.ts"),
      source("server/routes/featureRoutes.ts"),
    ]);

    const publicSelection = between(routes, "const questions = course.useBlueprintEngine", "// Shuffle options within each question");
    expect(publicSelection).toContain("? questions.length");
    expect(routes).toContain("|| !lockedCourse.useBlueprintEngine");

    const blueprintSelection = between(storage, "async materializeBlueprintForAttempt", "export const storage");
    expect(blueprintSelection).toContain(".limit(item.questionCount)");
    expect(blueprintSelection).toContain("notInArray(questions.id, selectedIds)");
    expect(blueprintSelection).toContain("selectedIds.push(...pool.map((question) => question.id))");

    const scheduledStart = between(scheduledRoutes, "router.post('/x/:code/start'", "router.post('/exam-attempts/:id/heartbeat'");
    expect(scheduledStart).toContain(".limit(inst.questionCount)");
    expect(scheduledStart).toContain("sourceQuestions.length !== inst.questionCount");
    expect(scheduledStart).toContain("passingScoreSnapshot: inst.passingScore");
    expect(scheduledStart).toContain("deadlineAt");
  });

  it("anchors both clients to server-issued session timing and recovery state", async () => {
    const [web, mobile] = await Promise.all([
      source("client/src/pages/exam.tsx"),
      source("mobile/src/app/exam/[courseId].tsx"),
    ]);

    expect(web).toContain("const authoritativeStart = Date.parse(activeQuestionsData?.startedAt || \"\")");
    expect(web).toContain("deadlineAt: Date.parse(activeQuestionsData.deadlineAt)");
    expect(web).toContain("localStorage.setItem(`octamy.examDraft.${course.id}`");
    expect(web).toContain("const resumeSavedExam = async () =>");

    expect(mobile).toContain("Date.parse(attempt.deadlineAt) - Date.now()");
    expect(mobile).toContain("void loadAttempt(user.id, courseId)");
    expect(mobile).toContain("await saveAttempt(next)");
    expect(mobile).toContain("await clearAttempt(attempt.userId, attempt.courseId)");
  });

  it("applies published badge tiers and fails credential eligibility closed", () => {
    expect([49, 50, 69, 70, 79, 80, 89, 90].map(getBadgeFromScore)).toEqual([
      "bronze", "bronze", "bronze", "silver", "silver", "gold", "gold", "platinum",
    ]);

    const eligible = {
      productType: "assessment",
      assessmentPurpose: "certification",
      certificationMode: "octamy",
      isActive: true,
      reviewStatus: "approved",
    };
    expect(isCredentialEligibleAssessment(eligible)).toBe(true);
    expect(isCredentialEligibleAssessment({ ...eligible, assessmentPurpose: "practice" })).toBe(false);
    expect(isCredentialEligibleAssessment({ ...eligible, certificationMode: "none" })).toBe(false);
    expect(isCredentialEligibleAssessment({ ...eligible, reviewStatus: "pending" })).toBe(false);
  });
});
