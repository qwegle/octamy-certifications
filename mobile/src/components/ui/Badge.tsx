import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii, spacing, useAppTheme } from '@/theme';
import { Text } from './Text';

type ViewProps = ComponentProps<typeof View>;
type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning';

export interface BadgeProps extends ViewProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, style, tone = 'neutral', ...props }: BadgeProps) {
  const { colors } = useAppTheme();
  const palette = {
    neutral: { background: 'transparent', border: colors.border, text: colors.foreground },
    accent: { background: colors.foreground, border: colors.foreground, text: colors.background },
    success: { background: colors.successSoft, border: colors.success, text: colors.success },
    warning: { background: colors.warningSoft, border: colors.warning, text: colors.warning },
  }[tone];

  return (
    <View
      {...props}
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: palette.background, borderColor: palette.border }, style]}>
      <Text style={{ color: palette.text, textTransform: 'uppercase' }} variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
