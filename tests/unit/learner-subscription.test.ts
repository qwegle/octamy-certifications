import { describe, expect, it } from "@jest/globals";
import { isLearnerSubscriptionCourseEligible } from "../../server/routes/learnerSubscriptionRoutes";

const eligible = {
  ownerType: "admin",
  productType: "assessment",
  assessmentPurpose: "certification",
  isActive: true,
  visibility: "public",
  reviewStatus: "approved",
  subscriptionEligible: true,
  certificationMode: "octamy",
};

describe("legacy learner credential subscription policy", () => {
  it("does not include Practice Pass exams as credential-funded inventory", () => {
    expect(isLearnerSubscriptionCourseEligible({ ...eligible, assessmentPurpose: "practice", certificationMode: "none" })).toBe(false);
  });

  it("keeps the old helper limited to explicit certification inventory", () => {
    expect(isLearnerSubscriptionCourseEligible(eligible)).toBe(true);
  });

  it.each([
    { ownerType: "creator" },
    { ownerType: "institute" },
    { productType: "video_course" },
    { assessmentPurpose: "practice" },
    { isActive: false },
    { visibility: "private" },
    { reviewStatus: "pending" },
    { subscriptionEligible: false },
    { certificationMode: "creator" },
  ])("rejects inventory outside the commercial boundary: %o", (override) => {
    expect(isLearnerSubscriptionCourseEligible({ ...eligible, ...override })).toBe(false);
  });
});
