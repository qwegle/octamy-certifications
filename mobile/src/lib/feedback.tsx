import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '@/components/ui';
import { motion, spacing, useAppReducedMotion } from '@/theme';

export type FeedbackTone = 'error' | 'info' | 'success' | 'warning';

export interface ToastMessage {
  durationMs?: number;
  message: string;
  title?: string;
  tone?: FeedbackTone;
}

interface FeedbackContextValue {
  dismissToast: () => void;
  showToast: (message: ToastMessage) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);
const externalListeners = new Set<(message: ToastMessage) => void>();

export function publishGlobalFeedback(message: ToastMessage): void {
  for (const listener of externalListeners) listener(message);
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastMessage & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useAppReducedMotion();

  const dismissToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((message: ToastMessage) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...message, id: Date.now() });
    timer.current = setTimeout(() => {
      timer.current = null;
      setToast(null);
    }, message.durationMs ?? 5_000);
  }, []);

  useEffect(() => {
    externalListeners.add(showToast);
    return () => {
      externalListeners.delete(showToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [showToast]);

  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + spacing.sm }]}>
        {toast ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.enter)}
            exiting={reduceMotion ? undefined : FadeOutUp.duration(motion.duration.feedback).easing(motion.easing.feedback)}
            key={toast.id}>
            <Toast
              message={toast.message}
              onDismiss={dismissToast}
              title={toast.title}
              tone={toast.tone}
            />
          </Animated.View>
        ) : null}
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider.');
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    zIndex: 1000,
  },
});
