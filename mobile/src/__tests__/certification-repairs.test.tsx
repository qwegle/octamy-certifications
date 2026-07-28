import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor, within, act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import CertificationsScreen from '@/app/(tabs)/certifications';
import ExamScreen from '@/app/exam/[courseId]';
import { getCertifications, startCertificationExam, submitCertificationExam } from '@/features/certifications/api';
import { clearAttempt, loadAttempt, saveAttempt } from '@/features/certifications/attempt-repository';

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Stack = Object.assign(({ children }: PropsWithChildren) => React.createElement(React.Fragment, null, children), { Screen: () => null });
  return {
    Stack,
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: true, isInternetReachable: true }),
}));

jest.mock('@/features/auth', () => {
  const session = {
    canMutate: true,
    user: { email: 'learner@example.test', id: 7, isAdmin: false, name: 'Learner' },
  };
  return { useSession: () => session };
});

jest.mock('@/lib/feedback', () => {
  const feedback = { showToast: jest.fn() };
  return { useFeedback: () => feedback };
});

jest.mock('@/features/certifications/api', () => ({
  getCertifications: jest.fn(),
  startCertificationExam: jest.fn(),
  submitCertificationExam: jest.fn(),
}));

jest.mock('@/features/certifications/attempt-repository', () => ({
  clearAttempt: jest.fn(async () => undefined),
  loadAttempt: jest.fn(async () => null),
  saveAttempt: jest.fn(async () => undefined),
}));

const queryClients: QueryClient[] = [];
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(client);
  return render(ui, {
    wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

const item = {
  audienceBands: [],
  category: { id: 1, name: 'Artificial Intelligence', slug: 'ai' },
  certificationLabel: 'Career certification',
  certificationMode: 'exam',
  createdAt: null,
  description: 'Validate practical AI knowledge.',
  duration: 30,
  featuredAt: null,
  id: 12,
  language: 'English',
  level: 'intermediate' as const,
  origin: 'platform',
  originLabel: 'Octamy',
  passingScore: 70,
  price: 999,
  slug: 'ai-foundations',
  subscriptionEligible: false,
  thumbnailUrl: null,
  title: 'AI Foundations',
};

const examStart = {
  deadlineAt: '2099-01-01T00:30:00.000Z',
  evidenceConsentVersion: 'v1',
  proctorMode: 'browser_evidence' as const,
  questions: [
    { id: 99, options: ['Alpha', 'Beta'], question: 'Which answer is correct?' },
    { id: 100, options: ['Gamma', 'Delta'], question: 'Which answer comes next?' },
  ],
  sessionId: 'session-1',
  startedAt: '2099-01-01T00:00:00.000Z',
};

const submitResult = {
  correctAnswers: 1,
  isRetake: false,
  message: 'Submitted',
  passed: true,
  passingThreshold: 70,
  previousBestScore: 0,
  recoveryEmailSent: false,
  redirectTo: '/result',
  resultExpiresAt: '2099-01-02T00:00:00.000Z',
  score: 100,
  tempExamId: 'temp-123',
  timedOut: false,
  totalQuestions: 1,
};

function recoveredAttempt(integrityExitCount: number, deadlineAt = examStart.deadlineAt) {
  return {
    ...examStart,
    deadlineAt,
    answers: { '99': 0 },
    courseId: 12,
    courseSlug: 'ai-foundations',
    courseTitle: 'AI Foundations',
    flaggedQuestionIds: [],
    integrityExitCount,
    updatedAt: examStart.startedAt,
    userId: 7,
  };
}

function captureAppStateListener() {
  let listener: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((event: string, callback: (state: AppStateStatus) => void) => {
    if (event === 'change') listener = callback;
    return { remove: jest.fn() };
  }) as typeof AppState.addEventListener);
  return (state: AppStateStatus) => listener?.(state);
}

describe('certification catalog and exam repairs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    (loadAttempt as jest.Mock).mockResolvedValue(null);
  });

  afterEach(async () => {
    await cleanup();
    queryClients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
  });

  it('renders category filters only for categories represented by current results', async () => {
    (getCertifications as jest.Mock).mockResolvedValue({
      facets: {
        audienceBands: [],
        categories: [item.category, { id: 2, name: 'Global Business', slug: 'global-business' }],
        levels: ['intermediate'],
      },
      items: [item],
      pagination: { page: 1, pageSize: 24, total: 1, totalPages: 1 },
    });

    const { findByText, queryByText } = await renderWithQuery(<CertificationsScreen />);
    expect(await findByText('Artificial Intelligence')).toBeTruthy();
    expect(queryByText('Global Business')).toBeNull();
  });

  it('persists flags locally and submits only answers through the in-screen final review', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ courseId: '12', slug: 'ai-foundations', title: 'AI Foundations' });
    (startCertificationExam as jest.Mock).mockResolvedValue(examStart);
    (submitCertificationExam as jest.Mock).mockResolvedValue(submitResult);
    const changeAppState = captureAppStateListener();

    const screen = await render(<ExamScreen />);
    expect(within(screen.getByLabelText('Fixed actions')).getByRole('button', { name: 'Start exam' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'I consent to assessment evidence processing' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Start exam' }));
    await waitFor(() => expect(startCertificationExam).toHaveBeenCalledWith(12));
    await waitFor(() => expect(saveAttempt).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-1' })));
    await act(async () => {
      changeAppState('active');
      changeAppState('inactive');
      changeAppState('background');
    });
    await waitFor(() => expect(saveAttempt).toHaveBeenLastCalledWith(expect.objectContaining({
      integrityExitCount: 1,
      sessionId: 'session-1',
    })));
    expect(await screen.findByText(/1 exit has been recorded/)).toBeTruthy();

    const flag = await screen.findByRole('button', { name: 'Flag for review' });
    await fireEvent.press(flag);
    expect(screen.getByRole('button', { name: 'Remove flag' }).props.accessibilityState.selected).toBe(true);
    await waitFor(() => expect(saveAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ flaggedQuestionIds: [99] })));

    await fireEvent.press(screen.getByRole('radio', { name: 'Option A: Alpha' }));
    const questionActions = within(screen.getByLabelText('Fixed actions'));
    expect(questionActions.getByRole('button', { name: 'Previous question' })).toBeTruthy();
    await fireEvent.press(questionActions.getByRole('button', { name: 'Next question' }));
    await fireEvent.press(within(screen.getByLabelText('Fixed actions')).getByRole('button', { name: 'Review and submit' }));
    expect(await screen.findByText('Review before submission')).toBeTruthy();
    const reviewActions = within(screen.getByLabelText('Fixed actions'));
    expect(reviewActions.getByRole('button', { name: 'Return to questions' })).toBeTruthy();
    await fireEvent.press(reviewActions.getByRole('button', { name: 'Confirm final submission' }));

    await waitFor(() => expect(submitCertificationExam).toHaveBeenCalledWith({
      answers: { '99': 0 },
      courseId: 12,
      sessionId: 'session-1',
      tabSwitches: 1,
    }));
    expect(clearAttempt).toHaveBeenCalledWith(7, 12);
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/exam/result/[tempExamId]', params: { tempExamId: 'temp-123' } });
  });

  it('restores the exit count after restart, accumulates distinct exits, and submits the recovered count', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ courseId: '12', slug: 'ai-foundations', title: 'AI Foundations' });
    (loadAttempt as jest.Mock).mockResolvedValue(recoveredAttempt(2));
    (submitCertificationExam as jest.Mock).mockResolvedValue(submitResult);
    const changeAppState = captureAppStateListener();

    const screen = await render(<ExamScreen />);
    expect(await screen.findByText(/2 exits have been recorded/)).toBeTruthy();
    expect(screen.getByText(/cannot identify which external app you opened/)).toBeTruthy();
    expect(screen.getByText(/does not lock your device or prevent switching apps/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Save and leave exam' }));
    await waitFor(() => expect(saveAttempt).toHaveBeenCalledWith(expect.objectContaining({
      answers: { '99': 0 },
      integrityExitCount: 2,
      sessionId: 'session-1',
    })));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/certification/[slug]', params: { slug: 'ai-foundations' } });

    await act(async () => {
      changeAppState('active');
      changeAppState('inactive');
      changeAppState('background');
      changeAppState('active');
      changeAppState('background');
    });
    await waitFor(() => expect(saveAttempt).toHaveBeenLastCalledWith(expect.objectContaining({
      integrityExitCount: 4,
      sessionId: 'session-1',
    })));
    expect(await screen.findByText(/4 exits have been recorded/)).toBeTruthy();

    await fireEvent.press(within(screen.getByLabelText('Fixed actions')).getByRole('button', { name: 'Review answers' }));
    expect(await screen.findByText('Review before submission')).toBeTruthy();
    expect(screen.getByText(/cannot identify which external app you opened/)).toBeTruthy();
    await fireEvent.press(within(screen.getByLabelText('Fixed actions')).getByRole('button', { name: 'Confirm final submission' }));
    await waitFor(() => expect(submitCertificationExam).toHaveBeenCalledWith(expect.objectContaining({ tabSwitches: 4 })));
  });

  it('does not collect app-state exits for an expired recovered attempt', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ courseId: '12', slug: 'ai-foundations', title: 'AI Foundations' });
    (loadAttempt as jest.Mock).mockResolvedValue(recoveredAttempt(3, '2020-01-01T00:30:00.000Z'));
    const changeAppState = captureAppStateListener();

    const screen = await render(<ExamScreen />);
    expect(await screen.findByText('Attempt expired')).toBeTruthy();
    await act(async () => {
      changeAppState('active');
      changeAppState('background');
    });
    expect(saveAttempt).not.toHaveBeenCalled();
    expect(screen.getByText(/3 exits have been recorded/)).toBeTruthy();
  });
});
