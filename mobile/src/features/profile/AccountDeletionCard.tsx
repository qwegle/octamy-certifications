import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Heading, Input, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { asApiError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { minimumTouchTarget, radii, spacing, useAppTheme } from '@/theme';
import {
  cancelAccountDeletion,
  confirmAccountDeletion,
  getAccountDeletionState,
  isAccountDeletionUnavailable,
  requestAccountDeletion,
  type AccountDeletionState,
} from './account-deletion.api';

const deletionQueryKey = ['learner-profile', 'account-deletion'] as const;

function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function SupportFallback({ email }: { email: string | undefined }) {
  const { showToast } = useFeedback();
  const emailSupport = () => {
    Alert.alert(
      'Email account deletion support?',
      'Automated account deletion is unavailable right now. Support must verify your identity and process the request; sending email does not delete the account immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue to email',
          onPress: () => {
            const subject = encodeURIComponent('Learner account deletion request');
            const body = encodeURIComponent(`Please delete my Octamy learner account associated with ${email ?? 'my sign-in email'}. Please tell me what identity verification is required.`);
            void Linking.openURL(`mailto:support@octamy.com?subject=${subject}&body=${body}`).catch(() => {
              showToast({ title: 'Mail app unavailable', message: 'Email support@octamy.com to request account deletion.', tone: 'error' });
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.fallback}>
      <Banner title="Automated deletion unavailable" message="You can still contact support from this screen instead of reaching a dead end." tone="warning" />
      <Button label="Email account deletion support" onPress={emailSupport} variant="secondary" />
    </View>
  );
}

function Acknowledgement({ checked, disabled, onPress }: { checked: boolean; disabled: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityHint="Required before Octamy can email a deletion verification token."
      accessibilityLabel="I understand account deletion is permanent"
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
        <Text variant="bodyStrong">I understand account deletion is permanent</Text>
        <Text muted variant="small">I have reviewed what Octamy erases and what it must retain.</Text>
      </View>
    </Pressable>
  );
}

export function AccountDeletionCard() {
  const queryClient = useQueryClient();
  const { canMutate, signOut, user } = useSession();
  const { showToast } = useFeedback();
  const [acknowledged, setAcknowledged] = useState(false);
  const [token, setToken] = useState('');
  const [operationError, setOperationError] = useState<string | null>(null);
  const completedStateHandled = useRef(false);

  const stateQuery = useQuery({ queryFn: getAccountDeletionState, queryKey: deletionQueryKey, retry: false });
  const setState = (state: AccountDeletionState) => {
    queryClient.setQueryData(deletionQueryKey, state);
    return state;
  };

  const requestMutation = useMutation({
    mutationFn: requestAccountDeletion,
    onSuccess: (state) => {
      setOperationError(null);
      setAcknowledged(false);
      showToast({ title: 'Check your email', message: 'Enter the deletion token within 30 minutes to finish.', tone: 'success' });
      setState(state);
    },
    onError: (error) => setOperationError(asApiError(error).message),
  });
  const cancelMutation = useMutation({
    mutationFn: cancelAccountDeletion,
    onSuccess: (state) => {
      setOperationError(null);
      setToken('');
      showToast({ title: 'Deletion request cancelled', message: 'Your account remains active.', tone: 'success' });
      setState(state);
    },
    onError: (error) => setOperationError(asApiError(error).message),
  });
  const confirmMutation = useMutation({
    mutationFn: async () => {
      const state = await confirmAccountDeletion(token);
      if (state.state !== 'completed') throw new Error('Account deletion did not complete.');
      await signOut();
      return state;
    },
    onError: (error) => setOperationError(asApiError(error).message),
  });

  const unavailable = isAccountDeletionUnavailable(stateQuery.error)
    || isAccountDeletionUnavailable(requestMutation.error);
  const state = stateQuery.data;
  const pending = state?.state === 'requested';
  const canRequest = state?.state === 'none' || state?.state === 'cancelled' || state?.state === 'rejected';
  const busy = requestMutation.isPending || cancelMutation.isPending || confirmMutation.isPending;

  useEffect(() => {
    if (state?.state !== 'completed' || completedStateHandled.current) return;
    completedStateHandled.current = true;
    void signOut();
  }, [signOut, state?.state]);

  const askToRequest = () => {
    if (!acknowledged || !canMutate || busy) return;
    Alert.alert(
      'Email a deletion verification token?',
      'This starts a deletion request but does not erase anything yet. You must enter the token sent to your account email. The token expires after 30 minutes.',
      [
        { text: 'Keep account', style: 'cancel' },
        { text: 'Email token', style: 'destructive', onPress: () => requestMutation.mutate() },
      ],
    );
  };
  const askToCancel = () => Alert.alert(
    'Cancel pending deletion?',
    'The emailed token will stop working and your account will remain active.',
    [
      { text: 'Keep request', style: 'cancel' },
      { text: 'Cancel deletion request', onPress: () => cancelMutation.mutate() },
    ],
  );
  const askToConfirm = () => {
    if (token.trim().length < 20 || busy) return;
    Alert.alert(
      'Permanently delete your account?',
      'This is the final step. Erasure cannot be undone. You will be signed out and local learner data on this device will be cleared.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: () => confirmMutation.mutate() },
      ],
    );
  };

  return (
    <Card>
      <Heading level={2}>Delete learner account</Heading>
      <Text>Octamy permanently erases your sign-in credentials, profile and contact details, addresses and resume files, preferences, learning progress and reviews, interview responses and artifact references, and active evidence-sharing grants.</Text>
      <Text>Issued credentials stay publicly verifiable, but are changed to “Deleted account.” De-identified assessment attempts and aggregate statistics remain so issued evidence stays trustworthy.</Text>
      <Text>Payment, tax, and coupon records are retained for legal and accounting obligations. De-identified audit and recruiter-evidence events are retained for security and compliance.</Text>
      <Text muted variant="small">Creator, institute, and administrator accounts require administered offboarding; this flow is for learner accounts only.</Text>

      {stateQuery.isPending ? <View accessibilityLabel="Loading account deletion state" accessibilityRole="progressbar"><Skeleton height={72} /></View> : null}
      {unavailable ? <SupportFallback email={user?.email} /> : null}
      {stateQuery.isError && !unavailable ? <Banner title="Deletion status unavailable" message={asApiError(stateQuery.error).message} tone="error" /> : null}
      {operationError && !unavailable ? <Banner title="Account not deleted" message={operationError} tone="error" /> : null}

      {!stateQuery.isPending && !unavailable && canRequest ? (
        <>
          {state?.state === 'cancelled' ? <Banner title="Previous request cancelled" message="Your account remains active. You may start a new verified request." tone="info" /> : null}
          {state?.state === 'rejected' ? <Banner title="Previous request could not continue" message="Review the details and start another request, or contact support if the issue continues." tone="warning" /> : null}
          <Acknowledgement checked={acknowledged} disabled={!canMutate || busy} onPress={() => setAcknowledged((value) => !value)} />
          <Button
            disabled={!canMutate || !acknowledged || busy}
            label={requestMutation.isPending ? 'Requesting deletion…' : 'Request account deletion'}
            loading={requestMutation.isPending}
            onPress={askToRequest}
            variant="danger"
          />
        </>
      ) : null}

      {pending ? (
        <>
          <Banner title="Deletion request pending" message={`A verification token was emailed to ${user?.email ?? 'your account email'}. It expires ${dateLabel(state.tokenExpiresAt)}. If it expired, cancel this request and start again.`} tone="warning" />
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy && canMutate}
            hint="Paste the token from the Octamy email. Octamy never asks for your password here."
            label="Email verification token"
            onChangeText={setToken}
            value={token}
          />
          <Button
            disabled={!canMutate || busy || token.trim().length < 20}
            label={confirmMutation.isPending ? 'Deleting account…' : 'Verify and permanently delete'}
            loading={confirmMutation.isPending}
            onPress={askToConfirm}
            variant="danger"
          />
          <Button disabled={!canMutate || busy} label="Cancel deletion request" onPress={askToCancel} variant="secondary" />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  check: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  choice: { alignItems: 'center', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: minimumTouchTarget, padding: spacing.md },
  fallback: { gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.75 },
});
