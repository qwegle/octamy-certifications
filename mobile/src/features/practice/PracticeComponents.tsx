import { type Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Badge, Button, Card, Heading, Skeleton, Text } from '@/components/ui';
import { motion, spacing, useMotionSettings } from '@/theme';
import type { PracticeAssessment, PracticeSubscription } from './practice.types';
import { hasActivePracticePass, practicePlanLabel } from './practice.types';

function detailHref(item: PracticeAssessment): Href {
  return { pathname: '/practice/[courseId]', params: { courseId: String(item.id) } } as Href;
}

function formatValue(value: number | string | null | undefined, suffix: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return `${value}${suffix}`;
}

export function PracticeCatalogCard({ index, item }: { index: number; item: PracticeAssessment }) {
  const { reduceMotion } = useMotionSettings();
  const duration = Math.min(motion.duration.enter + index * 8, 280);
  const durationLabel = formatValue(item.duration, typeof item.duration === 'number' ? ' min' : '');
  const targetLabel = formatValue(item.passingScore, '% target');

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(duration).easing(motion.easing.enter)}>
      <Card accessibilityLabel={`${item.title}, practice assessment`}>
        <View style={styles.badges}>
          <Badge label="Practice only" tone="accent" />
          {item.category?.name ? <Badge label={item.category.name} tone="neutral" /> : null}
          {item.level ? <Badge label={item.level} /> : null}
        </View>
        <Heading level={3}>{item.title}</Heading>
        {item.description ? <Text muted numberOfLines={3}>{item.description}</Text> : null}
        <View style={styles.meta}>
          {durationLabel ? <Text variant="small">Duration: {durationLabel}</Text> : null}
          {targetLabel ? <Text variant="small">Goal: {targetLabel}</Text> : null}
        </View>
        <Text muted variant="small">This is low-stakes practice. It does not issue a certificate or count as an official certification attempt.</Text>
        <Button label={`View ${item.title}`} onPress={() => router.push(detailHref(item))} variant="secondary" />
      </Card>
    </Animated.View>
  );
}

export function PracticeCatalogSkeleton() {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading practice assessments" style={styles.list}>
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <Skeleton height={22} width={112} />
          <Skeleton height={28} width="76%" />
          <Skeleton height={18} />
          <Skeleton height={18} width="88%" />
          <Skeleton height={48} />
        </Card>
      ))}
    </View>
  );
}

export function EntitlementSummary({ subscription }: { subscription: PracticeSubscription }) {
  const learner = subscription.learner;
  const active = hasActivePracticePass(subscription);
  return (
    <View accessibilityLiveRegion="polite" style={styles.entitlement}>
      <Badge label={active ? 'Access confirmed' : 'No active access'} tone={active ? 'success' : 'warning'} />
      <Text variant="bodyStrong">{active ? 'Practice Pass is active' : 'Practice Pass is not active'}</Text>
      <Text muted variant="small">
        {active
          ? `Server-confirmed plan: ${practicePlanLabel(learner?.plan)}${learner?.renewsAt ? `. Active until ${new Date(learner.renewsAt).toLocaleDateString()}.` : '.'}`
          : 'Only the Octamy server can grant practice access after the payment provider confirms an order.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  entitlement: { gap: spacing.sm },
  list: { gap: spacing.lg },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
