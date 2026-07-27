import { requireApiUrl } from '@/config/env';

export type ApiPath = `/api/${string}`;

interface RuntimeSchema<T> {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
}

export function parseApiResponse<T>(schema: RuntimeSchema<T>, value: unknown, message = 'Octamy returned an unexpected response. Please try again later.'): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError({ status: 502, code: 'INVALID_RESPONSE', message });
  }
  return result.data;
}

export function asApiPath(value: string): ApiPath {
  if (!value.startsWith('/api/') || value.startsWith('//') || value.includes('://')) {
    throw new ApiError({ status: 0, code: 'INVALID_API_PATH', message: 'The requested Octamy API path is invalid.' });
  }
  return value as ApiPath;
}
export type FieldErrors = Record<string, string[]>;

export interface ApiErrorOptions {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: FieldErrors;
  retryAfterMs?: number;
  isNetworkError?: boolean;
  isTimeout?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors?: FieldErrors;
  readonly retryAfterMs?: number;
  readonly isNetworkError: boolean;
  readonly isTimeout: boolean;

  constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterMs = options.retryAfterMs;
    this.isNetworkError = options.isNetworkError ?? false;
    this.isTimeout = options.isTimeout ?? false;
  }

  get isRetryable(): boolean {
    return this.isNetworkError || this.isTimeout || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

type TokenProvider = () => null | string | Promise<null | string>;
let tokenProvider: TokenProvider = () => null;

export function setAuthTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeFieldErrors(payload: Record<string, unknown>): FieldErrors | undefined {
  const candidate = payload.fieldErrors ?? payload.errors ?? payload.details;
  const normalized: FieldErrors = {};

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      if (!isRecord(item)) continue;
      const path = Array.isArray(item.path) ? item.path.join('.') : typeof item.path === 'string' ? item.path : '_form';
      const message = typeof item.message === 'string' ? item.message : undefined;
      if (message) normalized[path] = [...(normalized[path] ?? []), message];
    }
  } else if (isRecord(candidate)) {
    for (const [field, value] of Object.entries(candidate)) {
      if (typeof value === 'string') normalized[field] = [value];
      if (Array.isArray(value)) {
        const messages = value.filter((entry): entry is string => typeof entry === 'string');
        if (messages.length > 0) normalized[field] = messages;
      }
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function safeMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  const message = payload.message ?? payload.error;
  return typeof message === 'string' && message.length <= 500 ? message : fallback;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, date - Date.now());
}

function apiOrigin(): string {
  let origin: string;
  try {
    origin = requireApiUrl();
  } catch {
    throw new ApiError({
      status: 0,
      code: 'API_URL_MISSING',
      message: 'Octamy cannot connect because its API address is not configured.',
    });
  }

  if (!__DEV__ && !origin.startsWith('https://')) {
    throw new ApiError({
      status: 0,
      code: 'INSECURE_API_URL',
      message: 'Octamy requires a secure HTTPS API address in production.',
    });
  }
  return origin;
}

export function buildApiUrl(path: ApiPath): string {
  if (!path.startsWith('/api/') || path.startsWith('//') || path.includes('://')) {
    throw new ApiError({ status: 0, code: 'INVALID_API_PATH', message: 'The requested Octamy API path is invalid.' });
  }
  return `${apiOrigin()}${path}`;
}

export const API_TIMEOUTS = Object.freeze({
  get: 12_000,
  mutation: 20_000,
  transfer: 60_000,
});

export interface ApiRequestOptions {
  auth?: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface ApiResult<T> {
  data: T;
  headers: Headers;
  status: number;
}

async function parsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return await response.json();
    } catch {
      throw new ApiError({ status: response.status, code: 'INVALID_RESPONSE', message: 'Octamy returned an unreadable response.' });
    }
  }
  if (response.ok) return response.text();
  return undefined;
}

export async function requestWithMeta<T>(path: ApiPath, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const method = options.method ?? 'GET';
  const timeoutMs = options.timeoutMs ?? (method === 'GET' ? API_TIMEOUTS.get : API_TIMEOUTS.mutation);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const token = options.auth === false ? null : await tokenProvider();
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(buildApiUrl(path), { body, headers, method, signal: controller.signal });
    } catch (error) {
      if (timedOut) {
        throw new ApiError({ status: 0, code: 'REQUEST_TIMEOUT', message: 'The request took too long. Please try again.', isTimeout: true });
      }
      if (options.signal?.aborted) {
        throw new ApiError({ status: 0, code: 'REQUEST_ABORTED', message: 'The request was cancelled.' });
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Octamy could not connect. Check your internet connection and try again.',
        isNetworkError: true,
      });
    }

    const payload = await parsePayload(response);
    if (!response.ok) {
      const record = isRecord(payload) ? payload : {};
      throw new ApiError({
        status: response.status,
        code: typeof record.code === 'string' ? record.code : undefined,
        fieldErrors: normalizeFieldErrors(record),
        message: safeMessage(payload, response.status === 429 ? 'Too many attempts. Please wait and try again.' : 'Octamy could not complete this request.'),
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      });
    }

    return { data: payload as T, headers: response.headers, status: response.status };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function apiRequest<T>(path: ApiPath, options: ApiRequestOptions = {}): Promise<T> {
  return (await requestWithMeta<T>(path, options)).data;
}

type MethodOptions = Omit<ApiRequestOptions, 'body' | 'method'>;

export const apiClient = {
  get: <T>(path: ApiPath, options?: MethodOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: ApiPath, body?: unknown, options?: MethodOptions) => apiRequest<T>(path, { ...options, body, method: 'POST' }),
  put: <T>(path: ApiPath, body?: unknown, options?: MethodOptions) => apiRequest<T>(path, { ...options, body, method: 'PUT' }),
  patch: <T>(path: ApiPath, body?: unknown, options?: MethodOptions) => apiRequest<T>(path, { ...options, body, method: 'PATCH' }),
  delete: <T>(path: ApiPath, body?: unknown, options?: MethodOptions) => apiRequest<T>(path, { ...options, body, method: 'DELETE' }),
};

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError({ status: 0, code: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' });
}
