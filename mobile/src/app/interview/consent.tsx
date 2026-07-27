import { useState } from 'react';
import { AccessibilityInfo, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Badge, Banner, Button, Card, ErrorState, Heading, Screen, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { asApiError } from '@/lib/api-client';
import { issueRecordingConsentGrant } from '@/features/interview/recording-consent';
import { createAndStartInterview, getInterviewStatus } from '@/features/interview/interview.api';
import { queryKeys } from '@/lib/query-keys';
import { minimumTouchTarget, radii, spacing, useAppTheme } from '@/theme';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function CheckChoice({ checked, description, label, onPress }: {
  checked: boolean;
  description: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, { borderColor: checked ? colors.accent : colors.border }, pressed && styles.pressed]}>
      <View style={[styles.check, { backgroundColor: checked ? colors.accent : colors.surface, borderColor: checked ? colors.accent : colors.border }]}>
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ color: checked ? colors.onAccent : colors.foreground }} variant="label">{checked ? '✓' : ''}</Text>
      </View>
      <View style={styles.grow}>
        <Text variant="bodyStrong">{label}</Text>
        <Text muted variant="small">{description}</Text>
      </View>
    </Pressable>
  );
}

export default function InterviewConsentScreen() {
  const params = useLocalSearchParams();
  const purposeValue = one(params.purpose);
  const purpose = purposeValue === 'session' || purposeValue === 'answer' ? purposeValue : 'profile';
  const templateId = Number(one(params.templateId));
  const sessionId = one(params.sessionId);
  const itemKey = one(params.itemKey);
  const questionTitle = one(params.questionTitle);
  const maxSeconds = one(params.maxSeconds);
  const { canMutate, user } = useSession();
  const { colors } = useAppTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [captureConsent, setCaptureConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const needsServerStatus = purpose === 'session';
  const statusQuery = useQuery({
    enabled: needsServerStatus,
    queryFn: getInterviewStatus,
    queryKey: queryKeys.interview.status,
    staleTime: 0,
  });
  const aiAvailable = statusQuery.data?.aiEvaluationEnabled === true;

  const createMutation = useMutation({
    mutationFn: createAndStartInterview,
    onSuccess: (session) => {
      router.replace({ pathname: '/interview/session', params: { sessionId: session.id } } as Href);
    },
  });

  const requestCapturePermissions = async (): Promise<{ camera: boolean; microphone: boolean }> => {
    const cameraResult = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!cameraResult.granted) {
      setPermissionError(cameraResult.canAskAgain
        ? 'Camera access was not granted. You can try again or open system settings.'
        : 'Camera access is blocked or restricted. Open system settings to allow it.');
      await AccessibilityInfo.announceForAccessibility('Camera permission was not granted.');
      return { camera: false, microphone: false };
    }

    const microphoneResult = microphonePermission?.granted
      ? microphonePermission
      : await requestMicrophonePermission();
    if (!microphoneResult.granted) {
      setPermissionError(microphoneResult.canAskAgain
        ? 'Microphone access was not granted. You can try again or open system settings.'
        : 'Microphone access is blocked or restricted. Open system settings to allow it.');
      await AccessibilityInfo.announceForAccessibility('Microphone permission was not granted.');
      return { camera: true, microphone: false };
    }
    setPermissionError(null);
    return { camera: true, microphone: true };
  };

  const continueFlow = async () => {
    if (purpose !== 'session' && !captureConsent) return;
    if (purpose === 'session' && aiAvailable && !aiConsent) return;

    let granted = { camera: false, microphone: false };
    if (captureConsent) {
      granted = await requestCapturePermissions();
      if (!granted.camera || !granted.microphone) return;
    }

    if (purpose === 'session') {
      if (!Number.isInteger(templateId) || templateId <= 0 || !statusQuery.data) return;
      createMutation.mutate({
        aiProcessing: aiAvailable && aiConsent,
        cameraGranted: granted.camera,
        consentVersion: statusQuery.data.consentVersion,
        microphoneGranted: granted.microphone,
        templateId,
      });
      return;
    }

    if (!user) return;
    const requestedSeconds = Number(maxSeconds);
    const consentToken = issueRecordingConsentGrant({
      itemKey,
      kind: purpose === 'profile' ? 'profile' : 'answer',
      maxSeconds: Number.isFinite(requestedSeconds) ? requestedSeconds : undefined,
      ownerId: user.id,
      questionTitle,
      sessionId,
    });
    router.replace({
      pathname: '/interview/capture',
      params: { consentToken },
    } as Href);
  };

  const permissionSummary = `Camera: ${cameraPermission?.status ?? 'undetermined'}. Microphone: ${microphonePermission?.status ?? 'undetermined'}.`;
  const waitingForStatus = needsServerStatus && statusQuery.isLoading;
  const submitDisabled = waitingForStatus
    || createMutation.isPending
    || !user
    || (purpose !== 'session' && !captureConsent)
    || (purpose === 'session' && aiAvailable && !aiConsent)
    || (purpose === 'session' && !canMutate);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Close consent screen" accessibilityRole="button" hitSlop={4} onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { borderColor: colors.border }, pressed && styles.pressed]}>
          <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" variant="h3">×</Text>
        </Pressable>
        <Badge label="Before camera access" tone="accent" />
      </View>
      <Heading>{purpose === 'session' ? 'Choose your private practice consent' : 'Review before recording'}</Heading>
      <Text muted>Octamy will not open the camera or microphone until you make the choices below and press continue.</Text>

      <Card>
        <Heading level={2}>What local video captures</Heading>
        <Text>Camera video, microphone audio, recording duration, and—only for an answer take—the question label.</Text>
        <Text muted>It is stored inside Octamy’s private app storage. It is never uploaded, attached to your profile, evaluated by AI, or shared with recruiters.</Text>
      </Card>

      <Card>
        <Heading level={2}>Retention and deletion</Heading>
        <Text muted>Local videos remain in backup-excluded app cache until you delete them, sign out, uninstall Octamy, or the operating system reclaims cache storage. They are not included in Octamy-managed cloud backups.</Text>
        {purpose === 'session' ? <Text muted>Typed/code responses are sent only for this server practice session, retained by Octamy for 30 days, and can be deleted from the session screen. They are not recruiter evidence.</Text> : null}
      </Card>

      {purpose === 'session' ? (
        statusQuery.isError ? (
          <ErrorState description="Octamy must load the current consent version before starting a server practice session." onRetry={() => void statusQuery.refetch()} title="Consent version unavailable" />
        ) : (
          <>
            {aiAvailable ? (
              <CheckChoice
                checked={aiConsent}
                description="My typed or code responses may be processed for private AI feedback. Local video is never sent to AI."
                label="I consent to AI processing of my submitted text"
                onPress={() => setAiConsent((value) => !value)}
              />
            ) : (
              <Banner message="You can still rehearse and save typed responses, but this environment will not generate AI feedback." title="AI feedback unavailable" tone="warning" />
            )}
            <CheckChoice
              checked={captureConsent}
              description="Optional now. If left off, you can review this disclosure again before recording any answer."
              label="Enable camera and microphone for local video now"
              onPress={() => setCaptureConsent((value) => !value)}
            />
          </>
        )
      ) : (
        <CheckChoice
          checked={captureConsent}
          description="I understand this take includes video and audio, stays in private app storage, and can be deleted at any time."
          label="I consent to this local video recording"
          onPress={() => setCaptureConsent((value) => !value)}
        />
      )}

      <View accessibilityLabel={permissionSummary} accessibilityRole="summary" style={[styles.permission, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="label">Current device permissions</Text>
        <Text muted variant="small">{permissionSummary}</Text>
      </View>

      {permissionError ? (
        <Banner message={permissionError} title="Permission needed" tone="warning" />
      ) : null}
      {permissionError ? <Button label="Open system settings" onPress={() => void Linking.openSettings()} variant="secondary" /> : null}

      {createMutation.isError ? (
        <Banner message={asApiError(createMutation.error).message} title="Could not start practice" tone="error" />
      ) : null}
      <Button
        disabled={submitDisabled}
        label={createMutation.isPending ? 'Starting private session…' : captureConsent ? 'Continue and request permissions' : 'Continue without camera'}
        loading={createMutation.isPending}
        onPress={() => void continueFlow()}
        variant="accent"
      />
      <Button label="Not now" onPress={() => router.back()} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { alignItems: 'center', borderRadius: radii.sm, borderWidth: 1, height: 28, justifyContent: 'center', width: 28 },
  choice: { alignItems: 'flex-start', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: minimumTouchTarget, padding: spacing.lg },
  grow: { flex: 1, gap: spacing.xs },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  iconButton: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, height: minimumTouchTarget, justifyContent: 'center', width: minimumTouchTarget },
  permission: { borderRadius: radii.md, gap: spacing.xs, padding: spacing.md },
  pressed: { opacity: 0.62 },
});
