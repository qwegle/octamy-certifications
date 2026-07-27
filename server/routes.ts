import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { assertStrongPassword } from "./lib/bcrypt-helper";
import { isLocked, recordFailure, recordSuccess } from "./lib/login-throttle";
import { z } from "zod";
import passport from "passport";
import { setupGoogleAuth } from "./google-auth";
import googleAuthRoutes from "./routes/google-auth-routes";
import { generateUniqueReferralCode } from "./utils/referralCodeGenerator";
import {
  insertUserSchema,
  insertExamAttemptSchema,
  insertCertificateSchema,
  insertSellerSchema,
  insertSaleSchema,
  insertWithdrawalRequestSchema,
  insertSponsorSchema,
  interviewQuestions,
  interviews,
  interviewResponses,
  users as usersTable,
  contactSubmissions,
  recruiters as recruitersTable,
  subscriptions,
  splitPayouts,
  courseEntitlements,
  payments as paymentsTable,
  certificates as certificatesTable,
  couponRedemptions,
  discountCoupons,
  sellers as sellersTable,
  sales as salesTable,
  referralClicks,
  creditTransactions,
  sponsors as sponsorsTable,
  categories as categoriesTable,
  courses as coursesTable,
  courseQuestionBlueprint,
  examAttempts as examAttemptsTable,
  questionBanks as questionBanksTable,
  questions as questionsTable,
  questionPackImportRuns,
} from "@shared/schema";
import { desc, and, eq, not, sql, or, ilike, count, inArray, isNotNull } from "drizzle-orm";
import { db, pool } from "./db";
import { audit } from "./lib/audit";
import { LearningPathController } from "./controllers/learningPathController";
import { payuMoneyService } from "./payumoney";
import {
  createCashfreeOrder,
  createCashfreeStatusToken,
  getDefaultPaymentGateway,
  normalizeCashfreePaymentStatus,
  publicPaymentStatus,
  verifyCashfreeStatusToken,
  verifyCashfreeWebhookSignature,
} from "./lib/cashfree";
import {
  getBadgeFromScore,
  generateCertificateNumber,
  calculateExpiryDate,
} from "./utils";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import apiRoutes from "./routes/index";
import certificateRoutes from "./routes/certificateRoutes";
import questionBanksRouter, { courseBlueprintRouter } from "./routes/question-banks";
import { assessmentRuntimeReviewEligibilitySql } from "./lib/question-review-policy";
import { emailService } from "./utils/emailService";
import { generateCertificateHTML } from "./utils/newCertificateGenerator";
import { Readable } from "stream";
import { evaluateAnswersWithAI } from "./utils/openai";
import {
  saveQuestionMapping,
  loadExamSession,
  commitPendingExamForSession,
  loadPendingExamBySessionId,
  savePendingExam,
  loadPendingExam,
  deletePendingExam,
  startExamStateCron,
} from "./utils/examState";
import { normalizeExamAnswers, scoreExam } from "./utils/examScoring";
import { isResellerCourseEligible } from "./lib/reseller-inventory";
import {
  CREDENTIAL_ACTIVATION_KIND,
  CredentialActivationError,
  activationMetadata,
  amountsMatch,
  finalizeCredentialActivation,
  getCredentialActivationContext,
  isCredentialActivationPayment,
  reserveCredentialActivationPayment,
} from "./lib/credential-activation";
import { isCredentialEligibleAssessment } from "./lib/certificate-policy";
import {
  CouponError,
  couponPaymentMetadata,
  recordCouponRedemption,
  resolveCouponQuote,
} from "./lib/coupons";
import {
  AdminCourseGovernanceError,
  adminCourseCreateSchema,
  adminCourseReviewSchema,
  adminCourseUpdateSchema,
  buildAdminOwnedCourseCreate,
  buildGovernedAdminCourseUpdate,
  buildThirdPartyCourseReview,
  slugifyCourseTitle,
} from "./lib/admin-course-governance";
import {
  PendingExamAccessError,
  assertPendingExamAccess,
  canAccessPendingExam,
  parseGuestExamIdentity,
  publicPendingCourseSnapshot,
} from "./lib/pending-exam-access";
import { buildExamReview } from "./lib/exam-review";
import {
  PUBLIC_EXAM_EVIDENCE_CONSENT_VERSION,
  PUBLIC_EXAM_SUBMISSION_GRACE_SECONDS,
  publicExamDeadline,
  publicExamSubmissionTiming,
} from "./lib/public-exam-attempt";
import { requiredQuestionInventory } from "./lib/assessment-bank-readiness";
import {
  AssessmentPublishReadinessError,
  assertAssessmentPublishReadiness,
  type AssessmentPublishCourseState,
  unpublishPublishedAssessmentsUsingBanks,
} from "./lib/assessment-publish-readiness";
import {
  RETIRED_AI_INTERVIEW_PATHS,
  retiredAiInterviewHandler,
} from "./lib/retired-ai-interview";
import {
  ASSESSMENT_HUB_PATH,
  canonicalPublicSlug,
  PUBLIC_ASSESSMENT_PRODUCT_TYPES,
  PRACTICE_HUB_PATH,
  publicAssessmentCategoryPath,
  publicAssessmentPath,
  publicPracticeCategoryPath,
  publicPracticePath,
  publicProductPath,
} from "@shared/public-assessment-routes";

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

interface SellerAuthenticatedRequest extends Request {
  seller?: {
    sellerId: number;
    email: string;
  };
}


const cashfreeStatusLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many payment status checks. Please wait and try again." },
});
const paymentCheckoutLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many checkout attempts. Please wait and try again." },
});
const publicExamStartLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many exam starts. Please wait before trying again." },
});
const JWT_SECRET = process.env.JWT_SECRET!;

function boundedPercent(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : fallback;
}

function publicExamResultResponse(tempExamId: string, examData: any) {
  const correctAnswers = Number.isInteger(examData.correctAnswers)
    ? examData.correctAnswers
    : Array.isArray(examData.review)
      ? examData.review.filter((item: any) => item?.isCorrect).length
      : Math.round((Number(examData.score || 0) / 100) * Number(examData.totalQuestions || 0));
  return {
    tempExamId,
    score: examData.score,
    passed: examData.passed,
    correctAnswers,
    totalQuestions: examData.totalQuestions,
    isRetake: Boolean(examData.isRetake),
    previousBestScore: Number(examData.previousBestScore || 0),
    passingThreshold: Number(examData.course?.passingScore || 0),
    recoveryEmailSent: Boolean(examData.recoveryEmailSent),
    resultExpiresAt: examData.resultExpiresAt,
    timedOut: Boolean(examData.timedOut),
    message: examData.passed
      ? `Congratulations! You passed with ${examData.score}%`
      : `You scored ${examData.score}%. You need at least ${examData.course?.passingScore}% to pass.`,
    redirectTo: `/exam-results-temp/${tempExamId}`,
  };
}

function publicPendingExamOwnerMatches(
  examData: any,
  requestUserId: number | null | undefined,
  requestEmail: string,
) {
  return examData?.userId != null
    ? examData.userId === requestUserId
    : String(examData?.userEmail || "").toLowerCase() === requestEmail.toLowerCase();
}

function boundedPublicExamTabSwitches(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0
    ? Math.min(Number(value), 10_000)
    : 0;
}

async function persistPracticeAttemptFromPending(examData: any) {
  if (examData?.assessmentPurpose !== "practice" || !Number.isInteger(examData?.userId)) return false;
  const inserted = await db.insert(examAttemptsTable).values({
    userId: examData.userId,
    courseId: examData.courseId,
    userEmail: examData.userEmail,
    userName: examData.userName,
    score: examData.score,
    totalQuestions: examData.totalQuestions,
    answers: examData.answers,
    timeTaken: examData.timeTaken,
    passed: examData.passed,
    mastered: examData.mastered,
    sessionId: examData.sessionId,
    ipAddress: examData.ipAddress || null,
    userAgent: examData.userAgent || null,
    tabSwitches: boundedPublicExamTabSwitches(examData.tabSwitches),
  }).onConflictDoNothing({ target: examAttemptsTable.sessionId }).returning({ id: examAttemptsTable.id });
  return inserted.length > 0;
}

async function uniqueAdminCourseSlug(value: string, excludeCourseId?: number) {
  const base = slugifyCourseTitle(value);
  for (let suffix = 0; suffix < 500; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base.slice(0, 210)}-${suffix + 1}`;
    const [existing] = await db.select({ id: coursesTable.id }).from(coursesTable).where(
      excludeCourseId
        ? and(eq(coursesTable.slug, candidate), not(eq(coursesTable.id, excludeCourseId)))
        : eq(coursesTable.slug, candidate),
    ).limit(1);
    if (!existing) return candidate;
  }
  throw new AdminCourseGovernanceError("Could not generate a unique course URL. Choose a more specific slug.");
}

async function isActiveAdminCategory(categoryId: number) {
  const [category] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(and(
    eq(categoriesTable.id, categoryId),
    eq(categoriesTable.isActive, true),
  )).limit(1);
  return Boolean(category);
}

async function getActiveLearnerPracticeSubscription(userId: number) {
  const [subscription] = await db.select({ id: subscriptions.id, plan: subscriptions.plan })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.ownerType, "learner"),
      eq(subscriptions.ownerId, userId),
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, "active"),
      sql`(${subscriptions.startsAt} IS NULL OR ${subscriptions.startsAt} <= NOW())`,
      sql`${subscriptions.renewsAt} IS NOT NULL AND ${subscriptions.renewsAt} > NOW()`,
    ))
    .orderBy(desc(subscriptions.renewsAt), desc(subscriptions.id))
    .limit(1);
  return subscription || null;
}

/**
 * Create the immutable revenue-allocation ledger once a gateway confirms a
 * paid credential or course-content purchase. Shipping is excluded.
 * Creator/institute and affiliate shares come out of the paid digital-product
 * amount; the platform receives only the
 * remainder, so the ledger can never allocate more than the customer paid.
 */
async function ensureRevenueSplits(input: {
  paymentId: number;
  courseId: number;
  certificateAmount: string | number;
  gatewayOrderId?: string | null;
  sellerCode?: string | null;
}) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.paymentId})`);
    const [existing] = await tx.select({ id: splitPayouts.id }).from(splitPayouts)
      .where(eq(splitPayouts.paymentId, input.paymentId)).limit(1);
    if (existing) return;

    const course = await storage.getCourse(input.courseId);
    if (!course) throw new Error(`Cannot allocate payment ${input.paymentId}: course not found`);
    const baseAmount = Math.max(0, Number(input.certificateAmount));
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) return;

    const ownerType = course.ownerType === 'creator' || course.ownerType === 'institute'
      ? course.ownerType
      : null;
    const ownerPercent = ownerType === 'creator'
      ? boundedPercent(process.env.CREATOR_REVENUE_SHARE_PERCENT, 80)
      : ownerType === 'institute'
        ? boundedPercent(process.env.INSTITUTE_REVENUE_SHARE_PERCENT, 80)
        : 0;
    const ownerAmount = ownerType && course.ownerId
      ? Math.round(baseAmount * ownerPercent) / 100
      : 0;

    let sellerId: number | null = null;
    let sellerAmount = 0;
    if (input.sellerCode) {
      const seller = await storage.getSellerByReferralCode(input.sellerCode);
      if (seller?.isApproved) {
        sellerId = seller.id;
        sellerAmount = Math.round(baseAmount * boundedPercent(seller.commissionRate, 10)) / 100;
      }
    }

    // Misconfigured percentages can never make the platform allocation
    // negative or cause the ledger total to exceed the paid product amount.
    const cappedOwner = Math.min(ownerAmount, baseAmount);
    const cappedSeller = Math.min(sellerAmount, Math.max(0, baseAmount - cappedOwner));
    const platformAmount = Math.max(0, Math.round((baseAmount - cappedOwner - cappedSeller) * 100) / 100);
    const values: Array<typeof splitPayouts.$inferInsert> = [];
    if (ownerType && course.ownerId && cappedOwner > 0) {
      values.push({
        paymentId: input.paymentId,
        cashfreeOrderId: input.gatewayOrderId ?? null,
        beneficiaryType: ownerType,
        beneficiaryId: course.ownerId,
        amount: cappedOwner.toFixed(2),
        status: 'settled',
      });
    }
    if (sellerId && cappedSeller > 0) {
      values.push({
        paymentId: input.paymentId,
        cashfreeOrderId: input.gatewayOrderId ?? null,
        beneficiaryType: 'seller',
        beneficiaryId: sellerId,
        amount: cappedSeller.toFixed(2),
        status: 'settled',
      });
    }
    if (platformAmount > 0) {
      values.push({
        paymentId: input.paymentId,
        cashfreeOrderId: input.gatewayOrderId ?? null,
        beneficiaryType: 'platform',
        beneficiaryId: null,
        amount: platformAmount.toFixed(2),
        status: 'settled',
      });
    }
    if (values.length) await tx.insert(splitPayouts).values(values);
  });
}

/** Transaction-scoped fulfillment helpers. Keep every durable effect of a
 * successful certificate payment in the same transaction as the locked local
 * payment reservation. */
async function ensureRevenueSplitsInTransaction(tx: any, input: {
  paymentId: number;
  courseId: number;
  certificateAmount: string | number;
  gatewayOrderId?: string | null;
  sellerCode?: string | null;
}) {
  const [existing] = await tx.select({ id: splitPayouts.id }).from(splitPayouts)
    .where(eq(splitPayouts.paymentId, input.paymentId)).limit(1);
  if (existing) return;

  const [course] = await tx.select().from(coursesTable)
    .where(eq(coursesTable.id, input.courseId)).limit(1);
  if (!course) throw new Error(`Cannot allocate payment ${input.paymentId}: course not found`);
  const baseAmount = Math.max(0, Number(input.certificateAmount));
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return;

  const ownerType = course.ownerType === "creator" || course.ownerType === "institute"
    ? course.ownerType
    : null;
  const ownerPercent = ownerType === "creator"
    ? boundedPercent(process.env.CREATOR_REVENUE_SHARE_PERCENT, 80)
    : ownerType === "institute"
      ? boundedPercent(process.env.INSTITUTE_REVENUE_SHARE_PERCENT, 80)
      : 0;
  const ownerAmount = ownerType && course.ownerId
    ? Math.round(baseAmount * ownerPercent) / 100
    : 0;

  let sellerId: number | null = null;
  let sellerAmount = 0;
  if (input.sellerCode) {
    const [seller] = await tx.select().from(sellersTable)
      .where(eq(sellersTable.referralCode, input.sellerCode)).limit(1);
    if (seller?.isApproved) {
      sellerId = seller.id;
      sellerAmount = Math.round(baseAmount * boundedPercent(seller.commissionRate, 10)) / 100;
    }
  }

  const cappedOwner = Math.min(ownerAmount, baseAmount);
  const cappedSeller = Math.min(sellerAmount, Math.max(0, baseAmount - cappedOwner));
  const platformAmount = Math.max(0, Math.round((baseAmount - cappedOwner - cappedSeller) * 100) / 100);
  const values: Array<typeof splitPayouts.$inferInsert> = [];
  if (ownerType && course.ownerId && cappedOwner > 0) values.push({
    paymentId: input.paymentId,
    cashfreeOrderId: input.gatewayOrderId ?? null,
    beneficiaryType: ownerType,
    beneficiaryId: course.ownerId,
    amount: cappedOwner.toFixed(2),
    status: "settled",
  });
  if (sellerId && cappedSeller > 0) values.push({
    paymentId: input.paymentId,
    cashfreeOrderId: input.gatewayOrderId ?? null,
    beneficiaryType: "seller",
    beneficiaryId: sellerId,
    amount: cappedSeller.toFixed(2),
    status: "settled",
  });
  if (platformAmount > 0) values.push({
    paymentId: input.paymentId,
    cashfreeOrderId: input.gatewayOrderId ?? null,
    beneficiaryType: "platform",
    beneficiaryId: null,
    amount: platformAmount.toFixed(2),
    status: "settled",
  });
  if (values.length) await tx.insert(splitPayouts).values(values);
}

async function recordCouponRedemptionInTransaction(tx: any, payment: any, userEmail: string) {
  const coupon = activationMetadata(payment.gatewayStatusRaw).coupon as Record<string, unknown> | undefined;
  const couponId = Number(coupon?.id);
  const courseId = Number(payment.courseId);
  const originalAmount = Number(coupon?.originalAmount);
  const discountAmount = Number(coupon?.discountAmount);
  const finalAmount = Number(coupon?.finalAmount);
  if (
    !Number.isInteger(couponId) || couponId <= 0 ||
    !Number.isInteger(courseId) || courseId <= 0 ||
    !Number.isFinite(originalAmount) || !Number.isFinite(discountAmount) || !Number.isFinite(finalAmount) ||
    originalAmount < 0 || discountAmount < 0 || finalAmount < 0 ||
    Math.abs(originalAmount - discountAmount - finalAmount) > 0.009
  ) return;
  const [created] = await tx.insert(couponRedemptions).values({
    couponId,
    userId: payment.userId || null,
    userEmail: userEmail.trim().toLowerCase(),
    courseId,
    paymentId: payment.id,
    externalKey: `payment:${payment.id}`,
    originalAmount: originalAmount.toFixed(2),
    discountAmount: discountAmount.toFixed(2),
    finalAmount: finalAmount.toFixed(2),
  }).onConflictDoNothing({ target: couponRedemptions.externalKey }).returning({ id: couponRedemptions.id });
  if (created) await tx.update(discountCoupons).set({
    redemptionCount: sql`${discountCoupons.redemptionCount} + 1`,
    updatedAt: new Date(),
  }).where(eq(discountCoupons.id, couponId));
}

async function recordSellerCommissionInTransaction(tx: any, input: {
  paymentId: number;
  sellerCode: string;
  courseId: number;
  certificateId: number;
  userId: number | null;
  amount: string | number;
}) {
  if (!input.sellerCode) return;
  const [seller] = await tx.select().from(sellersTable)
    .where(eq(sellersTable.referralCode, input.sellerCode)).limit(1);
  if (!seller?.isApproved) return;
  const amount = Number(input.amount);
  const commission = amount * boundedPercent(seller.commissionRate, 10) / 100;
  const [created] = await tx.insert(salesTable).values({
    sellerId: seller.id,
    courseId: input.courseId,
    certificateId: input.certificateId,
    amount: amount.toFixed(2),
    commission: commission.toFixed(2),
    referralCode: input.sellerCode,
    status: "completed",
  }).onConflictDoNothing({ target: salesTable.certificateId }).returning({ id: salesTable.id });
  if (!created) return;
  await tx.update(sellersTable).set({
    totalEarnings: sql`coalesce(${sellersTable.totalEarnings}::numeric, 0) + ${commission}`,
  }).where(eq(sellersTable.id, seller.id));
  if (input.userId) await tx.update(referralClicks).set({
    converted: true,
    conversionDate: new Date(),
    userId: input.userId,
  }).where(and(
    eq(referralClicks.referralCode, input.sellerCode),
    eq(referralClicks.courseId, input.courseId),
    eq(referralClicks.converted, false),
  ));
}

async function finalizePaidExamCertificate(input: {
  paymentId: number;
  transactionId: string;
  providerPaymentId: string;
  gateway: "cashfree" | "payumoney";
  gatewayStatusRaw: Record<string, unknown>;
  examData: any;
  sellerCode: string;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7201, ${input.paymentId})`);
    const [payment] = await tx.select().from(paymentsTable)
      .where(eq(paymentsTable.id, input.paymentId)).for("update").limit(1);
    if (!payment || payment.transactionId !== input.transactionId) {
      throw new Error("Payment reservation mismatch");
    }
    if (payment.status === "completed" && payment.certificateId) {
      const [certificate] = await tx.select().from(certificatesTable)
        .where(eq(certificatesTable.id, payment.certificateId)).limit(1);
      if (certificate) return { status: "already_completed" as const, certificate, payment };
    }
    if (
      payment.courseId !== input.examData.courseId ||
      !input.examData.passed ||
      !payment.courseId
    ) throw new Error("Payment assessment mismatch");
    const [course] = await tx.select().from(coursesTable)
      .where(eq(coursesTable.id, payment.courseId)).for("update").limit(1);
    if (!course || !isCredentialEligibleAssessment(course)) {
      throw new Error("Assessment is not credential eligible");
    }

    let [examAttempt] = input.examData.sessionId
      ? await tx.select().from(examAttemptsTable)
          .where(eq(examAttemptsTable.sessionId, input.examData.sessionId)).limit(1)
      : [];
    if (!examAttempt) [examAttempt] = await tx.insert(examAttemptsTable).values({
      userId: input.examData.userId,
      courseId: input.examData.courseId,
      userEmail: input.examData.userEmail,
      userName: input.examData.userName,
      score: input.examData.score,
      totalQuestions: input.examData.totalQuestions,
      answers: input.examData.answers,
      timeTaken: input.examData.timeTaken,
      passed: input.examData.passed,
      mastered: input.examData.mastered,
      sessionId: input.examData.sessionId,
      ipAddress: input.examData.ipAddress,
      userAgent: input.examData.userAgent,
      tabSwitches: input.examData.tabSwitches,
    }).returning();

    let [certificate] = await tx.select().from(certificatesTable)
      .where(eq(certificatesTable.examAttemptId, examAttempt.id)).limit(1);
    if (!certificate) [certificate] = await tx.insert(certificatesTable).values({
      certificateId: `OCT-${new Date().getFullYear()}-${String(input.examData.course.title).replace(/\s+/g, "").toUpperCase().slice(0, 3)}-${crypto.randomUUID()}`,
      examAttemptId: examAttempt.id,
      userId: input.examData.userId,
      courseId: input.examData.courseId,
      userEmail: input.examData.userEmail,
      userName: input.examData.userName,
      score: input.examData.score,
      courseTitle: input.examData.course.title,
      badge: getBadgeFromScore(input.examData.score),
      certificateNumber: generateCertificateNumber(),
      expiresAt: calculateExpiryDate(),
      isPaid: true,
      paymentId: input.providerPaymentId,
    }).returning();

    const mergedGatewayStatus = {
      ...activationMetadata(payment.gatewayStatusRaw),
      ...input.gatewayStatusRaw,
    };
    const [completedPayment] = await tx.update(paymentsTable).set({
      status: "completed",
      gateway: input.gateway,
      paymentMethod: input.gateway,
      certificateId: certificate.id,
      cashfreeOrderId: input.gateway === "cashfree" ? input.transactionId : payment.cashfreeOrderId,
      cashfreePaymentId: input.gateway === "cashfree" ? input.providerPaymentId : payment.cashfreePaymentId,
      razorpayOrderId: input.gateway === "payumoney" ? input.transactionId : payment.razorpayOrderId,
      razorpayPaymentId: input.gateway === "payumoney" ? input.providerPaymentId : payment.razorpayPaymentId,
      gatewayStatusRaw: mergedGatewayStatus,
    }).where(eq(paymentsTable.id, payment.id)).returning();

    await recordCouponRedemptionInTransaction(tx, payment, input.examData.userEmail);
    await ensureRevenueSplitsInTransaction(tx, {
      paymentId: payment.id,
      courseId: payment.courseId,
      certificateAmount: payment.certificateAmount,
      gatewayOrderId: input.transactionId,
      sellerCode: input.sellerCode,
    });
    await recordSellerCommissionInTransaction(tx, {
      paymentId: payment.id,
      sellerCode: input.sellerCode,
      courseId: payment.courseId,
      certificateId: certificate.id,
      userId: payment.userId,
      amount: payment.certificateAmount,
    });
    return { status: "completed" as const, certificate, payment: completedPayment };
  });
}

async function fulfillRecruiterCreditPayment(input: {
  paymentId: number;
  orderId: string;
  providerPaymentId: string;
  providerPayload: Record<string, unknown>;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7402, ${input.paymentId})`);
    const [payment] = await tx.select().from(paymentsTable)
      .where(eq(paymentsTable.id, input.paymentId)).for("update").limit(1);
    if (!payment || payment.transactionId !== input.orderId) throw new Error("Recruiter payment reservation mismatch");
    const metadata = activationMetadata(payment.gatewayStatusRaw);
    const recruiterId = Number(metadata.recruiterId);
    const credits = Number(metadata.credits);
    if (metadata.kind !== "recruiter_credits" || !Number.isInteger(recruiterId) || !Number.isInteger(credits) || credits <= 0) {
      throw new Error("Invalid recruiter credit reservation");
    }
    if (payment.status === "completed") return { status: "already_completed" as const };
    const [recruiter] = await tx.update(recruitersTable).set({
      creditsBalance: sql`${recruitersTable.creditsBalance} + ${credits}`,
      updatedAt: new Date(),
    }).where(and(eq(recruitersTable.id, recruiterId), eq(recruitersTable.isActive, true))).returning();
    if (!recruiter) throw new Error("Recruiter account is not active");
    await tx.insert(creditTransactions).values({
      recruiterId,
      type: "purchase",
      amount: credits.toFixed(2),
      description: `Credit purchase - Payment ID: ${input.orderId}`,
      externalReference: input.orderId,
      balanceAfter: recruiter.creditsBalance,
    });
    await tx.update(paymentsTable).set({
      status: "completed",
      gateway: "cashfree",
      paymentMethod: "cashfree",
      cashfreeOrderId: input.orderId,
      cashfreePaymentId: input.providerPaymentId,
      gatewayStatusRaw: { ...metadata, providerWebhook: input.providerPayload },
    }).where(eq(paymentsTable.id, payment.id));
    return { status: "credits_activated" as const };
  });
}

async function updateVerifiedSponsorPayment(responseData: Record<string, any>, outcome: "success" | "failed") {
  const sponsorId = Number(responseData.udf1);
  if (!Number.isInteger(sponsorId) || sponsorId <= 0 || typeof responseData.txnid !== "string") {
    throw new Error("Invalid sponsor payment reservation");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7501, ${sponsorId})`);
    const [sponsor] = await tx.select().from(sponsorsTable)
      .where(eq(sponsorsTable.id, sponsorId)).for("update").limit(1);
    if (
      !sponsor ||
      sponsor.transactionId !== responseData.txnid ||
      !amountsMatch(sponsor.amount, responseData.amount)
    ) throw new Error("Sponsor payment reservation mismatch");
    if (sponsor.paymentStatus === "success") return sponsor;
    const [updated] = await tx.update(sponsorsTable).set({
      paymentStatus: outcome,
      updatedAt: new Date(),
    }).where(and(
      eq(sponsorsTable.id, sponsor.id),
      eq(sponsorsTable.transactionId, responseData.txnid),
      eq(sponsorsTable.paymentStatus, "pending"),
    )).returning();
    return updated || sponsor;
  });
}

// Middleware to verify JWT token
const authenticateAdminToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Check for either isAdmin flag or role === 'admin'
    if (!decoded.isAdmin && decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Admin token verification error:", error);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err: any) {
    console.error("JWT verification error:", err);
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res
      .status(401)
      .json({ message: "Invalid token", code: "INVALID_TOKEN" });
  }
};

// Optional auth middleware
const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

// Seller authentication middleware
const authenticateSellerToken = async (
  req: SellerAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const sellerId = Number(decoded?.sellerId);
    const seller = Number.isInteger(sellerId) && sellerId > 0
      ? await storage.getSeller(sellerId)
      : null;
    if (!seller?.isActive) {
      return res.status(401).json({ message: "Seller account is inactive or unavailable" });
    }
    req.seller = { sellerId: seller.id, email: seller.email };
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

// Configure Cloudinary only if credentials are provided
// if (
//   process.env.CLOUDINARY_CLOUD_NAME &&
//   process.env.CLOUDINARY_API_KEY &&
//   process.env.CLOUDINARY_API_SECRET
// ) {
//   cloudinary.config({
// cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
// api_key: process.env.CLOUDINARY_API_KEY,
// api_secret: process.env.CLOUDINARY_API_SECRET,
//   });
// }

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for file uploads
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
// });

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize passport and Google OAuth
  app.use(passport.initialize());
  setupGoogleAuth();
  
  // Register Google OAuth routes
  app.use('/api', googleAuthRoutes);

  // SEO: 301 redirects from deprecated auth URLs to canonical SEO-clean routes.
  // Must be registered before the SPA fallback so fresh page loads land on the new URL.
  app.get('/auth', (_req, res) => res.redirect(301, '/login'));
  app.get('/seller-auth', (_req, res) => res.redirect(301, '/partners/login'));
  app.get('/recruiter/auth', (_req, res) => res.redirect(301, '/recruiter/login'));
  const redirectLegacyCourse = async (req: Request, res: Response) => {
    const course = await storage.getCourseBySlug(String(req.params.slug || "")).catch(() => undefined);
    const target = course
      ? publicProductPath(course.slug, course.productType)
      : publicAssessmentPath(req.params.slug);
    const queryIndex = req.originalUrl.indexOf("?");
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
    res.redirect(301, `${target}${query}`);
  };
  app.get('/course/:slug', redirectLegacyCourse);
  app.get('/courses/:slug', redirectLegacyCourse);

  // 410 Gone for the removed AI Interview feature. Any inline endpoint mounted
  // later in this file is intercepted here so the feature is fully unreachable
  // without having to surgically delete ~500 lines of legacy code below.
  app.all([...RETIRED_AI_INTERVIEW_PATHS], retiredAiInterviewHandler);

  // Background cleanup of expired exam_sessions / pending_exams rows
  if (process.env.NODE_ENV !== "test") {
    startExamStateCron();
  }
  
  // Initialize database if in development
  // Express defaults to development when NODE_ENV is unset. `npm run dev`
  // does not set NODE_ENV itself, so checking the raw environment variable
  // left a fresh local database empty and made the landing page look broken.
  if (app.get("env") === "development") {
    await seedDatabase();
  }

  app.post(
    "/api/admin/partners/:partner_id/approve",
    authenticateAdminToken,
    async (req: Request, res: Response) => {
      try {
        console.log("work");

        const { partner_id } = req.params;

        if (!partner_id) {
          return res.status(400).json({ message: "Partner ID is required" });
        }

        // Always use parameterized queries to prevent SQL injection
        const result = await pool.query(`SELECT * FROM sellers WHERE id = $1`, [
          partner_id,
        ]);

        const partner = result.rows[0];

        if (!partner) {
          return res.status(404).json({ message: "Partner not found" });
        }

        if (partner.is_approved) {
          return res.status(400).json({ message: "User is already a partner" });
        }

        await pool.query(
          `UPDATE sellers SET is_approved = true WHERE id = $1`,
          [partner_id]
        );

        res
          .status(200)
          .json({ message: "Partner approved successfully", partner_id });
      } catch (error) {
        console.error("Error approving partner:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  );

  // Admin login endpoint
  app.post("/api/admin/login", async (req: Request, res: Response) => {
    try {
      const password = req.body?.password;
      const email = String(req.body?.email || '').trim().toLowerCase();

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      const adminLock = isLocked('admin:' + email);
      if (adminLock.locked) {
        return res.status(429).json({ message: `Account locked. Try again in ${Math.ceil((adminLock.retryAfterSec || 0) / 60)} minutes.` });
      }

      // Find admin user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isAdmin) {
        recordFailure('admin:' + email);
        await audit({ action: 'admin.login', status: 'failure', actorEmail: email, req, metadata: { reason: 'no_admin' } });
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password,
        user.password || ""
      );
      if (!isValidPassword) {
        recordFailure('admin:' + email);
        await audit({ action: 'admin.login', status: 'failure', userId: user.id, actorEmail: email, req, metadata: { reason: 'bad_password' } });
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      recordSuccess('admin:' + email);
      // Generate JWT token with both isAdmin and role for compatibility
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          isAdmin: true,
          role: "admin",
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      await audit({ action: 'admin.login', userId: user.id, actorEmail: user.email, actorRole: 'admin', req });
      res.json({
        message: "Admin login successful",
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Direct seller authentication routes (bypass routing issues)
  app.post("/api/sellers/login", async (req: Request, res: Response) => {
    try {
      const password = req.body?.password;
      const email = String(req.body?.email || '').trim().toLowerCase();

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      }

      const seller = await storage.getSellerByEmail(email);
      if (!seller) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!seller.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const isValidPassword = await bcrypt.compare(password, seller.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!seller.isActive) {
        return res.status(401).json({ message: "Account is deactivated" });
      }

      const token = jwt.sign(
        { sellerId: seller.id, email: seller.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({
        message: "Login successful",
        token,
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings || "0",
          pendingEarnings: seller.pendingEarnings || "0",
        },
      });
    } catch (error: any) {
      console.error("Seller login error:", error);
      res.status(500).json({ message: "Login failed", error: error.message });
    }
  });

  app.post("/api/sellers/register", async (req: Request, res: Response) => {
    try {
      const { password, name, phone } = req.body;
      const email = String(req.body?.email || '').trim().toLowerCase();
      const acceptedAgreement = req.body.acceptedAgreement ?? req.body.agreementAccepted;

      if (!email || !password || !name) {
        return res
          .status(400)
          .json({ message: "Email, password, and name are required" });
      }

      // Compliance: every reseller must explicitly accept the agreement.
      // The client checkbox already gates the submit button; this is the
      // server-side enforcement + persistence required for legal record-keeping.
      if (!acceptedAgreement) {
        return res
          .status(400)
          .json({ message: "You must accept the Reseller / Affiliate Agreement to register." });
      }

      const existingSeller = await storage.getSellerByEmail(email);
      if (existingSeller) {
        return res
          .status(400)
          .json({ message: "Seller already exists with this email" });
      }

      try { assertStrongPassword(password); } catch (e: any) { return res.status(400).json({ message: e.message }); }
      const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);

      const seller = await storage.createSeller({
        email,
        password: hashedPassword,
        name,
        phone,
        isApproved: false, // Requires admin approval
        isActive: true,
        referralCode: await generateUniqueReferralCode(),
        agreementAccepted: true,
        agreementAcceptedAt: new Date(),
        agreementVersion: "v1.0-2026-05",
      });

      const token = jwt.sign(
        { sellerId: seller.id, email: seller.email },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        message: "Seller registered successfully",
        token,
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings || "0",
          pendingEarnings: seller.pendingEarnings || "0",
        },
      });
    } catch (error: any) {
      console.error("Seller registration error:", error);
      res
        .status(500)
        .json({ message: "Registration failed", error: error.message });
    }
  });

  // Direct seller dashboard route (bypass routing issues)
  app.get(
    "/api/sellers/dashboard",
    authenticateSellerToken,
    async (req: SellerAuthenticatedRequest, res: Response) => {
      try {
        const sellerId = req.seller?.sellerId;
        if (!sellerId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const seller = await storage.getSeller(sellerId);
        if (!seller) {
          return res.status(404).json({ message: "Seller not found" });
        }

        // Get successful payments (conversions) made through this seller's referral code
        const conversions = await storage.getSellerConversions(sellerId);
        const withdrawals = await storage.getWithdrawalsBySeller(sellerId);
        const clickAnalytics = await storage.getSellerClickAnalytics(sellerId);

        // Calculate totals based on actual conversions (sales)
        const totalConversions = conversions.length;
        const totalCommission = conversions.reduce(
          (sum: number, conv: any) => sum + parseFloat(conv.commissionAmount),
          0
        );
        const pendingWithdrawals = withdrawals
          .filter((w) => w.status === "pending")
          .reduce((sum, w) => sum + parseFloat(w.amount), 0);

        res.json({
          seller: {
            id: seller.id,
            email: seller.email,
            name: seller.name,
            isApproved: seller.isApproved,
            totalEarnings: seller.totalEarnings || "0.00",
            pendingEarnings: seller.pendingEarnings || "0.00",
          },
          totalConversions,
          totalCommission: totalCommission.toFixed(2),
          pendingWithdrawals: pendingWithdrawals.toFixed(2),
          recentSales: conversions.slice(0, 5).map((conv: any) => ({
            id: conv.id,
            courseTitle: conv.courseTitle,
            amount: conv.amount,
            commissionAmount: conv.commissionAmount,
            createdAt: conv.createdAt.toISOString(),
            status: "paid",
          })),
          withdrawalHistory: withdrawals.slice(0, 5).map((w) => ({
            id: w.id,
            amount: w.amount,
            status: w.status,
            createdAt: w.createdAt.toISOString(),
          })),
          clickAnalytics,
        });
      } catch (error: any) {
        console.error("Dashboard error:", error);
        res.status(500).json({ message: "Failed to fetch dashboard data" });
      }
    }
  );

  // Seller withdrawal request — client posts to /api/sellers/withdrawals
  app.post(
    "/api/sellers/withdrawals",
    authenticateSellerToken,
    async (req: SellerAuthenticatedRequest, res: Response) => {
      try {
        const sellerId = req.seller?.sellerId;
        if (!sellerId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const seller = await storage.getSeller(sellerId);
        if (!seller) {
          return res.status(404).json({ message: "Seller not found" });
        }

        const requestedAmount = parseFloat(req.body?.amount || "0");
        if (!requestedAmount || requestedAmount <= 0) {
          return res.status(400).json({ message: "Invalid withdrawal amount" });
        }
        if (requestedAmount < 500) {
          return res.status(400).json({ message: "Minimum withdrawal amount is ₹500" });
        }

        const availableEarnings = parseFloat(seller.totalEarnings || "0");
        if (requestedAmount > availableEarnings) {
          return res.status(400).json({ message: "Insufficient earnings for withdrawal" });
        }

        const withdrawalData = insertWithdrawalRequestSchema.parse({
          sellerId,
          amount: req.body.amount,
          upiId: req.body.upiId || null,
          bankAccountNumber: req.body.bankAccountNumber || null,
          ifscCode: req.body.ifscCode || null,
          accountHolderName: req.body.accountHolderName || null,
          status: "pending",
        });

        const withdrawal = await storage.createWithdrawalRequest(withdrawalData);

        return res.status(201).json({
          message: "Withdrawal request submitted successfully",
          withdrawal: {
            id: withdrawal.id,
            amount: withdrawal.amount,
            status: withdrawal.status,
            createdAt: withdrawal.createdAt?.toISOString() || new Date().toISOString(),
          },
        });
      } catch (error: any) {
        console.error("Withdrawal request error:", error);
        return res
          .status(500)
          .json({ message: "Failed to create withdrawal request", error: error.message });
      }
    }
  );

  // Recruiter endpoints are owned by routes/recruiterRoutes.ts and mounted once
  // through /api below. Keeping a second auth implementation here caused this
  // earlier handler to shadow validation and account-state checks in that router.

  // Rating endpoints
  app.post(
    "/api/ratings/:courseId",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const courseId = parseInt(req.params.courseId);
        const { rating, reviewText } = req.body;
        const userId = req.user!.userId;

        if (!rating || rating < 1 || rating > 5) {
          return res
            .status(400)
            .json({ message: "Rating must be between 1 and 5" });
        }

        // Check if user already rated this course
        const existingRating = await storage.getUserRating(userId, courseId);

        let result;
        if (existingRating) {
          result = await storage.updateRating(
            userId,
            courseId,
            rating,
            reviewText
          );
        } else {
          result = await storage.createRating({
            userId,
            courseId,
            rating,
            reviewText,
          });
        }

        res.json(result);
      } catch (error: any) {
        console.error("Rating submission error:", error);
        res.status(500).json({ message: "Failed to submit rating" });
      }
    }
  );

  app.get(
    "/api/ratings/user/:courseId",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const courseId = parseInt(req.params.courseId);
        const userId = req.user!.userId;

        const rating = await storage.getUserRating(userId, courseId);
        res.json(rating);
      } catch (error: any) {
        console.error("Get user rating error:", error);
        res.status(500).json({ message: "Failed to fetch user rating" });
      }
    }
  );

  app.get(
    "/api/ratings/aggregate/:courseId",
    async (req: Request, res: Response) => {
      try {
        const courseId = parseInt(req.params.courseId);
        const aggregate = await storage.getRatingAggregate(courseId);

        if (!aggregate) {
          // Return default values if no ratings exist
          return res.json({
            averageRating: "4.8",
            totalReviews: 0,
            rating1Count: 0,
            rating2Count: 0,
            rating3Count: 0,
            rating4Count: 0,
            rating5Count: 0,
          });
        }

        res.json(aggregate);
      } catch (error: any) {
        console.error("Get rating aggregate error:", error);
        res.status(500).json({ message: "Failed to fetch rating aggregate" });
      }
    }
  );

  app.get(
    "/api/ratings/reviews/:courseId",
    async (req: Request, res: Response) => {
      try {
        const courseId = parseInt(req.params.courseId);
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const reviews = await storage.getCourseRatings(courseId, limit, offset);
        res.json(reviews);
      } catch (error: any) {
        console.error("Get course reviews error:", error);
        res.status(500).json({ message: "Failed to fetch reviews" });
      }
    }
  );

  // Add missing seller routes AFTER API routes to ensure they are properly registered
  app.get(
    "/api/sellers/shareable-items",
    authenticateSellerToken,
    async (req: SellerAuthenticatedRequest, res: Response) => {
      try {
        const sellerId = req.seller?.sellerId;
        if (!sellerId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const seller = await storage.getSeller(sellerId);
        if (!seller?.isActive || !seller.isApproved) {
          return res.status(403).json({
            message: "An approved, active reseller account is required to access inventory.",
          });
        }

        // Resellers may distribute Octamy in-house inventory only.
        const courses = await storage.getAllCourses();
        const eligibleCourses = courses.filter(isResellerCourseEligible);

        const shareableItems = {
          courses: eligibleCourses.map((course) => ({
            id: course.id,
            title: course.title,
            description: course.description,
            price: course.price,
            originalPrice: course.originalPrice,
            category: course.category,
          })),
        };

        res.json(shareableItems);
      } catch (error: any) {
        console.error("Shareable items error:", error);
        res.status(500).json({ message: "Failed to fetch shareable items" });
      }
    }
  );

  app.post(
    "/api/sellers/generate-referral-url",
    authenticateSellerToken,
    async (req: SellerAuthenticatedRequest, res: Response) => {
      try {
        const sellerId = req.seller?.sellerId;
        if (!sellerId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const { type, itemId, courseId } = req.body;
        const targetCourseId = courseId || itemId;

        // Get seller to get referral code
        const seller = await storage.getSeller(sellerId);
        if (!seller) {
          return res.status(404).json({ message: "Seller not found" });
        }
        if (!seller.isActive || !seller.isApproved) {
          return res.status(403).json({
            message: "Your reseller account must be approved and active before sharing inventory.",
          });
        }
        if (!seller.referralCode) {
          return res.status(409).json({ message: "A referral code has not been assigned to this reseller yet." });
        }

        // Get course details to use slug instead of ID
        const parsedCourseId = Number(targetCourseId);
        if (!Number.isInteger(parsedCourseId) || parsedCourseId <= 0) {
          return res.status(400).json({ message: "Use a valid course identifier" });
        }
        const course = await storage.getCourse(parsedCourseId);
        if (!course || !isResellerCourseEligible(course)) {
          return res.status(404).json({ message: "Eligible Octamy course not found" });
        }

        // Generate referral URL using slug
        const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
        const referralUrl = `${baseUrl}${publicProductPath(course.slug, course.productType)}?ref=${encodeURIComponent(seller.referralCode)}`;

        res.json({
          referralUrl,
          referralCode: seller.referralCode,
        });
      } catch (error: any) {
        console.error("Generate referral URL error:", error);
        res.status(500).json({ message: "Failed to generate referral URL" });
      }
    }
  );

  // Registration endpoint - support both /api/register and /api/auth/register for compatibility
  const registerHandler = async (req: Request, res: Response) => {
    try {
      const { name, password, phone } = req.body;
      const email = String(req.body?.email || '').trim().toLowerCase();

      if (!name || !email || !password) {
        return res
          .status(400)
          .json({ message: "Name, email, and password are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      try { assertStrongPassword(password); } catch (e: any) { return res.status(400).json({ message: e.message }); }
      const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
      });

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          isAdmin: user.isAdmin || false,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      await audit({ action: 'auth.register', userId: user.id, actorEmail: user.email, actorRole: 'user', req });
      res.status(201).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin || false,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      await audit({ action: 'auth.register', status: 'failure', actorEmail: req.body?.email, req, metadata: { error: String(error) } });
      res.status(500).json({ message: "Registration failed" });
    }
  };

  app.post("/api/register", registerHandler);
  app.post("/api/auth/register", registerHandler);

  // Login endpoint - support both /api/login and /api/auth/login for compatibility
  const loginHandler = async (req: Request, res: Response) => {
    try {
      const password = req.body?.password;
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email || typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const lock = isLocked(email);
      if (lock.locked) {
        return res.status(429).json({ message: `Account locked due to failed login attempts. Try again in ${Math.ceil((lock.retryAfterSec || 0) / 60)} minutes.` });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        recordFailure(email);
        await audit({ action: 'auth.login', status: 'failure', actorEmail: email, req, metadata: { reason: 'no_user' } });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.password) {
        recordFailure(email);
        await audit({ action: 'auth.login', status: 'failure', userId: user.id, actorEmail: email, req, metadata: { reason: 'no_password' } });
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        recordFailure(email);
        await audit({ action: 'auth.login', status: 'failure', userId: user.id, actorEmail: email, req, metadata: { reason: 'bad_password' } });
        return res.status(401).json({ message: "Invalid credentials" });
      }

      recordSuccess(email);
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          isAdmin: user.isAdmin || false,
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      await audit({ action: 'auth.login', userId: user.id, actorEmail: user.email, actorRole: user.isAdmin ? 'admin' : 'user', req });
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin || false,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  };

  app.post("/api/login", loginHandler);
  app.post("/api/auth/login", loginHandler);

  // Logout route
  app.post("/api/logout", (req: Request, res: Response) => {
    res.json({ message: "Logout successful" });
  });

  app.get(
    "/api/user",
    authenticateToken,
    async (req: AuthenticatedRequest, res) => {
      try {
        const user = await storage.getUser(req.user!.userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin || false,
        });
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch user" });
      }
    }
  );

  // Import and mount user profile routes
  try {
    const { default: userProfileRoutes } = await import(
      "./routes/userProfileRoutes"
    );
    app.use("/api/user", userProfileRoutes);
    console.log("User profile routes mounted successfully");
  } catch (error) {
    console.error("Failed to load user profile routes:", error);
  }

  // Canonical public certification URLs. Keep assessment-era links working
  // for existing bookmarks and search indexes while consolidating ranking
  // signals on the outcome-led /get-certified hierarchy.
  const redirectAssessmentPath = (req: Request, res: Response, pathname: string) => {
    const queryIndex = req.originalUrl.indexOf("?");
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
    res.redirect(301, `${pathname}${query}`);
  };
  app.get("/exams", (req, res) => redirectAssessmentPath(req, res, ASSESSMENT_HUB_PATH));
  app.get("/skill-verification", (req, res) => redirectAssessmentPath(req, res, ASSESSMENT_HUB_PATH));
  app.get("/assessments", (req, res) => redirectAssessmentPath(req, res, ASSESSMENT_HUB_PATH));
  app.get("/assessments/categories/:slug", (req, res) => redirectAssessmentPath(
    req,
    res,
    publicAssessmentCategoryPath(req.params.slug),
  ));
  app.get("/assessments/:slug", (req, res) => redirectAssessmentPath(
    req,
    res,
    publicAssessmentPath(req.params.slug),
  ));
  app.get("/exam/:slug", (req, res) => redirectAssessmentPath(
    req,
    res,
    publicAssessmentPath(req.params.slug),
  ));
  app.get("/category/:slug", (req, res) => redirectAssessmentPath(
    req,
    res,
    publicAssessmentCategoryPath(req.params.slug),
  ));

  // Public XML sitemap (SEO). Generated from DB on every request — small enough.
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const base = (process.env.APP_URL || "https://octamy.com").replace(/\/+$/, "");
      const today = new Date().toISOString().slice(0, 10);
      const staticUrls: Array<{ path: string; priority: string }> = [
        { path: "", priority: "1.0" },
        { path: ASSESSMENT_HUB_PATH, priority: "0.9" },
        { path: PRACTICE_HUB_PATH, priority: "0.7" },
        { path: "/creator-assessments", priority: "0.8" },
        { path: "/courses", priority: "0.9" },
        { path: "/virtual-internships", priority: "0.9" },
        { path: "/business-certifications", priority: "0.8" },
        { path: "/learning-paths", priority: "0.7" },
        { path: "/partners", priority: "0.8" },
        { path: "/creator", priority: "0.8" },
        { path: "/institute", priority: "0.8" },
        { path: "/for-recruiters", priority: "0.8" },
        { path: "/pricing", priority: "0.8" },
        { path: "/sponsor", priority: "0.6" },
        { path: "/about", priority: "0.7" },
        { path: "/vision", priority: "0.7" },
        { path: "/contact", priority: "0.6" },
        { path: "/help-center", priority: "0.5" },
        { path: "/verify", priority: "0.5" },
        { path: "/trust", priority: "0.4" },
        { path: "/privacy-policy", priority: "0.3" },
        { path: "/terms-of-service", priority: "0.3" },
        { path: "/refund-policy", priority: "0.3" },
        { path: "/cookie-policy", priority: "0.3" },
        { path: "/acceptable-use", priority: "0.3" },
        { path: "/disclaimer", priority: "0.3" },
        { path: "/reseller-agreement", priority: "0.3" },
        { path: "/accessibility", priority: "0.3" },
      ];
      const allCourses = await storage.getCourses().catch(() => []);
      const allCategories = await storage.getCategories().catch(() => []);
      const categoryById = new Map((allCategories as any[]).map((category) => [category.id, category]));
      const certificationCategoryIds = new Set<number>();
      const practiceCategoryIds = new Set<number>();
      const publicCourses = (allCourses as any[]).filter((course) => canonicalPublicSlug(course.slug));
      const assessmentCourses = publicCourses.filter((course) => (
        PUBLIC_ASSESSMENT_PRODUCT_TYPES.includes(course.productType)
      ));

      for (const course of assessmentCourses) {
        if (course.ownerType !== "admin") continue;
        const targetSet = course.assessmentPurpose === "practice" ? practiceCategoryIds : certificationCategoryIds;
        let categoryId = Number(course.categoryId || course.category?.id);
        const visited = new Set<number>();
        while (Number.isInteger(categoryId) && categoryId > 0 && !visited.has(categoryId)) {
          visited.add(categoryId);
          targetSet.add(categoryId);
          const category = categoryById.get(categoryId);
          categoryId = Number(category?.parentId);
        }
      }

      const urls: Array<{ loc: string; priority: string; freq: string }> = [];
      for (const u of staticUrls) {
        urls.push({ loc: `${base}${u.path}`, priority: u.priority, freq: "weekly" });
      }
      for (const c of publicCourses) {
        const path = PUBLIC_ASSESSMENT_PRODUCT_TYPES.includes(c.productType)
          ? c.assessmentPurpose === "practice"
            ? publicPracticePath(c.slug)
            : publicAssessmentPath(c.slug)
          : publicProductPath(c.slug, c.productType);
        urls.push({ loc: `${base}${path}`, priority: c.assessmentPurpose === "practice" ? "0.6" : "0.8", freq: "weekly" });
      }
      for (const cat of allCategories as any[]) {
        if (!canonicalPublicSlug(cat.slug)) continue;
        if (certificationCategoryIds.has(cat.id)) {
          urls.push({ loc: `${base}${publicAssessmentCategoryPath(cat.slug)}`, priority: "0.6", freq: "weekly" });
        }
        if (practiceCategoryIds.has(cat.id)) {
          urls.push({ loc: `${base}${publicPracticeCategoryPath(cat.slug)}`, priority: "0.4", freq: "weekly" });
        }
      }

      const xmlEscape = (value: string) => value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;");

      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map(
            (u) =>
              `  <url><loc>${xmlEscape(u.loc)}</loc><lastmod>${today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`,
          )
          .join("\n") +
        `\n</urlset>\n`;

      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (error) {
      console.error("sitemap generation failed", error);
      res.status(500).send("sitemap unavailable");
    }
  });

  // Categories and courses
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const idParam = String(req.params.id);
      // Graceful fallback: if frontend passes a slug here, look it up by slug.
      const isNumeric = /^\d+$/.test(idParam);
      const course = isNumeric
        ? await storage.getCourse(parseInt(idParam, 10))
        : await storage.getCourseBySlug(idParam);
      if (!course || !course.isActive || course.visibility !== "public" || course.reviewStatus !== "approved" || course.ownerType === "institute") {
        return res.status(404).json({ message: "Course not found" });
      }
      if (course.productType === "assessment" && !course.useBlueprintEngine) {
        return res.status(409).json({
          message: "This assessment is still being prepared in its reviewed question-bank blueprint.",
          code: "ASSESSMENT_BANK_NOT_READY",
        });
      }
      res.json(course);
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.get("/api/courses/slug/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;

      // Check if slug is actually a numeric ID (common mistake)
      if (/^\d+$/.test(slug)) {
        const course = await storage.getCourse(parseInt(slug));
        if (!course || !course.isActive || course.visibility !== "public" || course.reviewStatus !== "approved" || course.ownerType === "institute") {
          return res.status(404).json({ message: "Course not found" });
        }
        // Get full course with category for consistency
        const fullCourse = await storage.getCourseBySlug(course.slug);
        return res.json(fullCourse || course);
      }

      const course = await storage.getCourseBySlug(slug);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      console.error("Error fetching course by slug:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  // Exam routes
  app.post("/api/courses/:id/questions", publicExamStartLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const courseId = Number(req.params.id);
      if (!Number.isInteger(courseId) || courseId <= 0) {
        return res.status(400).json({ message: "Invalid course ID" });
      }
      const course = await storage.getCourse(courseId);
      if (!course || !course.isActive || course.visibility !== "public" || course.reviewStatus !== "approved" || course.ownerType === "institute") {
        return res.status(404).json({ message: "Course not found" });
      }
      const isPracticeAssessment = course.assessmentPurpose === "practice";
      if (!isPracticeAssessment) {
        const evidenceConsent = z.object({ evidenceConsent: z.literal(true) }).safeParse(req.body);
        if (!evidenceConsent.success) {
          return res.status(400).json({
            message: "Confirm the disclosed browser-integrity evidence policy before starting the exam.",
            code: "EVIDENCE_CONSENT_REQUIRED",
          });
        }
      }
      if (isPracticeAssessment) {
        if (!req.user?.userId) {
          return res.status(401).json({
            message: "Sign in and activate Practice Pass to start this practice exam",
            code: "PRACTICE_SUBSCRIPTION_REQUIRED",
          });
        }
        const subscription = await getActiveLearnerPracticeSubscription(req.user.userId);
        if (!subscription) {
          return res.status(402).json({
            message: "Practice exams require an active Practice Pass",
            code: "PRACTICE_SUBSCRIPTION_REQUIRED",
          });
        }
      }
      if (course.useBlueprintEngine) {
        const purpose = course.assessmentPurpose === "practice" ? "practice" : "certification";
        const blueprint = await storage.getCourseBlueprint(courseId);
        if (!blueprint.length) {
          return res.status(409).json({
            message: "This assessment is still being prepared.",
            code: "ASSESSMENT_BANK_NOT_READY",
          });
        }
        const [{ mismatchedBanks }] = await db.select({ mismatchedBanks: count() })
          .from(courseQuestionBlueprint)
          .innerJoin(
            questionBanksTable,
            eq(questionBanksTable.id, courseQuestionBlueprint.bankId),
          )
          .where(and(
            eq(courseQuestionBlueprint.courseId, courseId),
            sql`(
              ${questionBanksTable.bankPurpose} IS DISTINCT FROM ${purpose}
              OR ${questionBanksTable.status} <> 'active'
            )`,
          ));
        if (Number(mismatchedBanks) > 0) {
          return res.status(409).json({
            message: "This assessment has an inactive or purpose-incompatible question bank.",
            code: "ASSESSMENT_BANK_NOT_READY",
          });
        }
        for (const rule of blueprint) {
          const filters = [
            eq(questionsTable.bankId, rule.bankId),
            eq(questionsTable.isActive, true),
            eq(questionsTable.reviewStatus, "approved"),
            assessmentRuntimeReviewEligibilitySql(),
            sql`${questionsTable.questionFormat} IN ('mcq_single', 'true_false')`,
            sql`json_typeof(${questionsTable.options}) = 'array'`,
            sql`${questionsTable.correctAnswer} >= 0`,
            sql`${questionsTable.correctAnswer} < json_array_length(${questionsTable.options})`,
          ];
          if (rule.topicId) filters.push(eq(questionsTable.topicId, rule.topicId));
          if (rule.difficulty !== "mixed") filters.push(eq(questionsTable.difficulty, rule.difficulty));
          const [{ available }] = await db.select({ available: count() })
            .from(questionsTable)
            .where(and(...filters));
          const ruleRequired = rule.questionCount * (purpose === "practice" ? 5 : 4);
          if (Number(available) < ruleRequired) {
            return res.status(409).json({
              message: "This assessment is being expanded and reviewed.",
              code: "ASSESSMENT_BANK_NOT_READY",
              required: ruleRequired,
              available: Number(available),
            });
          }
        }
        const bankIds = Array.from(new Set(blueprint.map((rule) => rule.bankId)));
        const [{ available: totalAvailable }] = await db.select({ available: count() })
          .from(questionsTable)
          .where(and(
            inArray(questionsTable.bankId, bankIds),
            eq(questionsTable.isActive, true),
            eq(questionsTable.reviewStatus, "approved"),
            assessmentRuntimeReviewEligibilitySql(),
            sql`${questionsTable.questionFormat} IN ('mcq_single', 'true_false')`,
            sql`json_typeof(${questionsTable.options}) = 'array'`,
            sql`${questionsTable.correctAnswer} >= 0`,
            sql`${questionsTable.correctAnswer} < json_array_length(${questionsTable.options})`,
            sql`EXISTS (
              SELECT 1
              FROM ${courseQuestionBlueprint} scoped_rule
              WHERE scoped_rule.course_id = ${courseId}
                AND scoped_rule.bank_id = ${questionsTable.bankId}
                AND (scoped_rule.topic_id IS NULL OR scoped_rule.topic_id = ${questionsTable.topicId})
                AND (scoped_rule.difficulty = 'mixed' OR scoped_rule.difficulty = ${questionsTable.difficulty})
            )`,
          ));
        const required = requiredQuestionInventory(
          purpose,
          blueprint.reduce((total, rule) => total + rule.questionCount, 0),
        );
        if (Number(totalAvailable) < required) {
          return res.status(409).json({
            message: `This assessment is being expanded and reviewed. ${required} approved questions are required before attempts can start.`,
            code: "ASSESSMENT_BANK_NOT_READY",
            required,
            available: Number(totalAvailable),
          });
        }
      }
      const questions = course.useBlueprintEngine
        ? await storage.materializeBlueprintForAttempt(courseId)
        : await storage.getQuestionsByCourse(courseId);

      if (questions.length === 0) {
        return res.status(409).json({ message: "This assessment has no published questions yet." });
      }

      // Use Fisher-Yates shuffle for proper randomization
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Blueprint-backed assessments already encode the exact topic and
      // difficulty quotas. Legacy assessments retain their historical 10–15
      // item sampling until they are migrated to a reviewed bank blueprint.
      const questionCount = course.useBlueprintEngine
        ? questions.length
        : Math.floor(Math.random() * 6) + 10;
      const limitedQuestions = shuffled.slice(
        0,
        Math.min(questionCount, questions.length)
      );

      // Shuffle options within each question and track correct answer
      const questionsWithShuffledOptions = limitedQuestions.map((q) => {
        const originalOptions = [...q.options];
        const correctAnswerText = originalOptions[q.correctAnswer];

        // Shuffle options
        const shuffledOptions = [...q.options];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledOptions[i], shuffledOptions[j]] = [
            shuffledOptions[j],
            shuffledOptions[i],
          ];
        }

        // Find new position of correct answer
        const newCorrectAnswer = shuffledOptions.findIndex(
          (option) => option === correctAnswerText
        );

        return {
          id: q.id,
          question: q.question,
          options: shuffledOptions,
          correctAnswer: newCorrectAnswer,
        };
      });

      // Persist the question mapping (replaces in-memory global.questionMappings)
      // Always issue the session ID server-side to prevent session fixation or
      // one candidate overwriting another candidate's answer mapping.
      const finalSessionId = `session_${crypto.randomUUID()}`;
      const correctMap = questionsWithShuffledOptions.reduce(
        (acc: Record<string, number>, q) => {
          acc[String(q.id)] = q.correctAnswer;
          return acc;
        },
        {},
      );
      const sessionStartedAt = new Date();
      const sessionTiming = await db.transaction(async (tx) => {
        if (course.productType === "assessment") {
          // Lock content before the course to match the question-withdrawal
          // lock order. Either the attempt snapshots content that is valid now,
          // or it waits for withdrawal and fails closed.
          const selectedIds = questionsWithShuffledOptions.map((question) => question.id);
          const lockedQuestions = await tx.select({ id: questionsTable.id })
            .from(questionsTable)
            .where(and(
              inArray(questionsTable.id, selectedIds),
              eq(questionsTable.isActive, true),
              eq(questionsTable.reviewStatus, "approved"),
              assessmentRuntimeReviewEligibilitySql(),
              sql`${questionsTable.questionFormat} IN ('mcq_single', 'true_false')`,
              sql`json_typeof(${questionsTable.options}) = 'array'`,
              sql`${questionsTable.correctAnswer} >= 0`,
              sql`${questionsTable.correctAnswer} < json_array_length(${questionsTable.options})`,
            ))
            .orderBy(questionsTable.id)
            .for("share");
          if (lockedQuestions.length !== selectedIds.length) {
            throw new AssessmentPublishReadinessError(
              "This assessment's reviewed question pool changed before the attempt could start.",
            );
          }
          const [lockedCourse] = await tx.select({
            isActive: coursesTable.isActive,
            visibility: coursesTable.visibility,
            reviewStatus: coursesTable.reviewStatus,
            useBlueprintEngine: coursesTable.useBlueprintEngine,
          }).from(coursesTable)
            .where(eq(coursesTable.id, courseId))
            .for("share");
          if (
            !lockedCourse?.isActive
            || lockedCourse.visibility !== "public"
            || lockedCourse.reviewStatus !== "approved"
            || !lockedCourse.useBlueprintEngine
          ) {
            throw new AssessmentPublishReadinessError(
              "This assessment is no longer available for a new attempt.",
            );
          }
        }
        return saveQuestionMapping(finalSessionId, correctMap, courseId, {
          questionSnapshot: questionsWithShuffledOptions,
          createdAt: sessionStartedAt,
          evidenceConsentAt: isPracticeAssessment ? undefined : sessionStartedAt,
          evidenceConsentVersion: isPracticeAssessment ? undefined : PUBLIC_EXAM_EVIDENCE_CONSENT_VERSION,
          userId: req.user?.userId ?? null,
          // Retain a short recovery window after the authoritative deadline. The
          // submission route still rejects answer payloads after deadline grace.
          ttlMs: Math.max(1, course.duration) * 60_000 + 15 * 60_000,
        });
      });

      // Remove correct answers from response
      const questionsWithoutAnswers = questionsWithShuffledOptions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
      }));

      res.json({
        questions: questionsWithoutAnswers,
        sessionId: finalSessionId,
        startedAt: sessionTiming.createdAt.toISOString(),
        deadlineAt: publicExamDeadline(sessionTiming.createdAt, course.duration).toISOString(),
        proctorMode: isPracticeAssessment ? "none" : "browser_evidence",
        evidenceConsentVersion: isPracticeAssessment ? null : PUBLIC_EXAM_EVIDENCE_CONSENT_VERSION,
      });
    } catch (error) {
      console.error("Error fetching questions:", error);
      if (error instanceof Error && (
        error.message === "Course has no blueprint configured"
        || /^Topic \d+ has only \d+ /.test(error.message)
      )) {
        return res.status(409).json({
          message: "This assessment's reviewed question pool is not ready yet.",
          code: "ASSESSMENT_QUESTION_POOL_NOT_READY",
        });
      }
      if (error instanceof AssessmentPublishReadinessError) {
        return res.status(409).json({
          message: error.message,
          code: error.code,
        });
      }
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // EXAM SUBMISSION ENDPOINT - PAYMENT-FIRST APPROACH
  // Certification results use an expiring Postgres handoff until credential
  // activation; subscribed practice results are persisted immediately.
  app.post(
    "/api/exam/submit",
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          courseId,
          answers,
          userEmail,
          userName,
          sessionId,
          tabSwitches,
        } = req.body;
        const numericCourseId = Number(courseId);
        if (!sessionId || typeof sessionId !== "string" ||
            !Number.isInteger(numericCourseId) || numericCourseId <= 0) {
          return res.status(400).json({ message: "Valid course and exam session are required" });
        }

        let effectiveUserEmail: string;
        let effectiveUserName: string;
        if (req.user?.userId) {
          const authenticatedUser = await storage.getUser(req.user.userId);
          if (!authenticatedUser) {
            return res.status(401).json({ message: "Your account could not be verified" });
          }
          effectiveUserEmail = authenticatedUser.email;
          effectiveUserName = authenticatedUser.name || authenticatedUser.email.split("@")[0];
        } else {
          const guestIdentity = parseGuestExamIdentity({ userEmail, userName });
          if (!guestIdentity.success) {
            return res.status(400).json({
              message: "Enter a valid learner name and email before submitting",
              errors: guestIdentity.error.flatten().fieldErrors,
            });
          }
          effectiveUserEmail = guestIdentity.data.userEmail;
          effectiveUserName = guestIdentity.data.userName;
        }

        // A network retry after the first successful commit must replay the
        // original result instead of creating a second payable assessment.
        const previousPending = await loadPendingExamBySessionId<any>(sessionId, numericCourseId);
        if (previousPending) {
          const pendingOwnerMatches = publicPendingExamOwnerMatches(
            previousPending.payload,
            req.user?.userId,
            effectiveUserEmail,
          );
          if (!pendingOwnerMatches) {
            return res.status(403).json({ message: "This assessment session belongs to another learner" });
          }
          const restoredPracticeAttempt = await persistPracticeAttemptFromPending(previousPending.payload);
          if (restoredPracticeAttempt) {
            await audit({
              action: "practice_exam.completed",
              userId: previousPending.payload.userId,
              actorRole: "learner",
              resourceType: "course",
              resourceId: numericCourseId,
              req,
              metadata: { score: previousPending.payload.score, passed: previousPending.payload.passed, replayRecovery: true },
            });
          }
          return res.json(publicExamResultResponse(previousPending.id, previousPending.payload));
        }

        // Get correct answers from persisted session mapping
        const examSession = await loadExamSession(sessionId, numericCourseId);
        const correctAnswersMapping = examSession?.correctMap || {};

        console.log(
          `Exam submission for session ${sessionId} — questions in session: ${Object.keys(correctAnswersMapping).length}`,
        );

        // Safety check: Ensure we have questions to evaluate
        if (!examSession || Object.keys(correctAnswersMapping).length === 0) {
          console.warn(`No question mappings found for session ${sessionId}`);
          return res.status(400).json({
            message:
              "Exam session expired or invalid. Please restart the exam.",
            code: "SESSION_EXPIRED",
          });
        }
        if (examSession.userId != null && examSession.userId !== req.user?.userId) {
          return res.status(403).json({ message: "This assessment session belongs to another learner" });
        }

        const course = await storage.getCourse(numericCourseId);
        if (!course || !course.isActive || course.visibility !== "public" || course.reviewStatus !== "approved") {
          return res.status(404).json({ message: "Course not found" });
        }
        const isPracticeExam = course.assessmentPurpose === "practice";
        let practiceSubscriptionId: number | null = null;
        if (isPracticeExam) {
          if (!req.user?.userId) {
            return res.status(401).json({
              message: "Sign in and activate Practice Pass to submit this practice exam",
              code: "PRACTICE_SUBSCRIPTION_REQUIRED",
            });
          }
          const subscription = await getActiveLearnerPracticeSubscription(req.user.userId);
          if (!subscription) {
            return res.status(402).json({
              message: "Practice exams require an active Practice Pass",
              code: "PRACTICE_SUBSCRIPTION_REQUIRED",
            });
          }
          practiceSubscriptionId = subscription.id;
        }

        const submissionTiming = publicExamSubmissionTiming(examSession.createdAt, course.duration);
        if (submissionTiming.deadlineExceeded) {
          return res.status(409).json({
            message: "This exam's server-authoritative submission window has closed.",
            code: "SESSION_EXPIRED",
          });
        }
        const finalTimeTaken = submissionTiming.elapsedSeconds;

        const answersRecord = normalizeExamAnswers(answers);
        const { correctAnswers, totalQuestions, score } = scoreExam(
          correctAnswersMapping,
          answersRecord,
        );
        const review = buildExamReview(examSession?.questionSnapshot || [], answersRecord);

        // EXAM PASSING LOGIC:
        // Use the course's defined passing score (e.g., 60% for Demo Course)
        const passingScore = course.passingScore;
        const passed = score >= passingScore;
        let isRetake = false;
        let previousBestScore = 0;

        // Check if user has taken this exam before (for reference only - not saved)
        if (req.user?.userId) {
          const previousAttempts = await storage.getExamAttemptsByUserAndCourse(
            req.user.userId,
            numericCourseId
          );

          if (previousAttempts.length > 0) {
            isRetake = true;
            // Find the highest score from previous attempts
            previousBestScore = Math.max(
              ...previousAttempts.map((attempt: any) => attempt.score)
            );
          }
        }

        // Mastery is achieved at 90% regardless of attempt number
        const mastered = score >= 90;

        // Persist exam data until payment completion (replaces in-memory global.tempExamData).
        const tempExamId = `temp_${crypto.randomUUID()}`;
        const resultExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const pendingExamPayload = {
          userId: req.user?.userId || null,
          courseId: numericCourseId,
          userEmail: effectiveUserEmail,
          userName: effectiveUserName,
          score,
          correctAnswers,
          totalQuestions,
          answers: answersRecord,
          timeTaken: finalTimeTaken,
          passed,
          mastered,
          sessionId,
          ipAddress: req.ip || req.connection?.remoteAddress,
          userAgent: req.get("User-Agent"),
          tabSwitches: boundedPublicExamTabSwitches(tabSwitches),
          isRetake,
          previousBestScore,
          course: publicPendingCourseSnapshot(course),
          assessmentPurpose: course.assessmentPurpose,
          needsPayment: !isPracticeExam,
          review,
          evidenceConsentAt: examSession.evidenceConsentAt?.toISOString() || null,
          evidenceConsentVersion: examSession.evidenceConsentVersion,
          startedAt: submissionTiming.startedAt.toISOString(),
          deadlineAt: submissionTiming.deadlineAt.toISOString(),
          timedOut: Date.now() > submissionTiming.deadlineAt.getTime(),
          resultExpiresAt,
          recoveryEmailSent: false,
          createdAt: new Date(),
        };
        const committed = await commitPendingExamForSession({
          sessionId,
          courseId: numericCourseId,
          pendingExamId: tempExamId,
          payload: pendingExamPayload,
          submissionClosesAt: new Date(
            submissionTiming.deadlineAt.getTime() + PUBLIC_EXAM_SUBMISSION_GRACE_SECONDS * 1000,
          ),
        });
        if (!committed) {
          return res.status(409).json({
            message: "This exam session was already submitted or expired.",
            code: "SESSION_EXPIRED",
          });
        }
        if (!publicPendingExamOwnerMatches(committed.payload, req.user?.userId, effectiveUserEmail)) {
          return res.status(403).json({ message: "This assessment session belongs to another learner" });
        }

        if (isPracticeExam) {
          const insertedAttempt = await persistPracticeAttemptFromPending(committed.payload);
          if (insertedAttempt) {
            await audit({
              action: "practice_exam.completed",
              userId: committed.payload.userId as number,
              actorRole: "learner",
              resourceType: "course",
              resourceId: numericCourseId,
              req,
              metadata: {
                score: committed.payload.score,
                passed: committed.payload.passed,
                subscriptionId: practiceSubscriptionId,
              },
            });
          }
        }

        if (!committed.replayed && !req.user?.userId && !isPracticeExam) {
          const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
          const resultPath = `/exam-results-temp/${committed.id}`;
          const resultLink = `${baseUrl}${resultPath}`;
          const registerLink = `${baseUrl}/register?role=learner&email=${encodeURIComponent(effectiveUserEmail)}&next=${encodeURIComponent(resultPath)}`;
          const recoveryEmailSent = await emailService.sendGuestExamRecoveryEmail({
            userEmail: effectiveUserEmail,
            userName: effectiveUserName,
            courseTitle: course.title,
            score,
            resultLink,
            registerLink,
          });
          committed.payload.recoveryEmailSent = recoveryEmailSent;
          await savePendingExam(committed.id, committed.payload);
        }

        res.json(publicExamResultResponse(committed.id, committed.payload));
      } catch (error) {
        console.error("Error submitting exam:", error);
        res.status(500).json({ message: "Failed to submit exam" });
      }
    }
  );

  // Temporary exam results endpoint - shows results without saving to database
  app.get(
    "/api/exam-results-temp/:tempExamId",
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { tempExamId } = req.params;

        // Read from the persistent pending-exam store (matches savePendingExam in /api/exam/submit)
        const examData = await loadPendingExam(tempExamId);

        if (!examData) {
          return res
            .status(404)
            .json({ message: "Exam results not found or expired" });
        }

        if (!canAccessPendingExam(examData, req.user?.userId)) {
          return res.status(403).json({ message: "This assessment result belongs to another account" });
        }

        // Return exam results for display without database persistence
        res.json({
          tempExamId,
          score: examData.score,
          passed: examData.passed,
          correctAnswers: Number.isInteger(examData.correctAnswers)
            ? examData.correctAnswers
            : Math.round((examData.score / 100) * examData.totalQuestions),
          totalQuestions: examData.totalQuestions,
          course: publicPendingCourseSnapshot(examData.course),
          assessmentPurpose: examData.assessmentPurpose || examData.course?.assessmentPurpose || "certification",
          timeTaken: examData.timeTaken,
          timedOut: Boolean(examData.timedOut),
          mastered: examData.mastered,
          isRetake: examData.isRetake,
          previousBestScore: examData.previousBestScore,
          review: Array.isArray(examData.review) ? examData.review : [],
          isGuest: examData.userId == null,
          maskedEmail: typeof examData.userEmail === "string"
            ? examData.userEmail.replace(/^(.)(.*)(@.*)$/, (_match: string, first: string, middle: string, domain: string) => `${first}${"*".repeat(Math.min(6, middle.length))}${domain}`)
            : undefined,
          resultExpiresAt: examData.resultExpiresAt,
          recoveryEmailSent: Boolean(examData.recoveryEmailSent),
          message: examData.passed
            ? `Congratulations! You passed with ${examData.score}%`
            : `You scored ${examData.score}%. You need at least ${examData.course.passingScore}% to pass.`,
          needsPayment: examData.needsPayment !== false,
        });
      } catch (error) {
        console.error("Error fetching temporary exam results:", error);
        res.status(500).json({ message: "Failed to fetch exam results" });
      }
    }
  );

  const credentialActivationRequestSchema = z.object({
    certificateId: z.string().trim().min(6).max(180),
    userPhone: z.string().trim().max(30).optional(),
    sellerCode: z.string().trim().max(80).optional().default(""),
    includesPhysicalCopy: z.boolean().optional().default(false),
    selectedAddressId: z.number().int().positive().nullable().optional().default(null),
  });

  const initiateCredentialActivation = async (
    req: AuthenticatedRequest,
    res: Response,
  ) => {
    let reservedPaymentId: number | null = null;
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          message: "Sign in to activate a credential",
          code: "AUTH_REQUIRED",
        });
      }
      const parsed = credentialActivationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Credential activation request is invalid",
          code: "INVALID_ACTIVATION_REQUEST",
        });
      }

      const payload = parsed.data;
      const context = await getCredentialActivationContext(
        payload.certificateId,
        req.user.userId,
      );
      if (context.certificate.isPaid) {
        return res.status(409).json({
          message: "This credential is already activated",
          code: "ALREADY_ACTIVATED",
        });
      }
      if (!context.certificate.isActive) {
        return res.status(409).json({
          message: "A revoked credential cannot be activated",
          code: "CREDENTIAL_REVOKED",
        });
      }

      let selectedAddress = null;
      if (payload.includesPhysicalCopy) {
        if (!payload.selectedAddressId) {
          return res.status(400).json({
            message: "Choose a shipping address for the physical certificate",
            code: "SHIPPING_ADDRESS_REQUIRED",
          });
        }
        const addresses = await storage.getUserAddresses(context.user.id);
        selectedAddress = addresses.find(
          (address) => address.id === payload.selectedAddressId,
        ) || null;
        if (!selectedAddress) {
          return res.status(404).json({
            message: "Shipping address was not found in your account",
            code: "SHIPPING_ADDRESS_NOT_FOUND",
          });
        }
      }

      const customerPhone =
        context.user.phone ||
        selectedAddress?.phoneNumber ||
        payload.userPhone ||
        "9999999999";
      const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
      const defaultGateway = getDefaultPaymentGateway();

      if (defaultGateway === "cashfree") {
        const orderId = `CF_ACT_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const payment = await reserveCredentialActivationPayment({
          context,
          transactionId: orderId,
          gateway: "cashfree",
          includesPhysicalCopy: payload.includesPhysicalCopy,
          selectedAddressId: payload.selectedAddressId,
          sellerCode: payload.sellerCode,
        });
        reservedPaymentId = payment.id;

        try {
          const order = await createCashfreeOrder({
            orderId,
            amount: payment.amount,
            customerId: `oct_user_${context.user.id}`,
            customerName: context.user.name,
            customerEmail: context.user.email,
            customerPhone,
            returnUrl: `${baseUrl}/payment-success?order_id=${encodeURIComponent(orderId)}`,
            notifyUrl: `${baseUrl}/api/webhooks/cashfree`,
            notes: {
              kind: CREDENTIAL_ACTIVATION_KIND,
              paymentDbId: String(payment.id),
              certificateId: context.certificate.certificateId,
              courseId: String(context.course.id),
              userId: String(context.user.id),
            },
          });
          const metadata = activationMetadata(payment.gatewayStatusRaw);
          await storage.updatePayment(payment.id, {
            cashfreeOrderId: order.orderId,
            gatewayStatusRaw: {
              ...metadata,
              providerOrder: order.raw,
            },
          } as any);
          await audit({
            action: "credential.activation.checkout_started",
            userId: context.user.id,
            resourceType: "certificate",
            resourceId: context.certificate.id,
            req,
            metadata: { gateway: "cashfree", paymentId: payment.id },
          });
          return res.json({
            success: true,
            gateway: "cashfree",
            orderId: order.orderId,
            transactionId: order.orderId,
            amount: payment.amount,
            currency: payment.currency,
            paymentSessionId: order.paymentSessionId,
            paymentLink: order.paymentLink,
            statusToken: createCashfreeStatusToken(order.orderId),
          });
        } catch (cashfreeError) {
          const metadata = activationMetadata(payment.gatewayStatusRaw);
          await storage.updatePayment(payment.id, {
            status: "failed",
            gatewayStatusRaw: {
              ...metadata,
              reason: "provider_order_creation_failed",
            },
          } as any);
          reservedPaymentId = null;
          console.error("Cashfree credential activation init failed; trying PayU", cashfreeError);
        }
      }

      const transactionId = payuMoneyService.generateTransactionId();
      const payment = await reserveCredentialActivationPayment({
        context,
        transactionId,
        gateway: "payumoney",
        includesPhysicalCopy: payload.includesPhysicalCopy,
        selectedAddressId: payload.selectedAddressId,
        sellerCode: payload.sellerCode,
      });
      reservedPaymentId = payment.id;
      const paymentForm = payuMoneyService.generatePaymentForm({
        txnid: transactionId,
        amount: payment.amount,
        productinfo: payload.includesPhysicalCopy
          ? `${context.course.title} - Credential activation (Digital + Physical)`
          : `${context.course.title} - Credential activation`,
        firstname: context.user.name,
        email: context.user.email,
        phone: customerPhone,
        surl: `${baseUrl}/api/payment/success`,
        furl: `${baseUrl}/api/payment/failure`,
        udf1: String(context.course.id),
        udf2: String(payment.id),
        udf3: payload.sellerCode,
        udf4: String(context.user.id),
        udf5: `credential:${context.certificate.certificateId}`,
      });
      await audit({
        action: "credential.activation.checkout_started",
        userId: context.user.id,
        resourceType: "certificate",
        resourceId: context.certificate.id,
        req,
        metadata: { gateway: "payumoney", paymentId: payment.id },
      });
      return res.json({
        success: true,
        gateway: "payumoney",
        paymentForm,
        transactionId,
        amount: payment.amount,
        currency: payment.currency,
      });
    } catch (error) {
      if (reservedPaymentId) {
        const payment = await storage.getPayment(reservedPaymentId).catch(() => undefined);
        if (payment?.status === "pending") {
          const metadata = activationMetadata(payment.gatewayStatusRaw);
          await storage.updatePayment(reservedPaymentId, {
            status: "failed",
            gatewayStatusRaw: { ...metadata, reason: "checkout_initialization_failed" },
          } as any).catch(() => undefined);
        }
      }
      if (error instanceof CredentialActivationError) {
        return res.status(error.statusCode).json({
          message: error.message,
          code: error.code,
        });
      }
      console.error("Credential activation checkout failed", error);
      return res.status(503).json({
        message: "Secure checkout is temporarily unavailable. Please try again shortly.",
        code: "CHECKOUT_UNAVAILABLE",
      });
    }
  };

  const createCashfreeCertificateOrder = async (
    req: AuthenticatedRequest,
    payload: {
      tempExamId: string;
      userPhone?: string;
      sellerCode?: string;
      couponCode?: string;
      includesPhysicalCopy?: boolean;
      selectedAddressId?: number | null;
    }
  ) => {
    const examData = await loadPendingExam<any>(payload.tempExamId);
    if (!examData) {
      throw new Error("Exam data not found or expired. Please retake the assessment.");
    }
    assertPendingExamAccess(examData, req.user?.userId);
    if (!examData.passed) {
      throw new Error("Exam not passed");
    }

    const course = await storage.getCourse(examData.courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    if (!isCredentialEligibleAssessment(course)) {
      throw new CredentialActivationError(
        "Practice and unavailable assessments cannot create credential payment orders",
        409,
        "ASSESSMENT_NOT_CREDENTIAL_ELIGIBLE",
      );
    }

    const includesPhysicalCopy = Boolean(payload.includesPhysicalCopy);
    const couponQuote = payload.couponCode?.trim()
      ? await resolveCouponQuote({
          code: payload.couponCode,
          courseId: examData.courseId,
          userId: examData.userId,
          userEmail: examData.userEmail,
        })
      : null;
    const baseAmount = couponQuote ? Number(couponQuote.finalAmount) : parseFloat(course.price);
    const shippingCost = includesPhysicalCopy ? 50 : 0;
    const totalAmount = (baseAmount + shippingCost).toFixed(2);

    const orderId = `CF_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payment = await storage.createPayment({
      userId: examData.userId || null,
      courseId: examData.courseId,
      transactionId: orderId,
      gateway: "cashfree",
      paymentMethod: "cashfree",
      amount: totalAmount,
      certificateAmount: baseAmount.toFixed(2),
      shippingAmount: shippingCost.toFixed(2),
      includesPhysicalCopy,
      currency: "INR",
      status: "pending",
      cashfreeOrderId: orderId,
      gatewayStatusRaw: {
        tempExamId: payload.tempExamId,
        sellerCode: payload.sellerCode || "",
        selectedAddressId: payload.selectedAddressId || null,
        ...couponPaymentMetadata(couponQuote),
      },
    } as any);

    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");
    let order;
    try {
      order = await createCashfreeOrder({
        orderId,
        amount: totalAmount,
        customerId: `oct_user_${examData.userId || "guest"}`,
        customerName: examData.userName || "Octamy User",
        customerEmail: examData.userEmail,
        customerPhone: payload.userPhone || "9999999999",
        returnUrl: `${baseUrl}/payment-success?order_id=${orderId}`,
        notifyUrl: `${baseUrl}/api/webhooks/cashfree`,
        notes: {
          paymentDbId: String(payment.id),
          courseId: String(examData.courseId),
          tempExamId: payload.tempExamId,
          sellerCode: payload.sellerCode || "",
          userId: examData.userId ? String(examData.userId) : "",
        },
      });
    } catch (providerError) {
      const paymentMetadata = (payment.gatewayStatusRaw || {}) as Record<string, unknown>;
      await storage.updatePayment(payment.id, {
        status: "failed",
        gatewayStatusRaw: { ...paymentMetadata, reason: "provider_order_creation_failed" },
      } as any).catch(() => undefined);
      throw providerError;
    }

    const paymentMetadata = (payment.gatewayStatusRaw || {}) as Record<string, unknown>;
    await storage.updatePayment(payment.id, {
      cashfreeOrderId: order.orderId,
      gatewayStatusRaw: { ...paymentMetadata, providerOrder: order.raw },
    } as any);

    return {
      paymentDbId: payment.id,
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      paymentLink: order.paymentLink,
      statusToken: createCashfreeStatusToken(order.orderId),
      amount: totalAmount,
    };
  };

  // Initialize payment (Cashfree default, PayU fallback) - PAYMENT-FIRST APPROACH
  app.post(
    "/api/payment/initiate",
    paymentCheckoutLimiter,
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      if (req.body?.certificateId) {
        return initiateCredentialActivation(req, res);
      }
      try {
        const defaultGateway = getDefaultPaymentGateway();
        if (defaultGateway === "cashfree") {
          const {
            tempExamId,
            userPhone,
            sellerCode,
            couponCode,
            includesPhysicalCopy = false,
            selectedAddressId = null,
          } = req.body;

          if (!tempExamId) {
            return res.status(400).json({ message: "Temporary exam ID is required" });
          }

          try {
            const order = await createCashfreeCertificateOrder(req, {
              tempExamId,
              userPhone,
              sellerCode,
              couponCode,
              includesPhysicalCopy,
              selectedAddressId,
            });

            return res.json({
              success: true,
              gateway: "cashfree",
              orderId: order.orderId,
              transactionId: order.orderId,
              amount: order.amount,
              paymentSessionId: order.paymentSessionId,
              paymentLink: order.paymentLink,
              statusToken: order.statusToken,
            });
          } catch (cashfreeError) {
            if (cashfreeError instanceof CredentialActivationError) {
              return res.status(cashfreeError.statusCode).json({ message: cashfreeError.message, code: cashfreeError.code });
            }
            if (cashfreeError instanceof PendingExamAccessError) {
              return res.status(cashfreeError.statusCode).json({ message: cashfreeError.message });
            }
            if (cashfreeError instanceof CouponError) {
              return res.status(cashfreeError.statusCode).json({ message: cashfreeError.message });
            }
            console.error("Cashfree init failed, falling back to PayU:", cashfreeError);
          }
        }

        const {
          tempExamId, // Use temporary exam ID instead of certificate ID
          courseId,
          userEmail,
          userName,
          userPhone,
          sellerCode,
          couponCode,
          includesPhysicalCopy = false,
          selectedAddressId = null,
          amount,
        } = req.body;

        if (!tempExamId) {
          return res
            .status(400)
            .json({ message: "Temporary exam ID is required" });
        }

        // Try to get persisted exam data
        let examData = await loadPendingExam<any>(tempExamId);

        if (!examData) {
          // No reconstruction fallback. We never invent exam data — that would
          // let any user with an unknown tempExamId obtain a free certificate
          // for an arbitrary course they never passed.
          return res
            .status(404)
            .json({ message: "Exam data not found or expired. Please retake the assessment." });
        }


        try {
          assertPendingExamAccess(examData, req.user?.userId);
        } catch (error) {
          if (error instanceof PendingExamAccessError) {
            return res.status(error.statusCode).json({ message: error.message });
          }
          throw error;
        }

        if (!examData.passed) {
          return res.status(400).json({ message: "Exam not passed" });
        }

        const course = await storage.getCourse(examData.courseId);
        if (!course) {
          return res.status(404).json({ message: "Course not found" });
        }
        if (!isCredentialEligibleAssessment(course)) {
          return res.status(409).json({
            message: "Practice and unavailable assessments cannot create credential payment orders",
            code: "ASSESSMENT_NOT_CREDENTIAL_ELIGIBLE",
          });
        }

        const couponQuote = typeof couponCode === "string" && couponCode.trim()
          ? await resolveCouponQuote({
              code: couponCode,
              courseId: examData.courseId,
              userId: examData.userId,
              userEmail: examData.userEmail,
            })
          : null;
        const txnid = payuMoneyService.generateTransactionId();

        // Calculate total amount based on physical copy selection - use current price for payment
        const baseAmount = couponQuote ? Number(couponQuote.finalAmount) : parseFloat(course.price);
        const shippingCost = includesPhysicalCopy ? 50 : 0;
        const totalAmount = baseAmount + shippingCost;
        const formattedAmount = payuMoneyService.formatAmount(
          totalAmount.toString()
        );

        console.log("Payment data being created for temp exam:", {
          tempExamId,
          userId: req.user?.userId || null,
          courseId: examData.courseId,
          amount: formattedAmount,
          certificateAmount: baseAmount.toFixed(2),
          shippingAmount: shippingCost.toFixed(2),
          includesPhysicalCopy,
          selectedAddressId,
          status: "pending",
          paymentMethod: "payumoney",
          transactionId: txnid,
        });

        // Create payment record WITHOUT certificate (will be created after payment success)
        const payment = await storage.createPayment({
          userId: req.user?.userId || null,
          courseId: examData.courseId,
          transactionId: txnid,
          gateway: "payumoney",
          paymentMethod: "payumoney",
          amount: formattedAmount,
          certificateAmount: baseAmount.toFixed(2),
          shippingAmount: shippingCost.toFixed(2),
          includesPhysicalCopy,
          currency: "INR",
          status: "pending",
          gatewayStatusRaw: {
            tempExamId,
            sellerCode: sellerCode || "",
            selectedAddressId,
            ...couponPaymentMetadata(couponQuote),
          },
        });

        const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/+$/, "");

        const paymentData = {
          txnid,
          amount: formattedAmount,
          productinfo: includesPhysicalCopy
            ? `${course.title} - Professional Certification (Digital + Physical)`
            : `${course.title} - Professional Certification`,
          firstname: examData.userName,
          email: examData.userEmail,
          phone: userPhone,
          surl: `${baseUrl}/api/payment/success`,
          furl: `${baseUrl}/api/payment/failure`,
          udf1: examData.courseId.toString(),
          udf2: payment.id.toString(),
          udf3: sellerCode || "",
          udf4: req.user?.userId?.toString() || "",
          udf5: tempExamId, // Store tempExamId for payment success processing
        };

        const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

        res.json({
          success: true,
          paymentForm,
          transactionId: txnid,
          amount: formattedAmount,
        });
      } catch (error) {
        if (error instanceof CouponError) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Error initiating payment:", error);
        res.status(500).json({ message: "Failed to initiate payment" });
      }
    }
  );

  app.post(
    "/api/payments/cashfree/create-order",
    paymentCheckoutLimiter,
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          tempExamId,
          userPhone,
          sellerCode,
          couponCode,
          includesPhysicalCopy = false,
          selectedAddressId = null,
        } = req.body || {};

        if (!tempExamId) {
          return res.status(400).json({ message: "Temporary exam ID is required" });
        }

        const order = await createCashfreeCertificateOrder(req, {
          tempExamId,
          userPhone,
          sellerCode,
          couponCode,
          includesPhysicalCopy,
          selectedAddressId,
        });

        res.json({
          success: true,
          gateway: "cashfree",
          orderId: order.orderId,
          paymentSessionId: order.paymentSessionId,
          paymentLink: order.paymentLink,
          statusToken: order.statusToken,
          amount: order.amount,
          currency: "INR",
        });
      } catch (error: any) {
        if (error instanceof CredentialActivationError) {
          return res.status(error.statusCode).json({ message: error.message, code: error.code });
        }
        if (error instanceof PendingExamAccessError) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        if (error instanceof CouponError) {
          return res.status(error.statusCode).json({ message: error.message });
        }
        console.error("Error creating Cashfree order:", error);
        res.status(500).json({ message: error.message || "Failed to create Cashfree order" });
      }
    }
  );

  app.get("/api/payments/cashfree/:orderId/status", cashfreeStatusLimiter, async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    try {
      const parsed = z.object({
        orderId: z.string().regex(/^[A-Za-z0-9_-]{8,180}$/),
        token: z.string().min(40).max(800),
      }).safeParse({ orderId: req.params.orderId, token: req.query.token });
      if (!parsed.success || verifyCashfreeStatusToken(parsed.data.token) !== parsed.data.orderId) {
        return res.status(404).json({ message: "Payment order not found" });
      }
      const localPayment = await storage.getPaymentByTransactionId(parsed.data.orderId);
      if (!localPayment) return res.status(404).json({ message: "Payment order not found" });
      return res.json({
        orderId: parsed.data.orderId,
        localStatus: publicPaymentStatus(localPayment.status),
      });
    } catch (error: any) {
      console.error("Error fetching Cashfree order status:", error);
      return res.status(500).json({ message: "Failed to fetch payment status" });
    }
  });

  app.post("/api/webhooks/cashfree", async (req: Request, res: Response) => {
    try {
      const signature =
        (req.header("x-webhook-signature") ||
          req.header("x-cashfree-signature") ||
          req.header("x-signature")) as string | undefined;
      const timestamp =
        (req.header("x-webhook-timestamp") ||
          req.header("x-cashfree-timestamp") ||
          req.header("x-timestamp")) as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});

      if (!signature || !verifyCashfreeWebhookSignature(rawBody, signature, timestamp)) {
        console.error("Cashfree webhook signature verification failed");
        audit({ action: 'payment.webhook.invalid_signature', status: 'failure', actorRole: 'system', req, metadata: { orderId: req.body?.data?.order?.order_id } });
        return res.status(401).json({ message: "Invalid webhook signature" });
      }

      const payload: any = req.body || {};
      const status = normalizeCashfreePaymentStatus(payload);
      const orderId = String(
        payload?.data?.order?.order_id || payload?.data?.order?.orderId || payload?.order_id || payload?.orderId || "",
      );
      const cashfreePaymentId = String(
        payload?.data?.payment?.cf_payment_id || payload?.data?.payment?.cfPaymentId || payload?.cf_payment_id || "",
      );

      if (!orderId) {
        return res.status(400).json({ message: "Missing order id" });
      }

      const payment = await storage.getPaymentByTransactionId(orderId);
      if (!payment) {
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.cashfreeOrderId, orderId));
        if (subscription) {
          if (status === 'success') {
            const providerAmount = payload?.data?.order?.order_amount
              ?? payload?.data?.payment?.payment_amount
              ?? payload?.order_amount;
            const providerCurrency = String(
              payload?.data?.order?.order_currency
              ?? payload?.data?.payment?.payment_currency
              ?? payload?.order_currency
              ?? '',
            ).toUpperCase();
            if (!amountsMatch(subscription.amount, providerAmount) || providerCurrency !== 'INR') {
              await db.update(subscriptions)
                .set({ status: 'past_due', updatedAt: new Date() })
                .where(and(eq(subscriptions.id, subscription.id), eq(subscriptions.status, 'pending')));
              await audit({
                action: 'subscription.payment_mismatch',
                status: 'failure',
                actorRole: 'system',
                resourceType: 'subscription',
                resourceId: String(subscription.id),
                req,
                metadata: { orderId, expectedAmount: subscription.amount, providerAmount, providerCurrency },
              });
              return res.status(200).json({ ok: true, status: 'subscription_payment_mismatch' });
            }
            const { activatePlan } = await import('./routes/dashboardRoutes');
            const result = await activatePlan(
              subscription.ownerType as 'learner' | 'creator' | 'institute' | 'recruiter',
              subscription.ownerId,
              subscription.plan,
              orderId,
            );
            return res.status(200).json({ ok: true, status: result.status });
          }
          if (status === 'failed') {
            await db.update(subscriptions)
              .set({ status: 'past_due', updatedAt: new Date() })
              .where(and(eq(subscriptions.id, subscription.id), eq(subscriptions.status, 'pending')));
          }
          return res.status(200).json({ ok: true, status: `subscription_${status}` });
        }
        console.warn("Cashfree webhook for unknown order:", orderId);
        return res.status(200).json({ ok: true, ignored: "unknown_order" });
      }

      const meta = activationMetadata(payment.gatewayStatusRaw) as Record<string, any>;
      const rawOrderNote = payload?.data?.order?.order_note || payload?.data?.order_note || {};
      let orderNote: Record<string, any> = {};
      if (typeof rawOrderNote === "string") {
        try {
          orderNote = JSON.parse(rawOrderNote);
        } catch {
          orderNote = {};
        }
      } else if (rawOrderNote && typeof rawOrderNote === "object") {
        orderNote = rawOrderNote;
      }

      if (payment.status === "completed") {
        return res.status(200).json({ ok: true, status: "already_completed" });
      }

      if (status === "failed") {
        await storage.updatePayment(payment.id, {
          status: "failed",
          cashfreePaymentId: cashfreePaymentId || payment.cashfreePaymentId,
          gatewayStatusRaw: { ...meta, providerWebhook: payload },
        } as any);
        return res.status(200).json({ ok: true, status: "failed" });
      }

      if (status !== "success") {
        await storage.updatePayment(payment.id, {
          status: "pending",
          gatewayStatusRaw: { ...meta, providerWebhook: payload },
        } as any);
        return res.status(200).json({ ok: true, status: "pending" });
      }

      const verifiedProviderAmount =
        payload?.data?.order?.order_amount ??
        payload?.data?.order?.orderAmount ??
        payload?.data?.payment?.payment_amount ??
        payload?.data?.payment?.paymentAmount;
      if (verifiedProviderAmount == null || !amountsMatch(payment.amount, verifiedProviderAmount)) {
        await storage.updatePayment(payment.id, {
          status: "failed",
          cashfreePaymentId: cashfreePaymentId || payment.cashfreePaymentId,
          gatewayStatusRaw: {
            ...meta,
            providerWebhook: payload,
            reason: "verified_gateway_amount_mismatch",
          },
        } as any);
        await audit({
          action: "payment.amount_mismatch",
          status: "failure",
          actorRole: "system",
          userId: payment.userId || undefined,
          resourceType: "payment",
          resourceId: payment.id,
          req,
          metadata: { expected: payment.amount, received: verifiedProviderAmount ?? null, orderId },
        });
        return res.status(200).json({ ok: true, status: "failed_amount_verification" });
      }

      if (meta.kind === "recruiter_credits") {
        const providerCurrency = String(
          payload?.data?.order?.order_currency ??
          payload?.data?.payment?.payment_currency ??
          payload?.order_currency ?? "",
        ).toUpperCase();
        if (providerCurrency !== "INR") {
          await db.update(paymentsTable).set({
            status: "failed",
            gatewayStatusRaw: { ...meta, providerWebhook: payload, reason: "verified_gateway_currency_mismatch" },
          }).where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "pending")));
          return res.status(200).json({ ok: true, status: "failed_currency_verification" });
        }
        const outcome = await fulfillRecruiterCreditPayment({
          paymentId: payment.id,
          orderId,
          providerPaymentId: cashfreePaymentId || orderId,
          providerPayload: payload,
        });
        return res.status(200).json({ ok: true, status: outcome.status });
      }

      // Idempotency for duplicate success webhooks.
      if (payment.status === "completed" && payment.certificateId) {
        if (isCredentialActivationPayment(payment) && payment.courseId) {
          await ensureRevenueSplits({
            paymentId: payment.id,
            courseId: payment.courseId,
            certificateAmount: payment.certificateAmount,
            gatewayOrderId: orderId,
            sellerCode: String(meta.sellerCode || ""),
          });
        }
        return res.status(200).json({ ok: true, status: "already_completed" });
      }

      const tempExamId = String(orderNote?.tempExamId || meta.tempExamId || "");
      const sellerCode = String(orderNote?.sellerCode || meta.sellerCode || "");
      const userId = payment.userId || null;
      const courseId = payment.courseId || 0;

      if (isCredentialActivationPayment(payment) || orderNote?.kind === CREDENTIAL_ACTIVATION_KIND) {
        const providerAmount =
          payload?.data?.order?.order_amount ??
          payload?.data?.order?.orderAmount ??
          payload?.data?.payment?.payment_amount ??
          payload?.data?.payment?.paymentAmount;
        if (providerAmount == null || !amountsMatch(payment.amount, providerAmount)) {
          await storage.updatePayment(payment.id, {
            status: "failed",
            gatewayStatusRaw: {
              ...meta,
              providerWebhook: payload,
              reason: "verified_gateway_amount_mismatch",
            },
          } as any);
          await audit({
            action: "credential.activation.amount_mismatch",
            status: "failure",
            actorRole: "system",
            userId: userId || undefined,
            resourceType: "payment",
            resourceId: payment.id,
            req,
            metadata: { expected: payment.amount, received: providerAmount ?? null, orderId },
          });
          return res.status(200).json({ ok: true, status: "failed_amount_verification" });
        }

        const activation = await finalizeCredentialActivation({
          paymentId: payment.id,
          providerPaymentId: cashfreePaymentId || orderId,
          gateway: "cashfree",
          cashfreeOrderId: orderId,
          gatewayStatusRaw: { ...meta, providerWebhook: payload },
        });
        if (activation.status === "activated") {
          await ensureRevenueSplits({
            paymentId: payment.id,
            courseId,
            certificateAmount: payment.certificateAmount,
            gatewayOrderId: orderId,
            sellerCode,
          });
          if (sellerCode) {
            const seller = await storage.getSellerByReferralCode(sellerCode);
            if (seller?.isApproved) {
              const actualPaymentAmount = Number(payment.certificateAmount);
              const commissionAmount =
                (actualPaymentAmount * Number(seller.commissionRate)) / 100;
              await storage.createSale({
                sellerId: seller.id,
                courseId,
                certificateId: activation.certificate.id,
                amount: actualPaymentAmount.toFixed(2),
                commission: commissionAmount.toFixed(2),
                referralCode: sellerCode,
                status: "completed",
              });
              if (userId) {
                await storage.updateReferralConversion(sellerCode, courseId, userId);
              }
              await storage.incrementSellerEarnings(seller.id, commissionAmount);
            }
          }
          if (userId) {
            await storage.createNotification({
              userId,
              title: "Credential activated",
              type: "payment_success",
              message: `Your ${activation.certificate.courseTitle} credential is active and ready to share.`,
              data: {
                certificateId: activation.certificate.certificateId,
                actionUrl: `/certificate/${activation.certificate.certificateId}`,
                priority: "high",
              },
            });
          }
        }
        await audit({
          action:
            activation.status === "duplicate_payment"
              ? "credential.activation.duplicate_payment"
              : "credential.activation.completed",
          status: activation.status === "duplicate_payment" ? "failure" : "success",
          actorRole: "system",
          userId: userId || undefined,
          resourceType: "certificate",
          resourceId: activation.certificate.id,
          req,
          metadata: { paymentId: payment.id, orderId, outcome: activation.status },
        });
        return res.status(200).json({ ok: true, status: activation.status });
      }

      if (orderNote?.kind === 'course_access' || meta.kind === 'course_access') {
        if (!userId || !courseId) {
          await storage.updatePayment(payment.id, { status: 'failed', gatewayStatusRaw: { ...payload, reason: 'course_access_identity_missing' } } as any);
          return res.status(200).json({ ok: true, status: 'failed_identity_missing' });
        }
        await db.insert(courseEntitlements).values({
          userId,
          courseId,
          paymentId: payment.id,
          source: 'purchase',
          status: 'active',
        }).onConflictDoUpdate({
          target: [courseEntitlements.userId, courseEntitlements.courseId],
          set: { paymentId: payment.id, source: 'purchase', status: 'active', expiresAt: null },
        });
        const purchaser = await storage.getUser(userId);
        if (purchaser) {
          await recordCouponRedemption({ payment, userEmail: purchaser.email });
        }
        await storage.updatePayment(payment.id, {
          status: 'completed',
          paymentMethod: 'cashfree',
          gateway: 'cashfree',
          cashfreeOrderId: orderId,
          cashfreePaymentId: cashfreePaymentId || null,
          gatewayStatusRaw: payload,
        } as any);
        await ensureRevenueSplits({
          paymentId: payment.id,
          courseId,
          certificateAmount: payment.amount,
          gatewayOrderId: orderId,
          sellerCode,
        });
        audit({ action: 'course.access.activated', actorRole: 'system', userId, resourceType: 'course', resourceId: courseId, req, metadata: { paymentId: payment.id, orderId } });
        return res.status(200).json({ ok: true, status: payment.status === 'completed' ? 'already_completed' : 'course_access_activated' });
      }

      const examData = await loadPendingExam<any>(tempExamId);
      if (!examData) {
        await storage.updatePayment(payment.id, {
          status: "failed",
          gatewayStatusRaw: { ...(payload || {}), reason: "pending_exam_missing" },
        } as any);
        return res.status(200).json({ ok: true, status: "failed_exam_missing" });
      }

      const credentialCourse = await storage.getCourse(examData.courseId);
      if (!examData.passed || !credentialCourse || !isCredentialEligibleAssessment(credentialCourse)) {
        await storage.updatePayment(payment.id, {
          status: "failed",
          gatewayStatusRaw: { ...(payload || {}), reason: "assessment_not_credential_eligible" },
        } as any);
        return res.status(200).json({ ok: true, status: "failed_assessment_ineligible" });
      }

      const fulfillment = await finalizePaidExamCertificate({
        paymentId: payment.id,
        transactionId: orderId,
        providerPaymentId: cashfreePaymentId || orderId,
        gateway: "cashfree",
        gatewayStatusRaw: { providerWebhook: payload },
        examData,
        sellerCode,
      });
      const certificate = fulfillment.certificate;

      await deletePendingExam(tempExamId).catch(() => {});

      if (userId && fulfillment.status === "completed") {
        await storage.createNotification({
          userId,
          title: "Certificate Payment Successful",
          type: "payment_success",
          message: `Your payment for certificate ${certificate.certificateId} has been processed successfully. You can now download your certificate.`,
          data: {
            certificateId: certificate.certificateId,
            actionUrl: `/certificates/${certificate.certificateId}`,
            priority: "high",
          },
        });
      }

      return res.status(200).json({ ok: true, status: fulfillment.status });
    } catch (error: any) {
      console.error("Cashfree webhook processing error:", error);
      return res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // PayUMoney success callback - PAYMENT-FIRST APPROACH
  app.post("/api/payment/success", async (req: Request, res: Response) => {
    try {
      const responseData = req.body;

      // Verify hash
      if (!payuMoneyService.verifyHash(responseData)) {
        console.error(
          "Hash verification failed for transaction:",
          responseData.txnid
        );
        const courseId = parseInt(responseData.udf1);
        return res.redirect(
          `${req.protocol}://${req.get(
            "host"
          )}/payment-failed?error=hash_verification_failed&courseId=${courseId}`
        );
      }

      const status = payuMoneyService.getPaymentStatus(responseData);

      if (status === "success") {
        const paymentDbId = parseInt(responseData.udf2);
        const courseId = parseInt(responseData.udf1);
        const sellerCode = responseData.udf3;
        const userId = responseData.udf4 ? parseInt(responseData.udf4) : null;
        const tempExamId = responseData.udf5; // Get temporary exam ID

        // Get the payment record first
        const payment = await storage.getPayment(paymentDbId);
        if (!payment) {
          console.error("Payment not found for ID:", paymentDbId);
          return res.redirect(
            `${req.protocol}://${req.get(
              "host"
            )}/payment-failed?error=payment_not_found&courseId=${courseId}`
          );
        }

        if (
          responseData.txnid !== payment.transactionId ||
          !amountsMatch(payment.amount, responseData.amount)
        ) {
          await storage.updatePayment(payment.id, {
            status: "failed",
            gatewayStatusRaw: {
              ...activationMetadata(payment.gatewayStatusRaw),
              reason: "verified_callback_did_not_match_payment_reservation",
              providerStatus: responseData.status,
              providerTransactionId: responseData.txnid,
            },
          } as any);
          await audit({
            action: "payment.callback_mismatch",
            status: "failure",
            actorRole: "system",
            userId: payment.userId || undefined,
            resourceType: "payment",
            resourceId: payment.id,
            req,
            metadata: { expectedTransactionId: payment.transactionId, receivedTransactionId: responseData.txnid },
          });
          return res.redirect(
            `${req.protocol}://${req.get("host")}/payment-failed?error=payment_verification_failed`,
          );
        }

        // IDEMPOTENCY: PayU may POST /payment/success twice (browser + webhook
        // retry). If we already finalised this payment, just redirect to the
        // existing certificate instead of double-creating exam attempt + cert
        // + sale (which would also double-credit the seller commission).
        if (payment.status === "completed" && payment.certificateId) {
          const existingCert = await storage.getCertificate(payment.certificateId);
          if (existingCert) {
            if (isCredentialActivationPayment(payment) && payment.courseId) {
              const metadata = activationMetadata(payment.gatewayStatusRaw);
              await ensureRevenueSplits({
                paymentId: payment.id,
                courseId: payment.courseId,
                certificateAmount: payment.certificateAmount,
                gatewayOrderId: responseData.txnid,
                sellerCode: String(metadata.sellerCode || ""),
              });
            }
            return res.redirect(
              `${req.protocol}://${req.get(
                "host"
              )}/payment-success?certificateId=${existingCert.certificateId}`
            );
          }
        }

        if (isCredentialActivationPayment(payment)) {
          const metadata = activationMetadata(payment.gatewayStatusRaw);
          const localCourseId = payment.courseId || 0;
          const localUserId = payment.userId || null;
          const callbackMatchesReservation =
            responseData.txnid === payment.transactionId &&
            courseId === localCourseId &&
            userId === localUserId &&
            amountsMatch(payment.amount, responseData.amount);
          if (!callbackMatchesReservation) {
            await storage.updatePayment(payment.id, {
              status: "failed",
              gatewayStatusRaw: {
                ...metadata,
                reason: "verified_callback_did_not_match_payment_reservation",
                providerStatus: responseData.status,
                providerTransactionId: responseData.txnid,
              },
            } as any);
            await audit({
              action: "credential.activation.callback_mismatch",
              status: "failure",
              actorRole: "system",
              userId: localUserId || undefined,
              resourceType: "payment",
              resourceId: payment.id,
              req,
              metadata: {
                expectedTransactionId: payment.transactionId,
                receivedTransactionId: responseData.txnid,
              },
            });
            return res.redirect(
              `${req.protocol}://${req.get("host")}/payment-failed?error=payment_verification_failed`,
            );
          }

          const activation = await finalizeCredentialActivation({
            paymentId: payment.id,
            providerPaymentId: String(responseData.mihpayid || responseData.txnid),
            gateway: "payumoney",
            gatewayStatusRaw: {
              ...metadata,
              providerStatus: responseData.status,
              providerUnmappedStatus: responseData.unmappedstatus,
              providerTransactionId: responseData.txnid,
              providerPaymentId: responseData.mihpayid,
            },
          });
          const activationSellerCode = String(metadata.sellerCode || "");
          if (activation.status === "activated") {
            await ensureRevenueSplits({
              paymentId: payment.id,
              courseId: localCourseId,
              certificateAmount: payment.certificateAmount,
              gatewayOrderId: responseData.txnid,
              sellerCode: activationSellerCode,
            });
            if (activationSellerCode) {
              const seller = await storage.getSellerByReferralCode(activationSellerCode);
              if (seller?.isApproved) {
                const actualPaymentAmount = Number(payment.certificateAmount);
                const commissionAmount =
                  (actualPaymentAmount * Number(seller.commissionRate)) / 100;
                await storage.createSale({
                  sellerId: seller.id,
                  courseId: localCourseId,
                  certificateId: activation.certificate.id,
                  amount: actualPaymentAmount.toFixed(2),
                  commission: commissionAmount.toFixed(2),
                  referralCode: activationSellerCode,
                  status: "completed",
                });
                if (localUserId) {
                  await storage.updateReferralConversion(
                    activationSellerCode,
                    localCourseId,
                    localUserId,
                  );
                }
                await storage.incrementSellerEarnings(seller.id, commissionAmount);
              }
            }
            if (localUserId) {
              await storage.createNotification({
                userId: localUserId,
                title: "Credential activated",
                type: "payment_success",
                message: `Your ${activation.certificate.courseTitle} credential is active and ready to share.`,
                data: {
                  certificateId: activation.certificate.certificateId,
                  actionUrl: `/certificate/${activation.certificate.certificateId}`,
                  priority: "high",
                },
              });
            }
          }
          await audit({
            action:
              activation.status === "duplicate_payment"
                ? "credential.activation.duplicate_payment"
                : "credential.activation.completed",
            status: activation.status === "duplicate_payment" ? "failure" : "success",
            actorRole: "system",
            userId: localUserId || undefined,
            resourceType: "certificate",
            resourceId: activation.certificate.id,
            req,
            metadata: {
              paymentId: payment.id,
              transactionId: responseData.txnid,
              outcome: activation.status,
            },
          });
          const duplicateParam = activation.status === "duplicate_payment" ? "&duplicatePayment=1" : "";
          return res.redirect(
            `${req.protocol}://${req.get("host")}/payment-success?txnid=${encodeURIComponent(
              responseData.txnid,
            )}&certificateId=${encodeURIComponent(
              activation.certificate.certificateId,
            )}${duplicateParam}`,
          );
        }

        // Get persisted exam data
        const examData = await loadPendingExam<any>(tempExamId);
        if (!examData) {
          console.error("Pending exam data not found for ID:", tempExamId);
          return res.redirect(
            `${req.protocol}://${req.get(
              "host"
            )}/payment-failed?error=exam_data_expired&courseId=${courseId}`
          );
        }

        const credentialCourse = await storage.getCourse(examData.courseId);
        if (!examData.passed || !credentialCourse || !isCredentialEligibleAssessment(credentialCourse)) {
          await storage.updatePayment(payment.id, {
            status: "failed",
            gatewayStatusRaw: { ...(payment.gatewayStatusRaw as Record<string, unknown> || {}), reason: "assessment_not_credential_eligible" },
          } as any);
          return res.redirect(
            `${req.protocol}://${req.get("host")}/payment-failed?error=assessment_not_credential_eligible&courseId=${courseId}`,
          );
        }

        const fulfillment = await finalizePaidExamCertificate({
          paymentId: payment.id,
          transactionId: responseData.txnid,
          providerPaymentId: String(responseData.mihpayid || responseData.txnid),
          gateway: "payumoney",
          gatewayStatusRaw: {
            providerStatus: responseData.status,
            providerUnmappedStatus: responseData.unmappedstatus,
            providerTransactionId: responseData.txnid,
            providerPaymentId: responseData.mihpayid,
          },
          examData,
          sellerCode,
        });
        const certificate = fulfillment.certificate;

        await deletePendingExam(tempExamId).catch(() => {});

        if (userId && fulfillment.status === "completed") {
          try {
            await storage.createNotification({
              userId,
              title: "Certificate Payment Successful",
              type: "payment_success",
              message: `Your payment for certificate ${certificate.certificateId} has been processed successfully. You can now download your certificate.`,
              data: {
                certificateId: certificate.certificateId,
                actionUrl: `/certificates/${certificate.certificateId}`,
                priority: "high",
              },
            });
          } catch (notificationError) {
            console.error("Error with post-payment notification:", notificationError);
          }
        }

        return res.redirect(
          `${req.protocol}://${req.get("host")}/payment-success?txnid=${encodeURIComponent(
            responseData.txnid,
          )}&certificateId=${encodeURIComponent(certificate.certificateId)}`,
        );
      } else {
        const courseId = parseInt(responseData.udf1);
        const paymentDbId = parseInt(responseData.udf2);

        // Get payment record to find certificate ID if it exists
        const payment = await storage.getPayment(paymentDbId);
        const failedCertificate = payment?.certificateId
          ? await storage.getCertificate(payment.certificateId)
          : null;
        const certificateParam = failedCertificate
          ? `&certificateId=${encodeURIComponent(failedCertificate.certificateId)}`
          : "";

        res.redirect(
          `${req.protocol}://${req.get("host")}/payment-failed?txnid=${
            responseData.txnid
          }&error=${
            responseData.error_Message || "payment_failed"
          }&courseId=${courseId}${certificateParam}`
        );
      }
    } catch (error) {
      console.error("Error processing payment success:", error);
      res.redirect(
        `${req.protocol}://${req.get(
          "host"
        )}/payment-failed?error=processing_error`
      );
    }
  });

  // PayUMoney failure callback
  app.post("/api/payment/failure", async (req: Request, res: Response) => {
    try {
      const responseData = req.body;
      if (!payuMoneyService.verifyHash(responseData)) {
        return res.redirect(
          `${req.protocol}://${req.get("host")}/payment-failed?error=hash_verification_failed`,
        );
      }
      const courseId = parseInt(responseData.udf1);
      const paymentDbId = parseInt(responseData.udf2);

      // Get payment record to find certificate ID if it exists
      let certificateParam = "";
      try {
        const payment = await storage.getPayment(paymentDbId);
        if (payment?.certificateId) {
          const certificate = await storage.getCertificate(payment.certificateId);
          if (certificate) {
            certificateParam = `&certificateId=${encodeURIComponent(certificate.certificateId)}`;
          }
        }
        if (
          payment &&
          isCredentialActivationPayment(payment) &&
          payment.status === "pending" &&
          payment.transactionId === responseData.txnid &&
          payment.courseId === courseId &&
          payment.userId === (responseData.udf4 ? parseInt(responseData.udf4) : null) &&
          amountsMatch(payment.amount, responseData.amount)
        ) {
          const metadata = activationMetadata(payment.gatewayStatusRaw);
          await storage.updatePayment(payment.id, {
            status: "failed",
            gatewayStatusRaw: {
              ...metadata,
              providerStatus: responseData.status,
              providerTransactionId: responseData.txnid,
            },
          } as any);
        }
      } catch (err) {
        console.log("Could not fetch payment record for failure redirect");
      }

      res.redirect(
        `${req.protocol}://${req.get("host")}/payment-failed?txnid=${
          responseData.txnid
        }&error=${
          responseData.error_Message || "payment_failed"
        }&courseId=${courseId}${certificateParam}`
      );
    } catch (error) {
      console.error("Error processing payment failure:", error);
      res.redirect(
        `${req.protocol}://${req.get(
          "host"
        )}/payment-failed?error=processing_error`
      );
    }
  });

  app.get(
    "/api/payment/status/:transactionId",
    cashfreeStatusLimiter,
    async (req: Request, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      try {
        const parsed = z.object({
          transactionId: z.string().regex(/^[A-Za-z0-9_-]{8,180}$/),
          token: z.string().min(40).max(800),
        }).safeParse({ transactionId: req.params.transactionId, token: req.query.token });
        if (!parsed.success || verifyCashfreeStatusToken(parsed.data.token) !== parsed.data.transactionId) {
          return res.status(404).json({ message: "Payment not found" });
        }
        const payment = await storage.getPaymentByTransactionId(parsed.data.transactionId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        return res.json({
          status: publicPaymentStatus(payment.status),
          amount: payment.amount,
          transactionId: payment.transactionId,
          createdAt: payment.createdAt,
        });
      } catch (error) {
        console.error("Error fetching payment status:", error);
        return res.status(500).json({ message: "Failed to fetch payment status" });
      }
    }
  );

  // Sponsor support endpoint
  app.post("/api/sponsors", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().toLowerCase().email().max(254),
        amount: z.coerce.number().int().positive().max(1_000_000),
        message: z.string().trim().max(1000).optional(),
        isAnonymous: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid sponsor data", issues: parsed.error.flatten() });
      }
      const { name, email, amount, message, isAnonymous } = parsed.data;

      // Generate unique transaction ID
      const transactionId = payuMoneyService.generateTransactionId();

      // Create sponsor record
      const sponsor = await storage.createSponsor({
        name,
        email,
        amount,
        message: message || null,
        paymentMethod: "payumoney",
        transactionId,
        paymentStatus: "pending",
        isAnonymous: isAnonymous || false,
      });

      // Prepare PayUMoney payment data
      const paymentData = {
        txnid: transactionId,
        amount: amount.toString(),
        productinfo: `Sponsorship Support - ${name}`,
        firstname: name,
        email: email,
        phone: "",
        surl: `${req.protocol}://${req.get(
          "host"
        )}/api/sponsor/payment/success`,
        furl: `${req.protocol}://${req.get(
          "host"
        )}/api/sponsor/payment/failure`,
        udf1: sponsor.id.toString(),
        udf2: "",
        udf3: "",
        udf4: "",
        udf5: "",
      };

      // Generate payment form
      const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

      res.json({
        success: true,
        sponsorId: sponsor.id,
        payment: {
          action: paymentForm.action,
          fields: paymentForm.fields,
        },
      });
    } catch (error) {
      console.error("Error creating sponsor:", error);
      res.status(500).json({ message: "Failed to process sponsorship" });
    }
  });

  // Sponsor payment success callback
  app.post(
    "/api/sponsor/payment/success",
    async (req: Request, res: Response) => {
      try {
        const responseData = req.body;

        // Verify payment hash
        if (!payuMoneyService.verifyHash(responseData)) {
          console.error("Invalid payment hash for sponsor payment");
          return res.redirect(
            `${req.protocol}://${req.get("host")}/sponsor?error=invalid_hash`
          );
        }

        const status = payuMoneyService.getPaymentStatus(responseData);

        if (status === "success") {
          const sponsorId = parseInt(responseData.udf1);

          await updateVerifiedSponsorPayment(responseData, "success");

          res.redirect(
            `${req.protocol}://${req.get("host")}/sponsor?success=true&txnid=${
              responseData.txnid
            }`
          );
        } else {
          await updateVerifiedSponsorPayment(responseData, "failed");

          res.redirect(
            `${req.protocol}://${req.get(
              "host"
            )}/sponsor?error=payment_failed&txnid=${responseData.txnid}`
          );
        }
      } catch (error) {
        console.error("Error processing sponsor payment success:", error);
        res.redirect(
          `${req.protocol}://${req.get("host")}/sponsor?error=processing_error`
        );
      }
    }
  );

  // Sponsor payment failure callback
  app.post(
    "/api/sponsor/payment/failure",
    async (req: Request, res: Response) => {
      try {
        const responseData = req.body;
        if (!payuMoneyService.verifyHash(responseData)) {
          console.error("Invalid payment hash for sponsor failure callback");
          return res.redirect(
            `${req.protocol}://${req.get("host")}/sponsor?error=invalid_hash`,
          );
        }
        await updateVerifiedSponsorPayment(responseData, "failed");

        res.redirect(
          `${req.protocol}://${req.get(
            "host"
          )}/sponsor?error=payment_failed&txnid=${responseData.txnid}`
        );
      } catch (error) {
        console.error("Error processing sponsor payment failure:", error);
        res.redirect(
          `${req.protocol}://${req.get("host")}/sponsor?error=processing_error`
        );
      }
    }
  );

  // Referral tracking API
  app.post("/api/referral/track-click", async (req: Request, res: Response) => {
    try {
      const { referralCode, courseId } = req.body;

      if (!referralCode || !courseId) {
        return res
          .status(400)
          .json({ message: "Missing referral code or course ID" });
      }

      console.log(`Tracking click: Code=${referralCode}, Course=${courseId}`);

      // Track the referral click
      await storage.trackReferralClick({
        referralCode,
        courseId: parseInt(courseId),
        ipAddress: req.ip || req.connection?.remoteAddress || "unknown",
        userAgent: req.get("User-Agent") || "unknown",
      });

      console.log(`Click tracked successfully for code: ${referralCode}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking referral click:", error);
      res.status(500).json({ message: "Failed to track referral click" });
    }
  });

  // Enhanced Admin Dashboard endpoints
  app.get(
    "/api/admin/analytics",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const analytics = await storage.getAdminAnalytics();
        res.json(analytics);
      } catch (error) {
        console.error("Error fetching admin analytics:", error);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );

  app.get(
    "/api/admin/customers",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const search = (req.query.search as string) || undefined;
        const paginated = req.query.page !== undefined;
        if (paginated) {
          const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
          const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize)) || 50, 1), 200);
          const [items, total] = await Promise.all([
            storage.getCustomersForAdmin({ limit: pageSize, offset: (page - 1) * pageSize, search }),
            storage.countCustomersForAdmin(search),
          ]);
          return res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
        }
        const customers = await storage.getCustomersForAdmin({ search });
        res.json(customers);
      } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ message: "Failed to fetch customers" });
      }
    }
  );

  app.get(
    "/api/admin/courses",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const paginated = req.query.page !== undefined;
        if (paginated) {
          const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
          const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize)) || 50, 1), 200);
          const [items, total] = await Promise.all([
            storage.getCoursesForAdmin({ limit: pageSize, offset: (page - 1) * pageSize }),
            storage.countCoursesForAdmin(),
          ]);
          return res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
        }
        const courses = await storage.getCoursesForAdmin();
        res.json(courses);
      } catch (error) {
        console.error("Error fetching admin courses:", error);
        res.status(500).json({ message: "Failed to fetch courses" });
      }
    }
  );

  // Admin course creation
  app.post(
    "/api/admin/courses",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = adminCourseCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Check the course details and try again",
            errors: parsed.error.flatten(),
          });
        }
        if (!await isActiveAdminCategory(parsed.data.categoryId)) {
          return res.status(400).json({ message: "Select an active category" });
        }

        const slug = await uniqueAdminCourseSlug(parsed.data.slug || parsed.data.title);
        const governed = buildAdminOwnedCourseCreate(parsed.data, slug);
        await assertAssessmentPublishReadiness({
          courseId: null,
          previous: null,
          next: governed as AssessmentPublishCourseState,
        });
        const course = await storage.createCourseAdmin(governed);
        await audit({
          action: "admin.course.created",
          userId: req.user?.userId,
          actorEmail: req.user?.email,
          actorRole: "admin",
          resourceType: "course",
          resourceId: course.id,
          metadata: {
            reviewStatus: course.reviewStatus,
            isActive: course.isActive,
            subscriptionEligible: course.subscriptionEligible,
            resellerEligible: course.resellerEligible,
          },
          req,
        });
        res.status(201).json(course);
      } catch (error) {
        if (error instanceof AssessmentPublishReadinessError) {
          return res.status(409).json({
            message: error.message,
            code: error.code,
            readiness: error.readiness,
            acceptance: error.acceptance,
          });
        }
        if (error instanceof AdminCourseGovernanceError) {
          return res.status(409).json({ message: error.message });
        }
        console.error("Error creating course:", error);
        res.status(500).json({ message: "Failed to create course" });
      }
    }
  );

  // Admin course update
  app.put(
    "/api/admin/courses/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const courseId = parseInt(req.params.id);
        if (isNaN(courseId)) {
          return res.status(400).json({ message: "Invalid course ID" });
        }
        const existing = await storage.getCourse(courseId);
        if (!existing) {
          return res.status(404).json({ message: "Course not found" });
        }

        const parsed = adminCourseUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Check the course details and try again",
            errors: parsed.error.flatten(),
          });
        }
        if (parsed.data.categoryId && !await isActiveAdminCategory(parsed.data.categoryId)) {
          return res.status(400).json({ message: "Select an active category" });
        }

        const governed = buildGovernedAdminCourseUpdate(existing, parsed.data);
        if (parsed.data.title && !parsed.data.slug) {
          governed.slug = await uniqueAdminCourseSlug(parsed.data.title, courseId);
        }
        await assertAssessmentPublishReadiness({
          courseId,
          previous: existing as AssessmentPublishCourseState,
          next: { ...existing, ...governed } as AssessmentPublishCourseState,
        });
        const course = await storage.updateCourseAdmin(courseId, governed);
        if (!course) return res.status(404).json({ message: "Course not found" });

        await audit({
          action: "admin.course.updated",
          userId: req.user?.userId,
          actorEmail: req.user?.email,
          actorRole: "admin",
          resourceType: "course",
          resourceId: course.id,
          metadata: {
            ownerType: course.ownerType,
            reviewStatus: course.reviewStatus,
            isActive: course.isActive,
            thirdPartyReturnedToReview: existing.ownerType !== "admin",
          },
          req,
        });

        res.json(course);
      } catch (error) {
        if (error instanceof AssessmentPublishReadinessError) {
          return res.status(409).json({
            message: error.message,
            code: error.code,
            readiness: error.readiness,
            acceptance: error.acceptance,
          });
        }
        if (error instanceof AdminCourseGovernanceError) {
          return res.status(409).json({ message: error.message });
        }
        console.error("Error updating course:", error);
        res.status(500).json({ message: "Failed to update course" });
      }
    }
  );

  // Review is deliberately separate from generic editing. This makes approval
  // explicit and auditable; creator/institute update routes can never set it.
  app.patch(
    "/api/admin/courses/:id/review",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const courseId = Number(req.params.id);
        if (!Number.isInteger(courseId) || courseId <= 0) {
          return res.status(400).json({ message: "Invalid course ID" });
        }
        const parsed = adminCourseReviewSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Check the review decision and try again",
            errors: parsed.error.flatten(),
          });
        }
        const existing = await storage.getCourse(courseId);
        if (!existing) return res.status(404).json({ message: "Course not found" });

        const governed = buildThirdPartyCourseReview(existing, parsed.data);
        await assertAssessmentPublishReadiness({
          courseId,
          previous: existing as AssessmentPublishCourseState,
          next: { ...existing, ...governed } as AssessmentPublishCourseState,
        });
        const course = await storage.updateCourseAdmin(courseId, governed);
        if (!course) return res.status(404).json({ message: "Course not found" });

        await audit({
          action: "admin.course.reviewed",
          userId: req.user?.userId,
          actorEmail: req.user?.email,
          actorRole: "admin",
          resourceType: "course",
          resourceId: course.id,
          metadata: {
            decision: parsed.data.status,
            reason: parsed.data.reason,
            ownerType: course.ownerType,
            certificationMode: course.certificationMode,
          },
          req,
        });
        res.json(course);
      } catch (error) {
        if (error instanceof AssessmentPublishReadinessError) {
          return res.status(409).json({
            message: error.message,
            code: error.code,
            readiness: error.readiness,
            acceptance: error.acceptance,
          });
        }
        if (error instanceof AdminCourseGovernanceError) {
          return res.status(409).json({ message: error.message });
        }
        console.error("Error reviewing course:", error);
        res.status(500).json({ message: "Failed to review course" });
      }
    },
  );

  // Admin course deletion
  app.delete(
    "/api/admin/courses/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const courseId = parseInt(req.params.id);
        if (isNaN(courseId)) {
          return res.status(400).json({ message: "Invalid course ID" });
        }

        await storage.deleteCourseAdmin(courseId);
        res.json({ message: "Course deleted successfully" });
      } catch (error) {
        console.error("Error deleting course:", error);
        res.status(500).json({ message: "Failed to delete course" });
      }
    }
  );

  app.get(
    "/api/admin/exam-attempts",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const examAttempts = await storage.getExamAttemptsForAdmin();
        res.json(examAttempts);
      } catch (error) {
        console.error("Error fetching exam attempts:", error);
        res.status(500).json({ message: "Failed to fetch exam attempts" });
      }
    }
  );

  app.get(
    "/api/admin/transactions",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const paginated = req.query.page !== undefined;
        if (paginated) {
          const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
          const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize)) || 50, 1), 200);
          const [items, total] = await Promise.all([
            storage.getTransactionsForAdmin({ limit: pageSize, offset: (page - 1) * pageSize }),
            storage.countTransactionsForAdmin(),
          ]);
          return res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
        }
        const transactions = await storage.getTransactionsForAdmin();
        res.json(transactions);
      } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ message: "Failed to fetch transactions" });
      }
    }
  );

  app.get(
    "/api/admin/partners",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const paginated = req.query.page !== undefined;
        if (paginated) {
          const page = Math.max(parseInt(String(req.query.page)) || 1, 1);
          const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize)) || 50, 1), 200);
          const [items, total] = await Promise.all([
            storage.getPartnersForAdmin({ limit: pageSize, offset: (page - 1) * pageSize }),
            storage.countPartnersForAdmin(),
          ]);
          return res.json({ items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
        }
        const partners = await storage.getPartnersForAdmin();
        res.json(partners);
      } catch (error) {
        console.error("Error fetching partners:", error);
        res.status(500).json({ message: "Failed to fetch partners" });
      }
    }
  );

  app.get(
    "/api/admin/withdrawals",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const withdrawals = await storage.getAllWithdrawals();
        res.json(withdrawals);
      } catch (error) {
        console.error("Error fetching withdrawals:", error);
        res.status(500).json({ message: "Failed to fetch withdrawals" });
      }
    }
  );

  // Admin sponsors endpoint
  app.get(
    "/api/admin/sponsors",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const sponsors = await storage.getAllSponsors();
        res.json(sponsors);
      } catch (error) {
        console.error("Error fetching sponsors:", error);
        res.status(500).json({ message: "Failed to fetch sponsors" });
      }
    }
  );

  // Admin contact submissions endpoint
  app.get(
    "/api/admin/contacts",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const contacts = await storage.getAllContactSubmissions();
        res.json(contacts);
      } catch (error) {
        console.error("Error fetching contact submissions:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch contact submissions" });
      }
    }
  );

  // Register API routes (includes certificate routes)
  app.use("/api", apiRoutes);
  app.use("/api/certificates", certificateRoutes);
  app.use("/api/question-banks", questionBanksRouter);
  app.use("/api/courses", courseBlueprintRouter);

  // Catch-all handler: send back React's index.html file for non-API routes
  // This ensures that client-side routing works for direct URL access
  app.get("*", (req, res, next) => {
    // Skip API routes - they should have been handled above
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Let Vite handle frontend routing in development
    // The vite middleware will serve the React app
    next();
  });

  // User certificates endpoint - CRITICAL FOR DASHBOARD
  app.get(
    "/api/user/certificates",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user?.userId;

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        console.log("Fetching certificates for user ID:", userId);
        const account = await storage.getUser(userId);
        if (!account) {
          return res.status(401).json({ message: "Account not found" });
        }
        const certificates = await storage.getUserCertificates(userId, account.email);
        console.log("Found certificates:", certificates.length);
        res.json(certificates);
      } catch (error) {
        console.error("Get user certificates error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  // Public API endpoint for recent certificates (for landing page)
  app.get("/api/recent-certificates", async (req: Request, res: Response) => {
    try {
      const certificates = await storage.getRecentCertificates(10); // Get 10 most recent certificates
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching recent certificates:", error);
      res.status(500).json({ message: "Failed to fetch recent certificates" });
    }
  });

  // Contact form submission endpoint
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().toLowerCase().email().max(254),
        subject: z.string().trim().min(1).max(200),
        message: z.string().trim().min(1).max(5000),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid contact form data", issues: parsed.error.flatten() });
      }
      const { name, email, subject, message } = parsed.data;

      // Store contact form submission
      await storage.createContactSubmission({
        name,
        email,
        subject,
        message,
        status: "new",
      });

      res.json({ message: "Contact form submitted successfully" });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      res.status(500).json({ message: "Failed to submit contact form" });
    }
  });

  // Contact submission endpoint for help center
  app.post("/api/contact-submission", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().toLowerCase().email().max(254),
        phone: z.string().trim().max(40).optional(),
        subject: z.string().trim().min(1).max(200),
        message: z.string().trim().min(1).max(5000),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid form data", issues: parsed.error.flatten() });
      }
      const { name, email, phone, subject, message } = parsed.data;

      // Insert contact submission into database
      const [submission] = await db
        .insert(contactSubmissions)
        .values({
          name,
          email,
          phone: phone || null,
          subject,
          message,
          status: "new",
        })
        .returning();

      res.status(201).json({
        message:
          "Message sent successfully! We'll get back to you within 24 hours.",
        submissionId: submission.id,
      });
    } catch (error) {
      console.error("Contact submission error:", error);
      res.status(500).json({
        message: "Failed to send message. Please try again.",
      });
    }
  });

  // Shareable certificate route - displays certificate in smaller format for sharing
  app.get(
    "/api/certificate/:certificateNumber",
    async (req: Request, res: Response) => {
      try {
        const certificateNumber = req.params.certificateNumber;
        const certificate = await storage.getCertificateByCertificateId(
          certificateNumber
        );

        if (!certificate) {
          return res.status(404).send(`
          <html>
            <head><title>Certificate Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Certificate Not Found</h1>
              <p>The certificate with ID "${certificateNumber}" could not be found.</p>
              <a href="/">Return to Home</a>
            </body>
          </html>
        `);
        }

        // Check if certificate is paid (security check)
        if (!certificate.isPaid) {
          return res.status(403).send(`
          <html>
            <head><title>Certificate Access Denied</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Certificate Access Denied</h1>
              <p>This certificate requires payment to be accessed.</p>
              <a href="/">Return to Home</a>
            </body>
          </html>
        `);
        }

        // Get course details for the certificate
        const course = await storage.getCourse(certificate.courseId);
        if (!course) {
          return res.status(404).send(`
          <html>
            <head><title>Course Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Course Not Found</h1>
              <p>The course associated with this certificate could not be found.</p>
              <a href="/">Return to Home</a>
            </body>
          </html>
        `);
        }

        // Get exam attempt for completion date
        let examAttempt = null;
        if (certificate.examAttemptId) {
          examAttempt = await storage.getExamAttempt(certificate.examAttemptId);
        }

        // Prepare certificate data using existing generator
        const certificateData = {
          certificateId: certificate.certificateId || "N/A",
          userName: certificate.userName || "Certificate Holder",
          courseTitle: course.title || "Professional Course",
          issueDate: certificate.issuedAt || new Date(),
          completionDate:
            examAttempt?.createdAt || certificate.issuedAt || new Date(),
          passingScore: course.passingScore || 50,
          userScore: certificate.score || 0,
          courseLevel: course.level || "Beginner",
        };

        // Generate HTML using existing certificate generator
        const htmlContent = generateCertificateHTML(certificateData);

        // Add sharing and download functionality to the HTML
        const shareableHtml = htmlContent
          .replace(
            "</head>",
            `
        <meta property="og:title" content="Professional Certificate - ${certificateData.userName}">
        <meta property="og:description" content="Certificate of completion for ${certificateData.courseTitle}">
        <meta property="og:type" content="website">
        <meta name="description" content="Professional certificate issued by Octamy Solutions">
        <style>
          .share-controls {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            gap: 10px;
            flex-direction: column;
            background: rgba(255,255,255,0.95);
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .share-btn {
            padding: 8px 16px;
            background: #000;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .share-btn:hover {
            background: #333;
          }
          @media print {
            .share-controls { display: none; }
          }
          @media (max-width: 768px) {
            .certificate-container {
              width: 100vw !important;
              height: auto !important;
              transform: scale(0.4);
              transform-origin: top left;
            }
            .share-controls {
              position: relative;
              margin-bottom: 20px;
              flex-direction: row;
              justify-content: center;
            }
          }
        </style>
        </head>`
          )
          .replace(
            "<body>",
            `<body>
        <div class="share-controls">
          <button class="share-btn" onclick="downloadPDF()">📄 Download PDF</button>
          <button class="share-btn" onclick="printCert()">🖨️ Print</button>
          <button class="share-btn" onclick="shareCert()">🔗 Share</button>
        </div>
        <script>
          function downloadPDF() {
            // Try API download first, fallback to print-to-PDF
            fetch('/certificate/${certificateNumber}?format=pdf')
              .then(response => {
                if (response.ok) {
                  return response.blob();
                } else {
                  // Fallback: open print dialog with instructions
                  if (confirm('PDF generation is currently unavailable. Would you like to print this certificate instead? You can choose "Save as PDF" in the print dialog.')) {
                    window.print();
                  }
                  throw new Error('PDF generation failed');
                }
              })
              .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'certificate-${certificateNumber}.pdf';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              })
              .catch(error => {
                console.error('Download failed:', error);
              });
          }
          function printCert() {
            window.print();
          }
          function shareCert() {
            if (navigator.share) {
              navigator.share({
                title: 'Professional Certificate - ${certificateData.userName}',
                text: 'Certificate of completion for ${certificateData.courseTitle}',
                url: window.location.href
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('Certificate link copied to clipboard!');
            }
          }
        </script>`
          );

        res.setHeader("Content-Type", "text/html");
        res.send(shareableHtml);
      } catch (error) {
        console.error("Shareable certificate error:", error);
        res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Internal Server Error</h1>
            <p>An error occurred while loading the certificate.</p>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `);
      }
    }
  );

  // Add interview technologies endpoint directly
  app.get(
    "/api/interview-technologies",
    async (req: Request, res: Response) => {
      try {
        console.log("Direct API: Fetching interview technologies...");
        const technologies = await db
          .selectDistinct({ technology: interviewQuestions.technology })
          .from(interviewQuestions)
          .where(eq(interviewQuestions.isActive, true));

        console.log("Direct API: Found technologies:", technologies);
        const result = technologies.map((t) => t.technology);
        console.log("Direct API: Returning technologies:", result);
        res.json(result);
      } catch (error) {
        console.error("Direct API: Error fetching technologies:", error);
        res.status(500).json({ error: "Failed to fetch technologies" });
      }
    }
  );

  // Initiate interview payment
  app.post(
    "/api/interviews/initiate-payment",
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { technology } = req.body;

        if (!technology) {
          return res.status(400).json({ error: "Technology is required" });
        }

        // Generate transaction ID
        const txnid = `INT${Date.now()}${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Get user details - handle both authenticated and guest users
        let user = null;
        let userId = null;
        let userEmail = "guest@octamy.com";
        let userName = "Guest User";

        if (req.user?.userId) {
          const userResult = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, req.user.userId));
          user = userResult[0];
          if (user) {
            userId = user.id;
            userEmail = user.email;
            userName = user.name;
          }
        }

        // Check if user already has an uncompleted paid interview for this technology
        // Allow retakes for completed interviews
        let existingInterview: any[] = [];
        if (userId) {
          existingInterview = await db
            .select()
            .from(interviews)
            .where(
              and(
                eq(interviews.userId, userId),
                eq(interviews.technology, technology),
                eq(interviews.paymentStatus, "paid"),
                not(eq(interviews.status, "completed")) // Only block if interview is not completed
              )
            )
            .limit(1);
        }

        if (existingInterview.length > 0) {
          return res.json({
            success: true,
            message: "Interview already purchased",
            interviewId: existingInterview[0].id,
            alreadyPurchased: true,
          });
        }

        // Prepare payment data for PayUMoney
        const paymentData = {
          txnid,
          amount: "99.00",
          productinfo: `AI Interview - ${technology}`,
          firstname: userName,
          email: userEmail,
          phone: user?.phone || "9999999999",
          surl: `${req.protocol}://${req.get(
            "host"
          )}/api/interviews/payment/success`,
          furl: `${req.protocol}://${req.get(
            "host"
          )}/api/interviews/payment/failure`,
          udf1: userId?.toString() || "guest",
          udf2: technology,
          udf3: "",
          udf4: "",
          udf5: "",
        };

        // Store pending interview data temporarily
        (global as any).pendingInterviews =
          (global as any).pendingInterviews || {};
        (global as any).pendingInterviews[txnid] = {
          userId: userId || null,
          technology,
          title: `${technology} Technical Interview`,
        };

        // Generate payment form for PayUMoney
        const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

        res.json({
          success: true,
          paymentForm: paymentForm.html,
          transactionId: txnid,
          redirectToPayment: true,
          paymentUrl: paymentForm.url,
        });
      } catch (error:any) {
        console.error("Error initiating interview payment:", error);
        res
          .status(500)
          .json({
            error: "Failed to initiate payment",
            details: error.message,
          });
      }
    }
  );

  // Interview payment success callback
  app.post(
    "/api/interviews/payment/success",
    async (req: Request, res: Response) => {
      try {
        const responseData = req.body;

        // Verify payment hash
        if (!payuMoneyService.verifyHash(responseData)) {
          console.error("Invalid payment hash for interview payment");
          return res.redirect(
            `${req.protocol}://${req.get(
              "host"
            )}/ai-interviews?error=invalid_hash`
          );
        }

        const status = payuMoneyService.getPaymentStatus(responseData);

        if (status === "success") {
          const txnid = responseData.txnid;
          const userId = parseInt(responseData.udf1);
          const technology = responseData.udf2;

          // Check if interview already exists to prevent duplicates
          const existingInterview = await db
            .select()
            .from(interviews)
            .where(eq(interviews.paymentId, txnid))
            .limit(1);

          if (existingInterview.length === 0) {
            // Create actual interview record in database
            const [interview] = await db
              .insert(interviews)
              .values({
                userId: userId,
                technology,
                status: "pending",
                paymentId: txnid,
                title: `${technology} Technical Interview`,
                paymentStatus: "paid",
                totalQuestions: 6,
                paymentAmount: "99.00",
                createdAt: new Date(),
              })
              .returning();

            console.log(
              `Interview created successfully: ID ${interview.id}, User ${userId}, Technology ${technology}`
            );
          } else {
            console.log(
              `Interview already exists for transaction ${txnid}, skipping creation`
            );
          }

          // Clean up pending interview if exists
          if ((global as any).pendingInterviews?.[txnid]) {
            delete (global as any).pendingInterviews[txnid];
          }

          res.redirect(
            `${req.protocol}://${req.get(
              "host"
            )}/ai-interviews?payment=success&technology=${technology}`
          );
        } else {
          res.redirect(
            `${req.protocol}://${req.get(
              "host"
            )}/ai-interviews?error=payment_failed`
          );
        }
      } catch (error) {
        console.error("Error processing interview payment success:", error);
        res.redirect(
          `${req.protocol}://${req.get(
            "host"
          )}/ai-interviews?error=processing_error`
        );
      }
    }
  );

  //Initiate interview payment
  // const isDevelopment = true;
  // app.post(
  //   "/api/interviews/initiate-payment",
  //   optionalAuth,
  //   async (req: AuthenticatedRequest, res: Response) => {
  //     try {
  //       const { technology } = req.body;

  //       if (!technology) {
  //         return res.status(400).json({ error: "Technology is required" });
  //       }

  //       // Generate transaction ID
  //       const txnid = `INT${Date.now()}${Math.random()
  //         .toString(36)
  //         .substr(2, 9)}`;

  //       // Get user details
  //       let user = null;
  //       let userId = null;
  //       let userEmail = "guest@octamy.com";
  //       let userName = "Guest User";

  //       if (req.user?.userId) {
  //         const userResult = await db
  //           .select()
  //           .from(usersTable)
  //           .where(eq(usersTable.id, req.user.userId));
  //         user = userResult[0];
  //         if (user) {
  //           userId = user.id;
  //           userEmail = user.email;
  //           userName = user.name;
  //         }
  //       }

  //       // Check for existing uncompleted interview
  //       let existingInterview: any[] = [];
  //       if (userId) {
  //         existingInterview = await db
  //           .select()
  //           .from(interviews)
  //           .where(
  //             and(
  //               eq(interviews.userId, userId),
  //               eq(interviews.technology, technology),
  //               eq(interviews.paymentStatus, "paid"),
  //               not(eq(interviews.status, "completed"))
  //             )
  //           )
  //           .limit(1);
  //       }

  //       if (existingInterview.length > 0) {
  //         return res.json({
  //           success: true,
  //           message: "Interview already purchased",
  //           interviewId: existingInterview[0].id,
  //           alreadyPurchased: true,
  //         });
  //       }

  //       // DEVELOPMENT MODE: Skip payment
  //       if (isDevelopment) {
  //         // Create interview record directly
  //         const [interview] = await db
  //           .insert(interviews)
  //           .values({
  //             userId: userId,
  //             technology,
  //             status: "pending",
  //             paymentId: txnid,
  //             title: `${technology} Technical Interview`,
  //             paymentStatus: "paid",
  //             totalQuestions: 6,
  //             paymentAmount: "0.00", // Mark as free in dev
  //             createdAt: new Date(),
  //           })
  //           .returning();

  //         return res.json({
  //           success: true,
  //           interviewId: interview.id,
  //           developmentMode: true,
  //           message: "Payment skipped in development mode",
  //         });
  //       }

  //       // PRODUCTION: Normal payment flow
  //       const paymentData = {
  //         txnid,
  //         amount: "99.00",
  //         productinfo: `AI Interview - ${technology}`,
  //         firstname: userName,
  //         email: userEmail,
  //         phone: user?.phone || "9999999999",
  //         surl: `${req.protocol}://${req.get(
  //           "host"
  //         )}/api/interviews/payment/success`,
  //         furl: `${req.protocol}://${req.get(
  //           "host"
  //         )}/api/interviews/payment/failure`,
  //         udf1: userId?.toString() || "guest",
  //         udf2: technology,
  //       };

  //       // Store pending interview
  //       (global as any).pendingInterviews =
  //         (global as any).pendingInterviews || {};
  //       (global as any).pendingInterviews[txnid] = {
  //         userId: userId || null,
  //         technology,
  //         title: `${technology} Technical Interview`,
  //       };

  //       const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

  //       res.json({
  //         success: true,
  //         paymentForm: paymentForm.html,
  //         transactionId: txnid,
  //         redirectToPayment: true,
  //         paymentUrl: paymentForm.url,
  //       });
  //     } catch (error) {
  //       console.error("Error initiating interview payment:", error);
  //       res.status(500).json({
  //         error: "Failed to initiate payment",
  //         details: error.message,
  //       });
  //     }
  //   }
  // );

  // app.post(
  //   "/api/interviews/payment/success",
  //   async (req: Request, res: Response) => {
  //     try {
  //       // Skip verification in development
  //       if (!isDevelopment) {
  //         const responseData = req.body;
  //         if (!payuMoneyService.verifyHash(responseData)) {
  //           console.error("Invalid payment hash for interview payment");
  //           return res.redirect(
  //             `${req.protocol}://${req.get(
  //               "host"
  //             )}/ai-interviews?error=invalid_hash`
  //           );
  //         }
  //       }

  //       const status = isDevelopment
  //         ? "success"
  //         : payuMoneyService.getPaymentStatus(req.body);
  //       const responseData = req.body;

  //       if (status === "success") {
  //         const txnid = responseData.txnid || `DEV-${Date.now()}`;
  //         const userId = parseInt(responseData.udf1 || "0");
  //         const technology = responseData.udf2 || "development";

  //         const existingInterview = await db
  //           .select()
  //           .from(interviews)
  //           .where(eq(interviews.paymentId, txnid))
  //           .limit(1);

  //         if (existingInterview.length === 0) {
  //           const [interview] = await db
  //             .insert(interviews)
  //             .values({
  //               userId: userId,
  //               technology,
  //               status: "pending",
  //               paymentId: txnid,
  //               title: `${technology} Technical Interview`,
  //               paymentStatus: "paid",
  //               totalQuestions: 6,
  //               paymentAmount: isDevelopment ? "0.00" : "99.00",
  //               createdAt: new Date(),
  //             })
  //             .returning();

  //           console.log(`Interview created: ID ${interview.id}`);
  //         }

  //         if ((global as any).pendingInterviews?.[txnid]) {
  //           delete (global as any).pendingInterviews[txnid];
  //         }

  //         res.redirect(
  //           `${req.protocol}://${req.get(
  //             "host"
  //           )}/ai-interviews?payment=success&technology=${technology}`
  //         );
  //       } else {
  //         res.redirect(
  //           `${req.protocol}://${req.get(
  //             "host"
  //           )}/ai-interviews?error=payment_failed`
  //         );
  //       }
  //     } catch (error) {
  //       console.error("Error processing payment success:", error);
  //       res.redirect(
  //         `${req.protocol}://${req.get(
  //           "host"
  //         )}/ai-interviews?error=processing_error`
  //       );
  //     }
  //   }
  // );

  // Interview payment failure callback
  app.post(
    "/api/interviews/payment/failure",
    async (req: Request, res: Response) => {
      try {
        const responseData = req.body;
        const technology = responseData.udf2;

        res.redirect(
          `${req.protocol}://${req.get(
            "host"
          )}/ai-interviews?error=payment_failed&technology=${technology}`
        );
      } catch (error) {
        console.error("Error processing interview payment failure:", error);
        res.redirect(
          `${req.protocol}://${req.get(
            "host"
          )}/ai-interviews?error=processing_error`
        );
      }
    }
  );

  // Get interview by ID with questions
  app.get(
    "/api/interviews/:id",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const interviewId = parseInt(req.params.id);

        // Get interview details
        const interview = await storage.getInterviewById(interviewId);
        if (!interview) {
          return res.status(404).json({ error: "Interview not found" });
        }

        // Check if user owns this interview
        if (interview.userId !== req.user!.userId) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Get questions for this technology - ensure correct technology matching
        const questions = await db
          .select()
          .from(interviewQuestions)
          .where(
            and(
              eq(interviewQuestions.technology, interview.technology),
              eq(interviewQuestions.isActive, true)
            )
          )
          .limit(4); // 4 theory questions + 1 hands-on

        console.log(
          `Fetching questions for technology: ${interview.technology}`
        );
        console.log(
          `Found ${questions.length} questions for ${interview.technology}`
        );

        // Helper function to get hands-on questions by technology
        const getHandsOnQuestion = (technology: string): string => {
          const handsOnQuestions: Record<string, string> = {
            "Data Science":
              "Create a Python script to analyze a CSV dataset. Load the data, perform basic statistics, create visualizations, and identify key insights. You may use pandas, matplotlib, seaborn, or any libraries you prefer.",
            React:
              "Build a React component that fetches and displays a list of users from JSONPlaceholder API. Include search functionality, loading states, and error handling. You may use any React hooks and styling approach.",
            "Node.js":
              "Create a REST API with Express.js that manages a simple todo list. Implement GET, POST, PUT, DELETE endpoints with in-memory storage. Include input validation and error handling.",
            Python:
              "Write a Python program that reads a text file, counts word frequency, and saves the results to a new file. Handle file operations gracefully and include basic text processing.",
            JavaScript:
              "Create an interactive web page that fetches weather data from a public API and displays it with a search feature. Use vanilla JavaScript and include error handling.",
            Java: "Create a Java class hierarchy for different types of vehicles. Implement inheritance, polymorphism, and demonstrate the functionality with a main method.",
            Database:
              "Design and implement a simple database schema for a library management system. Create tables, relationships, and write SQL queries for common operations.",
            "Machine Learning":
              "Using any ML library, create a simple classification model on a public dataset. Include data preprocessing, model training, evaluation, and prediction examples.",
            "Cloud Computing":
              "Design a cloud architecture diagram for a simple web application. Explain the components, their interactions, and justify your technology choices.",
            Cybersecurity:
              "Demonstrate basic security concepts by creating a simple password strength checker and explaining common vulnerabilities in web applications.",
            Default:
              "Create a small project demonstrating your skills in this technology. You have 30 minutes to build something functional and explain your approach.",
          };

          return handsOnQuestions[technology] || handsOnQuestions["Default"];
        };

        const questionsWithHandsOn = [
          ...questions,
          {
            id: 999,
            title: `${interview.technology} Hands-on Challenge`,
            question: getHandsOnQuestion(interview.technology),
            technology: interview.technology,
            difficulty: "practical",
            timeLimit: 1800,
            isHandsOn: true,
          },
        ];

        res.json({
          ...interview,
          questions: questionsWithHandsOn,
        });
      } catch (error) {
        console.error("Error fetching interview:", error);
        res.status(500).json({ error: "Failed to fetch interview" });
      }
    }
  );

  // upload to cloud
  const upload = multer({ storage: multer.memoryStorage() });

  const uploadToCloud = async (buffer:Buffer, folder:any, resource_type:any) => {
    const stream = Readable.from(buffer);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type,
        },
        (error, result:any) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );
      stream.pipe(uploadStream);
    });
  };

  // API: Upload recorded video
  app.post(
    "/api/upload-video",
    upload.fields([
      { name: "screen", maxCount: 1 },
      { name: "video", maxCount: 1 },
    ]),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const uploadedFiles = req.files;
        if (!uploadedFiles || Array.isArray(uploadedFiles)) {
          return res.status(400).json({ error: "Screen and video files are required" });
        }
        const screenFile = uploadedFiles.screen?.[0];
        const videoFile = uploadedFiles.video?.[0];
        if (!screenFile || !videoFile) {
          return res.status(400).json({ error: "Screen and video files are required" });
        }
        const screenBuffer = screenFile.buffer;
        const videoBuffer = videoFile.buffer;
        const screenUrl = await uploadToCloud(
          screenBuffer,
          "interviews/screen",
          "video"
        );
        const videoUrl = await uploadToCloud(
          videoBuffer,
          "interviews/video",
          "video"
        );

        if (!screenUrl || !videoUrl) {
          res.json({ message: "screen or video url not found" });
        }
        res.json({
          videoUrl,
          screenUrl,
        });
      } catch (error) {
        console.error("Upload failed:", error);
        res.status(500).json({ error: "Failed to upload video" });
      }
    }
  );

  // Submit interview
  app.post(
    "/api/interviews/:id/submit",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const interviewId = parseInt(req.params.id);
        const {
          answers,
          tabSwitches,
          completedAt,
          videoUrl,
          screenRecordingUrl,
        } = req.body;

        // Get interview details
        const interview = await storage.getInterviewById(interviewId);
        if (!interview) {
          return res.status(404).json({ error: "Interview not found" });
        }

        // Check if user owns this interview
        if (interview.userId !== req.user!.userId) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Calculate score based on actual content quality
        // const totalQuestions = Object.keys(answers).length;
        // let validAnswers = 0;

        // Object.values(answers).forEach((answer: any) => {
        //   const answerText = answer
        //     ? answer.toString().trim().toLowerCase()
        //     : "";
        //   // Only count meaningful answers
        //   if (
        //     answerText &&
        //     answerText.length > 10 &&
        //     !answerText.includes("don't know") &&
        //     !answerText.includes("skip") &&
        //     !answerText.includes("no idea") &&
        //     answerText !== "na" &&
        //     answerText !== "n/a"
        //   ) {
        //     validAnswers++;
        //   }
        // });

        // const score =
        //   totalQuestions > 0
        //     ? Math.round((validAnswers / totalQuestions) * 100)
        //     : 0;

        const { score, feedback, perAnswerScores } =
          await evaluateAnswersWithAI(answers);

        // Determine grade
        let grade = "F";
        if (score >= 90) grade = "A+";
        else if (score >= 85) grade = "A";
        else if (score >= 80) grade = "B+";
        else if (score >= 75) grade = "B";
        else if (score >= 70) grade = "C+";
        else if (score >= 65) grade = "C";
        else if (score >= 60) grade = "D";

        // Generate AI summary based on performance
        // const technology = interview.technology || "the technology";
        // const aiSummary =
        //   score > 70
        //     ? `Strong performance with ${validAnswers}/${totalQuestions} well-answered questions. Demonstrated good understanding of ${technology}.`
        //     : score > 40
        //     ? `Moderate performance with ${validAnswers}/${totalQuestions} complete answers. Room for improvement in technical depth of ${technology}.`
        //     : `Limited responses provided. Consider reviewing ${technology} fundamentals before retaking the interview.`;

        // Validate and parse completedAt date
        // let completedDate;
        // try {
        //   // Handle various date formats and ensure valid date
        //   if (completedAt) {
        //     const parsedDate = new Date(completedAt);
        //     if (isNaN(parsedDate.getTime())) {
        //       // If invalid date, use current time
        //       completedDate = new Date();
        //     } else {
        //       completedDate = parsedDate;
        //     }
        //   } else {
        //     // If no completedAt provided, use current time
        //     completedDate = new Date();
        //   }
        // } catch (error) {
        //   console.error("Error parsing completedAt date:", error);
        //   completedDate = new Date();
        // }
        let completedDate;
        try {
          const parsedDate = new Date(completedAt);
          completedDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
        } catch {
          completedDate = new Date();
        }
        // Update interview with results
        await storage.updateInterview(interviewId, {
          status: "completed",
          score: Math.round(score),
          grade,
          completedAt: completedDate,
          tabSwitches,
          answers: JSON.stringify(answers),
          aiSummary:feedback,
          videoUrl,
          screenRecordingUrl,
        });

        res.json({
          id: interviewId,
          score: Math.round(score),
          grade,
          aiSummary:feedback,
          message: "Interview submitted successfully",
        });
      } catch (error) {
        console.error("Error submitting interview:", error);
        res.status(500).json({ error: "Failed to submit interview" });
      }
    }
  );

  // General file upload endpoint for CVs/resumes
  app.post(
    "/api/upload",
    authenticateToken,
    upload.single("file"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const allowedTypes = [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error:
              "Invalid file type. Only PDF and Word documents are allowed.",
          });
        }

        if (!process.env.CLOUDINARY_CLOUD_NAME) {
          return res.status(500).json({ error: "Cloudinary not configured" });
        }

        const publicId = `resumes/${req.user!.userId}_${Date.now()}`;

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                resource_type: "raw",
                public_id: publicId,
                format: req.file!.originalname.split(".").pop(),
              },
              (error: any, result: any) => {
                if (error) reject(error);
                else resolve(result);
              }
            )
            .end(req.file!.buffer);
        });

        console.log(`File uploaded to Cloudinary: User ${req.user!.userId}`);

        res.json({
          success: true,
          fileUrl: (uploadResult as any).secure_url,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          publicId: (uploadResult as any).public_id,
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        res.status(500).json({ error: "Failed to upload file" });
      }
    }
  );

  // Upload interview recordings to Cloudinary
  // app.post(
  //   "/api/interviews/:id/upload-recording",
  //   authenticateToken,
  //   upload.single("video"),
  //   async (req: AuthenticatedRequest, res: Response) => {
  //     try {
  //       const interviewId = parseInt(req.params.id);

  //       // Verify interview ownership
  //       const interview = await storage.getInterviewById(interviewId);
  //       if (!interview || interview.userId !== req.user!.userId) {
  //         return res.status(403).json({ error: "Access denied" });
  //       }

  //       if (!req.file) {
  //         return res.status(400).json({ error: "No video file provided" });
  //       }

  //       const recordingType = req.body.type || "video";
  //       const publicId = `interviews/${interviewId}-${recordingType}-${Date.now()}`;

  //       // Check if Cloudinary is configured
  //       if (!process.env.CLOUDINARY_CLOUD_NAME) {
  //         return res.status(500).json({ error: "Cloudinary not configured" });
  //       }

  //       // Upload to Cloudinary
  //       const uploadResult = await new Promise((resolve, reject) => {
  //         cloudinary.uploader
  //           .upload_stream(
  //             {
  //               resource_type: "video",
  //               public_id: publicId,
  //               format: "mp4",
  //               transformation: [{ quality: "auto", fetch_format: "auto" }],
  //             },
  //             (error, result) => {
  //               if (error) reject(error);
  //               else resolve(result);
  //             }
  //           )
  //           .end(req.file!.buffer);
  //       });

  //       console.log(
  //         `Recording uploaded to Cloudinary: Interview ${interviewId}, Type: ${recordingType}`
  //       );

  //       res.json({
  //         url: (uploadResult as any).secure_url,
  //         type: recordingType,
  //         publicId: (uploadResult as any).public_id,
  //       });
  //     } catch (error) {
  //       console.error("Error uploading recording to Cloudinary:", error);
  //       res.status(500).json({ error: "Failed to upload recording" });
  //     }
  //   }
  // );

  // Get interview responses with audio transcription
  app.get(
    "/api/interview-responses/:interviewId",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const interviewId = parseInt(req.params.interviewId);

        // Verify interview ownership
        const interview = await storage.getInterviewById(interviewId);
        if (!interview || interview.userId !== req.user!.userId) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Get responses with questions
        const responses = await db
          .select({
            id: interviewResponses.id,
            questionId: interviewResponses.questionId,
            audioTranscription: interviewResponses.audioTranscription,
            screenAnalysis: interviewResponses.screenAnalysis,
            timeSpent: interviewResponses.timeSpent,
            aiScore: interviewResponses.aiScore,
            aiAnalysis: interviewResponses.aiAnalysis,
            introductionScore: interviewResponses.introductionScore,
            technicalScore: interviewResponses.technicalScore,
            question: interviewQuestions.question,
            questionType: interviewQuestions.questionType,
          })
          .from(interviewResponses)
          .innerJoin(
            interviewQuestions,
            eq(interviewResponses.questionId, interviewQuestions.id)
          )
          .where(eq(interviewResponses.interviewId, interviewId));

        res.json(responses);
      } catch (error) {
        console.error("Error fetching interview responses:", error);
        res.status(500).json({ error: "Failed to fetch responses" });
      }
    }
  );

  // Admin Course Questions Management - Secure endpoints
  app.get(
    "/api/admin/assessments",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "50"), 10) || 50));
        const search = String(req.query.search || "").trim();
        const requestedPurpose = String(req.query.purpose || "all");
        if (!["all", "certification", "practice"].includes(requestedPurpose)) {
          return res.status(400).json({ message: "Choose all, certification, or practice assessments" });
        }
        const conditions = [eq(coursesTable.ownerType, "admin"), eq(coursesTable.productType, "assessment")];
        if (requestedPurpose !== "all") {
          conditions.push(eq(coursesTable.assessmentPurpose, requestedPurpose));
        }
        if (search) conditions.push(or(ilike(coursesTable.title, `%${search}%`), ilike(coursesTable.slug, `%${search}%`))!);
        const where = and(...conditions)!;
        const [{ total }] = await db.select({ total: count() }).from(coursesTable).where(where);
        const [summary] = await db.select({
          total: count(),
          certification: sql<number>`count(*) filter (where ${coursesTable.assessmentPurpose} = 'certification')`,
          practice: sql<number>`count(*) filter (where ${coursesTable.assessmentPurpose} = 'practice')`,
          published: sql<number>`count(*) filter (where ${coursesTable.isActive} = true and ${coursesTable.visibility} = 'public' and ${coursesTable.reviewStatus} = 'approved')`,
          inReview: sql<number>`count(*) filter (where not (${coursesTable.isActive} = true and ${coursesTable.visibility} = 'public' and ${coursesTable.reviewStatus} = 'approved'))`,
        }).from(coursesTable).where(and(
          eq(coursesTable.ownerType, "admin"),
          eq(coursesTable.productType, "assessment"),
        ));
        const items = await db.select({
          id: coursesTable.id, title: coursesTable.title, slug: coursesTable.slug,
          description: coursesTable.description, duration: coursesTable.duration,
          assessmentPurpose: coursesTable.assessmentPurpose,
          passingScore: coursesTable.passingScore,
          isActive: coursesTable.isActive, visibility: coursesTable.visibility,
          reviewStatus: coursesTable.reviewStatus, certificationMode: coursesTable.certificationMode,
          useBlueprintEngine: coursesTable.useBlueprintEngine,
          category: { id: categoriesTable.id, name: categoriesTable.name, slug: categoriesTable.slug },
          questionCount: sql<number>`COALESCE((select sum(question_count) from course_question_blueprint where course_id = ${coursesTable.id}), (select count(*) from questions where questions.course_id = ${coursesTable.id}), 0)`,
          approvedQuestionInventory: sql<number>`(
            select count(distinct q.id)
            from course_question_blueprint blueprint
            inner join questions q on q.bank_id = blueprint.bank_id
              and (blueprint.topic_id is null or q.topic_id = blueprint.topic_id)
              and (blueprint.difficulty = 'mixed' or q.difficulty = blueprint.difficulty)
            inner join question_banks blueprint_bank on blueprint_bank.id = blueprint.bank_id
              and blueprint_bank.bank_purpose = ${coursesTable.assessmentPurpose}
              and blueprint_bank.status = 'active'
            where blueprint.course_id = ${coursesTable.id}
              and q.is_active = true
              and q.review_status = 'approved'
              and q.reviewed_by is not null
              and q.reviewed_at is not null
              and q.question_format in ('mcq_single', 'true_false')
              and json_typeof(q.options) = 'array'
              and q.correct_answer >= 0
              and q.correct_answer < json_array_length(q.options)
          )`,
          requiredQuestionInventory: sql<number>`GREATEST(CASE WHEN ${coursesTable.assessmentPurpose} = 'practice' THEN 200 ELSE 80 END, COALESCE((select sum(question_count) from course_question_blueprint where course_id = ${coursesTable.id}), 0) * CASE WHEN ${coursesTable.assessmentPurpose} = 'practice' THEN 5 ELSE 4 END)`,
          undersuppliedRuleCount: sql<number>`(
            select count(*)
            from course_question_blueprint blueprint
            where blueprint.course_id = ${coursesTable.id}
              and (
                not exists (
                  select 1 from question_banks blueprint_bank
                  where blueprint_bank.id = blueprint.bank_id
                    and blueprint_bank.bank_purpose = ${coursesTable.assessmentPurpose}
                    and blueprint_bank.status = 'active'
                )
                or (
                  select count(*)
                  from questions q
                  where q.bank_id = blueprint.bank_id
                    and (blueprint.topic_id is null or q.topic_id = blueprint.topic_id)
                    and q.is_active = true
                    and q.review_status = 'approved'
                    and q.reviewed_by is not null
                    and q.reviewed_at is not null
                    and q.question_format in ('mcq_single', 'true_false')
                    and json_typeof(q.options) = 'array'
                    and q.correct_answer >= 0
                    and q.correct_answer < json_array_length(q.options)
                    and (blueprint.difficulty = 'mixed' or q.difficulty = blueprint.difficulty)
                ) < blueprint.question_count
                  * case when ${coursesTable.assessmentPurpose} = 'practice' then 5 else 4 end
              )
          )`,
          bankCount: sql<number>`(select count(distinct bank_id) from course_question_blueprint where course_id = ${coursesTable.id})`,
          bankNames: sql<string[]>`COALESCE((select array_agg(distinct bank.name order by bank.name) from course_question_blueprint blueprint inner join question_banks bank on bank.id = blueprint.bank_id where blueprint.course_id = ${coursesTable.id}), ARRAY[]::text[])`,
          difficultyRules: sql<string[]>`COALESCE((select array_agg(distinct difficulty order by difficulty) from course_question_blueprint where course_id = ${coursesTable.id}), ARRAY[]::text[])`,
        }).from(coursesTable).leftJoin(categoriesTable, eq(categoriesTable.id, coursesTable.categoryId))
          .where(where).orderBy(desc(coursesTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
        res.json({
          items,
          pagination: { page, pageSize, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)) },
          summary: {
            total: Number(summary?.total || 0),
            certification: Number(summary?.certification || 0),
            practice: Number(summary?.practice || 0),
            published: Number(summary?.published || 0),
            inReview: Number(summary?.inReview || 0),
          },
        });
      } catch (error) {
        console.error("Error fetching admin assessments:", error);
        res.status(500).json({ message: "Failed to fetch assessments" });
      }
    },
  );

  app.get(
    "/api/admin/question-banks",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "25"), 10) || 25));
        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "all");
        const requestedPurpose = String(req.query.purpose || "all");
        if (!["all", "certification", "practice"].includes(requestedPurpose)) {
          return res.status(400).json({ message: "Choose all, certification, or practice question banks" });
        }
        if (!["all", "current", "active", "draft", "archived"].includes(status)) {
          return res.status(400).json({ message: "Choose a valid question-bank lifecycle state" });
        }
        const filters = [];
        if (requestedPurpose !== "all") {
          filters.push(eq(questionBanksTable.bankPurpose, requestedPurpose));
        }
        if (status === "current") filters.push(not(eq(questionBanksTable.status, "archived")));
        else if (status !== "all") filters.push(eq(questionBanksTable.status, status));
        if (search) filters.push(or(ilike(questionBanksTable.name, `%${search}%`), ilike(questionBanksTable.slug, `%${search}%`))!);
        const where = filters.length ? and(...filters)! : undefined;
        const [{ total }] = await db.select({ total: count() }).from(questionBanksTable).where(where);
        const [summary] = await db.select({
          total: count(),
          certification: sql<number>`count(*) filter (where ${questionBanksTable.bankPurpose} = 'certification')`,
          practice: sql<number>`count(*) filter (where ${questionBanksTable.bankPurpose} = 'practice')`,
          active: sql<number>`count(*) filter (where ${questionBanksTable.status} = 'active')`,
          draft: sql<number>`count(*) filter (where ${questionBanksTable.status} = 'draft')`,
          archived: sql<number>`count(*) filter (where ${questionBanksTable.status} = 'archived')`,
        }).from(questionBanksTable);
        const items = await db.select({
          id: questionBanksTable.id,
          name: questionBanksTable.name,
          slug: questionBanksTable.slug,
          description: questionBanksTable.description,
          ownerType: questionBanksTable.ownerType,
          visibility: questionBanksTable.visibility,
          bankPurpose: questionBanksTable.bankPurpose,
          bankKind: questionBanksTable.bankKind,
          status: questionBanksTable.status,
          subject: questionBanksTable.subject,
          examFamily: questionBanksTable.examFamily,
          gradeBand: questionBanksTable.gradeBand,
          syllabusVersion: questionBanksTable.syllabusVersion,
          questionCount: sql<number>`(
            select count(*)
            from questions
            where bank_id = ${questionBanksTable.id}
              and review_status = 'approved'
              and is_active = true
              and reviewed_by is not null
              and reviewed_at is not null
              and question_format in ('mcq_single', 'true_false')
              and json_typeof(options) = 'array'
              and correct_answer >= 0
              and correct_answer < json_array_length(options)
          )`,
          totalQuestionCount: sql<number>`(select count(*) from questions where bank_id = ${questionBanksTable.id} and review_status <> 'retired')`,
          retiredQuestionCount: sql<number>`(select count(*) from questions where bank_id = ${questionBanksTable.id} and review_status = 'retired')`,
          topicCount: sql<number>`(select count(*) from question_topics where bank_id = ${questionBanksTable.id})`,
          easyCount: sql<number>`(select count(*) from questions where bank_id = ${questionBanksTable.id} and difficulty = 'easy' and review_status = 'approved' and is_active = true and reviewed_by is not null and reviewed_at is not null and question_format in ('mcq_single', 'true_false') and json_typeof(options) = 'array' and correct_answer >= 0 and correct_answer < json_array_length(options))`,
          mediumCount: sql<number>`(select count(*) from questions where bank_id = ${questionBanksTable.id} and difficulty = 'medium' and review_status = 'approved' and is_active = true and reviewed_by is not null and reviewed_at is not null and question_format in ('mcq_single', 'true_false') and json_typeof(options) = 'array' and correct_answer >= 0 and correct_answer < json_array_length(options))`,
          hardCount: sql<number>`(select count(*) from questions where bank_id = ${questionBanksTable.id} and difficulty = 'hard' and review_status = 'approved' and is_active = true and reviewed_by is not null and reviewed_at is not null and question_format in ('mcq_single', 'true_false') and json_typeof(options) = 'array' and correct_answer >= 0 and correct_answer < json_array_length(options))`,
          assessmentCount: sql<number>`(select count(distinct course_id) from course_question_blueprint where bank_id = ${questionBanksTable.id})`,
          updatedAt: questionBanksTable.updatedAt,
        }).from(questionBanksTable).where(where).orderBy(desc(questionBanksTable.questionCount), desc(questionBanksTable.updatedAt)).limit(pageSize).offset((page - 1) * pageSize);
        res.json({
          items,
          pagination: { page, pageSize, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)) },
          summary: {
            total: Number(summary?.total || 0),
            certification: Number(summary?.certification || 0),
            practice: Number(summary?.practice || 0),
            active: Number(summary?.active || 0),
            draft: Number(summary?.draft || 0),
            archived: Number(summary?.archived || 0),
          },
        });
      } catch (error) {
        console.error("Error fetching admin question banks:", error);
        res.status(500).json({ message: "Failed to fetch question banks" });
      }
    },
  );

  app.post(
    "/api/admin/assessments/bulk-action",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = z.object({
          ids: z.array(z.number().int().positive()).min(1).max(200),
          action: z.enum(["publish", "unpublish", "delete"]),
          confirmation: z.string().optional(),
        }).strict().safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "Select assessments and a valid action" });
        const ids = Array.from(new Set(parsed.data.ids));
        if (parsed.data.action === "delete") {
          if (parsed.data.confirmation !== "DELETE") return res.status(400).json({ message: "Type DELETE to confirm permanent removal" });
          for (const id of ids) await storage.deleteCourseAdmin(id);
          return res.json({ action: "delete", affected: ids.length });
        }
        if (parsed.data.action === "publish") { return res.status(409).json({ message: "Bulk publication is disabled. Review and publish each assessment through its guarded release workflow.", code: "BULK_ASSESSMENT_PUBLISH_DISABLED", }); }
        const result = await db.execute(sql`
          UPDATE courses SET is_active = false, visibility = 'private', subscription_eligible = false
          WHERE id IN (${sql.join(ids.map((id) => sql`${id}`), sql`,`)})
            AND owner_type = 'admin' AND product_type = 'assessment'
          RETURNING id
        `);
        res.json({ action: "unpublish", affected: result.rowCount || 0 });
      } catch (error) {
        console.error("Assessment bulk action failed:", error);
        res.status(500).json({ message: "Assessment bulk action failed" });
      }
    },
  );

  app.post(
    "/api/admin/question-banks/bulk-action",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = z.object({
          ids: z.array(z.number().int().positive()).min(1).max(100),
          action: z.enum(["activate", "draft", "archive"]),
          confirmation: z.string().optional(),
        }).strict().safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "Select question banks and a valid action" });
        if (parsed.data.action === "archive" && parsed.data.confirmation !== "ARCHIVE") {
          return res.status(400).json({ message: "Type ARCHIVE to confirm" });
        }
        const ids = Array.from(new Set(parsed.data.ids));
        const status = parsed.data.action === "activate" ? "active" : parsed.data.action;
        const result = await db.transaction(async (tx) => {
          await tx.select({ id: questionBanksTable.id })
            .from(questionBanksTable)
            .where(inArray(questionBanksTable.id, ids))
            .orderBy(questionBanksTable.id)
            .for("update");
          await tx.execute(sql`
            SELECT course.id
            FROM courses course
            WHERE EXISTS (
              SELECT 1 FROM course_question_blueprint blueprint
              WHERE blueprint.course_id = course.id
                AND blueprint.bank_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`,`)})
            )
            ORDER BY course.id
            FOR UPDATE
          `);
          return tx.execute(sql`
            UPDATE question_banks bank SET status = ${status}, updated_at = now()
            WHERE bank.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`,`)})
              AND (
                ${status} = 'active'
                OR NOT EXISTS (
                  SELECT 1 FROM course_question_blueprint blueprint
                  INNER JOIN courses course ON course.id = blueprint.course_id
                  WHERE blueprint.bank_id = bank.id
                    AND course.is_active = true AND course.visibility = 'public'
                )
              )
            RETURNING bank.id
          `);
        });
        res.json({ action: parsed.data.action, affected: result.rowCount || 0, skipped: ids.length - (result.rowCount || 0) });
      } catch (error) {
        console.error("Question-bank bulk action failed:", error);
        res.status(500).json({ message: "Question-bank bulk action failed" });
      }
    },
  );

  app.post(
    "/api/admin/question-banks/:id/bulk-review",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const bankId = Number(req.params.id);
        const parsed = z.object({ action: z.literal("deactivate"), confirmation: z.string() }).strict().safeParse(req.body);
        if (!Number.isInteger(bankId) || bankId <= 0 || !parsed.success) return res.status(400).json({ message: "Invalid bulk review request" });
        if (parsed.data.confirmation !== "DEACTIVATE") return res.status(400).json({ message: "Type DEACTIVATE to confirm" });
        const result = await db.transaction(async (tx) => {
          const updated = await tx.execute(sql`
            UPDATE questions SET is_active = false, updated_at = now()
            WHERE bank_id = ${bankId} AND is_active = true
          `);
          if (Number(updated.rowCount || 0) > 0) {
            await unpublishPublishedAssessmentsUsingBanks(tx, [bankId]);
          }
          return updated;
        });
        res.json({ action: "deactivate", affected: result.rowCount || 0 });
      } catch (error) {
        console.error("Question-bank bulk review failed:", error);
        res.status(500).json({ message: "Question-bank bulk review failed" });
      }
    },
  );

  app.post(
    "/api/admin/question-banks",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = z.object({
          name: z.string().trim().min(3).max(160),
          description: z.string().trim().max(2000).optional(),
          visibility: z.enum(["private", "unlisted", "public"]).default("private"),
          bankPurpose: z.enum(["certification", "practice"]).default("certification"),
          bankKind: z.enum(["assessment_pool", "subject_pool", "master", "custom"]).default("custom"),
          status: z.enum(["draft", "active", "archived"]).default("draft"),
          subject: z.string().trim().max(120).optional(),
          examFamily: z.string().trim().max(120).optional(),
          gradeBand: z.string().trim().max(80).optional(),
          syllabusVersion: z.string().trim().max(120).optional(),
        }).strict().safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: "Check the bank details" });
        const row = await storage.createQuestionBank({ ...parsed.data, slug: `${slugifyCourseTitle(parsed.data.name)}-${Date.now().toString(36)}`, ownerType: "admin", ownerId: null, createdBy: req.user?.userId || null });
        res.status(201).json(row);
      } catch (error) {
        console.error("Question bank creation failed:", error);
        res.status(500).json({ message: "Question bank creation failed" });
      }
    },
  );

  app.patch(
    "/api/admin/question-banks/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      const id = Number(req.params.id);
      const parsed = z.object({
        name: z.string().trim().min(3).max(160).optional(),
        description: z.string().trim().max(2000).optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        bankPurpose: z.enum(["certification", "practice"]).optional(),
        bankKind: z.enum(["assessment_pool", "subject_pool", "master", "custom"]).optional(),
        status: z.enum(["draft", "active", "archived"]).optional(),
        subject: z.string().trim().max(120).nullable().optional(),
        examFamily: z.string().trim().max(120).nullable().optional(),
        gradeBand: z.string().trim().max(80).nullable().optional(),
        syllabusVersion: z.string().trim().max(120).nullable().optional(),
      }).strict().safeParse(req.body);
      if (!Number.isInteger(id) || id <= 0 || !parsed.success) return res.status(400).json({ message: "Invalid bank update" });
      const existing = await storage.getQuestionBank(id);
      if (!existing) return res.status(404).json({ message: "Question bank not found" });
      if (
        (parsed.data.bankPurpose && parsed.data.bankPurpose !== existing.bankPurpose)
        || (parsed.data.status && parsed.data.status !== "active")
      ) {
        const [usage] = await db.select({
          total: count(),
          live: sql<number>`count(*) filter (where ${coursesTable.isActive} = true and ${coursesTable.visibility} = 'public' and ${coursesTable.reviewStatus} = 'approved')`,
        }).from(courseQuestionBlueprint)
          .innerJoin(coursesTable, eq(coursesTable.id, courseQuestionBlueprint.courseId))
          .where(eq(courseQuestionBlueprint.bankId, id));
        if (parsed.data.bankPurpose && parsed.data.bankPurpose !== existing.bankPurpose && Number(usage?.total || 0) > 0) {
          return res.status(409).json({
            message: "Remove this bank from every assessment blueprint before changing its purpose.",
            code: "QUESTION_BANK_PURPOSE_IN_USE",
          });
        }
        if (parsed.data.status && parsed.data.status !== "active" && Number(usage?.live || 0) > 0) {
          return res.status(409).json({
            message: "Unpublish linked assessments before moving this question bank out of active status.",
            code: "QUESTION_BANK_LIVE_ASSESSMENT_IN_USE",
          });
        }
      }
      try {
        const row = await storage.updateQuestionBank(id, parsed.data);
        res.json(row);
      } catch (error) {
        if ((error as { code?: string }).code === "QUESTION_BANK_PURPOSE_IN_USE") {
          return res.status(409).json({
            message: error instanceof Error ? error.message : "Question bank purpose is in use",
            code: "QUESTION_BANK_PURPOSE_IN_USE",
          });
        }
        throw error;
      }
    },
  );

  app.delete(
    "/api/admin/question-banks/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid bank" });
        const [usage] = await db.select({ total: count() }).from(courseQuestionBlueprint).where(eq(courseQuestionBlueprint.bankId, id));
        if (Number(usage?.total || 0) > 0) return res.status(409).json({ message: "This bank is assigned to an assessment blueprint and cannot be deleted. Replace those rules or archive the bank." });
        const [history] = await db.select({ total: count() }).from(questionPackImportRuns).where(eq(questionPackImportRuns.bankId, id));
        if (Number(history?.total || 0) > 0) return res.status(409).json({ message: "Imported banks cannot be deleted because provenance must be retained. Deactivate their questions instead." });
        await storage.deleteQuestionBank(id);
        res.json({ deleted: true });
      } catch (error) {
        res.status(500).json({ message: "Question bank deletion failed" });
      }
    },
  );

  app.get(
    "/api/admin/questions",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { courseId, search } = req.query;
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "50"), 10) || 50));
        const questions = await storage.getQuestionsForAdmin(
          courseId ? parseInt(courseId as string) : undefined,
          search as string,
          page,
          pageSize,
        );
        res.json(questions);
      } catch (error) {
        console.error("Error fetching questions:", error);
        res.status(500).json({ message: "Failed to fetch questions" });
      }
    }
  );

  app.post(
    "/api/admin/questions",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          bankId: _bankId,
          topicId: _topicId,
          generationSource: _generationSource,
          reviewStatus: _reviewStatus,
          reviewedBy: _reviewedBy,
          reviewedAt: _reviewedAt,
          ...questionData
        } = req.body || {};

        // Validate required fields
        if (
          !questionData.courseId ||
          !questionData.question ||
          !questionData.options ||
          questionData.correctAnswer === undefined
        ) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const reviewerId = Number(req.user?.userId);
        const question = await storage.createQuestion({
          ...questionData,
          generationSource: "human",
          reviewStatus: "approved",
          isActive: true,
          reviewedBy: Number.isInteger(reviewerId) && reviewerId > 0 ? reviewerId : null,
          reviewedAt: new Date(),
          createdBy: Number.isInteger(reviewerId) && reviewerId > 0 ? reviewerId : null,
        });
        res.status(201).json(question);
      } catch (error) {
        console.error("Error creating question:", error);
        res.status(500).json({ message: "Failed to create question" });
      }
    }
  );

  app.put(
    "/api/admin/questions/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const questionId = parseInt(req.params.id);
        if (isNaN(questionId)) {
          return res.status(400).json({ message: "Invalid question ID" });
        }
        const [existing] = await db.select({ bankId: questionsTable.bankId })
          .from(questionsTable)
          .where(eq(questionsTable.id, questionId));
        if (!existing) return res.status(404).json({ message: "Question not found" });
        if (existing.bankId != null) {
          return res.status(409).json({
            message: "Bank questions must be edited and reviewed through Question Banks.",
            code: "QUESTION_BANK_GOVERNANCE_REQUIRED",
          });
        }

        const reviewerId = Number(req.user?.userId);
        const {
          generationSource: _generationSource,
          reviewStatus: _reviewStatus,
          reviewedBy: _reviewedBy,
          reviewedAt: _reviewedAt,
          ...questionUpdates
        } = req.body || {};
        const updates = {
          ...questionUpdates,
          reviewStatus: "approved",
          isActive: true,
          reviewedBy: Number.isInteger(reviewerId) && reviewerId > 0 ? reviewerId : null,
          reviewedAt: new Date(),
        };
        const question = await storage.updateQuestionAdmin(questionId, updates);
        if (!question) {
          return res.status(404).json({ message: "Question not found" });
        }
        res.json(question);
      } catch (error) {
        console.error("Error updating question:", error);
        res.status(500).json({ message: "Failed to update question" });
      }
    }
  );

  app.delete(
    "/api/admin/questions/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const questionId = parseInt(req.params.id);
        if (isNaN(questionId)) {
          return res.status(400).json({ message: "Invalid question ID" });
        }
        const [existing] = await db.select({ bankId: questionsTable.bankId })
          .from(questionsTable)
          .where(eq(questionsTable.id, questionId));
        if (!existing) return res.status(404).json({ message: "Question not found" });
        if (existing.bankId != null) {
          return res.status(409).json({
            message: "Bank questions must be retired through Question Banks so their review history is preserved.",
            code: "QUESTION_BANK_GOVERNANCE_REQUIRED",
          });
        }

        const reviewerId = Number(req.user?.userId);
        const deleted = await storage.deleteQuestionAdmin(
          questionId,
          Number.isInteger(reviewerId) && reviewerId > 0 ? reviewerId : undefined,
        );
        if (!deleted) {
          return res.status(404).json({ message: "Question not found" });
        }
        res.json({
          message: deleted.reviewStatus === "retired"
            ? "Question retired; imported provenance retained"
            : "Question deleted successfully",
          status: deleted.reviewStatus === "retired" ? "retired" : "deleted",
        });
      } catch (error) {
        console.error("Error deleting question:", error);
        res.status(500).json({ message: "Failed to delete question" });
      }
    }
  );

  // Admin Interview Questions Management - Secure endpoints
  app.get(
    "/api/admin/interview-questions",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { technology, search } = req.query;
        const questions = await storage.getInterviewQuestionsForAdmin(
          technology as string,
          search as string
        );
        res.json(questions);
      } catch (error) {
        console.error("Error fetching interview questions:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch interview questions" });
      }
    }
  );

  app.post(
    "/api/admin/interview-questions",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const questionData = req.body;

        // Validate required fields
        if (
          !questionData.technology ||
          !questionData.title ||
          !questionData.question
        ) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const question = await storage.createInterviewQuestion(questionData);
        res.status(201).json(question);
      } catch (error) {
        console.error("Error creating interview question:", error);
        res
          .status(500)
          .json({ message: "Failed to create interview question" });
      }
    }
  );

  app.put(
    "/api/admin/interview-questions/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const questionId = parseInt(req.params.id);
        if (isNaN(questionId)) {
          return res
            .status(400)
            .json({ message: "Invalid interview question ID" });
        }

        const updates = req.body;
        const question = await storage.updateInterviewQuestion(
          questionId,
          updates
        );
        if (!question) {
          return res
            .status(404)
            .json({ message: "Interview question not found" });
        }
        res.json(question);
      } catch (error) {
        console.error("Error updating interview question:", error);
        res
          .status(500)
          .json({ message: "Failed to update interview question" });
      }
    }
  );

  app.delete(
    "/api/admin/interview-questions/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const questionId = parseInt(req.params.id);
        if (isNaN(questionId)) {
          return res
            .status(400)
            .json({ message: "Invalid interview question ID" });
        }

        const deleted = await storage.deleteInterviewQuestion(questionId);
        if (!deleted) {
          return res
            .status(404)
            .json({ message: "Interview question not found" });
        }
        res.json({ message: "Interview question deleted successfully" });
      } catch (error) {
        console.error("Error deleting interview question:", error);
        res
          .status(500)
          .json({ message: "Failed to delete interview question" });
      }
    }
  );

  // Admin Contact Submissions Management - Secure endpoints
  app.put(
    "/api/admin/contacts/:id",
    authenticateAdminToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const contactId = parseInt(req.params.id);
        if (isNaN(contactId)) {
          return res.status(400).json({ message: "Invalid contact ID" });
        }

        const updates = req.body;
        const contact = await storage.updateContactSubmissionStatus(
          contactId,
          updates.status,
          updates.adminNotes
        );
        if (!contact) {
          return res
            .status(404)
            .json({ message: "Contact submission not found" });
        }
        res.json(contact);
      } catch (error) {
        console.error("Error updating contact submission:", error);
        res
          .status(500)
          .json({ message: "Failed to update contact submission" });
      }
    }
  );

  // Import and add new routes
  // Add user interviews endpoint with detailed logging
  app.get(
    "/api/user/interviews",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        console.log(`Fetching interviews for user ID: ${req.user!.userId}`);

        const userInterviews = await db
          .select()
          .from(interviews)
          .where(eq(interviews.userId, req.user!.userId))
          .orderBy(desc(interviews.createdAt));

        console.log(
          `Found ${userInterviews.length} interviews for user ${
            req.user!.userId
          }`
        );

        res.json(userInterviews);
      } catch (error) {
        console.error("Error fetching user interviews:", error);
        res.status(500).json({ error: "Failed to fetch interviews" });
      }
    }
  );

  try {
    // AI Interview routes removed.
    const { default: analyticsRoutes } = await import("./routes/analytics");
    app.use("/api", analyticsRoutes);
  } catch (error) {
    console.log("Additional routes loading...");
  }

  // Rating system routes
  app.post("/api/ratings", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const { courseId, rating, reviewText } = req.body;

      if (!courseId || !rating || rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "Valid courseId and rating (1-5) required" });
      }

      const userId = req.user.id ?? req.user.userId;

      // Check if user already rated this course
      const existingRating = await storage.getUserRating(userId, courseId);

      let result;
      if (existingRating) {
        // Update existing rating
        result = await storage.updateRating(
          userId,
          courseId,
          rating,
          reviewText
        );
      } else {
        // Create new rating
        result = await storage.createRating({
          userId,
          courseId,
          rating,
          reviewText,
        });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error creating/updating rating:", error);
      res.status(500).json({ message: "Failed to save rating" });
    }
  });

  app.get("/api/ratings/:courseId", async (req, res) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const ratings = await storage.getCourseRatings(courseId, limit, offset);
      const aggregate = await storage.getRatingAggregate(courseId);

      res.json({
        ratings,
        aggregate: aggregate || {
          averageRating: "0.00",
          totalReviews: 0,
          rating1Count: 0,
          rating2Count: 0,
          rating3Count: 0,
          rating4Count: 0,
          rating5Count: 0,
        },
      });
    } catch (error: any) {
      console.error("Error fetching ratings:", error);
      res.status(500).json({ message: "Failed to fetch ratings" });
    }
  });

  app.get("/api/user-rating/:courseId", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const courseId = parseInt(req.params.courseId);
      const userId = req.user.id ?? req.user.userId;
      const userRating = await storage.getUserRating(userId, courseId);

      res.json(userRating || null);
    } catch (error: any) {
      console.error("Error fetching user rating:", error);
      res.status(500).json({ message: "Failed to fetch user rating" });
    }
  });

  // ============================================================
  // Identity foundation: creators, institutes, role aggregation
  // ============================================================

  const slugify = (s: string): string =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `user-${Date.now()}`;

  const ensureUniqueCreatorSlug = async (base: string): Promise<string> => {
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await storage.getCreatorBySlug(slug)) {
      slug = `${base}-${n++}`;
      if (n > 50) {
        slug = `${base}-${Date.now()}`;
        break;
      }
    }
    return slug;
  };

  const ensureUniqueInstituteSlug = async (base: string): Promise<string> => {
    let slug = base;
    let n = 1;
    while (await storage.getInstituteBySlug(slug)) {
      slug = `${base}-${n++}`;
      if (n > 50) {
        slug = `${base}-${Date.now()}`;
        break;
      }
    }
    return slug;
  };

  // Aggregate role flags for the authenticated user
  app.get("/api/me/roles", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roles = await storage.getUserRoles(req.user!.userId);
      res.json(roles);
    } catch (error) {
      console.error("getUserRoles error:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  // Onboarding: create a Creator profile (idempotent)
  app.post(
    "/api/onboarding/creator",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const existing = await storage.getCreatorByUserId(userId);
        if (existing) return res.json({ creator: existing, created: false });

        const { displayName, slug, bio, avatarUrl, websiteUrl, twitterHandle, instagramHandle } =
          req.body || {};
        if (!displayName || typeof displayName !== "string") {
          return res.status(400).json({ message: "displayName is required" });
        }

        const finalSlug = await ensureUniqueCreatorSlug(slug ? slugify(slug) : slugify(displayName));
        const creator = await storage.createCreator({
          userId,
          displayName,
          slug: finalSlug,
          bio: bio || null,
          avatarUrl: avatarUrl || null,
          websiteUrl: websiteUrl || null,
          twitterHandle: twitterHandle || null,
          instagramHandle: instagramHandle || null,
          status: "pending",
          plan: "free",
        } as any);
        res.status(201).json({ creator, created: true });
      } catch (error) {
        console.error("creator onboarding error:", error);
        res.status(500).json({ message: "Failed to create creator profile" });
      }
    },
  );

  // Onboarding: create an Institute and add user as owner (idempotent)
  app.post(
    "/api/onboarding/institute",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const existing = await storage.getInstituteByUserId(userId);
        if (existing) return res.json({ institute: existing, created: false });

        const {
          name,
          slug,
          legalName,
          contactEmail,
          contactPhone,
          sizeRange,
          industry,
          websiteUrl,
          addressLine1,
          addressLine2,
          city,
          state,
          country,
          pincode,
          gstin,
          pan,
        } = req.body || {};
        if (!name || typeof name !== "string") {
          return res.status(400).json({ message: "name is required" });
        }

        const finalSlug = await ensureUniqueInstituteSlug(slug ? slugify(slug) : slugify(name));
        const institute = await storage.createInstitute({
          name,
          slug: finalSlug,
          legalName: legalName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          sizeRange: sizeRange || null,
          industry: industry || null,
          websiteUrl: websiteUrl || null,
          addressLine1: addressLine1 || null,
          addressLine2: addressLine2 || null,
          city: city || null,
          state: state || null,
          country: country || "India",
          pincode: pincode || null,
          gstin: gstin || null,
          pan: pan || null,
          status: "pending",
          plan: "starter",
        } as any);

        await storage.addInstituteMember(institute.id, userId, "owner", "active");
        res.status(201).json({ institute, created: true });
      } catch (error) {
        console.error("institute onboarding error:", error);
        res.status(500).json({ message: "Failed to create institute" });
      }
    },
  );

  // Onboarding: recruiter (currently a thin pass-through; recruiter portal owns creation)
  app.post(
    "/api/onboarding/recruiter",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.userId;
        const user = await storage.getUser(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // If a recruiter row already exists with this email, treat as no-op.
        const [existing] = await db
          .select()
          .from(recruitersTable)
          .where(eq(recruitersTable.email, user.email));
        if (existing) {
          return res.json({ recruiter: existing, created: false });
        }

        const { companyName, companySize, hiringFor } = req.body || {};
        if (!companyName) {
          return res.status(400).json({ message: "companyName is required" });
        }

        // Minimal recruiter row — the existing recruiter portal handles full KYC.
        const [recruiter] = await db
          .insert(recruitersTable)
          .values({
            email: user.email,
            password: "", // OAuth-style; recruiter portal can set later
            firstName: (user.name || "").split(" ")[0] || "",
            lastName: (user.name || "").split(" ").slice(1).join(" ") || "",
            phone: user.phone || "",
            designation: "",
            companyName,
            companySize: companySize || "1-10",
            industry: hiringFor || "",
            companyAddress: "",
            companyCity: "",
            companyState: "",
            companyCountry: "India",
          })
          .returning();
        res.status(201).json({ recruiter, created: true });
      } catch (error) {
        console.error("recruiter onboarding error:", error);
        res.status(500).json({ message: "Failed to create recruiter profile" });
      }
    },
  );

  // Read-back endpoints used by dashboards
  app.get(
    "/api/me/creator",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const creator = await storage.getCreatorByUserId(req.user!.userId);
        if (!creator) return res.status(404).json({ message: "Not a creator" });
        res.json(creator);
      } catch (error) {
        console.error("get me/creator error:", error);
        res.status(500).json({ message: "Failed to fetch creator" });
      }
    },
  );

  app.get(
    "/api/me/institute",
    authenticateToken,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const institute = await storage.getInstituteByUserId(req.user!.userId);
        if (!institute) return res.status(404).json({ message: "Not an institute member" });
        res.json(institute);
      } catch (error) {
        console.error("get me/institute error:", error);
        res.status(500).json({ message: "Failed to fetch institute" });
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
