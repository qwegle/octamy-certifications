import { useQuery } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { getCertification, getCourseAccess } from '@/features/certifications/api';
import { formatDuration, formatPrice } from '@/features/certifications/format';
import { queryKeys } from '@/lib/query-keys';
import { motion, spacing, useAppReducedMotion } from '@/theme';

export default function CertificationDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { canMutate, status } = useSession();
  const reduceMotion = useAppReducedMotion();
  const detail = useQuery({
    enabled: Boolean(slug),
    queryKey: queryKeys.certifications.detail(slug),
    queryFn: ({ signal }) => getCertification(slug ?? '', signal),
  });
  const access = useQuery({
    enabled: Boolean(detail.data?.id),
    queryKey: queryKeys.certifications.access(detail.data?.id),
    queryFn: ({ signal }) => getCourseAccess(detail.data!.id, signal),
  });

  if (!slug) {
    return <Screen><ErrorState description="This certification link is incomplete." onRetry={() => router.back()} retryLabel="Go back" /></Screen>;
  }
  if (detail.isPending) {
    return (
      <Screen>
        <Skeleton width="30%" />
        <Skeleton height={36} width="85%" />
        <Skeleton height={72} />
        <Skeleton height={160} />
      </Screen>
    );
  }
  if (detail.isError || !detail.data) {
    return <Screen><ErrorState description="Certification details could not be loaded." onRetry={() => void detail.refetch()} /></Screen>;
  }

  const item = detail.data;
  const accessReady = access.data?.hasAccess === true;
  const canStart = canMutate && accessReady;
  const examHref = {
    pathname: '/exam/[courseId]',
    params: { courseId: String(item.id), slug: item.slug, title: item.title },
  } as Href;
  const accessLabel = access.isPending
    ? 'Checking access…'
    : access.isError
      ? 'Access check unavailable'
      : accessReady
        ? 'Start certification exam'
        : access.data?.requiresPurchase
          ? 'Course access required'
          : 'Exam unavailable';

  return (
    <Screen
      bottomAction={(
        <Button disabled={!canStart} label={accessLabel} loading={access.isPending} onPress={() => router.push(examHref)} />
      )}>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.enter)} style={styles.hero}>
        <View style={styles.badges}>
          <Badge label={item.certificationLabel} tone="accent" />
          {item.level ? <Badge label={item.level} /> : null}
        </View>
        <Heading>{item.title}</Heading>
        <Text muted>{item.description}</Text>
      </Animated.View>

      {status === 'authenticatedOffline' ? (
        <Banner message="You can review details, but starting a new server-issued exam requires a validated online session." title="Offline session" tone="warning" />
      ) : null}

      <Card>
        <Heading level={2}>Assessment</Heading>
        <View style={styles.facts}>
          <View style={styles.fact}><Text muted variant="small">Duration</Text><Text variant="bodyStrong">{formatDuration(item.duration)}</Text></View>
          <View style={styles.fact}><Text muted variant="small">Passing score</Text><Text variant="bodyStrong">{item.passingScore === null ? 'Not published' : `${item.passingScore}%`}</Text></View>
          <View style={styles.fact}><Text muted variant="small">Language</Text><Text variant="bodyStrong">{item.language ?? 'Not published'}</Text></View>
        </View>
      </Card>

      <Card>
        <Heading level={2}>Access and credential</Heading>
        <View style={styles.section}>
          <Text variant="bodyStrong">Assessment access</Text>
          {access.isError ? (
            <Text muted>The server could not confirm access. Retry before starting.</Text>
          ) : (
            <Text muted>{accessReady ? 'Your account may start this assessment.' : 'Assessment access is not currently available for this account.'}</Text>
          )}
          {access.isError ? <Button label="Retry access check" onPress={() => void access.refetch()} variant="secondary" /> : null}
        </View>
        <View style={styles.section}>
          <Text variant="bodyStrong">Verified credential activation</Text>
          <Text muted>{formatPrice(item.price)}. Passing does not itself activate a certificate; activation and payment confirmation are separate server-side steps.</Text>
        </View>
      </Card>

      <Card>
        <Heading level={2}>Syllabus</Heading>
        <Text muted>The current certification detail API does not publish a module or syllabus outline for this assessment. No outline is inferred or fabricated in the app.</Text>
      </Card>

      <Banner
        message="Your question set, deadline, and consent version are issued by the server. Answers are retained on this device for recovery until a successful, idempotent submission."
        title="Recoverable exam session"
      />

      {!canMutate ? <Text muted style={styles.center} variant="small">Reconnect and validate your session to start an exam.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  center: { textAlign: 'center' },
  fact: { flex: 1, gap: spacing.xs, minWidth: 100 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  hero: { gap: spacing.md },
  section: { gap: spacing.xs },
});
