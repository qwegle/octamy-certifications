import type { RecoverableAttempt } from './types';


const WEB_PREFIX = 'octamy.exam-recovery.v1';

function webStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function webKey(userId: number, courseId: number): string {
  return `${WEB_PREFIX}.${userId}.${courseId}`;
}

function isAttempt(value: unknown): value is RecoverableAttempt {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<RecoverableAttempt>;
  return Number.isInteger(item.userId)
    && Number.isInteger(item.courseId)
    && typeof item.courseSlug === 'string'
    && typeof item.courseTitle === 'string'
    && typeof item.sessionId === 'string'
    && typeof item.startedAt === 'string'
    && typeof item.deadlineAt === 'string'
    && typeof item.evidenceConsentVersion === 'string'
    && item.proctorMode === 'browser_evidence'
    && Array.isArray(item.questions)
    && Boolean(item.answers && typeof item.answers === 'object');
}

export async function saveAttempt(attempt: RecoverableAttempt): Promise<void> {
  const payload = JSON.stringify({ ...attempt, updatedAt: new Date().toISOString() });
  webStorage()?.setItem(webKey(attempt.userId, attempt.courseId), payload);
}

export async function loadAttempt(userId: number, courseId: number): Promise<RecoverableAttempt | null> {
  const payload = webStorage()?.getItem(webKey(userId, courseId)) ?? null;
  if (!payload) return null;
  try {
    const parsed: unknown = JSON.parse(payload);
    if (isAttempt(parsed) && parsed.userId === userId && parsed.courseId === courseId) return parsed;
  } catch {
    // Corrupt or partial records are discarded below.
  }
  await clearAttempt(userId, courseId);
  return null;
}

export async function clearAttempt(userId: number, courseId: number): Promise<void> {
  webStorage()?.removeItem(webKey(userId, courseId));
}

export async function clearUserAttempts(userId: number): Promise<void> {
  const storage = webStorage();
  if (!storage) return;
  const prefix = `${WEB_PREFIX}.${userId}.`;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => Boolean(key?.startsWith(prefix)),
  );
  keys.forEach((key) => storage.removeItem(key));
}

