import * as Crypto from 'expo-crypto';

export interface RecordingConsentGrant {
  itemKey?: string;
  kind: 'answer' | 'profile';
  maxSeconds?: number;
  ownerId: number;
  questionTitle?: string;
  sessionId?: string;
}

interface StoredGrant extends RecordingConsentGrant {
  expiresAt: number;
}

const GRANT_TTL_MS = 5 * 60 * 1_000;
const grants = new Map<string, StoredGrant>();

function removeExpiredGrants(now = Date.now()): void {
  for (const [token, grant] of grants) {
    if (grant.expiresAt <= now) grants.delete(token);
  }
}

export function issueRecordingConsentGrant(grant: RecordingConsentGrant): string {
  removeExpiredGrants();
  const token = Crypto.randomUUID();
  grants.set(token, { ...grant, expiresAt: Date.now() + GRANT_TTL_MS });
  return token;
}

export function consumeRecordingConsentGrant(token: string | undefined, ownerId: number): RecordingConsentGrant | null {
  if (!token) return null;
  const now = Date.now();
  removeExpiredGrants(now);
  const grant = grants.get(token);
  grants.delete(token);
  if (!grant || grant.ownerId !== ownerId || grant.expiresAt <= now) return null;
  const { expiresAt: _expiresAt, ...result } = grant;
  return result;
}
