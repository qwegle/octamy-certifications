import { z } from "zod";

export const CANDIDATE_EVIDENCE_CONSENT_VERSION = "candidate-evidence-consent.v1" as const;
export const CANDIDATE_EVIDENCE_POLICY_VERSION = "candidate-evidence-policy.v1" as const;
export const CANDIDATE_EVIDENCE_DEFAULT_DAYS = 7;
export const CANDIDATE_EVIDENCE_MAX_DAYS = 30;
export const CANDIDATE_EVIDENCE_MAX_ITEMS = 50;

const positiveId = z.number().int().positive();
const uniqueIds = (ids: number[]) => new Set(ids).size === ids.length;

export const createCandidateEvidenceGrantSchema = z.object({
  targetRecruiterId: positiveId,
  purpose: z.string().trim().min(3).max(500),
  jobReference: z.string().trim().min(1).max(200).optional(),
  certificateIds: z.array(positiveId).min(1).max(CANDIDATE_EVIDENCE_MAX_ITEMS).refine(uniqueIds, "Certificate IDs must be unique"),
  practiceSummaryIds: z.array(positiveId).max(CANDIDATE_EVIDENCE_MAX_ITEMS).refine(uniqueIds, "Practice summary IDs must be unique").default([]),
  consentVersion: z.literal(CANDIDATE_EVIDENCE_CONSENT_VERSION),
  expiresAt: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, context) => {
  if (value.certificateIds.length + value.practiceSummaryIds.length > CANDIDATE_EVIDENCE_MAX_ITEMS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["certificateIds"],
      message: `A grant may select at most ${CANDIDATE_EVIDENCE_MAX_ITEMS} evidence items`,
    });
  }
});

export const revokeCandidateEvidenceGrantSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500).optional(),
}).strict();

export type CandidateEvidenceGrantInput = z.infer<typeof createCandidateEvidenceGrantSchema>;

export type EvidenceGrantState = {
  id: string;
  learnerUserId: number;
  targetRecruiterId: number;
  purpose: string;
  jobReference: string | null;
  consentVersion: string;
  grantedAt: Date | string;
  expiresAt: Date | string;
  revokedAt: Date | string | null;
};

export type RecruiterEvidenceCertificate = {
  id: number;
  learnerUserId: number | null;
  certificateId: string;
  courseTitle: string;
  score: number;
  badge: string;
  issuedAt: Date | string;
  expiresAt: Date | string;
  issuedBy: string;
  isActive: boolean;
  isPaid: boolean;
  courseProductType: string;
  assessmentPurpose: string;
  certificationMode: string;
  courseIsActive: boolean;
  courseReviewStatus: string;
  // Unsafe source fields may exist at runtime. The response constructor below
  // never copies them.
  [unsafeSourceField: string]: unknown;
};

export type RecruiterEvidencePracticeSummary = {
  id: number;
  learnerUserId: number | null;
  courseTitle: string;
  score: number;
  totalQuestions: number;
  timeTaken: number;
  passed: boolean;
  mastered: boolean;
  completedAt: Date | string;
  sourceType: "exam_attempt" | "interview_studio" | "legacy_interview" | string;
  courseProductType: string;
  assessmentPurpose: string;
  courseIsActive: boolean;
  courseReviewStatus: string;
  [unsafeSourceField: string]: unknown;
};

export type RecruiterEvidencePolicyInput = {
  now: Date;
  authenticatedRecruiterId: number;
  requestedLearnerId: number;
  recruiter: { id: number; isActive: boolean; kycStatus: string } | null;
  grant: EvidenceGrantState | null;
  hasExactProfileInteraction: boolean;
  certificates: RecruiterEvidenceCertificate[];
  practiceSummaries: RecruiterEvidencePracticeSummary[];
};

export type RecruiterEvidenceDenialCode =
  | "RECRUITER_INACTIVE"
  | "KYC_REQUIRED"
  | "GRANT_NOT_FOUND"
  | "GRANT_TARGET_MISMATCH"
  | "PROFILE_INTERACTION_REQUIRED"
  | "GRANT_REVOKED"
  | "GRANT_EXPIRED"
  | "CONSENT_VERSION_UNSUPPORTED"
  | "CERTIFICATE_INELIGIBLE"
  | "PRACTICE_SUMMARY_INELIGIBLE";

export type RecruiterEvidencePolicyResult =
  | { allowed: false; code: RecruiterEvidenceDenialCode }
  | {
      allowed: true;
      payload: {
        grant: {
          id: string;
          learnerUserId: number;
          purpose: string;
          jobReference: string | null;
          consentVersion: string;
          grantedAt: Date | string;
          expiresAt: Date | string;
        };
        scopes: Array<"certification" | "practice_summary">;
        certifications: Array<{
          id: number;
          certificateId: string;
          courseTitle: string;
          score: number;
          badge: string;
          issuedAt: Date | string;
          expiresAt: Date | string;
          issuedBy: string;
        }>;
        practiceSummaries: Array<{
          id: number;
          courseTitle: string;
          score: number;
          totalQuestions: number;
          durationSeconds: number;
          passed: boolean;
          mastered: boolean;
          completedAt: Date | string;
        }>;
      };
    };

function milliseconds(value: Date | string): number | null {
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isCurrent(expiry: Date | string, now: Date) {
  const expiryMs = milliseconds(expiry);
  return expiryMs !== null && expiryMs > now.getTime();
}

export function candidateEvidenceExpiry(input: CandidateEvidenceGrantInput, now = new Date()) {
  const defaultExpiry = new Date(now.getTime() + CANDIDATE_EVIDENCE_DEFAULT_DAYS * 24 * 60 * 60 * 1000);
  const expiry = input.expiresAt ? new Date(input.expiresAt) : defaultExpiry;
  const maxExpiry = now.getTime() + CANDIDATE_EVIDENCE_MAX_DAYS * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= now.getTime() || expiry.getTime() > maxExpiry) {
    return null;
  }
  return expiry;
}

export function evaluateRecruiterEvidenceDisclosure(
  input: RecruiterEvidencePolicyInput,
): RecruiterEvidencePolicyResult {
  if (!input.recruiter || input.recruiter.id !== input.authenticatedRecruiterId || !input.recruiter.isActive) {
    return { allowed: false, code: "RECRUITER_INACTIVE" };
  }
  if (input.recruiter.kycStatus !== "approved") return { allowed: false, code: "KYC_REQUIRED" };
  if (!input.grant) return { allowed: false, code: "GRANT_NOT_FOUND" };
  if (
    input.grant.targetRecruiterId !== input.authenticatedRecruiterId
    || input.grant.learnerUserId !== input.requestedLearnerId
  ) {
    return { allowed: false, code: "GRANT_TARGET_MISMATCH" };
  }
  if (!input.hasExactProfileInteraction) return { allowed: false, code: "PROFILE_INTERACTION_REQUIRED" };
  if (input.grant.revokedAt != null) return { allowed: false, code: "GRANT_REVOKED" };
  if (!isCurrent(input.grant.expiresAt, input.now)) return { allowed: false, code: "GRANT_EXPIRED" };
  if (input.grant.consentVersion !== CANDIDATE_EVIDENCE_CONSENT_VERSION) {
    return { allowed: false, code: "CONSENT_VERSION_UNSUPPORTED" };
  }

  const invalidCertificate = input.certificates.length === 0 || input.certificates.some((certificate) => (
    certificate.learnerUserId !== input.requestedLearnerId
    || certificate.isActive !== true
    || certificate.isPaid !== true
    || !isCurrent(certificate.expiresAt, input.now)
    || certificate.courseProductType !== "assessment"
    || certificate.assessmentPurpose !== "certification"
    || typeof certificate.certificationMode !== "string"
    || certificate.certificationMode.trim() === ""
    || certificate.certificationMode === "none"
    || certificate.courseIsActive !== true
    || certificate.courseReviewStatus !== "approved"
  ));
  if (invalidCertificate) return { allowed: false, code: "CERTIFICATE_INELIGIBLE" };

  const invalidPractice = input.practiceSummaries.some((summary) => (
    summary.learnerUserId !== input.requestedLearnerId
    || summary.sourceType !== "exam_attempt"
    || summary.courseProductType !== "assessment"
    || summary.assessmentPurpose !== "practice"
    || summary.courseIsActive !== true
    || summary.courseReviewStatus !== "approved"
  ));
  if (invalidPractice) return { allowed: false, code: "PRACTICE_SUMMARY_INELIGIBLE" };

  const certifications = input.certificates.map((certificate) => ({
    id: certificate.id,
    certificateId: certificate.certificateId,
    courseTitle: certificate.courseTitle,
    score: certificate.score,
    badge: certificate.badge,
    issuedAt: certificate.issuedAt,
    expiresAt: certificate.expiresAt,
    issuedBy: certificate.issuedBy,
  }));
  const practiceSummaries = input.practiceSummaries.map((summary) => ({
    id: summary.id,
    courseTitle: summary.courseTitle,
    score: summary.score,
    totalQuestions: summary.totalQuestions,
    durationSeconds: summary.timeTaken,
    passed: summary.passed,
    mastered: summary.mastered,
    completedAt: summary.completedAt,
  }));
  const scopes: Array<"certification" | "practice_summary"> = [];
  if (certifications.length > 0) scopes.push("certification");
  if (practiceSummaries.length > 0) scopes.push("practice_summary");

  return {
    allowed: true,
    payload: {
      grant: {
        id: input.grant.id,
        learnerUserId: input.grant.learnerUserId,
        purpose: input.grant.purpose,
        jobReference: input.grant.jobReference,
        consentVersion: input.grant.consentVersion,
        grantedAt: input.grant.grantedAt,
        expiresAt: input.grant.expiresAt,
      },
      scopes,
      certifications,
      practiceSummaries,
    },
  };
}

export const RECRUITER_EVIDENCE_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Authorization",
} as const;
