import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Badge, Banner, Button, Card, EmptyState, Heading, Screen, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { deleteAllRecordings, deleteRecording, listRecordings, LocalVideoReview, type LocalRecording } from '@/features/interview';
import { formatClock } from '@/lib/format';
import { spacing } from '@/theme';

export default function InterviewRecordingsScreen() {
  const { user } = useSession();
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setRecordings(await listRecordings(user.id));
      setError(null);
    } catch {
      setError('Octamy could not read the private recording list on this device.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const selected = recordings.find((recording) => recording.id === selectedId) ?? null;

  const confirmDelete = (recording: LocalRecording) => {
    if (!user) return;
    Alert.alert(
      'Delete this local recording?',
      'This permanently removes the video from Octamy private app storage. It cannot be recovered.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void deleteRecording(user.id, recording.id)
              .then(() => {
                setSelectedId((current) => current === recording.id ? null : current);
                return load();
              })
              .catch(() => setError('The local recording could not be deleted.'));
          },
          style: 'destructive',
          text: 'Delete video',
        },
      ],
    );
  };

  const confirmDeleteAll = () => {
    if (!user || recordings.length === 0) return;
    Alert.alert(
      'Delete all local recordings?',
      `This permanently removes all ${recordings.length} private interview and profile-practice videos from this device.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void deleteAllRecordings(user.id)
              .then(() => {
                setSelectedId(null);
                setRecordings([]);
              })
              .catch(() => setError('The local recordings could not all be deleted.'));
          },
          style: 'destructive',
          text: 'Delete all',
        },
      ],
    );
  };

  return (
    <Screen>
      <Badge label="On-device retention" tone="accent" />
      <Heading>Local recordings</Heading>
      <Text muted>These videos stay in Octamy’s private app storage and are never uploaded or shared. They remain until you delete them, sign out, or uninstall the app; device backup behavior follows your operating-system settings.</Text>
      <Banner message="Deleting a video here does not change a server Interview Studio session. Server sessions contain only the text or code you explicitly saved." title="Local and server data are separate" tone="info" />

      {error ? <Banner message={error} onDismiss={() => setError(null)} title="Storage issue" tone="error" /> : null}
      {selected ? (
        <Card>
          <Heading level={2}>{selected.kind === 'profile' ? 'Profile practice take' : selected.questionTitle ?? 'Interview answer take'}</Heading>
          <LocalVideoReview uri={selected.uri} />
          <Button label="Close preview" onPress={() => setSelectedId(null)} variant="secondary" />
        </Card>
      ) : null}

      {loading ? <Text accessibilityLiveRegion="polite">Reading private recordings…</Text> : recordings.length === 0 ? (
        <EmptyState description="Record a profile rehearsal or a question answer to keep a private local take." title="No local recordings" />
      ) : (
        <View style={styles.list}>
          <View style={styles.row}>
            <Heading level={2}>Saved on this device</Heading>
            <Badge label={`${recordings.length} total`} tone="neutral" />
          </View>
          {recordings.map((recording) => (
            <Card key={recording.id}>
              <View style={styles.row}>
                <View style={styles.grow}>
                  <Text variant="bodyStrong">{recording.kind === 'profile' ? 'Profile practice take' : recording.questionTitle ?? 'Interview answer take'}</Text>
                  <Text muted variant="small">{new Date(recording.createdAt).toLocaleString()} · {formatClock(recording.durationSeconds)}</Text>
                </View>
                <Badge label={recording.kind === 'profile' ? 'Profile rehearsal' : 'Answer rehearsal'} tone="neutral" />
              </View>
              <Button label="Review video" onPress={() => setSelectedId(recording.id)} variant="secondary" />
              <Button label="Delete video" onPress={() => confirmDelete(recording)} variant="danger" />
            </Card>
          ))}
          <Button label="Delete all local recordings" onPress={confirmDeleteAll} variant="danger" />
        </View>
      )}
      <Button label="Back to Interview" onPress={() => router.back()} variant="ghost" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, gap: spacing.xs },
  list: { gap: spacing.md },
  row: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
});
