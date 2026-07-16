import { z } from "zod";
import {
  INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  interviewStudioCodingItemSchema,
  interviewStudioTestRunResultSchema,
  type InterviewStudioCodingItem,
  type InterviewStudioTestRunResult,
} from "../../shared/interview-studio";

export const CODE_RUNNER_SOURCE_MAX_BYTES = 50 * 1024;
export const CODE_RUNNER_TEST_CASE_LIMIT = 20;
export const CODE_RUNNER_OUTPUT_MAX_BYTES = 16 * 1024;
export const CODE_RUNNER_DEFAULT_JAVASCRIPT_LANGUAGE_ID = 63;

const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const DEFAULT_CPU_TIME_SECONDS = 2;
const DEFAULT_WALL_TIME_SECONDS = 5;
const DEFAULT_MEMORY_KB = 128 * 1024;
const PROVIDER_RESPONSE_MAX_BYTES = 256 * 1024;

type FetchLike = typeof globalThis.fetch;

export type CodeRunnerDisabledReason =
  | "missing_url"
  | "invalid_url"
  | "insecure_url"
  | "url_credentials_forbidden"
  | "runtime_unverified";

export type CodeRunnerConfig =
  | { enabled: false; reason: CodeRunnerDisabledReason }
  | {
    enabled: true;
    submissionUrl: string;
    languageId: number;
    requestTimeoutMs: number;
    cpuTimeSeconds: number;
    wallTimeSeconds: number;
    memoryKb: number;
    runnerVersion: string;
    headers: Readonly<Record<string, string>>;
  };

function boundedNumber(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function isLocalHostname(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
}

function safeHeaderName(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() || fallback;
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(candidate)) return fallback;
  if (["content-length", "content-type", "host", "connection"].includes(candidate.toLowerCase())) return fallback;
  return candidate;
}

export function getCodeRunnerConfig(env: NodeJS.ProcessEnv = process.env): CodeRunnerConfig {
  const configuredUrl = env.CODE_RUNNER_URL?.trim();
  if (!configuredUrl) return { enabled: false, reason: "missing_url" };

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    return { enabled: false, reason: "invalid_url" };
  }
  if (url.username || url.password) return { enabled: false, reason: "url_credentials_forbidden" };
  const localHttpAllowed = env.NODE_ENV !== "production"
    && url.protocol === "http:"
    && isLocalHostname(url.hostname);
  if (url.protocol !== "https:" && !localHttpAllowed) {
    return { enabled: false, reason: "insecure_url" };
  }
  const languageId = Number(env.CODE_RUNNER_JAVASCRIPT_LANGUAGE_ID);
  const runnerVersion = env.CODE_RUNNER_VERSION?.trim().slice(0, 200);
  if (!Number.isInteger(languageId) || languageId < 1 || languageId > 10_000 || !runnerVersion) {
    return { enabled: false, reason: "runtime_unverified" };
  }

  url.hash = "";
  if (!url.pathname.replace(/\/$/, "").endsWith("/submissions")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/submissions`;
  }
  url.searchParams.set("base64_encoded", "false");
  url.searchParams.set("wait", "true");

  const headers: Record<string, string> = {};
  const token = env.CODE_RUNNER_TOKEN?.trim();
  if (token) headers[safeHeaderName(env.CODE_RUNNER_TOKEN_HEADER, "X-Auth-Token")] = token;
  const userToken = env.CODE_RUNNER_USER_TOKEN?.trim();
  if (userToken) headers[safeHeaderName(env.CODE_RUNNER_USER_TOKEN_HEADER, "X-Auth-User")] = userToken;
  const bearerToken = env.CODE_RUNNER_BEARER_TOKEN?.trim();
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  return {
    enabled: true,
    submissionUrl: url.toString(),
    languageId,
    requestTimeoutMs: Math.trunc(boundedNumber(
      env.CODE_RUNNER_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
      1_000,
      20_000,
    )),
    cpuTimeSeconds: boundedNumber(env.CODE_RUNNER_CPU_TIME_SECONDS, DEFAULT_CPU_TIME_SECONDS, 1, 5),
    wallTimeSeconds: boundedNumber(env.CODE_RUNNER_WALL_TIME_SECONDS, DEFAULT_WALL_TIME_SECONDS, 1, 10),
    memoryKb: Math.trunc(boundedNumber(env.CODE_RUNNER_MEMORY_KB, DEFAULT_MEMORY_KB, 32 * 1024, 256 * 1024)),
    runnerVersion,
    headers,
  };
}

export function isCodeRunnerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return getCodeRunnerConfig(env).enabled;
}

const judgeResponseSchema = z.object({
  stdout: z.string().max(100_000).nullable().optional(),
  stderr: z.string().max(100_000).nullable().optional(),
  compile_output: z.string().max(100_000).nullable().optional(),
  message: z.string().max(10_000).nullable().optional(),
  time: z.union([z.string(), z.number()]).nullable().optional(),
  status: z.object({
    id: z.number().int(),
    description: z.string().max(200),
  }).strict(),
}).passthrough();

export function normalizeProgramOutput(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

function limitOutput(value: string): { output: string; truncated: boolean } {
  if (Buffer.byteLength(value, "utf8") <= CODE_RUNNER_OUTPUT_MAX_BYTES) {
    return { output: value, truncated: false };
  }
  let end = Math.min(value.length, CODE_RUNNER_OUTPUT_MAX_BYTES);
  while (end > 0 && Buffer.byteLength(value.slice(0, end), "utf8") > CODE_RUNNER_OUTPUT_MAX_BYTES) end -= 1;
  return { output: value.slice(0, end), truncated: true };
}

async function readBoundedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > PROVIDER_RESPONSE_MAX_BYTES) {
    throw new Error("ProviderResponseTooLarge");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > PROVIDER_RESPONSE_MAX_BYTES) {
      await reader.cancel();
      throw new Error("ProviderResponseTooLarge");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function elapsedMilliseconds(time: string | number | null | undefined, fallback: number): number {
  const seconds = Number(time);
  if (!Number.isFinite(seconds) || seconds < 0) return Math.max(0, Math.min(120_000, fallback));
  return Math.max(0, Math.min(120_000, Math.round(seconds * 1_000)));
}

function resultStatusFromJudge(statusId: number): "ok" | "compile_error" | "runtime_error" | "timed_out" {
  if (statusId === 3) return "ok";
  if (statusId === 5) return "timed_out";
  if (statusId === 6) return "compile_error";
  return "runtime_error";
}

async function runOneCase(input: {
  sourceCode: string;
  testCase: InterviewStudioCodingItem["testCases"][number];
  config: Extract<CodeRunnerConfig, { enabled: true }>;
  fetchImpl: FetchLike;
  signal?: AbortSignal;
}): Promise<{
  passed: boolean;
  durationMs: number;
  actualOutput?: string;
  errorCode?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.requestTimeoutMs);
  const abortFromCaller = () => controller.abort();
  if (input.signal?.aborted) controller.abort();
  else input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const startedAt = Date.now();
  try {
    const response = await input.fetchImpl(input.config.submissionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...input.config.headers,
      },
      signal: controller.signal,
      body: JSON.stringify({
        source_code: input.sourceCode,
        language_id: input.config.languageId,
        stdin: input.testCase.input,
        cpu_time_limit: input.config.cpuTimeSeconds,
        wall_time_limit: input.config.wallTimeSeconds,
        memory_limit: input.config.memoryKb,
        max_file_size: 1_024,
        enable_network: false,
      }),
    });
    if (!response.ok) throw new Error(`ProviderHttp${response.status}`);
    const raw = await readBoundedText(response);
    const provider = judgeResponseSchema.parse(JSON.parse(raw));
    const judgeStatus = resultStatusFromJudge(provider.status.id);
    const durationMs = elapsedMilliseconds(provider.time, Date.now() - startedAt);
    if (judgeStatus !== "ok") {
      return { passed: false, durationMs, errorCode: judgeStatus };
    }
    const limited = limitOutput(provider.stdout ?? "");
    const passed = !limited.truncated
      && normalizeProgramOutput(limited.output) === normalizeProgramOutput(input.testCase.expectedOutput);
    return {
      passed,
      durationMs,
      ...(input.testCase.visibility === "public" ? { actualOutput: limited.output } : {}),
      ...(limited.truncated ? { errorCode: "output_limit_exceeded" } : {}),
    };
  } catch (error) {
    const timedOut = controller.signal.aborted && !input.signal?.aborted;
    return {
      passed: false,
      durationMs: Math.max(0, Math.min(120_000, Date.now() - startedAt)),
      errorCode: timedOut ? "timed_out" : "runner_unavailable",
    };
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function unavailableResult(
  item: InterviewStudioCodingItem,
  testCases: InterviewStudioCodingItem["testCases"],
  now: Date,
  runnerVersion = "unconfigured",
): InterviewStudioTestRunResult {
  return interviewStudioTestRunResultSchema.parse({
    runtime: item.runtime,
    status: "runner_unavailable",
    passedCount: 0,
    totalCount: testCases.length,
    durationMs: 0,
    cases: testCases.map((testCase) => ({
      testCaseKey: testCase.key,
      visibility: testCase.visibility,
      passed: false,
      durationMs: 0,
      errorCode: "runner_unavailable",
    })),
    evaluatedAt: now.toISOString(),
    runnerVersion,
  });
}

export async function runInterviewCode(input: {
  sourceCode: string;
  item: InterviewStudioCodingItem;
  scope: "public" | "all";
  fetchImpl?: FetchLike;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  signal?: AbortSignal;
}): Promise<InterviewStudioTestRunResult> {
  const item = interviewStudioCodingItemSchema.parse(input.item);
  if (Buffer.byteLength(input.sourceCode, "utf8") > CODE_RUNNER_SOURCE_MAX_BYTES) {
    throw Object.assign(new Error("Source code must not exceed 50 KB"), {
      code: "CODE_SOURCE_TOO_LARGE",
      status: 413,
    });
  }
  const tests = item.testCases.filter((testCase) => input.scope === "all" || testCase.visibility === "public");
  if (tests.length === 0 || tests.length > CODE_RUNNER_TEST_CASE_LIMIT) {
    throw Object.assign(new Error(`A run must contain between 1 and ${CODE_RUNNER_TEST_CASE_LIMIT} test cases`), {
      code: "CODE_TEST_LIMIT_INVALID",
      status: 422,
    });
  }
  if (tests.some((testCase) => Buffer.byteLength(testCase.input, "utf8") > 20_000
    || Buffer.byteLength(testCase.expectedOutput, "utf8") > 10_000)) {
    throw Object.assign(new Error("A coding test exceeds the execution input or output limit"), {
      code: "CODE_TEST_CASE_TOO_LARGE",
      status: 422,
    });
  }

  const now = input.now ?? (() => new Date());
  const config = getCodeRunnerConfig(input.env);
  if (!config.enabled) return unavailableResult(item, tests, now());
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const startedAt = Date.now();
  const cases = new Array<InterviewStudioTestRunResult["cases"][number]>(tests.length);

  // Deliberately one isolated provider submission per case. A four-request
  // worker pool avoids unbounded fan-out while keeping a 20-case task within a
  // practical background-job window. Hidden inputs are never concatenated
  // into source code or returned in client-facing results.
  let nextIndex = 0;
  const executeNext = async (): Promise<void> => {
    while (nextIndex < tests.length) {
      const index = nextIndex;
      nextIndex += 1;
      const testCase = tests[index];
      const result = await runOneCase({
        sourceCode: input.sourceCode,
        testCase,
        config,
        fetchImpl,
        signal: input.signal,
      });
      cases[index] = {
        testCaseKey: testCase.key,
        visibility: testCase.visibility,
        passed: result.passed,
        durationMs: result.durationMs,
        ...(result.actualOutput !== undefined ? { actualOutput: result.actualOutput } : {}),
        ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      };
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, tests.length) }, () => executeNext()));

  const errorCodes = new Set(cases.map((testCase) => testCase.errorCode).filter(Boolean));
  const status = errorCodes.has("runner_unavailable")
    ? "runner_unavailable"
    : errorCodes.has("compile_error")
      ? "compile_error"
      : errorCodes.has("timed_out")
        ? "timed_out"
        : errorCodes.has("runtime_error")
          ? "runtime_error"
          : cases.every((testCase) => testCase.passed)
            ? "passed"
            : "failed";

  return interviewStudioTestRunResultSchema.parse({
    runtime: INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
    status,
    passedCount: cases.filter((testCase) => testCase.passed).length,
    totalCount: cases.length,
    durationMs: Math.max(0, Math.min(600_000, Date.now() - startedAt)),
    cases,
    evaluatedAt: now().toISOString(),
    runnerVersion: config.runnerVersion,
  });
}
