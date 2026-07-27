import { z } from "zod";

/**
 * Shared, provider-neutral contract for Interview Studio.
 *
 * A blueprint is copied into every session. That immutable snapshot is the
 * evidence contract used for timing, grading, and later audit; a published
 * template must be versioned instead of edited in place.
 */
export const INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION = "interview-studio-blueprint/v1" as const;
export const INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME = "javascript-node20-stdin-stdout-v1" as const;

export const interviewStudioModeSchema = z.enum(["practice", "verified"]);
export const interviewStudioOwnerTypeSchema = z.enum(["admin", "creator", "institute"]);
export const interviewStudioTemplateStateSchema = z.enum(["draft", "published", "retired"]);
export const interviewStudioSessionStatusSchema = z.enum([
  "ready",
  "in_progress",
  "evaluating",
  "completed",
  "review_required",
  "expired",
  "cancelled",
]);
export const interviewStudioEvaluationStatusSchema = z.enum([
  "not_requested",
  "pending",
  "in_progress",
  "completed",
  "failed",
  "review_required",
]);

const snapshotTimestampSchema = z.string().datetime({ offset: true });
const stableKeySchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use a stable lowercase key");
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, "Expected a lowercase SHA-256 digest");

export const interviewStudioRubricCriterionSchema = z.object({
  key: stableKeySchema,
  label: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(1_000),
  weight: z.number().int().min(1).max(100),
}).strict();

const interviewStudioItemBaseSchema = z.object({
  key: stableKeySchema,
  title: z.string().trim().min(3).max(160),
  competency: z.string().trim().min(2).max(120),
  timeLimitSeconds: z.number().int().min(30).max(7_200),
  instructions: z.string().trim().min(10).max(8_000),
});

export const interviewStudioStructuredResponseItemSchema = interviewStudioItemBaseSchema.extend({
  kind: z.literal("structured_response"),
  prompt: z.string().trim().min(10).max(8_000),
  responseFormat: z.enum(["text", "text_or_transient_voice"]),
  minimumWords: z.number().int().min(0).max(2_000).default(0),
  maximumWords: z.number().int().min(20).max(4_000),
  rubric: z.array(interviewStudioRubricCriterionSchema).min(1).max(12),
}).strict().superRefine((item, context) => {
  if (item.minimumWords > item.maximumWords) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["minimumWords"],
      message: "minimumWords cannot exceed maximumWords",
    });
  }
});

export const interviewStudioTestCaseSchema = z.object({
  key: stableKeySchema,
  title: z.string().trim().min(2).max(120),
  visibility: z.enum(["public", "hidden"]),
  input: z.string().max(100_000),
  expectedOutput: z.string().max(100_000),
  weight: z.number().int().min(1).max(100),
}).strict();

export const interviewStudioCodingItemSchema = interviewStudioItemBaseSchema.extend({
  kind: z.literal("coding"),
  language: z.literal("javascript"),
  runtime: z.literal(INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME),
  interface: z.literal("stdin_stdout"),
  problemStatement: z.string().trim().min(20).max(20_000),
  starterCode: z.string().max(100_000),
  constraints: z.array(z.string().trim().min(1).max(500)).max(30),
  // The isolated runner enforces the same ceiling, so every schema-valid
  // published task is executable rather than failing only at submission.
  testCases: z.array(interviewStudioTestCaseSchema).min(2).max(20),
  rubric: z.array(interviewStudioRubricCriterionSchema).min(1).max(12),
}).strict().superRefine((item, context) => {
  const keys = new Set<string>();
  let publicCount = 0;
  let hiddenCount = 0;
  item.testCases.forEach((testCase, index) => {
    if (keys.has(testCase.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["testCases", index, "key"],
        message: "Test case keys must be unique within an item",
      });
    }
    keys.add(testCase.key);
    publicCount += testCase.visibility === "public" ? 1 : 0;
    hiddenCount += testCase.visibility === "hidden" ? 1 : 0;
  });
  if (publicCount === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["testCases"], message: "At least one public test is required" });
  }
  if (hiddenCount === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["testCases"], message: "At least one hidden test is required" });
  }
});

export const interviewStudioBlueprintItemSchema = z.union([
  interviewStudioStructuredResponseItemSchema,
  interviewStudioCodingItemSchema,
]);

export const interviewStudioBlueprintSchema = z.object({
  schemaVersion: z.literal(INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION),
  templateKey: stableKeySchema,
  version: z.number().int().positive(),
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(10).max(2_000),
  role: z.string().trim().min(2).max(160),
  level: z.enum(["foundation", "intermediate", "advanced"]),
  skills: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  allowedModes: z.array(interviewStudioModeSchema).min(1).max(2),
  estimatedDurationMinutes: z.number().int().min(1).max(240),
  rubricVersion: stableKeySchema,
  // Keep one interview bounded for predictable cost, recovery and reviewer
  // attention. Additional rounds should be separate versioned sessions.
  items: z.array(interviewStudioBlueprintItemSchema).min(1).max(12),
}).strict().superRefine((blueprint, context) => {
  if (new Set(blueprint.allowedModes).size !== blueprint.allowedModes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["allowedModes"], message: "Modes must be unique" });
  }
  const itemKeys = new Set<string>();
  blueprint.items.forEach((item, index) => {
    if (itemKeys.has(item.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "key"],
        message: "Item keys must be unique within a blueprint",
      });
    }
    itemKeys.add(item.key);
  });
});

export const interviewStudioConsentSnapshotSchema = z.object({
  policyVersion: stableKeySchema,
  acknowledgedAt: snapshotTimestampSchema,
  aiEvaluation: z.boolean(),
  microphoneTranscription: z.boolean(),
  cameraRecording: z.boolean(),
  screenRecording: z.boolean(),
  recruiterSharing: z.boolean(),
}).strict();

export const interviewStudioPermissionStateSchema = z.enum([
  "not_requested",
  "granted",
  "denied",
  "unavailable",
]);

const interviewStudioDevicePermissionSchema = z.object({
  required: z.boolean(),
  state: interviewStudioPermissionStateSchema,
}).strict();

export const interviewStudioPermissionSnapshotSchema = z.object({
  capturedAt: snapshotTimestampSchema,
  camera: interviewStudioDevicePermissionSchema,
  microphone: interviewStudioDevicePermissionSchema,
  screen: interviewStudioDevicePermissionSchema,
}).strict();

export const interviewStudioPrivateArtifactManifestSchema = z.object({
  provider: z.enum(["cloudinary_authenticated", "s3_private", "local_private"]),
  objectKey: z.string().trim().min(3).max(1_000)
    .refine((value) => !/^[a-z][a-z0-9+.-]*:\/\//i.test(value), "A private object key, not a URL, is required"),
  resourceType: z.enum(["video", "audio"]),
  access: z.literal("private"),
  etag: z.string().trim().min(1).max(500).optional(),
  providerVersion: z.string().trim().min(1).max(200).optional(),
  encryptionKeyReference: z.string().trim().min(1).max(500).optional(),
}).strict();

export const interviewStudioTestCaseResultSchema = z.object({
  testCaseKey: stableKeySchema,
  visibility: z.enum(["public", "hidden"]),
  passed: z.boolean(),
  durationMs: z.number().int().nonnegative().max(120_000),
  actualOutput: z.string().max(100_000).optional(),
  errorCode: z.string().trim().min(1).max(120).optional(),
}).strict();

export const interviewStudioTestRunResultSchema = z.object({
  runtime: z.literal(INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME),
  status: z.enum(["passed", "failed", "compile_error", "runtime_error", "timed_out", "runner_unavailable"]),
  passedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().max(600_000),
  cases: z.array(interviewStudioTestCaseResultSchema).max(100),
  evaluatedAt: snapshotTimestampSchema,
  runnerVersion: z.string().trim().min(1).max(200),
}).strict().superRefine((result, context) => {
  if (result.passedCount > result.totalCount || result.cases.length > result.totalCount) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Test result counts are inconsistent" });
  }
});

export const interviewStudioItemEvaluationSchema = z.object({
  rubricVersion: stableKeySchema,
  status: interviewStudioEvaluationStatusSchema,
  score: z.number().int().min(0).max(100).nullable(),
  criterionScores: z.array(z.object({
    criterionKey: stableKeySchema,
    score: z.number().int().min(0).max(100),
    evidence: z.string().trim().min(1).max(2_000),
  }).strict()).max(20),
  strengths: z.array(z.string().trim().min(1).max(1_000)).max(20),
  improvementAreas: z.array(z.string().trim().min(1).max(1_000)).max(20),
  followUpQuestions: z.array(z.string().trim().min(1).max(1_000)).max(10),
  model: z.string().trim().min(1).max(200).nullable(),
  promptVersion: z.string().trim().min(1).max(200).nullable(),
  evaluatedAt: snapshotTimestampSchema.nullable(),
}).strict();

export const interviewStudioOverallEvaluationSchema = z.object({
  rubricVersion: stableKeySchema,
  score: z.number().int().min(0).max(100).nullable(),
  status: interviewStudioEvaluationStatusSchema,
  competencyEvidence: z.array(z.object({
    competency: z.string().trim().min(1).max(160),
    score: z.number().int().min(0).max(100).nullable(),
    evidence: z.array(z.string().trim().min(1).max(1_000)).max(20),
  }).strict()).max(30),
  summary: z.string().trim().min(1).max(4_000).nullable(),
  strengths: z.array(z.string().trim().min(1).max(1_000)).max(20),
  improvementAreas: z.array(z.string().trim().min(1).max(1_000)).max(20),
  humanReviewReasons: z.array(z.string().trim().min(1).max(1_000)).max(20),
  model: z.string().trim().min(1).max(200).nullable(),
  promptVersion: z.string().trim().min(1).max(200).nullable(),
  evaluatedAt: snapshotTimestampSchema.nullable(),
}).strict();

export const createInterviewStudioSessionRequestSchema = z.object({
  templateKey: stableKeySchema,
  mode: interviewStudioModeSchema,
  consent: interviewStudioConsentSnapshotSchema,
  permissions: interviewStudioPermissionSnapshotSchema,
}).strict().superRefine((request, context) => {
  if (request.mode === "practice") {
    if (request.consent.cameraRecording || request.consent.screenRecording || request.consent.recruiterSharing) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["consent"],
        message: "Practice sessions cannot retain camera/screen media or enable recruiter sharing",
      });
    }
  }
});

export const saveInterviewStudioResponseRequestSchema = z.object({
  itemKey: stableKeySchema,
  answerText: z.string().max(100_000).nullable().optional(),
  code: z.string().max(200_000).nullable().optional(),
  language: z.literal("javascript").nullable().optional(),
  isFinal: z.boolean().default(false),
}).strict().superRefine((response, context) => {
  if (!response.answerText?.trim() && !response.code?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A text or code response is required" });
  }
  if (response.code && response.language !== "javascript") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["language"], message: "JavaScript code must declare its language" });
  }
});

export const interviewStudioEventInputSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  type: z.enum([
    "session_started",
    "session_submitted",
    "permission_changed",
    "recording_started",
    "recording_stopped",
    "screen_share_ended",
    "focus_left",
    "focus_returned",
    "network_offline",
    "network_online",
    "response_saved",
    "tests_requested",
  ]),
  occurredAt: snapshotTimestampSchema,
  payload: z.record(z.unknown()).default({}),
}).strict();

export const createInterviewStudioShareGrantRequestSchema = z.object({
  recruiterId: z.number().int().positive(),
  expiresAt: snapshotTimestampSchema,
  scopes: z.array(z.enum(["summary", "responses", "code", "artifacts"])).min(1).max(4),
}).strict();

const publicInterviewStudioTestCaseSchema = interviewStudioTestCaseSchema.extend({
  visibility: z.literal("public"),
});

export type InterviewStudioBlueprint = z.infer<typeof interviewStudioBlueprintSchema>;
export type InterviewStudioBlueprintItem = z.infer<typeof interviewStudioBlueprintItemSchema>;
export type InterviewStudioCodingItem = z.infer<typeof interviewStudioCodingItemSchema>;
export type InterviewStudioTestCase = z.infer<typeof interviewStudioTestCaseSchema>;
export type InterviewStudioMode = z.infer<typeof interviewStudioModeSchema>;
export type InterviewStudioOwnerType = z.infer<typeof interviewStudioOwnerTypeSchema>;
export type InterviewStudioTemplateState = z.infer<typeof interviewStudioTemplateStateSchema>;
export type InterviewStudioSessionStatus = z.infer<typeof interviewStudioSessionStatusSchema>;

/** Candidate-facing prompt fields. Evaluation criteria and test weights are intentionally absent. */
const interviewStudioCandidateItemBaseSchema = z.object({
  key: stableKeySchema,
  title: z.string().trim().min(3).max(160),
  competency: z.string().trim().min(2).max(120),
  timeLimitSeconds: z.number().int().min(30).max(7_200),
  instructions: z.string().trim().min(10).max(8_000),
});

export const interviewStudioCandidateStructuredItemSchema = interviewStudioCandidateItemBaseSchema.extend({
  kind: z.literal("structured_response"),
  prompt: z.string().trim().min(10).max(8_000),
  responseFormat: z.enum(["text", "text_or_transient_voice"]),
  minimumWords: z.number().int().min(0).max(2_000),
  maximumWords: z.number().int().min(20).max(4_000),
}).strict();

export const interviewStudioCandidatePublicTestCaseSchema = z.object({
  key: stableKeySchema,
  title: z.string().trim().min(2).max(120),
  visibility: z.literal("public"),
  input: z.string().max(100_000),
  expectedOutput: z.string().max(100_000),
}).strict();

export const interviewStudioCandidateCodingItemSchema = interviewStudioCandidateItemBaseSchema.extend({
  kind: z.literal("coding"),
  language: z.literal("javascript"),
  runtime: z.literal(INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME),
  interface: z.literal("stdin_stdout"),
  problemStatement: z.string().trim().min(20).max(20_000),
  starterCode: z.string().max(100_000),
  constraints: z.array(z.string().trim().min(1).max(500)).max(30),
  testCases: z.array(interviewStudioCandidatePublicTestCaseSchema).max(20),
}).strict();

export const interviewStudioCandidateItemSchema = z.discriminatedUnion("kind", [
  interviewStudioCandidateStructuredItemSchema,
  interviewStudioCandidateCodingItemSchema,
]);

export type InterviewStudioCandidateItem = z.infer<typeof interviewStudioCandidateItemSchema>;

/**
 * Builds one candidate-visible item by allowlist. Rubrics, hidden cases, case
 * weights, evaluator metadata, and every sibling prompt remain server-side.
 */
export function sanitizeInterviewStudioItemForCandidate(input: unknown): InterviewStudioCandidateItem {
  const item = interviewStudioBlueprintItemSchema.parse(input);
  const base = {
    key: item.key,
    title: item.title,
    competency: item.competency,
    timeLimitSeconds: item.timeLimitSeconds,
    instructions: item.instructions,
  };
  if (item.kind === "structured_response") {
    return interviewStudioCandidateStructuredItemSchema.parse({
      ...base,
      kind: item.kind,
      prompt: item.prompt,
      responseFormat: item.responseFormat,
      minimumWords: item.minimumWords,
      maximumWords: item.maximumWords,
    });
  }
  return interviewStudioCandidateCodingItemSchema.parse({
    ...base,
    kind: item.kind,
    language: item.language,
    runtime: item.runtime,
    interface: item.interface,
    problemStatement: item.problemStatement,
    starterCode: item.starterCode,
    constraints: item.constraints,
    testCases: item.testCases
      .filter((testCase) => testCase.visibility === "public")
      .map(({ key, title, visibility, input, expectedOutput }) => ({ key, title, visibility, input, expectedOutput })),
  });
}
export type InterviewStudioEvaluationStatus = z.infer<typeof interviewStudioEvaluationStatusSchema>;
export type InterviewStudioConsentSnapshot = z.infer<typeof interviewStudioConsentSnapshotSchema>;
export type InterviewStudioPermissionSnapshot = z.infer<typeof interviewStudioPermissionSnapshotSchema>;
export type InterviewStudioPrivateArtifactManifest = z.infer<typeof interviewStudioPrivateArtifactManifestSchema>;
export type InterviewStudioTestRunResult = z.infer<typeof interviewStudioTestRunResultSchema>;
export type InterviewStudioItemEvaluation = z.infer<typeof interviewStudioItemEvaluationSchema>;
export type InterviewStudioOverallEvaluation = z.infer<typeof interviewStudioOverallEvaluationSchema>;
export type CreateInterviewStudioSessionRequest = z.infer<typeof createInterviewStudioSessionRequestSchema>;
export type SaveInterviewStudioResponseRequest = z.infer<typeof saveInterviewStudioResponseRequestSchema>;
export type InterviewStudioEventInput = z.infer<typeof interviewStudioEventInputSchema>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Canonical input for the server-side SHA-256 blueprint evidence hash. */
export function canonicalizeInterviewStudioBlueprint(input: unknown): string {
  return stableJson(interviewStudioBlueprintSchema.parse(input));
}

export type ClientInterviewStudioCodingItem = Omit<InterviewStudioCodingItem, "testCases"> & {
  testCases: Array<z.infer<typeof publicInterviewStudioTestCaseSchema>>;
  testCaseSummary: { publicCount: number; hiddenCount: number; totalCount: number };
};

export type ClientInterviewStudioBlueprint = Omit<InterviewStudioBlueprint, "items"> & {
  items: Array<Exclude<InterviewStudioBlueprintItem, InterviewStudioCodingItem> | ClientInterviewStudioCodingItem>;
};

/** Removes hidden inputs and expected outputs before a blueprint reaches a browser. */
export function sanitizeInterviewStudioBlueprintForClient(input: unknown): ClientInterviewStudioBlueprint {
  const blueprint = interviewStudioBlueprintSchema.parse(input);
  return {
    ...blueprint,
    items: blueprint.items.map((item) => {
      if (item.kind !== "coding") return item;
      const publicCases = item.testCases
        .filter((testCase) => testCase.visibility === "public")
        .map((testCase) => publicInterviewStudioTestCaseSchema.parse(testCase));
      return {
        ...item,
        testCases: publicCases,
        testCaseSummary: {
          publicCount: publicCases.length,
          hiddenCount: item.testCases.length - publicCases.length,
          totalCount: item.testCases.length,
        },
      };
    }),
  };
}

export type InterviewStudioCatalogSummary = {
  itemCount: number;
  codingCount: number;
  includesCoding: boolean;
};

/** Public template-list metadata; deliberately excludes all candidate and evaluator content. */
export function summarizeInterviewStudioBlueprintForCatalog(input: unknown): InterviewStudioCatalogSummary {
  const blueprint = interviewStudioBlueprintSchema.parse(input);
  const codingCount = blueprint.items.filter((item) => item.kind === "coding").length;
  return {
    itemCount: blueprint.items.length,
    codingCount,
    includesCoding: codingCount > 0,
  };
}

export type ClientInterviewStudioTestRunResult = Omit<InterviewStudioTestRunResult, "cases"> & {
  cases: Array<z.infer<typeof interviewStudioTestCaseResultSchema>>;
  hidden: { passedCount: number; totalCount: number };
};

/** Keeps hidden-run evidence useful without exposing case identifiers or outputs. */
export function sanitizeInterviewStudioTestRunForClient(input: unknown): ClientInterviewStudioTestRunResult {
  const result = interviewStudioTestRunResultSchema.parse(input);
  const publicCases = result.cases.filter((testCase) => testCase.visibility === "public");
  const hiddenCases = result.cases.filter((testCase) => testCase.visibility === "hidden");
  return {
    ...result,
    cases: publicCases,
    hidden: {
      passedCount: hiddenCases.filter((testCase) => testCase.passed).length,
      totalCount: hiddenCases.length,
    },
  };
}
