import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react-native';

import PracticeScreen from '@/app/(tabs)/practice';
import PracticeAttemptScreen from '@/app/practice/attempt/[courseId]';
import { PracticeCatalogSkeleton } from '@/features/practice/PracticeComponents';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ courseId: '12' })),
}));

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

const mockDraft = {
  answers: {},
  courseId: 12,
  courseTitle: 'Practice run',
  deadlineAt: new Date(Date.now() + 660_000).toISOString(),
  questions: [{ id: 1, options: ['A', 'B'], question: 'Practice question one?' }],
  sessionId: 'practice-session-1',
  updatedAt: new Date().toISOString(),
  userId: 7,
};

jest.mock('@/features/practice', () => {
  const actual = jest.requireActual('@/features/practice') as Record<string, unknown>;
  return {
    ...actual,
    clearPracticeDraft: jest.fn(async () => undefined),
    readPracticeDraft: jest.fn(async () => mockDraft),
    savePracticeDraft: jest.fn(async () => undefined),
    submitPracticeAttempt: jest.fn(async () => ({ tempExamId: 'temp-1' })),
  };
});

const queryClients: QueryClient[] = [];

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClients.push(client);
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

describe('practice accessibility semantics', () => {
  afterEach(async () => {
    await cleanup();
    queryClients.splice(0).forEach((client) => client.clear());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('announces the practice catalog loading state as a progress indicator', async () => {
    const { getByRole } = await render(<PracticeCatalogSkeleton />);
    expect(getByRole('progressbar', { name: 'Loading practice assessments' })).toBeTruthy();
  });

  it('announces the Practice Pass access check as a progress indicator', async () => {
    const requests: Array<{ resolve: (value: Response) => void; url: string }> = [];
    global.fetch = jest.fn((url: RequestInfo | URL) => new Promise<Response>((resolve) => {
      requests.push({ resolve, url: String(url) });
    })) as typeof fetch;
    const { findByText, getByRole } = await renderWithQuery(<PracticeScreen />);
    expect(getByRole('progressbar', { name: 'Checking Practice Pass access' })).toBeTruthy();

    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () => {
      for (const request of requests) {
        if (request.url.includes('/api/practice-assessments?')) {
          request.resolve(new Response(JSON.stringify({
            facets: { audienceBands: [], categories: [], levels: [] },
            items: [],
            pagination: { page: 1, pageSize: 48, total: 0, totalPages: 0 },
          }), { headers: { 'content-type': 'application/json' }, status: 200 }));
        } else {
          request.resolve(new Response(JSON.stringify({ creator: null, institute: null, learner: null, recruiter: null }), {
            headers: { 'content-type': 'application/json' },
            status: 200,
          }));
        }
      }
    });
    expect(await findByText('No practice exams yet')).toBeTruthy();
  });

  it('announces timed practice milestones politely instead of every second', async () => {
    jest.useFakeTimers();
    const { findByText, queryByText } = await renderWithQuery(<PracticeAttemptScreen />);
    await findByText('Practice question one?');

    expect(queryByText(/remaining in this practice run\./)).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_500);
    });

    const announcement = await findByText(/10:00 remaining in this practice run\./);
    expect(announcement.props.accessibilityLiveRegion).toBe('polite');
  });
});
