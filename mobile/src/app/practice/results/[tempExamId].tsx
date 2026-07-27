import { useQuery } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { clearPracticeDraft, getPracticeResult } from '@/features/practice';
import { queryStaleTime } from '@/lib/query';
import { spacing } from '@/theme';
import { queryKeys } from '@/lib/query-keys';

const practiceTabHref = '/(tabs)/practice' as Href;

function answerText(options: string[], index: number | null): string {
  if (index === null || index < 0 || index >= options.length) return 'No answer selected';
  return `Option ${index + 1}: ${options[index] ?? 'Unavailable'}`;
}

export default function PracticeResultScreen() {
  const params = useLocalSearchParams<{ tempExamId?: string | string[]; courseId?: string | string[] }>();
  const tempExamId = Array.isArray(params.tempExamId) ? params.tempExamId[0] : params.tempExamId;
  const rawCourseId = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId;
  const courseId = Number(rawCourseId);
  const { user } = useSession();

  const resultQuery = useQuery({
    enabled: Boolean(tempExamId),
    queryKey: queryKeys.practice.result(tempExamId),
    queryFn: ({ signal }) => getPracticeResult(tempExamId ?? '', signal),
    staleTime: queryStaleTime.active,
  });

  useEffect(() => {
    if (!resultQuery.data || !user || !Number.isInteger(courseId) || courseId <= 0) return;
    void clearPracticeDraft(user.id, courseId);
  }, [courseId, resultQuery.data, user]);

  if (!tempExamId) {
    return <Screen><ErrorState description="This result link is incomplete." onRetry={() => router.replace(practiceTabHref)} retryLabel="Back to Practice" /></Screen>;
  }

  if (resultQuery.isPending) {
    return <Screen><Skeleton height={24} width={180} /><Skeleton height={42} width="68%" /><Card><Skeleton height={72} /><Skeleton height={18} /></Card></Screen>;
  }

  if (resultQuery.isError) {
    return (
      <Screen>
        <ErrorState
          description="This temporary result could not be loaded. Results expire after the server’s retention window."
          onRetry={() => void resultQuery.refetch()}
          retryLabel="Retry result"
          title="Result unavailable"
        />
        <Button label="Back to Practice" onPress={() => router.replace(practiceTabHref)} variant="ghost" />
      </Screen>
    );
  }

  const result = resultQuery.data;
  const percent = Math.round(result.score);

  return (
    <Screen>
      <Badge label="Practice result — not a certification" tone="accent" />
      <Heading>{result.passed ? 'Practice goal met' : 'Keep practicing'}</Heading>
      <Card accessibilityLabel={`Practice score ${percent} percent. ${result.correctAnswers} of ${result.totalQuestions} correct.`}>
        <Text variant="caption">PRACTICE SCORE</Text>
        <Heading level={2}>{percent}%</Heading>
        <Text variant="bodyStrong">{result.correctAnswers} of {result.totalQuestions} correct</Text>
        <Badge label={result.passed ? 'Practice target met' : 'Practice target not met'} tone={result.passed ? 'success' : 'warning'} />
        {result.timedOut ? <Text variant="small">Status: submitted after the session deadline</Text> : <Text variant="small">Status: submitted within the session time</Text>}
      </Card>

      <Banner
        title="This is not a credential"
        message="Practice scores remain separate from official certification attempts. This result does not issue a certificate or recruiter-visible credential."
      />

      <View style={styles.section}>
        <Heading level={2}>Answer review</Heading>
        <Text muted>The server reveals correct answers only after submission.</Text>
      </View>

      {result.review.map((item, index) => (
        <Card accessibilityLabel={`Question ${index + 1}. ${item.isCorrect ? 'Correct' : 'Incorrect'}.`} key={`${item.questionId}-${index}`}>
          <View style={styles.reviewHeader}>
            <Badge label={`Question ${index + 1}`} />
            <Badge label={item.isCorrect ? 'Correct' : 'Incorrect'} tone={item.isCorrect ? 'success' : 'warning'} />
          </View>
          <Heading level={3}>{item.question}</Heading>
          <View style={styles.answerBlock}>
            <Text variant="caption">YOUR ANSWER</Text>
            <Text>{answerText(item.options, item.selectedAnswer)}</Text>
          </View>
          {!item.isCorrect ? (
            <View style={styles.answerBlock}>
              <Text variant="caption">CORRECT ANSWER</Text>
              <Text variant="bodyStrong">{answerText(item.options, item.correctAnswer)}</Text>
            </View>
          ) : null}
        </Card>
      ))}

      <Text muted variant="small">This temporary result is available until {new Date(result.resultExpiresAt).toLocaleString()}.</Text>
      <Button label="Choose another practice exam" onPress={() => router.replace(practiceTabHref)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  answerBlock: { gap: spacing.xs },
  reviewHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  section: { gap: spacing.sm, marginTop: spacing.sm },
});
