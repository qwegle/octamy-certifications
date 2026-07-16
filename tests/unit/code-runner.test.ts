import { describe, expect, it, jest } from "@jest/globals";
import {
  CODE_RUNNER_SOURCE_MAX_BYTES,
  getCodeRunnerConfig,
  isCodeRunnerEnabled,
  normalizeProgramOutput,
  runInterviewCode,
} from "../../server/lib/code-runner";
import {
  INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  sanitizeInterviewStudioTestRunForClient,
  type InterviewStudioCodingItem,
} from "../../shared/interview-studio";

const item: InterviewStudioCodingItem = {
  key: "coding.sum",
  title: "Add two integers",
  competency: "JavaScript reasoning",
  timeLimitSeconds: 300,
  instructions: "Read two integers from standard input and print their sum.",
  kind: "coding",
  language: "javascript",
  runtime: INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  interface: "stdin_stdout",
  problemStatement: "Read exactly two integers and print their arithmetic sum.",
  starterCode: "const fs = require('fs');",
  constraints: ["Inputs are safe integers."],
  testCases: [{
    key: "case.visible",
    title: "Positive integers",
    visibility: "public",
    input: "2 3\n",
    expectedOutput: "5\n",
    weight: 40,
  }, {
    key: "case.hidden",
    title: "Negative integers",
    visibility: "hidden",
    input: "-7 2\n",
    expectedOutput: "-5\n",
    weight: 60,
  }],
  rubric: [{
    key: "correctness",
    label: "Correctness",
    description: "Produces the correct output for all valid inputs.",
    weight: 100,
  }],
};

const runnerEnv = {
  NODE_ENV: "production",
  CODE_RUNNER_URL: "https://judge.example.test/api",
  CODE_RUNNER_TOKEN: "server-token",
  CODE_RUNNER_TOKEN_HEADER: "X-Auth-Token",
  CODE_RUNNER_JAVASCRIPT_LANGUAGE_ID: "63",
  CODE_RUNNER_VERSION: "node20-isolated-test-v1",
} as NodeJS.ProcessEnv;

function judgeResponse(stdout: string, statusId = 3, description = "Accepted") {
  return new Response(JSON.stringify({
    stdout,
    stderr: null,
    compile_output: null,
    time: "0.012",
    status: { id: statusId, description },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("isolated Interview Studio code runner", () => {
  it("requires HTTPS except localhost in non-production", () => {
    expect(isCodeRunnerEnabled({})).toBe(false);
    expect(getCodeRunnerConfig({ NODE_ENV: "production", CODE_RUNNER_URL: "http://judge.example.test" }))
      .toEqual({ enabled: false, reason: "insecure_url" });
    expect(isCodeRunnerEnabled({
      NODE_ENV: "development",
      CODE_RUNNER_URL: "http://localhost:2358",
      CODE_RUNNER_JAVASCRIPT_LANGUAGE_ID: "63",
      CODE_RUNNER_VERSION: "node20-isolated-test-v1",
    })).toBe(true);
    expect(isCodeRunnerEnabled({ NODE_ENV: "production", CODE_RUNNER_URL: "http://localhost:2358" })).toBe(false);
    expect(getCodeRunnerConfig({ NODE_ENV: "production", CODE_RUNNER_URL: "https://judge.example.test" }))
      .toEqual({ enabled: false, reason: "runtime_unverified" });
  });

  it("normalizes deterministic stdout without weakening internal whitespace", () => {
    expect(normalizeProgramOutput("5  \r\n\r\n")).toBe("5");
    expect(normalizeProgramOutput("a  b\n")).toBe("a  b");
  });

  it("runs exactly one isolated submission per selected case and never sends expected output", async () => {
    const fetchImpl = jest.fn<typeof fetch>(async (_url, request) => {
      const body = JSON.parse(String(request?.body));
      expect(body.expected_output).toBeUndefined();
      expect(body.enable_network).toBe(false);
      expect(body.source_code).toContain("console.log");
      expect(request?.headers).toEqual(expect.objectContaining({ "X-Auth-Token": "server-token" }));
      return judgeResponse(body.stdin.trim() === "2 3" ? "5\r\n" : "-5\n");
    });

    const publicResult = await runInterviewCode({
      sourceCode: "console.log('candidate program')",
      item,
      scope: "public",
      fetchImpl,
      env: runnerEnv,
      now: () => new Date("2026-07-16T10:00:00.000Z"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(publicResult.status).toBe("passed");
    expect(publicResult.cases[0].actualOutput).toBe("5\r\n");

    fetchImpl.mockClear();
    const allResult = await runInterviewCode({
      sourceCode: "console.log('candidate program')",
      item,
      scope: "all",
      fetchImpl,
      env: runnerEnv,
      now: () => new Date("2026-07-16T10:00:00.000Z"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(allResult).toEqual(expect.objectContaining({ status: "passed", passedCount: 2, totalCount: 2 }));
    expect(allResult.cases.find((testCase) => testCase.visibility === "hidden")?.actualOutput).toBeUndefined();
    const client = sanitizeInterviewStudioTestRunForClient(allResult);
    expect(client.cases).toHaveLength(1);
    expect(client.hidden).toEqual({ passedCount: 1, totalCount: 1 });
    expect(JSON.stringify(client)).not.toContain("case.hidden");
  });

  it("returns an honest unavailable result without invoking a provider", async () => {
    const fetchImpl = jest.fn<typeof fetch>();
    const result = await runInterviewCode({
      sourceCode: "console.log(5)",
      item,
      scope: "public",
      fetchImpl,
      env: {},
      now: () => new Date("2026-07-16T10:00:00.000Z"),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.status).toBe("runner_unavailable");
    expect(result.cases[0].errorCode).toBe("runner_unavailable");
  });

  it("maps compile errors and mismatched output without returning provider diagnostics", async () => {
    const compile = await runInterviewCode({
      sourceCode: "broken code",
      item,
      scope: "public",
      env: runnerEnv,
      fetchImpl: async () => judgeResponse("", 6, "Compilation Error"),
    });
    expect(compile.status).toBe("compile_error");
    expect(compile.cases[0]).toEqual(expect.objectContaining({ passed: false, errorCode: "compile_error" }));
    expect(JSON.stringify(compile)).not.toMatch(/stderr|compile_output/i);

    const mismatch = await runInterviewCode({
      sourceCode: "console.log(99)",
      item,
      scope: "public",
      env: runnerEnv,
      fetchImpl: async () => judgeResponse("99\n"),
    });
    expect(mismatch.status).toBe("failed");
    expect(mismatch.cases[0]).toEqual(expect.objectContaining({ passed: false, actualOutput: "99\n" }));
  });

  it("rejects oversized source before any provider call", async () => {
    const fetchImpl = jest.fn<typeof fetch>();
    await expect(runInterviewCode({
      sourceCode: "x".repeat(CODE_RUNNER_SOURCE_MAX_BYTES + 1),
      item,
      scope: "public",
      fetchImpl,
      env: runnerEnv,
    })).rejects.toMatchObject({ code: "CODE_SOURCE_TOO_LARGE", status: 413 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
