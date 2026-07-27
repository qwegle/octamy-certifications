import { interviewItemSchema } from '@/features/interview/interview.schemas';
import { consumeRecordingConsentGrant, issueRecordingConsentGrant } from '@/features/interview/recording-consent';
import { purgeUserScopedLocalData, registerUserDataCleaner } from '@/lib/user-data-cleanup';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'recording-grant-token') }));

describe('mobile privacy invariants', () => {
  it('binds an opaque recording grant to one learner and immutable capture context', () => {
    const token = issueRecordingConsentGrant({
      itemKey: 'communication.answer',
      kind: 'answer',
      maxSeconds: 90,
      ownerId: 7,
      questionTitle: 'Communication example',
      sessionId: 'session-1',
    });

    expect(token).toBe('recording-grant-token');
    expect(consumeRecordingConsentGrant(token, 7)).toEqual({
      itemKey: 'communication.answer',
      kind: 'answer',
      maxSeconds: 90,
      ownerId: 7,
      questionTitle: 'Communication example',
      sessionId: 'session-1',
    });
    expect(consumeRecordingConsentGrant(token, 7)).toBeNull();
  });

  it('rejects candidate prompt DTOs containing rubric or hidden-test material', () => {
    const candidateItem = {
      competency: 'JavaScript',
      constraints: ['Safe integers'],
      instructions: 'Read values and print their sum.',
      interface: 'stdin_stdout',
      key: 'coding.sum',
      kind: 'coding' as const,
      language: 'javascript' as const,
      problemStatement: 'Read two integer values from standard input and print their sum.',
      runtime: 'javascript-node20-stdin-stdout-v1' as const,
      starterCode: '',
      testCases: [{ expectedOutput: '5\n', input: '2 3\n', key: 'public.basic', title: 'Example', visibility: 'public' as const }],
      timeLimitSeconds: 180,
      title: 'Sum values',
    };

    expect(interviewItemSchema.safeParse(candidateItem).success).toBe(true);
    expect(interviewItemSchema.safeParse({ ...candidateItem, rubric: [{ key: 'secret' }] }).success).toBe(false);
    expect(interviewItemSchema.safeParse({
      ...candidateItem,
      testCases: [...candidateItem.testCases, { expectedOutput: 'secret', input: 'secret', key: 'hidden.secret', title: 'Hidden', visibility: 'hidden' }],
    }).success).toBe(false);
    expect(interviewItemSchema.safeParse({
      ...candidateItem,
      testCases: [{ ...candidateItem.testCases[0], weight: 100 }],
    }).success).toBe(false);
  });

  it('rejects cleanup when any registered repository fails while still attempting all cleaners', async () => {
    const completedCleaner = jest.fn(async () => undefined);
    const failedCleaner = jest.fn(async () => { throw new Error('storage unavailable'); });
    const unregisterCompleted = registerUserDataCleaner(completedCleaner);
    const unregisterFailed = registerUserDataCleaner(failedCleaner);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(purgeUserScopedLocalData(7)).rejects.toThrow(/Could not remove learner data/);
      expect(completedCleaner).toHaveBeenCalledWith(7);
      expect(failedCleaner).toHaveBeenCalledWith(7);
    } finally {
      unregisterCompleted();
      unregisterFailed();
      warning.mockRestore();
    }
  });
});
