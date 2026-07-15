import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { audit } from "../lib/audit";
import {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireInstituteRole,
  type InstituteRequest,
} from "../middleware/auth";
import { deletePendingExam, loadPendingExam } from "../utils/examState";
import { calculateExpiryDate, generateCertificateNumber, getBadgeFromScore } from "../utils";
import {
  certificates,
  certificationVoucherBatches,
  certificationVouchers,
  courses,
  discountCoupons,
  examAttempts,
  institutes,
  users,
} from "@shared/schema";

const router = Router();

const normalizedCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "");
const hashCode = (value: string) => crypto.createHash("sha256").update(normalizedCode(value)).digest("hex");
const codeHint = (value: string) => `••••-${normalizedCode(value).slice(-6)}`;
const normalizeEmail = (value: string) => value.trim().toLowerCase();

function generateVoucherCode() {
  return `OCT-${crypto.randomBytes(5).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

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

const voucherBatchCreateSchema = z.object({
  instituteId: z.coerce.number().int().positive(),
  courseId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(3).max(120),
  quantity: z.coerce.number().int().min(1).max(500),
  expiresAt: z.coerce.date().refine((date) => date.getTime() > Date.now() + 15 * 60_000, "Expiry must be in the future"),
}).strict();

router.post("/admin/certification-voucher-batches", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const parsed = voucherBatchCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Review the voucher batch" });

  const [institute] = await db.select({ id: institutes.id, name: institutes.name, status: institutes.status })
    .from(institutes).where(eq(institutes.id, parsed.data.instituteId));
  if (!institute) return res.status(404).json({ message: "Institute not found" });
  if (institute.status !== "verified") return res.status(409).json({ message: "Only verified institutes can receive certification vouchers" });

  if (parsed.data.courseId) {
    const [course] = await db.select().from(courses).where(eq(courses.id, parsed.data.courseId));
    if (!course || course.ownerType !== "admin" || course.productType !== "assessment" || course.certificationMode !== "octamy") {
      return res.status(409).json({ message: "Vouchers can fund only Octamy in-house certification exams" });
    }
  }

  try {
    const rawCodes = Array.from({ length: parsed.data.quantity }, generateVoucherCode);
    const batch = await db.transaction(async (tx) => {
      const [created] = await tx.insert(certificationVoucherBatches).values({
        instituteId: parsed.data.instituteId,
        courseId: parsed.data.courseId || null,
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        expiresAt: parsed.data.expiresAt,
        createdBy: req.user!.userId,
      }).returning();
      await tx.insert(certificationVouchers).values(rawCodes.map((code) => ({
        batchId: created.id,
        codeHash: hashCode(code),
        codeHint: codeHint(code),
      })));
      return created;
    });

    await audit({
      action: "certification_voucher.batch.created",
      userId: req.user!.userId,
      actorRole: "admin",
      resourceType: "certification_voucher_batch",
      resourceId: batch.id,
      req,
      metadata: { instituteId: institute.id, courseId: batch.courseId, quantity: batch.quantity, expiresAt: batch.expiresAt },
    });
    res.status(201).json({
      batch,
      institute: { id: institute.id, name: institute.name },
      codes: rawCodes,
      oneTimeReveal: true,
      message: "These codes are shown once. Export them now and distribute them through an approved institute channel.",
    });
  } catch (error) {
    console.error("voucher.batch.create.error", error instanceof Error ? error.name : "UnknownError");
    res.status(500).json({ message: "Voucher allocation could not be created" });
  }
});

router.get("/admin/certification-voucher-batches", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize) || 25));
  const rows = await db.select({
    id: certificationVoucherBatches.id,
    name: certificationVoucherBatches.name,
    status: certificationVoucherBatches.status,
    quantity: certificationVoucherBatches.quantity,
    expiresAt: certificationVoucherBatches.expiresAt,
    createdAt: certificationVoucherBatches.createdAt,
    instituteId: institutes.id,
    instituteName: institutes.name,
    courseId: courses.id,
    courseTitle: courses.title,
    available: sql<number>`count(*) filter (where ${certificationVouchers.status} in ('available', 'assigned'))::int`,
    redeemed: sql<number>`count(*) filter (where ${certificationVouchers.status} = 'redeemed')::int`,
  }).from(certificationVoucherBatches)
    .innerJoin(institutes, eq(institutes.id, certificationVoucherBatches.instituteId))
    .leftJoin(courses, eq(courses.id, certificationVoucherBatches.courseId))
    .leftJoin(certificationVouchers, eq(certificationVouchers.batchId, certificationVoucherBatches.id))
    .groupBy(certificationVoucherBatches.id, institutes.id, courses.id)
    .orderBy(desc(certificationVoucherBatches.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(certificationVoucherBatches);
  res.json({ items: rows, pagination: { page, pageSize, total: Number(count), totalPages: Math.max(1, Math.ceil(Number(count) / pageSize)) } });
});

router.patch("/admin/certification-voucher-batches/:id/status", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const parsed = z.object({ status: z.enum(["active", "paused", "revoked"]) }).strict().safeParse(req.body);
  const id = Number(req.params.id);
  if (!parsed.success || !Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Use a valid batch and status" });
  const [updated] = await db.update(certificationVoucherBatches).set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(certificationVoucherBatches.id, id)).returning();
  if (!updated) return res.status(404).json({ message: "Voucher batch not found" });
  await audit({ action: "certification_voucher.batch.status_changed", userId: req.user!.userId, actorRole: "admin", resourceType: "certification_voucher_batch", resourceId: id, req, metadata: { status: parsed.data.status } });
  res.json(updated);
});

router.get("/institute/certification-vouchers", authenticateToken, requireInstituteRole("teacher"), async (req: InstituteRequest, res: Response) => {
  const rows = await db.select({
    id: certificationVoucherBatches.id,
    name: certificationVoucherBatches.name,
    status: certificationVoucherBatches.status,
    quantity: certificationVoucherBatches.quantity,
    expiresAt: certificationVoucherBatches.expiresAt,
    courseTitle: courses.title,
    available: sql<number>`count(*) filter (where ${certificationVouchers.status} = 'available')::int`,
    assigned: sql<number>`count(*) filter (where ${certificationVouchers.status} = 'assigned')::int`,
    redeemed: sql<number>`count(*) filter (where ${certificationVouchers.status} = 'redeemed')::int`,
  }).from(certificationVoucherBatches)
    .leftJoin(courses, eq(courses.id, certificationVoucherBatches.courseId))
    .leftJoin(certificationVouchers, eq(certificationVouchers.batchId, certificationVoucherBatches.id))
    .where(eq(certificationVoucherBatches.instituteId, req.institute!.id))
    .groupBy(certificationVoucherBatches.id, courses.id)
    .orderBy(desc(certificationVoucherBatches.createdAt));
  res.json({ items: rows });
});

router.post("/institute/certification-vouchers/assign", authenticateToken, requireInstituteRole("teacher"), async (req: InstituteRequest, res: Response) => {
  const parsed = z.object({
    code: z.string().trim().min(16).max(80),
    email: z.string().trim().email().max(320),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Use a valid voucher code and learner email" });
  const digest = hashCode(parsed.data.code);
  const email = normalizeEmail(parsed.data.email);
  const [row] = await db.select({ voucher: certificationVouchers, batch: certificationVoucherBatches })
    .from(certificationVouchers)
    .innerJoin(certificationVoucherBatches, eq(certificationVoucherBatches.id, certificationVouchers.batchId))
    .where(and(eq(certificationVouchers.codeHash, digest), eq(certificationVoucherBatches.instituteId, req.institute!.id)));
  if (!row) return res.status(404).json({ message: "Voucher not found in this institute allocation" });
  if (row.batch.status !== "active" || row.batch.expiresAt <= new Date()) return res.status(409).json({ message: "This voucher batch is not active" });
  if (row.voucher.status === "redeemed" || row.voucher.status === "revoked") return res.status(409).json({ message: "This voucher can no longer be assigned" });
  if (row.voucher.assignedEmail && row.voucher.assignedEmail !== email) return res.status(409).json({ message: "This voucher is already assigned to another learner" });

  const [account] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  const [updated] = await db.update(certificationVouchers).set({
    assignedEmail: email,
    assignedUserId: account?.id || null,
    assignedAt: new Date(),
    status: "assigned",
  }).where(eq(certificationVouchers.id, row.voucher.id)).returning({ id: certificationVouchers.id, codeHint: certificationVouchers.codeHint, assignedEmail: certificationVouchers.assignedEmail, status: certificationVouchers.status });
  if (!updated) return res.status(409).json({ message: "Voucher assignment changed. Refresh and try again." });
  await audit({ action: "certification_voucher.assigned", userId: req.user!.userId, actorRole: `institute_${req.institute!.memberRole}`, resourceType: "certification_voucher", resourceId: updated.id, req, metadata: { batchId: row.batch.id, assignedEmail: email } });
  res.json(updated);
});

const voucherRedeemSchema = z.object({
  tempExamId: z.string().trim().min(12).max(180).regex(/^temp_[A-Za-z0-9-]+$/),
  code: z.string().trim().min(16).max(80),
}).strict();

router.post("/certification-vouchers/redeem", optionalAuth, async (req: Request, res: Response) => {
  const parsed = voucherRedeemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Use a valid certification result and voucher code" });
  const digest = hashCode(parsed.data.code);
  // A network retry can arrive after the pending result has been consumed.
  // The high-entropy bearer code is sufficient to replay only the public
  // credential identifier; it cannot issue a second credential.
  const [priorRedemption] = await db.select({ certificateId: certificates.certificateId })
    .from(certificationVouchers)
    .innerJoin(certificates, eq(certificates.id, certificationVouchers.certificateId))
    .where(and(
      eq(certificationVouchers.codeHash, digest),
      eq(certificationVouchers.status, "redeemed"),
      eq(certificationVouchers.redemptionKeyHash, hashCode(parsed.data.tempExamId)),
    ));
  if (priorRedemption) {
    return res.json({ ok: true, replayed: true, certificateId: priorRedemption.certificateId, redirectTo: `/certificate/${priorRedemption.certificateId}` });
  }
  const pending = await loadPendingExam<PendingExam>(parsed.data.tempExamId);
  if (!pending) return res.status(404).json({ message: "Certification result not found or expired" });
  if (!pending.passed) return res.status(409).json({ message: "A passing result is required before redeeming a voucher" });
  if (pending.userId && pending.userId !== req.user?.userId) return res.status(403).json({ message: "Sign in to the account that owns this result" });
  if (req.user && normalizeEmail(req.user.email) !== normalizeEmail(pending.userEmail)) return res.status(403).json({ message: "The signed-in email does not match this result" });

  try {
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`voucher:${digest}`}))`);
      const [row] = await tx.select({
        voucher: certificationVouchers,
        batch: certificationVoucherBatches,
        institute: institutes,
      }).from(certificationVouchers)
        .innerJoin(certificationVoucherBatches, eq(certificationVoucherBatches.id, certificationVouchers.batchId))
        .innerJoin(institutes, eq(institutes.id, certificationVoucherBatches.instituteId))
        .where(eq(certificationVouchers.codeHash, digest));
      if (!row) return { kind: "not_found" as const };
      if (row.voucher.status === "redeemed" && row.voucher.certificateId) {
        const [existing] = await tx.select({ certificateId: certificates.certificateId }).from(certificates).where(eq(certificates.id, row.voucher.certificateId));
        return existing ? { kind: "replayed" as const, certificateId: existing.certificateId } : { kind: "unavailable" as const };
      }
      if (!["available", "assigned"].includes(row.voucher.status) || row.batch.status !== "active" || row.batch.expiresAt <= new Date()) return { kind: "unavailable" as const };
      if (row.batch.courseId && row.batch.courseId !== pending.courseId) return { kind: "wrong_course" as const };
      if (row.voucher.assignedEmail && normalizeEmail(row.voucher.assignedEmail) !== normalizeEmail(pending.userEmail)) return { kind: "wrong_learner" as const };

      const effectiveUserId = pending.userId || req.user?.userId || null;
      if (row.voucher.assignedUserId && row.voucher.assignedUserId !== effectiveUserId) return { kind: "login_required" as const };
      const [course] = await tx.select().from(courses).where(eq(courses.id, pending.courseId));
      if (!course || course.ownerType !== "admin" || course.productType !== "assessment" || course.certificationMode !== "octamy" || !course.isActive || course.reviewStatus !== "approved") return { kind: "course_ineligible" as const };

      const [attempt] = await tx.insert(examAttempts).values({
        userId: effectiveUserId,
        courseId: course.id,
        userEmail: normalizeEmail(pending.userEmail),
        userName: pending.userName,
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
        const [existingAttempt] = await tx.select({ id: examAttempts.id }).from(examAttempts).where(eq(examAttempts.sessionId, pending.sessionId));
        const [existingCertificate] = existingAttempt ? await tx.select({ certificateId: certificates.certificateId }).from(certificates).where(eq(certificates.examAttemptId, existingAttempt.id)) : [];
        return existingCertificate ? { kind: "already_issued" as const, certificateId: existingCertificate.certificateId } : { kind: "issuance_in_progress" as const };
      }

      const publicCertificateId = `OCT-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      const [certificate] = await tx.insert(certificates).values({
        certificateId: publicCertificateId,
        examAttemptId: attempt.id,
        courseId: course.id,
        userId: effectiveUserId,
        userEmail: normalizeEmail(pending.userEmail),
        userName: pending.userName,
        courseTitle: course.title,
        score: pending.score,
        mastered: pending.mastered,
        expiresAt: calculateExpiryDate(),
        isPaid: true,
        isActive: true,
        paymentId: `voucher:${row.voucher.id}`,
        badge: getBadgeFromScore(pending.score),
        certificateNumber: generateCertificateNumber(),
        issuedBy: "Octamy Solutions Private Limited",
        certificationMode: "octamy",
        fundingSource: "institute_voucher",
        issuerSnapshot: {
          legalName: "Octamy Solutions Private Limited",
          mode: "octamy",
          courseId: course.id,
          courseTitle: course.title,
          sponsor: { instituteId: row.institute.id, name: row.institute.name, voucherBatchId: row.batch.id },
        },
      }).returning();
      const [redeemed] = await tx.update(certificationVouchers).set({
        status: "redeemed",
        redeemedBy: effectiveUserId,
        certificateId: certificate.id,
        redemptionKeyHash: hashCode(parsed.data.tempExamId),
        redeemedAt: new Date(),
      }).where(and(eq(certificationVouchers.id, row.voucher.id), sql`${certificationVouchers.status} in ('available', 'assigned')`)).returning();
      if (!redeemed) throw new Error("VOUCHER_RACE");

      await tx.execute(sql`
        UPDATE certification_voucher_batches batch
        SET status = 'exhausted', updated_at = NOW()
        WHERE batch.id = ${row.batch.id}
          AND NOT EXISTS (
            SELECT 1 FROM certification_vouchers voucher
            WHERE voucher.batch_id = batch.id AND voucher.status IN ('available', 'assigned')
          )
      `);
      return { kind: "issued" as const, certificateId: certificate.certificateId, instituteId: row.institute.id, batchId: row.batch.id };
    });

    const messages: Record<string, [number, string]> = {
      not_found: [404, "Voucher code not found"],
      unavailable: [409, "This voucher is expired, revoked, or already used"],
      wrong_course: [409, "This voucher is assigned to a different certification"],
      wrong_learner: [403, "This voucher is assigned to another learner email"],
      login_required: [403, "Sign in with the learner account assigned to this voucher"],
      course_ineligible: [409, "This certification is not eligible for institute vouchers"],
      issuance_in_progress: [409, "Credential issuance is already in progress. Refresh in a moment."],
    };
    const failure = messages[outcome.kind];
    if (failure) {
      const [status, message] = failure;
      return res.status(status).json({ message });
    }
    if (!("certificateId" in outcome)) return res.status(409).json({ message: "Credential issuance did not complete" });

    await deletePendingExam(parsed.data.tempExamId).catch(() => undefined);
    await audit({
      action: "certification_voucher.redeemed",
      userId: req.user?.userId || null,
      actorRole: req.user ? "user" : "guest",
      resourceType: "certificate",
      resourceId: outcome.certificateId,
      req,
      metadata: { outcome: outcome.kind, fundingSource: "institute_voucher", instituteId: "instituteId" in outcome ? outcome.instituteId : undefined, batchId: "batchId" in outcome ? outcome.batchId : undefined },
    });
    res.status(outcome.kind === "issued" ? 201 : 200).json({ ok: true, replayed: outcome.kind !== "issued", certificateId: outcome.certificateId, redirectTo: `/certificate/${outcome.certificateId}` });
  } catch (error) {
    console.error("certification_voucher.redeem.error", error instanceof Error ? error.name : "UnknownError");
    res.status(500).json({ message: "The voucher could not be applied. No duplicate credential was created." });
  }
});

const couponCreateSchema = z.object({
  code: z.string().trim().min(5).max(40).regex(/^[A-Za-z0-9-]+$/),
  name: z.string().trim().min(3).max(120),
  courseId: z.coerce.number().int().positive().nullable().optional(),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().positive().max(1_000_000),
  validFrom: z.coerce.date().optional(),
  expiresAt: z.coerce.date(),
  maxRedemptions: z.coerce.number().int().positive().max(1_000_000).nullable().optional(),
  perUserLimit: z.coerce.number().int().positive().max(100).default(1),
}).strict().superRefine((data, ctx) => {
  if (data.discountType === "percent" && data.discountValue > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percentage cannot exceed 100" });
  if (data.expiresAt <= (data.validFrom || new Date())) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Expiry must be after the start date" });
});

router.post("/admin/coupons", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const parsed = couponCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Review the coupon" });
  const code = normalizedCode(parsed.data.code);
  try {
    const [coupon] = await db.insert(discountCoupons).values({
      codeHash: hashCode(code),
      codeHint: codeHint(code),
      name: parsed.data.name,
      courseId: parsed.data.courseId || null,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue.toFixed(2),
      validFrom: parsed.data.validFrom || new Date(),
      expiresAt: parsed.data.expiresAt,
      maxRedemptions: parsed.data.maxRedemptions || null,
      perUserLimit: parsed.data.perUserLimit,
      createdBy: req.user!.userId,
    }).returning();
    await audit({ action: "coupon.created", userId: req.user!.userId, actorRole: "admin", resourceType: "discount_coupon", resourceId: coupon.id, req, metadata: { courseId: coupon.courseId, discountType: coupon.discountType, discountValue: coupon.discountValue, expiresAt: coupon.expiresAt } });
    res.status(201).json({ coupon, code, oneTimeReveal: true });
  } catch (error: any) {
    if (error?.code === "23505") return res.status(409).json({ message: "That coupon code already exists" });
    console.error("coupon.create.error", error instanceof Error ? error.name : "UnknownError");
    res.status(500).json({ message: "Coupon could not be created" });
  }
});

router.get("/admin/coupons", authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select({ coupon: discountCoupons, courseTitle: courses.title }).from(discountCoupons)
    .leftJoin(courses, eq(courses.id, discountCoupons.courseId)).orderBy(desc(discountCoupons.createdAt));
  res.json({ items: rows.map((row) => ({ ...row.coupon, courseTitle: row.courseTitle })) });
});

router.patch("/admin/coupons/:id/status", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = z.object({ status: z.enum(["active", "paused", "revoked"]) }).strict().safeParse(req.body);
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) return res.status(400).json({ message: "Use a valid coupon and status" });
  const [updated] = await db.update(discountCoupons).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(discountCoupons.id, id)).returning();
  if (!updated) return res.status(404).json({ message: "Coupon not found" });
  await audit({ action: "coupon.status_changed", userId: req.user!.userId, actorRole: "admin", resourceType: "discount_coupon", resourceId: id, req, metadata: { status: parsed.data.status } });
  res.json(updated);
});

router.post("/coupons/quote", optionalAuth, async (req: Request, res: Response) => {
  const parsed = z.object({ code: z.string().trim().min(5).max(40), courseId: z.coerce.number().int().positive() }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Use a valid coupon and certification" });
  const [coupon] = await db.select().from(discountCoupons).where(eq(discountCoupons.codeHash, hashCode(parsed.data.code)));
  const now = new Date();
  if (!coupon || coupon.status !== "active" || coupon.validFrom > now || coupon.expiresAt <= now || (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions)) {
    return res.status(404).json({ message: "Coupon is invalid or no longer available" });
  }
  if (coupon.courseId && coupon.courseId !== parsed.data.courseId) return res.status(409).json({ message: "This coupon does not apply to that certification" });
  const [course] = await db.select({ id: courses.id, price: courses.price }).from(courses).where(eq(courses.id, parsed.data.courseId));
  if (!course) return res.status(404).json({ message: "Certification not found" });
  const original = Math.max(0, Number(course.price));
  const rawDiscount = coupon.discountType === "percent" ? original * Number(coupon.discountValue) / 100 : Number(coupon.discountValue);
  const discount = Math.min(original, Math.max(0, rawDiscount));
  res.json({ valid: true, couponId: coupon.id, codeHint: coupon.codeHint, originalAmount: original.toFixed(2), discountAmount: discount.toFixed(2), finalAmount: (original - discount).toFixed(2), currency: "INR", expiresAt: coupon.expiresAt });
});

export default router;
