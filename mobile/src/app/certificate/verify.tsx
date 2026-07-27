import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, ErrorState, Heading, Input, Screen, Text } from '@/components/ui';
import { verifyCertificate } from '@/features/certifications/api';
import { formatDate } from '@/features/certifications/format';
import { spacing } from '@/theme';
import { queryKeys } from '@/lib/query-keys';

function oneParam(value: string | string[] | undefined): string {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved?.trim() ?? '';
}

export default function VerifyCertificateScreen() {
  const params = useLocalSearchParams<{ certificateId?: string | string[] }>();
  const initialCode = oneParam(params.certificateId);
  const [code, setCode] = useState(initialCode);
  const [submittedCode, setSubmittedCode] = useState(initialCode);
  const [inputError, setInputError] = useState('');
  const verification = useQuery({
    enabled: Boolean(submittedCode),
    queryKey: queryKeys.certifications.verification(submittedCode),
    queryFn: ({ signal }) => verifyCertificate(submittedCode, signal),
    retry: false,
  });

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
      setSubmittedCode(initialCode);
    }
  }, [initialCode]);

  const submit = () => {
    const normalized = code.trim();
    if (!normalized) {
      setInputError('Enter the certificate verification code.');
      return;
    }
    setInputError('');
    setSubmittedCode(normalized);
    if (normalized === submittedCode) void verification.refetch();
  };

  const data = verification.data;

  return (
    <Screen>
      <View style={styles.header}>
        <Badge label="Public verification" tone="accent" />
        <Heading>Verify a certificate</Heading>
        <Text muted>Check the live status of an Octamy credential using its certificate ID or verification code.</Text>
      </View>
      <Banner message="The verification API is public and returns only display-safe credential data. This signed-in app route never exposes your learner token in a link." title="Privacy-aware lookup" />
      <View style={styles.form}>
        <Input
          autoCapitalize="characters"
          autoCorrect={false}
          error={inputError}
          label="Certificate verification code"
          onChangeText={(value) => {
            setCode(value);
            if (inputError) setInputError('');
          }}
          onSubmitEditing={submit}
          placeholder="Enter certificate ID"
          returnKeyType="search"
          value={code}
        />
        <Button label="Verify certificate" loading={verification.isFetching} onPress={submit} />
      </View>

      {verification.isError ? (
        <ErrorState
          description="No current certificate verification record was returned for this code. Check every character and try again."
          onRetry={() => void verification.refetch()}
          retryLabel="Try this code again"
          title="Certificate not verified"
        />
      ) : data ? (
        <Card accessibilityLiveRegion="polite" accessibilityRole="summary">
          <View style={styles.statusRow}>
            <Badge label={data.valid ? 'Valid credential' : `Not valid: ${data.status.replaceAll('_', ' ')}`} tone={data.valid ? 'success' : 'warning'} />
            <Text muted variant="small">Live server status</Text>
          </View>
          <Heading level={2}>{data.courseTitle}</Heading>
          <Text>Issued to {data.userName}</Text>
          <View style={styles.facts}>
            <View style={styles.fact}><Text muted variant="small">Score</Text><Text variant="bodyStrong">{data.score}%</Text></View>
            <View style={styles.fact}><Text muted variant="small">Issued</Text><Text variant="bodyStrong">{formatDate(data.issuedAt)}</Text></View>
            <View style={styles.fact}><Text muted variant="small">Status</Text><Text variant="bodyStrong">{data.status.replaceAll('_', ' ')}</Text></View>
            <View style={styles.fact}><Text muted variant="small">Verification code</Text><Text selectable variant="bodyStrong">{data.certificateId}</Text></View>
          </View>
          {data.assessment ? (
            <Text muted variant="small">Passing score {data.assessment.passingScore ?? 'not published'}% · {data.assessment.questionCount ?? 'Unknown'} questions · Level {data.assessment.level ?? 'not published'}</Text>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fact: { flex: 1, gap: spacing.xs, minWidth: 130 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  form: { gap: spacing.md },
  header: { gap: spacing.md },
  statusRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
});
