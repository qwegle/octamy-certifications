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
