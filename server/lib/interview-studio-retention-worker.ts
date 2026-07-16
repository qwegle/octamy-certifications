import crypto from "node:crypto";
import os from "node:os";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { audit } from "./audit";
import { logger } from "./logger";

const DEFAULT_INTERVAL_MS = 60 * 60_000;
const DEFAULT_BATCH_SIZE = 250;

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

export function getInterviewStudioRetentionWorkerConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    enabled: envFlag(env.INTERVIEW_STUDIO_RETENTION_WORKER_ENABLED, true),
    intervalMs: boundedInteger(
      env.INTERVIEW_STUDIO_RETENTION_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
      60_000,
      24 * 60 * 60_000,
    ),
    batchSize: boundedInteger(
      env.INTERVIEW_STUDIO_RETENTION_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      1,
      1_000,
    ),
  } as const;
}

/**
 * Deletes one bounded batch across every practice-session status. Child jobs,
 * responses and events are removed by FK cascade; daily evaluation usage is a
 * separate compliance/abuse record and deliberately remains.
 */
export async function deleteExpiredInterviewStudioPracticeSessions(batchSize = DEFAULT_BATCH_SIZE) {
  const safeBatchSize = Math.max(1, Math.min(1_000, Math.floor(batchSize)));
  // Commit cancellation before deletion. Active jobs keep their parent until
  // they observe this state and release the lease; no later answer is sent to
  // a provider from a stale in-memory response list.
  const cancellationResult: any = await db.execute(sql`
      WITH cancelling AS (
        SELECT id
        FROM interview_studio_sessions
        WHERE mode = 'practice'
          AND recruiter_sharing_enabled = false
          AND retention_until < now()
          AND status = 'evaluating'
        ORDER BY retention_until ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${safeBatchSize}
      )
      UPDATE interview_studio_sessions AS session
      SET status = 'cancelled', updated_at = now()
      FROM cancelling
      WHERE session.id = cancelling.id
      RETURNING session.id
  `);
  // A queued job has not crossed a provider boundary and can be closed
  // immediately. Running jobs retain their lease until they observe the
  // cancelled parent, abort, and delete it through the worker path.
  await db.execute(sql`
    UPDATE interview_studio_evaluation_jobs AS job
    SET status = 'completed',
        completed_at = now(),
        locked_at = NULL,
        locked_by = NULL,
        last_error_code = NULL,
        updated_at = now()
    FROM interview_studio_sessions AS session
    WHERE job.session_id = session.id
      AND job.status = 'queued'
      AND session.mode = 'practice'
      AND session.status = 'cancelled'
      AND session.retention_until < now()
  `);
  const result: any = await db.execute(sql`
    WITH expired AS (
      SELECT session.id
      FROM interview_studio_sessions AS session
      WHERE session.mode = 'practice'
        AND session.recruiter_sharing_enabled = false
        AND session.retention_until < now()
        AND NOT EXISTS (
          SELECT 1
          FROM interview_studio_evaluation_jobs AS job
          WHERE job.session_id = session.id
            AND job.status IN ('queued','running')
        )
      ORDER BY session.retention_until ASC, session.id ASC
      FOR UPDATE OF session SKIP LOCKED
      LIMIT ${safeBatchSize}
    )
    DELETE FROM interview_studio_sessions AS session
    USING expired
    WHERE session.id = expired.id
    RETURNING session.id
  `);
  return {
    cancelled: Number(cancellationResult.rowCount ?? cancellationResult.rows?.length ?? 0),
    deleted: Number(result.rowCount ?? result.rows?.length ?? 0),
  };
}

export type InterviewStudioRetentionWorkerHandle = {
  workerId: string;
  stop: () => void;
};

let singletonWorker: InterviewStudioRetentionWorkerHandle | null = null;

export function startInterviewStudioRetentionWorker(
  env: NodeJS.ProcessEnv = process.env,
): InterviewStudioRetentionWorkerHandle | null {
  if (singletonWorker) return singletonWorker;
  const config = getInterviewStudioRetentionWorkerConfig(env);
  if (!config.enabled) {
    logger.info("interview_studio.retention_worker_disabled");
    return null;
  }
  const workerId = `${os.hostname().slice(0, 80)}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const schedule = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(runSweep, delayMs);
    timer.unref();
  };
  const runSweep = async () => {
    if (stopped) return;
    try {
      const cleanup = await deleteExpiredInterviewStudioPracticeSessions(config.batchSize);
      const deleted = cleanup.deleted;
      if (deleted > 0) {
        logger.info("interview_studio.retention_deleted", { workerId, deleted });
        await audit({
          action: "interview_studio.retention_deleted",
          actorRole: "system",
          resourceType: "interview_studio_session",
          metadata: { deleted },
        });
      }
      // Drain a backlog in bounded batches without waiting an hour, but yield
      // between statements so cleanup cannot monopolize the pool.
      schedule(cleanup.cancelled > 0 || deleted >= config.batchSize ? 1_000 : config.intervalMs);
    } catch (error) {
      logger.error("interview_studio.retention_worker_failed", {
        errorCode: typeof (error as { code?: unknown })?.code === "string"
          ? (error as { code: string }).code.slice(0, 80)
          : "RETENTION_SWEEP_FAILED",
      });
      schedule(config.intervalMs);
    }
  };

  singletonWorker = {
    workerId,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      singletonWorker = null;
    },
  };
  logger.info("interview_studio.retention_worker_started", {
    workerId,
    intervalMs: config.intervalMs,
    batchSize: config.batchSize,
  });
  schedule(30_000);
  return singletonWorker;
}

export function stopInterviewStudioRetentionWorker() {
  singletonWorker?.stop();
}
