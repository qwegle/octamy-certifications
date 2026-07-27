import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { Text } from '@/components/ui';
import { radii, spacing, useAppTheme } from '@/theme';

export function LocalVideoReview({ uri }: { uri: string | null }) {
  const { colors } = useAppTheme();
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.staysActiveInBackground = false;
  });

  useEffect(() => {
    void player.replaceAsync(uri).catch(() => undefined);
  }, [player, uri]);

  if (!uri) return null;
  return (
    <View style={[styles.frame, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <VideoView
        accessibilityLabel="Private local recording preview"
        allowsPictureInPicture={false}
        allowsVideoFrameAnalysis={false}
        contentFit="contain"
        nativeControls
        player={player}
        style={styles.video}
      />
      <Text muted style={styles.note} variant="small">Playback stays inside Octamy. No upload occurs.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radii.lg, borderWidth: 1, gap: spacing.sm, overflow: 'hidden', paddingBottom: spacing.sm },
  note: { paddingHorizontal: spacing.md },
  video: { aspectRatio: 9 / 16, width: '100%' },
});
