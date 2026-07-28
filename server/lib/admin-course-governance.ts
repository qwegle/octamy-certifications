import { z } from "zod";

const moneySchema = z.union([
  z.number().finite().min(0).max(1_000_000),
  z.string().trim().regex(/^\d{1,7}(?:\.\d{1,2})?$/, "Use a valid non-negative amount"),
]).transform((value) => Number(value).toFixed(2));

const optionalMoneySchema = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  moneySchema.nullable(),
);

const thumbnailSchema = z.string().trim().max(2_000).refine(
  (value) => value === "" || value.startsWith("/api/media/files/") || /^https?:\/\//i.test(value),
  "Thumbnail must be an Octamy media URL or an http(s) URL",
).transform((value) => value || null);

const commonAdminCourseFields = {
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(10_000),
  slug: z.string().trim().min(1).max(220).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  categoryId: z.coerce.number().int().positive(),
  duration: z.coerce.number().int().min(1).max(20_000),
  passingScore: z.coerce.number().int().min(1).max(100),
  price: moneySchema,
  productType: z.enum(["assessment", "video_course", "ebook", "bundle"]),
  contentPrice: optionalMoneySchema,
  originalPrice: optionalMoneySchema,
  isOnSale: z.boolean(),
  level: z.enum(["novice", "intermediate", "advanced", "expert"]),
  isActive: z.boolean(),
  isInternship: z.boolean(),
  visibility: z.enum(["public", "unlisted", "private"]),
  language: z.string().trim().min(2).max(20),
  assessmentPurpose: z.enum(["certification", "practice"]),
  defaultReviewPolicy: z.enum(["immediate", "after_final_attempt", "after_window", "score_only"]),
  subscriptionEligible: z.boolean(),
  resellerEligible: z.boolean(),
  thumbnailUrl: thumbnailSchema.nullable(),
  useBlueprintEngine: z.boolean(),
};

/**
 * The strict schemas are an intentional trust boundary. Ownership, issuer and
 * review state are absent, so a client cannot smuggle those database fields
 * into an admin mutation.
 */
export const adminCourseCreateSchema = z.object(commonAdminCourseFields).strict().extend({
  passingScore: commonAdminCourseFields.passingScore.default(60),
  price: commonAdminCourseFields.price.default("199.00"),
  productType: commonAdminCourseFields.productType.default("assessment"),
  contentPrice: commonAdminCourseFields.contentPrice.default(null),
  originalPrice: commonAdminCourseFields.originalPrice.default(null),
  isOnSale: commonAdminCourseFields.isOnSale.default(false),
  level: commonAdminCourseFields.level.default("novice"),
  isActive: commonAdminCourseFields.isActive.default(false),
  isInternship: commonAdminCourseFields.isInternship.default(false),
  visibility: commonAdminCourseFields.visibility.default("public"),
  language: commonAdminCourseFields.language.default("en"),
  assessmentPurpose: commonAdminCourseFields.assessmentPurpose.default("certification"),
  defaultReviewPolicy: commonAdminCourseFields.defaultReviewPolicy.default("immediate"),
  subscriptionEligible: commonAdminCourseFields.subscriptionEligible.default(false),
  resellerEligible: commonAdminCourseFields.resellerEligible.default(false),
  thumbnailUrl: commonAdminCourseFields.thumbnailUrl.optional().default(null),
  useBlueprintEngine: commonAdminCourseFields.useBlueprintEngine.default(false),
});

export const adminCourseUpdateSchema = z.object(commonAdminCourseFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one course field to update");

export const adminCourseReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "pending"]),
  reason: z.string().trim().max(1_000).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "rejected" && !value.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Give the submitter a reason for rejection",
    });
  }
});

export type AdminCourseCreateInput = z.infer<typeof adminCourseCreateSchema>;
export type AdminCourseUpdateInput = z.infer<typeof adminCourseUpdateSchema>;
export type AdminCourseReviewInput = z.infer<typeof adminCourseReviewSchema>;

export type GovernedCourse = {
  title?: string;
  slug?: string;
  ownerType: string;
  ownerId: number | null;
  productType: string;
  visibility: string;
  certificationMode: string;
  assessmentPurpose: string;
  reviewStatus: string;
  isActive: boolean;
  subscriptionEligible: boolean;
  resellerEligible: boolean;
};

export class AdminCourseGovernanceError extends Error {}

const FIRST_PARTY_GRADE_1_TO_10 = /\bgrade[\s-]*(?:[1-9]|10)\b/i;

function isFirstPartyGradeOneToTenAssessment(course: {
  title?: string;
  slug?: string;
  ownerType: string;
  productType: string;
  assessmentPurpose: string;
}) {
  return course.ownerType === "admin"
    && course.productType === "assessment"
    && course.assessmentPurpose === "practice"
    && FIRST_PARTY_GRADE_1_TO_10.test(`${course.title || ""} ${course.slug || ""}`);
}

function assertFirstPartyAssessmentPortfolioScope(
  course: {
    title?: string;
    slug?: string;
    ownerType: string;
    productType: string;
    assessmentPurpose: string;
  },
  action: "create" | "publish",
) {
  if (!isFirstPartyGradeOneToTenAssessment(course)) return;
  throw new AdminCourseGovernanceError(
    action === "create"
      ? "Grade 1–10 school assessments are outside the first-party Octamy portfolio."
      : "Grade 1–10 school assessments cannot be published in the first-party Practice catalogue.",
  );
}

export function slugifyCourseTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220) || "octamy-assessment";
}

function isStructurallySubscriptionEligible(course: {
  ownerType: string;
  productType: string;
  visibility: string;
  assessmentPurpose: string;
}) {
  return course.ownerType === "admin"
    && course.assessmentPurpose === "practice"
    && course.productType === "assessment"
    && course.visibility === "public";
}

function isStructurallyResellerEligible(course: {
  ownerType: string;
  certificationMode: string;
  visibility: string;
}) {
  return course.ownerType === "admin"
    && course.certificationMode === "octamy"
    && course.visibility === "public";
}

export function buildAdminOwnedCourseCreate(
  input: AdminCourseCreateInput,
  slug: string,
) {
  const structural = {
    ownerType: "admin",
    productType: input.productType,
    visibility: input.visibility,
    assessmentPurpose: input.assessmentPurpose,
  };
  assertFirstPartyAssessmentPortfolioScope({
    ...structural,
    title: input.title,
    slug,
  }, "create");
  const certificationMode = input.assessmentPurpose === "practice" ? "none" : "octamy";
  return {
    ...input,
    slug,
    contentPrice: input.productType === "assessment" ? null : input.contentPrice,
    ownerType: "admin" as const,
    ownerId: null,
    certificationMode,
    assessmentPurpose: input.assessmentPurpose,
    reviewStatus: input.isActive ? "approved" : "draft",
    subscriptionEligible: input.subscriptionEligible && isStructurallySubscriptionEligible(structural),
    resellerEligible: input.assessmentPurpose === "certification" && input.resellerEligible && isStructurallyResellerEligible({ ownerType: "admin", certificationMode, visibility: input.visibility }),
  };
}

const thirdPartyCertificationModes: Record<string, ReadonlySet<string>> = {
  creator: new Set(["creator", "octamy_creator"]),
  institute: new Set(["institute", "octamy_institute"]),
};

export function buildGovernedAdminCourseUpdate(
  existing: GovernedCourse,
  input: AdminCourseUpdateInput,
) {
  if (existing.ownerType === "admin") {
    const productType = input.productType ?? existing.productType;
    const visibility = input.visibility ?? existing.visibility;
    const assessmentPurpose = input.assessmentPurpose ?? existing.assessmentPurpose;
    const title = input.title ?? existing.title;
    const slug = input.slug ?? existing.slug;
    const isActive = input.isActive ?? existing.isActive;
    if (isActive && visibility === "public") {
      assertFirstPartyAssessmentPortfolioScope({
        ownerType: "admin",
        productType,
        assessmentPurpose,
        title,
        slug,
      }, "publish");
    }
    const certificationMode = assessmentPurpose === "practice" ? "none" : "octamy";
    const requestedSubscription = input.subscriptionEligible ?? existing.subscriptionEligible;
    const requestedReseller = input.resellerEligible ?? existing.resellerEligible;
    const updates = {
      ...input,
      contentPrice: productType === "assessment" ? null : input.contentPrice,
      ownerType: "admin" as const,
      ownerId: null,
      certificationMode,
      assessmentPurpose,
      subscriptionEligible: requestedSubscription && isStructurallySubscriptionEligible({
        ownerType: "admin",
        productType,
        visibility,
        assessmentPurpose,
      }),
      resellerEligible: assessmentPurpose === "certification" && requestedReseller && isStructurallyResellerEligible({
        ownerType: "admin",
        certificationMode,
        visibility,
      }),
    } as Record<string, unknown>;

    // Publication implies approval. Deactivation is an operational unpublish
    // and does not erase an already-completed review.
    if (input.isActive === true) updates.reviewStatus = "approved";
    else if (existing.reviewStatus !== "approved") updates.reviewStatus = "draft";
    return updates;
  }

  if (existing.ownerType !== "creator" && existing.ownerType !== "institute") {
    throw new AdminCourseGovernanceError("This course has an unsupported owner type");
  }

  const safeCertification = thirdPartyCertificationModes[existing.ownerType].has(existing.certificationMode)
    ? existing.certificationMode
    : existing.ownerType;
  const visibility = input.visibility ?? existing.visibility;
  const {
    isActive: _ignoredActive,
    subscriptionEligible: _ignoredSubscription,
    resellerEligible: _ignoredReseller,
    ...contentUpdates
  } = input;

  // A material edit to third-party content always returns it to review. Admins
  // approve it with the dedicated, audited review endpoint below.
  return {
    ...contentUpdates,
    ownerType: existing.ownerType,
    ownerId: existing.ownerId,
    certificationMode: safeCertification,
    reviewStatus: visibility === "private" ? "draft" : "pending",
    isActive: false,
    subscriptionEligible: false,
    resellerEligible: false,
  };
}

export function buildThirdPartyCourseReview(
  existing: GovernedCourse,
  input: AdminCourseReviewInput,
) {
  if (existing.ownerType !== "creator" && existing.ownerType !== "institute") {
    throw new AdminCourseGovernanceError("Only creator or institute submissions use the review action");
  }
  if (input.status === "approved" && existing.visibility === "private") {
    throw new AdminCourseGovernanceError("A private draft must be submitted as public or unlisted before approval");
  }

  const safeCertification = thirdPartyCertificationModes[existing.ownerType].has(existing.certificationMode)
    ? existing.certificationMode
    : existing.ownerType;
  return {
    ownerType: existing.ownerType,
    ownerId: existing.ownerId,
    certificationMode: safeCertification,
    reviewStatus: input.status,
    isActive: input.status === "approved",
    subscriptionEligible: false,
    resellerEligible: false,
  };
}
