import { describe, expect, it } from "@jest/globals";
import {
  AdminCourseGovernanceError,
  adminCourseCreateSchema,
  adminCourseReviewSchema,
  adminCourseUpdateSchema,
  buildAdminOwnedCourseCreate,
  buildGovernedAdminCourseUpdate,
  buildThirdPartyCourseReview,
} from "../../server/lib/admin-course-governance";

const adminCourse = {
  ownerType: "admin",
  ownerId: null,
  price: "99.00",
  originalPrice: null,
  isOnSale: false,
  productType: "assessment",
  assessmentPurpose: "certification",
  visibility: "public",
  certificationMode: "octamy",
  reviewStatus: "draft",
  isActive: false,
  subscriptionEligible: false,
  resellerEligible: false,
};

const creatorCourse = {
  ...adminCourse,
  ownerType: "creator",
  ownerId: 42,
  certificationMode: "octamy_creator",
  reviewStatus: "pending",
};

const validCreate = {
  title: "Octamy Quantitative Reasoning",
  description: "A reviewed in-house quantitative reasoning assessment.",
  categoryId: 4,
  duration: 60,
};

describe("admin course governance", () => {
  it("rejects client-supplied ownership, issuer, and review fields", () => {
    const parsed = adminCourseCreateSchema.safeParse({
      ...validCreate,
      ownerType: "creator",
      ownerId: 999,
      certificationMode: "creator",
      reviewStatus: "approved",
    });
    expect(parsed.success).toBe(false);

    const update = adminCourseUpdateSchema.safeParse({ reviewStatus: "approved", ownerId: 999 });
    expect(update.success).toBe(false);
  });

  it("creates server-owned Octamy certification inventory and makes publication imply approval", () => {
    const parsed = adminCourseCreateSchema.parse({
      ...validCreate,
      isActive: true,
      subscriptionEligible: false,
      resellerEligible: true,
    });
    expect(buildAdminOwnedCourseCreate(parsed, "octamy-quantitative-reasoning")).toMatchObject({
      ownerType: "admin",
      ownerId: null,
      certificationMode: "octamy",
      assessmentPurpose: "certification",
      reviewStatus: "approved",
      isActive: true,
      subscriptionEligible: false,
      resellerEligible: true,
    });
  });

  it("allows Practice Pass inventory only for practice assessments", () => {
    const parsed = adminCourseCreateSchema.parse({
      ...validCreate,
      assessmentPurpose: "practice",
      isActive: true,
      subscriptionEligible: true,
      resellerEligible: true,
    });
    expect(buildAdminOwnedCourseCreate(parsed, "practice-assessment")).toMatchObject({
      ownerType: "admin",
      certificationMode: "none",
      assessmentPurpose: "practice",
      subscriptionEligible: true,
      resellerEligible: false,
    });
  });

  it("derives sale state from database pricing values", () => {
    const parsed = adminCourseCreateSchema.parse({
      ...validCreate,
      price: "99.00",
      originalPrice: "199.00",
      isOnSale: false,
    });
    expect(buildAdminOwnedCourseCreate(parsed, "sale-priced-assessment")).toMatchObject({
      price: "99.00",
      originalPrice: "199.00",
      isOnSale: true,
    });

    expect(() => buildGovernedAdminCourseUpdate(
      adminCourse,
      adminCourseUpdateSchema.parse({ originalPrice: "49.00" }),
    )).toThrow("Original/list price cannot be lower");
  });

  it("does not mark non-assessment or non-public items as subscription inventory", () => {
    const parsed = adminCourseCreateSchema.parse({
      ...validCreate,
      productType: "video_course",
      visibility: "unlisted",
      subscriptionEligible: true,
      resellerEligible: true,
    });
    expect(buildAdminOwnedCourseCreate(parsed, "video-course")).toMatchObject({
      subscriptionEligible: false,
      resellerEligible: false,
    });
  });

  it("repairs immutable identity when an admin-owned item is updated", () => {
    const updates = buildGovernedAdminCourseUpdate(
      { ...adminCourse, ownerId: 9, certificationMode: "creator" },
      adminCourseUpdateSchema.parse({ isActive: true, subscriptionEligible: true }),
    );
    expect(updates).toMatchObject({
      ownerType: "admin",
      ownerId: null,
      certificationMode: "octamy",
      reviewStatus: "approved",
      subscriptionEligible: false,
    });
  });

  it("returns edited creator content to review and never grants commercial flags", () => {
    const updates = buildGovernedAdminCourseUpdate(
      creatorCourse,
      adminCourseUpdateSchema.parse({
        title: "Revised creator assessment",
        isActive: true,
        subscriptionEligible: true,
        resellerEligible: true,
      }),
    );
    expect(updates).toMatchObject({
      ownerType: "creator",
      ownerId: 42,
      certificationMode: "octamy_creator",
      reviewStatus: "pending",
      isActive: false,
      subscriptionEligible: false,
      resellerEligible: false,
    });
  });

  it("uses a dedicated review decision to activate third-party submissions", () => {
    expect(buildThirdPartyCourseReview(creatorCourse, { status: "approved" })).toEqual({
      ownerType: "creator",
      ownerId: 42,
      certificationMode: "octamy_creator",
      reviewStatus: "approved",
      isActive: true,
      subscriptionEligible: false,
      resellerEligible: false,
    });
    expect(() => buildThirdPartyCourseReview(adminCourse, { status: "approved" }))
      .toThrow(AdminCourseGovernanceError);
    expect(() => buildThirdPartyCourseReview({ ...creatorCourse, visibility: "private" }, { status: "approved" }))
      .toThrow("must be submitted");
  });

  it("requires actionable feedback for rejection", () => {
    expect(adminCourseReviewSchema.safeParse({ status: "rejected" }).success).toBe(false);
    expect(adminCourseReviewSchema.safeParse({ status: "rejected", reason: "Add explanations." }).success).toBe(true);
  });
});
