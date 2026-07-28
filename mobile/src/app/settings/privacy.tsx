import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Href, router, Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Share, StyleSheet, Switch, View } from 'react-native';

import { Banner, Button, Card, ErrorState, Heading, Screen, Skeleton, Text } from '@/components/ui';
import { requireApiUrl } from '@/config/env';
import { requestPasswordReset, useSession } from '@/features/auth';
import {
  getEvidencePassportLink,
  getLearnerProfile,
  updateLearnerProfile,
  type LearnerProfile,
} from '@/features/profile';
import { asApiError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { queryKeys } from '@/lib/query-keys';
import { minimumTouchTarget, spacing, useAppTheme } from '@/theme';

const evidenceSharingHref = '/settings/evidence-sharing' as Href;

type ConsentField = 'evidencePassportPublic' | 'profileVisibility';

interface ConsentChange {
  field: ConsentField;
  value: boolean;
}

function ConsentControl({
  disabled,
  effect,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  effect: string;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.consent, { borderColor: colors.border }]}>
      <View style={styles.consentCopy}>
        <Text variant="bodyStrong">{label}</Text>
        <Text muted variant="small">Status: {value ? 'On — sharing enabled' : 'Off — private'}</Text>
        <Text variant="small">{effect}</Text>
      </View>
      <Switch
        accessibilityHint={effect}
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onValueChange={onChange}
        style={styles.switch}
        trackColor={{ false: colors.surfaceMuted, true: colors.accentSoft }}
        thumbColor={value ? colors.accent : colors.textMuted}
        value={value}
      />
    </View>
  );
}

export default function PrivacyScreen() {
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const { showToast } = useFeedback();
  const { canMutate, signOut, user } = useSession();
  const [announcement, setAnnouncement] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const profileQuery = useQuery({ queryKey: queryKeys.profile.detail, queryFn: getLearnerProfile });
  const passportQuery = useQuery({ queryKey: queryKeys.profile.passportLink, queryFn: getEvidencePassportLink });

  const consentMutation = useMutation({
    mutationFn: ({ field, value }: ConsentChange) => updateLearnerProfile({ [field]: value }),
    onSuccess: (_result, change) => {
      queryClient.setQueryData<LearnerProfile>(queryKeys.profile.detail, (current) => current ? { ...current, [change.field]: change.value } : current);
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
      const scope = change.field === 'profileVisibility' ? 'Recruiter discovery' : 'Public evidence passport';
      const message = `${scope} is now ${change.value ? 'on' : 'off'}.`;
      setAnnouncement(message);
      showToast({ title: 'Consent updated', message: `${message} The server confirmed this change.`, tone: 'success' });
    },
    onError: (error) => {
      const message = asApiError(error).message;
      setAnnouncement(`Consent was not changed. ${message}`);
      showToast({ title: 'Consent unchanged', message, tone: 'error' });
    },
  });

  const applyConsent = useCallback((field: ConsentField, value: boolean) => {
    if (!canMutate || consentMutation.isPending) return;
    if (!value) {
      consentMutation.mutate({ field, value: false });
      return;
    }
    const isRecruiter = field === 'profileVisibility';
    Alert.alert(
      isRecruiter ? 'Allow recruiter discovery?' : 'Make your evidence passport public?',
      isRecruiter
        ? 'Eligible profile and certificate evidence can appear to active, KYC-approved recruiters. Recruiters may spend credits to unlock detailed profile or CV access. Your public evidence link remains a separate setting.'
        : 'Anyone who has your stable, non-expiring evidence link can view your name, role, location, bio, self-reported skills, portfolio links, certificate scores, and assessment details. This does not turn on recruiter discovery.',
      [
        { text: 'Keep private', style: 'cancel' },
        { text: 'Turn on', onPress: () => consentMutation.mutate({ field, value: true }) },
      ],
    );
  }, [canMutate, consentMutation]);

  const openWebsitePath = async (path: '/privacy-policy' | '/terms-of-service' | '/user-deletion') => {
    try {
      await Linking.openURL(`${requireApiUrl()}${path}`);
    } catch {
      showToast({ title: 'Link unavailable', message: 'Octamy could not open this page. Please try again later.', tone: 'error' });
    }
  };

  const sharePassport = async () => {
    const link = passportQuery.data;
    if (!link?.isPublic) return;
    try {
      const url = `${requireApiUrl()}${link.path}`;
      await Share.share({ message: `My Octamy Skill Evidence Passport: ${url}`, url });
    } catch {
      showToast({ title: 'Unable to share', message: 'The evidence link could not be shared.', tone: 'error' });
    }
  };

  const requestReset = () => {
    if (!user?.email || !canMutate) return;
    Alert.alert(
      'Request a password reset email?',
      `Octamy will send reset instructions to ${user.email}. The secure reset page opens on the Octamy website.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send email',
          onPress: () => {
            void requestPasswordReset(user.email)
              .then((message) => showToast({ title: 'Check your email', message, tone: 'success' }))
              .catch((error) => showToast({ title: 'Email not sent', message: asApiError(error).message, tone: 'error' }));
          },
        },
      ],
    );
  };

  const contactDeletionSupport = () => {
    Alert.alert(
      'Request account deletion?',
      'Octamy does not yet provide an automated learner account-deletion endpoint. Continue to email support from your mail app. Support must verify and process the request.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue to email',
          onPress: () => {
            const subject = encodeURIComponent('Learner account deletion request');
            const body = encodeURIComponent(`Please delete my Octamy learner account associated with ${user?.email ?? 'my sign-in email'}. Please tell me what identity verification is required.`);
            void Linking.openURL(`mailto:support@octamy.com?subject=${subject}&body=${body}`).catch(() => {
              showToast({ title: 'Mail app unavailable', message: 'Email support@octamy.com to request account deletion.', tone: 'error' });
            });
          },
        },
      ],
    );
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out on this device?', 'Your local token and app-stored learner data on this device will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          void signOut().catch(() => undefined).finally(() => setSigningOut(false));
        },
      },
    ]);
  };

  const profile = profileQuery.data;
  const changingField = consentMutation.variables?.field;

  return (
    <>
      <Stack.Screen options={{ title: 'Privacy & evidence' }} />
      <Screen>
        <View style={styles.heading}>
          <Heading>Privacy & evidence</Heading>
          <Text muted>Sharing starts off unless your existing server profile says you previously opted in. Each scope can be revoked independently.</Text>
        </View>

        {!canMutate ? <Banner title="Changes paused" message="Reconnect and validate your session before changing consent or account settings." tone="warning" /> : null}
        {announcement ? <Text accessibilityLiveRegion="assertive" style={styles.srAnnouncement}>{announcement}</Text> : null}

        {profileQuery.isPending ? (
          <Card accessibilityLabel="Loading privacy settings" accessibilityRole="progressbar">
            <Skeleton height={96} /><Skeleton height={96} />
          </Card>
        ) : profileQuery.isError || !profile ? (
          <ErrorState title="Privacy settings unavailable" onRetry={() => void profileQuery.refetch()} />
        ) : (
          <Card>
            <Heading level={2}>Recruiter discovery and public links</Heading>
            <Text muted variant="small">These global settings remain separate from recruiter-specific, selected, expiring grants below. Discovery alone never discloses assessment activity.</Text>
            <ConsentControl
              disabled={!canMutate || consentMutation.isPending}
              effect={profile.profileVisibility
                ? 'Active, KYC-approved recruiters may discover your eligible profile. A profile or CV unlock still does not disclose assessment activity without a separate evidence grant.'
                : 'Recruiters cannot discover your profile through learner search. Previously unlocked profile access is rechecked against consent and withdrawn when this is off.'}
              label="Verified recruiter discovery"
              onChange={(value) => applyConsent('profileVisibility', value)}
              value={profile.profileVisibility}
            />
            {changingField === 'profileVisibility' && consentMutation.isPending ? <Text accessibilityLiveRegion="polite" variant="small">Saving recruiter discovery consent…</Text> : null}
            <ConsentControl
              disabled={!canMutate || consentMutation.isPending}
              effect={profile.evidencePassportPublic
                ? 'Anyone with your stable evidence link can view holder details, certificate scores, and assessment evidence. This setting alone does not make you recruiter-searchable.'
                : 'Your evidence link returns no public passport. Recruiter discovery remains controlled separately above.'}
              label="Public evidence passport link"
              onChange={(value) => applyConsent('evidencePassportPublic', value)}
              value={profile.evidencePassportPublic}
            />
            {changingField === 'evidencePassportPublic' && consentMutation.isPending ? <Text accessibilityLiveRegion="polite" variant="small">Saving public passport consent…</Text> : null}
            {profile.evidencePassportPublic && passportQuery.data?.isPublic ? (
              <Button label="Share public evidence link" onPress={() => void sharePassport()} variant="secondary" />
            ) : null}
          </Card>
        )}

        <Card>
          <Heading level={2}>What always stays private</Heading>
          <Text>• Your password and app session token.</Text>
          <Text>• Practice answers, question data, and raw integrity telemetry. Only a summary you explicitly select can enter a recruiter grant.</Text>
          <Text>• Interview Studio practice sessions and local rehearsal video. The server exposes no recruiter-sharing or learner video-upload capability.</Text>
          <Text>• Any credential or Practice summary you did not select for that exact recruiter grant.</Text>
        </Card>

        <Card>
          <Heading level={2}>Selected recruiter evidence grants</Heading>
          <Text muted>Choose one eligible recruiter, a limited purpose, exact current credentials and optional Practice summaries, and an automatic expiry. Review access history or revoke a grant at any time.</Text>
          <Button label="Manage selected evidence grants" onPress={() => router.push(evidenceSharingHref)} />
        </Card>

        <Card>
          <Heading level={2}>Legal & support</Heading>
          <Button label="Open Privacy Policy" onPress={() => void openWebsitePath('/privacy-policy')} variant="secondary" />
          <Button label="Open Terms of Service" onPress={() => void openWebsitePath('/terms-of-service')} variant="secondary" />
          <Button label="Open User Deletion Policy" onPress={() => void openWebsitePath('/user-deletion')} variant="secondary" />
          <Button label="Email account deletion support" onPress={contactDeletionSupport} variant="secondary" />
          <Text muted variant="small">No automated account-deletion API exists. Email support@octamy.com from this in-app path to start a verified deletion request.</Text>
        </Card>

        <Card>
          <Heading level={2}>Security & session</Heading>
          <Text muted variant="small">There is no authenticated change-password endpoint. A reset email opens Octamy’s verified web reset flow.</Text>
          <Button disabled={!canMutate} label="Send password reset email" onPress={requestReset} variant="secondary" />
          <Button disabled={signingOut} label={signingOut ? 'Signing out…' : 'Sign out on this device'} loading={signingOut} onPress={confirmSignOut} variant="danger" />
          <Text muted variant="small">The server does not support session listing, token revocation, or sign out on every device.</Text>
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  consent: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  consentCopy: { flex: 1, gap: spacing.xs },
  heading: { gap: spacing.sm },
  srAnnouncement: { color: 'transparent', height: 1, position: 'absolute', width: 1 },
  switch: { minHeight: minimumTouchTarget, minWidth: minimumTouchTarget },
});
