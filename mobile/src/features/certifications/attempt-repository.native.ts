import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import type { RecoverableAttempt } from './types';


const DATABASE_NAME = 'octamy-exam-recovery.db';
const DATABASE_KEY = 'octamy.exam-recovery.sqlcipher-key.v1';
const WEB_PREFIX = 'octamy.exam-recovery.v1';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function webKey(userId: number, courseId: number): string {
  return `${WEB_PREFIX}.${userId}.${courseId}`;
}

async function encryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DATABASE_KEY);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const key = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replaceAll('-', '').toLowerCase();
  await SecureStore.setItemAsync(DATABASE_KEY, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return key;
}

async function database(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const key = await encryptionKey();
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`PRAGMA key = "x'${key}'";`);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS exam_recovery (
          user_id INTEGER NOT NULL,
          course_id INTEGER NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, course_id)
        );
      `);
      return db;
    })();
  }
  return databasePromise;
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
  if (Platform.OS === 'web') {
    webStorage()?.setItem(webKey(attempt.userId, attempt.courseId), payload);
    return;
  }
  const db = await database();
  await db.runAsync(
    `INSERT INTO exam_recovery (user_id, course_id, payload, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, course_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    attempt.userId,
    attempt.courseId,
    payload,
    new Date().toISOString(),
  );
}

export async function loadAttempt(userId: number, courseId: number): Promise<RecoverableAttempt | null> {
  let payload: string | null = null;
  if (Platform.OS === 'web') {
    payload = webStorage()?.getItem(webKey(userId, courseId)) ?? null;
  } else {
    const db = await database();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM exam_recovery WHERE user_id = ? AND course_id = ?',
      userId,
      courseId,
    );
    payload = row?.payload ?? null;
  }
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
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(webKey(userId, courseId));
    return;
  }
  const db = await database();
  await db.runAsync('DELETE FROM exam_recovery WHERE user_id = ? AND course_id = ?', userId, courseId);
}

export async function clearUserAttempts(userId: number): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = webStorage();
    if (!storage) return;
    const prefix = `${WEB_PREFIX}.${userId}.`;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => Boolean(key?.startsWith(prefix)),
    );
    keys.forEach((key) => storage.removeItem(key));
    return;
  }
  const db = await database();
  await db.runAsync('DELETE FROM exam_recovery WHERE user_id = ?', userId);
}

