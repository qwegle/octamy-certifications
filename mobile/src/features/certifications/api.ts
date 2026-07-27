import { z } from 'zod';

import { apiClient, asApiPath, parseApiResponse } from '@/lib/api-client';
import type {
  CatalogResponse,
  CertificateDisplay,
  CertificateListItem,
  CertificateVerification,
  CertificationDetail,
  CourseAccess,
  ExamStartResponse,
  ExamSubmitResponse,
  TempExamResult,
} from './types';
import { normalizeMobileExamExitCount } from './proctoring';

const nullableText = z.string().nullable().optional().transform((value) => value ?? null);
const nullableNumber = z.number().nullable().optional().transform((value) => value ?? null);
const nullablePrice = z.union([z.number(), z.string()]).nullable().optional().transform((value) => value ?? null);
const levelSchema = z.enum(['novice', 'intermediate', 'advanced', 'expert']);
const categorySchema = z.object({ id: z.number().int().optional(), name: z.string(), slug: z.string() });
const audienceBandSchema = z.object({
  code: z.string(),
  description: nullableText,
  id: z.number().int(),
  label: z.string(),
});

const summarySchema = z.object({
  audienceBands: z.array(audienceBandSchema).optional().default([]),
  category: categorySchema.nullable().optional().default(null),
  certificationLabel: z.string().optional().default('Career certification'),
  certificationMode: nullableText,
  createdAt: nullableText,
  description: z.string().optional().default('No description has been published.'),
  duration: nullableNumber,
  featuredAt: nullableText,
  id: z.number().int().positive(),
  language: nullableText,
  level: levelSchema.nullable().optional().transform((value) => value ?? null),
  origin: z.string().optional().default('octamy'),
  originLabel: z.string().optional().default('Octamy'),
  passingScore: nullableNumber,
  price: nullablePrice,
  slug: z.string().min(1),
  subscriptionEligible: z.boolean().optional().default(false),
  thumbnailUrl: nullableText,
  title: z.string().min(1),
});

const catalogSchema = z.object({
  facets: z.object({
    audienceBands: z.array(audienceBandSchema).optional().default([]),
    categories: z.array(categorySchema).optional().default([]),
    levels: z.array(levelSchema).optional().default([]),
  }),
  items: z.array(summarySchema),
  pagination: z.object({ page: z.number(), pageSize: z.number(), total: z.number(), totalPages: z.number() }),
});

const detailSchema = summarySchema.omit({ audienceBands: true, createdAt: true, featuredAt: true }).extend({
  assessmentPurpose: nullableText,
  canonicalPath: nullableText,
  categoryId: nullableNumber,
  metaDescription: nullableText,
  metaTitle: nullableText,
  ownerType: nullableText,
  productType: nullableText,
});

const accessSchema = z.object({
  contentPrice: nullablePrice,
  courseId: z.number().int().positive(),
  entitlement: z.object({
    expiresAt: nullableText,
    grantedAt: nullableText,
    source: nullableText,
    status: nullableText,
  }).nullable(),
  hasAccess: z.boolean(),
  lessonCount: z.number().int().nonnegative(),
  previewCount: z.number().int().nonnegative(),
  productType: nullableText,
  requiresPurchase: z.boolean(),
});

const questionSchema = z.object({ id: z.number().int(), options: z.array(z.string()).min(1), question: z.string().min(1) });
const startSchema = z.object({
  deadlineAt: z.string(),
  evidenceConsentVersion: z.string(),
  proctorMode: z.literal('browser_evidence'),
  questions: z.array(questionSchema).min(1),
  sessionId: z.string().min(1),
  startedAt: z.string(),
});

const submitSchema = z.object({
  correctAnswers: z.number().int().nonnegative(),
  isRetake: z.boolean(),
  message: z.string(),
  passed: z.boolean(),
  passingThreshold: z.number(),
  previousBestScore: z.number(),
  recoveryEmailSent: z.boolean(),
  redirectTo: z.string(),
  resultExpiresAt: z.string(),
  score: z.number(),
  tempExamId: z.string().min(1),
  timedOut: z.boolean(),
  totalQuestions: z.number().int().nonnegative(),
});

const reviewSchema = z.object({
  correctAnswer: z.number().int(),
  isCorrect: z.boolean(),
  options: z.array(z.string()),
  question: z.string(),
  questionId: z.number().int(),
  selectedAnswer: z.number().int().nullable().optional().transform((value) => value ?? null),
});
const tempResultSchema = z.object({
  assessmentPurpose: nullableText,
  correctAnswers: z.number().int().nonnegative(),
  course: z.object({
    id: z.number().int().optional(),
    passingScore: nullableNumber,
    price: nullablePrice,
    slug: z.string().optional(),
    title: z.string().optional(),
  }).passthrough().nullable(),
  isGuest: z.boolean(),
  isRetake: z.boolean(),
  mastered: z.boolean(),
  message: z.string(),
  needsPayment: z.boolean(),
  passed: z.boolean(),
  previousBestScore: z.number(),
  recoveryEmailSent: z.boolean(),
  resultExpiresAt: z.string(),
  review: z.array(reviewSchema).optional().default([]),
  score: z.number(),
  tempExamId: z.string().min(1),
  timeTaken: nullableNumber,
  timedOut: z.boolean(),
  totalQuestions: z.number().int().nonnegative(),
});

const certificateListSchema = z.object({
  badge: nullableText,
  certificateId: z.string().min(1),
  certificateNumber: nullableText,
  courseTitle: nullableText,
  expiresAt: nullableText,
  isActive: z.boolean().optional().default(false),
  isPaid: z.boolean().optional().default(false),
  issuedAt: nullableText,
  score: nullableNumber,
}).passthrough();
const issuerSchema = z.object({
  coIssuer: z.object({ logoUrl: nullableText, name: z.string() }).passthrough().nullable().optional().transform((value) => value ?? null),
  platform: nullableText,
}).passthrough().nullable().optional().transform((value) => value ?? null);
const certificateDisplaySchema = certificateListSchema.extend({
  issuedBy: nullableText,
  issuer: issuerSchema,
  mastered: z.boolean().optional().default(false),
  userName: z.string(),
});
const verificationSchema = z.object({
  assessment: z.object({
    completedAt: nullableText,
    durationSeconds: nullableNumber,
    level: nullableText,
    passingScore: nullableNumber,
    questionCount: nullableNumber,
  }).passthrough().nullable().optional().transform((value) => value ?? null),
  authentic: z.boolean(),
  badge: nullableText,
  certificateId: z.string(),
  courseTitle: z.string(),
  expiresAt: nullableText,
  issuedAt: nullableText,
  issuedBy: nullableText,
  issuer: issuerSchema,
  score: z.number(),
  status: z.enum(['pending_activation', 'revoked', 'expired', 'active']),
  userName: z.string(),
  valid: z.boolean(),
});

export interface CertificationFilters {
  category?: string;
  level?: string;
  search?: string;
}

export async function getCertifications(filters: CertificationFilters, signal?: AbortSignal): Promise<CatalogResponse> {
  const query = new URLSearchParams({ page: '1', pageSize: '48' });
  if (filters.search?.trim()) query.set('search', filters.search.trim().slice(0, 120));
  if (filters.category) query.set('category', filters.category.slice(0, 120));
  if (filters.level) query.set('level', filters.level);
  const response = await apiClient.get<unknown>(asApiPath(`/api/assessments?${query.toString()}`), { auth: false, signal });
  return parseApiResponse(catalogSchema, response);
}

export async function getCertification(slug: string, signal?: AbortSignal): Promise<CertificationDetail> {
  return parseApiResponse(detailSchema, await apiClient.get<unknown>(asApiPath(`/api/assessments/${encodeURIComponent(slug)}`), { auth: false, signal }));
}

export async function getCourseAccess(courseId: number, signal?: AbortSignal): Promise<CourseAccess> {
  return parseApiResponse(accessSchema, await apiClient.get<unknown>(asApiPath(`/api/courses/${courseId}/access`), { signal }));
}

export async function startCertificationExam(courseId: number): Promise<ExamStartResponse> {
  return parseApiResponse(startSchema, await apiClient.post<unknown>(asApiPath(`/api/courses/${courseId}/questions`), { evidenceConsent: true }));
}

export async function submitCertificationExam(input: {
  answers: Record<string, number>;
  courseId: number;
  sessionId: string;
  tabSwitches?: number;
}): Promise<ExamSubmitResponse> {
  return parseApiResponse(submitSchema, await apiClient.post<unknown>('/api/exam/submit', {
    ...input,
    tabSwitches: normalizeMobileExamExitCount(input.tabSwitches),
  }));
}

export async function getTempExamResult(tempExamId: string, signal?: AbortSignal): Promise<TempExamResult> {
  return parseApiResponse(tempResultSchema, await apiClient.get<unknown>(asApiPath(`/api/exam-results-temp/${encodeURIComponent(tempExamId)}`), { signal }));
}

export async function getMyCertificates(signal?: AbortSignal): Promise<CertificateListItem[]> {
  const response = await apiClient.get<unknown>('/api/certificates/user/certificates', { signal });
  return parseApiResponse(z.array(certificateListSchema), response);
}

export async function getCertificate(certificateId: string, signal?: AbortSignal): Promise<CertificateDisplay> {
  return parseApiResponse(certificateDisplaySchema, await apiClient.get<unknown>(asApiPath(`/api/certificates/${encodeURIComponent(certificateId)}`), { auth: false, signal }));
}

export async function verifyCertificate(certificateId: string, signal?: AbortSignal): Promise<CertificateVerification> {
  return parseApiResponse(verificationSchema, await apiClient.get<unknown>(asApiPath(`/api/certificates/verify/${encodeURIComponent(certificateId)}`), { auth: false, signal }));
}
