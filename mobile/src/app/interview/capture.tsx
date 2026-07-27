import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { CameraView, type CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import { Banner, Button, Heading, Screen, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { getLearnerProfile } from '@/features/profile';
import { consumeRecordingConsentGrant, deleteTemporaryRecording, keepRecording, LocalVideoReview, type RecordingConsentGrant } from '@/features/interview';
import { queryKeys } from '@/lib/query-keys';
import { formatClock } from '@/lib/format';
import { minimumTouchTarget, motion, radii, spacing, useAppReducedMotion, useAppTheme } from '@/theme';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function CameraIconButton({ glyph, label, onPress, disabled = false }: {
  disabled?: boolean;
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const reduceMotion = useAppReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animatedStyle, disabled && styles.disabled]}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={4}
        onPress={onPress}
        onPressIn={() => {
          scale.value = reduceMotion ? 1 : withSpring(motion.scale.pressed, motion.gestureSpring);
        }}
        onPressOut={() => {
          scale.value = reduceMotion ? 1 : withSpring(1, motion.gestureSpring);
        }}
        style={({ pressed }) => [styles.cameraButton, { backgroundColor: colors.overlay, borderColor: colors.onPrimary }, pressed && styles.pressed]}>
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cameraGlyph}>{glyph}</Text>
      </Pressable>
    </Animated.View>
  );
}

function RecordingState({ elapsed, limit }: { elapsed: number; limit: number }) {
  const { colors } = useAppTheme();
  const reduceMotion = useAppReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
    } else {
      opacity.value = withRepeat(withTiming(0.42, { duration: 600 }), -1, true);
    }
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View
      accessibilityLabel={`Recording. ${formatClock(elapsed)} elapsed of ${formatClock(limit)} maximum.`}
      accessibilityRole="timer"
      style={[styles.recordingState, { backgroundColor: colors.overlay }]}>
      <Animated.View style={[styles.recordingDot, { backgroundColor: colors.destructive }, pulseStyle]} />
      <Text style={styles.recordingText} variant="label">RECORDING · {formatClock(elapsed)} / {formatClock(limit)}</Text>
    </View>
  );
}

export default function InterviewCaptureScreen() {
  const params = useLocalSearchParams();
  const consentToken = one(params.consentToken);
  const { user } = useSession();
  const { colors } = useAppTheme();
  const { height: viewportHeight } = useWindowDimensions();
  const consumedTokenRef = useRef<string | null>(null);
  const [consentGrant, setConsentGrant] = useState<RecordingConsentGrant | null | undefined>(undefined);
  const kind = consentGrant?.kind ?? 'profile';
  const sessionId = consentGrant?.sessionId;
  const itemKey = consentGrant?.itemKey;
  const questionTitle = consentGrant?.questionTitle;
  const requestedLimit = consentGrant?.maxSeconds;
  const limitSeconds = Number.isFinite(requestedLimit) ? Math.min(180, Math.max(15, Math.round(requestedLimit!))) : kind === 'profile' ? 60 : 120;
  const cameraHeight = Math.max(320, Math.min(620, viewportHeight - 220));
  const teleprompterHeight = Math.max(96, Math.min(180, cameraHeight - 200));
  const [cameraPermission] = useCameraPermissions();
  const [microphonePermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const mountedRef = useRef(true);
  const closingRef = useRef(false);
  const startedAtRef = useRef(0);
  const [facing, setFacing] = useState<CameraType>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(20);
  const profileQuery = useQuery({
    enabled: consentGrant?.kind === 'profile',
    queryFn: getLearnerProfile,
    queryKey: queryKeys.profile.detail,
  });

  useEffect(() => {
    if (!user || !consentToken) {
      setConsentGrant(null);
      return;
    }
    if (consumedTokenRef.current === consentToken) return;
    consumedTokenRef.current = consentToken;
    setConsentGrant(consumeRecordingConsentGrant(consentToken, user.id));
  }, [consentToken, user]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setAppActive(active);
      if (!active && recording) cameraRef.current?.stopRecording();
    });
    return () => subscription.remove();
  }, [recording]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const next = Math.min(limitSeconds, Math.floor((Date.now() - startedAtRef.current) / 1_000));
      setElapsed(next);
    }, 1_000);
    return () => clearInterval(timer);
  }, [limitSeconds, recording]);

  const close = () => {
    closingRef.current = true;
    if (recording) cameraRef.current?.stopRecording();
    deleteTemporaryRecording(previewUri);
    void AccessibilityInfo.announceForAccessibility('Camera closed. Recording discarded.');
    router.back();
  };

  const startRecording = async () => {
    if (!cameraReady || recording || !cameraRef.current) return;
    setError(null);
    setElapsed(0);
    setRecording(true);
    startedAtRef.current = Date.now();
    await AccessibilityInfo.announceForAccessibility(`Recording started. Maximum duration ${formatClock(limitSeconds)}.`);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: limitSeconds });
      const measured = Math.max(1, Math.min(limitSeconds, Math.round((Date.now() - startedAtRef.current) / 1_000)));
      if (!result?.uri) throw new Error('No recording was created.');
      if (closingRef.current || !mountedRef.current) {
        deleteTemporaryRecording(result.uri);
        return;
      }
      setDuration(measured);
      setPreviewUri(result.uri);
      await AccessibilityInfo.announceForAccessibility('Recording stopped. Review your private take.');
    } catch {
      if (mountedRef.current && !closingRef.current) setError('The camera could not finish this recording. Please try again.');
    } finally {
      if (mountedRef.current) setRecording(false);
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    cameraRef.current?.stopRecording();
  };

  const rerecord = async () => {
    const oldUri = previewUri;
    setPreviewUri(null);
    setDuration(0);
    setElapsed(0);
    await new Promise((resolve) => setTimeout(resolve, motion.duration.feedback));
    deleteTemporaryRecording(oldUri);
    await AccessibilityInfo.announceForAccessibility('Previous take deleted. Camera ready for another take.');
  };

  const keep = async () => {
    if (!previewUri || !user || saving) return;
    setSaving(true);
    const uri = previewUri;
    setPreviewUri(null);
    await new Promise((resolve) => setTimeout(resolve, motion.duration.feedback));
    try {
      await keepRecording({
        durationSeconds: duration,
        itemKey,
        kind,
        ownerId: user.id,
        questionTitle,
        sessionId,
        temporaryUri: uri,
      });
      await AccessibilityInfo.announceForAccessibility('Recording kept in private local storage.');
      router.back();
    } catch {
      setPreviewUri(uri);
      setError('This recording could not be kept. It remains available for review; try again or delete it.');
      setSaving(false);
    }
  };

  const reviewConsentHref = {
    pathname: '/interview/consent',
    params: { itemKey, maxSeconds: String(limitSeconds), purpose: kind === 'profile' ? 'profile' : 'answer', questionTitle, sessionId },
  } as Href;

  if (consentGrant === undefined) {
    return <Screen><Text accessibilityLiveRegion="polite">Validating recording consent…</Text></Screen>;
  }

  if (!consentGrant) {
    return (
      <Screen>
        <Heading>Consent required</Heading>
        <Text muted>This recording link has no valid one-time consent grant. The camera remains off until you review and accept the local recording disclosure.</Text>
        <Button label="Review recording consent" onPress={() => router.replace(reviewConsentHref)} variant="accent" />
        <Button label="Go back" onPress={() => router.back()} variant="ghost" />
      </Screen>
    );
  }

  if (!cameraPermission || !microphonePermission) {
    return <Screen><Text accessibilityLiveRegion="polite">Checking camera and microphone permission…</Text></Screen>;
  }

  if (!cameraPermission.granted || !microphonePermission.granted) {
    return (
      <Screen>
        <Heading>Camera and microphone unavailable</Heading>
        <Text muted>Permission was denied, restricted, or later removed. The camera remains off.</Text>
        <Button label="Open system settings" onPress={() => void Linking.openSettings()} variant="secondary" />
        <Button label="Review consent again" onPress={() => router.replace(reviewConsentHref)} variant="ghost" />
      </Screen>
    );
  }

  if (previewUri || saving) {
    return (
      <Screen>
        <View style={styles.reviewHeader}>
          <View style={styles.grow}>
            <Text muted variant="label">PRIVATE LOCAL REVIEW</Text>
            <Heading level={2}>{kind === 'profile' ? 'Profile practice take' : questionTitle ?? 'Interview answer take'}</Heading>
          </View>
          <CameraIconButton glyph="×" label="Close and delete recording" onPress={close} />
        </View>
        {saving ? <Text accessibilityLiveRegion="polite">Keeping recording in private storage…</Text> : <LocalVideoReview uri={previewUri} />}
        <Text muted>Duration {formatClock(duration)}. This video has not been uploaded or processed by AI.</Text>
        {error ? <Banner message={error} title="Recording issue" tone="error" /> : null}
        <Button disabled={saving} label="Keep on this device" loading={saving} onPress={() => void keep()} variant="accent" />
        <Button disabled={saving} label="Re-record (delete this take)" onPress={() => void rerecord()} variant="secondary" />
        <Button disabled={saving} label="Delete take" onPress={close} variant="danger" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.cameraFrame, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, height: cameraHeight }]}>
        <CameraView
          active={appActive}
          facing={facing}
          mirror={facing === 'front'}
          mode="video"
          mute={false}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => setError('The camera preview could not start on this device.')}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          videoQuality="720p"
        />
        <View pointerEvents="box-none" style={styles.topControls}>
          <CameraIconButton glyph="×" label="Close camera" onPress={close} />
          <CameraIconButton
            disabled={recording}
            glyph="↻"
            label="Flip camera"
            onPress={() => setFacing((value) => value === 'front' ? 'back' : 'front')}
          />
        </View>
        {recording ? <RecordingState elapsed={elapsed} limit={limitSeconds} /> : (
          <View accessibilityRole="summary" style={[styles.limitBadge, { backgroundColor: colors.overlay }]}>
            <Text style={styles.recordingText} variant="label">LIMIT · {formatClock(limitSeconds)}</Text>
          </View>
        )}
        {kind === 'profile' && profileQuery.data?.bio.trim() ? (
          <View style={[styles.teleprompterOverlay, { backgroundColor: colors.overlay, maxHeight: teleprompterHeight }]}>
            <View style={styles.teleprompterHeader}>
              <Text style={styles.recordingText} variant="label">ABOUT ME TELEPROMPTER</Text>
              <View style={styles.teleprompterControls}>
                <Pressable
                  accessibilityLabel="Decrease teleprompter text size"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: teleprompterFontSize <= 16 }}
                  disabled={teleprompterFontSize <= 16}
                  onPress={() => setTeleprompterFontSize((value) => Math.max(16, value - 2))}
                  style={styles.teleprompterButton}>
                  <Text style={styles.recordingText} variant="label">A−</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Increase teleprompter text size"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: teleprompterFontSize >= 30 }}
                  disabled={teleprompterFontSize >= 30}
                  onPress={() => setTeleprompterFontSize((value) => Math.min(30, value + 2))}
                  style={styles.teleprompterButton}>
                  <Text style={styles.recordingText} variant="label">A+</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView accessibilityLabel="Recording teleprompter. Swipe to scroll." nestedScrollEnabled style={[styles.teleprompterScroll, { maxHeight: Math.max(40, teleprompterHeight - 68) }]}>
              <Text style={[styles.recordingText, { fontSize: teleprompterFontSize, lineHeight: Math.round(teleprompterFontSize * 1.42) }]}>
                {profileQuery.data.bio}
              </Text>
            </ScrollView>
          </View>
        ) : null}
        <View style={styles.bottomControls}>
          {recording ? (
            <CameraIconButton glyph="■" label="Stop recording" onPress={stopRecording} />
          ) : (
            <CameraIconButton disabled={!cameraReady} glyph="●" label="Start recording" onPress={() => void startRecording()} />
          )}
        </View>
      </View>
      <View style={styles.caption}>
        <Heading level={3}>{kind === 'profile' ? 'Private profile rehearsal' : questionTitle ?? 'Private answer rehearsal'}</Heading>
        <Text muted>{recording ? 'Recording is active. Press stop at any time.' : cameraReady ? 'Camera ready. Nothing is recorded until you press record.' : 'Starting camera preview…'}</Text>
        {error ? <Banner message={error} title="Camera issue" tone="error" /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bottomControls: { alignItems: 'center', bottom: spacing.xl, left: 0, position: 'absolute', right: 0 },
  cameraButton: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, height: 56, justifyContent: 'center', width: 56 },
  cameraFrame: { borderRadius: radii.xl, borderWidth: 1, overflow: 'hidden' },
  cameraGlyph: { color: '#FFFFFF', fontSize: 24, lineHeight: 28 },
  caption: { gap: spacing.sm },
  disabled: { opacity: 0.45 },
  grow: { flex: 1, gap: spacing.xs },
  limitBadge: { alignItems: 'center', alignSelf: 'center', borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: 'absolute', top: spacing.xl },
  pressed: { opacity: 0.7 },
  recordingDot: { borderRadius: radii.pill, height: 10, width: 10 },
  recordingState: { alignItems: 'center', alignSelf: 'center', borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: 'absolute', top: spacing.xl },
  recordingText: { color: '#FFFFFF' },
  reviewHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  teleprompterButton: { alignItems: 'center', justifyContent: 'center', minHeight: minimumTouchTarget, minWidth: minimumTouchTarget },
  teleprompterControls: { flexDirection: 'row', gap: spacing.xs },
  teleprompterHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  teleprompterOverlay: { borderRadius: radii.lg, gap: spacing.xs, left: spacing.lg, padding: spacing.md, position: 'absolute', right: spacing.lg, top: 92 },
  teleprompterScroll: { maxHeight: 124 },
  topControls: { flexDirection: 'row', justifyContent: 'space-between', left: spacing.lg, position: 'absolute', right: spacing.lg, top: spacing.lg },
});
