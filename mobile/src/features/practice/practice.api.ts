import { apiClient, parseApiResponse } from '@/lib/api-client';
import {
  attemptStartSchema,
  checkoutSchema,
  checkoutStatusSchema,
  practiceCatalogSchema,
  practiceDetailSchema,
  practiceResultSchema,
  submitResultSchema,
  subscriptionSchema,
} from './practice.types';

async function getPracticeCatalogPage(page: number, signal?: AbortSignal) {
  const data = await apiClient.get<unknown>(`/api/practice-assessments?page=${page}&pageSize=48`, { auth: false, signal });
  return parseApiResponse(practiceCatalogSchema, data);
}

export async function getPracticeCatalog(signal?: AbortSignal) {
  const firstPage = await getPracticeCatalogPage(1, signal);
  if (firstPage.pagination.totalPages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pagination.totalPages - 1 }, (_, index) => getPracticeCatalogPage(index + 2, signal)),
  );
  const items = [firstPage, ...remainingPages].flatMap((page) => page.items);
  return {
    ...firstPage,
    items,
    pagination: { ...firstPage.pagination, page: 1, pageSize: items.length },
  };
}

export async function getPracticeDetail(slugOrId: string, signal?: AbortSignal) {
  const data = await apiClient.get<unknown>(`/api/practice-assessments/${encodeURIComponent(slugOrId)}`, { auth: false, signal });
  return parseApiResponse(practiceDetailSchema, data);
}

export async function getPracticeSubscription(signal?: AbortSignal) {
  const data = await apiClient.get<unknown>('/api/me/subscription', { signal });
  return parseApiResponse(subscriptionSchema, data);
}

export async function createPracticeCheckout(cycle: 'monthly' | 'yearly') {
  const data = await apiClient.post<unknown>('/api/subscriptions/checkout', {
    ownerType: 'learner',
    plan: 'all_access',
    cycle,
  });
  return parseApiResponse(checkoutSchema, data);
}

export async function getCheckoutStatus(orderId: string) {
  const data = await apiClient.get<unknown>(`/api/subscriptions/orders/${encodeURIComponent(orderId)}/status`);
  return parseApiResponse(checkoutStatusSchema, data);
}

export async function startPracticeAttempt(courseId: number) {
  const data = await apiClient.post<unknown>(`/api/courses/${courseId}/questions`, { evidenceConsent: true });
  return parseApiResponse(attemptStartSchema, data);
}

export interface SubmitPracticeInput {
  answers: Record<string, number>;
  courseId: number;
  sessionId: string;
}

export async function submitPracticeAttempt(input: SubmitPracticeInput) {
  const data = await apiClient.post<unknown>('/api/exam/submit', {
    courseId: input.courseId,
    sessionId: input.sessionId,
    answers: input.answers,
  });
  return parseApiResponse(submitResultSchema, data);
}

export async function getPracticeResult(tempExamId: string, signal?: AbortSignal) {
  const data = await apiClient.get<unknown>(`/api/exam-results-temp/${encodeURIComponent(tempExamId)}`, { signal });
  return parseApiResponse(practiceResultSchema, data);
}
