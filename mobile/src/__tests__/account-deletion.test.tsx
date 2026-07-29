import type { PropsWithChildren } from 'react';
import { Alert, Linking } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import { AccountDeletionCard } from '@/features/profile/AccountDeletionCard';
import { confirmAccountDeletion, requestAccountDeletion } from '@/features/profile/account-deletion.api';

const mockSignOut = jest.fn(async () => undefined);
const mockShowToast = jest.fn();

jest.mock('@/features/auth', () => ({
  useSession: () => ({
    canMutate: true,
    signOut: mockSignOut,
    user: { email: 'learner@example.test', id: 7, isAdmin: false, name: 'Learner' },
  }),
}));

jest.mock('@/lib/feedback', () => ({ useFeedback: () => ({ showToast: mockShowToast }) }));

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' }, status });
}

function state(stateName: 'cancelled' | 'completed' | 'none' | 'requested') {
  if (stateName === 'none') return { state: 'none' };
  return {
    cancelledAt: stateName === 'cancelled' ? '2026-07-29T14:30:00.000Z' : null,
    completedAt: stateName === 'completed' ? '2026-07-29T14:30:00.000Z' : null,
    irreversible: stateName === 'completed',
    rejectedAt: null,
    requestId: '32f340f3-23ca-44ed-8886-0707f82c9a70',
    requestedAt: '2026-07-29T14:00:00.000Z',
    state: stateName,
    tokenExpiresAt: stateName === 'requested' ? '2026-07-29T14:30:00.000Z' : null,
    verifiedAt: stateName === 'completed' ? '2026-07-29T14:30:00.000Z' : null,
  };
}

async function renderCard() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, view: await render(<AccountDeletionCard />, { wrapper: Wrapper }) };
}

function chooseAlertAction(text: string) {
  const call = (Alert.alert as jest.Mock).mock.calls.at(-1);
  const actions = call?.[2] as Array<{ onPress?: () => void; text: string }>;
  const action = actions.find((candidate) => candidate.text === text);
  if (!action?.onPress) throw new Error(`Missing alert action: ${text}`);
  action.onPress();
}

describe('learner account deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  it('requires explicit acknowledgement before requesting an emailed verification token', async () => {
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ init, url });
      if (init?.method === 'POST') return response(state('requested'), 202);
      return response(state('none'));
    }) as typeof fetch;

    const { client, view } = await renderCard();
    const requestButton = await view.findByRole('button', { name: 'Request account deletion' });
    expect(requestButton.props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(view.getByRole('checkbox', { name: 'I understand account deletion is permanent' }));
    await fireEvent.press(view.getByRole('button', { name: 'Request account deletion' }));
    chooseAlertAction('Email token');

    expect(await view.findByText('Deletion request pending')).toBeTruthy();
    const mutation = requests.find((item) => item.init?.method === 'POST');
    expect(mutation).toEqual(expect.objectContaining({ url: 'https://api.octamy.test/api/account/deletion' }));
    expect(mutation?.init?.body).toBeUndefined();
    client.clear();
  });

  it('shows pending state and lets the learner cancel the owned request', async () => {
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') return response(state('cancelled'));
      return response(state('requested'));
    }) as typeof fetch;

    const { client, view } = await renderCard();
    expect(await view.findByText('Deletion request pending')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Cancel deletion request' }));
    chooseAlertAction('Cancel deletion request');

    expect(await view.findByText('Previous request cancelled')).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.octamy.test/api/account/deletion',
      expect.objectContaining({ method: 'DELETE' }),
    );
    client.clear();
  });

  it('confirms with only the emailed token, then signs out through token-first session invalidation', async () => {
    const verificationToken = 'abcdefghijklmnopqrstuvwxyz123456';
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/confirm') && init?.method === 'POST') return response(state('completed'));
      return response(state('requested'));
    }) as typeof fetch;

    const { client, view } = await renderCard();
    await view.findByText('Deletion request pending');
    await fireEvent.changeText(view.getByLabelText('Email verification token'), verificationToken);
    await fireEvent.press(view.getByRole('button', { name: 'Verify and permanently delete' }));
    chooseAlertAction('Delete permanently');

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.octamy.test/api/account/deletion/confirm',
      expect.objectContaining({ body: JSON.stringify({ token: verificationToken }), method: 'POST' }),
    );
    client.clear();
  });

  it('never accepts a subject user ID and keeps the session on ownership/token errors', async () => {
    const calls: Array<{ body?: BodyInit | null; url: string }> = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ body: init?.body, url: String(input) });
      if (String(input).endsWith('/confirm')) {
        return response({ code: 'INVALID_DELETION_TOKEN', message: 'Invalid deletion token' }, 403);
      }
      return response(state('requested'));
    }) as typeof fetch;

    await requestAccountDeletion();
    await expect(confirmAccountDeletion('abcdefghijklmnopqrstuvwxyz123456')).rejects.toMatchObject({ code: 'INVALID_DELETION_TOKEN', status: 403 });
    expect(calls.map((call) => call.body && JSON.parse(String(call.body)))).toEqual([
      undefined,
      { token: 'abcdefghijklmnopqrstuvwxyz123456' },
    ]);
    expect(calls.some((call) => String(call.body).includes('userId'))).toBe(false);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('shows the support-email fallback only when the server reports deletion unavailable', async () => {
    global.fetch = jest.fn(async () => response({ message: 'API route not found' }, 404)) as typeof fetch;
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    const { client, view } = await renderCard();
    expect(await view.findByText('Automated deletion unavailable')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Email account deletion support' }));
    chooseAlertAction('Continue to email');

    await waitFor(() => expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^mailto:support@octamy\.com/)));
    client.clear();
  });
});
