import { useQuery } from '@tanstack/react-query';
import { type Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { getMyCertificates } from '@/features/certifications/api';
import { formatDate } from '@/features/certifications/format';
import { spacing } from '@/theme';
import { queryKeys } from '@/lib/query-keys';

export default function CertificatesScreen() {
  const certificates = useQuery({
    queryKey: queryKeys.certifications.certificates,
    queryFn: ({ signal }) => getMyCertificates(signal),
  });

  return (
    <Screen>
      <View style={styles.header}>
        <Badge label="Verified credentials" tone="accent" />
        <Heading>My certificates</Heading>
        <Text muted>Credentials issued to your account. Activation state and public verification are confirmed by the server.</Text>
      </View>
      <Button label="Verify another certificate" onPress={() => router.push('/certificate/verify' as Href)} variant="secondary" />

      {certificates.isPending ? (
        <View accessible style={styles.list} accessibilityLabel="Loading certificates" accessibilityRole="progressbar">
          {Array.from({ length: 3 }, (_, index) => <Card key={index}><Skeleton width="30%" /><Skeleton height={24} width="75%" /><Skeleton width="50%" /></Card>)}
        </View>
      ) : certificates.isError ? (
        <ErrorState description="Your certificate list could not be loaded." onRetry={() => void certificates.refetch()} />
      ) : certificates.data.length === 0 ? (
        <EmptyState
          actionLabel="Browse certifications"
          description="Activated or issued certification credentials will appear here. Practice Pass results do not issue certificates."
          onAction={() => router.replace('/(tabs)/certifications' as Href)}
          title="No certificates yet"
        />
      ) : (
        <View style={styles.list}>
          <View style={styles.listHeader}>
            <Text muted>{certificates.data.length} credential{certificates.data.length === 1 ? '' : 's'}</Text>
            <Button label="Refresh certificates" loading={certificates.isRefetching} onPress={() => void certificates.refetch()} variant="ghost" />
          </View>
          {certificates.data.map((certificate) => {
            const status = certificate.isActive ? 'Active' : certificate.isPaid ? 'Ready' : 'Pending activation';
            const href = { pathname: '/certificate/[certificateId]', params: { certificateId: certificate.certificateId } } as Href;
            return (
              <Card key={certificate.certificateId}>
                <View style={styles.cardTop}>
                  <Badge label={status} tone={certificate.isActive ? 'success' : 'warning'} />
                  {certificate.badge ? <Badge label={certificate.badge} /> : null}
                </View>
                <Heading level={3}>{certificate.courseTitle ?? 'Octamy certificate'}</Heading>
                <Text muted variant="small">Issued {formatDate(certificate.issuedAt)} · Score {certificate.score === null ? 'not published' : `${certificate.score}%`}</Text>
                <Text variant="small">Verification code: {certificate.certificateId}</Text>
                <Button label={`Open ${certificate.courseTitle ?? 'certificate'}`} onPress={() => router.push(href)} variant="secondary" />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  header: { gap: spacing.md },
  list: { gap: spacing.lg },
  listHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});
