import * as SecureStore from 'expo-secure-store';

import { completeOnboarding, hasCompletedOnboarding } from '@/features/auth/onboarding-storage';
import { clearStoredSession, readStoredSession, writeStoredSession } from '@/features/auth/session-storage';

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const session = {
  token: 'jwt-token',
  user: { email: 'learner@example.test', id: 42, isAdmin: false, name: 'Learner' },
};

describe('auth token storage', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    secureStore.getItemAsync.mockImplementation(async (key) => values.get(key) ?? null);
    secureStore.setItemAsync.mockImplementation(async (key, value) => { values.set(key, value); });
    secureStore.deleteItemAsync.mockImplementation(async (key) => { values.delete(key); });
  });

  it('writes the user and token securely, then reconstructs a validated session', async () => {
    await writeStoredSession(session);
    await expect(readStoredSession()).resolves.toEqual(session);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'octamy.auth.token.v1',
      'jwt-token',
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    );
  });

  it('returns null for malformed cached users rather than trusting storage', async () => {
    values.set('octamy.auth.token.v1', 'jwt-token');
    values.set('octamy.auth.user.v1', JSON.stringify({ email: 'not-an-email', id: -1 }));
    await expect(readStoredSession()).resolves.toBeNull();
  });

  it('removes the token before user data during logout', async () => {
    await writeStoredSession(session);
    secureStore.deleteItemAsync.mockClear();
    await clearStoredSession();
    expect(secureStore.deleteItemAsync.mock.calls.map(([key]) => key)).toEqual([
      'octamy.auth.token.v1',
      'octamy.auth.user.v1',
    ]);
    await expect(readStoredSession()).resolves.toBeNull();
  });

  it('leaves no usable stored JWT when later user cleanup fails', async () => {
    await writeStoredSession(session);
    secureStore.deleteItemAsync.mockImplementation(async (key) => {
      if (key === 'octamy.auth.user.v1') throw new Error('user cleanup unavailable');
      values.delete(key);
    });
    await expect(clearStoredSession()).rejects.toThrow('user cleanup unavailable');
    expect(values.has('octamy.auth.token.v1')).toBe(false);
    await expect(readStoredSession()).resolves.toBeNull();
  });

  it('rolls back cached user data if writing the token fails', async () => {
    secureStore.setItemAsync.mockImplementation(async (key, value) => {
      if (key === 'octamy.auth.token.v1') throw new Error('keychain unavailable');
      values.set(key, value);
    });
    await expect(writeStoredSession(session)).rejects.toThrow('keychain unavailable');
    expect(values.has('octamy.auth.user.v1')).toBe(false);
  });

  it('persists first-launch onboarding completion in device-only secure storage', async () => {
    await expect(hasCompletedOnboarding()).resolves.toBe(false);
    await completeOnboarding();
    await expect(hasCompletedOnboarding()).resolves.toBe(true);
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'octamy.onboarding.completed.v1',
      'true',
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    );
  });
});
