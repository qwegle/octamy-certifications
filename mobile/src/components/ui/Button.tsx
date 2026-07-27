import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { minimumTouchTarget, motion, radii, spacing, typography, useAppTheme, useMotionSettings } from '@/theme';
import { Text } from './Text';

type PressableProps = ComponentProps<typeof Pressable>;
type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'accessibilityRole'> {
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
}

export function Button({
  accessibilityLabel,
  accessibilityState,
  disabled,
  label,
  loading = false,
  onPressIn,
  onPressOut,
  style,
  variant = 'primary',
  ...props
}: ButtonProps) {
  const { colors } = useAppTheme();
  const { duration, pressedScale } = useMotionSettings();
  const scale = useSharedValue(1);
  const unavailable = Boolean(disabled || loading);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const palette = {
    primary: { background: colors.primary, border: colors.primary, text: colors.onPrimary },
    secondary: { background: colors.surface, border: colors.foreground, text: colors.foreground },
    accent: { background: colors.primary, border: colors.primary, text: colors.onPrimary },
    danger: { background: colors.destructive, border: colors.destructive, text: colors.onDestructive },
    ghost: { background: 'transparent', border: 'transparent', text: colors.foreground },
  }[variant];

  return (
    <Animated.View style={[animatedStyle, unavailable && styles.disabled]}>
      <Pressable
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityState={{ ...accessibilityState, busy: loading, disabled: unavailable }}
        disabled={unavailable}
        onPressIn={(event) => {
          scale.value = withTiming(pressedScale, { duration, easing: motion.easing.feedback });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withTiming(1, { duration, easing: motion.easing.feedback });
          onPressOut?.(event);
        }}
        style={(state) => [
          styles.button,
          { backgroundColor: palette.background, borderColor: palette.border },
          state.pressed && styles.pressed,
          typeof style === 'function' ? style(state) : style,
        ]}>
        <Text style={[typography.label, { color: palette.text, textAlign: 'center' }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.42 },
});
