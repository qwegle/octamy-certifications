import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { layout, spacing, useAppTheme } from '@/theme';

type ViewProps = ComponentProps<typeof View>;

export interface ScreenProps extends ViewProps {
  bottomAction?: ReactNode;
  children: ReactNode;
  edges?: Edge[];
  scroll?: boolean;
}

export function Screen({ bottomAction, children, edges = ['top', 'left', 'right'], scroll = true, style, ...props }: ScreenProps) {
  const { colors } = useAppTheme();
  const content = scroll ? (
    <ScrollView
      {...props}
      contentContainerStyle={[styles.content, bottomAction ? styles.contentWithAction : null, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View {...props} style={[styles.content, styles.fixed, bottomAction ? styles.contentWithAction : null, style]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {content}
      {bottomAction ? (
        <SafeAreaView
          accessibilityLabel="Fixed actions"
          edges={['bottom', 'left', 'right']}
          style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.actionBarContent}>{bottomAction}</View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fixed: { flex: 1 },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    gap: spacing.xl,
    maxWidth: layout.contentMaxWidth,
    paddingBottom: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    width: '100%',
  },
  contentWithAction: { paddingBottom: spacing.xl },
  actionBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  actionBarContent: { alignSelf: 'center', maxWidth: layout.contentMaxWidth, width: '100%' },
});
