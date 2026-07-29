import { useQuery } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { AccountRequiredState } from '@/features/certifications/AccountRequiredState';
import { getCertification } from '@/features/certifications/api';
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
  const examHref = {
    pathname: '/exam/[courseId]',
    params: { courseId: String(item.id), slug: item.slug, title: item.title },
  } as Href;
  const accountRequired = status === 'anonymous';
  const startLabel = status === 'authenticatedOffline' ? 'Reconnect to start free exam' : 'Start free certification exam';

  return (
    <Screen
      bottomAction={accountRequired ? undefined : (
        <Button disabled={!canMutate} label={startLabel} onPress={() => router.push(examHref)} />
      )}>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.enter)} style={styles.hero}>
        <View style={styles.badges}>
          <Badge label={item.certificationLabel} tone="accent" />
          {item.level ? <Badge label={item.level} /> : null}
        </View>
        <Heading>{item.title}</Heading>
        <Text muted>{item.description}</Text>
      </Animated.View>

      {accountRequired ? <AccountRequiredState onAuthenticated={() => undefined} /> : null}

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
          <Text variant="bodyStrong">Free assessment attempt</Text>
          <Text muted>There is no charge to start this exam. A signed-in, online account is required to save and validate the attempt.</Text>
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

      {!accountRequired && !canMutate ? <Text muted style={styles.center} variant="small">Reconnect and validate your session to start an exam.</Text> : null}
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
