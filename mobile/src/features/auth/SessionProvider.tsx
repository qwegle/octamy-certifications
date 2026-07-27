import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ApiError, setAuthTokenProvider } from '@/lib/api-client';
import { queryClient, useNetworkStatus } from '@/lib/query';
import { purgeUserScopedLocalData } from '@/lib/user-data-cleanup';
import { getCurrentUser, login as loginRequest, logoutOnServer, register as registerRequest, type LoginInput, type RegisterInput } from './auth.api';
import { clearStoredSession, readStoredSession, writeStoredSession, type SessionUser } from './session-storage';

export type SessionStatus = 'anonymous' | 'authenticated' | 'authenticatedOffline' | 'booting';

interface SessionContextValue {
  canMutate: boolean;
  refreshSession: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  status: SessionStatus;
  user: SessionUser | null;
}

interface SessionSnapshot {
  status: SessionStatus;
  user: SessionUser | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);
let activeToken: string | null = null;
setAuthTokenProvider(() => activeToken);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionSnapshot>({ status: 'booting', user: null });
  const currentNetwork = useNetworkStatus();

  const acceptAuth = useCallback(async (token: string, user: SessionUser) => {
    await writeStoredSession({ token, user });
    activeToken = token;
    setSession({ status: 'authenticated', user });
  }, []);

  const invalidateLocalSession = useCallback(async (userId?: number) => {
    // Authentication is revoked in memory before any fallible storage cleanup.
    // A recording/SQLite/filesystem failure must never leave the JWT usable.
    activeToken = null;
    queryClient.clear();
    setSession({ status: 'anonymous', user: null });

    const cleanup = [clearStoredSession()];
    if (userId) cleanup.push(purgeUserScopedLocalData(userId));
    const results = await Promise.allSettled(cleanup);
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0 && __DEV__) {
      console.warn(`Octamy signed out, but ${failures.length} local cleanup operation(s) need a later retry.`);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!activeToken || !session.user) return;
    try {
      const user = await getCurrentUser();
      await writeStoredSession({ token: activeToken, user });
      setSession({ status: 'authenticated', user });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await invalidateLocalSession(session.user.id);
        return;
      }
      if (error instanceof ApiError && (error.isNetworkError || error.isTimeout || error.status >= 500)) {
        setSession((current) => ({ ...current, status: 'authenticatedOffline' }));
        return;
      }
      throw error;
    }
  }, [invalidateLocalSession, session.user]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      let stored;
      try {
        stored = await readStoredSession();
      } catch {
        stored = null;
      }
      if (!mounted) return;
      if (!stored) {
        activeToken = null;
        setSession({ status: 'anonymous', user: null });
        return;
      }

      activeToken = stored.token;
      const connection = await NetInfo.fetch().catch(() => null);
      if (!mounted) return;
      if (connection?.isConnected === false || connection?.isInternetReachable === false) {
        setSession({ status: 'authenticatedOffline', user: stored.user });
        return;
      }

      try {
        const user = await getCurrentUser();
        if (!mounted) return;
        await writeStoredSession({ token: stored.token, user });
        setSession({ status: 'authenticated', user });
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError && error.status === 401) {
          await invalidateLocalSession(stored.user.id);
        } else {
          setSession({ status: 'authenticatedOffline', user: stored.user });
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (currentNetwork === 'online' && session.status === 'authenticatedOffline') {
      void refreshSession().catch(() => undefined);
    }
  }, [currentNetwork, refreshSession, session.status]);

  const signIn = useCallback(async (input: LoginInput) => {
    const result = await loginRequest(input);
    await acceptAuth(result.token, result.user);
  }, [acceptAuth]);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await registerRequest(input);
    await acceptAuth(result.token, result.user);
  }, [acceptAuth]);

  const signOut = useCallback(async () => {
    const userId = session.user?.id;
    await invalidateLocalSession(userId);
    await logoutOnServer().catch(() => undefined);
  }, [invalidateLocalSession, session.user?.id]);

  const value = useMemo<SessionContextValue>(() => ({
    canMutate: session.status === 'authenticated',
    refreshSession,
    register,
    signIn,
    signOut,
    status: session.status,
    user: session.user,
  }), [refreshSession, register, session.status, session.user, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
