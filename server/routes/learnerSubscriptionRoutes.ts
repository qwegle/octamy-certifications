import { Router, type Request, type Response } from "express";
import { authenticateToken } from "../middleware/auth";

const router = Router();

export function isLearnerSubscriptionCourseEligible(course: {
  ownerType: string;
  productType: string;
  assessmentPurpose?: string | null;
  isActive: boolean;
  visibility: string;
  reviewStatus: string;
  subscriptionEligible: boolean;
  certificationMode: string;
}) {
  return course.ownerType === "admin"
    && course.productType === "assessment"
    && course.assessmentPurpose === "certification"
    && course.isActive
    && course.visibility === "public"
    && course.reviewStatus === "approved"
    && course.subscriptionEligible
    && course.certificationMode === "octamy";
}

router.post("/subscriptions/learner/redeem", authenticateToken, async (_req: Request, res: Response) => {
  // Learner subscription is now Practice Pass. It unlocks practice exams only and
  // must not fund recruiter-visible certification credentials.
  return res.status(409).json({
    message: "Practice Pass is for practice exams only. Certification credentials use direct activation, vouchers, or workspace sponsorship.",
    code: "PRACTICE_PASS_ONLY",
  });
});

export default router;
