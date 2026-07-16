export interface ScheduledSourceQuestion {
  id: number;
  question: string;
  options: unknown;
  questionType: string;
  questionFormat: string;
  imageUrl: string | null;
  codeLanguage: string | null;
  timeLimitSec: number | null;
  maxPoints: number;
  negativeMarks: number;
  correctAnswer: number;
  expectedAnswer: string | null;
  explanation: string | null;
  version: number | null;
}

export interface ScheduledQuestionSnapshot {
  questionId: number;
  position: number;
  questionVersion: number;
  question: string;
  options: string[];
  questionType: string;
  questionFormat: string;
  imageUrl: string | null;
  codeLanguage: string | null;
  timeLimitSec: number | null;
  maxPoints: number;
  negativeMarks: number;
  correctAnswer: number;
  expectedAnswer: string | null;
  explanation: string | null;
}

export type ScheduledAnswerValue = number | string | number[];

export type ScheduledReviewPolicy =
  | "immediate"
  | "after_final_attempt"
  | "after_window"
  | "score_only";

export interface ScheduledReviewDecisionInput {
  submitted: boolean;
  policy: string;
  releaseAt?: Date | string | null;
  attemptNumber: number;
  maxAttempts: number;
  examClosed?: boolean;
  nowMs?: number;
}

export interface ScheduledReviewDecision {
  allowed: boolean;
  reason:
    | "available"
    | "not_submitted"
    | "score_only"
    | "attempts_remaining"
    | "window_open"
    | "policy_unavailable";
  availableAt: string | null;
}

function validatedPoints(item: Pick<ScheduledQuestionSnapshot, "maxPoints" | "negativeMarks">) {
  if (!Number.isInteger(item.maxPoints) || item.maxPoints <= 0) {
    throw new Error("Scheduled question maxPoints must be a positive integer");
  }
  if (!Number.isInteger(item.negativeMarks) || item.negativeMarks < 0 || item.negativeMarks > item.maxPoints) {
    throw new Error("Scheduled question negativeMarks must be between zero and maxPoints");
  }
  return { maxPoints: item.maxPoints, negativeMarks: item.negativeMarks };
}

/**
 * Copy every field needed to render and grade a scheduled question. Arrays are
 * cloned so later edits to an in-memory source object cannot mutate a snapshot
 * before it is persisted.
 */
export function createScheduledQuestionSnapshot(
  source: ScheduledSourceQuestion,
  position: number,
): ScheduledQuestionSnapshot {
  const options = Array.isArray(source.options) ? source.options.map((option) => String(option)) : [];
  validatedPoints(source);
  if (!Number.isInteger(source.correctAnswer) || source.correctAnswer < 0 || source.correctAnswer >= options.length) {
    throw new Error("Scheduled question correctAnswer must reference a rendered option");
  }
  return {
    questionId: source.id,
    position,
    questionVersion: source.version ?? 1,
    question: source.question,
    options,
    questionType: source.questionType,
    questionFormat: source.questionFormat,
    imageUrl: source.imageUrl,
    codeLanguage: source.codeLanguage,
    timeLimitSec: source.timeLimitSec,
    maxPoints: source.maxPoints,
    negativeMarks: source.negativeMarks,
    correctAnswer: source.correctAnswer,
    expectedAnswer: source.expectedAnswer,
    explanation: source.explanation,
  };
}

/** Candidate-safe API representation. Answer keys and explanations stay server-side. */
export function toScheduledQuestionPayload(item: ScheduledQuestionSnapshot) {
  return {
    id: item.questionId,
    question: item.question,
    options: [...item.options],
    type: item.questionType,
    format: item.questionFormat,
    imageUrl: item.imageUrl,
    codeLanguage: item.codeLanguage,
    timeLimitSec: item.timeLimitSec,
    maxPoints: item.maxPoints,
  };
}

/**
 * Grade the immutable item set. Correct answers earn maxPoints, unanswered
 * questions earn zero and answered-but-wrong questions incur negativeMarks.
 * Both the numerator and denominator therefore come exclusively from the
 * snapshot that was frozen when the attempt started.
 */
export function scoreScheduledQuestionSnapshots(
  items: Array<Pick<ScheduledQuestionSnapshot, "questionId" | "correctAnswer" | "maxPoints" | "negativeMarks">>,
  answers: Record<string, ScheduledAnswerValue>,
) {
  let score = 0;
  let totalPoints = 0;
  let correctAnswers = 0;
  let answeredQuestions = 0;
  for (const item of items) {
    const points = validatedPoints(item);
    totalPoints += points.maxPoints;
    const submitted = answers[String(item.questionId)];
    if (submitted === undefined || submitted === null || submitted === "") continue;
    answeredQuestions++;
    if (typeof submitted === "number" && submitted === item.correctAnswer) {
      score += points.maxPoints;
      correctAnswers++;
    } else {
      score -= points.negativeMarks;
    }
  }
  return {
    score,
    totalPoints,
    totalQuestions: items.length,
    correctAnswers,
    answeredQuestions,
  };
}

/** The first instant a learner may begin another attempt, or null when ready. */
export function scheduledRetakeAvailableAt(
  previousAttemptAt: Date | string | null | undefined,
  cooldownMin: number,
  nowMs = Date.now(),
): Date | null {
  if (!Number.isInteger(cooldownMin) || cooldownMin < 0) throw new Error("Invalid retake cooldown");
  if (!previousAttemptAt || cooldownMin === 0) return null;
  const previousMs = new Date(previousAttemptAt).getTime();
  if (!Number.isFinite(previousMs)) throw new Error("Invalid previous attempt time");
  const availableAt = previousMs + cooldownMin * 60_000;
  return availableAt > nowMs ? new Date(availableAt) : null;
}

/**
 * Fail-closed answer-review policy. This function only decides whether answer
 * keys may be returned; score summaries remain available immediately.
 */
export function scheduledReviewDecision(input: ScheduledReviewDecisionInput): ScheduledReviewDecision {
  if (!input.submitted) return { allowed: false, reason: "not_submitted", availableAt: null };

  switch (input.policy as ScheduledReviewPolicy) {
    case "immediate":
      return { allowed: true, reason: "available", availableAt: null };
    case "score_only":
      return { allowed: false, reason: "score_only", availableAt: null };
    case "after_final_attempt":
      return input.attemptNumber >= input.maxAttempts
        ? { allowed: true, reason: "available", availableAt: null }
        : { allowed: false, reason: "attempts_remaining", availableAt: null };
    case "after_window": {
      if (!input.releaseAt) {
        return input.examClosed
          ? { allowed: true, reason: "available", availableAt: null }
          : { allowed: false, reason: "window_open", availableAt: null };
      }
      const releaseMs = new Date(input.releaseAt).getTime();
      if (!Number.isFinite(releaseMs)) return { allowed: false, reason: "policy_unavailable", availableAt: null };
      const availableAt = new Date(releaseMs).toISOString();
      return (input.nowMs ?? Date.now()) >= releaseMs
        ? { allowed: true, reason: "available", availableAt }
        : { allowed: false, reason: "window_open", availableAt };
    }
    default:
      return { allowed: false, reason: "policy_unavailable", availableAt: null };
  }
}

export function scheduledAttemptPassed(
  scorePct: number,
  passingScoreSnapshot: number,
): boolean {
  if (!Number.isFinite(scorePct) || !Number.isFinite(passingScoreSnapshot)) {
    throw new Error("Invalid scheduled exam score");
  }
  // Reaching the deadline is an automatic submission condition, not evidence
  // of misconduct. A candidate can still pass from answers durably saved before
  // the deadline; callers are responsible for excluding any late answer writes.
  return scorePct >= passingScoreSnapshot;
}

export type ScheduledAnswer = number | string | number[];

/**
 * Once the authoritative deadline (including network grace) has elapsed, only
 * the last server-autosaved snapshot may be graded. This prevents a late client
 * from changing answers while still allowing an on-time automatic submission to
 * be scored normally.
 */
export function scheduledSubmissionAnswers(
  savedAnswers: Record<string, ScheduledAnswer> | null | undefined,
  incomingAnswers: Record<string, ScheduledAnswer> | null | undefined,
  deadlineExceeded: boolean,
): Record<string, ScheduledAnswer> {
  const saved = savedAnswers && typeof savedAnswers === "object" ? savedAnswers : {};
  if (deadlineExceeded) return { ...saved };
  const incoming = incomingAnswers && typeof incomingAnswers === "object" ? incomingAnswers : {};
  return { ...saved, ...incoming };
}

export function scheduledScorePercentage(score: number, totalPoints: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(totalPoints) || totalPoints <= 0) {
    throw new Error("Invalid scheduled exam point total");
  }
  return Math.round((score / totalPoints) * 100);
}

/**
 * A scheduled run can never continue past the exam's closing window, even when
 * its nominal duration would otherwise end later.
 */
export function scheduledAttemptDeadline(
  startedAt: Date | string,
  durationMin: number,
  examEndsAt?: Date | string | null,
): Date {
  const startedMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startedMs)) throw new Error("Invalid attempt start time");
  if (!Number.isFinite(durationMin) || durationMin <= 0) throw new Error("Invalid exam duration");

  const durationDeadlineMs = startedMs + durationMin * 60_000;
  if (!examEndsAt) return new Date(durationDeadlineMs);

  const closingMs = new Date(examEndsAt).getTime();
  if (!Number.isFinite(closingMs)) throw new Error("Invalid exam closing time");
  return new Date(Math.min(durationDeadlineMs, closingMs));
}

export function scheduledAttemptRemainingSeconds(
  startedAt: Date | string,
  durationMin: number,
  examEndsAt: Date | string | null | undefined,
  nowMs = Date.now(),
): number {
  return Math.max(0, Math.ceil((scheduledAttemptDeadline(startedAt, durationMin, examEndsAt).getTime() - nowMs) / 1000));
}

export function scheduledDeadlineRemainingSeconds(
  deadlineAt: Date | string,
  nowMs = Date.now(),
): number {
  const deadlineMs = new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadlineMs)) throw new Error("Invalid attempt deadline");
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function isScheduledAttemptTimedOut(
  startedAt: Date | string,
  durationMin: number,
  examEndsAt: Date | string | null | undefined,
  nowMs = Date.now(),
  graceSeconds = 15,
): boolean {
  return nowMs > scheduledAttemptDeadline(startedAt, durationMin, examEndsAt).getTime() + graceSeconds * 1000;
}

export function isScheduledDeadlineExceeded(
  deadlineAt: Date | string,
  nowMs = Date.now(),
  graceSeconds = 15,
): boolean {
  const deadlineMs = new Date(deadlineAt).getTime();
  if (!Number.isFinite(deadlineMs)) throw new Error("Invalid attempt deadline");
  return nowMs > deadlineMs + graceSeconds * 1000;
}
