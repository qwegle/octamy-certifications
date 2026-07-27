import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { BrandLockup, Button, Screen, Text } from '@/components/ui';
import { completeOnboarding } from '@/features/auth';
import { motion, radii, spacing, useAppReducedMotion, useAppTheme } from '@/theme';

const steps = [
  { number: '01', eyebrow: 'PROFESSIONAL EVIDENCE', title: 'Your skills deserve more than a claim.', description: 'Turn reviewed assessments into inspectable career evidence and verified credentials.' },
  { number: '02', eyebrow: 'PRIVATE PRACTICE', title: 'Prepare without putting your profile at risk.', description: 'Practice exams and interview rehearsal stay separate from official evidence. Local video stays on your device.' },
  { number: '03', eyebrow: 'CONSENT BY DESIGN', title: 'You decide when your evidence becomes visible.', description: 'Recruiter discovery and public evidence links begin off and can be controlled independently.' },
] as const;

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const { colors } = useAppTheme();
  const reduceMotion = useAppReducedMotion();
  const step = steps[index] ?? steps[0];

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    await completeOnboarding().catch(() => undefined);
    router.replace('/(auth)/login');
  };

  const next = () => {
    if (index === steps.length - 1) { void finish(); return; }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    void AccessibilityInfo.announceForAccessibility(`Onboarding step ${nextIndex + 1} of ${steps.length}.`);
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.topbar}>
        <BrandLockup compact />
        <Button label="Skip onboarding" onPress={() => void finish()} variant="ghost" />
      </View>

      <View accessible accessibilityLabel={`Step ${index + 1} of ${steps.length}`} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: index + 1 }} style={styles.progress}>
        {steps.map((item, itemIndex) => (
          <View key={item.number} style={[styles.progressTrack, { backgroundColor: itemIndex <= index ? colors.foreground : colors.border }]} />
        ))}
      </View>

      <Animated.View entering={reduceMotion ? undefined : FadeInRight.duration(motion.duration.enter).easing(motion.easing.enter)} key={step.number} style={styles.content}>
        <View style={[styles.visual, { backgroundColor: colors.primary }]}>
          <Text style={[styles.visualNumber, { color: colors.onPrimary }]}>{step.number}</Text>
          <View style={[styles.evidenceCard, { borderColor: colors.onPrimary }]}>
            <View style={[styles.evidenceLine, { backgroundColor: colors.onPrimary }]} />
            <View style={[styles.evidenceLineShort, { backgroundColor: colors.onPrimary }]} />
            <View style={[styles.evidenceSeal, { borderColor: colors.onPrimary }]} />
          </View>
          <Text style={{ color: colors.onPrimary }} variant="caption">LEARN · VALIDATE · CERTIFY</Text>
        </View>
        <View style={styles.copy}>
          <Text variant="caption">{step.eyebrow}</Text>
          <Text variant="display">{step.title}</Text>
          <Text muted>{step.description}</Text>
        </View>
      </Animated.View>

      <View style={styles.actions}>
        {index > 0 ? <Button label="Back" onPress={() => setIndex((value) => Math.max(0, value - 1))} variant="secondary" /> : null}
        <View style={styles.primaryAction}>
          <Button label={index === steps.length - 1 ? (finishing ? 'Opening secure sign in…' : 'Continue to sign in') : 'Continue'} loading={finishing} onPress={next} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'stretch', flexDirection: 'row', gap: spacing.sm },
  content: { flex: 1, gap: spacing.xl, justifyContent: 'center' },
  copy: { gap: spacing.md },
  evidenceCard: { borderRadius: radii.sm, borderWidth: 2, height: 132, justifyContent: 'center', padding: spacing.lg, width: 190 },
  evidenceLine: { height: 3, marginBottom: spacing.md, width: 108 },
  evidenceLineShort: { height: 3, width: 72 },
  evidenceSeal: { borderRadius: 24, borderWidth: 2, bottom: spacing.lg, height: 42, position: 'absolute', right: spacing.lg, width: 42 },
  primaryAction: { flex: 1 },
  progress: { flexDirection: 'row', gap: spacing.sm },
  progressTrack: { flex: 1, height: 3 },
  screen: { minHeight: '100%' },
  topbar: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  visual: { alignItems: 'center', borderRadius: radii.lg, gap: spacing.lg, minHeight: 280, overflow: 'hidden', padding: spacing.xl },
  visualNumber: { fontSize: 88, fontWeight: '700', lineHeight: 96, opacity: 0.12, position: 'absolute', right: spacing.lg, top: spacing.sm },
});
