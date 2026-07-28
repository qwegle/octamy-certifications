import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Badge, Banner, Button, Card, EmptyState, ErrorState, Heading, PageHeader, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { getInterviewSessions, getInterviewStatus, listRecordings } from '@/features/interview';
import { queryKeys } from '@/lib/query-keys';
import { motion, spacing, useAppReducedMotion } from '@/theme';

const sessionHref = '/interview/session' as Href;
const introductionHref = '/interview/introduction' as Href;
const recordingsHref = '/interview/recordings' as Href;
const privacyHref = '/settings/privacy' as Href;

function readableStatus(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export default function InterviewScreen() {
  const { canMutate, user } = useSession();
  const reduceMotion = useAppReducedMotion();
  const [localCount, setLocalCount] = useState(0);
  const statusQuery = useQuery({ queryFn: getInterviewStatus, queryKey: queryKeys.interview.status });
  const sessionsQuery = useQuery({
    enabled: Boolean(user),
    queryFn: getInterviewSessions,
    queryKey: queryKeys.interview.sessions,
  });

  useFocusEffect(useCallback(() => {
    if (!user) return;
    void listRecordings(user.id).then((items) => setLocalCount(items.length)).catch(() => setLocalCount(0));
  }, [user]));

  const retry = () => {
    void statusQuery.refetch();
    void sessionsQuery.refetch();
  };

  return (
    <Screen>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.enter)}>
        <PageHeader
          description="Rehearse role-based interviews on your terms. Server practice stays private and optional video remains on this device."
          eyebrow="PRIVATE INTERVIEW STUDIO"
          title="Practice how you present your skills"
        />
      </Animated.View>

      <Banner
        message="Typed responses go to Octamy only when you consent to an Interview Studio session. Videos stay in this app's private storage and are never uploaded."
        title="Two separate privacy boundaries"
        tone="info"
      />

      {statusQuery.isError ? (
        <ErrorState description="Interview Studio status could not be verified. Local recordings remain available." onRetry={retry} title="Studio status unavailable" />
      ) : (
        <Card tone="marketing">
          <View style={styles.row}>
            <View style={styles.grow}>
              <Heading level={2}>Skill-specific interview practice</Heading>
              <Text muted>Choose a published role-and-skill template and submit typed or code responses. Private AI feedback appears only when the server reports it is enabled.</Text>
            </View>
            <Badge
              label={statusQuery.data?.aiEvaluationEnabled ? 'AI feedback available' : 'AI feedback unavailable'}
              tone={statusQuery.data?.aiEvaluationEnabled ? 'success' : 'warning'}
            />
          </View>
          {!statusQuery.isLoading && statusQuery.data?.practiceEnabled === false ? (
            <Banner message="The server has disabled Interview Studio in this environment." title="Practice unavailable" tone="warning" />
          ) : null}
          <Button
            disabled={!canMutate || statusQuery.isLoading || statusQuery.data?.practiceEnabled === false}
            label={statusQuery.isLoading ? 'Checking availability…' : 'Choose an interview'}
            onPress={() => router.push(sessionHref)}
            variant="accent"
          />
          {!canMutate ? <Text muted variant="small">Connect to the internet to create or update a server practice session.</Text> : null}
        </Card>
      )}

      <Card tone="marketing">
        <View style={styles.row}>
          <View style={styles.grow}>
            <Heading level={2}>Personal introduction studio</Heading>
            <Text muted>Write or update your About me, rehearse with adjustable teleprompter text, review professional recording guidance, and make a private local take.</Text>
          </View>
          <Badge label="Private local video" tone="accent" />
        </View>
        <Button label="Prepare my introduction" onPress={() => router.push(introductionHref)} variant="accent" />
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Heading level={2}>Recruiter visibility</Heading>
            <Text muted>Local interview videos are not uploaded and cannot be seen by recruiters. Octamy has no verified video-sharing API, so the app will not claim or simulate recruiter video access.</Text>
          </View>
          <Badge label="Video sharing off" tone="neutral" />
        </View>
        <Text variant="small">Your eligible evidence passport has separate, explicit discovery and public-link consent controls. Those settings do not include these local videos.</Text>
        <Button label="Manage evidence visibility" onPress={() => router.push(privacyHref)} variant="secondary" />
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.grow}>
            <Heading level={2}>Local recordings</Heading>
            <Text muted>{localCount === 1 ? '1 recording on this device' : `${localCount} recordings on this device`}</Text>
          </View>
          <Badge label="Never uploaded" tone="neutral" />
        </View>
        <Button label="Review retention and recordings" onPress={() => router.push(recordingsHref)} variant="secondary" />
      </Card>

      {sessionsQuery.isPending ? (
        <View accessibilityLabel="Loading private interview sessions" accessibilityRole="progressbar" style={styles.section}>
          <Heading level={2}>Recent private sessions</Heading>
          <Card><Skeleton height={22} width="60%" /><Skeleton height={18} width="82%" /><Skeleton height={48} /></Card>
        </View>
      ) : sessionsQuery.isError ? (
        <ErrorState description="Your private Interview Studio sessions could not be loaded." onRetry={() => void sessionsQuery.refetch()} title="Sessions unavailable" />
      ) : sessionsQuery.data?.items.length ? (
        <View style={styles.section}>
          <Heading level={2}>Recent private sessions</Heading>
          {sessionsQuery.data.items.slice(0, 3).map((session) => (
            <Card key={session.id}>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Text variant="bodyStrong">{session.templateKey.replaceAll('-', ' ')}</Text>
                  <Text muted variant="small">{readableStatus(session.status)} · retained by the server until {new Date(session.retentionUntil).toLocaleDateString()}</Text>
                </View>
                <Badge label={readableStatus(session.evaluationStatus)} tone={session.evaluationStatus === 'completed' ? 'success' : 'neutral'} />
              </View>
              <Button
                label="Open session"
                onPress={() => router.push({ pathname: '/interview/session', params: { sessionId: session.id } } as Href)}
                variant="ghost"
              />
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState description="Start a private role-and-skill practice session when you are ready." title="No private sessions yet" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: spacing.sm },
  hero: { gap: spacing.md },
  row: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  section: { gap: spacing.md },
});
