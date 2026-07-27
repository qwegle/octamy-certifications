import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { getTempExamResult } from '@/features/certifications/api';
import { cashfreeLocalState, createResultCertificateCheckout, getCashfreePaymentStatus } from '@/features/certifications/payment.api';
import { errorMessage, formatDate, formatPrice } from '@/features/certifications/format';
import { spacing } from '@/theme';

import { queryKeys } from '@/lib/query-keys';
import { openCashfreeCheckout } from '@/lib/cashfree-checkout';
function oneParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function answerText(options: string[], index: number | null): string {
  if (index === null || index < 0 || index >= options.length) return 'Not answered';
  return options[index] ?? 'Not answered';
}

type CheckoutState =
  | { kind: 'idle' }
  | { kind: 'opening' }
  | { kind: 'pending'; orderId: string; statusToken: string }
  | { kind: 'confirmed'; orderId: string; statusToken: string }
  | { kind: 'failed'; orderId: string; statusToken: string }
  | { kind: 'error'; message: string };

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function ExamResultScreen() {
  const params = useLocalSearchParams<{ tempExamId?: string | string[] }>();
  const tempExamId = oneParam(params.tempExamId);
  const result = useQuery({
    enabled: Boolean(tempExamId),
    queryKey: queryKeys.certifications.result(tempExamId),
    queryFn: ({ signal }) => getTempExamResult(tempExamId ?? '', signal),
    staleTime: 0,
  });
  const queryClient = useQueryClient();
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: 'idle' });

  const confirmPayment = async (orderId: string, statusToken: string, attempts = 1) => {
    setCheckout({ kind: 'pending', orderId, statusToken });
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const status = await getCashfreePaymentStatus(orderId, statusToken);
        const state = cashfreeLocalState(status.localStatus);
        if (state === 'confirmed') {
          setCheckout({ kind: 'confirmed', orderId, statusToken });
          await queryClient.invalidateQueries({ queryKey: queryKeys.certifications.certificates });
          return;
        }
        if (state === 'failed') {
          setCheckout({ kind: 'failed', orderId, statusToken });
          return;
        }
      } catch (error) {
        if (attempt === attempts - 1) {
          setCheckout({ kind: 'error', message: errorMessage(error, 'Payment status could not be checked.') });
          return;
        }
      }
      if (attempt < attempts - 1) await wait(1_500);
    }
    setCheckout({ kind: 'pending', orderId, statusToken });
  };

  const startCheckout = async () => {
    if (!tempExamId || checkout.kind === 'opening') return;
    setCheckout({ kind: 'opening' });
    try {
      const order = await createResultCertificateCheckout(tempExamId);
      if (order.gateway !== 'cashfree') {
        setCheckout({ kind: 'error', message: 'Cashfree checkout is not available for this order. Please try again later.' });
        return;
      }
      await openCashfreeCheckout({ paymentLink: order.paymentLink, paymentSessionId: order.paymentSessionId });
      await confirmPayment(order.orderId, order.statusToken, 5);
    } catch (error) {
      setCheckout({ kind: 'error', message: errorMessage(error, 'Secure checkout could not be opened.') });
    }
  };

  if (!tempExamId) {
    return <Screen><ErrorState description="This result link is incomplete." onRetry={() => router.back()} retryLabel="Go back" /></Screen>;
  }
  if (result.isPending) {
    return <Screen><Skeleton width="30%" /><Skeleton height={50} width="55%" /><Skeleton height={180} /></Screen>;
  }
  if (result.isError || !result.data) {
    return (
      <Screen>
        <ErrorState
          description="This temporary result could not be loaded. It may have expired after its 24-hour recovery window."
          onRetry={() => void result.refetch()}
        />
        <Button label="Return to certifications" onPress={() => router.replace('/(tabs)/certifications' as Href)} variant="ghost" />
      </Screen>
    );
  }

  const data = result.data;
  const courseId = data.course?.id;
  const courseSlug = data.course?.slug;
  const certificationHref = courseSlug ? ({ pathname: '/certification/[slug]', params: { slug: courseSlug } } as Href) : null;
  const retakeHref = courseId ? ({ pathname: '/exam/[courseId]', params: { courseId: String(courseId), slug: courseSlug ?? String(courseId), title: data.course?.title ?? 'Certification assessment' } } as Href) : null;

  return (
    <Screen>
      <View style={styles.header}>
        <Badge label={data.passed ? 'Passed' : 'Not passed'} tone={data.passed ? 'success' : 'warning'} />
        <Heading>{data.course?.title ?? 'Assessment result'}</Heading>
        <Text accessibilityLiveRegion="polite" variant="h1">{data.score}%</Text>
        <Text muted>{data.correctAnswers} of {data.totalQuestions} correct · Passing score {data.course?.passingScore === null || data.course?.passingScore === undefined ? 'not published' : `${data.course.passingScore}%`}</Text>
      </View>

      <Card accessibilityRole="summary">
        <Heading level={2}>{data.passed ? 'Assessment passed' : 'More preparation recommended'}</Heading>
        <Text>{data.message}</Text>
        <View style={styles.facts}>
          <View style={styles.fact}><Text muted variant="small">Best previous score</Text><Text variant="bodyStrong">{data.previousBestScore}%</Text></View>
          <View style={styles.fact}><Text muted variant="small">Result available until</Text><Text variant="bodyStrong">{formatDate(data.resultExpiresAt)}</Text></View>
          <View style={styles.fact}><Text muted variant="small">Timing</Text><Text variant="bodyStrong">{data.timedOut ? 'Timed out' : 'Submitted in time'}</Text></View>
        </View>
      </Card>

      {data.passed && data.needsPayment ? (
        <Card>
          <Heading level={2}>Activate your digital certificate</Heading>
          <Text>Purchase certificate activation once through Cashfree. Returning from checkout never activates access by itself; Octamy confirms the payment on the server first.</Text>
          <View style={styles.priceRow}>
            <Text muted variant="small">Digital certificate</Text>
            <Text variant="bodyStrong">{formatPrice(data.course?.price ?? 0)}</Text>
          </View>
          {checkout.kind === 'confirmed' ? <Banner message="Octamy confirmed this payment on the server. Your certificate will appear in My certificates when fulfillment completes." title="Payment confirmed" tone="success" /> : null}
          {checkout.kind === 'pending' ? <Banner message="The payment is not confirmed yet. If you completed checkout, allow a moment and check again." title="Confirmation pending" tone="warning" /> : null}
          {checkout.kind === 'failed' ? <Banner message="The server reports that this order did not complete. You can start a new secure checkout." title="Payment not completed" tone="warning" /> : null}
          {checkout.kind === 'error' ? <Banner message={checkout.message} title="Checkout unavailable" tone="error" /> : null}
          {checkout.kind === 'pending' ? (
            <Button label="Check payment status" onPress={() => void confirmPayment(checkout.orderId, checkout.statusToken, 1)} />
          ) : checkout.kind === 'confirmed' ? (
            <Button label="Open My certificates" onPress={() => router.push('/certificate' as Href)} />
          ) : (
            <Button
              disabled={checkout.kind === 'opening'}
              label={checkout.kind === 'opening' ? 'Opening secure checkout…' : 'Pay with Cashfree'}
              loading={checkout.kind === 'opening'}
              onPress={() => void startCheckout()}
            />
          )}
        </Card>
      ) : data.passed ? (
        <Banner message="Your result is eligible for the next server-managed credential step. Refresh My certificates to see credentials issued to your account." title="Next: credential" tone="success" />
      ) : (
        <Banner message="Review missed questions, continue preparing, and begin a new server-issued attempt when ready." title="Next: prepare and retry" />
      )}

      {data.review.length > 0 ? (
        <View style={styles.review}>
          <Heading level={2}>Answer review</Heading>
          {data.review.map((item, index) => (
            <Card key={`${item.questionId}-${index}`}>
              <View style={styles.reviewTitle}>
                <Badge label={item.isCorrect ? 'Correct' : 'Incorrect'} tone={item.isCorrect ? 'success' : 'warning'} />
                <Text muted variant="small">Question {index + 1}</Text>
              </View>
              <Text variant="bodyStrong">{item.question}</Text>
              <View style={styles.answer}><Text muted variant="small">Your answer</Text><Text>{answerText(item.options, item.selectedAnswer)}</Text></View>
              {!item.isCorrect ? <View style={styles.answer}><Text muted variant="small">Correct answer</Text><Text>{answerText(item.options, item.correctAnswer)}</Text></View> : null}
            </Card>
          ))}
        </View>
      ) : (
        <Banner message="A question-level review was not returned for this result." title="Review unavailable" />
      )}

      <View style={styles.actions}>
        <Button label="My certificates" onPress={() => router.push('/certificate' as Href)} />
        {retakeHref ? <Button label="Start a new attempt" onPress={() => router.replace(retakeHref)} variant="secondary" /> : null}
        {certificationHref ? <Button label="Back to certification" onPress={() => router.replace(certificationHref)} variant="ghost" /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  answer: { gap: spacing.xs },
  fact: { flex: 1, gap: spacing.xs, minWidth: 120 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  header: { gap: spacing.sm },
  priceRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  review: { gap: spacing.md },
  reviewTitle: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
});
