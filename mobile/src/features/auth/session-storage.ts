import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const TOKEN_KEY = 'octamy.auth.token.v1';
const USER_KEY = 'octamy.auth.user.v1';
const memoryFallback = new Map<string, string>();

const cachedUserSchema = z.object({
  email: z.string().email(),
  id: z.number().int().positive(),
  isAdmin: z.boolean(),
  name: z.string(),
});

export type SessionUser = z.infer<typeof cachedUserSchema>;
export interface StoredSession {
  token: string;
  user: SessionUser;
}

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

async function getValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webStorage()?.getItem(key) ?? memoryFallback.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = webStorage();
    if (storage) storage.setItem(key, value);
    else memoryFallback.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function deleteValue(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(key);
    memoryFallback.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function readStoredSession(): Promise<StoredSession | null> {
  const [token, rawUser] = await Promise.all([getValue(TOKEN_KEY), getValue(USER_KEY)]);
  if (!token || !rawUser) return null;

  try {
    const parsed = cachedUserSchema.safeParse(JSON.parse(rawUser));
    if (!parsed.success) return null;
    return { token, user: parsed.data };
  } catch {
    return null;
  }
}

export async function writeStoredSession(session: StoredSession): Promise<void> {
  await setValue(USER_KEY, JSON.stringify(session.user));
  try {
    await setValue(TOKEN_KEY, session.token);
  } catch (error) {
    await deleteValue(USER_KEY);
    throw error;
  }
}

/** The token is removed first because local invalidation is the effective logout contract. */
export async function clearStoredSession(): Promise<void> {
  await deleteValue(TOKEN_KEY);
  await deleteValue(USER_KEY);
}
