import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import { attemptQuestionSchema } from './practice.types';


const draftSchema = z.object({
  version: z.literal(1),
  userId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  courseTitle: z.string(),
  questions: z.array(attemptQuestionSchema).min(1),
  sessionId: z.string(),
  startedAt: z.string(),
  deadlineAt: z.string(),
  answers: z.record(z.string(), z.number().int().nonnegative()),
  tempExamId: z.string().optional(),
  updatedAt: z.string(),
});

export type PracticeDraft = z.infer<typeof draftSchema>;

const PREFIX = 'octamy.practice.draft.v1';
const INDEX_PREFIX = 'octamy.practice.index.v1';
let writeQueue: Promise<void> = Promise.resolve();

function key(userId: number, courseId: number) {
  return `${PREFIX}.${userId}.${courseId}`;
}

function indexKey(userId: number) {
  return `${INDEX_PREFIX}.${userId}`;
}

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

async function readValue(storageKey: string): Promise<string | null> {
  if (Platform.OS === 'web') return webStorage()?.getItem(storageKey) ?? null;
  return SecureStore.getItemAsync(storageKey);
}

async function writeValue(storageKey: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(storageKey, value);
    return;
  }
  await SecureStore.setItemAsync(storageKey, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function removeValue(storageKey: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(storageKey);
    return;
  }
  await SecureStore.deleteItemAsync(storageKey);
}

async function readIndex(userId: number): Promise<number[]> {
  const raw = await readValue(indexKey(userId));
  if (!raw) return [];
  try {
    const result = z.array(z.number().int().positive()).safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export async function readPracticeDraft(userId: number, courseId: number): Promise<PracticeDraft | null> {
  const raw = await readValue(key(userId, courseId));
  if (!raw) return null;
  try {
    const result = draftSchema.safeParse(JSON.parse(raw));
    if (!result.success || result.data.userId !== userId || result.data.courseId !== courseId) return null;
    return result.data;
  } catch {
    return null;
  }
}

export function savePracticeDraft(draft: PracticeDraft): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await writeValue(key(draft.userId, draft.courseId), JSON.stringify(draft));
    const ids = await readIndex(draft.userId);
    if (!ids.includes(draft.courseId)) {
      await writeValue(indexKey(draft.userId), JSON.stringify([...ids, draft.courseId]));
    }
  });
  return writeQueue;
}

export async function clearPracticeDraft(userId: number, courseId: number): Promise<void> {
  await writeQueue.catch(() => undefined);
  await removeValue(key(userId, courseId));
  const ids = (await readIndex(userId)).filter((id) => id !== courseId);
  if (ids.length === 0) await removeValue(indexKey(userId));
  else await writeValue(indexKey(userId), JSON.stringify(ids));
}

export async function clearAllPracticeDrafts(userId: number): Promise<void> {
  await writeQueue.catch(() => undefined);
  const ids = await readIndex(userId);
  await Promise.all(ids.map((courseId) => removeValue(key(userId, courseId))));
  await removeValue(indexKey(userId));
}

