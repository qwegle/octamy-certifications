import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { type Href, router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge, Banner, Button, Card, ErrorState, Heading, Input, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { getLearnerProfile, updateLearnerProfile } from '@/features/profile';
import { asApiError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { radii, spacing, useAppTheme } from '@/theme';

const profileConsentHref = { pathname: '/interview/consent', params: { purpose: 'profile' } } as Href;

export default function InterviewIntroductionScreen() {
  const { canMutate } = useSession();
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const [script, setScript] = useState('');
  const [fontSize, setFontSize] = useState(22);

  const profileQuery = useQuery({ queryFn: getLearnerProfile, queryKey: queryKeys.profile.detail });
  useEffect(() => {
    if (!profileQuery.data || initialized.current) return;
    setScript(profileQuery.data.bio);
    initialized.current = true;
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateLearnerProfile({ bio: script.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
    },
  });

  if (profileQuery.isPending) {
    return <Screen><Heading>Prepare your introduction</Heading><Card accessibilityLabel="Loading About me" accessibilityRole="progressbar"><Skeleton height={120} /><Skeleton height={180} /></Card></Screen>;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <Screen><ErrorState description="Your About me text could not be loaded from your Octamy profile." onRetry={() => void profileQuery.refetch()} title="Profile unavailable" /></Screen>;
  }

  const savedScript = profileQuery.data.bio.trim();
  const hasUnsavedChanges = script.trim() !== savedScript;

  return (
    <Screen>
      <View style={styles.heading}>
        <Badge label="Private preparation" tone="accent" />
        <Heading>Prepare your personal introduction</Heading>
        <Text muted>Shape a clear About me, rehearse it with a teleprompter, then make a private take stored only on this device.</Text>
      </View>

      <Banner
        message="No verified profile-video upload or recruiter-video visibility API exists. Your take cannot be viewed by recruiters and will never be presented as shared evidence."
        title="Private by default—and by design"
        tone="info"
      />

      <Card>
        <Heading level={2}>Your About me</Heading>
        <Text muted variant="small">Saving updates the Professional bio field on your Octamy profile. Profile visibility remains a separate consent setting.</Text>
        <Input
          label="Introduction script"
          maxLength={2_000}
          multiline
          onChangeText={setScript}
          placeholder="Introduce your role, strongest relevant skills, evidence of your work, and what you want to contribute next…"
          style={styles.scriptInput}
          textAlignVertical="top"
          value={script}
        />
        <Text muted variant="small">{script.length}/2,000 characters</Text>
        {saveMutation.isError ? <Banner message={asApiError(saveMutation.error).message} title="About me not saved" tone="error" /> : null}
        {saveMutation.isSuccess && !hasUnsavedChanges ? <Badge label="Saved to profile" tone="success" /> : null}
        <Button
          disabled={!canMutate || !hasUnsavedChanges}
          label={saveMutation.isPending ? 'Saving About me…' : 'Save About me'}
          loading={saveMutation.isPending}
          onPress={() => saveMutation.mutate()}
          variant="accent"
        />
      </Card>

      <Card tone="marketing">
        <View style={styles.teleprompterHeader}>
          <View style={styles.grow}>
            <Text variant="label">TELEPROMPTER PREVIEW</Text>
            <Heading level={2}>Rehearse at your pace</Heading>
          </View>
          <View style={styles.fontControls}>
            <Button disabled={fontSize <= 16} label="A−" onPress={() => setFontSize((value) => Math.max(16, value - 2))} variant="secondary" />
            <Button disabled={fontSize >= 32} label="A+" onPress={() => setFontSize((value) => Math.min(32, value + 2))} variant="secondary" />
          </View>
        </View>
        <Text muted variant="small">Swipe to scroll. Adjust text size before or during recording.</Text>
        <ScrollView
          accessibilityLabel="Personal introduction teleprompter"
          nestedScrollEnabled
          style={[styles.teleprompter, { backgroundColor: colors.foreground }]}
          contentContainerStyle={styles.teleprompterContent}>
          <Text style={{ color: colors.background, fontSize, lineHeight: Math.round(fontSize * 1.48) }}>
            {script.trim() || 'Add your About me above to prepare a teleprompter script.'}
          </Text>
        </ScrollView>
      </Card>

      <Card>
        <Heading level={2}>Before you record</Heading>
        <View style={styles.guidance}>
          <Text>• Wear professional attire appropriate to your field.</Text>
          <Text>• Choose a quiet space and test for clear, echo-free audio.</Text>
          <Text>• Keep only one person in frame and avoid background interruptions.</Text>
          <Text>• Place the camera at eye level with your face and shoulders clearly framed.</Text>
          <Text>• Use soft front lighting; avoid a bright window behind you.</Text>
          <Text>• Do not say phone numbers, addresses, IDs, financial details, or other sensitive information.</Text>
        </View>
      </Card>

      {hasUnsavedChanges ? <Banner message="Save About me first so the recording teleprompter uses this latest script." title="Unsaved script" tone="warning" /> : null}
      <Button
        disabled={hasUnsavedChanges || !script.trim()}
        label="Review consent and record private take"
        onPress={() => router.push(profileConsentHref)}
        variant="accent"
      />
      <Button label="Review local recordings" onPress={() => router.push('/interview/recordings' as Href)} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fontControls: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs, minWidth: 180 },
  guidance: { gap: spacing.sm },
  heading: { gap: spacing.sm },
  scriptInput: { minHeight: 160 },
  teleprompter: { borderRadius: radii.lg, maxHeight: 260, minHeight: 180 },
  teleprompterContent: { padding: spacing.xl },
  teleprompterHeader: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
});
