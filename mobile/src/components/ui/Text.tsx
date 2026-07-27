import type { ComponentProps } from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';

import { layout, typography, useAppTheme } from '@/theme';

type NativeTextProps = ComponentProps<typeof NativeText>;
type TextVariant = keyof typeof typography;

export interface TextProps extends NativeTextProps {
  muted?: boolean;
  variant?: TextVariant;
}

export function Text({ muted = false, style, variant = 'body', ...props }: TextProps) {
  const { colors } = useAppTheme();
  return (
    <NativeText
      {...props}
      style={[typography[variant], { color: muted ? colors.textMuted : colors.foreground }, style]}
    />
  );
}

export interface HeadingProps extends Omit<TextProps, 'variant'> {
  level?: 1 | 2 | 3;
}

export function Heading({ level = 1, style, ...props }: HeadingProps) {
  const variant = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
  return (
    <Text
      accessibilityRole="header"
      {...props}
      style={[styles.heading, style]}
      variant={variant}
    />
  );
}

const styles = StyleSheet.create({
  heading: { maxWidth: layout.readingMaxWidth },
});
