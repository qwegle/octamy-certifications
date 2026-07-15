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
  requireCreator,
  requireInstituteRole,
  type CreatorRequest,
  type InstituteRequest,
} from "../middleware/auth";
import { deletePendingExam, loadPendingExam } from "../utils/examState";
import { calculateExpiryDate, generateCertificateNumber, getBadgeFromScore } from "../utils";
import { CouponError, resolveCouponQuote } from "../lib/coupons";
import {
  certificates,
  certificationVoucherBatches,
  certificationVouchers,
  courses,
  creators,
  discountCoupons,
  examAttempts,
  institutes,
  users,
  voucherProgramRequests,
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
  recipientType: z.enum(["institute", "creator"]),
  recipientId: z.coerce.number().int().positive(),
  courseId: z.coerce.number().int().positive().nullable().optional(),
  name: z.string().trim().min(3).max(120),
  quantity: z.coerce.number().int().min(1).max(500),
  expiresAt: z.coerce.date().refine((date) => date.getTime() > Date.now() + 15 * 60_000, "Expiry must be in the future"),
}).strict();

router.post("/admin/certification-voucher-batches", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const parsed = voucherBatchCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Review the voucher batch" });

  const recipient = parsed.data.recipientType === "institute"
    ? (await db.select({ id: institutes.id, name: institutes.name, status: institutes.status }).from(institutes).where(eq(institutes.id, parsed.data.recipientId)))[0]
    : (await db.select({ id: creators.id, name: creators.displayName, status: creators.status }).from(creators).where(eq(creators.id, parsed.data.recipientId)))[0];
  if (!recipient) return res.status(404).json({ message: `${parsed.data.recipientType === "institute" ? "Institute" : "Creator"} not found` });
  const eligibleStatus = parsed.data.recipientType === "institute" ? "verified" : "approved";
  if (recipient.status !== eligibleStatus) return res.status(409).json({ message: `Only ${eligibleStatus} ${parsed.data.recipientType}s can receive certification vouchers` });

  if (!(await ensureVoucherCourse(parsed.data.courseId))) {
    return res.status(409).json({ message: "Vouchers can fund only active, approved Octamy in-house certification exams" });
  }

  try {
    const rawCodes = Array.from({ length: parsed.data.quantity }, generateVoucherCode);
    const batch = await db.transaction(async (tx) => {
      const [created] = await tx.insert(certificationVoucherBatches).values({
        instituteId: parsed.data.recipientType === "institute" ? parsed.data.recipientId : null,
        creatorId: parsed.data.recipientType === "creator" ? parsed.data.recipientId : null,
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
      metadata: { recipientType: parsed.data.recipientType, recipientId: recipient.id, courseId: batch.courseId, quantity: batch.quantity, expiresAt: batch.expiresAt },
    });
    res.status(201).json({
      batch,
      recipient: { type: parsed.data.recipientType, id: recipient.id, name: recipient.name },
      codes: rawCodes,
      oneTimeReveal: true,
      message: "These codes are shown once. Export them now and distribute them through the approved workspace channel.",
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
    instituteId: certificationVoucherBatches.instituteId,
    creatorId: certificationVoucherBatches.creatorId,
    instituteName: institutes.name,
    creatorName: creators.displayName,
    courseId: courses.id,
    courseTitle: courses.title,
    available: sql<number>`count(*) filter (where ${certificationVouchers.status} in ('available', 'assigned'))::int`,
    redeemed: sql<number>`count(*) filter (where ${certificationVouchers.status} = 'redeemed')::int`,
  }).from(certificationVoucherBatches)
    .leftJoin(institutes, eq(institutes.id, certificationVoucherBatches.instituteId))
    .leftJoin(creators, eq(creators.id, certificationVoucherBatches.creatorId))
    .leftJoin(courses, eq(courses.id, certificationVoucherBatches.courseId))
    .leftJoin(certificationVouchers, eq(certificationVouchers.batchId, certificationVoucherBatches.id))
    .groupBy(certificationVoucherBatches.id, institutes.id, creators.id, courses.id)
    .orderBy(desc(certificationVoucherBatches.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(certificationVoucherBatches);
  res.json({ items: rows.map((row) => ({ ...row, recipientType: row.creatorId ? "creator" : "institute", recipientName: row.creatorName || row.instituteName })), pagination: { page, pageSize, total: Number(count), totalPages: Math.max(1, Math.ceil(Number(count) / pageSize)) } });
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

router.get("/creator/certification-vouchers", authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
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
    .where(eq(certificationVoucherBatches.creatorId, req.creator!.id))
    .groupBy(certificationVoucherBatches.id, courses.id)
    .orderBy(desc(certificationVoucherBatches.createdAt));
  res.json({ items: rows });
});

router.post("/creator/certification-vouchers/assign", authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
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
    .where(and(eq(certificationVouchers.codeHash, digest), eq(certificationVoucherBatches.creatorId, req.creator!.id)));
  if (!row) return res.status(404).json({ message: "Voucher not found in this creator allocation" });
  if (row.batch.status !== "active" || row.batch.expiresAt <= new Date()) return res.status(409).json({ message: "This voucher batch is not active" });
  if (["redeemed", "revoked"].includes(row.voucher.status)) return res.status(409).json({ message: "This voucher can no longer be assigned" });
  if (row.voucher.assignedEmail && row.voucher.assignedEmail !== email) return res.status(409).json({ message: "This voucher is already assigned to another learner" });
  const [account] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  const [updated] = await db.update(certificationVouchers).set({ assignedEmail: email, assignedUserId: account?.id || null, assignedAt: new Date(), status: "assigned" })
    .where(eq(certificationVouchers.id, row.voucher.id))
    .returning({ id: certificationVouchers.id, codeHint: certificationVouchers.codeHint, assignedEmail: certificationVouchers.assignedEmail, status: certificationVouchers.status });
  if (!updated) return res.status(409).json({ message: "Voucher assignment changed. Refresh and try again." });
  await audit({ action: "certification_voucher.assigned", userId: req.user!.userId, actorRole: "creator", resourceType: "certification_voucher", resourceId: updated.id, req, metadata: { batchId: row.batch.id, assignedEmail: email } });
  res.json(updated);
});

const voucherRequestSchema = z.object({
  courseId: z.coerce.number().int().positive().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(500),
  purpose: z.string().trim().min(10).max(1000),
}).strict();

async function ensureVoucherCourse(courseId: number | null | undefined) {
  if (!courseId) return true;
  const [course] = await db.select({ id: courses.id }).from(courses).where(and(
    eq(courses.id, courseId), eq(courses.ownerType, "admin"), eq(courses.productType, "assessment"),
    eq(courses.assessmentPurpose, "certification"),
    eq(courses.certificationMode, "octamy"), eq(courses.isActive, true), eq(courses.reviewStatus, "approved"),
  ));
  return Boolean(course);
}

router.get("/institute/voucher-requests", authenticateToken, requireInstituteRole("teacher"), async (req: InstituteRequest, res: Response) => {
  const rows = await db.select({ request: voucherProgramRequests, courseTitle: courses.title }).from(voucherProgramRequests)
    .leftJoin(courses, eq(courses.id, voucherProgramRequests.courseId))
    .where(and(eq(voucherProgramRequests.requesterType, "institute"), eq(voucherProgramRequests.requesterId, req.institute!.id)))
    .orderBy(desc(voucherProgramRequests.createdAt));
  res.json({ items: rows.map((row) => ({ ...row.request, courseTitle: row.courseTitle })) });
});

router.post("/institute/voucher-requests", authenticateToken, requireInstituteRole("teacher"), async (req: InstituteRequest, res: Response) => {
  const parsed = voucherRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Review the voucher request" });
  if (!(await ensureVoucherCourse(parsed.data.courseId))) return res.status(409).json({ message: "Select an active Octamy in-house certification" });
  const [created] = await db.insert(voucherProgramRequests).values({ requesterType: "institute", requesterId: req.institute!.id, courseId: parsed.data.courseId || null, quantity: parsed.data.quantity, purpose: parsed.data.purpose }).returning();
  await audit({ action: "certification_voucher.requested", userId: req.user!.userId, actorRole: `institute_${req.institute!.memberRole}`, resourceType: "voucher_program_request", resourceId: created.id, req, metadata: { quantity: created.quantity, courseId: created.courseId } });
  res.status(201).json(created);
});

router.get("/creator/voucher-requests", authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  const rows = await db.select({ request: voucherProgramRequests, courseTitle: courses.title }).from(voucherProgramRequests)
    .leftJoin(courses, eq(courses.id, voucherProgramRequests.courseId))
    .where(and(eq(voucherProgramRequests.requesterType, "creator"), eq(voucherProgramRequests.requesterId, req.creator!.id)))
    .orderBy(desc(voucherProgramRequests.createdAt));
  res.json({ items: rows.map((row) => ({ ...row.request, courseTitle: row.courseTitle })) });
});

router.post("/creator/voucher-requests", authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  const parsed = voucherRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Review the voucher request" });
  if (!(await ensureVoucherCourse(parsed.data.courseId))) return res.status(409).json({ message: "Select an active Octamy in-house certification" });
  const [created] = await db.insert(voucherProgramRequests).values({ requesterType: "creator", requesterId: req.creator!.id, courseId: parsed.data.courseId || null, quantity: parsed.data.quantity, purpose: parsed.data.purpose }).returning();
  await audit({ action: "certification_voucher.requested", userId: req.user!.userId, actorRole: "creator", resourceType: "voucher_program_request", resourceId: created.id, req, metadata: { quantity: created.quantity, courseId: created.courseId } });
  res.status(201).json(created);
});

router.get("/admin/voucher-requests", authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select({ request: voucherProgramRequests, courseTitle: courses.title }).from(voucherProgramRequests)
    .leftJoin(courses, eq(courses.id, voucherProgramRequests.courseId)).orderBy(desc(voucherProgramRequests.createdAt));
  const items = await Promise.all(rows.map(async (row) => {
    const [owner] = row.request.requesterType === "creator"
      ? await db.select({ name: creators.displayName }).from(creators).where(eq(creators.id, row.request.requesterId))
      : await db.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, row.request.requesterId));
    return { ...row.request, courseTitle: row.courseTitle, requesterName: owner?.name || "Unknown workspace" };
  }));
  res.json({ items });
});

router.patch("/admin/voucher-requests/:id", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = z.object({ status: z.enum(["approved", "rejected"]), reviewNote: z.string().trim().max(1000).optional() }).strict().safeParse(req.body);
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) return res.status(400).json({ message: "Use a valid request decision" });
  const [updated] = await db.update(voucherProgramRequests).set({ status: parsed.data.status, reviewNote: parsed.data.reviewNote || null, reviewedBy: req.user!.userId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(voucherProgramRequests.id, id), eq(voucherProgramRequests.status, "pending"))).returning();
  if (!updated) return res.status(409).json({ message: "This request was already reviewed" });
  await audit({ action: "certification_voucher.request_reviewed", userId: req.user!.userId, actorRole: "admin", resourceType: "voucher_program_request", resourceId: id, req, metadata: { status: updated.status } });
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
        creator: creators,
      }).from(certificationVouchers)
        .innerJoin(certificationVoucherBatches, eq(certificationVoucherBatches.id, certificationVouchers.batchId))
        .leftJoin(institutes, eq(institutes.id, certificationVoucherBatches.instituteId))
        .leftJoin(creators, eq(creators.id, certificationVoucherBatches.creatorId))
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
        fundingSource: row.creator ? "creator_voucher" : "institute_voucher",
        issuerSnapshot: {
          legalName: "Octamy Solutions Private Limited",
          mode: "octamy",
          courseId: course.id,
          courseTitle: course.title,
          sponsor: row.creator
            ? { creatorId: row.creator.id, name: row.creator.displayName, voucherBatchId: row.batch.id }
            : { instituteId: row.institute!.id, name: row.institute!.name, voucherBatchId: row.batch.id },
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
      return { kind: "issued" as const, certificateId: certificate.certificateId, recipientType: row.creator ? "creator" : "institute", recipientId: row.creator?.id || row.institute!.id, batchId: row.batch.id };
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
      metadata: { outcome: outcome.kind, fundingSource: "recipientType" in outcome ? `${outcome.recipientType}_voucher` : "voucher", recipientType: "recipientType" in outcome ? outcome.recipientType : undefined, recipientId: "recipientId" in outcome ? outcome.recipientId : undefined, batchId: "batchId" in outcome ? outcome.batchId : undefined },
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
  if (parsed.data.courseId) {
    const [course] = await db.select({ id: courses.id, productType: courses.productType, assessmentPurpose: courses.assessmentPurpose }).from(courses).where(and(eq(courses.id, parsed.data.courseId), eq(courses.ownerType, "admin")));
    if (!course) return res.status(409).json({ message: "Admin coupons can be scoped only to Octamy in-house products" });
    if (course.productType === "assessment" && course.assessmentPurpose === "practice") {
      return res.status(409).json({ message: "Practice exams are unlocked by Practice Pass, not item coupons" });
    }
  }
  const code = normalizedCode(parsed.data.code);
  try {
    const [coupon] = await db.insert(discountCoupons).values({
      codeHash: hashCode(code),
      codeHint: codeHint(code),
      name: parsed.data.name,
      ownerType: "admin",
      ownerId: null,
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

type CouponOwnerType = "creator" | "institute";

async function createWorkspaceCoupon(req: Request, res: Response, ownerType: CouponOwnerType, ownerId: number) {
  const parsed = couponCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Review the coupon" });
  if (!parsed.data.courseId) return res.status(400).json({ message: "Choose one of your products for this coupon" });
  const [course] = await db.select({ id: courses.id, title: courses.title, productType: courses.productType, assessmentPurpose: courses.assessmentPurpose }).from(courses).where(and(
    eq(courses.id, parsed.data.courseId), eq(courses.ownerType, ownerType), eq(courses.ownerId, ownerId),
  ));
  if (!course) return res.status(403).json({ message: "You can create coupons only for products owned by this workspace" });
  if (course.productType === "assessment" && course.assessmentPurpose === "practice") {
    return res.status(409).json({ message: "Practice exams are unlocked by Practice Pass, not item coupons" });
  }
  const code = normalizedCode(parsed.data.code);
  try {
    const [coupon] = await db.insert(discountCoupons).values({
      codeHash: hashCode(code), codeHint: codeHint(code), name: parsed.data.name,
      ownerType, ownerId, courseId: course.id, discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue.toFixed(2), validFrom: parsed.data.validFrom || new Date(),
      expiresAt: parsed.data.expiresAt, maxRedemptions: parsed.data.maxRedemptions || null,
      perUserLimit: parsed.data.perUserLimit, createdBy: req.user!.userId,
    }).returning();
    await audit({ action: "coupon.created", userId: req.user!.userId, actorRole: ownerType, resourceType: "discount_coupon", resourceId: coupon.id, req, metadata: { ownerType, ownerId, courseId: course.id, productType: course.productType } });
    return res.status(201).json({ coupon: { ...coupon, courseTitle: course.title }, code, oneTimeReveal: true });
  } catch (error: any) {
    if (error?.code === "23505") return res.status(409).json({ message: "That coupon code already exists" });
    console.error("workspace.coupon.create.error", error instanceof Error ? error.name : "UnknownError");
    return res.status(500).json({ message: "Coupon could not be created" });
  }
}

async function listWorkspaceCoupons(res: Response, ownerType: CouponOwnerType, ownerId: number) {
  const rows = await db.select({ coupon: discountCoupons, courseTitle: courses.title, productType: courses.productType })
    .from(discountCoupons).leftJoin(courses, eq(courses.id, discountCoupons.courseId))
    .where(and(eq(discountCoupons.ownerType, ownerType), eq(discountCoupons.ownerId, ownerId)))
    .orderBy(desc(discountCoupons.createdAt));
  return res.json({ items: rows.map((row) => ({ ...row.coupon, courseTitle: row.courseTitle, productType: row.productType })) });
}

async function updateWorkspaceCouponStatus(req: Request, res: Response, ownerType: CouponOwnerType, ownerId: number) {
  const id = Number(req.params.id);
  const parsed = z.object({ status: z.enum(["active", "paused", "revoked"]) }).strict().safeParse(req.body);
  if (!Number.isInteger(id) || id <= 0 || !parsed.success) return res.status(400).json({ message: "Use a valid coupon and status" });
  const [updated] = await db.update(discountCoupons).set({ status: parsed.data.status, updatedAt: new Date() }).where(and(
    eq(discountCoupons.id, id), eq(discountCoupons.ownerType, ownerType), eq(discountCoupons.ownerId, ownerId),
  )).returning();
  if (!updated) return res.status(404).json({ message: "Coupon not found in this workspace" });
  await audit({ action: "coupon.status_changed", userId: req.user!.userId, actorRole: ownerType, resourceType: "discount_coupon", resourceId: id, req, metadata: { status: parsed.data.status, ownerId } });
  return res.json(updated);
}

router.post("/creator/coupons", authenticateToken, requireCreator, (req: CreatorRequest, res: Response) => createWorkspaceCoupon(req, res, "creator", req.creator!.id));
router.get("/creator/coupons", authenticateToken, requireCreator, (_req: CreatorRequest, res: Response) => listWorkspaceCoupons(res, "creator", _req.creator!.id));
router.patch("/creator/coupons/:id/status", authenticateToken, requireCreator, (req: CreatorRequest, res: Response) => updateWorkspaceCouponStatus(req, res, "creator", req.creator!.id));

router.post("/institute/coupons", authenticateToken, requireInstituteRole("teacher"), (req: InstituteRequest, res: Response) => createWorkspaceCoupon(req, res, "institute", req.institute!.id));
router.get("/institute/coupons", authenticateToken, requireInstituteRole("teacher"), (req: InstituteRequest, res: Response) => listWorkspaceCoupons(res, "institute", req.institute!.id));
router.patch("/institute/coupons/:id/status", authenticateToken, requireInstituteRole("teacher"), (req: InstituteRequest, res: Response) => updateWorkspaceCouponStatus(req, res, "institute", req.institute!.id));

router.get("/admin/coupons", authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  const rows = await db.select({ coupon: discountCoupons, courseTitle: courses.title, productType: courses.productType }).from(discountCoupons)
    .leftJoin(courses, eq(courses.id, discountCoupons.courseId)).orderBy(desc(discountCoupons.createdAt));
  res.json({ items: rows.map((row) => ({ ...row.coupon, courseTitle: row.courseTitle, productType: row.productType })) });
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
  try {
    const quote = await resolveCouponQuote({
      code: parsed.data.code,
      courseId: parsed.data.courseId,
      userId: req.user?.userId,
    });
    res.json({ valid: true, ...quote });
  } catch (error) {
    if (error instanceof CouponError) return res.status(error.statusCode).json({ message: error.message });
    throw error;
  }
});

export default router;
