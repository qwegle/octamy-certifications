import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii, spacing, useAppTheme } from '@/theme';

type ViewProps = ComponentProps<typeof View>;

export interface CardProps extends ViewProps {
  tone?: 'calm' | 'marketing';
}

export function Card({ children, style, tone = 'calm', ...props }: CardProps) {
  const { colors } = useAppTheme();
  const marketing = tone === 'marketing';

  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: marketing ? colors.foreground : colors.border,
          borderWidth: marketing ? 2 : 1,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
});
