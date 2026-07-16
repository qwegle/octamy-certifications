// Persistent replacement for the in-process `global.questionMappings` and
// `global.tempExamData` maps. Backed by Postgres so exam state survives PM2
// restarts and works across multiple workers.
import { pool } from "../db";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour for in-flight exam mappings
const PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for paid-pending records

export type CorrectMap = Record<string, number>;

export type ExamQuestionSnapshot = {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
};

export type ExamSessionState = {
  userId: number | null;
  correctMap: CorrectMap;
  questionSnapshot: ExamQuestionSnapshot[];
  createdAt: Date;
  expiresAt: Date;
  evidenceConsentAt: Date | null;
  evidenceConsentVersion: string | null;
};

type SaveQuestionMappingOptions = {
  ttlMs?: number;
  questionSnapshot?: ExamQuestionSnapshot[];
  createdAt?: Date;
  evidenceConsentAt?: Date;
  evidenceConsentVersion?: string;
  userId?: number | null;
};

export async function saveQuestionMapping(
  sessionId: string,
  correctMap: CorrectMap,
  courseId: number | null = null,
  optionsOrTtl: number | SaveQuestionMappingOptions = {},
): Promise<{ createdAt: Date; expiresAt: Date }> {
  const options = typeof optionsOrTtl === "number"
    ? { ttlMs: optionsOrTtl }
    : optionsOrTtl;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const createdAt = options.createdAt ?? new Date();
  const expires = new Date(createdAt.getTime() + ttlMs);
  await pool.query(
    `INSERT INTO exam_sessions (
       id, course_id, user_id, correct_map, question_snapshot,
       evidence_consent_at, evidence_consent_version, created_at, expires_at
     )
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE
       SET correct_map = EXCLUDED.correct_map,
           course_id   = EXCLUDED.course_id,
           user_id = EXCLUDED.user_id,
           question_snapshot = EXCLUDED.question_snapshot,
           evidence_consent_at = EXCLUDED.evidence_consent_at,
           evidence_consent_version = EXCLUDED.evidence_consent_version,
           created_at = EXCLUDED.created_at,
           expires_at  = EXCLUDED.expires_at`,
    [
      sessionId,
      courseId,
      options.userId ?? null,
      JSON.stringify(correctMap),
      JSON.stringify(options.questionSnapshot || []),
      options.evidenceConsentAt ?? null,
      options.evidenceConsentVersion ?? null,
      createdAt,
      expires,
    ],
  );
  return { createdAt, expiresAt: expires };
}

export async function loadExamSession(
  sessionId: string,
  expectedCourseId?: number,
): Promise<ExamSessionState | null> {
  const result = await pool.query(
    `SELECT user_id, correct_map, question_snapshot, course_id, created_at, expires_at,
            evidence_consent_at, evidence_consent_version
       FROM exam_sessions
      WHERE id = $1 AND expires_at > NOW()`,
    [sessionId],
  );
  if (result.rowCount === 0) return null;
  if (expectedCourseId !== undefined && result.rows[0].course_id !== expectedCourseId) {
    return null;
  }
  const rawMap = result.rows[0].correct_map;
  const rawSnapshot = result.rows[0].question_snapshot;
  return {
    userId: result.rows[0].user_id == null ? null : Number(result.rows[0].user_id),
    correctMap: typeof rawMap === "string" ? JSON.parse(rawMap) : rawMap,
    questionSnapshot: typeof rawSnapshot === "string" ? JSON.parse(rawSnapshot) : (rawSnapshot || []),
    createdAt: new Date(result.rows[0].created_at),
    expiresAt: new Date(result.rows[0].expires_at),
    evidenceConsentAt: result.rows[0].evidence_consent_at
      ? new Date(result.rows[0].evidence_consent_at)
      : null,
    evidenceConsentVersion: result.rows[0].evidence_consent_version || null,
  };
}

export async function loadQuestionMapping(
  sessionId: string,
  expectedCourseId?: number,
): Promise<CorrectMap | null> {
  return (await loadExamSession(sessionId, expectedCourseId))?.correctMap || null;
}

export async function deleteQuestionMapping(sessionId: string): Promise<void> {
  await pool.query(`DELETE FROM exam_sessions WHERE id = $1`, [sessionId]);
}

export async function loadPendingExamBySessionId<T = any>(
  sessionId: string,
  expectedCourseId?: number,
): Promise<{ id: string; payload: T } | null> {
  const values: unknown[] = [sessionId];
  const coursePredicate = expectedCourseId === undefined
    ? ""
    : ` AND payload->>'courseId' = $2`;
  if (expectedCourseId !== undefined) values.push(String(expectedCourseId));
  const result = await pool.query(
    `SELECT id, payload
       FROM pending_exams
      WHERE payload->>'sessionId' = $1
        AND expires_at > NOW()${coursePredicate}
      ORDER BY created_at DESC
      LIMIT 1`,
    values,
  );
  if (result.rowCount === 0) return null;
  const raw = result.rows[0].payload;
  return {
    id: result.rows[0].id,
    payload: (typeof raw === "string" ? JSON.parse(raw) : raw) as T,
  };
}

/**
 * Atomically consumes one server-issued question mapping into one pending exam
 * result. The advisory lock makes concurrent/retried submits replay the same
 * result instead of producing two independently payable attempts.
 */
export async function commitPendingExamForSession<T extends Record<string, unknown>>(input: {
  sessionId: string;
  courseId: number;
  pendingExamId: string;
  payload: T;
  submissionClosesAt: Date;
  ttlMs?: number;
}): Promise<{ id: string; payload: T; replayed: boolean } | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7319, hashtext($1))", [input.sessionId]);

    const existing = await client.query(
      `SELECT id, payload
        FROM pending_exams
        WHERE payload->>'sessionId' = $1
          AND payload->>'courseId' = $2
          AND expires_at > clock_timestamp()
        ORDER BY created_at DESC
        LIMIT 1`,
      [input.sessionId, String(input.courseId)],
    );
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("COMMIT");
      const raw = existing.rows[0].payload;
      return {
        id: existing.rows[0].id,
        payload: (typeof raw === "string" ? JSON.parse(raw) : raw) as T,
        replayed: true,
      };
    }

    const consumed = await client.query(
      `DELETE FROM exam_sessions
        WHERE id = $1
          AND course_id = $2
          AND expires_at > clock_timestamp()
          -- NOW() is fixed at transaction start and can become stale while the
          -- advisory lock waits; clock_timestamp() enforces the actual write time.
          AND clock_timestamp() <= $3
      RETURNING id`,
      [input.sessionId, input.courseId, input.submissionClosesAt],
    );
    if ((consumed.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const expiresAt = new Date(Date.now() + (input.ttlMs ?? PENDING_TTL_MS));
    await client.query(
      `INSERT INTO pending_exams (id, payload, expires_at)
       VALUES ($1, $2::jsonb, $3)`,
      [input.pendingExamId, JSON.stringify(input.payload), expiresAt],
    );
    await client.query("COMMIT");
    return { id: input.pendingExamId, payload: input.payload, replayed: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function savePendingExam(
  id: string,
  payload: Record<string, unknown>,
  ttlMs: number = PENDING_TTL_MS,
): Promise<void> {
  const expires = new Date(Date.now() + ttlMs);
  await pool.query(
    `INSERT INTO pending_exams (id, payload, expires_at)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (id) DO UPDATE
       SET payload    = EXCLUDED.payload,
           expires_at = EXCLUDED.expires_at`,
    [id, JSON.stringify(payload), expires],
  );
}

export async function loadPendingExam<T = any>(id: string): Promise<T | null> {
  const r = await pool.query(
    `SELECT payload FROM pending_exams
      WHERE id = $1 AND expires_at > NOW()`,
    [id],
  );
  if (r.rowCount === 0) return null;
  const raw = r.rows[0].payload;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function deletePendingExam(id: string): Promise<void> {
  await pool.query(`DELETE FROM pending_exams WHERE id = $1`, [id]);
}

// Periodic cleanup of expired rows. Idempotent and safe to call from a cron.
export async function purgeExpiredExamState(): Promise<{
  sessions: number;
  pending: number;
}> {
  const a = await pool.query(`DELETE FROM exam_sessions WHERE expires_at <= NOW()`);
  const b = await pool.query(`DELETE FROM pending_exams WHERE expires_at <= NOW()`);
  return { sessions: a.rowCount ?? 0, pending: b.rowCount ?? 0 };
}

// Auto-start the purge cron at module load. Runs every 30 minutes.
let _cronStarted = false;
export function startExamStateCron(): void {
  if (_cronStarted) return;
  _cronStarted = true;
  const tick = () => {
    purgeExpiredExamState().catch((e) =>
      // eslint-disable-next-line no-console
      console.error("[exam-state-cron] purge failed", e),
    );
  };
  setInterval(tick, 30 * 60 * 1000).unref();
  // first pass shortly after boot
  setTimeout(tick, 60 * 1000).unref();
}
