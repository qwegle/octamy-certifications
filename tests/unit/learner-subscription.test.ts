import { describe, expect, it } from "@jest/globals";
import { isLearnerSubscriptionCourseEligible } from "../../server/routes/learnerSubscriptionRoutes";

const eligible = {
  ownerType: "admin",
  productType: "assessment",
  isActive: true,
  visibility: "public",
  reviewStatus: "approved",
  subscriptionEligible: true,
  certificationMode: "octamy",
};

describe("Learner All Access inventory policy", () => {
  it("includes only explicitly eligible Octamy in-house assessments", () => {
    expect(isLearnerSubscriptionCourseEligible(eligible)).toBe(true);
  });

  it.each([
    { ownerType: "creator" },
    { ownerType: "institute" },
    { productType: "video_course" },
    { isActive: false },
    { visibility: "private" },
    { reviewStatus: "pending" },
    { subscriptionEligible: false },
    { certificationMode: "creator" },
  ])("rejects inventory outside the commercial boundary: %o", (override) => {
    expect(isLearnerSubscriptionCourseEligible({ ...eligible, ...override })).toBe(false);
  });
});
