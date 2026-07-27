import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import PracticeScreen from '@/app/(tabs)/practice';
import ExamResultScreen from '@/app/exam/result/[tempExamId]';
import { createResultCertificateCheckout } from '@/features/certifications/payment.api';
import { openCashfreeCheckout } from '@/lib/cashfree-checkout';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/features/auth', () => ({
  useSession: () => ({
    canMutate: true,
    user: { email: 'learner@example.test', id: 7, isAdmin: false, name: 'Learner' },
  }),
}));

jest.mock('@/lib/cashfree-checkout', () => ({
  openCashfreeCheckout: jest.fn(async () => ({ type: 'cancel' })),
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
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  queryClients.push(client);
  return render(ui, {
    wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

const noSubscription = { creator: null, institute: null, learner: null, recruiter: null };
const activeSubscription = {
  ...noSubscription,
  learner: { plan: 'all_access', renewsAt: null, status: 'active' },
};

describe('server-confirmed Cashfree flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    (openCashfreeCheckout as jest.Mock).mockResolvedValue({ type: 'cancel' });
  });

  afterEach(async () => {
    await cleanup();
    queryClients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
  });

  it('does not grant Practice Pass on browser return and confirms only the exact local subscription order', async () => {
    let subscriptionChecks = 0;
    let orderChecks = 0;
    let checkoutBody: unknown;
    global.fetch = jest.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      const value = String(url);
      if (value.includes('/api/practice-assessments?')) {
        return jsonResponse(200, { facets: {}, items: [], pagination: { page: 1, pageSize: 48, total: 0, totalPages: 0 } });
      }
      if (value.endsWith('/api/me/subscription')) {
        subscriptionChecks += 1;
        return jsonResponse(200, subscriptionChecks >= 2 ? activeSubscription : noSubscription);
      }
      if (value.endsWith('/api/subscriptions/checkout')) {
        checkoutBody = JSON.parse(String(options?.body));
        return jsonResponse(200, {
          amount: 299,
          orderId: 'sub-order-1',
          paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyzSUB123456',
          subscriptionId: 'subscription-1',
        });
      }
      if (value.endsWith('/api/subscriptions/orders/sub-order-1/status')) {
        orderChecks += 1;
        return jsonResponse(200, orderChecks >= 2
          ? {
              orderId: 'sub-order-1',
              ownerType: 'learner',
              plan: 'all_access',
              renewsAt: '2099-02-01T00:00:00.000Z',
              startsAt: '2099-01-01T00:00:00.000Z',
              status: 'active',
            }
          : {
              orderId: 'sub-order-1',
              ownerType: 'learner',
              plan: 'all_access',
              renewsAt: null,
              startsAt: null,
              status: 'pending',
            });
      }
      throw new Error(`Unexpected request: ${value}`);
    }) as typeof fetch;

    const screen = await renderWithQuery(<PracticeScreen />);
    const monthly = await screen.findByRole('button', { name: /monthly web checkout/ });
    await fireEvent.press(monthly);

    expect(await screen.findByText('Checkout cancelled')).toBeTruthy();
    expect(screen.queryByText('Access confirmed')).toBeNull();
    expect(openCashfreeCheckout).toHaveBeenCalledWith({ paymentLink: undefined, paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyzSUB123456' });
    expect(checkoutBody).toEqual({ cycle: 'monthly', ownerType: 'learner', plan: 'all_access' });

    await fireEvent.press(screen.getByRole('button', { name: 'Check payment status' }));
    expect(await screen.findByText('Practice Pass is active')).toBeTruthy();
    expect(subscriptionChecks).toBe(2);
    expect(orderChecks).toBe(2);
  });

  it('uses the returned Cashfree session and reports certificate payment only after server status confirms it', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ tempExamId: 'temp-1' });
    let paymentBody: unknown;
    let statusChecks = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      const value = String(url);
      if (value.endsWith('/api/exam-results-temp/temp-1')) {
        return jsonResponse(200, {
          assessmentPurpose: 'certification',
          correctAnswers: 1,
          course: { id: 12, passingScore: 70, price: 999, slug: 'ai-foundations', title: 'AI Foundations' },
          isGuest: false,
          isRetake: false,
          mastered: false,
          message: 'You passed.',
          needsPayment: true,
          passed: true,
          previousBestScore: 0,
          recoveryEmailSent: false,
          resultExpiresAt: '2099-01-02T00:00:00.000Z',
          review: [],
          score: 100,
          tempExamId: 'temp-1',
          timeTaken: 60,
          timedOut: false,
          totalQuestions: 1,
        });
      }
      if (value.endsWith('/api/payment/initiate')) {
        paymentBody = JSON.parse(String(options?.body));
        return jsonResponse(200, {
          amount: 999,
          gateway: 'cashfree',
          orderId: 'cert-order-1',
          paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyzCERT123456',
          statusToken: 'signed-status-token-abcdefghijklmnopqrstuvwxyz-1234567890',
          success: true,
          transactionId: 'txn-cert-1',
        });
      }
      if (value.endsWith('/api/payments/cashfree/cert-order-1/status?token=signed-status-token-abcdefghijklmnopqrstuvwxyz-1234567890')) {
        statusChecks += 1;
        return jsonResponse(200, { localStatus: 'completed', orderId: 'cert-order-1' });
      }
      throw new Error(`Unexpected request: ${value}`);
    }) as typeof fetch;

    const screen = await renderWithQuery(<ExamResultScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Pay with Cashfree' }));

    expect(await screen.findByText('Payment confirmed')).toBeTruthy();
    expect(openCashfreeCheckout).toHaveBeenCalledTimes(1);
    expect(openCashfreeCheckout).toHaveBeenCalledWith({ paymentLink: undefined, paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyzCERT123456' });
    expect(paymentBody).toEqual({ includesPhysicalCopy: false, tempExamId: 'temp-1' });
    expect(statusChecks).toBe(1);
    await waitFor(() => expect(screen.queryByText('Confirmation pending')).toBeNull());
  });

  it('rejects a Cashfree checkout response without a signed status token', async () => {
    global.fetch = jest.fn(async () => jsonResponse(200, {
      amount: 999,
      gateway: 'cashfree',
      orderId: 'cert-order-2',
      paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyzCERT654321',
      success: true,
      transactionId: 'txn-cert-2',
    })) as typeof fetch;

    await expect(createResultCertificateCheckout('temp-2')).rejects.toBeDefined();
    expect(openCashfreeCheckout).not.toHaveBeenCalled();
  });
});
