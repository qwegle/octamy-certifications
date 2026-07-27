import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Badge, Banner, Button, Card, EmptyState, ErrorState, Heading, Input, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import {
  createEvidenceGrant,
  getEligibleEvidenceRecruiters,
  getEvidenceAccessHistory,
  getEvidenceGrantOptions,
  getEvidenceGrants,
  revokeEvidenceGrant,
  type EvidenceGrant,
} from '@/features/profile';
import { asApiError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { queryKeys } from '@/lib/query-keys';
import { minimumTouchTarget, radii, spacing, useAppTheme } from '@/theme';

const DAY_MS = 86_400_000;
const expiryChoices = [7, 14, 30] as const;

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function Choice({ checked, description, disabled = false, label, onPress }: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: checked ? colors.accentSoft : colors.surface, borderColor: checked ? colors.accent : colors.border },
        pressed && styles.pressed,
      ]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.check, { borderColor: checked ? colors.accent : colors.textMuted }]}>
        <Text style={checked ? { color: colors.accent } : undefined} variant="label">{checked ? '✓' : ''}</Text>
      </View>
      <View style={styles.grow}>
        <Text variant="bodyStrong">{label}</Text>
        <Text muted variant="small">{description}</Text>
      </View>
    </Pressable>
  );
}

export default function EvidenceSharingScreen() {
  const queryClient = useQueryClient();
  const { canMutate } = useSession();
  const { showToast } = useFeedback();
  const { colors } = useAppTheme();
  const [targetRecruiterId, setTargetRecruiterId] = useState<number | null>(null);
  const [purpose, setPurpose] = useState('');
  const [jobReference, setJobReference] = useState('');
  const [expiryDays, setExpiryDays] = useState<(typeof expiryChoices)[number]>(7);
  const [certificateIds, setCertificateIds] = useState<number[]>([]);
  const [practiceSummaryIds, setPracticeSummaryIds] = useState<number[]>([]);
  const [consented, setConsented] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const recruitersQuery = useQuery({ queryFn: getEligibleEvidenceRecruiters, queryKey: queryKeys.profile.evidenceGrantRecruiters });
  const optionsQuery = useQuery({ queryFn: getEvidenceGrantOptions, queryKey: queryKeys.profile.evidenceGrantOptions });
  const grantsQuery = useQuery({ queryFn: getEvidenceGrants, queryKey: queryKeys.profile.evidenceGrants });
  const historyQuery = useQuery({ queryFn: getEvidenceAccessHistory, queryKey: queryKeys.profile.evidenceAccessHistory });

  const activeGrants = useMemo(() => grantsQuery.data?.filter((grant) => grant.status === 'active') ?? [], [grantsQuery.data]);
  const loading = recruitersQuery.isPending || optionsQuery.isPending || grantsQuery.isPending || historyQuery.isPending;
  const loadError = recruitersQuery.isError || optionsQuery.isError || grantsQuery.isError || historyQuery.isError;
  const selectedCount = certificateIds.length + practiceSummaryIds.length;
  const canCreate = canMutate
    && targetRecruiterId !== null
    && purpose.trim().length >= 3
    && certificateIds.length > 0
    && selectedCount <= 50
    && consented;

  const refreshAll = async () => {
    await Promise.all([recruitersQuery.refetch(), optionsQuery.refetch(), grantsQuery.refetch(), historyQuery.refetch()]);
  };

  const createMutation = useMutation({
    mutationFn: createEvidenceGrant,
    onSuccess: async () => {
      setPurpose('');
      setJobReference('');
      setCertificateIds([]);
      setPracticeSummaryIds([]);
      setConsented(false);
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.evidenceGrants });
      showToast({ message: 'Only the selected recruiter may load the selected summaries until expiry or revocation.', title: 'Evidence grant created', tone: 'success' });
    },
    onError: (error) => setFormError(asApiError(error).message),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeEvidenceGrant,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.evidenceGrants });
      showToast({ message: 'The recruiter can no longer load this grant.', title: 'Evidence access revoked', tone: 'success' });
    },
    onError: (error) => showToast({ message: asApiError(error).message, title: 'Grant not revoked', tone: 'error' }),
  });

  const toggle = (values: number[], setValues: (value: number[]) => void, id: number) => {
    setValues(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
    setFormError(null);
  };

  const submit = () => {
    if (!canCreate || targetRecruiterId === null || createMutation.isPending) return;
    if (selectedCount > 50) {
      setFormError('Select no more than 50 evidence items.');
      return;
    }
    const expiresAt = new Date(Date.now() + expiryDays * DAY_MS).toISOString();
    createMutation.mutate({
      certificateIds,
      expiresAt,
      ...(jobReference.trim() ? { jobReference: jobReference.trim() } : {}),
      practiceSummaryIds,
      purpose: purpose.trim(),
      targetRecruiterId,
    });
  };

  const confirmRevoke = (grant: EvidenceGrant) => {
    Alert.alert(
      'Revoke this evidence grant?',
      `${grant.recruiterCompany} will be blocked from loading this selected evidence on its next request. This cannot be undone.`,
      [
        { style: 'cancel', text: 'Keep active' },
        { onPress: () => revokeMutation.mutate(grant), style: 'destructive', text: 'Revoke now' },
      ],
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Recruiter evidence sharing' }} />
      <Screen>
        <View style={styles.heading}>
          <Badge label="Selected, expiring, revocable" tone="accent" />
          <Heading>Recruiter evidence sharing</Heading>
          <Text muted>Authorize one verified recruiter to inspect only the evidence you select, for the purpose and time you choose.</Text>
        </View>

        <Banner
          title="Discovery is not evidence consent"
          message="Profile visibility and recruiter credits never disclose assessment activity. Answers, question data, IP addresses, device data, raw integrity events, and Interview Studio sessions are never included in a grant."
        />
        {!canMutate ? <Banner title="Changes paused" message="Reconnect and validate your session before creating or revoking a grant." tone="warning" /> : null}

        {loading ? (
          <View accessibilityLabel="Loading recruiter evidence controls" accessibilityRole="progressbar" style={styles.stack}>
            <Skeleton height={110} /><Skeleton height={180} /><Skeleton height={130} />
          </View>
        ) : loadError ? (
          <ErrorState description="Octamy could not load all recruiter, evidence, grant, and access-history records. Nothing is inferred." onRetry={() => void refreshAll()} title="Evidence controls unavailable" />
        ) : (
          <>
            <Card>
              <Heading level={2}>1. Choose an eligible recruiter</Heading>
              <Text muted variant="small">Only active, KYC-approved recruiters with a prior legitimate profile-view interaction can appear here.</Text>
              {recruitersQuery.data?.length ? recruitersQuery.data.map((recruiter) => (
                <Choice
                  checked={targetRecruiterId === recruiter.id}
                  description={`${recruiter.industry ? `${recruiter.industry}. ` : ''}Eligible interaction ${dateLabel(recruiter.interactionAt)}.`}
                  key={recruiter.id}
                  label={recruiter.companyName}
                  onPress={() => setTargetRecruiterId((current) => current === recruiter.id ? null : recruiter.id)}
                />
              )) : <EmptyState description="A verified recruiter must first unlock your discoverable profile. No grant can be created without that prior interaction." title="No eligible recruiters" />}
            </Card>

            <Card>
              <Heading level={2}>2. State the limited purpose</Heading>
              <Input
                label="Purpose"
                maxLength={500}
                multiline
                onChangeText={(value) => { setPurpose(value); setFormError(null); }}
                placeholder="For example: Senior frontend engineer application"
                style={styles.multiline}
                value={purpose}
              />
              <Input label="Job reference (optional)" maxLength={200} onChangeText={setJobReference} value={jobReference} />
              <Text variant="bodyStrong">Automatic expiry</Text>
              <View accessibilityLabel="Evidence grant expiry" accessibilityRole="radiogroup" style={styles.expiryRow}>
                {expiryChoices.map((days) => {
                  const selected = expiryDays === days;
                  return (
                    <Pressable
                      accessibilityLabel={`${days} days`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={days}
                      onPress={() => setExpiryDays(days)}
                      style={[styles.expiry, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}>
                      <Text style={selected ? { color: colors.accent } : undefined} variant="label">{days} days</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card>
              <Heading level={2}>3. Select exact evidence</Heading>
              <Text variant="bodyStrong">Certification evidence — select at least one</Text>
              {optionsQuery.data?.certifications.length ? optionsQuery.data.certifications.map((item) => (
                <Choice
                  checked={certificateIds.includes(item.id)}
                  description={`Score ${item.score}%. Active until ${dateLabel(item.expiresAt)}. Certificate ${item.certificateId}.`}
                  key={item.id}
                  label={item.courseTitle}
                  onPress={() => toggle(certificateIds, setCertificateIds, item.id)}
                />
              )) : <Text muted>No current active, paid certification credential is eligible for sharing.</Text>}

              <Text variant="bodyStrong">Practice summaries — optional</Text>
              <Text muted variant="small">A selected Practice summary includes title, score, completion time, question count, and duration only—not answers or integrity events.</Text>
              {optionsQuery.data?.practiceSummaries.length ? optionsQuery.data.practiceSummaries.map((item) => (
                <Choice
                  checked={practiceSummaryIds.includes(item.id)}
                  description={`Score ${item.score}%. Completed ${dateLabel(item.completedAt)}.`}
                  key={item.id}
                  label={item.courseTitle}
                  onPress={() => toggle(practiceSummaryIds, setPracticeSummaryIds, item.id)}
                />
              )) : <Text muted>No eligible non-Interview Practice summaries are available.</Text>}
              <Text accessibilityLiveRegion="polite" muted variant="small">{selectedCount} of 50 evidence items selected.</Text>
            </Card>

            <Card>
              <Heading level={2}>4. Authorize this exact disclosure</Heading>
              <Choice
                checked={consented}
                description="I understand the selected recruiter, purpose, evidence, automatic expiry, and immediate revocation behavior shown above."
                label="I authorize this selected evidence grant"
                onPress={() => setConsented((value) => !value)}
              />
              {formError ? <Banner message={formError} title="Grant not created" tone="error" /> : null}
              <Button disabled={!canCreate} label={createMutation.isPending ? 'Creating expiring grant…' : 'Create expiring grant'} loading={createMutation.isPending} onPress={submit} />
            </Card>

            <View style={styles.section}>
              <Heading level={2}>Active grants</Heading>
              {activeGrants.length ? activeGrants.map((grant) => (
                <Card key={grant.id}>
                  <View style={styles.row}>
                    <View style={styles.grow}>
                      <Heading level={3}>{grant.recruiterCompany}</Heading>
                      <Text>{grant.purpose}</Text>
                    </View>
                    <Badge label="Active" tone="success" />
                  </View>
                  {grant.jobReference ? <Text muted variant="small">Job reference: {grant.jobReference}</Text> : null}
                  <Text muted variant="small">Expires {dateLabel(grant.expiresAt)} · {grant.selectedEvidence.certifications.length} certification(s) · {grant.selectedEvidence.practiceSummaries.length} Practice summary(s)</Text>
                  <Button disabled={!canMutate || revokeMutation.isPending} label="Revoke now" onPress={() => confirmRevoke(grant)} variant="danger" />
                </Card>
              )) : <EmptyState description="No recruiter currently has an active selected-evidence grant." title="No active grants" />}
            </View>

            <View style={styles.section}>
              <Heading level={2}>Access history</Heading>
              <Text muted>Every authorized recruiter disclosure is recorded after the server revalidates the exact grant and selected evidence.</Text>
              {historyQuery.data?.length ? historyQuery.data.map((event) => (
                <Card key={event.id}>
                  <Text variant="bodyStrong">{event.recruiterCompany} viewed selected evidence</Text>
                  <Text muted variant="small">{dateLabel(event.occurredAt)} · {event.selectedCertificateIds.length} certification(s) · {event.selectedPracticeSummaryIds.length} Practice summary(s)</Text>
                </Card>
              )) : <EmptyState description="No recruiter has accessed a selected-evidence grant yet." title="No evidence access recorded" />}
            </View>
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  check: { alignItems: 'center', borderRadius: radii.sm, borderWidth: 2, height: 28, justifyContent: 'center', width: 28 },
  choice: { alignItems: 'flex-start', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: minimumTouchTarget, padding: spacing.md },
  expiry: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: minimumTouchTarget, paddingHorizontal: spacing.lg },
  expiryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  heading: { gap: spacing.sm },
  multiline: { minHeight: 100 },
  pressed: { opacity: 0.7 },
  row: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  section: { gap: spacing.md },
  stack: { gap: spacing.md },
});
