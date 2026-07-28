import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { type Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge, Banner, Button, Card, EmptyState, ErrorState, Heading, Input, Screen, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import {
  deleteInterviewSession,
  getInterviewSession,
  getInterviewStatus,
  getInterviewTemplates,
  listRecordings,
  revealNextInterviewItem,
  saveInterviewResponse,
  submitInterviewSession,
  type InterviewItem,
  type LocalRecording,
} from '@/features/interview';
import { asApiError } from '@/lib/api-client';
import { spacing } from '@/theme';
import { queryKeys } from '@/lib/query-keys';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readable(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function promptFor(item: InterviewItem): string {
  return item.kind === 'structured_response' ? item.prompt : item.problemStatement;
}

export default function InterviewSessionScreen() {
  const params = useLocalSearchParams();
  const sessionId = one(params.sessionId);
  const { canMutate, user } = useSession();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [startedEditingAt, setStartedEditingAt] = useState(Date.now());

  const statusQuery = useQuery({ queryFn: getInterviewStatus, queryKey: queryKeys.interview.status });
  const templatesQuery = useQuery({
    enabled: !sessionId,
    queryFn: getInterviewTemplates,
    queryKey: queryKeys.interview.templates,
  });
  const sessionQuery = useQuery({
    enabled: Boolean(sessionId),
    queryFn: () => getInterviewSession(sessionId!),
    queryKey: queryKeys.interview.session(sessionId),
    staleTime: 0,
  });

  const session = sessionQuery.data;
  const items = session?.blueprint.items ?? [];
  const totalItemCount = session?.navigation.totalItems ?? session?.blueprint.itemCount ?? items.length;
  const currentIndex = session?.navigation.currentIndex ?? 0;
  const currentItem = items[0];
  const savedResponse = session?.responses.find((response) => response.itemKey === currentItem?.key);

  useEffect(() => {
    if (!currentItem) return;
    setDraft(currentItem.kind === 'coding' ? savedResponse?.code ?? '' : savedResponse?.answerText ?? savedResponse?.responseText ?? '');
    setStartedEditingAt(Date.now());
  }, [currentItem?.key, savedResponse?.answerText, savedResponse?.code, savedResponse?.responseText]);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    void listRecordings(user.id).then(setRecordings).catch(() => setRecordings([]));
  }, [user]));

  const saveMutation = useMutation({
    mutationFn: saveInterviewResponse,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.interview.session(sessionId) });
    },
  });
  const revealMutation = useMutation({
    mutationFn: revealNextInterviewItem,
    onSuccess: (revealed) => {
      queryClient.setQueryData(queryKeys.interview.session(sessionId), revealed);
    },
  });
  const submitMutation = useMutation({
    mutationFn: () => submitInterviewSession(sessionId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.interview.session(sessionId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.interview.sessions });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteInterviewSession(sessionId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.interview.sessions });
      router.replace('/(tabs)/interview' as Href);
    },
  });

  const itemRecordings = useMemo(() => recordings.filter((recording) => recording.sessionId === sessionId && recording.itemKey === currentItem?.key), [currentItem?.key, recordings, sessionId]);
  const answeredCount = session?.responses.filter((response) => Boolean(response.answerText?.trim() || response.code?.trim())).length ?? 0;
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const editable = session?.status === 'in_progress' && canMutate;

  const save = () => {
    if (!sessionId || !session?.navigation.cursor || !currentItem || !draft.trim()) return;
    saveMutation.mutate({
      answer: draft.trim(),
      itemKey: currentItem.key,
      kind: currentItem.kind,
      navigationCursor: session.navigation.cursor,
      sessionId,
      timeSpentSeconds: Math.max(0, Math.round((Date.now() - startedEditingAt) / 1_000)),
    });
  };

  const nextItem = () => {
    if (!sessionId || !session?.navigation.cursor || !savedResponse) return;
    revealMutation.mutate({ cursor: session.navigation.cursor, sessionId });
  };

  const confirmSubmit = () => {
    Alert.alert(
      'Submit private practice?',
      'Saved text/code responses will be finalized for private evaluation. Local videos are not submitted.',
      [
        { style: 'cancel', text: 'Keep practicing' },
        { onPress: () => submitMutation.mutate(), text: 'Submit' },
      ],
    );
  };

  const confirmDeleteSession = () => {
    Alert.alert(
      'Delete server practice session?',
      'This deletes the server session and its typed responses. Local videos are separate and remain until you delete them from Local recordings.',
      [
        { style: 'cancel', text: 'Cancel' },
        { onPress: () => deleteMutation.mutate(), style: 'destructive', text: 'Delete session' },
      ],
    );
  };

  if (!sessionId) {
    if (templatesQuery.isLoading || statusQuery.isLoading) {
      return <Screen><Heading>Choose an interview</Heading><Text accessibilityLiveRegion="polite">Loading private practice templates…</Text></Screen>;
    }
    if (templatesQuery.isError || statusQuery.isError) {
      return <Screen><ErrorState description="Connect to load the published private Interview Studio templates." onRetry={() => { void templatesQuery.refetch(); void statusQuery.refetch(); }} title="Templates unavailable" /></Screen>;
    }
    return (
      <Screen>
        <Badge label="Practice only" tone="accent" />
        <Heading>Choose an interview</Heading>
        <Text muted>Every session is private, retained by Octamy for 30 days, and never released to recruiters. Video takes remain separate and local.</Text>
        {!statusQuery.data?.aiEvaluationEnabled ? <Banner message="You can rehearse and save responses, but this environment cannot generate AI feedback." title="AI feedback unavailable" tone="warning" /> : null}
        {templatesQuery.data?.items.length ? templatesQuery.data.items.map((template) => (
          <Card key={template.id}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Heading level={2}>{template.title}</Heading>
                <Text muted>{template.description}</Text>
              </View>
              <Badge label={readable(template.difficulty)} tone="neutral" />
            </View>
            <Text variant="small">{template.targetRole} · about {template.durationMinutes} minutes · {template.itemCount} prompts</Text>
            <Text muted variant="small">Skills: {template.skills.join(', ')}</Text>
            <Button
              disabled={!canMutate || !statusQuery.data?.practiceEnabled}
              label="Review consent and start"
              onPress={() => router.push({ pathname: '/interview/consent', params: { purpose: 'session', templateId: String(template.id) } } as Href)}
              variant="accent"
            />
          </Card>
        )) : <EmptyState description="No published private practice templates are available." title="No templates yet" />}
        <Button label="Back to Interview" onPress={() => router.back()} variant="ghost" />
      </Screen>
    );
  }

  if (sessionQuery.isLoading) return <Screen><Heading>Private practice session</Heading><Text accessibilityLiveRegion="polite">Loading your session…</Text></Screen>;
  if (sessionQuery.isError || !session) {
    return <Screen><ErrorState description={sessionQuery.isError ? asApiError(sessionQuery.error).message : 'This session is unavailable.'} onRetry={() => void sessionQuery.refetch()} title="Session unavailable" /></Screen>;
  }

  if (!currentItem) {
    return <Screen><ErrorState description="Octamy returned a session without usable interview prompts." onRetry={() => void sessionQuery.refetch()} title="Prompts unavailable" /></Screen>;
  }

  const currentEvaluation = savedResponse?.evaluation;
  const deadline = session.deadlineAt ? new Date(session.deadlineAt).toLocaleString() : null;
  const localVideoLimit = Math.min(120, currentItem.timeLimitSeconds);

  return (
    <Screen>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text muted variant="label">PRIVATE INTERVIEW STUDIO</Text>
          <Heading>{session.blueprint.title}</Heading>
        </View>
        <Badge label={readable(session.status)} tone={session.status === 'completed' ? 'success' : 'neutral'} />
      </View>
      <Banner message="Only typed/code responses are sent to this private session. Local answer videos are never uploaded, transcribed, or included in AI feedback." title="Video stays separate" tone="info" />

      <Card>
        <View style={styles.row}>
          <Badge label={`Question ${currentIndex + 1} of ${totalItemCount}`} tone="accent" />
          <Badge label={currentItem.competency} tone="neutral" />
        </View>
        <Heading level={2}>{currentItem.title}</Heading>
        <Text>{promptFor(currentItem)}</Text>
        <Text muted variant="small">{currentItem.instructions}</Text>
        <Text muted variant="small">Prompt limit: {Math.round(currentItem.timeLimitSeconds / 60)} min{deadline ? ` · Session deadline ${deadline}` : ''}</Text>
      </Card>

      <Input
        autoCapitalize="sentences"
        editable={editable}
        hint={currentItem.kind === 'structured_response'
          ? `${wordCount} words · suggested ${currentItem.minimumWords}–${currentItem.maximumWords} words`
          : 'Only JavaScript is accepted by this published template.'}
        label={currentItem.kind === 'coding' ? 'Your JavaScript solution' : 'Your typed response for private AI feedback'}
        maxLength={currentItem.kind === 'coding' ? 50_000 : 20_000}
        multiline
        onChangeText={setDraft}
        placeholder={currentItem.kind === 'coding' ? currentItem.starterCode : 'Structure your answer with evidence, decisions, and verification…'}
        style={styles.answerInput}
        textAlignVertical="top"
        value={draft}
      />
      {saveMutation.isError ? <Banner message={asApiError(saveMutation.error).message} title="Response not saved" tone="error" /> : null}
      {revealMutation.isError ? <Banner message={asApiError(revealMutation.error).message} title="Next question unavailable" tone="error" /> : null}
      <Button disabled={!editable || !draft.trim()} label={saveMutation.isPending ? 'Saving response…' : savedResponse ? 'Save response changes' : 'Save response'} loading={saveMutation.isPending} onPress={save} variant="accent" />
      {savedResponse ? <Badge label="Response saved on server" tone="success" /> : null}

      <Card>
        <Heading level={3}>Optional local video take</Heading>
        <Text muted>Record up to {Math.round(localVideoLimit / 60)} minutes for self-review. It will not replace or submit the typed response.</Text>
        <Text variant="small">{itemRecordings.length === 1 ? '1 local take for this question' : `${itemRecordings.length} local takes for this question`}</Text>
        <Button
          label="Review consent and record answer"
          onPress={() => router.push({ pathname: '/interview/consent', params: {
            itemKey: currentItem.key,
            maxSeconds: String(localVideoLimit),
            purpose: 'answer',
            questionTitle: currentItem.title,
            sessionId,
          } } as Href)}
          variant="secondary"
        />
      </Card>

      <View style={styles.navigation}>
        <Button disabled={currentIndex >= totalItemCount - 1 || revealMutation.isPending || !savedResponse} label={revealMutation.isPending ? "Opening next question…" : "Next question"} loading={revealMutation.isPending} onPress={nextItem} variant="secondary" />
      </View>

      {session.status === 'in_progress' ? (
        <Card>
          <Heading level={2}>Finish practice</Heading>
          <Text muted>{answeredCount} of {totalItemCount} prompts have saved text/code responses. Unsaved drafts and all local videos are excluded.</Text>
          {submitMutation.isError ? <Banner message={asApiError(submitMutation.error).message} title="Session not submitted" tone="error" /> : null}
          <Button disabled={!canMutate || answeredCount === 0} label={submitMutation.isPending ? 'Submitting…' : 'Submit saved responses'} loading={submitMutation.isPending} onPress={confirmSubmit} variant="primary" />
        </Card>
      ) : null}

      {session.status !== 'in_progress' ? (
        <Card>
          <Heading level={2}>Private learner analysis</Heading>
          <Text muted>This analysis uses only your submitted text or code and the published template criteria. It does not analyze local video, appearance, identity, personality, mental state, or employability.</Text>
          {session.evaluationStatus === 'completed' ? (
            session.evaluation ? (
              <View style={styles.feedback}>
                <Badge label={session.evaluation.score == null ? 'No score' : `Score ${session.evaluation.score}/100`} tone="success" />
                {session.evaluation.summary ? <Text>{session.evaluation.summary}</Text> : null}
                {session.evaluation.strengths.length ? <Text variant="bodyStrong">Strengths</Text> : null}
                {session.evaluation.strengths.map((strength) => <Text key={strength}>• {strength}</Text>)}
                {session.evaluation.improvementAreas.length ? <Text variant="bodyStrong">Improvement areas</Text> : null}
                {session.evaluation.improvementAreas.map((area) => <Text key={area}>• {area}</Text>)}
              </View>
            ) : <Text muted>Evaluation completed without a displayable feedback payload.</Text>
          ) : statusQuery.isLoading ? (
            <Banner message="Checking whether this environment can finish the pending evaluation." title="Checking feedback availability" tone="info" />
          ) : statusQuery.isError ? (
            <Banner message={`The evaluation status is ${readable(session.evaluationStatus)}, but current AI availability could not be refreshed.`} title="Feedback availability unknown" tone="warning" />
          ) : statusQuery.data?.aiEvaluationEnabled !== true ? (
            <Banner message="AI evaluation is not configured in this environment. Octamy will not invent feedback." title="AI feedback unavailable" tone="warning" />
          ) : (
            <Banner message={`Evaluation status: ${readable(session.evaluationStatus)}. Refresh later; the app does not poll in the background.`} title="Feedback not ready" tone="info" />
          )}
          {savedResponse?.evaluationStatus === 'completed' ? (
            currentEvaluation ? (
              <View style={styles.questionFeedback}>
                <Text variant="bodyStrong">Current question analysis</Text>
                <Text muted variant="small">Status: {readable(currentEvaluation.status)}{currentEvaluation.score == null ? ' · score unavailable' : ` · ${currentEvaluation.score}/100`}</Text>
                {currentEvaluation.summary ? <Text>{currentEvaluation.summary}</Text> : null}
                {currentEvaluation.strengths.map((strength) => <Text key={`current-strength-${strength}`}>• Strength: {strength}</Text>)}
                {currentEvaluation.improvementAreas.map((area) => <Text key={`current-area-${area}`}>• Improve: {area}</Text>)}
                {!currentEvaluation.summary && !currentEvaluation.strengths.length && !currentEvaluation.improvementAreas.length ? <Text muted variant="small">No dimension-level feedback was returned for this question.</Text> : null}
              </View>
            ) : <Text muted variant="small">Question evaluation completed without a displayable feedback payload.</Text>
          ) : savedResponse ? (
            <Text muted variant="small">Question-level analysis status: {readable(savedResponse.evaluationStatus)}.</Text>
          ) : <Text muted variant="small">Question-level analysis is unavailable for this prompt.</Text>}
          <Button label="Refresh analysis" onPress={() => { void statusQuery.refetch(); void sessionQuery.refetch(); }} variant="secondary" />
        </Card>
      ) : null}

      <Card>
        <Heading level={3}>Retention</Heading>
        <Text muted>Octamy retains this server practice session until {new Date(session.retentionUntil).toLocaleString()}. Recruiter sharing is disabled.</Text>
        {deleteMutation.isError ? <Banner message={asApiError(deleteMutation.error).message} title="Session not deleted" tone="error" /> : null}
        <Button disabled={!canMutate} label={deleteMutation.isPending ? 'Deleting session…' : 'Delete server practice session'} loading={deleteMutation.isPending} onPress={confirmDeleteSession} variant="danger" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  answerInput: { minHeight: 180 },
  feedback: { gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  questionFeedback: { gap: spacing.sm },
  row: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
