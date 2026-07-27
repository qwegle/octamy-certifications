import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { Easing, useReducedMotion } from 'react-native-reanimated';

export const motion = {
  duration: {
    instant: 1,
    fast: 120,
    feedback: 180,
    enter: 240,
  },
  easing: {
    enter: Easing.out(Easing.cubic),
    feedback: Easing.out(Easing.quad),
  },
  scale: {
    enterFrom: 0.96,
    pressed: 0.98,
  },
  gestureSpring: {
    damping: 22,
    stiffness: 260,
    mass: 0.8,
  },
} as const;

/**
 * Combines Reanimated's synchronous preference with React Native's live
 * AccessibilityInfo updates. Non-essential motion should be omitted when true.
 */
export function useAppReducedMotion(): boolean {
  const reanimatedPreference = useReducedMotion();
  const [nativePreference, setNativePreference] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setNativePreference(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setNativePreference,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return Boolean(reanimatedPreference || nativePreference);
}

export function resolveMotionSettings(reduceMotion: boolean) {
  return {
    reduceMotion,
    duration: reduceMotion ? motion.duration.instant : motion.duration.feedback,
    enterDuration: reduceMotion ? motion.duration.instant : motion.duration.enter,
    pressedScale: reduceMotion ? 1 : motion.scale.pressed,
  } as const;
}

export function useMotionSettings() {
  return resolveMotionSettings(useAppReducedMotion());
}
