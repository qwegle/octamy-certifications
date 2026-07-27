import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { getCertificate, verifyCertificate } from '@/features/certifications/api';
import { cashfreeLocalState, createCertificateActivationCheckout, getCashfreePaymentStatus, getCertificateActivation } from '@/features/certifications/payment.api';
import { errorMessage, formatDate, formatPrice } from '@/features/certifications/format';
import { asApiPath, buildApiUrl } from '@/lib/api-client';
import { openCashfreeCheckout } from '@/lib/cashfree-checkout';
import { useFeedback } from '@/lib/feedback';
import { spacing } from '@/theme';
import { queryKeys } from '@/lib/query-keys';


type ActivationCheckoutState =
  | { kind: 'idle' }
  | { kind: 'opening' }
  | { kind: 'pending'; orderId: string; statusToken: string }
  | { kind: 'confirmed'; orderId: string; statusToken: string }
  | { kind: 'failed'; orderId: string; statusToken: string }
  | { kind: 'error'; message: string };

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function oneParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function CertificateDetailScreen() {
  const params = useLocalSearchParams<{ certificateId?: string | string[] }>();
  const certificateId = oneParam(params.certificateId);
  const { showToast } = useFeedback();
  const certificate = useQuery({
    enabled: Boolean(certificateId),
    queryKey: queryKeys.certifications.certificate(certificateId),
    queryFn: ({ signal }) => getCertificate(certificateId ?? '', signal),
  });
  const verification = useQuery({
    enabled: Boolean(certificateId),
    queryKey: queryKeys.certifications.verification(certificateId),
    queryFn: ({ signal }) => verifyCertificate(certificateId ?? '', signal),
  });
  const activation = useQuery({
    enabled: Boolean(certificateId),
    queryKey: queryKeys.certifications.activation(certificateId),
    queryFn: () => getCertificateActivation(certificateId ?? ''),
    retry: false,
  });
  const queryClient = useQueryClient();
  const [checkout, setCheckout] = useState<ActivationCheckoutState>({ kind: 'idle' });

  const confirmPayment = async (orderId: string, statusToken: string, attempts = 1) => {
    setCheckout({ kind: 'pending', orderId, statusToken });
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const status = await getCashfreePaymentStatus(orderId, statusToken);
        const state = cashfreeLocalState(status.localStatus);
        if (state === 'confirmed') {
          setCheckout({ kind: 'confirmed', orderId, statusToken });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.certifications.activation(certificateId) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.certifications.certificate(certificateId) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.certifications.certificates }),
          ]);
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

  const startActivationCheckout = async () => {
    if (!certificateId || checkout.kind === 'opening') return;
    setCheckout({ kind: 'opening' });
    try {
      const order = await createCertificateActivationCheckout(certificateId);
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

  if (!certificateId) {
    return <Screen><ErrorState description="This certificate link is incomplete." onRetry={() => router.back()} retryLabel="Go back" /></Screen>;
  }
  if (certificate.isPending || verification.isPending) {
    return <Screen><Skeleton width="30%" /><Skeleton height={40} width="75%" /><Skeleton height={200} /></Screen>;
  }
  if (certificate.isError || !certificate.data) {
    return <Screen><ErrorState description="This certificate could not be loaded." onRetry={() => void certificate.refetch()} /></Screen>;
  }

  const data = certificate.data;
  const verified = verification.data;
  const shareUrl = buildApiUrl(asApiPath(`/api/certificate/${encodeURIComponent(certificateId)}`));
  const verificationUrl = buildApiUrl(asApiPath(`/api/certificates/verify/${encodeURIComponent(certificateId)}`));
  const downloadUrl = buildApiUrl(asApiPath(`/api/certificates/${encodeURIComponent(certificateId)}/download?format=pdf`));

  const share = async () => {
    try {
      await Share.share({ message: `Verify ${data.courseTitle ?? 'this Octamy certificate'}: ${shareUrl}`, url: shareUrl });
    } catch (error) {
      showToast({ message: errorMessage(error, 'The share sheet could not be opened.'), title: 'Unable to share', tone: 'error' });
    }
  };
  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(certificateId);
      showToast({ message: 'Verification code copied.', tone: 'success' });
    } catch {
      showToast({ message: 'The verification code could not be copied.', tone: 'error' });
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.badges}>
          <Badge label={verified?.status === 'active' ? 'Active and valid' : verified?.status?.replaceAll('_', ' ') ?? 'Verification unavailable'} tone={verified?.valid ? 'success' : 'warning'} />
          {data.badge ? <Badge label={data.badge} /> : null}
        </View>
        <Heading>{data.courseTitle ?? 'Octamy certificate'}</Heading>
        <Text muted>Issued to {data.userName}</Text>
      </View>

      {verification.isError ? (
        <Banner message="The display record loaded, but live public verification is currently unavailable." title="Verification unavailable" tone="warning" />
      ) : verified && !verified.valid ? (
        <Banner message={`The server reports this authentic record as ${verified.status.replaceAll('_', ' ')}. It must not be represented as an active credential.`} title="Not currently valid" tone="warning" />
      ) : (
        <Banner message="The public verification service confirms this credential is active and valid." title="Verified by Octamy" tone="success" />
      )}

      <Card accessibilityRole="summary">
        <Heading level={2}>Credential details</Heading>
        <View style={styles.facts}>
          <View style={styles.fact}><Text muted variant="small">Score</Text><Text variant="bodyStrong">{data.score === null ? 'Not published' : `${data.score}%`}</Text></View>
          <View style={styles.fact}><Text muted variant="small">Issued</Text><Text variant="bodyStrong">{formatDate(data.issuedAt)}</Text></View>
          <View style={styles.fact}><Text muted variant="small">Expires</Text><Text variant="bodyStrong">{data.expiresAt ? formatDate(data.expiresAt) : 'No expiry published'}</Text></View>
          <View style={styles.fact}><Text muted variant="small">Issuer</Text><Text variant="bodyStrong">{data.issuer?.coIssuer?.name ?? data.issuer?.platform ?? data.issuedBy ?? 'Octamy'}</Text></View>
        </View>
      </Card>

      {!data.isPaid || !data.isActive ? (
        activation.isPending ? <Skeleton height={176} /> : activation.data?.status === 'ready' ? (
          <Card>
            <Heading level={2}>Activate this certificate</Heading>
            <Text>Complete the one-time digital activation through Cashfree. Returning to the app is not proof of payment; Octamy confirms the order on the server.</Text>
            <View style={styles.priceRow}>
              <Text muted variant="small">Digital activation</Text>
              <View style={styles.priceCopy}>
                {activation.data.pricing.isOnSale && activation.data.pricing.originalDigital ? <Text muted variant="small">Was {formatPrice(activation.data.pricing.originalDigital)}</Text> : null}
                <Text variant="bodyStrong">{formatPrice(activation.data.pricing.digital)}</Text>
              </View>
            </View>
            {checkout.kind === 'confirmed' ? <Banner message="Octamy confirmed this payment on the server. Activation may take a moment to appear." title="Payment confirmed" tone="success" /> : null}
            {checkout.kind === 'pending' ? <Banner message="The payment is not confirmed yet. If checkout is complete, allow a moment and check again." title="Confirmation pending" tone="warning" /> : null}
            {checkout.kind === 'failed' ? <Banner message="The server reports that this order did not complete. You can start a new secure checkout." title="Payment not completed" tone="warning" /> : null}
            {checkout.kind === 'error' ? <Banner message={checkout.message} title="Checkout unavailable" tone="error" /> : null}
            {checkout.kind === 'pending' ? (
              <Button label="Check payment status" onPress={() => void confirmPayment(checkout.orderId, checkout.statusToken, 1)} />
            ) : checkout.kind === 'confirmed' ? (
              <Button label="Refresh activation" onPress={() => void Promise.all([activation.refetch(), certificate.refetch(), verification.refetch()])} variant="secondary" />
            ) : (
              <Button
                disabled={checkout.kind === 'opening'}
                label={checkout.kind === 'opening' ? 'Opening secure checkout…' : 'Pay with Cashfree'}
                loading={checkout.kind === 'opening'}
                onPress={() => void startActivationCheckout()}
              />
            )}
          </Card>
        ) : (
          <Banner
            message={activation.data?.status === 'revoked' ? 'The server marks this credential as revoked, so activation checkout is not available.' : 'Activation pricing is temporarily unavailable. No payment order has been created.'}
            title={activation.data?.status === 'revoked' ? 'Certificate revoked' : 'Activation unavailable'}
            tone="warning"
          />
        )
      ) : null}

      <Card>
        <Heading level={2}>Verification code and link</Heading>
        <Text selectable variant="bodyStrong">{certificateId}</Text>
        <Text muted variant="small">The server does not return a QR image. This public verification destination is the link a QR code or shared certificate should resolve to.</Text>
        <Text selectable muted variant="small">{verificationUrl}</Text>
        <View style={styles.actions}>
          <Button label="Copy verification code" onPress={() => void copyCode()} variant="secondary" />
          <Button label="Open public certificate" onPress={() => void WebBrowser.openBrowserAsync(shareUrl)} variant="secondary" />
          <Button label="Share verification link" onPress={() => void share()} />
        </View>
      </Card>

      {data.isPaid && data.isActive ? (
        <Button label="Open certificate PDF" onPress={() => void WebBrowser.openBrowserAsync(downloadUrl)} variant="secondary" />
      ) : (
        <Banner message="The server allows certificate download only after activation. No file is shown or generated locally." title="Download unavailable" tone="warning" />
      )}
      <Button
        label="Verify a different certificate"
        onPress={() => router.push({ pathname: '/certificate/verify', params: { certificateId } } as Href)}
        variant="ghost"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fact: { flex: 1, gap: spacing.xs, minWidth: 130 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  header: { gap: spacing.sm },
  priceCopy: { alignItems: 'flex-end', gap: spacing.xs },
  priceRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
});
