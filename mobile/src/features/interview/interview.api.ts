import { apiClient, asApiPath, parseApiResponse, type ApiPath } from '@/lib/api-client';
import {
  interviewSessionSchema,
  interviewStatusSchema,
  sessionsResponseSchema,
  templatesResponseSchema,
  type InterviewSession,
} from './interview.schemas';

function sessionPath(sessionId: string, suffix = ''): ApiPath {
  return asApiPath(`/api/interview-studio/sessions/${encodeURIComponent(sessionId)}${suffix}`);
}

export async function getInterviewStatus() {
  return parseApiResponse(interviewStatusSchema, await apiClient.get<unknown>('/api/interview-studio/status', { auth: false }));
}

export async function getInterviewTemplates() {
  return parseApiResponse(templatesResponseSchema, await apiClient.get<unknown>('/api/interview-studio/templates'));
}

export async function getInterviewSessions() {
  return parseApiResponse(sessionsResponseSchema, await apiClient.get<unknown>('/api/interview-studio/sessions'));
}

export async function createAndStartInterview(input: {
  aiProcessing: boolean;
  cameraGranted: boolean;
  consentVersion: string;
  microphoneGranted: boolean;
  templateId: number;
}): Promise<InterviewSession> {
  const created = parseApiResponse(interviewSessionSchema, await apiClient.post<unknown>('/api/interview-studio/sessions', {
    consent: {
      aiProcessing: input.aiProcessing,
      camera: input.cameraGranted,
      consentVersion: input.consentVersion,
      microphone: input.microphoneGranted,
      screen: false,
    },
    mode: 'practice',
    templateId: input.templateId,
  }));

  return parseApiResponse(interviewSessionSchema, await apiClient.post<unknown>(sessionPath(created.id, '/start'), {
    permissions: {
      camera: input.cameraGranted,
      microphone: input.microphoneGranted,
      screen: false,
    },
  }));
}

export async function getInterviewSession(sessionId: string): Promise<InterviewSession> {
  return parseApiResponse(interviewSessionSchema, await apiClient.get<unknown>(sessionPath(sessionId)));
}

export async function revealNextInterviewItem(input: { cursor: string; sessionId: string }): Promise<InterviewSession> {
  return parseApiResponse(
    interviewSessionSchema,
    await apiClient.post<unknown>(sessionPath(input.sessionId, '/items/next'), { cursor: input.cursor }),
  );
}

export async function saveInterviewResponse(input: {
  answer: string;
  itemKey: string;
  kind: 'coding' | 'structured_response';
  navigationCursor: string;
  sessionId: string;
  timeSpentSeconds?: number;
}): Promise<void> {
  const path = sessionPath(input.sessionId, `/responses/${encodeURIComponent(input.itemKey)}`);
  const body = input.kind === 'coding'
    ? { code: input.answer, language: 'javascript', navigationCursor: input.navigationCursor, timeSpentSeconds: input.timeSpentSeconds }
    : { navigationCursor: input.navigationCursor, responseText: input.answer, timeSpentSeconds: input.timeSpentSeconds };
  await apiClient.put(path, body);
}

export async function submitInterviewSession(sessionId: string): Promise<void> {
  await apiClient.post(sessionPath(sessionId, '/submit'));
}

export async function deleteInterviewSession(sessionId: string): Promise<void> {
  await apiClient.delete(sessionPath(sessionId));
}
