import { describe, expect, it } from "@jest/globals";
import {
  aggregateInterviewScores,
  calculateInterviewDeadline,
  canShareInterviewEvidence,
  canTransitionInterviewSession,
  getInterviewStudioReadiness,
  interviewEventSchema,
  responseAutosaveSchema,
  sanitizeInterviewBlueprint,
  sessionCreateSchema,
} from "../../server/lib/interview-studio-policy";
import {
  INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
} from "../../shared/interview-studio";

const validBlueprint = {
  schemaVersion: INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  templateKey: "frontend.evidence",
  version: 1,
  title: "Frontend evidence interview",
  summary: "A structured interview with one practical JavaScript task.",
  role: "Frontend developer",
  level: "intermediate" as const,
  skills: ["JavaScript"],
  allowedModes: ["practice", "verified"] as const,
  estimatedDurationMinutes: 30,
  rubricVersion: "frontend-rubric.v1",
  items: [{
    key: "coding.arrays",
    title: "Transform an array",
    competency: "JavaScript reasoning",
    timeLimitSeconds: 600,
    instructions: "Read standard input and write only the requested output.",
    kind: "coding" as const,
    language: "javascript" as const,
    runtime: INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
    interface: "stdin_stdout" as const,
    problemStatement: "Read a list of integers and print their doubled values.",
    starterCode: "const fs = require('fs');",
    constraints: ["The list contains at least one integer."],
    testCases: [{
      key: "case.public-one",
      title: "Visible example",
      visibility: "public" as const,
      input: "1 2 3\n",
      expectedOutput: "2 4 6\n",
      weight: 40,
    }, {
      key: "case.hidden-one",
      title: "Negative values",
      visibility: "hidden" as const,
      input: "-2 0 4\n",
      expectedOutput: "-4 0 8\n",
      weight: 60,
    }],
    rubric: [{
      key: "correctness",
      label: "Correctness",
      description: "Produces the correct deterministic output.",
      weight: 100,
    }],
  }],
};

describe("Interview Studio policy", () => {
  it("removes hidden case keys, inputs, outputs, titles and weights from client blueprints", () => {
    const client = sanitizeInterviewBlueprint(validBlueprint);
    const item = client.items[0];
    expect(item.kind).toBe("coding");
    if (item.kind !== "coding") throw new Error("expected coding item");

    expect(item.testCases).toHaveLength(1);
    expect(item.testCases[0]).toEqual(expect.objectContaining({
      key: "case.public-one",
      input: "1 2 3\n",
      expectedOutput: "2 4 6\n",
    }));
    expect(item.testCaseSummary).toEqual({ publicCount: 1, hiddenCount: 1, totalCount: 2 });
    expect(JSON.stringify(client)).not.toContain("case.hidden-one");
    expect(JSON.stringify(client)).not.toContain("-2 0 4");
    expect(JSON.stringify(client)).not.toContain("Negative values");
  });

  it("keeps practice sessions private and validates strict consent snapshots", () => {
    const baseRequest = {
      templateKey: "frontend.evidence",
      mode: "practice" as const,
      consent: {
        policyVersion: "consent.v1",
        acknowledgedAt: "2026-07-16T10:00:00.000Z",
        aiEvaluation: true,
        microphoneTranscription: true,
        cameraRecording: false,
        screenRecording: false,
        recruiterSharing: false as const,
      },
      permissions: {
        capturedAt: "2026-07-16T10:00:00.000Z",
        camera: { required: false, state: "not_requested" as const },
        microphone: { required: false, state: "granted" as const },
        screen: { required: false, state: "not_requested" as const },
      },
    };
    expect(sessionCreateSchema.safeParse(baseRequest).success).toBe(true);
    expect(sessionCreateSchema.safeParse({
      ...baseRequest,
      consent: { ...baseRequest.consent, cameraRecording: true },
    }).success).toBe(false);
    expect(sessionCreateSchema.safeParse({ ...baseRequest, unexpected: true }).success).toBe(false);

    expect(canShareInterviewEvidence({
      mode: "practice",
      status: "completed",
      hasActiveShareGrant: true,
    })).toBe(false);
    expect(canShareInterviewEvidence({
      mode: "verified",
      status: "completed",
      hasActiveShareGrant: true,
    })).toBe(true);
  });

  it("bounds autosaves and browser evidence to explicit shapes", () => {
    expect(responseAutosaveSchema.safeParse({
      itemKey: "coding.arrays",
      code: "console.log('ok')",
      language: "javascript",
      isFinal: false,
    }).success).toBe(true);
    expect(responseAutosaveSchema.safeParse({
      itemKey: "coding.arrays",
      code: "x".repeat(50 * 1024 + 1),
      language: "javascript",
    }).success).toBe(false);

    expect(interviewEventSchema.safeParse({
      idempotencyKey: "event-0001",
      type: "tests_requested",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: { itemKey: "coding.arrays", scope: "public" },
    }).success).toBe(true);
    expect(interviewEventSchema.safeParse({
      idempotencyKey: "event-0002",
      type: "tests_requested",
      occurredAt: "2026-07-16T10:00:00.000Z",
      payload: { itemKey: "coding.arrays", scope: "public", deviceFingerprint: "secret" },
    }).success).toBe(false);
  });

  it("enforces session transitions and the earliest deadline", () => {
    expect(canTransitionInterviewSession("ready", "in_progress")).toBe(true);
    expect(canTransitionInterviewSession("ready", "completed")).toBe(false);
    expect(canTransitionInterviewSession("completed", "evaluating")).toBe(false);

    const start = new Date("2026-07-16T10:00:00.000Z");
    expect(calculateInterviewDeadline(start, 30).toISOString()).toBe("2026-07-16T10:30:00.000Z");
    expect(calculateInterviewDeadline(
      start,
      30,
      new Date("2026-07-16T10:12:00.000Z"),
    ).toISOString()).toBe("2026-07-16T10:12:00.000Z");
  });

  it("aggregates only valid scored evidence and reports coverage", () => {
    expect(aggregateInterviewScores([
      { score: 8, maxScore: 10, weight: 3 },
      { score: 50, maxScore: 100, weight: 1 },
      { score: null, weight: 2 },
    ])).toEqual({
      score: 72.5,
      scoredItems: 2,
      totalItems: 3,
      coveragePercent: 66.67,
    });
  });

  it("ships private practice but keeps verified mode behind every readiness gate", () => {
    const baseline = getInterviewStudioReadiness({ NODE_ENV: "production" });
    expect(baseline.practiceReady).toBe(false);
    expect(baseline.verifiedReady).toBe(false);

    const ready = getInterviewStudioReadiness({
      NODE_ENV: "production",
      INTERVIEW_STUDIO_ENABLED: "true",
      OPENAI_API_KEY: "sk-proj-abcdefghijklmnopqrstuvwxyz",
      CODE_RUNNER_URL: "https://judge.example.test",
      CODE_RUNNER_JAVASCRIPT_LANGUAGE_ID: "63",
      CODE_RUNNER_VERSION: "node20-isolated-test-v1",
      CLOUDINARY_CLOUD_NAME: "octamy",
      CLOUDINARY_API_KEY: "12345",
      CLOUDINARY_API_SECRET: "very-secret",
      INTERVIEW_HUMAN_REVIEW_ENABLED: "true",
      INTERVIEW_VERIFIED_SHARING_ENABLED: "true",
    });
    expect(ready.practiceReady).toBe(true);
    expect(ready.verifiedReady).toBe(true);
    expect(ready.issues).toEqual([]);
  });
});
