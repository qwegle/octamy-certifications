import * as WebBrowser from 'expo-web-browser';
import { z } from 'zod';

import { ApiError, apiClient, buildApiUrl, parseApiResponse } from '@/lib/api-client';
import type { SessionUser } from './session-storage';

const userSchema = z.object({
  email: z.string().email(),
  id: z.number().int().positive(),
  isAdmin: z.boolean(),
  name: z.string(),
});
const authResponseSchema = z.object({ token: z.string().min(1), user: userSchema });
const googleStatusSchema = z.object({ enabled: z.boolean() });
const messageSchema = z.object({ message: z.string() });

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
  phone?: string;
}

export interface AuthResult {
  token: string;
  user: SessionUser;
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const value = await apiClient.post<unknown>('/api/auth/login', {
    email: input.email.trim().toLowerCase(),
    password: input.password,
  }, { auth: false });
  return parseApiResponse(authResponseSchema, value);
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const body = {
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    password: input.password,
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
  };
  const value = await apiClient.post<unknown>('/api/auth/register', body, { auth: false });
  return parseApiResponse(authResponseSchema, value);
}

export async function getCurrentUser(): Promise<SessionUser> {
  return parseApiResponse(userSchema, await apiClient.get<unknown>('/api/auth/me'));
}

export async function logoutOnServer(): Promise<void> {
  await apiClient.post('/api/auth/logout', undefined, { auth: false });
}

export async function requestPasswordReset(email: string): Promise<string> {
  const value = await apiClient.post<unknown>('/api/auth/forgot-password', { email: email.trim().toLowerCase() }, { auth: false });
  return parseApiResponse(messageSchema, value).message;
}

export async function getGoogleStatus(): Promise<{ enabled: boolean }> {
  const value = await apiClient.get<unknown>('/api/auth/google/status', { auth: false });
  return parseApiResponse(googleStatusSchema, value);
}

/**
 * Opens the verified web OAuth flow. Browser completion does not establish a
 * native session because the backend returns its JWT only to the web /login fragment.
 */
export async function openGoogleWebsiteHandoff(): Promise<WebBrowser.WebBrowserResult> {
  const status = await getGoogleStatus();
  if (!status.enabled) {
    throw new ApiError({ status: 503, code: 'GOOGLE_NOT_CONFIGURED', message: 'Google sign-in is not available right now.' });
  }
  return WebBrowser.openBrowserAsync(buildApiUrl('/api/auth/google/user'));
}
