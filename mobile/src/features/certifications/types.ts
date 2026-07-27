export type AssessmentLevel = 'novice' | 'intermediate' | 'advanced' | 'expert';

export interface CatalogCategory {
  id?: number;
  name: string;
  slug: string;
}

export interface AudienceBand {
  code: string;
  description?: string | null;
  id: number;
  label: string;
}

export interface CertificationSummary {
  audienceBands: AudienceBand[];
  category: CatalogCategory | null;
  certificationLabel: string;
  certificationMode: string | null;
  createdAt: string | null;
  description: string;
  duration: number | null;
  featuredAt: string | null;
  id: number;
  language: string | null;
  level: AssessmentLevel | null;
  origin: string;
  originLabel: string;
  passingScore: number | null;
  price: number | string | null;
  slug: string;
  subscriptionEligible: boolean;
  thumbnailUrl: string | null;
  title: string;
}

export interface CatalogResponse {
  facets: {
    audienceBands: AudienceBand[];
    categories: CatalogCategory[];
    levels: AssessmentLevel[];
  };
  items: CertificationSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface CertificationDetail extends Omit<CertificationSummary, 'audienceBands' | 'createdAt' | 'featuredAt'> {
  assessmentPurpose: string | null;
  canonicalPath: string | null;
  categoryId: number | null;
  metaDescription: string | null;
  metaTitle: string | null;
  ownerType: string | null;
  productType: string | null;
}

export interface CourseAccess {
  contentPrice: number | string | null;
  courseId: number;
  entitlement: null | { expiresAt?: string | null; grantedAt?: string | null; source?: string | null; status?: string | null };
  hasAccess: boolean;
  lessonCount: number;
  previewCount: number;
  productType: string | null;
  requiresPurchase: boolean;
}

export interface ExamQuestion {
  id: number;
  options: string[];
  question: string;
}

export interface RecoverableAttempt {
  answers: Record<string, number>;
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  deadlineAt: string;
  evidenceConsentVersion: string;
  flaggedQuestionIds?: number[];
  integrityExitCount?: number;
  lastIntegrityExitAt?: string;
  proctorMode: 'browser_evidence';
  questions: ExamQuestion[];
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  userId: number;
}

export interface ExamStartResponse {
  deadlineAt: string;
  evidenceConsentVersion: string;
  proctorMode: 'browser_evidence';
  questions: ExamQuestion[];
  sessionId: string;
  startedAt: string;
}

export interface ExamSubmitResponse {
  correctAnswers: number;
  isRetake: boolean;
  message: string;
  passed: boolean;
  passingThreshold: number;
  previousBestScore: number;
  recoveryEmailSent: boolean;
  redirectTo: string;
  resultExpiresAt: string;
  score: number;
  tempExamId: string;
  timedOut: boolean;
  totalQuestions: number;
}

export interface ExamReviewItem {
  correctAnswer: number;
  isCorrect: boolean;
  options: string[];
  question: string;
  questionId: number;
  selectedAnswer: number | null;
}

export interface TempExamResult {
  assessmentPurpose: string | null;
  correctAnswers: number;
  course: { id?: number; passingScore?: number | null; price?: number | string | null; slug?: string; title?: string } | null;
  isGuest: boolean;
  isRetake: boolean;
  mastered: boolean;
  message: string;
  needsPayment: boolean;
  passed: boolean;
  previousBestScore: number;
  recoveryEmailSent: boolean;
  resultExpiresAt: string;
  review: ExamReviewItem[];
  score: number;
  tempExamId: string;
  timeTaken: number | null;
  timedOut: boolean;
  totalQuestions: number;
}

export interface CertificateListItem {
  badge: string | null;
  certificateId: string;
  certificateNumber: string | null;
  courseTitle: string | null;
  expiresAt: string | null;
  isActive: boolean;
  isPaid: boolean;
  issuedAt: string | null;
  score: number | null;
}

export interface CertificateIssuer {
  coIssuer?: { logoUrl?: string | null; name: string } | null;
  platform?: string | null;
}

export interface CertificateDisplay extends CertificateListItem {
  issuedBy: string | null;
  issuer: CertificateIssuer | null;
  mastered: boolean;
  userName: string;
}

export interface CertificateVerification {
  assessment: {
    completedAt?: string | null;
    durationSeconds?: number | null;
    level?: string | null;
    passingScore?: number | null;
    questionCount?: number | null;
  } | null;
  authentic: boolean;
  badge: string | null;
  certificateId: string;
  courseTitle: string;
  expiresAt: string | null;
  issuedAt: string | null;
  issuedBy: string | null;
  issuer: CertificateIssuer | null;
  score: number;
  status: 'pending_activation' | 'revoked' | 'expired' | 'active';
  userName: string;
  valid: boolean;
}
