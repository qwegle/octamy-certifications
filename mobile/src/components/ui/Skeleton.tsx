import { useEffect } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { motion, radii, useAppTheme, useAppReducedMotion } from '@/theme';

export interface SkeletonProps {
  height?: number;
  style?: ViewStyle;
  width?: ViewStyle['width'];
}

export function Skeleton({ height = 16, style, width = '100%' }: SkeletonProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useAppReducedMotion();
  const opacity = useSharedValue(0.48);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 0.64;
      return;
    }
    opacity.value = withRepeat(withTiming(0.9, { duration: 700, easing: motion.easing.enter }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { backgroundColor: colors.skeleton, height, width }, animatedStyle, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.sm },
});
