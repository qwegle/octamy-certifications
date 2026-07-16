import crypto from "node:crypto";
import os from "node:os";
import { and, eq, sql } from "drizzle-orm";
import {
  interviewStudioEvaluationJobs,
  interviewStudioEvents,
  interviewStudioResponses,
  interviewStudioSessions,
  type InterviewStudioEvaluationJob,
} from "@shared/schema";
import { db } from "../db";
import {
  commitInterviewStudioEvaluation,
  finalizeInterviewStudioEvaluationFailure,
  prepareInterviewStudioEvaluation,
} from "./interview-studio-evaluation";
import { isInterviewAiEnabled } from "./interview-ai";
import { isCodeRunnerEnabled } from "./code-runner";
import { logger } from "./logger";

const DEFAULT_DAILY_LIMIT = 10;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_POLL_MS = 2_000;
const DEFAULT_LEASE_MS = 5 * 60_000;
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_DAILY_RUNNER_LIMIT = 10;
const DEFAULT_CANCELLATION_POLL_MS = 2_000;
const DEFAULT_MAX_QUEUE_LAG_SECONDS = 15 * 60;

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function envFlag(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") return fallback;
  if (/^(1|true|yes|on)$/i.test(value.trim())) return true;
  if (/^(0|false|no|off)$/i.test(value.trim())) return false;
  return fallback;
}

export function getInterviewStudioDailyEvaluationLimit(env: NodeJS.ProcessEnv = process.env) {
  return boundedInteger(
    env.INTERVIEW_STUDIO_DAILY_EVALUATION_LIMIT ?? env.INTERVIEW_DAILY_EVALUATION_LIMIT,
    DEFAULT_DAILY_LIMIT,
    1,
    100,
  );
}

export function getInterviewStudioEvaluationWorkerConfig(env: NodeJS.ProcessEnv = process.env) {
  const leaseMs = boundedInteger(env.INTERVIEW_STUDIO_EVALUATION_LEASE_MS, DEFAULT_LEASE_MS, 60_000, 30 * 60_000);
  return {
    enabled: envFlag(env.INTERVIEW_STUDIO_EVALUATION_WORKER_ENABLED, true),
    maxAttempts: boundedInteger(env.INTERVIEW_STUDIO_EVALUATION_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1, 10),
    pollMs: boundedInteger(env.INTERVIEW_STUDIO_EVALUATION_POLL_MS, DEFAULT_POLL_MS, 500, 60_000),
    leaseMs,
    heartbeatMs: Math.max(15_000, Math.floor(leaseMs / 3)),
    concurrency: boundedInteger(env.INTERVIEW_STUDIO_EVALUATION_CONCURRENCY, DEFAULT_CONCURRENCY, 1, 4),
    cancellationPollMs: boundedInteger(
      env.INTERVIEW_STUDIO_EVALUATION_CANCELLATION_POLL_MS,
      DEFAULT_CANCELLATION_POLL_MS,
      1_000,
      10_000,
    ),
    dailyLimit: getInterviewStudioDailyEvaluationLimit(env),
    dailyRunnerLimit: boundedInteger(
      env.INTERVIEW_STUDIO_DAILY_RUNNER_LIMIT,
      DEFAULT_DAILY_RUNNER_LIMIT,
      1,
      100,
    ),
    maxQueueLagSeconds: boundedInteger(
      env.INTERVIEW_STUDIO_MAX_QUEUE_LAG_SECONDS,
      DEFAULT_MAX_QUEUE_LAG_SECONDS,
      60,
      24 * 60 * 60,
    ),
  } as const;
}

export async function getInterviewStudioEvaluationQueueHealth(env: NodeJS.ProcessEnv = process.env) {
  const config = getInterviewStudioEvaluationWorkerConfig(env);
  if (!config.enabled) return { enabled: false, status: "disabled" as const };
  const result: any = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE status = 'queued')::integer AS queued,
      count(*) FILTER (WHERE status = 'running')::integer AS running,
      count(*) FILTER (
        WHERE status = 'running'
          AND locked_at < now() - (${config.leaseMs} * interval '1 millisecond')
      )::integer AS stale,
      COALESCE(max(EXTRACT(EPOCH FROM (now() - available_at))) FILTER (WHERE status = 'queued'), 0)::integer
        AS oldest_queued_seconds
    FROM interview_studio_evaluation_jobs
  `);
  const row = result.rows?.[0] ?? {};
  const stale = Number(row.stale ?? 0);
  const oldestQueuedSeconds = Number(row.oldest_queued_seconds ?? 0);
  const workerRunning = Boolean(singletonWorker);
  const degraded = stale > 0
    || oldestQueuedSeconds > config.maxQueueLagSeconds
    || (process.env.NODE_ENV === "production" && !workerRunning);
  return {
    enabled: true,
    status: degraded ? "degraded" as const : "ready" as const,
    workerRunning,
    queued: Number(row.queued ?? 0),
    running: Number(row.running ?? 0),
    stale,
    oldestQueuedSeconds,
    maxQueueLagSeconds: config.maxQueueLagSeconds,
  };
}

export class InterviewStudioEvaluationQuotaError extends Error {
  readonly code = "INTERVIEW_EVALUATION_DAILY_LIMIT";
  readonly status = 429;
  constructor(readonly limit: number) {
    super(`The daily Interview Studio evaluation limit of ${limit} has been reached. Try again after 00:00 UTC.`);
    this.name = "InterviewStudioEvaluationQuotaError";
  }
}

export class InterviewStudioEvaluationWorkerUnavailableError extends Error {
  readonly code = "INTERVIEW_EVALUATION_WORKER_DISABLED";
  readonly status = 503;
  constructor() {
    super("Interview feedback is temporarily unavailable. Your in-progress answers remain saved.");
    this.name = "InterviewStudioEvaluationWorkerUnavailableError";
  }
}

export type EnqueueInterviewStudioEvaluationResult =
  | {
    state: "queued";
    session: typeof interviewStudioSessions.$inferSelect;
    jobId: string;
    dailyUsed: number;
    dailyLimit: number;
    runnerDailyUsed: number;
    runnerDailyLimit: number;
    aiEvaluationAllowed: boolean;
    codeRunnerAllowed: boolean;
  }
  | { state: "already_evaluating" | "already_finished" | "invalid_state"; status: string };

/**
 * Freezes a submission, consumes one persisted daily allowance and creates its
 * single durable job in one PostgreSQL transaction. Any failure rolls back all
 * three changes, including quota consumption.
 */
export async function enqueueInterviewStudioEvaluation(input: {
  sessionId: string;
  userId: number;
  env?: NodeJS.ProcessEnv;
}): Promise<EnqueueInterviewStudioEvaluationResult> {
  const env = input.env ?? process.env;
  const config = getInterviewStudioEvaluationWorkerConfig(env);
  if (!config.enabled) throw new InterviewStudioEvaluationWorkerUnavailableError();
  if (env.NODE_ENV === "production" && !singletonWorker) {
    throw new InterviewStudioEvaluationWorkerUnavailableError();
  }
  const now = new Date();
  const jobId = crypto.randomUUID();
  return db.transaction(async (tx) => {
    const [claimed] = await tx.update(interviewStudioSessions).set({
      status: "evaluating",
      submittedAt: now,
      evaluationStatus: "pending",
      evaluationStartedAt: null,
      updatedAt: now,
    }).where(and(
      eq(interviewStudioSessions.id, input.sessionId),
      eq(interviewStudioSessions.userId, input.userId),
      eq(interviewStudioSessions.status, "in_progress"),
    )).returning();

    if (!claimed) {
      const [current] = await tx.select({ status: interviewStudioSessions.status })
        .from(interviewStudioSessions)
        .where(and(
          eq(interviewStudioSessions.id, input.sessionId),
          eq(interviewStudioSessions.userId, input.userId),
        )).limit(1);
      const status = current?.status ?? "missing";
      if (status === "evaluating") return { state: "already_evaluating" as const, status };
      if (status === "completed" || status === "review_required") {
        return { state: "already_finished" as const, status };
      }
      return { state: "invalid_state" as const, status };
    }

    // Only configured, explicitly consented OpenAI work is billable against
    // the AI allowance. Isolated final runs have their own provider allowance.
    // Submission itself always succeeds: once an allowance is exhausted this
    // durable job still closes the saved-answer session without external calls.
    const savedResponses = await tx.select({
      itemKey: interviewStudioResponses.itemKey,
      answerText: interviewStudioResponses.answerText,
      code: interviewStudioResponses.code,
    }).from(interviewStudioResponses).where(eq(interviewStudioResponses.sessionId, claimed.id));
    const blueprintItems = new Map(claimed.blueprintSnapshot.items.map((item) => [item.key, item]));
    const hasAiWork = savedResponses.some((response) => {
      const item = blueprintItems.get(response.itemKey);
      if (!item) return false;
      if (item.kind === "structured_response") return Boolean(response.answerText?.trim());
      return Boolean(response.code?.trim()) && item.rubric.some((criterion) => criterion.key !== "correctness");
    });
    const hasRunnerWork = savedResponses.some((response) => {
      const item = blueprintItems.get(response.itemKey);
      return item?.kind === "coding" && Boolean(response.code?.trim());
    });
    const billableAiEvaluation = claimed.consentSnapshot.aiEvaluation
      && hasAiWork
      && isInterviewAiEnabled(env);
    const billableRunnerEvaluation = hasRunnerWork && isCodeRunnerEnabled(env);
    await tx.execute(sql`
      INSERT INTO interview_studio_daily_usage (
        user_id, usage_date, evaluation_jobs, ai_evaluation_jobs,
        code_runner_jobs, created_at, updated_at
      ) VALUES (
        ${input.userId}, timezone('UTC', now())::date, 0, 0, 0, now(), now()
      )
      ON CONFLICT (user_id, usage_date) DO NOTHING
    `);
    const usageLock: any = await tx.execute(sql`
      SELECT evaluation_jobs, ai_evaluation_jobs, code_runner_jobs
      FROM interview_studio_daily_usage
      WHERE user_id = ${input.userId}
        AND usage_date = timezone('UTC', now())::date
      FOR UPDATE
    `);
    const usage = usageLock.rows?.[0];
    if (!usage) throw Object.assign(new Error("Interview usage allowance could not be locked"), { code: "INTERVIEW_USAGE_UNAVAILABLE" });
    const aiEvaluationAllowed = billableAiEvaluation
      && Number(usage.ai_evaluation_jobs) < config.dailyLimit;
    const codeRunnerAllowed = billableRunnerEvaluation
      && Number(usage.code_runner_jobs) < config.dailyRunnerLimit;
    const usageResult: any = await tx.execute(sql`
      UPDATE interview_studio_daily_usage
      SET evaluation_jobs = LEAST(evaluation_jobs + 1, 100),
          ai_evaluation_jobs = ai_evaluation_jobs + ${aiEvaluationAllowed ? 1 : 0},
          code_runner_jobs = code_runner_jobs + ${codeRunnerAllowed ? 1 : 0},
          updated_at = now()
      WHERE user_id = ${input.userId}
        AND usage_date = timezone('UTC', now())::date
      RETURNING ai_evaluation_jobs, code_runner_jobs
    `);
    const dailyUsed = Number(usageResult.rows?.[0]?.ai_evaluation_jobs ?? 0);
    const runnerDailyUsed = Number(usageResult.rows?.[0]?.code_runner_jobs ?? 0);

    await tx.insert(interviewStudioEvaluationJobs).values({
      id: jobId,
      sessionId: claimed.id,
      status: "queued",
      attempts: 0,
      maxAttempts: config.maxAttempts,
      aiEvaluationAllowed,
      codeRunnerAllowed,
      availableAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(interviewStudioEvents).values({
      sessionId: claimed.id,
      userId: input.userId,
      idempotencyKey: `submission:${claimed.id}`,
      type: "session_submitted",
      payload: {},
      occurredAt: now,
    }).onConflictDoNothing({
      target: [interviewStudioEvents.sessionId, interviewStudioEvents.idempotencyKey],
    });

    return {
      state: "queued" as const,
      session: claimed,
      jobId,
      dailyUsed,
      dailyLimit: config.dailyLimit,
      runnerDailyUsed,
      runnerDailyLimit: config.dailyRunnerLimit,
      aiEvaluationAllowed,
      codeRunnerAllowed,
    };
  });
}

type ClaimedJob = Pick<
  InterviewStudioEvaluationJob,
  "id" | "sessionId" | "attempts" | "maxAttempts" | "aiEvaluationAllowed" | "codeRunnerAllowed"
>;

function rawClaimedJob(row: Record<string, unknown>): ClaimedJob {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    aiEvaluationAllowed: Boolean(row.ai_evaluation_allowed),
    codeRunnerAllowed: Boolean(row.code_runner_allowed),
  };
}

async function claimNextJob(workerId: string, leaseMs: number): Promise<ClaimedJob | null> {
  return db.transaction(async (tx) => {
    const result: any = await tx.execute(sql`
      WITH candidate AS (
        SELECT id
        FROM interview_studio_evaluation_jobs
        WHERE attempts < max_attempts
          AND (
            (status = 'queued' AND available_at <= now())
            OR (status = 'running' AND locked_at < now() - (${leaseMs} * interval '1 millisecond'))
          )
        ORDER BY available_at ASC, created_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE interview_studio_evaluation_jobs AS job
      SET status = 'running',
          attempts = job.attempts + 1,
          locked_at = now(),
          locked_by = ${workerId},
          started_at = COALESCE(job.started_at, now()),
          updated_at = now()
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.id, job.session_id, job.attempts, job.max_attempts,
        job.ai_evaluation_allowed, job.code_runner_allowed
    `);
    const row = result.rows?.[0];
    if (!row) return null;
    await tx.update(interviewStudioSessions).set({
      evaluationStatus: "in_progress",
      evaluationStartedAt: sql`COALESCE(${interviewStudioSessions.evaluationStartedAt}, now())`,
      updatedAt: new Date(),
    }).where(and(
      eq(interviewStudioSessions.id, String(row.session_id)),
      eq(interviewStudioSessions.status, "evaluating"),
    ));
    return rawClaimedJob(row);
  });
}

/** Takes ownership of a stale max-attempt lease so it can fail closed. */
async function claimExhaustedJob(workerId: string, leaseMs: number): Promise<ClaimedJob | null> {
  const result: any = await db.execute(sql`
    WITH candidate AS (
      SELECT id
      FROM interview_studio_evaluation_jobs
      WHERE attempts >= max_attempts
        AND (
          (status = 'queued' AND available_at <= now())
          OR (status = 'running' AND locked_at < now() - (${leaseMs} * interval '1 millisecond'))
        )
      ORDER BY available_at ASC, created_at ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE interview_studio_evaluation_jobs AS job
    SET status = 'running',
        locked_at = now(),
        locked_by = ${workerId},
        updated_at = now()
    FROM candidate
    WHERE job.id = candidate.id
    RETURNING job.id, job.session_id, job.attempts, job.max_attempts,
      job.ai_evaluation_allowed, job.code_runner_allowed
  `);
  return result.rows?.[0] ? rawClaimedJob(result.rows[0]) : null;
}

async function heartbeatJob(jobId: string, workerId: string): Promise<boolean> {
  const [heartbeat] = await db.update(interviewStudioEvaluationJobs).set({
    // Lease comparisons and renewals both use the PostgreSQL clock, avoiding
    // clock-skew lease theft across PM2 hosts.
    lockedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(and(
    eq(interviewStudioEvaluationJobs.id, jobId),
    eq(interviewStudioEvaluationJobs.status, "running"),
    eq(interviewStudioEvaluationJobs.lockedBy, workerId),
  )).returning({ id: interviewStudioEvaluationJobs.id });
  return Boolean(heartbeat);
}

async function evaluationCanContinue(job: ClaimedJob, workerId: string): Promise<boolean> {
  const result: any = await db.execute(sql`
    SELECT 1
    FROM interview_studio_evaluation_jobs AS job
    JOIN interview_studio_sessions AS session ON session.id = job.session_id
    WHERE job.id = ${job.id}
      AND job.session_id = ${job.sessionId}
      AND job.status = 'running'
      AND job.locked_by = ${workerId}
      AND session.status = 'evaluating'
    LIMIT 1
  `);
  return (result.rowCount ?? result.rows?.length ?? 0) === 1;
}

function safeWorkerErrorCode(error: unknown): string {
  const candidate = (error as { code?: unknown })?.code;
  if (typeof candidate === "string" && /^[A-Z0-9_]{3,80}$/.test(candidate)) return candidate;
  return "EVALUATION_JOB_FAILED";
}

function retryDelayMs(attempts: number) {
  return Math.min(5 * 60_000, 5_000 * (2 ** Math.max(0, attempts - 1)));
}

async function releaseJobForRetry(job: ClaimedJob, workerId: string, errorCode: string) {
  const delayMs = retryDelayMs(job.attempts);
  const [released] = await db.update(interviewStudioEvaluationJobs).set({
    status: "queued",
    availableAt: sql`now() + (${delayMs} * interval '1 millisecond')`,
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: errorCode,
    updatedAt: sql`now()`,
  }).where(and(
    eq(interviewStudioEvaluationJobs.id, job.id),
    eq(interviewStudioEvaluationJobs.status, "running"),
    eq(interviewStudioEvaluationJobs.lockedBy, workerId),
  )).returning({ id: interviewStudioEvaluationJobs.id });
  return Boolean(released);
}

async function completeObsoleteJob(job: ClaimedJob, workerId: string) {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [completed] = await tx.update(interviewStudioEvaluationJobs).set({
      status: "completed",
      lockedAt: null,
      lockedBy: null,
      completedAt: now,
      lastErrorCode: null,
      updatedAt: now,
    }).where(and(
      eq(interviewStudioEvaluationJobs.id, job.id),
      eq(interviewStudioEvaluationJobs.status, "running"),
      eq(interviewStudioEvaluationJobs.lockedBy, workerId),
    )).returning({ sessionId: interviewStudioEvaluationJobs.sessionId });
    if (completed) {
      await tx.delete(interviewStudioSessions).where(and(
        eq(interviewStudioSessions.id, completed.sessionId),
        eq(interviewStudioSessions.mode, "practice"),
        eq(interviewStudioSessions.status, "cancelled"),
        eq(interviewStudioSessions.recruiterSharingEnabled, false),
      ));
    }
  });
}

async function processClaimedJob(input: {
  job: ClaimedJob;
  workerId: string;
  heartbeatMs: number;
  cancellationPollMs: number;
  abortController: AbortController;
}) {
  let heartbeatBusy = false;
  const heartbeat = setInterval(async () => {
    if (heartbeatBusy) return;
    heartbeatBusy = true;
    try {
      const owned = await heartbeatJob(input.job.id, input.workerId);
      if (!owned) input.abortController.abort();
    } catch (error) {
      logger.warn("interview_studio.evaluation_heartbeat_failed", {
        jobId: input.job.id,
        errorCode: safeWorkerErrorCode(error),
      });
    } finally {
      heartbeatBusy = false;
    }
  }, input.heartbeatMs);
  heartbeat.unref();
  let cancellationCheckBusy = false;
  const cancellationMonitor = setInterval(async () => {
    if (cancellationCheckBusy) return;
    cancellationCheckBusy = true;
    try {
      const active = await evaluationCanContinue(input.job, input.workerId);
      if (!active) input.abortController.abort();
    } catch (error) {
      logger.warn("interview_studio.evaluation_cancellation_check_failed", {
        jobId: input.job.id,
        errorCode: safeWorkerErrorCode(error),
      });
    } finally {
      cancellationCheckBusy = false;
    }
  }, input.cancellationPollMs);
  cancellationMonitor.unref();

  try {
    const prepared = await prepareInterviewStudioEvaluation(
      input.job.sessionId,
      input.abortController.signal,
      {
        aiEvaluationAllowed: input.job.aiEvaluationAllowed,
        codeRunnerAllowed: input.job.codeRunnerAllowed,
      },
    );
    if (!prepared) {
      await completeObsoleteJob(input.job, input.workerId);
      return;
    }
    const committed = await commitInterviewStudioEvaluation({
      jobId: input.job.id,
      workerId: input.workerId,
      prepared,
    });
    if (!committed) {
      logger.warn("interview_studio.evaluation_lease_lost", { jobId: input.job.id });
    }
  } catch (error) {
    const stillActive = await evaluationCanContinue(input.job, input.workerId).catch(() => true);
    const errorCode = stillActive ? safeWorkerErrorCode(error) : "EVALUATION_CANCELLED";
    logger.warn("interview_studio.evaluation_job_failed", {
      jobId: input.job.id,
      sessionId: input.job.sessionId,
      attempt: input.job.attempts,
      maxAttempts: input.job.maxAttempts,
      errorCode,
    });
    if (errorCode === "EVALUATION_CANCELLED") {
      await completeObsoleteJob(input.job, input.workerId);
    } else if (input.job.attempts < input.job.maxAttempts) {
      await releaseJobForRetry(input.job, input.workerId, errorCode);
    } else {
      await finalizeInterviewStudioEvaluationFailure({
        jobId: input.job.id,
        sessionId: input.job.sessionId,
        workerId: input.workerId,
        errorCode,
      });
    }
  } finally {
    clearInterval(heartbeat);
    clearInterval(cancellationMonitor);
  }
}

export type InterviewStudioEvaluationWorkerHandle = {
  workerId: string;
  stop: () => void;
};

let singletonWorker: InterviewStudioEvaluationWorkerHandle | null = null;

export function startInterviewStudioEvaluationWorker(
  env: NodeJS.ProcessEnv = process.env,
): InterviewStudioEvaluationWorkerHandle | null {
  if (singletonWorker) return singletonWorker;
  const config = getInterviewStudioEvaluationWorkerConfig(env);
  if (!config.enabled) {
    logger.info("interview_studio.evaluation_worker_disabled");
    return null;
  }
  const workerId = `${os.hostname().slice(0, 80)}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const activeControllers = new Set<AbortController>();

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(runTick, delayMs);
    timer.unref();
  };
  const runTick = async () => {
    if (stopped) return;
    try {
      const exhausted = await claimExhaustedJob(workerId, config.leaseMs);
      if (exhausted) {
        await finalizeInterviewStudioEvaluationFailure({
          jobId: exhausted.id,
          sessionId: exhausted.sessionId,
          workerId,
          errorCode: "EVALUATION_LEASE_EXHAUSTED",
        });
      }

      const jobs: ClaimedJob[] = [];
      for (let index = 0; index < config.concurrency; index += 1) {
        const job = await claimNextJob(workerId, config.leaseMs);
        if (!job) break;
        jobs.push(job);
      }
      await Promise.allSettled(jobs.map(async (job) => {
        const abortController = new AbortController();
        activeControllers.add(abortController);
        try {
          await processClaimedJob({
            job,
            workerId,
            heartbeatMs: config.heartbeatMs,
            cancellationPollMs: config.cancellationPollMs,
            abortController,
          });
        } finally {
          activeControllers.delete(abortController);
        }
      }));
    } catch (error) {
      logger.error("interview_studio.evaluation_worker_tick_failed", {
        errorCode: safeWorkerErrorCode(error),
      });
    } finally {
      schedule(config.pollMs);
    }
  };

  singletonWorker = {
    workerId,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      for (const controller of Array.from(activeControllers)) controller.abort();
      singletonWorker = null;
    },
  };
  logger.info("interview_studio.evaluation_worker_started", {
    workerId,
    concurrency: config.concurrency,
    maxAttempts: config.maxAttempts,
    dailyLimit: config.dailyLimit,
  });
  schedule(250);
  return singletonWorker;
}

export function stopInterviewStudioEvaluationWorker() {
  singletonWorker?.stop();
}
