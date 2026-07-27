import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import PracticeScreen from '@/app/(tabs)/practice';
import ProfileScreen from '@/app/(tabs)/profile';
import InterviewIntroductionScreen from '@/app/interview/introduction';
import InterviewSessionScreen from '@/app/interview/session';

jest.mock('expo-video', () => ({
  useVideoPlayer: () => ({ pause: jest.fn(), play: jest.fn() }),
  VideoView: () => null,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/features/auth', () => ({
  useSession: () => ({
    canMutate: true,
    signOut: jest.fn(async () => undefined),
    status: 'authenticated',
    user: { email: 'learner@example.test', id: 7, isAdmin: false, name: 'Learner' },
  }),
}));

jest.mock('@/lib/feedback', () => ({
  useFeedback: () => ({ showToast: jest.fn() }),
}));

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json' }, status: 200 });
}

const profile = {
  bio: 'I build reliable learning products with TypeScript and measurable outcomes.',
  careerGoals: 'Lead accessible product engineering.',
  currentRole: 'Product engineer',
  email: 'learner@example.test',
  name: 'Learner',
  profileCompleteness: 86,
  skills: ['TypeScript', 'Accessibility'],
};

const queryClients: QueryClient[] = [];
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  queryClients.push(client);
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}

function mockBaseFetch(extra?: (url: string, init?: RequestInit) => Response | undefined) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const custom = extra?.(url, init);
    if (custom) return custom;
    if (url.endsWith('/api/user/profile')) return jsonResponse(profile);
    if (url.endsWith('/api/user/exam-history')) return jsonResponse([]);
    if (url.endsWith('/api/user/certificates')) return jsonResponse([]);
    if (url.endsWith('/api/me/subscription')) return jsonResponse({
      creator: null,
      institute: null,
      learner: { plan: 'all_access', renewsAt: '2027-01-31T00:00:00.000Z', status: 'active' },
      recruiter: null,
    });
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
}

describe('premium learner experiences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  afterEach(async () => {
    await cleanup();
    queryClients.splice(0).forEach((client) => client.clear());
    jest.restoreAllMocks();
  });

  it('searches and filters only represented Practice catalog values', async () => {
    mockBaseFetch((url) => {
      if (!url.includes('/api/practice-assessments?')) return undefined;
      const page = new URL(url).searchParams.get('page');
      return page === '1' ? jsonResponse({
        facets: {},
        items: [
          { category: { name: 'Banking recruitment' }, description: 'Bank aptitude', duration: 25, id: 1, level: 'advanced', slug: 'bank', title: 'Banking mock' },
        ],
        pagination: { page: 1, pageSize: 48, total: 2, totalPages: 2 },
      }) : jsonResponse({
        facets: {},
        items: [
          { category: { name: 'SSC' }, description: 'SSC reasoning', duration: 45, id: 2, level: 'advanced', slug: 'ssc', title: 'SSC advanced mock' },
        ],
        pagination: { page: 2, pageSize: 48, total: 2, totalPages: 2 },
      });
    });

    const view = await renderWithQuery(<PracticeScreen />);
    expect(await view.findByText('Banking mock')).toBeTruthy();
    expect(view.getByText('SSC advanced mock')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Banking recruitment' }).props.accessibilityState.selected).toBe(false);

    await fireEvent.press(view.getByRole('button', { name: 'Banking recruitment' }));
    await waitFor(() => expect(view.queryByText('SSC advanced mock')).toBeNull());
    expect(view.getByText('1 of 2 exams shown')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Clear filters' }));
    await fireEvent.changeText(view.getByLabelText('Search practice exams'), 'SSC');
    await waitFor(() => expect(view.queryByText('Banking mock')).toBeNull());
    expect(view.getByText('SSC advanced mock')).toBeTruthy();
  });

  it('shows only duration bands represented in the complete catalog', async () => {
    mockBaseFetch((url) => url.includes('/api/practice-assessments?') ? jsonResponse({
      facets: {},
      items: [{ category: { name: 'Banking recruitment' }, description: 'Bank aptitude', duration: 25, id: 1, level: 'advanced', slug: 'bank', title: 'Banking mock' }],
      pagination: { page: 1, pageSize: 48, total: 1, totalPages: 1 },
    }) : undefined);

    const view = await renderWithQuery(<PracticeScreen />);
    expect(await view.findByRole('button', { name: '30 min or less' })).toBeTruthy();
    expect(view.queryByRole('button', { name: 'Over 30 min' })).toBeNull();
    expect(view.queryByText(/search by exam, skill/i)).toBeNull();
  });

  it('shows the server-confirmed current Practice Pass plan in Profile', async () => {
    mockBaseFetch();
    const view = await renderWithQuery(<ProfileScreen />);
    expect(await view.findByText('Practice Pass active')).toBeTruthy();
    expect(view.getByText(/Practice Pass · active until/i)).toBeTruthy();
    expect(view.getByText('Active')).toBeTruthy();
  });

  it('prepares an editable About me with teleprompter and professional recording guidance', async () => {
    let persistedBio = profile.bio;
    mockBaseFetch((url, init) => {
      if (!url.endsWith('/api/user/profile')) return undefined;
      if (init?.method === 'PUT') {
        persistedBio = JSON.parse(String(init.body)).bio;
        return jsonResponse({ message: 'Updated', profileCompleteness: 90 });
      }
      return jsonResponse({ ...profile, bio: persistedBio });
    });
    const view = await renderWithQuery(<InterviewIntroductionScreen />);
    expect(await view.findByText('Prepare your personal introduction')).toBeTruthy();
    expect(view.getByLabelText('Personal introduction teleprompter')).toBeTruthy();
    expect(view.getByText(/professional attire/i)).toBeTruthy();
    expect(view.getByText(/quiet space and test for clear/i)).toBeTruthy();
    expect(view.getByText(/only one person in frame/i)).toBeTruthy();
    expect(view.getByText(/No verified profile-video upload/i)).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText('Introduction script'), 'Updated introduction for my next role.');
    expect(view.getByRole('button', { name: 'Review consent and record private take' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => expect(view.getByText('Saved to profile')).toBeTruthy());

    await fireEvent.changeText(view.getByLabelText('Introduction script'), '');
    expect(view.getByRole('button', { name: 'Save About me' }).props.accessibilityState.disabled).toBe(false);
    expect(view.getByRole('button', { name: 'Review consent and record private take' }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(view.getByRole('button', { name: 'Save About me' }));
    await waitFor(() => expect(persistedBio).toBe(''));
  });

  it('renders only verified private evaluation as bounded learner analysis', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ sessionId: 'session-1' });
    mockBaseFetch((url) => {
      if (url.endsWith('/api/interview-studio/status')) return new Response(JSON.stringify({ message: 'Unavailable' }), {
        headers: { 'content-type': 'application/json' },
        status: 503,
      });
      if (url.endsWith('/api/interview-studio/sessions/session-1')) return jsonResponse({
        blueprint: {
          codingCount: 0,
          estimatedDurationMinutes: 10,
          includesCoding: false,
          itemCount: 1,
          items: [{ competency: 'Communication', instructions: 'Use evidence.', key: 'intro', kind: 'structured_response', maximumWords: 300, minimumWords: 50, prompt: 'Describe your impact.', responseFormat: 'text', timeLimitSeconds: 120, title: 'Impact story' }],
          level: 'intermediate',
          role: 'Product engineer',
          skills: ['Communication'],
          summary: 'Role practice',
          title: 'Product interview',
        },
        completedAt: '2026-07-01T00:00:00.000Z',
        deadlineAt: null,
        evaluation: { improvementAreas: ['Quantify the result'], score: 82, status: 'completed', strengths: ['Clear context'], summary: 'A structured response.' },
        evaluationStatus: 'completed',
        id: 'session-1',
        mode: 'practice',
        navigation: { canRevealNext: false, currentIndex: 0, cursor: null, revealedCount: 1, totalItems: 1 },
        overallScore: 82,
        recruiterSharingEnabled: false,
        responses: [{ answerText: 'I improved completion.', code: null, evaluation: { improvementAreas: ['Stale metric advice'], score: 80, status: 'completed', strengths: ['Stale directness'], summary: 'Stale response feedback.' }, evaluationStatus: 'pending', isFinal: true, itemKey: 'intro', itemKind: 'structured_response', language: null, responseText: 'I improved completion.', sampleTestResult: null, timeSpentSeconds: 50, updatedAt: '2026-07-01T00:05:00.000Z' }],
        retentionUntil: '2026-08-01T00:00:00.000Z',
        startedAt: '2026-07-01T00:00:00.000Z',
        status: 'completed',
        submittedAt: '2026-07-01T00:05:00.000Z',
        templateId: 1,
        templateKey: 'product-engineer',
      });
      return undefined;
    });

    const view = await renderWithQuery(<InterviewSessionScreen />);
    expect(await view.findByText('Private learner analysis')).toBeTruthy();
    expect(view.getByText('A structured response.')).toBeTruthy();
    expect(view.getByText('• Clear context')).toBeTruthy();
    expect(view.getByText(/does not analyze local video, appearance, identity, personality/i)).toBeTruthy();
    expect(view.getByText('Question-level analysis status: Pending.')).toBeTruthy();
    expect(view.queryByText('Stale response feedback.')).toBeNull();
    expect(view.queryByText('• Improve: Stale metric advice')).toBeNull();
    expect(view.queryByText('AI feedback unavailable')).toBeNull();
  });

  it('reveals the next mobile interview prompt only through the server cursor', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ sessionId: 'session-reveal' });
    const firstItem = { competency: 'Communication', instructions: 'Use concrete evidence in your response.', key: 'communication.first', kind: 'structured_response' as const, maximumWords: 300, minimumWords: 0, prompt: 'Describe a decision and its measurable outcome.', responseFormat: 'text' as const, timeLimitSeconds: 120, title: 'Decision evidence' };
    const secondItem = { competency: 'JavaScript', constraints: ['Inputs are safe integers.'], instructions: 'Read two integers and print their sum.', interface: 'stdin_stdout' as const, key: 'coding.sum', kind: 'coding' as const, language: 'javascript' as const, problemStatement: 'Read two integer values from standard input and print their sum.', runtime: 'javascript-node20-stdin-stdout-v1' as const, starterCode: '', testCases: [{ expectedOutput: '5\n', input: '2 3\n', key: 'public.basic', title: 'Visible example', visibility: 'public' as const }], timeLimitSeconds: 180, title: 'Sum two values' };
    const sessionPayload = (revealed: boolean) => ({
      blueprint: { codingCount: 1, estimatedDurationMinutes: 10, includesCoding: true, itemCount: 2, items: revealed ? [secondItem] : [firstItem], level: 'intermediate', role: 'Product engineer', skills: ['Communication', 'JavaScript'], summary: 'Private role practice.', title: 'Product interview' },
      completedAt: null,
      consent: { aiEvaluation: false, cameraRecording: false, microphoneTranscription: false, policyVersion: 'consent.v1', recruiterSharing: false, screenRecording: false },
      deadlineAt: '2027-07-01T00:10:00.000Z',
      evaluation: null,
      evaluationStatus: 'not_requested',
      id: 'session-reveal',
      mode: 'practice',
      navigation: { canRevealNext: !revealed, currentIndex: revealed ? 1 : 0, cursor: revealed ? 'cursor-two' : 'cursor-one', revealedCount: revealed ? 2 : 1, totalItems: 2 },
      overallScore: null,
      permissions: { camera: { required: false, state: 'not_requested' }, microphone: { required: false, state: 'not_requested' }, screen: { required: false, state: 'not_requested' } },
      recruiterSharingEnabled: false,
      responses: [{ answerText: 'A saved decision response.', code: null, evaluation: null, evaluationStatus: 'not_requested', isFinal: false, itemKey: 'communication.first', itemKind: 'structured_response', language: null, responseText: 'A saved decision response.', sampleTestResult: null, timeSpentSeconds: 20, updatedAt: '2027-07-01T00:01:00.000Z' }],
      retentionUntil: '2027-08-01T00:00:00.000Z',
      startedAt: '2027-07-01T00:00:00.000Z',
      status: 'in_progress',
      submittedAt: null,
      templateId: 1,
      templateKey: 'product-engineer',
    });
    mockBaseFetch((url, init) => {
      if (url.endsWith('/api/interview-studio/status')) return jsonResponse({ aiEvaluationEnabled: false, codeRunnerEnabled: false, consentVersion: 'consent.v1', evaluationWorkerEnabled: false, limitations: ['practice_sessions_are_private'], practiceEnabled: true, recordingEnabled: false, verifiedEnabled: false, voiceTranscriptionEnabled: false });
      if (url.endsWith('/api/interview-studio/sessions/session-reveal/items/next')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ cursor: 'cursor-one' });
        return jsonResponse(sessionPayload(true));
      }
      if (url.endsWith('/api/interview-studio/sessions/session-reveal')) return jsonResponse(sessionPayload(false));
      return undefined;
    });

    const view = await renderWithQuery(<InterviewSessionScreen />);
    expect(await view.findByText('Decision evidence')).toBeTruthy();
    expect(view.queryByText('Sum two values')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Next question' }));
    expect(await view.findByText('Sum two values')).toBeTruthy();
  });
});
