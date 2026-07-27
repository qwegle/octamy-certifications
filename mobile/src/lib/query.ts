import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import { publishGlobalFeedback } from '@/lib/feedback';
import { spacing } from '@/theme';

export type NetworkStatus = 'offline' | 'online' | 'unknown';
const NetworkContext = createContext<NetworkStatus>('unknown');

function networkStatus(state: NetInfoState): NetworkStatus {
  const connected: boolean | null = state.isConnected;
  const reachable: boolean | null = state.isInternetReachable;
  if (connected === false || reachable === false) return 'offline';
  if (connected === true) return 'online';
  return 'unknown';
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && error instanceof ApiError && error.isRetryable;
}

function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs !== undefined) return Math.min(error.retryAfterMs, 30_000);
  const base = Math.min(750 * 2 ** attempt, 5_000);
  return base + Math.round(Math.random() * 250);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined || query.meta?.silentError === true) return;
      const message = error instanceof ApiError ? error.message : 'Octamy could not load this information.';
      publishGlobalFeedback({ message, title: 'Unable to refresh', tone: 'error' });
    },
  }),
  defaultOptions: {
    mutations: { networkMode: 'online', retry: false },
    queries: {
      gcTime: 15 * 60_000,
      networkMode: 'online',
      refetchInterval: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: shouldRetry,
      retryDelay,
      staleTime: 60_000,
    },
  },
});

export const queryStaleTime = Object.freeze({
  active: 0,
  catalog: 5 * 60_000,
  categories: 10 * 60_000,
  user: 30_000,
});

export function MobileQueryProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NetworkStatus>('unknown');

  useEffect(() => {
    const update = (state: NetInfoState) => {
      const next = networkStatus(state);
      setStatus(next);
      onlineManager.setOnline(next !== 'offline');
    };
    const unsubscribe = NetInfo.addEventListener(update);
    void NetInfo.fetch().then(update).catch(() => setStatus('unknown'));
    return unsubscribe;
  }, []);

  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => subscription.remove();
  }, []);

  const value = useMemo(() => status, [status]);
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(NetworkContext.Provider, { value }, children),
  );
}

export function useNetworkStatus(): NetworkStatus {
  return useContext(NetworkContext);
}

export function GlobalNetworkBanner() {
  const status = useNetworkStatus();
  const insets = useSafeAreaInsets();
  if (status !== 'offline') return null;

  return createElement(
    View,
    { pointerEvents: 'box-none', style: [styles.overlay, { paddingTop: insets.top + spacing.sm }] },
    createElement(Banner, {
      message: 'Server actions are paused. Recoverable exam work saved on this device remains available.',
      title: 'You are offline',
      tone: 'warning',
    }),
  );
}

const styles = StyleSheet.create({
  overlay: {
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    zIndex: 900,
  },
});
