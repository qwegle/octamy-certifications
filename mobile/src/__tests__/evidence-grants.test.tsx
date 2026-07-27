import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import EvidenceSharingScreen from '@/app/settings/evidence-sharing';

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Stack = Object.assign(({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children), {
    Screen: () => null,
  });
  return { Stack };
});

jest.mock('@/features/auth', () => ({
  useSession: () => ({ canMutate: true, user: { id: 7, email: 'learner@example.test', name: 'Learner' } }),
}));

const mockShowToast = jest.fn();
jest.mock('@/lib/feedback', () => ({ useFeedback: () => ({ showToast: mockShowToast }) }));

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' }, status });
}

async function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, view: await render(ui, { wrapper: Wrapper }) };
}

describe('selected recruiter evidence grants', () => {
  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
    mockShowToast.mockReset();
  });

  it('requires explicit consent and sends only selected bounded evidence', async () => {
    let postedBody: Record<string, unknown> | null = null;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/eligible-recruiters')) return response({ recruiters: [{ companyName: 'Verified Co', id: 9, industry: 'Software', interactionAt: '2026-07-26T00:00:00.000Z' }] });
      if (url.endsWith('/options')) return response({
        certifications: [{ badge: 'gold', certificateId: 'CERT-1', courseTitle: 'TypeScript', expiresAt: '2027-07-26T00:00:00.000Z', id: 41, score: 92 }],
        practiceSummaries: [{ completedAt: '2026-07-20T00:00:00.000Z', courseTitle: 'TypeScript Practice', id: 51, score: 80 }],
      });
      if (url.endsWith('/access-history')) return response({ events: [] });
      if (url.endsWith('/api/user/evidence-grants') && init?.method === 'POST') {
        postedBody = JSON.parse(String(init.body));
        return response({ grant: { id: '03c94882-bd08-4dda-8481-7f62900879c8', status: 'active' } }, 201);
      }
      if (url.endsWith('/api/user/evidence-grants')) return response({ grants: [] });
      throw new Error(`Unexpected request ${url}`);
    }) as typeof fetch;

    const { client, view } = await renderWithQuery(<EvidenceSharingScreen />);
    expect(await view.findByText('Verified Co')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Create expiring grant' }).props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(view.getByRole('checkbox', { name: 'Verified Co' }));
    await fireEvent.changeText(view.getByLabelText('Purpose'), 'Senior frontend engineer application');
    await fireEvent.press(view.getByRole('checkbox', { name: 'TypeScript' }));
    await fireEvent.press(view.getByRole('checkbox', { name: 'TypeScript Practice' }));
    await fireEvent.press(view.getByRole('checkbox', { name: 'I authorize this selected evidence grant' }));
    await fireEvent.press(view.getByRole('button', { name: 'Create expiring grant' }));

    await waitFor(() => expect(postedBody).not.toBeNull());
    expect(postedBody).toMatchObject({
      certificateIds: [41],
      consentVersion: 'candidate-evidence-consent.v1',
      practiceSummaryIds: [51],
      purpose: 'Senior frontend engineer application',
      targetRecruiterId: 9,
    });
    expect(postedBody).not.toHaveProperty('answers');
    expect(postedBody).not.toHaveProperty('integrityEvents');
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Evidence grant created' }));
    client.clear();
  });
});
