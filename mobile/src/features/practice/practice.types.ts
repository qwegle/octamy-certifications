import { z } from 'zod';

const priceSchema = z.union([z.number(), z.string()]).nullable().optional();
const nullableText = z.string().nullable().optional();
const representedCategorySchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(1),
  slug: z.string().optional(),
}).passthrough();

export const practiceAssessmentSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  description: z.string().nullable().catch(null),
  slug: z.string(),
  duration: z.union([z.number(), z.string()]).nullable().optional(),
  passingScore: z.union([z.number(), z.string()]).nullable().optional(),
  price: priceSchema,
  level: nullableText,
  language: nullableText,
  thumbnailUrl: nullableText,
  certificationMode: nullableText,
  assessmentPurpose: nullableText,
  subscriptionEligible: z.boolean().optional().catch(false),
  featuredAt: nullableText,
  createdAt: nullableText,
  category: representedCategorySchema.nullable().optional(),
  creator: z.unknown().nullable().optional(),
  origin: nullableText,
  originLabel: nullableText,
  certificationLabel: nullableText,
  canonicalPath: nullableText,
  audienceBands: z.array(z.unknown()).optional().catch([]),
});

export const practiceCatalogSchema = z.object({
  items: z.array(practiceAssessmentSchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  facets: z.unknown(),
});

export const practiceDetailSchema = practiceAssessmentSchema.extend({
  categoryId: z.number().nullable().optional(),
  productType: nullableText,
  metaTitle: nullableText,
  metaDescription: nullableText,
  ownerType: nullableText,
});

const learnerSubscriptionSchema = z.object({
  plan: z.string(),
  renewsAt: z.string().nullable(),
  status: z.string(),
});

export const subscriptionSchema = z.object({
  learner: learnerSubscriptionSchema.nullable(),
  creator: z.unknown().nullable(),
  institute: z.unknown().nullable(),
  recruiter: z.unknown().nullable(),
});

export const checkoutSchema = z.object({
  orderId: z.string().min(1),
  paymentSessionId: z.string().min(1),
  paymentLink: z.string().url().optional(),
  subscriptionId: z.union([z.string(), z.number()]),
  amount: z.union([z.string(), z.number()]),
});

export const checkoutStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.string(),
  plan: z.literal('all_access'),
  ownerType: z.literal('learner'),
  startsAt: z.string().nullable(),
  renewsAt: z.string().nullable(),
});

export const attemptQuestionSchema = z.object({
  id: z.number().int(),
  question: z.string(),
  options: z.array(z.string()).min(1),
});

export const attemptStartSchema = z.object({
  questions: z.array(attemptQuestionSchema).min(1),
  sessionId: z.string().min(1),
  startedAt: z.string(),
  deadlineAt: z.string(),
  proctorMode: z.enum(['browser_evidence', 'none']),
  evidenceConsentVersion: z.string().nullable(),
});

export const submitResultSchema = z.object({
  tempExamId: z.string(),
  score: z.number(),
  passed: z.boolean(),
  correctAnswers: z.number(),
  totalQuestions: z.number(),
  isRetake: z.boolean(),
  previousBestScore: z.number(),
  passingThreshold: z.number(),
  recoveryEmailSent: z.boolean(),
  resultExpiresAt: z.string(),
  timedOut: z.boolean(),
  message: z.string(),
  redirectTo: z.string(),
});

const reviewItemSchema = z.object({
  questionId: z.number(),
  question: z.string(),
  options: z.array(z.string()),
  selectedAnswer: z.number().nullable(),
  correctAnswer: z.number(),
  isCorrect: z.boolean(),
});

export const practiceResultSchema = z.object({
  tempExamId: z.string(),
  score: z.number(),
  passed: z.boolean(),
  correctAnswers: z.number(),
  totalQuestions: z.number(),
  course: z.unknown(),
  assessmentPurpose: z.string().nullable().optional(),
  timeTaken: z.number().nullable().optional(),
  timedOut: z.boolean(),
  mastered: z.boolean(),
  isRetake: z.boolean(),
  previousBestScore: z.number(),
  review: z.array(reviewItemSchema),
  isGuest: z.boolean(),
  maskedEmail: z.string().optional(),
  resultExpiresAt: z.string(),
  recoveryEmailSent: z.boolean(),
  message: z.string(),
  needsPayment: z.boolean(),
});

export type PracticeAssessment = z.infer<typeof practiceAssessmentSchema>;
export type PracticeDetail = z.infer<typeof practiceDetailSchema>;
export type PracticeSubscription = z.infer<typeof subscriptionSchema>;
export type AttemptStart = z.infer<typeof attemptStartSchema>;
export type AttemptQuestion = z.infer<typeof attemptQuestionSchema>;
export type PracticeResult = z.infer<typeof practiceResultSchema>;
export type SubmitResult = z.infer<typeof submitResultSchema>;

export function hasActivePracticePass(subscription: PracticeSubscription | undefined): boolean {
  return subscription?.learner?.status.toLowerCase() === 'active';
}

export function practicePlanLabel(plan: string | null | undefined): string {
  if (!plan || plan === 'all_access') return 'Practice Pass';
  return plan.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}
