import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

import { Badge, Banner, Button, Card, EmptyState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import {
  clearPracticeDraft,
  readPracticeDraft,
  savePracticeDraft,
  submitPracticeAttempt,
  type PracticeDraft,
} from '@/features/practice';
import { formatClock } from '@/lib/format';
import { asApiError } from '@/lib/api-client';
import { motion, radii, spacing, useAppTheme, useMotionSettings } from '@/theme';

function formatRemaining(deadlineAt: string, now: number): string {
  return formatClock(Math.ceil((Date.parse(deadlineAt) - now) / 1_000));
}

export default function PracticeAttemptScreen() {
  const { courseId: rawCourseId } = useLocalSearchParams<{ courseId?: string | string[] }>();
  const courseId = Number(Array.isArray(rawCourseId) ? rawCourseId[0] : rawCourseId);
  const { canMutate, user } = useSession();
  const { colors } = useAppTheme();
  const { reduceMotion } = useMotionSettings();
  const [draft, setDraft] = useState<PracticeDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [timerAnnouncement, setTimerAnnouncement] = useState<string | null>(null);
  const lastAnnouncement = useRef<number | null>(null);
  const validCourseId = Number.isInteger(courseId) && courseId > 0;

  useEffect(() => {
    let active = true;
    if (!user || !validCourseId) {
      setLoading(false);
      return;
    }
    void readPracticeDraft(user.id, courseId).then((saved) => {
      if (!active) return;
      setDraft(saved);
      setLoading(false);
      if (saved?.tempExamId) {
        router.replace({ pathname: '/practice/results/[tempExamId]', params: { tempExamId: saved.tempExamId, courseId: String(courseId) } } as Href);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [courseId, user, validCourseId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const remainingSeconds = draft ? Math.max(0, Math.ceil((Date.parse(draft.deadlineAt) - now) / 1_000)) : null;

  useEffect(() => {
    if (remainingSeconds === null) return;
    const milestone = remainingSeconds === 0
      || remainingSeconds === 10
      || remainingSeconds === 30
      || remainingSeconds === 60
      || (remainingSeconds > 60 && remainingSeconds % 300 === 0);
    if (!milestone || lastAnnouncement.current === remainingSeconds) return;
    lastAnnouncement.current = remainingSeconds;
    setTimerAnnouncement(
      remainingSeconds === 0
        ? 'Practice time has ended. Submit to see your review.'
        : `${formatClock(remainingSeconds)} remaining in this practice run.`,
    );
  }, [remainingSeconds]);

  const answeredCount = useMemo(() => draft ? Object.keys(draft.answers).length : 0, [draft]);
  const expired = draft ? Date.parse(draft.deadlineAt) <= now : false;
  const question = draft?.questions[questionIndex];

  const selectAnswer = (answerIndex: number) => {
    if (!draft || !question || expired || submitting) return;
    const next: PracticeDraft = {
      ...draft,
      answers: { ...draft.answers, [String(question.id)]: answerIndex },
      updatedAt: new Date().toISOString(),
    };
    setDraft(next);
    setSubmitError(null);
    void savePracticeDraft(next).catch(() => setSubmitError('This answer could not be saved on this device. Please try selecting it again.'));
  };

  const submit = async () => {
    if (!draft || !canMutate || submitting || expired) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitPracticeAttempt({
        answers: draft.answers,
        courseId: draft.courseId,
        sessionId: draft.sessionId,
      });
      const submittedDraft = { ...draft, tempExamId: result.tempExamId, updatedAt: new Date().toISOString() };
      await savePracticeDraft(submittedDraft);
      setDraft(submittedDraft);
      router.replace({ pathname: '/practice/results/[tempExamId]', params: { tempExamId: result.tempExamId, courseId: String(courseId) } } as Href);
    } catch (error) {
      setSubmitError(asApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const discardExpired = async () => {
    if (!user || !validCourseId) return;
    await clearPracticeDraft(user.id, courseId);
    router.replace({ pathname: '/practice/[courseId]', params: { courseId: String(courseId) } } as Href);
  };

  if (loading) {
    return <Screen><Skeleton height={24} width={160} /><Skeleton height={36} width="74%" /><Card><Skeleton height={80} /><Skeleton height={52} /><Skeleton height={52} /></Card></Screen>;
  }

  if (!draft || !question) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Back to assessment"
          description="No recoverable practice run was found on this device. Start a new run from the assessment page."
          onAction={() => router.replace({ pathname: '/practice/[courseId]', params: { courseId: String(courseId) } } as Href)}
          title="No saved practice run"
        />
      </Screen>
    );
  }

  if (expired) {
    return (
      <Screen>
        <Badge label="Practice only" tone="accent" />
        <Heading>Time has ended</Heading>
        <Banner title="This session expired" message="The server deadline has passed, so this saved run can no longer be submitted. Start a new low-stakes practice session." tone="warning" />
        <Button label="Discard expired run" onPress={() => void discardExpired()} variant="danger" />
      </Screen>
    );
  }

  if (reviewing) {
    const unanswered = draft.questions.length - answeredCount;
    return (
      <Screen>
        <Badge label="Practice review — not certification" tone="accent" />
        <Heading>Review before submitting</Heading>
        <Card>
          <Text variant="bodyStrong">Answered {answeredCount} of {draft.questions.length}</Text>
          <Text muted>{unanswered > 0 ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} unanswered. Unanswered questions count as incorrect.` : 'Every question has a selected answer.'}</Text>
          <Text muted variant="small">Correctness is intentionally unavailable during the run. The server returns the full answer review after submission.</Text>
        </Card>
        {submitError ? <Banner title="Submission not completed" message={`${submitError} Your questions and answers remain saved on this device; retry uses the same server session.`} tone="error" /> : null}
        {!canMutate ? <Banner title="Reconnect to submit" message="Your work remains saved locally. Final submission needs a validated online session." tone="warning" /> : null}
        <Button label={submitting ? 'Submitting practice…' : 'Submit practice for review'} loading={submitting} disabled={!canMutate} onPress={() => void submit()} />
        <Button label="Return to questions" disabled={submitting} onPress={() => setReviewing(false)} variant="secondary" />
      </Screen>
    );
  }

  const selected = draft.answers[String(question.id)];

  return (
    <Screen>
      <View style={styles.topRow}>
        <Badge label="Practice only" tone="accent" />
        <Text accessibilityLabel={`${formatRemaining(draft.deadlineAt, now)} remaining`} variant="bodyStrong">Time {formatRemaining(draft.deadlineAt, now)}</Text>
      </View>
      <View style={styles.progress}>
        <Text variant="small">Question {questionIndex + 1} of {draft.questions.length}</Text>
        <Text muted variant="small">{answeredCount} answered</Text>
      </View>
      {timerAnnouncement ? <Text accessibilityLiveRegion="polite" muted variant="small">{timerAnnouncement}</Text> : null}

      <Animated.View
        entering={reduceMotion ? undefined : FadeInRight.duration(motion.duration.enter).easing(motion.easing.enter)}
        key={question.id}>
        <Card>
          <Heading level={2}>{question.question}</Heading>
          <View accessibilityLabel={`Answers for question ${questionIndex + 1}`} accessibilityRole="radiogroup" style={styles.options}>
            {question.options.map((option, optionIndex) => {
              const checked = selected === optionIndex;
              return (
                <Pressable
                  accessibilityLabel={`Option ${optionIndex + 1}: ${option}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked, disabled: submitting }}
                  key={`${question.id}-${optionIndex}`}
                  onPress={() => selectAnswer(optionIndex)}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: checked ? colors.accentSoft : colors.surfaceMuted, borderColor: checked ? colors.accent : colors.border },
                    pressed && styles.pressed,
                  ]}>
                  <Text variant={checked ? 'bodyStrong' : 'body'}>{optionIndex + 1}. {option}</Text>
                  <Text muted={false} style={{ color: checked ? colors.accent : colors.textMuted }} variant="small">{checked ? 'Selected' : 'Not selected'}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text accessibilityLiveRegion="polite" muted variant="small">
            {selected === undefined ? 'Choose one answer. Correctness is shown after submission.' : `Option ${selected + 1} selected. Correctness is shown after submission.`}
          </Text>
        </Card>
      </Animated.View>

      {submitError ? <Banner title="Local save needs attention" message={submitError} tone="warning" /> : null}
      <View style={styles.navigation}>
        <Button disabled={questionIndex === 0} label="Previous question" onPress={() => setQuestionIndex((value) => Math.max(0, value - 1))} variant="secondary" />
        {questionIndex < draft.questions.length - 1 ? (
          <Button label="Next question" onPress={() => setQuestionIndex((value) => Math.min(draft.questions.length - 1, value + 1))} />
        ) : (
          <Button label="Review answers" onPress={() => setReviewing(true)} />
        )}
      </View>
      <Button label="Review and submit" onPress={() => setReviewing(true)} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  navigation: { gap: spacing.md },
  option: { borderRadius: radii.md, borderWidth: 1, gap: spacing.xs, minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  options: { gap: spacing.md },
  pressed: { opacity: 0.78 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
