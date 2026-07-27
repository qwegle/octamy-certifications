import type { PropsWithChildren } from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import InterviewConsentScreen from '@/app/interview/consent';
import OnboardingScreen from '@/app/(auth)/onboarding';
import PrivacyScreen from '@/app/settings/privacy';
import { submitCertificationExam } from '@/features/certifications/api';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'recording-consent-grant') }));
import { hasActivePracticePass, startPracticeAttempt, type PracticeSubscription } from '@/features/practice';

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Stack = Object.assign(({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children), {
    Screen: () => null,
  });
  return {
    Stack,
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({ purpose: 'profile' })),
  };
});

jest.mock('@/features/auth', () => ({
  useSession: () => ({
    canMutate: true,
    signOut: jest.fn(async () => undefined),
    user: { email: 'learner@example.test', id: 7, isAdmin: false, name: 'Learner' },
  }),
}));

jest.mock('@/lib/feedback', () => ({
  useFeedback: () => ({ showToast: jest.fn() }),
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
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

describe('honest learner flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ purpose: 'profile' });
  });

  afterEach(async () => {
    await cleanup();
    queryClients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
  });

  it('submits certification answers through the real exam submit path', async () => {
    const payload = {
      correctAnswers: 1,
      isRetake: false,
      message: 'Submitted',
      passed: true,
      passingThreshold: 70,
      previousBestScore: 0,
      recoveryEmailSent: false,
      redirectTo: '/result',
      resultExpiresAt: '2026-07-27T00:00:00.000Z',
      score: 100,
      tempExamId: 'temp-123',
      timedOut: false,
      totalQuestions: 1,
    };
    let requestUrl: RequestInfo | URL | undefined;
    let requestOptions: RequestInit | undefined;
    const fetchMock = jest.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
      requestUrl = url;
      requestOptions = options;
      return jsonResponse(200, payload);
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(submitCertificationExam({ answers: { '99': 2 }, courseId: 12, sessionId: 'session-1' }))
      .resolves.toMatchObject({ tempExamId: 'temp-123', passed: true });
    expect(requestUrl).toBe('https://api.octamy.test/api/exam/submit');
    expect(requestOptions?.method).toBe('POST');
    expect(JSON.parse(requestOptions?.body as string)).toEqual({ answers: { '99': 2 }, courseId: 12, sessionId: 'session-1', tabSwitches: 0 });
  });

  it('requires explicit governed evidence consent in the Practice start request', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, {
      deadlineAt: '2026-07-27T01:00:00.000Z',
      evidenceConsentVersion: 'assessment-evidence.v1',
      proctorMode: 'browser_evidence',
      questions: [{ id: 1, options: ['A', 'B'], question: 'Verified question?' }],
      sessionId: 'practice-session-1',
      startedAt: '2026-07-27T00:00:00.000Z',
    }));
    global.fetch = fetchMock as typeof fetch;

    await startPracticeAttempt(12);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.octamy.test/api/courses/12/questions',
      expect.objectContaining({ body: JSON.stringify({ evidenceConsent: true }), method: 'POST' }),
    );
  });

  it('never grants Practice Pass from local checkout state', () => {
    const unconfirmed: PracticeSubscription = { creator: null, institute: null, learner: null, recruiter: null };
    const pending: PracticeSubscription = {
      ...unconfirmed,
      learner: { plan: 'all_access', renewsAt: null, status: 'pending' },
    };
    const confirmed: PracticeSubscription = {
      ...unconfirmed,
      learner: { plan: 'all_access', renewsAt: null, status: 'active' },
    };
    expect(hasActivePracticePass(undefined)).toBe(false);
    expect(hasActivePracticePass(unconfirmed)).toBe(false);
    expect(hasActivePracticePass(pending)).toBe(false);
    expect(hasActivePracticePass(confirmed)).toBe(true);
  });

  it('presents first-launch onboarding as accessible mobile steps', async () => {
    const { findByText, getByRole } = await render(<OnboardingScreen />);
    expect(getByRole('progressbar', { name: 'Step 1 of 3' }).props.accessibilityValue).toMatchObject({ min: 1, max: 3, now: 1 });
    await fireEvent.press(getByRole('button', { name: 'Continue' }));
    expect(await findByText('Prepare without putting your profile at risk.')).toBeTruthy();
    expect(getByRole('progressbar', { name: 'Step 2 of 3' }).props.accessibilityValue.now).toBe(2);
  });

  it('requires explicit interview capture consent before opening the camera flow', async () => {
    const { getByRole } = await renderWithQuery(<InterviewConsentScreen />);
    const continueButton = getByRole('button', { name: 'Continue without camera' });
    expect(continueButton.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(continueButton);
    expect(router.replace).not.toHaveBeenCalled();

    await fireEvent.press(getByRole('checkbox', { name: 'I consent to this local video recording' }));
    expect(getByRole('checkbox', { name: 'I consent to this local video recording' }).props.accessibilityHint).toMatch(/stays in private app storage/i);
    const consentedContinue = getByRole('button', { name: 'Continue and request permissions' });
    expect(consentedContinue.props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(consentedContinue);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/interview/capture',
      params: expect.objectContaining({ consentToken: expect.any(String) }),
    })));
    expect((router.replace as jest.Mock).mock.calls.at(-1)?.[0]?.params).not.toHaveProperty('consented');
  });

  it('renders recruiter discovery off when the server profile has no prior opt-in', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.endsWith('/api/user/profile')) {
        return jsonResponse(200, { email: 'learner@example.test', name: 'Learner' });
      }
      if (value.endsWith('/api/user/evidence-passport-link')) {
        return jsonResponse(200, { isPublic: false, path: '/evidence/private-token', token: 'private-token' });
      }
      throw new Error(`Unexpected request: ${value}`);
    }) as typeof fetch;

    const { findByRole } = await renderWithQuery(<PrivacyScreen />);
    const recruiterToggle = await findByRole('switch', { name: 'Verified recruiter discovery' });
    expect(recruiterToggle.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
  });
});
