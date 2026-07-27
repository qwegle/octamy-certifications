import { Directory, File, Paths } from 'expo-file-system';
import { z } from 'zod';

const recordingSchema = z.object({
  createdAt: z.string(),
  durationSeconds: z.number().int().nonnegative(),
  id: z.string(),
  itemKey: z.string().optional(),
  kind: z.enum(['profile', 'answer']),
  ownerId: z.number().int().positive(),
  questionTitle: z.string().optional(),
  sessionId: z.string().optional(),
  uri: z.string(),
});
const manifestSchema = z.array(recordingSchema);

export type LocalRecording = z.infer<typeof recordingSchema>;
export type RecordingKind = LocalRecording['kind'];

function userDirectory(userId: number): Directory {
  return new Directory(Paths.cache, 'octamy-private-interview-recordings', `user-${userId}`);
}

function manifestFile(userId: number): File {
  return new File(userDirectory(userId), 'manifest.json');
}

function ensureDirectory(userId: number): Directory {
  const directory = userDirectory(userId);
  if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
  return directory;
}

async function writeManifest(userId: number, recordings: LocalRecording[]): Promise<void> {
  ensureDirectory(userId);
  const manifest = manifestFile(userId);
  if (!manifest.exists) manifest.create({ intermediates: true, overwrite: false });
  manifest.write(JSON.stringify(recordings));
}

export async function listRecordings(userId: number): Promise<LocalRecording[]> {
  const manifest = manifestFile(userId);
  if (!manifest.exists) return [];

  let parsed: LocalRecording[];
  try {
    const result = manifestSchema.safeParse(JSON.parse(await manifest.text()));
    parsed = result.success ? result.data : [];
  } catch {
    parsed = [];
  }

  const existing = parsed.filter((recording) => recording.ownerId === userId && new File(recording.uri).exists);
  if (existing.length !== parsed.length) await writeManifest(userId, existing);
  return existing.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function keepRecording(input: {
  durationSeconds: number;
  itemKey?: string;
  kind: RecordingKind;
  ownerId: number;
  questionTitle?: string;
  sessionId?: string;
  temporaryUri: string;
}): Promise<LocalRecording> {
  const directory = ensureDirectory(input.ownerId);
  const source = new File(input.temporaryUri);
  if (!source.exists) throw new Error('The temporary recording is no longer available.');

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const extension = source.extension || '.mp4';
  const destination = new File(directory, `${id}${extension}`);
  let moved = false;
  try {
    await source.move(destination);
    moved = true;

    const recording = recordingSchema.parse({
      createdAt: new Date().toISOString(),
      durationSeconds: Math.max(0, Math.round(input.durationSeconds)),
      id,
      itemKey: input.itemKey,
      kind: input.kind,
      ownerId: input.ownerId,
      questionTitle: input.questionTitle,
      sessionId: input.sessionId,
      uri: destination.uri,
    });
    const recordings = await listRecordings(input.ownerId);
    await writeManifest(input.ownerId, [recording, ...recordings]);
    return recording;
  } catch (error) {
    if (moved && destination.exists) {
      try {
        await destination.move(new File(input.temporaryUri));
      } catch {
        // Preserve the original persistence error; orphan reconciliation remains local-only.
      }
    }
    throw error;
  }
}

export async function deleteRecording(userId: number, recordingId: string): Promise<void> {
  const recordings = await listRecordings(userId);
  const target = recordings.find((recording) => recording.id === recordingId);
  if (target) {
    const file = new File(target.uri);
    if (file.exists) file.delete();
  }
  await writeManifest(userId, recordings.filter((recording) => recording.id !== recordingId));
}

export async function deleteAllRecordings(userId: number): Promise<void> {
  const directory = userDirectory(userId);
  if (directory.exists) directory.delete();
}

export function deleteTemporaryRecording(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A cache file may already have been removed by the operating system.
  }
}

