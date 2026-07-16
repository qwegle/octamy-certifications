import { z } from "zod";
import {
  createInterviewStudioSessionRequestSchema,
  interviewStudioBlueprintSchema,
  interviewStudioConsentSnapshotSchema,
  interviewStudioModeSchema,
  interviewStudioRubricCriterionSchema,
  interviewStudioSessionStatusSchema,
  interviewStudioTestCaseSchema,
  sanitizeInterviewStudioBlueprintForClient,
  saveInterviewStudioResponseRequestSchema,
  type ClientInterviewStudioBlueprint,
  type InterviewStudioBlueprint,
} from "../../shared/interview-studio";

const MAX_CODE_BYTES = 50 * 1024;

// Route-facing aliases deliberately reuse the canonical shared contract.
export const interviewModeSchema = interviewStudioModeSchema;
export const interviewSessionStatusSchema = interviewStudioSessionStatusSchema;
export const sessionConsentSchema = interviewStudioConsentSnapshotSchema;
export const sessionCreateSchema = createInterviewStudioSessionRequestSchema;
export const interviewBlueprintSchema = interviewStudioBlueprintSchema;
export const rubricCriterionSchema = interviewStudioRubricCriterionSchema;
export const codingTestCaseSchema = interviewStudioTestCaseSchema;

export type InterviewMode = z.infer<typeof interviewModeSchema>;
export type SessionConsent = z.infer<typeof sessionConsentSchema>;
export type InterviewStudioSessionStatus = z.infer<typeof interviewStudioSessionStatusSchema>;

/** Autosaves use the canonical shape, with the runner's 50 KB source ceiling. */
export const responseAutosaveSchema = saveInterviewStudioResponseRequestSchema.superRefine((response, context) => {
  if (response.code && Buffer.byteLength(response.code, "utf8") > MAX_CODE_BYTES) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["code"],
      message: "Source code must not exceed 50 KB",
    });
  }
});
export type ResponseAutosave = z.infer<typeof responseAutosaveSchema>;

const eventBase = {
  idempotencyKey: z.string().trim().min(8).max(200),
  occurredAt: z.string().datetime({ offset: true }),
};
const emptyEventPayload = z.object({}).strict();
const itemEventPayload = z.object({ itemKey: z.string().trim().min(3).max(120) }).strict();

/**
 * Browser evidence is deliberately an allowlisted discriminated union. It
 * cannot be used as a generic channel for device fingerprints or raw media.
 */
export const interviewEventSchema = z.discriminatedUnion("type", [
  z.object({ ...eventBase, type: z.literal("session_started"), payload: emptyEventPayload }).strict(),
  z.object({ ...eventBase, type: z.literal("session_submitted"), payload: emptyEventPayload }).strict(),
  z.object({
    ...eventBase,
    type: z.literal("permission_changed"),
    payload: z.object({
      device: z.enum(["camera", "microphone", "screen"]),
      state: z.enum(["not_requested", "granted", "denied", "unavailable"]),
    }).strict(),
  }).strict(),
  z.object({ ...eventBase, type: z.literal("recording_started"), payload: z.object({ kind: z.enum(["camera", "screen"]) }).strict() }).strict(),
  z.object({ ...eventBase, type: z.literal("recording_stopped"), payload: z.object({ kind: z.enum(["camera", "screen"]) }).strict() }).strict(),
  z.object({ ...eventBase, type: z.literal("screen_share_ended"), payload: emptyEventPayload }).strict(),
  z.object({ ...eventBase, type: z.literal("focus_left"), payload: z.union([itemEventPayload, emptyEventPayload]).default({}) }).strict(),
  z.object({ ...eventBase, type: z.literal("focus_returned"), payload: z.union([itemEventPayload, emptyEventPayload]).default({}) }).strict(),
  z.object({ ...eventBase, type: z.literal("network_offline"), payload: emptyEventPayload }).strict(),
  z.object({ ...eventBase, type: z.literal("network_online"), payload: emptyEventPayload }).strict(),
  z.object({
    ...eventBase,
    type: z.literal("response_saved"),
    payload: z.object({
      itemKey: z.string().trim().min(3).max(120),
      isFinal: z.boolean(),
    }).strict(),
  }).strict(),
  z.object({
    ...eventBase,
    type: z.literal("tests_requested"),
    payload: z.object({
      itemKey: z.string().trim().min(3).max(120),
      scope: z.enum(["public", "all"]),
    }).strict(),
  }).strict(),
]);
export type InterviewEvent = z.infer<typeof interviewEventSchema>;

/** Delegates to the canonical sanitizer; hidden cases are removed, not masked. */
export function sanitizeInterviewBlueprint(input: unknown): ClientInterviewStudioBlueprint {
  return sanitizeInterviewStudioBlueprintForClient(input);
}

const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<InterviewStudioSessionStatus, readonly InterviewStudioSessionStatus[]>> = {
  ready: ["in_progress", "expired", "cancelled"],
  in_progress: ["evaluating", "expired", "cancelled"],
  evaluating: ["completed", "review_required", "expired", "cancelled"],
  completed: [],
  review_required: ["evaluating", "completed", "cancelled"],
  expired: [],
  cancelled: [],
};

export function canTransitionInterviewSession(
  from: InterviewStudioSessionStatus,
  to: InterviewStudioSessionStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function calculateInterviewDeadline(
  startedAt: Date,
  durationMinutes: number,
  invitationExpiresAt?: Date | null,
): Date {
  if (!Number.isFinite(startedAt.getTime())) throw new Error("startedAt must be a valid date");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) {
    throw new Error("durationMinutes must be an integer between 1 and 240");
  }
  const durationDeadline = new Date(startedAt.getTime() + durationMinutes * 60_000);
  if (!invitationExpiresAt) return durationDeadline;
  if (!Number.isFinite(invitationExpiresAt.getTime())) {
    throw new Error("invitationExpiresAt must be a valid date");
  }
  return new Date(Math.min(durationDeadline.getTime(), invitationExpiresAt.getTime()));
}

export function hasInterviewDeadlinePassed(deadline: Date, now = new Date()): boolean {
  if (!Number.isFinite(deadline.getTime()) || !Number.isFinite(now.getTime())) return true;
  return now.getTime() >= deadline.getTime();
}

/** Practice evidence is private by invariant and can never produce a share grant. */
export function canShareInterviewEvidence(input: {
  mode: z.infer<typeof interviewStudioModeSchema>;
  status: InterviewStudioSessionStatus;
  hasActiveShareGrant?: boolean;
  recruiterSharingConsent?: boolean;
}): boolean {
  return input.mode === "verified"
    && input.status === "completed"
    && (input.hasActiveShareGrant ?? input.recruiterSharingConsent ?? false);
}

export type InterviewScoreInput = {
  score: number | null | undefined;
  maxScore?: number;
  weight?: number;
};

export function aggregateInterviewScores(items: InterviewScoreInput[]): {
  score: number | null;
  scoredItems: number;
  totalItems: number;
  coveragePercent: number;
} {
  let weightedTotal = 0;
  let totalWeight = 0;
  let scoredItems = 0;
  for (const item of items) {
    if (item.score == null || !Number.isFinite(item.score)) continue;
    const maxScore = item.maxScore ?? 100;
    const weight = item.weight ?? 1;
    if (!Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(weight) || weight <= 0) continue;
    weightedTotal += Math.max(0, Math.min(100, (item.score / maxScore) * 100)) * weight;
    totalWeight += weight;
    scoredItems += 1;
  }
  return {
    score: totalWeight ? Math.round((weightedTotal / totalWeight) * 100) / 100 : null,
    scoredItems,
    totalItems: items.length,
    coveragePercent: items.length ? Math.round((scoredItems / items.length) * 10_000) / 100 : 0,
  };
}

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  if (/^(1|true|yes|on)$/i.test(value.trim())) return true;
  if (/^(0|false|no|off)$/i.test(value.trim())) return false;
  return fallback;
}

function hasUsableSecret(value: string | undefined): boolean {
  const secret = value?.trim();
  if (!secret || secret.length < 20) return false;
  return !/(placeholder|change[_-]?me|replace[_-]?me|your[_-]?|example|test[_-]?key)/i.test(secret);
}

function secureRunnerConfigured(env: NodeJS.ProcessEnv): boolean {
  const raw = env.CODE_RUNNER_URL?.trim();
  if (!raw) return false;
  const languageId = Number(env.CODE_RUNNER_JAVASCRIPT_LANGUAGE_ID);
  if (!Number.isInteger(languageId) || languageId < 1 || languageId > 10_000 || !env.CODE_RUNNER_VERSION?.trim()) {
    return false;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === "https:") return true;
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return env.NODE_ENV !== "production" && local && url.protocol === "http:";
  } catch {
    return false;
  }
}

function privateMediaConfigured(env: NodeJS.ProcessEnv): boolean {
  if (env.NODE_ENV !== "production" && env.INTERVIEW_PRIVATE_MEDIA_PROVIDER === "local_private") return true;
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME?.trim()
    && env.CLOUDINARY_API_KEY?.trim()
    && env.CLOUDINARY_API_SECRET?.trim(),
  );
}

export function getInterviewStudioConfig(env: NodeJS.ProcessEnv = process.env) {
  // Development is discoverable by default; production requires an explicit
  // release flag so a newly deployed migration cannot silently launch a new
  // data-processing surface.
  const enabled = envFlag(env.INTERVIEW_STUDIO_ENABLED, env.NODE_ENV !== "production");
  const aiEvaluationEnabled = hasUsableSecret(env.OPENAI_API_KEY);
  const codeExecutionEnabled = secureRunnerConfigured(env);
  const verifiedRecordingRequired = envFlag(env.INTERVIEW_VERIFIED_RECORDING_REQUIRED, true);
  const privateMediaEnabled = privateMediaConfigured(env);
  const humanReviewEnabled = envFlag(env.INTERVIEW_HUMAN_REVIEW_ENABLED, false);
  const verifiedSharingConfigured = envFlag(env.INTERVIEW_VERIFIED_SHARING_ENABLED, false);
  const verifiedEnabled = enabled
    && aiEvaluationEnabled
    && codeExecutionEnabled
    && (!verifiedRecordingRequired || privateMediaEnabled)
    && humanReviewEnabled
    && verifiedSharingConfigured;

  return {
    enabled,
    practiceEnabled: enabled,
    verifiedEnabled,
    browserEvidenceEnabled: envFlag(env.INTERVIEW_BROWSER_EVIDENCE_ENABLED, true),
    aiEvaluationEnabled,
    codeExecutionEnabled,
    verifiedRecordingRequired,
    privateMediaEnabled,
    humanReviewEnabled,
    verifiedSharingConfigured,
  } as const;
}

export function getInterviewStudioReadiness(env: NodeJS.ProcessEnv = process.env) {
  const config = getInterviewStudioConfig(env);
  const issues: string[] = [];
  if (!config.enabled) issues.push("studio_disabled");
  if (!config.aiEvaluationEnabled) issues.push("ai_evaluation_unavailable");
  if (!config.codeExecutionEnabled) issues.push("isolated_code_runner_unavailable");
  if (config.verifiedRecordingRequired && !config.privateMediaEnabled) issues.push("private_media_unavailable");
  if (!config.humanReviewEnabled) issues.push("human_review_unavailable");
  if (!config.verifiedSharingConfigured) issues.push("verified_sharing_disabled");
  return {
    ...config,
    practiceReady: config.practiceEnabled,
    verifiedReady: config.verifiedEnabled,
    issues,
  } as const;
}

export type { InterviewStudioBlueprint };
