export type AuthoritativeExamTimer = {
  deadlineMs: number;
  remainingSeconds: number;
};

/**
 * Anchor the local display clock to the latest server response. The client may
 * count down between responses, but it must never recreate a deadline from the
 * configured duration or a client-stored start timestamp.
 */
export function resyncAuthoritativeExamTimer(
  remainingSeconds: unknown,
  receivedAtMs = Date.now(),
): AuthoritativeExamTimer | null {
  if (typeof remainingSeconds !== "number" || !Number.isFinite(remainingSeconds)) return null;
  const normalized = Math.max(0, Math.floor(remainingSeconds));
  return {
    remainingSeconds: normalized,
    deadlineMs: receivedAtMs + normalized * 1_000,
  };
}
