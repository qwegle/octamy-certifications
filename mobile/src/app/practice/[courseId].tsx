import { useQuery } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import {
  clearPracticeDraft,
  getPracticeDetail,
  getPracticeSubscription,
  hasActivePracticePass,
  readPracticeDraft,
  savePracticeDraft,
  startPracticeAttempt,
  type PracticeDraft,
} from '@/features/practice';
import { queryKeys } from '@/lib/query-keys';
import { asApiError } from '@/lib/api-client';
import { queryStaleTime } from '@/lib/query';
import { minimumTouchTarget, radii, spacing, useAppTheme } from '@/theme';

const practiceTabHref = '/(tabs)/practice' as Href;

export default function PracticeDetailScreen() {
  const { courseId: rawCourseId } = useLocalSearchParams<{ courseId?: string | string[] }>();
  const courseId = Number(Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId);
  const validCourseId = Number.isInteger(courseId) && courseId > 0;
  const { canMutate, user } = useSession();
  const { colors } = useAppTheme();
  const [draft, setDraft] = useState<PracticeDraft | null>(null);
  const [evidenceConsented, setEvidenceConsented] = useState(false);
  const [checkingDraft, setCheckingDraft] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const detailQuery = useQuery({
    enabled: validCourseId,
    queryKey: queryKeys.practice.detail(courseId),
    queryFn: ({ signal }) => getPracticeDetail(String(courseId), signal),
    staleTime: queryStaleTime.catalog,
  });
  const subscriptionQuery = useQuery({
    queryKey: queryKeys.practice.subscription,
    queryFn: ({ signal }) => getPracticeSubscription(signal),
    staleTime: queryStaleTime.active,
  });

  useEffect(() => {
    let active = true;
    if (!user || !validCourseId) {
      setCheckingDraft(false);
      return;
    }
    void readPracticeDraft(user.id, courseId).then(async (saved) => {
      if (!active) return;
      if (saved && !saved.tempExamId && Date.parse(saved.deadlineAt) <= Date.now()) {
        await clearPracticeDraft(user.id, courseId);
        if (active) setDraft(null);
      } else {
        setDraft(saved);
      }
      if (active) setCheckingDraft(false);
    }).catch(() => {
      if (active) setCheckingDraft(false);
    });
    return () => { active = false; };
  }, [courseId, user, validCourseId]);

  const openAttempt = () => {
    router.push({ pathname: '/practice/attempt/[courseId]', params: { courseId: String(courseId) } } as Href);
  };

  const startAttempt = async () => {
    if (!user || !detailQuery.data || !validCourseId || !canMutate || !evidenceConsented || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const attempt = await startPracticeAttempt(courseId);
      const nextDraft: PracticeDraft = {
        version: 1,
        userId: user.id,
        courseId,
        courseTitle: detailQuery.data.title,
        questions: attempt.questions,
        sessionId: attempt.sessionId,
        startedAt: attempt.startedAt,
        deadlineAt: attempt.deadlineAt,
        answers: {},
        updatedAt: new Date().toISOString(),
      };
      await savePracticeDraft(nextDraft);
      setDraft(nextDraft);
      openAttempt();
    } catch (error) {
      setStartError(asApiError(error).message);
    } finally {
      setStarting(false);
    }
  };

  if (!validCourseId) {
    return <Screen><ErrorState description="This practice assessment link is invalid." onRetry={() => router.replace(practiceTabHref)} retryLabel="Back to Practice" title="Assessment not found" /></Screen>;
  }

  if (detailQuery.isPending || subscriptionQuery.isPending || checkingDraft) {
    return (
      <Screen>
        <Skeleton height={20} width={120} />
        <Skeleton height={36} width="82%" />
        <Skeleton height={20} />
        <Card><Skeleton height={24} width="60%" /><Skeleton height={72} /><Skeleton height={48} /></Card>
      </Screen>
    );
  }

  if (detailQuery.isError) {
    return <Screen><ErrorState description="This practice assessment could not be loaded." onRetry={() => void detailQuery.refetch()} /></Screen>;
  }

  const activePass = hasActivePracticePass(subscriptionQuery.data);
  const detail = detailQuery.data;

  return (
    <Screen>
      <Button label="Back to Practice" onPress={() => router.back()} variant="ghost" />
      <View style={styles.header}>
        <Badge label="Practice only — no certificate" tone="accent" />
        <Heading>{detail.title}</Heading>
        {detail.description ? <Text muted>{detail.description}</Text> : null}
      </View>

      <Banner
        title="Separate from certification"
        message="This run is low-stakes practice. Its score is not an official certification result and cannot issue a credential."
      />

      <Card>
        <Heading level={2}>Before you begin</Heading>
        <Text>Questions are issued by the server for one timed session. Your selected answers are stored securely on this device so you can recover after an app or network interruption.</Text>
        <Text muted variant="small">Octamy has no server endpoint to sync in-progress answers or download an active session again. Keep this device until you submit. Final submission is safe to retry with the same session.</Text>
        <View style={styles.meta}>
          {detail.duration !== null && detail.duration !== undefined ? <Text variant="small">Duration: {detail.duration} minutes</Text> : null}
          {detail.passingScore !== null && detail.passingScore !== undefined ? <Text variant="small">Practice goal: {detail.passingScore}%</Text> : null}
        </View>
      </Card>

      {subscriptionQuery.isError ? (
        <ErrorState description="Practice access could not be verified. No access is inferred on this device." onRetry={() => void subscriptionQuery.refetch()} retryLabel="Verify access" title="Access not verified" />
      ) : !activePass ? (
        <Card>
          <Heading level={2}>Practice Pass required</Heading>
          <Text muted>The server does not currently confirm active Practice Pass access for this account.</Text>
          <Button label="View Practice Pass options" onPress={() => router.push(practiceTabHref)} />
        </Card>
      ) : draft ? (
        <Card>
          <Badge label={draft.tempExamId ? 'Submitted' : 'Saved on this device'} tone="success" />
          <Heading level={2}>{draft.tempExamId ? 'Review your result' : 'Resume this practice run'}</Heading>
          <Text muted>{draft.tempExamId ? 'Your submitted result is ready to load from the server.' : `Your answers and questions were saved at ${new Date(draft.updatedAt).toLocaleTimeString()}.`}</Text>
          <Button label={draft.tempExamId ? 'Open result' : 'Resume practice'} onPress={openAttempt} />
        </Card>
      ) : (
        <Card>
          <Heading level={2}>Ready to practise?</Heading>
          <Text muted variant="small">This timed Practice run stores progress on this device for recovery. It does not issue a credential or become recruiter-visible unless you later select its summary in a recruiter-specific evidence grant.</Text>
          <Pressable
            accessibilityHint="Allows Octamy to issue the timed server session and retain its submitted score, timing, and answer record."
            accessibilityLabel="I consent to Practice assessment evidence processing"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: evidenceConsented }}
            onPress={() => setEvidenceConsented((value) => !value)}
            style={[styles.consent, { backgroundColor: evidenceConsented ? colors.accentSoft : colors.surfaceMuted, borderColor: evidenceConsented ? colors.accent : colors.border }]}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.checkbox, { borderColor: evidenceConsented ? colors.accent : colors.textMuted }]}>
              <Text style={evidenceConsented ? { color: colors.accent } : undefined} variant="bodyStrong">{evidenceConsented ? '✓' : ''}</Text>
            </View>
            <View style={styles.consentCopy}>
              <Text variant="bodyStrong">I consent to Practice assessment evidence processing.</Text>
              <Text muted variant="small">Octamy stores the issued session, submitted answers, score, and timing. This Practice flow does not send app-switch counts, camera, microphone, video, or device details.</Text>
            </View>
          </Pressable>
          {startError ? <Banner message={startError} title="Practice could not start" tone="error" /> : null}
          <Button
            disabled={!canMutate || !evidenceConsented}
            label={starting ? 'Starting practice…' : 'Start practice run'}
            loading={starting}
            onPress={() => void startAttempt()}
          />
          {!canMutate ? <Text muted variant="small">Reconnect and validate your session before starting.</Text> : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  checkbox: { alignItems: 'center', borderRadius: radii.sm, borderWidth: 2, height: 28, justifyContent: 'center', width: 28 },
  consent: { alignItems: 'flex-start', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: minimumTouchTarget, padding: spacing.md },
  consentCopy: { flex: 1, gap: spacing.xs },
  header: { gap: spacing.md },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
});
