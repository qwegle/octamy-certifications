// Persistent replacement for the in-process `global.questionMappings` and
// `global.tempExamData` maps. Backed by Postgres so exam state survives PM2
// restarts and works across multiple workers.
import { pool } from "../db";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour for in-flight exam mappings
const PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for paid-pending records

export type CorrectMap = Record<string, number>;

export async function saveQuestionMapping(
  sessionId: string,
  correctMap: CorrectMap,
  courseId: number | null = null,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  const expires = new Date(Date.now() + ttlMs);
  await pool.query(
    `INSERT INTO exam_sessions (id, course_id, correct_map, expires_at)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (id) DO UPDATE
       SET correct_map = EXCLUDED.correct_map,
           course_id   = EXCLUDED.course_id,
           expires_at  = EXCLUDED.expires_at`,
    [sessionId, courseId, JSON.stringify(correctMap), expires],
  );
}

export async function loadQuestionMapping(
  sessionId: string,
  expectedCourseId?: number,
): Promise<CorrectMap | null> {
  const r = await pool.query(
    `SELECT correct_map, course_id FROM exam_sessions
      WHERE id = $1 AND expires_at > NOW()`,
    [sessionId],
  );
  if (r.rowCount === 0) return null;
  if (expectedCourseId !== undefined && r.rows[0].course_id !== expectedCourseId) {
    return null;
  }
  const raw = r.rows[0].correct_map;
  // pg returns jsonb already-parsed
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function deleteQuestionMapping(sessionId: string): Promise<void> {
  await pool.query(`DELETE FROM exam_sessions WHERE id = $1`, [sessionId]);
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
