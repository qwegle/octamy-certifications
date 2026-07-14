import { describe, expect, it } from "@jest/globals";
import {
  PendingExamAccessError,
  assertPendingExamAccess,
  canAccessPendingExam,
  parseGuestExamIdentity,
  publicPendingCourseSnapshot,
} from "../../server/lib/pending-exam-access";

describe("pending exam result access", () => {
  it("binds authenticated attempts to the same learner account", () => {
    expect(canAccessPendingExam({ userId: 42 }, 42)).toBe(true);
    expect(canAccessPendingExam({ userId: 42 }, 7)).toBe(false);
    expect(canAccessPendingExam({ userId: 42 }, null)).toBe(false);
    expect(() => assertPendingExamAccess({ userId: 42 }, 7)).toThrow(PendingExamAccessError);
  });

  it("keeps guest bearer results available while validating guest identity", () => {
    expect(canAccessPendingExam({ userId: null }, null)).toBe(true);
    expect(parseGuestExamIdentity({
      userEmail: " Learner@Example.com ",
      userName: " Guest Learner ",
    })).toEqual(expect.objectContaining({
      success: true,
      data: { userEmail: "learner@example.com", userName: "Guest Learner" },
    }));
    expect(parseGuestExamIdentity({ userEmail: "not-email", userName: "G" }).success).toBe(false);
  });

  it("allowlists the course fields stored in a pending result", () => {
    const snapshot = publicPendingCourseSnapshot({
      id: 9,
      slug: "reasoning",
      title: "Reasoning",
      passingScore: 70,
      price: "199.00",
      originalPrice: "399.00",
      isOnSale: true,
      ownerType: "admin",
      subscriptionEligible: true,
      certificationMode: "octamy",
      reviewStatus: "approved",
      ownerId: 123,
    } as any);
    expect(snapshot).toEqual({
      id: 9,
      slug: "reasoning",
      title: "Reasoning",
      passingScore: 70,
      price: "199.00",
      originalPrice: "399.00",
      isOnSale: true,
      ownerType: "admin",
      subscriptionEligible: true,
      certificationMode: "octamy",
    });
    expect(snapshot).not.toHaveProperty("ownerId");
    expect(snapshot).not.toHaveProperty("reviewStatus");
  });
});
