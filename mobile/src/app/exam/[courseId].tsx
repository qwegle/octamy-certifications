import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { AccountRequiredState } from '@/features/certifications/AccountRequiredState';
import { startCertificationExam, submitCertificationExam } from '@/features/certifications/api';
import { clearAttempt, loadAttempt, saveAttempt } from '@/features/certifications/attempt-repository';
import { errorMessage, formatTimer } from '@/features/certifications/format';
import {
  boundedMobileExamExitCount,
  isLiveMobileExamAttempt,
  isMobileExamExit,
  normalizeMobileExamExitCount,
} from '@/features/certifications/proctoring';
import type { ExamStartResponse, RecoverableAttempt } from '@/features/certifications/types';
import { asApiError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { useNetworkStatus } from '@/lib/query';
import { minimumTouchTarget, radii, spacing, useAppTheme } from '@/theme';

function oneParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function exitEvidenceMessage(count: number): string {
  const recorded = count > 0
    ? `${count} ${count === 1 ? 'exit has' : 'exits have'} been recorded. `
    : '';
  return `${recorded}Octamy detects when this exam becomes inactive or enters the background, but cannot identify which external app you opened. Octamy does not lock your device or prevent switching apps.`;
}

function isAccountRequiredError(error: unknown): boolean {
  const apiError = asApiError(error);
  return apiError.status === 401 || apiError.code === 'ACCOUNT_REQUIRED';
}

export default function ExamScreen() {
  const params = useLocalSearchParams<{ courseId?: string | string[]; slug?: string | string[]; title?: string | string[] }>();
  const courseId = Number(oneParam(params.courseId));
  const courseSlug = oneParam(params.slug) ?? String(courseId);
  const courseTitle = oneParam(params.title) ?? 'Certification assessment';
  const { canMutate, status, user } = useSession();
  const network = useNetworkStatus();
  const { colors } = useAppTheme();
  const { showToast } = useFeedback();
  const [loadingRecovery, setLoadingRecovery] = useState(true);
  const [attempt, setAttempt] = useState<RecoverableAttempt | null>(null);
  const [accountRequired, setAccountRequired] = useState(status === 'anonymous');
  const [consented, setConsented] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timerAnnouncement, setTimerAnnouncement] = useState('');
  const lastAnnouncement = useRef<number | null>(null);
  const appState = useRef(AppState.currentState);
  const saveChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (status === 'anonymous') setAccountRequired(true);
  }, [status]);

  useEffect(() => {
    let mounted = true;
    if (!user || !Number.isInteger(courseId) || courseId <= 0) {
      setLoadingRecovery(false);
      return;
    }
    void loadAttempt(user.id, courseId)
      .then((saved) => {
        if (!mounted) return;
        const recovered = saved ? {
          ...saved,
          integrityExitCount: normalizeMobileExamExitCount(saved.integrityExitCount),
        } : null;
        setAttempt(recovered);
        if (recovered) setRemainingSeconds(Math.max(0, Math.floor((Date.parse(recovered.deadlineAt) - Date.now()) / 1000)));
      })
      .catch(() => {
        if (mounted) showToast({ message: 'A saved attempt could not be read on this device.', title: 'Recovery unavailable', tone: 'warning' });
      })
      .finally(() => {
        if (mounted) setLoadingRecovery(false);
      });
    return () => { mounted = false; };
  }, [courseId, showToast, user]);

  useEffect(() => {
    if (!attempt) return;
    const update = () => setRemainingSeconds(Math.max(0, Math.floor((Date.parse(attempt.deadlineAt) - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (!attempt) return;
    const announce = remainingSeconds === 0
      || remainingSeconds === 10
      || remainingSeconds === 30
      || remainingSeconds === 60
      || (remainingSeconds > 60 && remainingSeconds % 300 === 0);
    if (announce && lastAnnouncement.current !== remainingSeconds) {
      lastAnnouncement.current = remainingSeconds;
      setTimerAnnouncement(remainingSeconds === 0 ? 'Time has ended.' : `${formatTimer(remainingSeconds)} remaining.`);
    }
  }, [attempt, remainingSeconds]);

  const persist = useCallback((next: RecoverableAttempt) => {
    saveChain.current = saveChain.current
      .catch(() => undefined)
      .then(() => saveAttempt(next))
      .catch(() => {
        showToast({ message: 'Keep this screen open. Your latest answer could not be saved for recovery.', title: 'Device save failed', tone: 'warning' });
      });
  }, [showToast]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;
      if (!isMobileExamExit(previousState, nextState)) return;
      setAttempt((current) => {
        const nowMs = Date.now();
        if (!current) return current;
        if (!current || !isLiveMobileExamAttempt(current, nowMs)) return current;
        const now = new Date(nowMs).toISOString();
        const next = {
          ...current,
          integrityExitCount: boundedMobileExamExitCount(current.integrityExitCount ?? 0),
          lastIntegrityExitAt: now,
          updatedAt: now,
        };
        persist(next);
        return next;
      });
    });
    return () => subscription.remove();
  }, [persist]);

  const start = async () => {
    if (!user || starting || !consented || !canMutate || !Number.isInteger(courseId) || courseId <= 0) return;
    setStarting(true);
    try {
      const response: ExamStartResponse = await startCertificationExam(courseId);
      const next: RecoverableAttempt = {
        ...response,
        answers: {},
        flaggedQuestionIds: [],
        integrityExitCount: 0,
        courseId,
        courseSlug,
        courseTitle,
        updatedAt: new Date().toISOString(),
        userId: user.id,
      };
      await saveAttempt(next);
      setQuestionIndex(0);
      setAttempt(next);
      setRemainingSeconds(Math.max(0, Math.floor((Date.parse(next.deadlineAt) - Date.now()) / 1000)));
      showToast({ message: 'The server-issued session is saved on this device for recovery.', title: 'Exam started', tone: 'success' });
    } catch (error) {
      if (isAccountRequiredError(error)) {
        setAccountRequired(true);
      } else {
        showToast({ message: errorMessage(error, 'The exam could not be started.'), title: 'Unable to start exam', tone: 'error' });
      }
    } finally {
      setStarting(false);
    }
  };

  const chooseAnswer = (optionIndex: number) => {
    if (!attempt || remainingSeconds <= 0) return;
    const question = attempt.questions[questionIndex];
    if (!question) return;
    const next = { ...attempt, answers: { ...attempt.answers, [String(question.id)]: optionIndex }, updatedAt: new Date().toISOString() };
    setAttempt(next);
    persist(next);
  };

  const toggleFlag = () => {
    if (!attempt || !currentQuestion) return;
    const current = attempt.flaggedQuestionIds ?? [];
    const flaggedQuestionIds = current.includes(currentQuestion.id)
      ? current.filter((id) => id !== currentQuestion.id)
      : [...current, currentQuestion.id];
    const next = { ...attempt, flaggedQuestionIds, updatedAt: new Date().toISOString() };
    setAttempt(next);
    persist(next);
  };

  const submitNow = async () => {
    if (!attempt || submitting || network === 'offline') return;
    setSubmitting(true);
    try {
      await saveChain.current.catch(() => undefined);
      const result = await submitCertificationExam({
        answers: attempt.answers,
        courseId: attempt.courseId,
        sessionId: attempt.sessionId,
        tabSwitches: normalizeMobileExamExitCount(attempt.integrityExitCount),
      });
      await clearAttempt(attempt.userId, attempt.courseId).catch(() => undefined);
      const href = { pathname: '/exam/result/[tempExamId]', params: { tempExamId: result.tempExamId } } as Href;
      router.replace(href);
    } catch (error) {
      if (isAccountRequiredError(error)) {
        const savedAttempt = { ...attempt, updatedAt: new Date().toISOString() };
        setAttempt(savedAttempt);
        await saveChain.current.catch(() => undefined);
        await saveAttempt(savedAttempt).catch(() => {
          showToast({ message: 'Keep this screen open. Your saved answers are still loaded, but the device copy could not be refreshed.', title: 'Device save needs retry', tone: 'warning' });
        });
        setAccountRequired(true);
      } else {
        showToast({
          durationMs: 7_000,
          message: `${errorMessage(error, 'Submission could not be completed.')} Your session and answers remain on this device; retry uses the same submission ID.`,
          title: 'Exam not cleared',
          tone: 'error',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSubmit = () => {
    if (!attempt) return;
    setReviewing(true);
  };

  const saveAndLeave = async () => {
    if (!attempt || leaving) return;
    setLeaving(true);
    const next = { ...attempt, updatedAt: new Date().toISOString() };
    setAttempt(next);
    saveChain.current = saveChain.current.catch(() => undefined).then(() => saveAttempt(next));
    try {
      await saveChain.current;
      router.replace({ pathname: '/certification/[slug]', params: { slug: next.courseSlug } } as Href);
    } catch {
      showToast({ message: 'Keep this screen open and try again. The attempt was not safely saved.', title: 'Unable to leave safely', tone: 'error' });
    } finally {
      setLeaving(false);
    }
  };

  const discardExpired = () => {
    if (!attempt) return;
    Alert.alert('Discard expired attempt?', 'The expired local question set and answers will be removed from this device.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => void clearAttempt(attempt.userId, attempt.courseId).then(() => {
          setAttempt(null);
          setConsented(false);
          setQuestionIndex(0);
        }),
      },
    ]);
  };

  const answeredCount = attempt ? Object.keys(attempt.answers).length : 0;
  const currentQuestion = attempt?.questions[questionIndex];
  const isExpired = Boolean(attempt && remainingSeconds <= 0);
  const progress = useMemo(() => attempt ? `Question ${questionIndex + 1} of ${attempt.questions.length}` : '', [attempt, questionIndex]);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return <Screen><ErrorState description="This exam link does not contain a valid course ID." onRetry={() => router.back()} retryLabel="Go back" /></Screen>;
  }
  if (loadingRecovery) {
    return <Screen><Skeleton width="40%" /><Skeleton height={32} width="80%" /><Skeleton height={220} /></Screen>;
  }
  if (accountRequired) {
    return (
      <Screen>
        <AccountRequiredState interrupted={Boolean(attempt)} onAuthenticated={() => setAccountRequired(false)} />
      </Screen>
    );
  }

  if (!attempt) {
    return (
      <Screen
        bottomAction={(
          <Button disabled={!consented || !canMutate || network === 'offline'} label="Start exam" loading={starting} onPress={() => void start()} />
        )}>
        <Badge label="Before you begin" tone="accent" />
        <Heading>{courseTitle}</Heading>
        <Text muted>A unique question set and deadline are issued only after you consent and start. There is no server endpoint for saving answers or retrieving this question set later.</Text>
        <Card>
          <Heading level={2}>Evidence consent</Heading>
          <Text>Octamy records this assessment session, answer submission, timing, and integrity metadata needed to validate the result.</Text>
          <Text muted variant="small">This exam records when Octamy becomes inactive or enters the background, including when you switch away to another app. Octamy cannot identify which external app you opened. This flow does not request camera, microphone, or video access. Local recovery retains the issued questions, your answers, and this exit count on this device until successful submission or deletion.</Text>
          <Pressable
            accessibilityLabel="I consent to assessment evidence processing"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consented }}
            onPress={() => setConsented((value) => !value)}
            style={[styles.consent, { borderColor: consented ? colors.accent : colors.border, backgroundColor: consented ? colors.accentSoft : colors.surfaceMuted }]}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.checkbox, { borderColor: consented ? colors.accent : colors.textMuted }]}>
              <Text style={consented ? { color: colors.accent } : undefined} variant="bodyStrong">{consented ? '✓' : ''}</Text>
            </View>
            <Text style={styles.consentText} variant="bodyStrong">I consent to assessment evidence processing.</Text>
          </Pressable>
        </Card>
        {network === 'offline' ? <Banner message="Starting requires a server-issued session. Reconnect before beginning." title="Offline" tone="warning" /> : null}
      </Screen>
    );
  }

  if (!currentQuestion) {
    return <Screen><ErrorState description="The saved question set is incomplete. It cannot be safely reconstructed." onRetry={discardExpired} retryLabel="Discard saved attempt" /></Screen>;
  }

  if (reviewing) {
    const unanswered = attempt.questions.length - answeredCount;
    const flagged = attempt.flaggedQuestionIds ?? [];
    return (
      <Screen
        bottomAction={(
          <View style={styles.fixedActionStack}>
            <Button disabled={submitting || network === 'offline' || isExpired} label={submitting ? 'Submitting exam…' : 'Confirm final submission'} loading={submitting} onPress={() => void submitNow()} />
            <Button disabled={submitting} label="Return to questions" onPress={() => setReviewing(false)} variant="secondary" />
          </View>
        )}>
        <Badge label="Final review" tone="accent" />
        <Heading level={2}>Review before submission</Heading>
        <Text muted>{answeredCount} answered · {unanswered} unanswered · {flagged.length} flagged</Text>
        {network === 'offline' ? <Banner title="Reconnect to submit" message="Your answers and flags remain saved on this device." tone="warning" /> : null}
        <Banner
          title={(attempt.integrityExitCount ?? 0) > 0 ? 'Exam exit recorded' : 'App-exit evidence active'}
          message={exitEvidenceMessage(attempt.integrityExitCount ?? 0)}
          tone="warning"
        />
        {isExpired ? <Banner title="Submission window ended" message="This server-issued attempt can no longer be submitted." tone="error" /> : null}
        <View style={styles.reviewList}>
          {attempt.questions.map((question, index) => {
            const answered = attempt.answers[String(question.id)] !== undefined;
            const isFlagged = flagged.includes(question.id);
            return (
              <Pressable
                accessibilityLabel={`Question ${index + 1}, ${answered ? 'answered' : 'unanswered'}${isFlagged ? ', flagged' : ''}`}
                accessibilityRole="button"
                key={question.id}
                onPress={() => { setQuestionIndex(index); setReviewing(false); }}
                style={[styles.reviewItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.reviewCopy}>
                  <Text variant="bodyStrong">Question {index + 1}</Text>
                  <Text muted numberOfLines={2} variant="small">{question.question}</Text>
                </View>
                <View style={styles.reviewBadges}>
                  <Badge label={answered ? 'Answered' : 'Unanswered'} tone={answered ? 'success' : 'warning'} />
                  {isFlagged ? <Badge label="Flagged" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      bottomAction={(
        <View style={styles.fixedActionStack}>
          <View style={styles.navigationButtons}>
            <View style={styles.actionCell}>
              <Button disabled={questionIndex === 0} label="Previous question" onPress={() => setQuestionIndex((index) => Math.max(0, index - 1))} variant="secondary" />
            </View>
            <View style={styles.actionCell}>
              {questionIndex < attempt.questions.length - 1 ? (
                <Button label="Next question" onPress={() => setQuestionIndex((index) => Math.min(attempt.questions.length - 1, index + 1))} />
              ) : (
                <Button disabled={isExpired || network === 'offline'} label="Review and submit" onPress={confirmSubmit} />
              )}
            </View>
          </View>
          {questionIndex < attempt.questions.length - 1 ? (
            <Button disabled={isExpired || network === 'offline'} label="Review answers" onPress={confirmSubmit} variant="ghost" />
          ) : null}
        </View>
      )}>
      <View style={styles.examHeader}>
        <View style={styles.examTitle}>
          <Badge label="In progress" tone={isExpired ? 'warning' : 'accent'} />
          <Heading level={2}>{attempt.courseTitle}</Heading>
          <Text muted>{progress} · {answeredCount} answered</Text>
        </View>
        <View accessibilityLabel={`${formatTimer(remainingSeconds)} remaining`} style={[styles.timer, { borderColor: isExpired ? colors.destructive : colors.border }]}>
          <Text muted variant="caption">TIME LEFT</Text>
          <Text style={isExpired ? { color: colors.destructive } : undefined} variant="h3">{formatTimer(remainingSeconds)}</Text>
        </View>
      </View>
      {timerAnnouncement ? <Text accessibilityLiveRegion="polite" muted variant="small">{timerAnnouncement}</Text> : null}
      <Banner
        message="Leaving this screen does not submit the exam. Saved answers can resume on this device before the server deadline."
        title="Local recovery active"
      />
      {network === 'offline' ? <Banner message="You can keep answering and saving locally. Final submission waits until you reconnect." title="Offline" tone="warning" /> : null}
      <Banner
        title={(attempt.integrityExitCount ?? 0) > 0 ? 'Exam exit recorded' : 'App-exit evidence active'}
        message={exitEvidenceMessage(attempt.integrityExitCount ?? 0)}
        tone="warning"
      />
      {isExpired ? (
        <Banner message="This server deadline has passed. The API cannot extend or restart this session; discard it to request a new attempt." title="Attempt expired" tone="error" />
      ) : null}

      <Card accessibilityLabel={`${progress}. ${currentQuestion.question}`}>
        <View style={styles.questionHeader}>
          <Text muted variant="label">{progress}</Text>
          <Button
            accessibilityState={{ selected: (attempt.flaggedQuestionIds ?? []).includes(currentQuestion.id) }}
            label={(attempt.flaggedQuestionIds ?? []).includes(currentQuestion.id) ? 'Remove flag' : 'Flag for review'}
            onPress={toggleFlag}
            variant="ghost"
          />
        </View>
        <Text style={styles.questionText}>{currentQuestion.question}</Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {currentQuestion.options.map((option, optionIndex) => {
            const selected = attempt.answers[String(currentQuestion.id)] === optionIndex;
            const letter = String.fromCharCode(65 + optionIndex);
            return (
              <Pressable
                accessibilityLabel={`Option ${letter}: ${option}`}
                accessibilityRole="radio"
                accessibilityState={{ disabled: isExpired, selected }}
                disabled={isExpired}
                key={`${currentQuestion.id}-${optionIndex}`}
                onPress={() => chooseAnswer(optionIndex)}
                style={[styles.option, { backgroundColor: selected ? colors.accentSoft : colors.surfaceMuted, borderColor: selected ? colors.accent : colors.border }]}>
                <View style={[styles.optionLetter, { borderColor: selected ? colors.accent : colors.border }]}>
                  <Text style={selected ? { color: colors.accent } : undefined} variant="label">{letter}</Text>
                </View>
                <Text style={styles.optionText}>{option}</Text>
                {selected ? <Text style={{ color: colors.accent }} variant="label">Selected</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View accessibilityLabel="Question navigation" style={styles.questionNav}>
        {attempt.questions.map((question, index) => {
          const answered = attempt.answers[String(question.id)] !== undefined;
          const flagged = (attempt.flaggedQuestionIds ?? []).includes(question.id);
          const selected = index === questionIndex;
          return (
            <Pressable
              accessibilityLabel={`Question ${index + 1}, ${answered ? 'answered' : 'unanswered'}${flagged ? ', flagged' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={question.id}
              onPress={() => setQuestionIndex(index)}
              style={[styles.questionNumber, { backgroundColor: answered ? colors.successSoft : colors.surface, borderColor: selected ? colors.accent : answered ? colors.success : colors.border }]}>
              <Text style={selected ? { color: colors.accent } : answered ? { color: colors.success } : undefined} variant="label">{index + 1}{flagged ? ' F' : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      {isExpired ? <Button label="Discard expired attempt" onPress={discardExpired} variant="danger" /> : null}
      <Button disabled={leaving} label={leaving ? 'Saving attempt…' : 'Save and leave exam'} loading={leaving} onPress={() => void saveAndLeave()} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionCell: { flex: 1, minWidth: 0 },
  checkbox: { alignItems: 'center', borderRadius: radii.sm, borderWidth: 2, height: 28, justifyContent: 'center', width: 28 },
  consent: { alignItems: 'center', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: minimumTouchTarget, padding: spacing.md },
  consentText: { flex: 1 },
  examHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  examTitle: { flex: 1, gap: spacing.sm },
  fixedActionStack: { gap: spacing.sm },
  navigationButtons: { flexDirection: 'row', gap: spacing.sm },
  option: { alignItems: 'center', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: minimumTouchTarget, padding: spacing.md },
  optionLetter: { alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 32, justifyContent: 'center', width: 32 },
  optionText: { flex: 1 },
  options: { gap: spacing.sm },
  questionHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  questionText: { fontSize: 18, fontWeight: '600', lineHeight: 25 },
  questionNav: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reviewBadges: { alignItems: 'flex-end', gap: spacing.xs },
  reviewCopy: { flex: 1, gap: spacing.xs },
  reviewItem: { alignItems: 'center', borderRadius: radii.sm, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: minimumTouchTarget, padding: spacing.md },
  reviewList: { gap: spacing.sm },
  questionNumber: { alignItems: 'center', borderRadius: radii.sm, borderWidth: 1, height: minimumTouchTarget, justifyContent: 'center', minWidth: minimumTouchTarget },
  timer: { alignItems: 'center', borderRadius: radii.md, borderWidth: 1, minWidth: 92, padding: spacing.sm },
});
