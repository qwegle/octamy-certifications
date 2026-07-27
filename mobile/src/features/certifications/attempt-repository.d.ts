import type { RecoverableAttempt } from './types';

export function saveAttempt(attempt: RecoverableAttempt): Promise<void>;
export function loadAttempt(userId: number, courseId: number): Promise<RecoverableAttempt | null>;
export function clearAttempt(userId: number, courseId: number): Promise<void>;
export function clearUserAttempts(userId: number): Promise<void>;
