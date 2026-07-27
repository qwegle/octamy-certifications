import { z } from 'zod';

import { apiClient, parseApiResponse } from '@/lib/api-client';

const optionalText = z.string().nullish().transform((value) => value ?? '');
const optionalList = z.array(z.string()).nullish().transform((value) => value ?? []);

const profileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: optionalText,
  company: optionalText,
  position: optionalText,
  location: optionalText,
  experience: z.number().min(0).max(50).nullish().transform((value) => value ?? null),
  currentRole: optionalText,
  skills: optionalList,
  availability: optionalText,
  noticePeriod: optionalText,
  expectedSalary: optionalText,
  workType: optionalList,
  category: optionalList,
  linkedinProfile: optionalText,
  portfolioUrl: optionalText,
  bio: optionalText,
  careerGoals: optionalText,
  profileVisibility: z.boolean().nullish().transform((value) => value === true),
  evidencePassportPublic: z.boolean().nullish().transform((value) => value === true),
  profileCompleteness: z.number().min(0).max(100).nullish().transform((value) => value ?? 0),
  resume: optionalText,
});

const attemptSchema = z.object({
  id: z.number().int().positive(),
  courseId: z.number().int().positive(),
  score: z.number(),
  totalQuestions: z.number().int().nonnegative(),
  passed: z.boolean(),
  createdAt: z.string(),
  courseTitle: z.string(),
  courseSlug: z.string(),
  passingScore: z.number(),
  hasCertificate: z.boolean(),
});

const updateResponseSchema = z.object({
  message: z.string(),
  profileCompleteness: z.number(),
});

const passportLinkSchema = z.object({
  token: z.string().min(1),
  path: z.string().startsWith('/evidence/'),
  isPublic: z.boolean(),
});

export type LearnerProfile = z.infer<typeof profileSchema>;
export type ProfileUpdate = Partial<Pick<LearnerProfile,
  | 'availability'
  | 'bio'
  | 'careerGoals'
  | 'category'
  | 'company'
  | 'currentRole'
  | 'evidencePassportPublic'
  | 'expectedSalary'
  | 'experience'
  | 'linkedinProfile'
  | 'location'
  | 'name'
  | 'noticePeriod'
  | 'phone'
  | 'portfolioUrl'
  | 'position'
  | 'profileVisibility'
  | 'resume'
  | 'skills'
  | 'workType'
>>;

export interface EvidenceSummary {
  credentialCount: number;
  passedAttemptCount: number;
  scoredAttemptCount: number;
}

export interface PassportLink {
  isPublic: boolean;
  path: string;
  token: string;
}

export async function getLearnerProfile(): Promise<LearnerProfile> {
  return parseApiResponse(profileSchema, await apiClient.get<unknown>('/api/user/profile'));
}

export async function updateLearnerProfile(update: ProfileUpdate): Promise<{ message: string; profileCompleteness: number }> {
  return parseApiResponse(updateResponseSchema, await apiClient.put<unknown>('/api/user/profile', update));
}

export async function getEvidenceSummary(): Promise<EvidenceSummary> {
  const [attemptValue, certificateValue] = await Promise.all([
    apiClient.get<unknown>('/api/user/exam-history'),
    apiClient.get<unknown>('/api/user/certificates'),
  ]);
  const attempts = parseApiResponse(z.array(attemptSchema), attemptValue);
  const certificates = parseApiResponse(z.array(z.unknown()), certificateValue);
  return {
    credentialCount: certificates.length,
    passedAttemptCount: attempts.filter((attempt) => attempt.passed).length,
    scoredAttemptCount: attempts.length,
  };
}

export async function getEvidencePassportLink(): Promise<PassportLink> {
  return parseApiResponse(passportLinkSchema, await apiClient.get<unknown>('/api/user/evidence-passport-link'));
}
