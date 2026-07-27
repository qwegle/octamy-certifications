type ClientModule = typeof import('@/lib/api-client');

function response(status: number, payload: unknown, headers: Record<string, string> = {}): Response {
  const responseHeaders = new Headers({ 'content-type': 'application/json', ...headers });
  return {
    headers: responseHeaders,
    json: jest.fn(async () => payload),
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => JSON.stringify(payload)),
  } as unknown as Response;
}

function loadClient(): ClientModule {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test///';
  jest.resetModules();
  return require('@/lib/api-client') as ClientModule;
}

describe('API client', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('joins the normalized base URL, serializes JSON, and adds its auth token', async () => {
    const client = loadClient();
    client.setAuthTokenProvider(() => 'signed-token');
    let requestUrl: RequestInfo | URL | undefined;
    let requestOptions: RequestInit | undefined;
    const fetchMock = jest.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      requestUrl = url;
      requestOptions = options;
      return response(200, { ok: true });
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(client.apiClient.post('/api/example', { value: 7 })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestUrl).toBe('https://api.example.test/api/example');
    expect(requestOptions?.method).toBe('POST');
    expect(requestOptions?.body).toBe('{"value":7}');
    expect((requestOptions?.headers as Headers).get('Authorization')).toBe('Bearer signed-token');
    expect((requestOptions?.headers as Headers).get('Content-Type')).toBe('application/json');
  });

  it('does not send authorization when auth is explicitly false', async () => {
    const client = loadClient();
    client.setAuthTokenProvider(() => 'private-token');
    let requestOptions: RequestInit | undefined;
    const fetchMock = jest.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
      requestOptions = options;
      return response(200, {});
    });
    global.fetch = fetchMock as typeof fetch;

    await client.apiClient.get('/api/public', { auth: false });
    expect((requestOptions?.headers as Headers).get('Authorization')).toBeNull();
  });

  it('normalizes non-2xx messages, codes, field errors, and retry metadata', async () => {
    const client = loadClient();
    global.fetch = jest.fn(async () => response(429, {
      code: 'RATE_LIMITED',
      message: 'Please wait.',
      errors: { email: ['Try later.'] },
    }, { 'retry-after': '2' })) as typeof fetch;

    const error = await client.apiClient.get('/api/limited').catch((value: unknown) => value);
    expect(error).toBeInstanceOf(client.ApiError);
    expect(error).toMatchObject({
      code: 'RATE_LIMITED',
      fieldErrors: { email: ['Try later.'] },
      message: 'Please wait.',
      retryAfterMs: 2000,
      status: 429,
    });
    expect((error as InstanceType<ClientModule['ApiError']>).isRetryable).toBe(true);
  });

  it('distinguishes timeout from caller abort', async () => {
    const client = loadClient();
    jest.useFakeTimers();
    global.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) {
        reject(new Error('aborted'));
        return;
      }
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })) as typeof fetch;

    const timeoutRequest = client.apiClient.get('/api/slow', { timeoutMs: 25 });
    await Promise.resolve();
    jest.advanceTimersByTime(25);
    await expect(timeoutRequest).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT', isTimeout: true });

    const caller = new AbortController();
    const abortedRequest = client.apiClient.get('/api/cancelled', { signal: caller.signal, timeoutMs: 1000 });
    caller.abort();
    await expect(abortedRequest).rejects.toMatchObject({ code: 'REQUEST_ABORTED', isTimeout: false });
  });
});
