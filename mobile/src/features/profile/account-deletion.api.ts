import { z } from 'zod';

import { ApiError, apiClient, parseApiResponse } from '@/lib/api-client';

const deletionStateSchema = z.object({
  requestId: z.string().uuid().optional(),
  state: z.enum(['none', 'requested', 'verified', 'completed', 'cancelled', 'rejected']),
  requestedAt: z.string().optional(),
  tokenExpiresAt: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  irreversible: z.boolean().optional(),
});

export type AccountDeletionState = z.infer<typeof deletionStateSchema>;

function parseState(value: unknown): AccountDeletionState {
  return parseApiResponse(deletionStateSchema, value, 'Octamy returned an invalid account-deletion state.');
}

export async function getAccountDeletionState(): Promise<AccountDeletionState> {
  return parseState(await apiClient.get<unknown>('/api/account/deletion'));
}

export async function requestAccountDeletion(): Promise<AccountDeletionState> {
  return parseState(await apiClient.post<unknown>('/api/account/deletion'));
}

export async function confirmAccountDeletion(token: string): Promise<AccountDeletionState> {
  return parseState(await apiClient.post<unknown>('/api/account/deletion/confirm', { token: token.trim() }));
}

export async function cancelAccountDeletion(): Promise<AccountDeletionState> {
  return parseState(await apiClient.delete<unknown>('/api/account/deletion'));
}

/** Only explicit endpoint/delivery unavailability opens the support fallback. */
export function isAccountDeletionUnavailable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 404
    || error.status === 501
    || (error.status === 503 && ['ACCOUNT_DELETION_EMAIL_UNAVAILABLE', 'ACCOUNT_DELETION_UNAVAILABLE'].includes(error.code ?? ''));
}
