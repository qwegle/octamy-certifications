export const PUBLIC_EXAM_SUBMISSION_GRACE_SECONDS = 15;
export const PUBLIC_EXAM_EVIDENCE_CONSENT_VERSION = "public-browser-evidence-v1";

function validDateMs(value: Date | string): number {
  const valueMs = new Date(value).getTime();
  if (!Number.isFinite(valueMs)) throw new Error("Invalid public exam start time");
  return valueMs;
}

export function publicExamDeadline(
  startedAt: Date | string,
  durationMin: number,
): Date {
  const startedAtMs = validDateMs(startedAt);
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    throw new Error("Invalid public exam duration");
  }
  return new Date(startedAtMs + durationMin * 60_000);
}

export function publicExamSubmissionTiming(
  startedAt: Date | string,
  durationMin: number,
  nowMs = Date.now(),
  graceSeconds = PUBLIC_EXAM_SUBMISSION_GRACE_SECONDS,
) {
  if (!Number.isFinite(nowMs)) throw new Error("Invalid public exam submission time");
  if (!Number.isFinite(graceSeconds) || graceSeconds < 0) throw new Error("Invalid public exam grace period");
  const startedAtMs = validDateMs(startedAt);
  const deadlineAt = publicExamDeadline(startedAt, durationMin);
  const durationSeconds = Math.round(durationMin * 60);
  const elapsedSeconds = Math.max(
    1,
    Math.min(durationSeconds, Math.floor((nowMs - startedAtMs) / 1000)),
  );
  return {
    startedAt: new Date(startedAtMs),
    deadlineAt,
    elapsedSeconds,
    deadlineExceeded: nowMs > deadlineAt.getTime() + graceSeconds * 1000,
  };
}
