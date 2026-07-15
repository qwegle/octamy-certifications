import crypto from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import {
  couponRedemptions,
  courses,
  discountCoupons,
  type Payment,
} from "@shared/schema";
import { db } from "../db";

export class CouponError extends Error {
  constructor(message: string, public readonly statusCode = 409) {
    super(message);
    this.name = "CouponError";
  }
}

export type CouponQuote = {
  couponId: number;
  codeHint: string;
  originalAmount: string;
  discountAmount: string;
  finalAmount: string;
  currency: "INR";
  productType: string;
  expiresAt: Date;
};

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
const hashCode = (value: string) => crypto.createHash("sha256").update(normalizeCode(value)).digest("hex");

export async function resolveCouponQuote(input: {
  code: string;
  courseId: number;
  userId?: number | null;
  userEmail?: string | null;
}): Promise<CouponQuote> {
  const code = normalizeCode(input.code);
  if (code.length < 5 || code.length > 40) throw new CouponError("Use a valid coupon code", 400);

  const [coupon] = await db.select().from(discountCoupons)
    .where(eq(discountCoupons.codeHash, hashCode(code))).limit(1);
  const now = new Date();
  if (
    !coupon ||
    coupon.status !== "active" ||
    coupon.validFrom > now ||
    coupon.expiresAt <= now ||
    (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions)
  ) {
    throw new CouponError("Coupon is invalid or no longer available", 404);
  }
  if (coupon.courseId && coupon.courseId !== input.courseId) {
    throw new CouponError("This coupon does not apply to this product");
  }

  const [course] = await db.select({
    id: courses.id,
    price: courses.price,
    contentPrice: courses.contentPrice,
    productType: courses.productType,
    ownerType: courses.ownerType,
  }).from(courses).where(eq(courses.id, input.courseId)).limit(1);
  if (!course) throw new CouponError("Product not found", 404);
  if (coupon.ownerType === "admin" && !coupon.courseId && course.ownerType !== "admin") {
    throw new CouponError("This Octamy coupon applies only to in-house products");
  }

  const normalizedEmail = input.userEmail?.trim().toLowerCase();
  if (coupon.perUserLimit > 0 && (input.userId || normalizedEmail)) {
    const identity = input.userId && normalizedEmail
      ? or(
          eq(couponRedemptions.userId, input.userId),
          sql`lower(${couponRedemptions.userEmail}) = ${normalizedEmail}`,
        )
      : input.userId
        ? eq(couponRedemptions.userId, input.userId)
        : sql`lower(${couponRedemptions.userEmail}) = ${normalizedEmail!}`;
    const [{ used }] = await db.select({ used: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, coupon.id), identity));
    if (used >= coupon.perUserLimit) {
      throw new CouponError("This coupon has already been used for this account");
    }
  }

  const original = Math.max(0, Number(
    course.productType === "assessment" ? course.price : (course.contentPrice ?? course.price),
  ));
  if (!Number.isFinite(original) || original <= 0) {
    throw new CouponError("This product does not require a paid coupon", 409);
  }
  const rawDiscount = coupon.discountType === "percent"
    ? original * Number(coupon.discountValue) / 100
    : Number(coupon.discountValue);
  // Coupons discount a paid checkout; vouchers are the governed mechanism for
  // a fully sponsored certification. Keep a nominal payable amount here so a
  // coupon can never silently bypass the payment/credential workflow.
  const discount = Math.min(Math.max(0, original - 1), Math.max(0, rawDiscount));

  return {
    couponId: coupon.id,
    codeHint: coupon.codeHint,
    originalAmount: original.toFixed(2),
    discountAmount: discount.toFixed(2),
    finalAmount: (original - discount).toFixed(2),
    currency: "INR",
    productType: course.productType,
    expiresAt: coupon.expiresAt,
  };
}

export function couponPaymentMetadata(quote: CouponQuote | null) {
  if (!quote) return {};
  return {
    coupon: {
      id: quote.couponId,
      codeHint: quote.codeHint,
      originalAmount: quote.originalAmount,
      discountAmount: quote.discountAmount,
      finalAmount: quote.finalAmount,
    },
  };
}

type CouponPaymentMetadata = {
  coupon?: {
    id?: unknown;
    codeHint?: unknown;
    originalAmount?: unknown;
    discountAmount?: unknown;
    finalAmount?: unknown;
  };
};

/** Records a coupon only after the payment provider confirms success. */
export async function recordCouponRedemption(input: {
  payment: Pick<Payment, "id" | "userId" | "courseId" | "gatewayStatusRaw">;
  userEmail: string;
}) {
  const metadata = (input.payment.gatewayStatusRaw || {}) as CouponPaymentMetadata;
  const coupon = metadata.coupon;
  const couponId = Number(coupon?.id);
  const courseId = Number(input.payment.courseId);
  const originalAmount = Number(coupon?.originalAmount);
  const discountAmount = Number(coupon?.discountAmount);
  const finalAmount = Number(coupon?.finalAmount);
  if (
    !Number.isInteger(couponId) || couponId <= 0 ||
    !Number.isInteger(courseId) || courseId <= 0 ||
    !Number.isFinite(originalAmount) || !Number.isFinite(discountAmount) || !Number.isFinite(finalAmount) ||
    originalAmount < 0 || discountAmount < 0 || finalAmount < 0 ||
    Math.abs(originalAmount - discountAmount - finalAmount) > 0.009
  ) return null;

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7301, ${input.payment.id})`);
    const [created] = await tx.insert(couponRedemptions).values({
      couponId,
      userId: input.payment.userId || null,
      userEmail: input.userEmail.trim().toLowerCase(),
      courseId,
      paymentId: input.payment.id,
      externalKey: `payment:${input.payment.id}`,
      originalAmount: originalAmount.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      finalAmount: finalAmount.toFixed(2),
    }).onConflictDoNothing({ target: couponRedemptions.externalKey }).returning();
    if (!created) return null;
    await tx.update(discountCoupons).set({
      redemptionCount: sql`${discountCoupons.redemptionCount} + 1`,
      updatedAt: new Date(),
    }).where(eq(discountCoupons.id, couponId));
    return created;
  });
}
