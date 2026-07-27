import type { AppStateStatus } from 'react-native';

export const MOBILE_EXAM_MAX_RECORDED_EXITS = 10_000;

interface MobileExamAttemptMarker {
  deadlineAt: string;
  evidenceConsentVersion: string;
  proctorMode: string;
  sessionId: string;
  startedAt: string;
}

export function isMobileExamExit(previous: AppStateStatus, next: AppStateStatus): boolean {
  return previous === 'active' && next !== 'active';
}

export function normalizeMobileExamExitCount(value: unknown): number {
  return Number.isInteger(value) && Number(value) >= 0
    ? Math.min(Number(value), MOBILE_EXAM_MAX_RECORDED_EXITS)
    : 0;
}

export function boundedMobileExamExitCount(current: number): number {
  return Math.min(MOBILE_EXAM_MAX_RECORDED_EXITS, normalizeMobileExamExitCount(current) + 1);
}

export function isLiveMobileExamAttempt(
  attempt: MobileExamAttemptMarker | null | undefined,
  now = Date.now(),
): boolean {
  if (!attempt || attempt.proctorMode !== 'browser_evidence') return false;
  if (!attempt.sessionId.trim() || !attempt.evidenceConsentVersion.trim()) return false;
  const startedAt = Date.parse(attempt.startedAt);
  const deadlineAt = Date.parse(attempt.deadlineAt);
  return Number.isFinite(startedAt)
    && Number.isFinite(deadlineAt)
    && startedAt < deadlineAt
    && deadlineAt > now;
}
