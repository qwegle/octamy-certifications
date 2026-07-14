import crypto from "node:crypto";

export type ExamProctorMode = "standard" | "browser_evidence";

export const BROWSER_EVIDENCE_EVENT_TYPES = new Set([
  "visibility_hidden",
  "visibility_visible",
  "window_blur",
  "window_focus",
  "fullscreen_enter",
  "fullscreen_exit",
  "fullscreen_unavailable",
  "paste",
]);

export function createAttemptAccessToken(attemptId: number, expiresAtMs: number, secret: string): string {
  if (!Number.isInteger(attemptId) || attemptId <= 0) throw new Error("attemptId must be a positive integer");
  if (!Number.isFinite(expiresAtMs)) throw new Error("expiresAtMs must be finite");
  const payload = `${attemptId}.${Math.trunc(expiresAtMs)}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAttemptAccessToken(
  token: string | undefined,
  attemptId: number,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!token) return false;
  const [tokenAttemptId, expiresAt, signature, extra] = token.split(".");
  if (!tokenAttemptId || !expiresAt || !signature || extra) return false;
  const expiry = Number(expiresAt);
  if (Number(tokenAttemptId) !== attemptId || !Number.isFinite(expiry) || expiry < nowMs) return false;
  const expected = createAttemptAccessToken(attemptId, expiry, secret);
  if (token.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function canCollectEvidenceEvent(mode: ExamProctorMode, eventType: string): boolean {
  return mode === "browser_evidence" || !BROWSER_EVIDENCE_EVENT_TYPES.has(eventType);
}

export function boundedClientTimestamp(clientAt: string, serverNow: Date, maxSkewMs = 86_400_000): Date | null {
  const candidate = new Date(clientAt);
  if (!Number.isFinite(candidate.getTime())) return null;
  return Math.abs(candidate.getTime() - serverNow.getTime()) <= maxSkewMs ? candidate : null;
}
