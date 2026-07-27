import type { AppStateStatus } from 'react-native';

import {
  boundedMobileExamExitCount,
  isLiveMobileExamAttempt,
  isMobileExamExit,
  MOBILE_EXAM_MAX_RECORDED_EXITS,
  normalizeMobileExamExitCount,
} from '@/features/certifications/proctoring';

describe('mobile certification proctoring', () => {
  it('counts only transitions away from active and does not double-count inactive to background', () => {
    const states: AppStateStatus[] = ['active', 'inactive', 'background', 'active', 'background'];
    const exits = states.slice(1).reduce((count, next, index) => (
      isMobileExamExit(states[index]!, next) ? boundedMobileExamExitCount(count) : count
    ), 0);

    expect(exits).toBe(2);
    expect(isMobileExamExit('inactive', 'background')).toBe(false);
    expect(isMobileExamExit('background', 'active')).toBe(false);
  });

  it('bounds submitted integrity evidence to the server limit', () => {
    expect(boundedMobileExamExitCount(-1)).toBe(1);
    expect(boundedMobileExamExitCount(Number.NaN)).toBe(1);
    expect(boundedMobileExamExitCount(MOBILE_EXAM_MAX_RECORDED_EXITS)).toBe(MOBILE_EXAM_MAX_RECORDED_EXITS);
    expect(normalizeMobileExamExitCount(MOBILE_EXAM_MAX_RECORDED_EXITS + 1)).toBe(MOBILE_EXAM_MAX_RECORDED_EXITS);
    expect(normalizeMobileExamExitCount(-1)).toBe(0);
  });

  it('collects evidence only for a valid unexpired server-issued attempt marker', () => {
    const attempt = {
      deadlineAt: '2026-07-27T17:00:00.000Z',
      evidenceConsentVersion: 'v1',
      proctorMode: 'browser_evidence',
      sessionId: 'server-session-1',
      startedAt: '2026-07-27T16:00:00.000Z',
    };
    const beforeDeadline = Date.parse('2026-07-27T16:59:59.999Z');
    expect(isLiveMobileExamAttempt(attempt, beforeDeadline)).toBe(true);
    expect(isLiveMobileExamAttempt(attempt, Date.parse(attempt.deadlineAt))).toBe(false);
    expect(isLiveMobileExamAttempt({ ...attempt, sessionId: '' }, beforeDeadline)).toBe(false);
    expect(isLiveMobileExamAttempt({ ...attempt, deadlineAt: 'invalid' }, beforeDeadline)).toBe(false);
  });
});
