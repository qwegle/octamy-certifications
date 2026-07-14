import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../lib/audit";
import { authenticateToken } from "../middleware/auth";
import { deletePendingExam, loadPendingExam } from "../utils/examState";
import { calculateExpiryDate, generateCertificateNumber, getBadgeFromScore } from "../utils";
import {
  certificates,
  courses,
  examAttempts,
  subscriptionBenefitUsages,
  subscriptions,
  users,
} from "@shared/schema";

const router = Router();
const BENEFIT_TYPE = "inhouse_assessment_credential";
const redeemSchema = z.object({
  tempExamId: z.string().trim().min(12).max(180).regex(/^temp_[A-Za-z0-9-]+$/),
}).strict();

type PendingExam = {
  userId: number | null;
  courseId: number;
  userEmail: string;
  userName: string;
  score: number;
  totalQuestions: number;
  answers: Record<string, number>;
  timeTaken: number;
  passed: boolean;
  mastered: boolean;
  sessionId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  tabSwitches?: number;
};

export function isLearnerSubscriptionCourseEligible(course: {
  ownerType: string;
  productType: string;
  isActive: boolean;
  visibility: string;
  reviewStatus: string;
  subscriptionEligible: boolean;
  certificationMode: string;
}) {
  return course.ownerType === "admin"
    && course.productType === "assessment"
    && course.isActive
    && course.visibility === "public"
    && course.reviewStatus === "approved"
    && course.subscriptionEligible
    && course.certificationMode === "octamy";
}

router.post("/subscriptions/learner/redeem", authenticateToken, async (req: Request, res: Response) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Use a valid assessment result" });

  const pending = await loadPendingExam<PendingExam>(parsed.data.tempExamId);
  if (!pending) return res.status(404).json({ message: "Assessment result not found or expired" });
  if (pending.userId !== req.user!.userId) {
    return res.status(403).json({ message: "This assessment result does not belong to your account" });
  }
  if (!pending.passed) return res.status(409).json({ message: "A passing result is required for a credential" });

  try {
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`subscription:${parsed.data.tempExamId}`}))`);

      const [subscription] = await tx.select().from(subscriptions).where(and(
        eq(subscriptions.ownerType, "learner"),
        eq(subscriptions.ownerId, req.user!.userId),
        eq(subscriptions.userId, req.user!.userId),
        eq(subscriptions.plan, "all_access"),
        eq(subscriptions.status, "active"),
        sql`(${subscriptions.renewsAt} IS NULL OR ${subscriptions.renewsAt} > NOW())`,
      )).orderBy(desc(subscriptions.createdAt)).limit(1);
      if (!subscription) return { kind: "subscription_required" as const };

      const [existingUsage] = await tx.select({
        certificateId: certificates.certificateId,
      }).from(subscriptionBenefitUsages)
        .innerJoin(certificates, eq(certificates.id, subscriptionBenefitUsages.certificateId))
        .where(and(
          eq(subscriptionBenefitUsages.benefitType, BENEFIT_TYPE),
          eq(subscriptionBenefitUsages.externalKey, parsed.data.tempExamId),
          eq(subscriptionBenefitUsages.userId, req.user!.userId),
        ));
      if (existingUsage) return { kind: "replayed" as const, certificateId: existingUsage.certificateId };

      const [course] = await tx.select().from(courses).where(eq(courses.id, pending.courseId));
      if (!course || !isLearnerSubscriptionCourseEligible(course)) {
        return { kind: "not_eligible" as const };
      }
      const [user] = await tx.select().from(users).where(eq(users.id, req.user!.userId));
      if (!user) return { kind: "user_missing" as const };

      const [attempt] = await tx.insert(examAttempts).values({
        userId: user.id,
        courseId: course.id,
        userEmail: user.email,
        userName: user.name,
        score: pending.score,
        totalQuestions: pending.totalQuestions,
        answers: pending.answers,
        timeTaken: pending.timeTaken,
        passed: true,
        mastered: pending.mastered,
        sessionId: pending.sessionId,
        ipAddress: pending.ipAddress || null,
        userAgent: pending.userAgent || null,
        tabSwitches: pending.tabSwitches || 0,
      }).onConflictDoNothing({ target: examAttempts.sessionId }).returning();

      if (!attempt) {
        const [existingAttempt] = await tx.select({ id: examAttempts.id })
          .from(examAttempts)
          .where(eq(examAttempts.sessionId, pending.sessionId));
        const [existingCertificate] = existingAttempt
          ? await tx.select({ certificateId: certificates.certificateId }).from(certificates)
              .where(eq(certificates.examAttemptId, existingAttempt.id))
          : [];
        return existingCertificate
          ? { kind: "already_issued" as const, certificateId: existingCertificate.certificateId }
          : { kind: "issuance_in_progress" as const };
      }

      const publicCertificateId = `OCT-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      const [certificate] = await tx.insert(certificates).values({
        certificateId: publicCertificateId,
        examAttemptId: attempt.id,
        courseId: course.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        courseTitle: course.title,
        score: pending.score,
        mastered: pending.mastered,
        expiresAt: calculateExpiryDate(),
        isPaid: true,
        isActive: true,
        paymentId: `subscription:${subscription.id}`,
        badge: getBadgeFromScore(pending.score),
        certificateNumber: generateCertificateNumber(),
        issuedBy: "Octamy Solutions Private Limited",
        certificationMode: "octamy",
        fundingSource: "learner_subscription",
        issuerSnapshot: {
          legalName: "Octamy Solutions Private Limited",
          mode: "octamy",
          courseId: course.id,
          courseTitle: course.title,
        },
      }).returning();

      await tx.insert(subscriptionBenefitUsages).values({
        subscriptionId: subscription.id,
        userId: user.id,
        courseId: course.id,
        certificateId: certificate.id,
        benefitType: BENEFIT_TYPE,
        externalKey: parsed.data.tempExamId,
      });
      return { kind: "issued" as const, certificateId: certificate.certificateId };
    });

    if (outcome.kind === "subscription_required") {
      return res.status(402).json({ message: "An active Learner All Access subscription is required", code: "LEARNER_SUBSCRIPTION_REQUIRED" });
    }
    if (outcome.kind === "not_eligible") {
      return res.status(409).json({ message: "This assessment is not included in Learner All Access", code: "ASSESSMENT_NOT_INCLUDED" });
    }
    if (outcome.kind === "user_missing") return res.status(401).json({ message: "User account not found" });
    if (outcome.kind === "issuance_in_progress") {
      return res.status(409).json({ message: "Credential issuance is already in progress. Refresh in a moment." });
    }

    await deletePendingExam(parsed.data.tempExamId).catch(() => undefined);
    await audit({
      action: "subscription.benefit.redeemed",
      userId: req.user!.userId,
      actorRole: "user",
      resourceType: "certificate",
      resourceId: outcome.certificateId,
      req,
      metadata: { benefitType: BENEFIT_TYPE, outcome: outcome.kind },
    });
    return res.status(outcome.kind === "issued" ? 201 : 200).json({
      ok: true,
      replayed: outcome.kind !== "issued",
      certificateId: outcome.certificateId,
      redirectTo: `/certificate/${outcome.certificateId}`,
    });
  } catch (error) {
    console.error("learner.subscription.redeem.error", error instanceof Error ? error.name : "UnknownError");
    return res.status(500).json({ message: "The subscription benefit could not be applied. No duplicate credential was created." });
  }
});

export default router;
