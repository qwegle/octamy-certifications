import { describe, expect, it } from "@jest/globals";
import { isResellerCourseEligible } from "../../server/lib/reseller-inventory";

const inHouseCourse = {
  ownerType: "admin",
  isActive: true,
  visibility: "public",
};

describe("reseller inventory policy", () => {
  it("permits active public Octamy inventory during the legacy rollout", () => {
    expect(isResellerCourseEligible(inHouseCourse)).toBe(true);
  });

  it.each(["creator", "institute"])("never permits %s-owned inventory", (ownerType) => {
    expect(isResellerCourseEligible({ ...inHouseCourse, ownerType })).toBe(false);
  });

  it("rejects inactive, private, and explicitly disabled inventory", () => {
    expect(isResellerCourseEligible({ ...inHouseCourse, isActive: false })).toBe(false);
    expect(isResellerCourseEligible({ ...inHouseCourse, visibility: "private" })).toBe(false);
    expect(isResellerCourseEligible({ ...inHouseCourse, resellerEligible: false })).toBe(false);
    expect(isResellerCourseEligible({ ...inHouseCourse, resellerEligible: true })).toBe(true);
  });
});
