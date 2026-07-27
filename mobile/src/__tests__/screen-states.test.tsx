import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react-native';

import CertificationsScreen from '@/app/(tabs)/certifications';
import CertificatesScreen from '@/app/certificate';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

function jsonResponse(status: number, payload: unknown): Response {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: jest.fn(async () => payload),
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => JSON.stringify(payload)),
  } as unknown as Response;
}

const queryClients: QueryClient[] = [];

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(client);
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

describe('key screen states without network access', () => {
  afterEach(async () => {
    await cleanup();
    queryClients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
  });

  it('renders the certification loading state while the request is pending', async () => {
    let resolveRequest!: (value: Response) => void;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; })) as typeof fetch;
    const { findByText, getByRole } = await renderWithQuery(<CertificationsScreen />);
    expect(getByRole('progressbar', { name: 'Loading certifications' })).toBeTruthy();

    resolveRequest(jsonResponse(200, {
      facets: { audienceBands: [], categories: [], levels: [] },
      items: [],
      pagination: { page: 1, pageSize: 48, total: 0, totalPages: 0 },
    }));
    expect(await findByText('No certifications found')).toBeTruthy();
  });

  it('renders the certificate empty state from an empty server list', async () => {
    global.fetch = jest.fn(async () => jsonResponse(200, [])) as typeof fetch;
    const { findByText } = await renderWithQuery(<CertificatesScreen />);
    expect(await findByText('No certificates yet')).toBeTruthy();
    expect(await findByText(/Practice Pass results do not issue certificates/)).toBeTruthy();
  });

  it('renders a retryable error state for a failed catalog request', async () => {
    global.fetch = jest.fn(async () => jsonResponse(503, { message: 'Temporarily unavailable' })) as typeof fetch;
    const { findByRole, findByText } = await renderWithQuery(<CertificationsScreen />);
    expect(await findByRole('alert')).toBeTruthy();
    expect(await findByText('The certification catalog could not be loaded.')).toBeTruthy();
  });
});
