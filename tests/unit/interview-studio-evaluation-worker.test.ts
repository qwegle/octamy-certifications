import { describe, expect, it, jest } from "@jest/globals";
import {
  buildInterviewCodeEvaluation,
  buildInterviewOverallEvaluation,
  interviewCodeTestScore,
} from "../../server/lib/interview-studio-evaluation";
import {
  getInterviewStudioDailyEvaluationLimit,
  getInterviewStudioEvaluationWorkerConfig,
} from "../../server/lib/interview-studio-evaluation-worker";
import {
  evaluateInterviewCodeQuality,
  type InterviewAiClient,
} from "../../server/lib/interview-ai";
import {
  INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  type InterviewStudioBlueprint,
  type InterviewStudioCodingItem,
  type InterviewStudioTestRunResult,
} from "../../shared/interview-studio";

const codingItem: InterviewStudioCodingItem = {
  key: "coding.sum",
  title: "Add two integers",
  competency: "JavaScript correctness",
  timeLimitSeconds: 300,
  instructions: "Read stdin and print the sum.",
  kind: "coding",
  language: "javascript",
  runtime: INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  interface: "stdin_stdout",
  problemStatement: "Read two integers from standard input and print their sum.",
  starterCode: "",
  constraints: ["Inputs are integers."],
  testCases: [{
    key: "case.public",
    title: "Visible",
    visibility: "public",
    input: "1 2\n",
    expectedOutput: "3\n",
    weight: 25,
  }, {
    key: "case.hidden-edge",
    title: "Hidden edge",
    visibility: "hidden",
    input: "-4 4\n",
    expectedOutput: "0\n",
    weight: 75,
  }],
  rubric: [{
    key: "correctness",
    label: "Correctness",
    description: "Passes deterministic tests.",
    weight: 75,
  }, {
    key: "maintainability",
    label: "Maintainability",
    description: "Uses understandable production-quality code.",
    weight: 25,
  }],
};

const testResult: InterviewStudioTestRunResult = {
  runtime: INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  status: "passed",
  passedCount: 2,
  totalCount: 2,
  durationMs: 18,
  cases: [{
    testCaseKey: "case.public",
    visibility: "public",
    passed: true,
    durationMs: 8,
    actualOutput: "3\n",
  }, {
    testCaseKey: "case.hidden-edge",
    visibility: "hidden",
    passed: true,
    durationMs: 10,
  }],
  evaluatedAt: "2026-07-16T10:00:00.000Z",
  runnerVersion: "test-runner-v1",
};

const blueprint: InterviewStudioBlueprint = {
  schemaVersion: INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  templateKey: "frontend.queue",
  version: 1,
  title: "Frontend queue interview",
  summary: "A queued practical interview.",
  role: "Frontend engineer",
  level: "intermediate",
  skills: ["JavaScript"],
  allowedModes: ["practice"],
  estimatedDurationMinutes: 20,
  rubricVersion: "frontend-rubric.v1",
  items: [codingItem],
};

describe("Interview Studio evaluation queue policy", () => {
  it("has bounded, configurable worker and account limits", () => {
    expect(getInterviewStudioDailyEvaluationLimit({})).toBe(10);
    expect(getInterviewStudioDailyEvaluationLimit({ INTERVIEW_STUDIO_DAILY_EVALUATION_LIMIT: "25" })).toBe(25);
    expect(getInterviewStudioDailyEvaluationLimit({ INTERVIEW_STUDIO_DAILY_EVALUATION_LIMIT: "0" })).toBe(10);
    expect(getInterviewStudioEvaluationWorkerConfig({
      INTERVIEW_STUDIO_EVALUATION_CONCURRENCY: "999",
      INTERVIEW_STUDIO_EVALUATION_MAX_ATTEMPTS: "5",
      INTERVIEW_STUDIO_EVALUATION_LEASE_MS: "90000",
    })).toEqual(expect.objectContaining({
      concurrency: 1,
      maxAttempts: 5,
      leaseMs: 90_000,
      heartbeatMs: 30_000,
      dailyLimit: 10,
    }));
  });

  it("uses hidden tests for weighted correctness without exposing their identifiers", () => {
    expect(interviewCodeTestScore(codingItem, testResult)).toBe(100);
    const evaluation = buildInterviewCodeEvaluation(
      codingItem,
      testResult,
      new Date("2026-07-16T10:01:00.000Z"),
    );
    expect(evaluation.score).toBeNull();
    expect(evaluation.status).toBe("review_required");
    expect(evaluation.criterionScores).toHaveLength(1);
    expect(JSON.stringify(evaluation)).not.toContain("case.hidden-edge");
    expect(JSON.stringify(evaluation)).not.toContain("-4 4");
  });

  it("withholds an overall score while any rubric dimension needs review", () => {
    const evaluation = buildInterviewCodeEvaluation(codingItem, testResult);
    const overall = buildInterviewOverallEvaluation({
      blueprint,
      evaluations: [{ item: codingItem, evaluation }],
      aiRequested: true,
      aiConfigured: true,
      runnerConfigured: true,
      now: new Date("2026-07-16T10:02:00.000Z"),
    });
    expect(overall.status).toBe("review_required");
    expect(overall.score).toBeNull();
    expect(overall.humanReviewReasons).toContain(
      "At least one response remains incomplete or unreliable, so a complete score would not be defensible.",
    );
  });

  it("combines deterministic correctness with AI quality only after full rubric coverage", () => {
    const evaluation = buildInterviewCodeEvaluation(
      codingItem,
      testResult,
      new Date("2026-07-16T10:03:00.000Z"),
      {
        criterionScores: [{
          criterionKey: "maintainability",
          score: 80,
          evidence: "The solution uses clear names and a single focused parsing path.",
        }],
        strengths: ["The implementation is concise."],
        improvementAreas: [],
        followUpQuestions: [],
        humanReviewRequired: false,
        humanReviewReasons: [],
        model: "test-model",
        promptVersion: "interview-code-quality-rubric/v1",
        evaluatedAt: "2026-07-16T10:03:00.000Z",
      },
    );
    expect(evaluation.status).toBe("completed");
    expect(evaluation.score).toBe(95);
    expect(evaluation.criterionScores.map((criterion) => criterion.criterionKey).sort())
      .toEqual(["correctness", "maintainability"]);
  });

  it("sends aggregate test evidence to code-quality AI without hidden case material", async () => {
    const parse = jest.fn<InterviewAiClient["responses"]["parse"]>(async () => ({
      output_parsed: {
        criterionScores: [{
          criterionKey: "maintainability",
          score: 80,
          evidence: "The source uses clear names and a focused control flow.",
        }],
        strengths: ["The source is concise."],
        improvementAreas: [],
        followUpQuestions: [],
        humanReviewRequired: false,
        humanReviewReasons: [],
      },
    }));
    await evaluateInterviewCodeQuality({
      blueprint,
      item: codingItem,
      sourceCode: "const [a,b] = require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number); console.log(a+b);",
      deterministicEvidence: { status: "passed", passedCount: 2, totalCount: 2 },
      client: { responses: { parse } },
      env: {},
    });
    const request = parse.mock.calls[0][0] as { input?: Array<{ content?: Array<{ text?: string }> }> };
    const serialized = request.input?.[0]?.content?.[0]?.text ?? "";
    expect(serialized).toContain('"passedCount":2');
    expect(serialized).not.toContain("case.hidden-edge");
    expect(serialized).not.toContain("-4 4");
    expect(serialized).not.toContain('"expectedOutput"');
  });

  it("finishes private saved-answer practice honestly when AI was declined", () => {
    const deterministic = buildInterviewCodeEvaluation(codingItem, testResult);
    const overall = buildInterviewOverallEvaluation({
      blueprint,
      evaluations: [{ item: codingItem, evaluation: { ...deterministic, status: "not_requested" } }],
      aiRequested: false,
      aiConfigured: false,
      runnerConfigured: true,
      now: new Date("2026-07-16T10:04:00.000Z"),
    });
    expect(overall.status).toBe("not_requested");
    expect(overall.score).toBeNull();
    expect(overall.humanReviewReasons).toEqual([]);
  });
});
