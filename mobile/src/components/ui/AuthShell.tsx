import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, radii, spacing, useAppTheme } from '@/theme';
import { BrandLockup, BrandMark } from './Brand';
import { Heading, Text } from './Text';

export interface AuthShellProps {
  children: ReactNode;
  description: string;
  eyebrow: string;
  footer?: ReactNode;
  title: string;
}

const proofSteps = [
  ['01', 'LEARN', 'Build role-relevant capability.'],
  ['02', 'VALIDATE', 'Complete evidence-backed assessment.'],
  ['03', 'CERTIFY', 'Carry proof employers can inspect.'],
] as const;

export function AuthShell({ children, description, eyebrow, footer, title }: AuthShellProps) {
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const wide = width >= 820;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.page, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <BrandLockup />
          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={[styles.manifesto, { backgroundColor: colors.primary }, wide && styles.manifestoWide]}>
              <View style={styles.manifestoTop}>
                <BrandMark inverse size={40} />
                <Text style={{ color: colors.onPrimary }} variant="caption">THE SKILL EVIDENCE STANDARD</Text>
              </View>
              <View style={styles.manifestoCopy}>
                <Text style={[styles.manifestoTitle, { color: colors.onPrimary }]} variant={wide ? 'display' : 'h2'}>
                  {wide ? <>Proof of skill.{`\n`}Built to travel.</> : 'Proof of skill, built to travel.'}
                </Text>
                <Text style={{ color: colors.onPrimary }}>
                  Learn, validate, certify, and control how your professional evidence is shared.
                </Text>
              </View>
              {wide ? (
                <View style={[styles.steps, { borderTopColor: colors.onPrimary }]}>
                  {proofSteps.map(([number, label, copy]) => (
                    <View key={number} style={styles.step}>
                      <Text style={[styles.stepNumber, { color: colors.onPrimary }]} variant="caption">{number}</Text>
                      <View style={styles.stepCopy}>
                        <Text style={{ color: colors.onPrimary }} variant="label">{label}</Text>
                        <Text style={{ color: colors.onPrimary, opacity: 0.72 }} variant="small">{copy}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={[styles.formPanel, { backgroundColor: colors.surface, borderColor: colors.border }, wide && styles.formPanelWide]}>
              <View style={styles.formIntro}>
                <Text variant="caption">{eyebrow}</Text>
                <Heading>{title}</Heading>
                <Text muted>{description}</Text>
              </View>
              <View style={styles.formBody}>{children}</View>
              {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
            </View>
          </View>
          <View style={styles.trustRow}>
            <Text muted variant="caption">PRIVATE BY DEFAULT</Text>
            <View style={[styles.trustRule, { backgroundColor: colors.border }]} />
            <Text muted variant="caption">SERVER-VERIFIED EVIDENCE</Text>
            <View style={[styles.trustRule, { backgroundColor: colors.border }]} />
            <Text muted variant="caption">LEARNER-CONTROLLED SHARING</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  footer: { borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.lg },
  formBody: { gap: spacing.lg },
  formIntro: { gap: spacing.md },
  formPanel: { borderRadius: radii.lg, borderWidth: 1, gap: spacing.xl, padding: spacing.xl },
  formPanelWide: { flex: 1, justifyContent: 'center', minHeight: 620, paddingHorizontal: spacing['2xl'] },
  grid: { gap: spacing.lg },
  gridWide: { alignItems: 'stretch', flexDirection: 'row' },
  manifesto: { borderRadius: radii.lg, gap: spacing.lg, justifyContent: 'space-between', minHeight: 200, padding: spacing.xl },
  manifestoCopy: { gap: spacing.lg, maxWidth: 440 },
  manifestoTitle: { maxWidth: 460 },
  manifestoTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  manifestoWide: { flex: 1.15, minHeight: 620, padding: spacing['2xl'] },
  page: { flexGrow: 1 },
  safeArea: { flex: 1 },
  shell: { alignSelf: 'center', gap: spacing.xl, maxWidth: layout.authMaxWidth, paddingBottom: spacing['3xl'], paddingHorizontal: spacing.xl, paddingTop: spacing.xl, width: '100%' },
  step: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  stepCopy: { flex: 1, gap: spacing.xs },
  stepNumber: { minWidth: 28, opacity: 0.56 },
  steps: { borderTopWidth: 1, gap: spacing.lg, paddingTop: spacing.xl },
  trustRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trustRule: { height: 1, minWidth: 20 },
});
