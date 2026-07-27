import { Pressable, StyleSheet, View } from 'react-native';

import { minimumTouchTarget, radii, spacing, useAppTheme } from '@/theme';
import { Text } from './Text';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

interface FeedbackProps {
  dismissLabel?: string;
  message: string;
  onDismiss?: () => void;
  title?: string;
  tone?: FeedbackTone;
}

function Feedback({ dismissLabel = 'Dismiss notification', message, onDismiss, title, tone = 'info' }: FeedbackProps) {
  const { colors } = useAppTheme();
  const palette = {
    info: { background: colors.surfaceMuted, border: colors.border, text: colors.foreground },
    success: { background: colors.successSoft, border: colors.success, text: colors.success },
    warning: { background: colors.warningSoft, border: colors.warning, text: colors.warning },
    error: { background: colors.surface, border: colors.destructive, text: colors.destructive },
  }[tone];

  return (
    <View
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.copy}>
        {title ? <Text style={{ color: palette.text }} variant="bodyStrong">{title}</Text> : null}
        <Text style={{ color: palette.text }} variant="small">{message}</Text>
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityLabel={dismissLabel}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
          <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: palette.text }} variant="h3">×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Banner(props: FeedbackProps) {
  return <Feedback {...props} />;
}

export function Toast(props: FeedbackProps) {
  return <Feedback {...props} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  copy: { flex: 1, gap: spacing.xs },
  dismiss: { alignItems: 'center', justifyContent: 'center', minHeight: minimumTouchTarget, minWidth: minimumTouchTarget },
  pressed: { opacity: 0.55 },
});
