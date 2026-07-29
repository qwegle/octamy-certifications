import { describe, expect, it } from "@jest/globals";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildPendingExamResultPayload,
  canAccessPendingExam,
} from "../../server/lib/pending-exam-access";

const sensitiveReview = [{
  questionId: 17,
  question: "Which answer is secret until purchase?",
  options: ["Alpha option", "Beta option"],
  selectedAnswer: 0,
  correctAnswer: 1,
  selectedOption: "Alpha option",
  correctOption: "Beta option",
  explanation: "The paid explanation",
  isCorrect: false,
}];

const pendingExam = (assessmentPurpose: "certification" | "practice") => ({
  userId: 7,
  userEmail: "learner@example.test",
  score: 50,
  passed: true,
  correctAnswers: 1,
  totalQuestions: 2,
  timeTaken: 45,
  mastered: false,
  isRetake: false,
  previousBestScore: 0,
  assessmentPurpose,
  review: sensitiveReview,
  course: {
    id: 3,
    slug: "safe-assessment",
    title: "Safe Assessment",
    passingScore: 50,
    price: "499.00",
    assessmentPurpose,
  },
});

describe("pending exam review access", () => {
  it("omits all review content from a locked certification payload", () => {
    const payload = buildPendingExamResultPayload("temp_locked", pendingExam("certification"));
    expect(payload).toMatchObject({
      score: 50,
      passed: true,
      correctAnswers: 1,
      totalQuestions: 2,
      passingThreshold: 50,
      reviewLocked: true,
      needsPayment: true,
    });
    expect(payload).not.toHaveProperty("review");
    expect(payload).not.toHaveProperty("credential");
    const wire = JSON.stringify(payload);
    for (const secret of [
      "Which answer is secret until purchase?",
      "Alpha option",
      "Beta option",
      "The paid explanation",
      "selectedAnswer",
      "correctOption",
    ]) expect(wire).not.toContain(secret);
  });

  it("includes the full review and certificate action for a paid credential", () => {
    const payload = buildPendingExamResultPayload(
      "temp_paid",
      pendingExam("certification"),
      { certificateId: "OCT-2026-PAID" },
    );
    expect(payload).toMatchObject({
      reviewLocked: false,
      needsPayment: false,
      review: sensitiveReview,
      credential: {
        certificateId: "OCT-2026-PAID",
        href: "/certificate/OCT-2026-PAID",
      },
    });
  });

  it("keeps existing practice review behavior free and unchanged", () => {
    const payload = buildPendingExamResultPayload("temp_practice", pendingExam("practice"));
    expect(payload).toMatchObject({
      assessmentPurpose: "practice",
      reviewLocked: false,
      needsPayment: false,
      review: sensitiveReview,
    });
    expect(payload).not.toHaveProperty("credential");
  });

  it("keeps a legacy guest temporary result readable without unlocking its review", () => {
    const legacyGuest = { ...pendingExam("certification"), userId: null };
    expect(canAccessPendingExam(legacyGuest, null)).toBe(true);
    expect(buildPendingExamResultPayload("temp_legacy_guest", legacyGuest)).toMatchObject({
      tempExamId: "temp_legacy_guest",
      isGuest: true,
      maskedEmail: "l******@example.test",
      reviewLocked: true,
      needsPayment: true,
    });
  });

  it("uses an authoritative paid certificate lookup and never returns review directly from the route", async () => {
    const source = await readFile(path.resolve(process.cwd(), "server/routes.ts"), "utf8");
    const start = source.indexOf('"/api/exam-results-temp/:tempExamId"');
    const end = source.indexOf("const credentialActivationRequestSchema", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const route = source.slice(start, end);
    expect(route).toContain("eq(certificatesTable.isPaid, true)");
    expect(route).toContain("eq(examAttemptsTable.sessionId, examData.sessionId)");
    expect(route).toContain("buildPendingExamResultPayload");
    expect(route).not.toContain("review: Array.isArray(examData.review)");
    expect(route).not.toContain("res.json({\n          tempExamId");
  });
});
