import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { layout, spacing, useAppTheme } from '@/theme';
import { BrandLockup } from './Brand';
import { Heading, Text } from './Text';

export interface PageHeaderProps {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const phone = width < 640;
  return (
    <View style={[styles.header, phone ? styles.headerPhone : null]}>
      <BrandLockup compact />
      <View style={[styles.rule, { backgroundColor: colors.foreground }]} />
      <View style={[styles.titleRow, phone ? styles.titleRowPhone : null]}>
        <View style={styles.copy}>
          <Text variant="caption">{eyebrow}</Text>
          <Heading>{title}</Heading>
          <Text muted style={styles.description}>{description}</Text>
        </View>
        {actions ? <View style={[styles.actions, phone ? styles.actionsPhone : null]}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'stretch', gap: spacing.sm },
  actionsPhone: { width: '100%' },
  copy: { flex: 1, gap: spacing.sm, minWidth: 0 },
  description: { maxWidth: layout.readingMaxWidth },
  header: { gap: spacing.lg, paddingBottom: spacing.sm },
  headerPhone: { gap: spacing.md },
  rule: { height: 2, width: 48 },
  titleRow: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, justifyContent: 'space-between' },
  titleRowPhone: { alignItems: 'stretch', flexDirection: 'column', gap: spacing.lg },
});
