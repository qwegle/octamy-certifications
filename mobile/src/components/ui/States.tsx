import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button } from './Button';
import { Heading, Text } from './Text';

export interface EmptyStateProps {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
}

export function EmptyState({ actionLabel, description, onAction, title }: EmptyStateProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.symbol}>○</Text>
      <Heading level={3} style={styles.center}>{title}</Heading>
      <Text muted style={styles.center}>{description}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

export interface ErrorStateProps {
  description?: string;
  onRetry: () => void;
  retryLabel?: string;
  title?: string;
}

export function ErrorState({ description = 'Check your connection and try again.', onRetry, retryLabel = 'Try again', title = 'Something went wrong' }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View accessible accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.announcement}>
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.symbol}>!</Text>
        <Heading level={3} style={styles.center}>{title}</Heading>
        <Text muted style={styles.center}>{description}</Text>
      </View>
      <Button label={retryLabel} onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  announcement: { alignItems: 'center', gap: spacing.md },
  container: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  center: { textAlign: 'center' },
  symbol: { fontSize: 32, lineHeight: 40 },
});
