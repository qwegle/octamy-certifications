import { z } from "zod";

const guestIdentitySchema = z.object({
  userEmail: z.string().trim().toLowerCase().email().max(320),
  userName: z.string().trim().min(2).max(120),
}).strict();

export type PendingExamOwner = {
  userId?: number | null;
};

export class PendingExamAccessError extends Error {
  constructor(
    message = "This assessment result belongs to another account",
    public readonly statusCode = 403,
  ) {
    super(message);
    this.name = "PendingExamAccessError";
  }
}

export function parseGuestExamIdentity(input: unknown) {
  return guestIdentitySchema.safeParse(input);
}

export function canAccessPendingExam(
  pending: PendingExamOwner,
  requestUserId: number | null | undefined,
) {
  if (pending.userId == null) return true;
  return requestUserId === pending.userId;
}

export function assertPendingExamAccess(
  pending: PendingExamOwner,
  requestUserId: number | null | undefined,
) {
  if (!canAccessPendingExam(pending, requestUserId)) {
    throw new PendingExamAccessError();
  }
}

/**
 * Pending results are bearer links for guest attempts, so they receive only
 * the display and checkout fields needed by the browser. Database ownership,
 * moderation, internal pricing, and authoring fields never enter the payload.
 */
export function publicPendingCourseSnapshot(course: {
  id: number;
  slug?: string | null;
  title: string;
  passingScore: number;
  price: string;
  originalPrice?: string | null;
  isOnSale?: boolean | null;
  ownerType?: string | null;
  subscriptionEligible?: boolean | null;
  certificationMode?: string | null;
  assessmentPurpose?: string | null;
}) {
  return {
    id: course.id,
    slug: course.slug || undefined,
    title: course.title,
    passingScore: course.passingScore,
    price: course.price,
    originalPrice: course.originalPrice || undefined,
    isOnSale: Boolean(course.isOnSale),
    ownerType: course.ownerType || undefined,
    subscriptionEligible: Boolean(course.subscriptionEligible),
    certificationMode: course.certificationMode || undefined,
    assessmentPurpose: course.assessmentPurpose || undefined,
  };
}

type PendingExamResultAccess = {
  certificateId?: string | null;
};

/**
 * Serializes a pending result without relying on a browser-provided paid flag.
 * Certification review content is omitted entirely until the caller supplies a
 * server-confirmed paid credential for the exact attempt. Practice review stays
 * available as part of the existing Practice Pass product.
 */
export function buildPendingExamResultPayload(
  tempExamId: string,
  examData: any,
  access: PendingExamResultAccess = {},
) {
  const assessmentPurpose = examData.assessmentPurpose
    || examData.course?.assessmentPurpose
    || "certification";
  const isPractice = assessmentPurpose === "practice";
  const hasPaidCredential = !isPractice && Boolean(access.certificateId);
  const reviewLocked = !isPractice && !hasPaidCredential;
  const correctAnswers = Number.isInteger(examData.correctAnswers)
    ? examData.correctAnswers
    : Math.round((Number(examData.score || 0) / 100) * Number(examData.totalQuestions || 0));

  const payload: Record<string, unknown> = {
    tempExamId,
    score: examData.score,
    passed: examData.passed,
    correctAnswers,
    totalQuestions: examData.totalQuestions,
    course: publicPendingCourseSnapshot(examData.course),
    assessmentPurpose,
    timeTaken: examData.timeTaken,
    timedOut: Boolean(examData.timedOut),
    mastered: examData.mastered,
    isRetake: Boolean(examData.isRetake),
    previousBestScore: Number(examData.previousBestScore || 0),
    passingThreshold: Number(examData.course?.passingScore || 0),
    reviewLocked,
    isGuest: examData.userId == null,
    maskedEmail: typeof examData.userEmail === "string"
      ? examData.userEmail.replace(
          /^(.)(.*)(@.*)$/,
          (_match: string, first: string, middle: string, domain: string) =>
            `${first}${"*".repeat(Math.min(6, middle.length))}${domain}`,
        )
      : undefined,
    resultExpiresAt: examData.resultExpiresAt,
    recoveryEmailSent: Boolean(examData.recoveryEmailSent),
    message: examData.passed
      ? `Congratulations! You passed with ${examData.score}%`
      : `You scored ${examData.score}%. You need at least ${examData.course?.passingScore}% to pass.`,
    needsPayment: !isPractice && !hasPaidCredential,
  };

  if (!reviewLocked) {
    payload.review = Array.isArray(examData.review) ? examData.review : [];
  }
  if (hasPaidCredential) {
    payload.credential = {
      certificateId: access.certificateId,
      href: `/certificate/${encodeURIComponent(access.certificateId!)}`,
    };
  }

  return payload;
}
