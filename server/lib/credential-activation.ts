import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import {
  certificates,
  courses,
  payments,
  type Certificate,
  type Course,
  type ExamAttempt,
  type Payment,
  type User,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { calculateExpiryDate } from "../utils";
import {
  amountsMatch,
  isCredentialOwnedBy,
  normalizeCredentialEmail,
} from "./credential-activation-policy";
import { isCredentialEligibleAssessment } from "./certificate-policy";

export { amountsMatch, isCredentialOwnedBy } from "./credential-activation-policy";

const ACTIVE_CHECKOUT_WINDOW_MS = 15 * 60 * 1000;

export const CREDENTIAL_ACTIVATION_KIND = "credential_activation";

export class CredentialActivationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CredentialActivationError";
  }
}

export interface CredentialActivationContext {
  certificate: Certificate;
  course: Course;
  examAttempt: ExamAttempt;
  user: User;
  amount: string;
}

export async function getCredentialActivationContext(
  publicCertificateId: string,
  userId: number,
): Promise<CredentialActivationContext> {
  const user = await storage.getUser(userId);
  if (!user) {
    throw new CredentialActivationError("Account not found", 401, "ACCOUNT_NOT_FOUND");
  }

  const certificate = await storage.getCertificateByCertificateId(publicCertificateId);
  // Return the same response for a missing or foreign credential so this
  // authenticated endpoint cannot be used to enumerate ownership.
  if (!certificate || !isCredentialOwnedBy(certificate, user)) {
    throw new CredentialActivationError(
      "Credential not found in your account",
      404,
      "CREDENTIAL_NOT_FOUND",
    );
  }

  const [course, examAttempt] = await Promise.all([
    storage.getCourse(certificate.courseId),
    certificate.examAttemptId
      ? storage.getExamAttempt(certificate.examAttemptId)
      : Promise.resolve(undefined),
  ]);

  if (!course) {
    throw new CredentialActivationError(
      "This credential's assessment is no longer available",
      409,
      "COURSE_NOT_AVAILABLE",
    );
  }
  if (!isCredentialEligibleAssessment(course)) {
    throw new CredentialActivationError(
      "This assessment is not eligible for credential activation",
      409,
      "ASSESSMENT_NOT_CREDENTIAL_ELIGIBLE",
    );
  }
  if (
    !examAttempt ||
    !examAttempt.passed ||
    examAttempt.courseId !== certificate.courseId ||
    (examAttempt.userId != null && examAttempt.userId !== user.id) ||
    (examAttempt.userId == null && normalizeCredentialEmail(examAttempt.userEmail) !== normalizeCredentialEmail(user.email))
  ) {
    throw new CredentialActivationError(
      "The passing assessment evidence for this credential could not be verified",
      409,
      "PASSING_EVIDENCE_NOT_VERIFIED",
    );
  }

  const numericAmount = Number(course.price);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new CredentialActivationError(
      "Credential activation pricing is not available for this assessment",
      409,
      "ACTIVATION_PRICE_UNAVAILABLE",
    );
  }

  return {
    certificate,
    course,
    examAttempt,
    user,
    amount: numericAmount.toFixed(2),
  };
}

export interface ReserveCredentialActivationPaymentInput {
  context: CredentialActivationContext;
  transactionId: string;
  gateway: "cashfree" | "payumoney";
  includesPhysicalCopy: boolean;
  selectedAddressId: number | null;
  sellerCode: string;
}

/**
 * Creates one short-lived checkout reservation under a certificate-scoped DB
 * lock. This prevents rapid retries/tabs from creating multiple payable orders.
 */
export async function reserveCredentialActivationPayment(
  input: ReserveCredentialActivationPaymentInput,
): Promise<Payment> {
  const {
    context,
    transactionId,
    gateway,
    includesPhysicalCopy,
    selectedAddressId,
    sellerCode,
  } = input;
  const shippingAmount = includesPhysicalCopy ? 50 : 0;
  const totalAmount = (Number(context.amount) + shippingAmount).toFixed(2);
  const activeSince = new Date(Date.now() - ACTIVE_CHECKOUT_WINDOW_MS);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7101, ${context.certificate.id})`);

    const [freshCertificate] = await tx
      .select()
      .from(certificates)
      .where(eq(certificates.id, context.certificate.id))
      .limit(1);
    if (!freshCertificate) {
      throw new CredentialActivationError(
        "Credential not found in your account",
        404,
        "CREDENTIAL_NOT_FOUND",
      );
    }
    if (freshCertificate.userId != null && freshCertificate.userId !== context.user.id) {
      throw new CredentialActivationError(
        "Credential not found in your account",
        404,
        "CREDENTIAL_NOT_FOUND",
      );
    }
    if (
      freshCertificate.userId == null &&
      normalizeCredentialEmail(freshCertificate.userEmail) !== normalizeCredentialEmail(context.user.email)
    ) {
      throw new CredentialActivationError(
        "Credential not found in your account",
        404,
        "CREDENTIAL_NOT_FOUND",
      );
    }
    if (freshCertificate.isPaid) {
      throw new CredentialActivationError(
        "This credential is already activated",
        409,
        "ALREADY_ACTIVATED",
      );
    }
    if (!freshCertificate.isActive) {
      throw new CredentialActivationError(
        "A revoked credential cannot be activated",
        409,
        "CREDENTIAL_REVOKED",
      );
    }

    const [activeCheckout] = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.certificateId, freshCertificate.id),
          eq(payments.status, "pending"),
          gte(payments.createdAt, activeSince),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (activeCheckout) {
      throw new CredentialActivationError(
        "A secure checkout is already open for this credential. Complete it or try again in 15 minutes.",
        409,
        "CHECKOUT_ALREADY_OPEN",
      );
    }

    // Claim old email-owned rows when the authenticated account is an exact
    // match. This makes future dashboard retrieval deterministic.
    if (freshCertificate.userId == null) {
      await tx
        .update(certificates)
        .set({ userId: context.user.id })
        .where(
          and(
            eq(certificates.id, freshCertificate.id),
            isNull(certificates.userId),
          ),
        );
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        certificateId: freshCertificate.id,
        userId: context.user.id,
        courseId: context.course.id,
        transactionId,
        gateway,
        paymentMethod: gateway,
        amount: totalAmount,
        certificateAmount: context.amount,
        shippingAmount: shippingAmount.toFixed(2),
        includesPhysicalCopy,
        currency: "INR",
        status: "pending",
        cashfreeOrderId: gateway === "cashfree" ? transactionId : null,
        gatewayStatusRaw: {
          kind: CREDENTIAL_ACTIVATION_KIND,
          certificatePublicId: freshCertificate.certificateId,
          selectedAddressId,
          sellerCode,
        },
      })
      .returning();

    return payment;
  });
}

export interface FinalizeCredentialActivationInput {
  paymentId: number;
  providerPaymentId: string;
  gateway: "cashfree" | "payumoney";
  gatewayStatusRaw: Record<string, unknown>;
  cashfreeOrderId?: string | null;
}

export interface FinalizeCredentialActivationResult {
  status: "activated" | "already_completed" | "duplicate_payment";
  certificate: Certificate;
  payment: Payment;
}

/**
 * Activates an existing credential and completes its payment atomically. Only
 * call this after the gateway's signature/hash and local amount are verified.
 */
export async function finalizeCredentialActivation(
  input: FinalizeCredentialActivationInput,
): Promise<FinalizeCredentialActivationResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7102, ${input.paymentId})`);

    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .for("update")
      .limit(1);
    if (!payment || !payment.certificateId) {
      throw new CredentialActivationError(
        "Credential activation payment was not found",
        404,
        "ACTIVATION_PAYMENT_NOT_FOUND",
      );
    }

    await tx.execute(sql`SELECT pg_advisory_xact_lock(7101, ${payment.certificateId})`);
    const [certificate] = await tx
      .select()
      .from(certificates)
      .where(eq(certificates.id, payment.certificateId))
      .limit(1);
    if (!certificate) {
      throw new CredentialActivationError(
        "Credential activation record was not found",
        404,
        "CREDENTIAL_NOT_FOUND",
      );
    }

    if (!isCredentialActivationPayment(payment)) {
      throw new CredentialActivationError(
        "Payment is not a credential activation reservation",
        409,
        "ACTIVATION_PAYMENT_KIND_MISMATCH",
      );
    }
    if (payment.userId == null || certificate.userId !== payment.userId) {
      throw new CredentialActivationError(
        "Credential activation ownership could not be verified",
        409,
        "ACTIVATION_OWNER_MISMATCH",
      );
    }
    if (payment.courseId !== certificate.courseId) {
      throw new CredentialActivationError(
        "Credential activation course could not be verified",
        409,
        "ACTIVATION_COURSE_MISMATCH",
      );
    }
    if (payment.status === "completed") {
      return { status: "already_completed", certificate, payment };
    }

    const [course] = await tx
      .select()
      .from(courses)
      .where(eq(courses.id, certificate.courseId))
      .for("update")
      .limit(1);
    if (!course || !isCredentialEligibleAssessment(course)) {
      throw new CredentialActivationError(
        "This assessment is no longer eligible for credential activation",
        409,
        "ASSESSMENT_NOT_CREDENTIAL_ELIGIBLE",
      );
    }

    if (certificate.isPaid) {
      const [duplicatePayment] = await tx
        .update(payments)
        .set({
          status: "duplicate",
          gatewayStatusRaw: {
            ...input.gatewayStatusRaw,
            reason: "credential_already_activated_by_another_payment",
          },
          cashfreeOrderId: input.cashfreeOrderId ?? payment.cashfreeOrderId,
          cashfreePaymentId:
            input.gateway === "cashfree" ? input.providerPaymentId : payment.cashfreePaymentId,
          razorpayPaymentId:
            input.gateway === "payumoney" ? input.providerPaymentId : payment.razorpayPaymentId,
        })
        .where(eq(payments.id, payment.id))
        .returning();
      return { status: "duplicate_payment", certificate, payment: duplicatePayment };
    }

    if (!certificate.isActive) {
      throw new CredentialActivationError(
        "A revoked credential cannot be activated",
        409,
        "CREDENTIAL_REVOKED",
      );
    }
    const metadata = (payment.gatewayStatusRaw || {}) as Record<string, unknown>;
    const selectedAddressId = Number(metadata.selectedAddressId);
    const validSelectedAddressId = Number.isInteger(selectedAddressId) && selectedAddressId > 0
      ? selectedAddressId
      : null;
    const [activatedCertificate] = await tx
      .update(certificates)
      .set({
        isPaid: true,
        paymentId: input.providerPaymentId,
        // Validity begins when a pending evidence record becomes an activated
        // credential. This also makes old legitimate pending rows usable.
        expiresAt: calculateExpiryDate(),
        needsPhysicalCopy: payment.includesPhysicalCopy,
        shippingAddressId: payment.includesPhysicalCopy ? validSelectedAddressId : null,
        shippingStatus: payment.includesPhysicalCopy ? "pending" : "not_required",
      })
      .where(eq(certificates.id, certificate.id))
      .returning();

    const [completedPayment] = await tx
      .update(payments)
      .set({
        status: "completed",
        gateway: input.gateway,
        paymentMethod: input.gateway,
        gatewayStatusRaw: input.gatewayStatusRaw,
        cashfreeOrderId: input.cashfreeOrderId ?? payment.cashfreeOrderId,
        cashfreePaymentId:
          input.gateway === "cashfree" ? input.providerPaymentId : payment.cashfreePaymentId,
        razorpayPaymentId:
          input.gateway === "payumoney" ? input.providerPaymentId : payment.razorpayPaymentId,
        razorpayOrderId:
          input.gateway === "payumoney" ? payment.transactionId : payment.razorpayOrderId,
      })
      .where(eq(payments.id, payment.id))
      .returning();

    return {
      status: "activated",
      certificate: activatedCertificate,
      payment: completedPayment,
    };
  });
}

export function activationMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function isCredentialActivationPayment(payment: Pick<Payment, "gatewayStatusRaw">) {
  return activationMetadata(payment.gatewayStatusRaw).kind === CREDENTIAL_ACTIVATION_KIND;
}
