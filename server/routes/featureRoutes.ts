/**
 * Feature routes — wires plans enforcement, signed uploads, exam instances,
 * payouts, course curriculum, and creator integrations into one mounted router.
 *
 * Mounted at /api by server/routes/index.ts.
 */
import { Router, type Response, type Request, type NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { execRows } from '../lib/db-exec';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { v2 as cloudinary } from 'cloudinary';
import { drizzle as drizzlePgClient } from 'drizzle-orm/node-postgres';
import { db, pool } from '../db';
import {
  authenticateToken,
  optionalAuth,
  requireCreator,
  requireInstituteRole,
  type CreatorRequest,
  type InstituteRequest,
} from '../middleware/auth';
import {
  courses,
  courseSections,
  lessons,
  lessonProgress,
  courseReviews,
  courseEntitlements,
  examInstances,
  examInstanceInvitations,
  examInstanceAttempts,
  examInstanceAttemptItems,
  examProctorEvents,
  splitPayouts,
  payoutRequests,
  creatorIntegrations,
  cohorts,
  cohortStudents,
  questions,
  questionBanks,
  creators,
  institutes,
  mediaAssets,
  subscriptions,
} from '@shared/schema';
import { logger } from '../lib/logger';
import { audit } from '../lib/audit';
import {
  boundedClientTimestamp,
  canCollectEvidenceEvent,
  createAttemptAccessToken,
  verifyAttemptAccessToken,
} from '../lib/exam-proctoring';
import {
  createScheduledQuestionSnapshot,
  isScheduledDeadlineExceeded,
  scheduledAttemptDeadline,
  scheduledAttemptPassed,
  scheduledSubmissionAnswers,
  scheduledDeadlineRemainingSeconds,
  scheduledRetakeAvailableAt,
  scheduledReviewDecision,
  scheduledScorePercentage,
  scoreScheduledQuestionSnapshots,
  toScheduledQuestionPayload,
} from '../lib/scheduled-exam-attempt';
import { createCashfreeOrder } from '../lib/cashfree';
import { storage } from '../storage';
import { emailService } from '../utils/emailService';
import {
  buildExamInviteLink,
  createExamInviteToken,
  escapeExamInviteHtml,
  hashExamInviteToken,
  instituteInviteExpiry,
  isValidExamInviteToken,
  normalizeExamInviteEmail,
} from '../lib/institute-exam-delivery';
import {
  decideLessonContentAccess,
  inlineContentDisposition,
  isCourseAvailableForNewAccess,
  parseSingleByteRange,
  resolveLocalMediaPath,
} from '../lib/protected-media';
import {
  canAttachQuestionBank,
  withoutExamPasswordHash,
} from '../lib/exam-instance-policy';
import { safeCsvCell } from '../lib/csv-safety';
import { withSessionAdvisoryLock } from '../lib/pg-advisory-lock';
import { CouponError, couponPaymentMetadata, resolveCouponQuote } from '../lib/coupons';

const LOCAL_MEDIA_DIR = path.join(process.cwd(), 'uploads', 'media');
const LESSON_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

function protectedContentSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required for protected media delivery');
  return 'dev-secret-please-set-jwt-secret';
}

// ====================================================================
// EXAM ATTEMPT ACCESS CONTROL
// ----------------------------------------------------------------
// Attempts can be started two ways:
//   (A) by an authenticated learner -> attempt.userId is set
//   (B) anonymously via share link  -> attempt.userId is null
// To prevent IDOR on numeric attempt ids we issue a short-lived HMAC
// "attempt token" at start time. Subsequent heartbeat / questions /
// submit calls must present it (X-Attempt-Token is preferred; the
// AttemptToken authorization scheme remains accepted). Bearer credentials are
// deliberately rejected in query strings because URLs leak into proxy logs,
// browser history, analytics and support screenshots. Authenticated owners
// can also call without the token if their userId matches.
// ====================================================================
function attemptTokenSecret() {
  return process.env.JWT_SECRET || 'dev-secret-please-set-jwt-secret';
}
function extractAttemptToken(req: Request): string | undefined {
  const hdr = (req.headers['x-attempt-token'] as string) || undefined;
  if (hdr) return hdr;
  const auth = req.headers.authorization;
  if (auth?.startsWith('AttemptToken ')) return auth.slice('AttemptToken '.length);
  return undefined;
}
async function loadAttemptOrUnauthorized(req: Request, res: Response): Promise<{ attempt: any; inst: any } | null> {
  res.setHeader('Cache-Control', 'private, no-store');
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ message: 'Bad attempt id' }); return null; }
  const [attempt] = await db.select().from(examInstanceAttempts).where(eq(examInstanceAttempts.id, id));
  if (!attempt) { res.status(404).json({ message: 'Attempt not found' }); return null; }

  // Ownership: either valid attempt token, OR authenticated user matches owner.
  const token = extractAttemptToken(req);
  let allowed = verifyAttemptAccessToken(token, id, attemptTokenSecret());
  if (!allowed && attempt.userId) {
    // Try JWT-based fallback for the legitimate owner.
    try {
      const authHeader = req.headers.authorization;
      const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      if (bearer) {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded: any = jwt.verify(bearer, process.env.JWT_SECRET!);
        if (decoded?.userId === attempt.userId) allowed = true;
      }
    } catch { /* ignore */ }
  }
  if (!allowed) { res.status(403).json({ message: 'Attempt access denied' }); return null; }

  const [inst] = await db.select().from(examInstances).where(eq(examInstances.id, attempt.instanceId));
  if (!inst) { res.status(404).json({ message: 'Exam instance gone' }); return null; }
  return { attempt, inst };
}

function authoritativeAttemptDeadline(attempt: any, inst: any): Date {
  // deadlineAt is populated by migration 0011 and every new start. The fallback
  // only covers a rolling-deploy row inserted by an older process after the
  // expand migration but before restart.
  return attempt.deadlineAt
    ? new Date(attempt.deadlineAt)
    : scheduledAttemptDeadline(attempt.startedAt, inst.durationMin, inst.endsAt);
}

function storedScheduledAttemptResult(attempt: any) {
  const totalPoints = attempt.totalPoints || attempt.totalQuestions || 1;
  return {
    passed: !!attempt.passed,
    score: attempt.score || 0,
    totalPoints,
    totalQuestions: attempt.totalQuestions || 0,
    scorePct: scheduledScorePercentage(attempt.score || 0, totalPoints),
    timedOut: attempt.status === 'timed_out',
  };
}

const router = Router();

// Only failed starts count. This protects short exam passwords from online
// guessing without penalising a classroom sharing one network when starts are
// valid. Production should back this with a shared Redis-compatible store once
// Octamy runs more than one application node.
const examStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `exam:${String(req.params.code ?? '').toLowerCase()}:ip:${ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown')}`,
  message: {
    message: 'Too many unsuccessful attempts to start this assessment. Wait before trying again.',
    code: 'EXAM_START_RATE_LIMITED',
  },
});

// ====================================================================
// PLAN LIMITS — single source of truth
// ====================================================================
export const CREATOR_LIMITS: Record<string, { maxCourses: number; maxBanks: number; maxQuestionsPerBank: number }> = {
  free: { maxCourses: 1, maxBanks: 2, maxQuestionsPerBank: 50 },
  pro: { maxCourses: 10, maxBanks: 20, maxQuestionsPerBank: 500 },
  premium: { maxCourses: -1, maxBanks: -1, maxQuestionsPerBank: -1 },
};
export const INSTITUTE_LIMITS: Record<string, { maxStudents: number; maxCohorts: number }> = {
  starter: { maxStudents: 500, maxCohorts: 5 },
  growth: { maxStudents: 5000, maxCohorts: -1 },
  enterprise: { maxStudents: -1, maxCohorts: -1 },
};
export const RECRUITER_LIMITS: Record<string, { profileViewsPerMonth: number; savedSearches: number }> = {
  starter: { profileViewsPerMonth: 50, savedSearches: 10 },
  growth: { profileViewsPerMonth: 200, savedSearches: -1 },
  enterprise: { profileViewsPerMonth: -1, savedSearches: -1 },
};

export function getCreatorLimits(plan?: string | null) {
  return CREATOR_LIMITS[plan || 'free'] ?? CREATOR_LIMITS.free;
}

// ====================================================================
// SIGNED UPLOADS — DO Spaces / S3-compatible
// ====================================================================
// Returns a presigned PUT URL the browser can use to upload directly.
// If S3 envs aren't configured we degrade gracefully so dev still works.
//
// Required env (production):
//   S3_ENDPOINT=https://blr1.digitaloceanspaces.com
//   S3_REGION=blr1
//   S3_BUCKET=octamy-creator-content
//   S3_ACCESS_KEY=...
//   S3_SECRET_KEY=...
//   S3_PUBLIC_BASE=https://octamy-creator-content.blr1.cdn.digitaloceanspaces.com
const ALLOWED_UPLOAD_KINDS: Record<string, { ext: string[]; max: number; prefix: string }> = {
  'course.thumbnail': { ext: ['png', 'jpg', 'jpeg', 'webp'], max: 5 * 1024 * 1024, prefix: 'thumbnails' },
  'lesson.video':     { ext: ['mp4', 'webm', 'mov'],         max: 500 * 1024 * 1024, prefix: 'videos' },
  'lesson.pdf':       { ext: ['pdf'],                        max: 50 * 1024 * 1024,  prefix: 'pdfs' },
  'avatar':           { ext: ['png', 'jpg', 'jpeg', 'webp'], max: 2 * 1024 * 1024,   prefix: 'avatars' },
};

function s3Sign(method: string, path: string, headers: Record<string, string>, payload: string = '') {
  // Minimal SigV4 implementation (DO Spaces accepts standard SigV4).
  const access = process.env.S3_ACCESS_KEY!;
  const secret = process.env.S3_SECRET_KEY!;
  const region = process.env.S3_REGION || 'us-east-1';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  headers['x-amz-date'] = amzDate;
  headers['host'] = headers['host'];
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');
  headers['x-amz-content-sha256'] = payloadHash;

  const signedHeaderKeys = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k] ?? headers[Object.keys(headers).find((h) => h.toLowerCase() === k)!]}\n`).join('');
  const signedHeaders = signedHeaderKeys.join(';');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const kDate = crypto.createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const auth = `AWS4-HMAC-SHA256 Credential=${access}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { auth, amzDate, payloadHash };
}

router.post('/uploads/sign', authenticateToken, async (req: any, res: Response) => {
  try {
    const schema = z.object({
      kind: z.enum(Object.keys(ALLOWED_UPLOAD_KINDS) as [string, ...string[]]),
      filename: z.string().min(1).max(200),
      contentType: z.string().min(3).max(100),
      sizeBytes: z.number().int().positive(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
    const { kind, filename, contentType, sizeBytes } = parsed.data;
    const cfg = ALLOWED_UPLOAD_KINDS[kind];

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (!cfg.ext.includes(ext)) return res.status(400).json({ message: `Extension .${ext} not allowed for ${kind}` });
    if (sizeBytes > cfg.max) return res.status(400).json({ message: `File too large (max ${(cfg.max / 1024 / 1024).toFixed(0)}MB)` });

    if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY) {
      // Degraded mode — return a fake URL so dev/tests work.
      return res.status(503).json({
        message: 'Object storage not configured. Set S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT in env.',
        configured: false,
      });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const key = `${cfg.prefix}/${req.user.userId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;
    const bucket = process.env.S3_BUCKET!;
    const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, '');
    const host = new URL(endpoint).host;

    const headers: Record<string, string> = {
      host,
      'content-type': contentType,
      'x-amz-acl': 'public-read',
    };
    const sigPath = `/${bucket}/${key}`;
    const { auth } = s3Sign('PUT', sigPath, headers);

    const uploadUrl = `${endpoint}/${bucket}/${key}`;
    const publicUrl = process.env.S3_PUBLIC_BASE
      ? `${process.env.S3_PUBLIC_BASE.replace(/\/$/, '')}/${key}`
      : uploadUrl;

    res.json({
      uploadUrl,
      publicUrl,
      key,
      method: 'PUT',
      headers: { ...headers, Authorization: auth, 'x-amz-date': headers['x-amz-date'] },
      configured: true,
    });
  } catch (err: any) {
    logger.error('uploads.sign.error', { err });
    res.status(500).json({ message: 'Failed to create upload URL' });
  }
});

// ====================================================================
// PLAN ENFORCEMENT — used by other endpoints; also exposed for clients
// ====================================================================
router.get('/me/plan-limits', authenticateToken, async (req: any, res: Response) => {
  try {
    const [creatorRow] = await db.select().from(creators).where(eq(creators.userId, req.user.userId));
    const inst = await (await import('../storage')).storage.getInstituteByUserId
      ? await (await import('../storage')).storage.getInstituteByUserId!(req.user.userId)
      : null;

    let creatorUsage: any = null;
    if (creatorRow) {
      const [{ c }] = await execRows(sql`SELECT COUNT(*)::int AS c FROM courses WHERE owner_type='creator' AND owner_id=${creatorRow.id}`) as any as Array<{ c: number }>;
      creatorUsage = { plan: creatorRow.plan, limits: getCreatorLimits(creatorRow.plan), used: { courses: c } };
    }

    let instituteUsage: any = null;
    if (inst) {
      const [{ s }] = await execRows(sql`SELECT COUNT(*)::int AS s FROM cohort_students WHERE institute_id=${inst.id}`) as any as Array<{ s: number }>;
      const [{ ch }] = await execRows(sql`SELECT COUNT(*)::int AS ch FROM cohorts WHERE institute_id=${inst.id}`) as any as Array<{ ch: number }>;
      instituteUsage = { plan: inst.plan, limits: INSTITUTE_LIMITS[inst.plan] ?? INSTITUTE_LIMITS.starter, used: { students: s, cohorts: ch } };
    }

    res.json({ creator: creatorUsage, institute: instituteUsage });
  } catch (err: any) {
    logger.error('plan-limits.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// ====================================================================
// COURSE CURRICULUM — sections + lessons + progress
// ====================================================================
router.get('/courses/:id/access', optionalAuth, async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ message: 'Invalid course id' });
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course || !isCourseAvailableForNewAccess(course)) {
      return res.status(404).json({ message: 'Course not found' });
    }
    let entitlement = null;
    if (req.user) {
      [entitlement] = await db.select().from(courseEntitlements).where(and(
        eq(courseEntitlements.userId, req.user.userId),
        eq(courseEntitlements.courseId, courseId),
        eq(courseEntitlements.status, 'active'),
        sql`(${courseEntitlements.expiresAt} IS NULL OR ${courseEntitlements.expiresAt} > NOW())`,
      ));
    }
    const [{ lessonCount, previewCount }] = await execRows(sql`
      SELECT COUNT(*)::int AS "lessonCount",
             COUNT(*) FILTER (WHERE is_preview=true)::int AS "previewCount"
      FROM lessons WHERE course_id=${courseId}
    `) as any as Array<{ lessonCount: number; previewCount: number }>;
    res.json({
      courseId,
      productType: course.productType,
      contentPrice: course.contentPrice,
      requiresPurchase: course.productType !== 'assessment' && Number(course.contentPrice || 0) > 0,
      hasAccess: course.productType === 'assessment' || Boolean(entitlement),
      entitlement: entitlement ? { status: entitlement.status, source: entitlement.source, grantedAt: entitlement.grantedAt, expiresAt: entitlement.expiresAt } : null,
      lessonCount: lessonCount ?? 0,
      previewCount: previewCount ?? 0,
    });
  } catch (err) {
    logger.error('course.access.error', { err });
    res.status(500).json({ message: 'Course access could not be checked' });
  }
});

router.post('/courses/:id/enrol-free', authenticateToken, async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course || !isCourseAvailableForNewAccess(course)) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (course.productType === 'assessment') return res.status(400).json({ message: 'This is an assessment product and does not require course enrolment' });
    if (Number(course.contentPrice || 0) > 0) return res.status(402).json({ message: 'Paid enrolment is required' });
    const [entitlement] = await db.insert(courseEntitlements).values({
      userId: req.user!.userId,
      courseId,
      source: 'free',
      status: 'active',
    }).onConflictDoUpdate({
      target: [courseEntitlements.userId, courseEntitlements.courseId],
      set: { status: 'active', source: 'free', expiresAt: null },
    }).returning();
    audit({ action: 'course.enrol.free', userId: req.user!.userId, actorRole: 'user', resourceType: 'course', resourceId: courseId, req });
    res.status(201).json(entitlement);
  } catch (err) {
    logger.error('course.enrol.free.error', { err });
    res.status(500).json({ message: 'Free enrolment could not be completed' });
  }
});

router.post('/courses/:id/access-checkout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course || !isCourseAvailableForNewAccess(course)) {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (course.productType === 'assessment') return res.status(400).json({ message: 'This product does not sell course-content access' });
    const listAmount = Number(course.contentPrice || 0);
    if (listAmount <= 0) return res.status(400).json({ message: 'Use free enrolment for this course' });
    const [existing] = await db.select({ id: courseEntitlements.id }).from(courseEntitlements).where(and(
      eq(courseEntitlements.userId, req.user!.userId),
      eq(courseEntitlements.courseId, courseId),
      eq(courseEntitlements.status, 'active'),
    ));
    if (existing) return res.status(409).json({ message: 'You already have access to this course' });

    const user = await storage.getUser(req.user!.userId);
    if (!user) return res.status(401).json({ message: 'User account not found' });
    const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim() : '';
    const couponQuote = couponCode
      ? await resolveCouponQuote({ code: couponCode, courseId, userId: user.id, userEmail: user.email })
      : null;
    const amount = couponQuote ? Number(couponQuote.finalAmount) : listAmount;
    const orderId = `COURSE_${req.user!.userId}_${courseId}_${crypto.randomBytes(6).toString('hex')}`;
    const sellerCode = typeof req.body?.sellerCode === 'string' ? req.body.sellerCode.trim().slice(0, 100) : '';
    const payment = await storage.createPayment({
      userId: user.id,
      courseId,
      transactionId: orderId,
      gateway: 'cashfree',
      paymentMethod: 'cashfree',
      amount: amount.toFixed(2),
      certificateAmount: amount.toFixed(2),
      shippingAmount: '0.00',
      includesPhysicalCopy: false,
      currency: 'INR',
      status: 'pending',
      cashfreeOrderId: orderId,
      gatewayStatusRaw: { kind: 'course_access', courseId, userId: user.id, sellerCode, ...couponPaymentMetadata(couponQuote) },
    } as any);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const order = await createCashfreeOrder({
      orderId,
      amount: amount.toFixed(2),
      customerId: `oct_user_${user.id}`,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: typeof req.body?.phone === 'string' && req.body.phone.trim() ? req.body.phone.trim() : '9999999999',
      returnUrl: `${baseUrl}/learn/${encodeURIComponent(course.slug)}?order_id=${encodeURIComponent(orderId)}`,
      notifyUrl: `${baseUrl}/api/webhooks/cashfree`,
      notes: { kind: 'course_access', paymentDbId: String(payment.id), courseId: String(courseId), userId: String(user.id), sellerCode },
    });
    await storage.updatePayment(payment.id, {
      cashfreeOrderId: order.orderId,
      gatewayStatusRaw: { kind: 'course_access', courseId, userId: user.id, sellerCode, ...couponPaymentMetadata(couponQuote), providerOrder: order.raw },
    } as any);
    res.json({ success: true, gateway: 'cashfree', orderId: order.orderId, paymentSessionId: order.paymentSessionId, paymentLink: order.paymentLink, amount: amount.toFixed(2), discountAmount: couponQuote?.discountAmount || '0.00' });
  } catch (err: any) {
    if (err instanceof CouponError) return res.status(err.statusCode).json({ message: err.message });
    logger.error('course.access.checkout.error', { err });
    res.status(500).json({ message: err?.message || 'Course checkout could not be started' });
  }
});

async function assertCreatorOwnsCourse(req: CreatorRequest, courseId: number) {
  const [c] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!c || c.ownerType !== 'creator' || c.ownerId !== req.creator!.id) return null;
  return c;
}

async function assertInstituteOwnsCourse(req: InstituteRequest, courseId: number) {
  const [course] = await db.select().from(courses).where(and(
    eq(courses.id, courseId),
    eq(courses.ownerType, 'institute'),
    eq(courses.ownerId, req.institute!.id),
  ));
  return course ?? null;
}

const lessonContentUrlSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().trim().max(2048).refine(
    (value) => value.startsWith('/api/media/files/') || /^https?:\/\//i.test(value),
    'Use an Octamy media item or an http(s) URL',
  ).nullable().optional(),
);

async function validateProtectedLessonMedia(
  userId: number,
  kind: string,
  contentUrl: string | null | undefined,
): Promise<string | null> {
  if (!['video', 'pdf'].includes(kind) || !contentUrl) return null;
  const [asset] = await db.select({ kind: mediaAssets.kind, mimeType: mediaAssets.mimeType }).from(mediaAssets).where(and(
    eq(mediaAssets.userId, userId),
    eq(mediaAssets.url, contentUrl),
  )).limit(1);
  if (!asset) return 'Choose a video or PDF from your Octamy media library for protected delivery';
  if (kind === 'video' && asset.kind !== 'video') return 'Choose a video media item for this lesson';
  if (kind === 'pdf' && (asset.kind !== 'document' || asset.mimeType !== 'application/pdf')) return 'Choose a PDF media item for this lesson';
  return null;
}

type LessonRequestIdentity = { userId: number; isAdmin: boolean } | null;

type AuthorizedLessonContext = {
  lesson: typeof lessons.$inferSelect;
  course: typeof courses.$inferSelect;
  identity: LessonRequestIdentity;
  decision: ReturnType<typeof decideLessonContentAccess>;
};

function lessonCookieName(lessonId: number) {
  return `octamy_lesson_${lessonId}`;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function lessonRequestIdentity(req: Request, lessonId: number): Promise<LessonRequestIdentity> {
  if (req.user) return { userId: req.user.userId, isAdmin: Boolean(req.user.isAdmin) };
  const token = readCookie(req, lessonCookieName(lessonId));
  if (!token) return null;
  try {
    const payload = jsonwebtoken.verify(token, protectedContentSecret()) as {
      purpose?: string;
      lessonId?: number;
      userId?: number;
    };
    if (payload.purpose !== 'lesson-content' || payload.lessonId !== lessonId || !Number.isInteger(payload.userId)) {
      return null;
    }
    const user = await storage.getUser(payload.userId!);
    return user ? { userId: user.id, isAdmin: Boolean(user.isAdmin) } : null;
  } catch {
    return null;
  }
}

async function authorizeLessonContent(req: Request, lessonId: number): Promise<AuthorizedLessonContext | null> {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!lesson) return null;
  const [course] = await db.select().from(courses).where(eq(courses.id, lesson.courseId));
  if (!course) return null;
  const identity = await lessonRequestIdentity(req, lessonId);

  let isManager = Boolean(identity?.isAdmin);
  let hasEntitlement = false;
  if (identity && !isManager && course.ownerType === 'creator' && course.ownerId != null) {
    const [owner] = await db.select({ id: creators.id }).from(creators).where(and(
      eq(creators.id, course.ownerId),
      eq(creators.userId, identity.userId),
    ));
    isManager = Boolean(owner);
  }
  if (identity && !isManager && course.ownerType === 'institute' && course.ownerId != null) {
    const membership = await execRows(sql`
      SELECT 1 FROM institute_members
      WHERE institute_id = ${course.ownerId} AND user_id = ${identity.userId}
        AND status = 'active' AND role IN ('owner','admin','teacher')
      LIMIT 1
    `) as any[];
    isManager = Boolean(membership[0]);
  }
  if (identity && !isManager) {
    const [entitlement] = await db.select({ id: courseEntitlements.id }).from(courseEntitlements).where(and(
      eq(courseEntitlements.userId, identity.userId),
      eq(courseEntitlements.courseId, course.id),
      eq(courseEntitlements.status, 'active'),
      sql`(${courseEntitlements.expiresAt} IS NULL OR ${courseEntitlements.expiresAt} > NOW())`,
    ));
    hasEntitlement = Boolean(entitlement);
  }

  return {
    lesson,
    course,
    identity,
    decision: decideLessonContentAccess({
      isManager,
      hasEntitlement,
      isPreview: lesson.isPreview,
      courseIsActive: course.isActive,
      courseIsPublic: course.visibility === 'public',
      courseIsApproved: course.reviewStatus === 'approved',
    }, Boolean(identity)),
  };
}

function protectedMediaHeaders(res: Response, originalName: string, mimeType: string) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Disposition', inlineContentDisposition(originalName));
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Accept-Ranges', 'bytes');
}

async function streamLocalLessonAsset(req: Request, res: Response, asset: typeof mediaAssets.$inferSelect) {
  const filePath = resolveLocalMediaPath(LOCAL_MEDIA_DIR, asset.storageKey);
  if (!filePath) return res.status(404).json({ message: 'Lesson media is unavailable' });
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return res.status(404).json({ message: 'Lesson media is unavailable' });
  }
  if (!stat.isFile()) return res.status(404).json({ message: 'Lesson media is unavailable' });

  protectedMediaHeaders(res, asset.originalName, asset.mimeType);
  const range = parseSingleByteRange(typeof req.headers.range === 'string' ? req.headers.range : undefined, stat.size);
  if (range === 'invalid') {
    res.setHeader('Content-Range', `bytes */${stat.size}`);
    return res.status(416).end();
  }
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
    res.setHeader('Content-Length', String(range.length));
  } else {
    res.setHeader('Content-Length', String(stat.size));
  }
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined);
  stream.on('error', (error) => {
    logger.error('lesson.content.local_stream.error', { error, lessonAssetId: asset.id });
    if (!res.headersSent) res.status(500).end();
    else res.destroy(error);
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function cloudinaryAssetUrl(asset: typeof mediaAssets.$inferSelect): string | null {
  try {
    const stored = new URL(asset.url);
    if (stored.protocol !== 'https:' || stored.hostname !== 'res.cloudinary.com') return null;
    if (!stored.pathname.includes('/authenticated/')) return stored.toString();
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return null;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    return cloudinary.url(asset.storageKey, {
      secure: true,
      sign_url: true,
      type: 'authenticated',
      resource_type: asset.kind === 'video' ? 'video' : 'raw',
    });
  } catch {
    return null;
  }
}

async function proxyCloudinaryLessonAsset(req: Request, res: Response, asset: typeof mediaAssets.$inferSelect) {
  const upstreamUrl = cloudinaryAssetUrl(asset);
  if (!upstreamUrl) {
    return res.status(503).json({
      message: 'Protected delivery for this cloud media provider is not configured. Re-upload it to protected Octamy media or contact an administrator.',
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: typeof req.headers.range === 'string' ? { Range: req.headers.range } : undefined,
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    logger.error('lesson.content.cloud_proxy.error', { error, lessonAssetId: asset.id });
    return res.status(502).json({ message: 'Protected lesson media could not be reached' });
  }
  clearTimeout(timeout);
  try {
    const finalUrl = new URL(upstream.url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'res.cloudinary.com') {
      await upstream.body?.cancel();
      return res.status(502).json({ message: 'The media provider returned an unsafe delivery location' });
    }
  } catch {
    await upstream.body?.cancel();
    return res.status(502).json({ message: 'The media provider returned an invalid response' });
  }
  if (upstream.status === 416) {
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    return res.status(416).end();
  }
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel();
    return res.status(502).json({ message: 'Protected lesson media is unavailable from its provider' });
  }

  protectedMediaHeaders(res, asset.originalName, asset.mimeType);
  res.status(upstream.status === 206 ? 206 : 200);
  for (const header of ['content-length', 'content-range'] as const) {
    const value = upstream.headers.get(header);
    if (value) res.setHeader(header, value);
  }
  if (req.method === 'HEAD') {
    await upstream.body.cancel();
    return res.end();
  }
  const stream = Readable.fromWeb(upstream.body as any);
  stream.on('error', (error) => {
    logger.error('lesson.content.cloud_stream.error', { error, lessonAssetId: asset.id });
    res.destroy(error);
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function mediaCookieName(assetId: number) {
  return `octamy_media_${assetId}`;
}

async function mediaRequestIdentity(req: Request, assetId: number): Promise<LessonRequestIdentity> {
  if (req.user) return { userId: req.user.userId, isAdmin: Boolean(req.user.isAdmin) };
  const token = readCookie(req, mediaCookieName(assetId));
  if (!token) return null;
  try {
    const payload = jsonwebtoken.verify(token, protectedContentSecret()) as {
      purpose?: string;
      assetId?: number;
      userId?: number;
    };
    if (payload.purpose !== 'media-owner-content' || payload.assetId !== assetId || !Number.isInteger(payload.userId)) {
      return null;
    }
    const user = await storage.getUser(payload.userId!);
    return user ? { userId: user.id, isAdmin: Boolean(user.isAdmin) } : null;
  } catch {
    return null;
  }
}

router.post('/media/:id/content-session', authenticateToken, async (req: Request, res: Response) => {
  try {
    const assetId = Number(req.params.id);
    if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ message: 'Invalid media id' });
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId));
    if (!asset || (asset.userId !== req.user!.userId && !req.user!.isAdmin)) {
      return res.status(404).json({ message: 'Media item not found' });
    }
    if (!['video', 'document'].includes(asset.kind)) {
      return res.status(409).json({ message: 'Protected preview sessions are for videos and PDFs' });
    }
    if (asset.storageProvider === 'local') {
      const filePath = resolveLocalMediaPath(LOCAL_MEDIA_DIR, asset.storageKey);
      if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: 'The media file is missing' });
    } else if (asset.storageProvider === 'cloudinary') {
      if (!cloudinaryAssetUrl(asset)) return res.status(503).json({ message: 'Protected Cloudinary preview is not configured for this media item' });
    } else {
      return res.status(503).json({ message: 'Protected preview is not configured for this media provider' });
    }
    const token = jsonwebtoken.sign({
      purpose: 'media-owner-content',
      assetId,
      userId: req.user!.userId,
    }, protectedContentSecret(), { expiresIn: Math.floor(LESSON_SESSION_TTL_MS / 1000) });
    res.cookie(mediaCookieName(assetId), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: `/api/media/${assetId}/content`,
      maxAge: LESSON_SESSION_TTL_MS,
    });
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ streamUrl: `/api/media/${assetId}/content`, expiresInSec: LESSON_SESSION_TTL_MS / 1000 });
  } catch (err) {
    logger.error('media.owner_content_session.error', { err });
    res.status(500).json({ message: 'Protected media preview could not be prepared' });
  }
});

router.get('/media/:id/content', optionalAuth, async (req: Request, res: Response) => {
  try {
    const assetId = Number(req.params.id);
    if (!Number.isInteger(assetId) || assetId <= 0) return res.status(404).end();
    const identity = await mediaRequestIdentity(req, assetId);
    if (!identity) {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(401).json({ message: 'Media owner access is required' });
    }
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId));
    if (!asset || (asset.userId !== identity.userId && !identity.isAdmin)) return res.status(404).end();
    if (!['video', 'document'].includes(asset.kind)) return res.status(404).end();
    if (asset.storageProvider === 'local') return streamLocalLessonAsset(req, res, asset);
    if (asset.storageProvider === 'cloudinary') return proxyCloudinaryLessonAsset(req, res, asset);
    return res.status(503).json({ message: 'Protected preview is not configured for this media provider' });
  } catch (err) {
    logger.error('media.owner_content.error', { err });
    if (!res.headersSent) res.status(500).json({ message: 'Protected media preview could not be delivered' });
  }
});

router.post('/lessons/:id/content-session', optionalAuth, async (req: Request, res: Response) => {
  try {
    const lessonId = Number(req.params.id);
    if (!Number.isInteger(lessonId) || lessonId <= 0) return res.status(400).json({ message: 'Invalid lesson id' });
    const context = await authorizeLessonContent(req, lessonId);
    if (!context) return res.status(404).json({ message: 'Lesson not found' });
    if (!context.decision.allowed) {
      return res.status(context.decision.basis === 'authentication_required' ? 401 : 403).json({
        message: context.decision.basis === 'authentication_required'
          ? 'Sign in or purchase course access to open this lesson'
          : 'Your account does not have access to this lesson',
      });
    }
    if (!context.lesson.contentUrl || !['video', 'pdf'].includes(context.lesson.kind)) {
      return res.status(409).json({ message: 'This lesson does not have streamable video or PDF content' });
    }
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.url, context.lesson.contentUrl)).limit(1);
    if (!asset || (context.lesson.kind === 'video' ? !asset.mimeType.startsWith('video/') : asset.mimeType !== 'application/pdf')) {
      return res.status(409).json({
        message: 'This lesson cannot be delivered privately. Replace it with a video or PDF from the Octamy media library.',
      });
    }
    if (!['local', 'cloudinary'].includes(asset.storageProvider)) {
      return res.status(503).json({ message: 'Protected delivery is not configured for this media provider' });
    }
    if (asset.storageProvider === 'local') {
      const filePath = resolveLocalMediaPath(LOCAL_MEDIA_DIR, asset.storageKey);
      if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: 'The lesson media file is missing' });
    }
    if (asset.storageProvider === 'cloudinary' && !cloudinaryAssetUrl(asset)) {
      return res.status(503).json({
        message: 'Protected Cloudinary delivery is not configured for this media item. Re-upload it or contact an administrator.',
      });
    }
    if (context.decision.basis !== 'preview') {
      if (!context.identity) return res.status(401).json({ message: 'Sign in to open this lesson' });
      const token = jsonwebtoken.sign({
        purpose: 'lesson-content',
        lessonId,
        userId: context.identity.userId,
      }, protectedContentSecret(), { expiresIn: Math.floor(LESSON_SESSION_TTL_MS / 1000) });
      res.cookie(lessonCookieName(lessonId), token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: `/api/lessons/${lessonId}/content`,
        maxAge: LESSON_SESSION_TTL_MS,
      });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      streamUrl: `/api/lessons/${lessonId}/content`,
      kind: context.lesson.kind,
      access: context.decision.basis,
      expiresInSec: context.decision.basis === 'preview' ? null : LESSON_SESSION_TTL_MS / 1000,
    });
  } catch (err) {
    logger.error('lesson.content_session.error', { err });
    res.status(500).json({ message: 'Lesson access could not be prepared' });
  }
});

router.get('/lessons/:id/content', optionalAuth, async (req: Request, res: Response) => {
  try {
    const lessonId = Number(req.params.id);
    if (!Number.isInteger(lessonId) || lessonId <= 0) return res.status(404).end();
    const context = await authorizeLessonContent(req, lessonId);
    if (!context) return res.status(404).end();
    if (!context.decision.allowed) {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(context.decision.basis === 'authentication_required' ? 401 : 403).json({
        message: 'Lesson access is required',
      });
    }
    if (!context.lesson.contentUrl || !['video', 'pdf'].includes(context.lesson.kind)) {
      return res.status(404).json({ message: 'Lesson media is unavailable' });
    }
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.url, context.lesson.contentUrl)).limit(1);
    if (!asset || (context.lesson.kind === 'video' ? !asset.mimeType.startsWith('video/') : asset.mimeType !== 'application/pdf')) {
      return res.status(409).json({
        message: 'This external lesson URL cannot be delivered privately. Choose a video or PDF from the Octamy media library.',
      });
    }
    if (asset.storageProvider === 'local') return streamLocalLessonAsset(req, res, asset);
    if (asset.storageProvider === 'cloudinary') return proxyCloudinaryLessonAsset(req, res, asset);
    return res.status(503).json({ message: 'Protected delivery is not configured for this media provider' });
  } catch (err) {
    logger.error('lesson.content.error', { err });
    if (!res.headersSent) res.status(500).json({ message: 'Lesson media could not be delivered' });
  }
});

router.get('/courses/:id/curriculum', optionalAuth, async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ message: 'Invalid course id' });
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const publicCourse = course.isActive && course.visibility === 'public' && course.reviewStatus === 'approved';
    let canManage = Boolean(req.user?.isAdmin);
    if (!canManage && req.user && course.ownerType === 'creator' && course.ownerId != null) {
      const [creator] = await db.select({ id: creators.id }).from(creators).where(and(
        eq(creators.id, course.ownerId),
        eq(creators.userId, req.user.userId),
      ));
      canManage = !!creator;
    }
    if (!canManage && req.user && course.ownerType === 'institute') {
      const membership = await execRows(sql`
        SELECT 1 FROM institute_members
        WHERE institute_id = ${course.ownerId} AND user_id = ${req.user.userId}
          AND status = 'active' AND role IN ('owner','admin','teacher')
        LIMIT 1
      `) as any[];
      canManage = !!membership[0];
    }
    let entitled = false;
    if (req.user && !canManage) {
      const [access] = await db.select({ id: courseEntitlements.id }).from(courseEntitlements).where(and(
        eq(courseEntitlements.userId, req.user.userId),
        eq(courseEntitlements.courseId, courseId),
        eq(courseEntitlements.status, 'active'),
        sql`(${courseEntitlements.expiresAt} IS NULL OR ${courseEntitlements.expiresAt} > NOW())`,
      ));
      entitled = Boolean(access);
    }
    const entitlementUsable = entitled && course.isActive && course.reviewStatus === 'approved';
    if (!publicCourse && !canManage && !entitlementUsable) return res.status(404).json({ message: 'Course not found' });
    const contentUnlocked = canManage || entitlementUsable;
    const sections = await db.select().from(courseSections).where(eq(courseSections.courseId, courseId)).orderBy(courseSections.position);
    const allLessons = await db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(lessons.position);
    const grouped = sections.map((s) => ({
      ...s,
      lessons: allLessons.filter((l) => l.sectionId === s.id).map((lesson) => {
        const canOpen = contentUnlocked || (publicCourse && lesson.isPreview);
        const protectedMedia = ['video', 'pdf'].includes(lesson.kind) && Boolean(lesson.contentUrl);
        if (!canOpen) {
          return {
            ...lesson,
            contentUrl: null,
            contentText: null,
            contentPath: null,
            hasContent: false,
            locked: true,
          };
        }
        return {
          ...lesson,
          // A storage/provider URL is never part of the learning curriculum for
          // video, PDF, or ebook lessons. The authorized stream endpoint is the
          // only learner-facing delivery surface.
          contentUrl: protectedMedia ? null : lesson.contentUrl,
          contentPath: protectedMedia ? `/api/lessons/${lesson.id}/content` : null,
          hasContent: Boolean(lesson.contentUrl || lesson.contentText),
          locked: false,
        };
      }),
    }));
    res.setHeader('X-Octamy-Course-Access', contentUnlocked ? 'unlocked' : 'preview');
    res.json(grouped);
  } catch (err: any) {
    logger.error('curriculum.list.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/creator/courses/:id/sections', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const c = await assertCreatorOwnsCourse(req, courseId);
    if (!c) return res.status(404).json({ message: 'Course not found' });
    const schema = z.object({ title: z.string().min(2).max(120), position: z.number().int().min(0).default(0) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const [created] = await db.insert(courseSections).values({ courseId, ...parsed.data }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    logger.error('section.create.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/creator/courses/:id/lessons', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const c = await assertCreatorOwnsCourse(req, courseId);
    if (!c) return res.status(404).json({ message: 'Course not found' });
    const schema = z.object({
      sectionId: z.number().int().positive(),
      title: z.string().min(2).max(160),
      kind: z.enum(['video', 'pdf', 'text', 'quiz', 'link']).default('video'),
      contentUrl: lessonContentUrlSchema,
      contentText: z.string().optional().nullable(),
      durationSec: z.number().int().min(0).default(0),
      position: z.number().int().min(0).default(0),
      isPreview: z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const mediaError = await validateProtectedLessonMedia(req.user!.userId, parsed.data.kind, parsed.data.contentUrl);
    if (mediaError) return res.status(400).json({ message: mediaError });
    const [section] = await db.select().from(courseSections).where(and(eq(courseSections.id, parsed.data.sectionId), eq(courseSections.courseId, courseId)));
    if (!section) return res.status(400).json({ message: 'Invalid section for this course' });
    const [created] = await db.insert(lessons).values({ courseId, ...parsed.data }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    logger.error('lesson.create.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.patch('/creator/courses/:id/sections/:sectionId', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const sectionId = Number(req.params.sectionId);
    const c = await assertCreatorOwnsCourse(req, courseId);
    if (!c) return res.status(404).json({ message: 'Course not found' });
    const schema = z.object({ title: z.string().min(2).max(120).optional(), position: z.number().int().min(0).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const [updated] = await db.update(courseSections).set(parsed.data).where(and(eq(courseSections.id, sectionId), eq(courseSections.courseId, courseId))).returning();
    if (!updated) return res.status(404).json({ message: 'Section not found' });
    res.json(updated);
  } catch (err: any) {
    logger.error('section.patch.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.delete('/creator/courses/:id/sections/:sectionId', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const sectionId = Number(req.params.sectionId);
    const c = await assertCreatorOwnsCourse(req, courseId);
    if (!c) return res.status(404).json({ message: 'Course not found' });
    await db.delete(lessons).where(and(eq(lessons.sectionId, sectionId), eq(lessons.courseId, courseId)));
    await db.delete(courseSections).where(and(eq(courseSections.id, sectionId), eq(courseSections.courseId, courseId)));
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('section.delete.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.patch('/creator/courses/:id/lessons/:lessonId', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const lessonId = Number(req.params.lessonId);
    const c = await assertCreatorOwnsCourse(req, courseId);
    if (!c) return res.status(404).json({ message: 'Course not found' });
    const schema = z.object({
      title: z.string().min(2).max(160).optional(),
      kind: z.enum(['video', 'pdf', 'text', 'quiz', 'link']).optional(),
      contentUrl: lessonContentUrlSchema,
      contentText: z.string().nullable().optional(),
      durationSec: z.number().int().min(0).optional(),
      position: z.number().int().min(0).optional(),
      isPreview: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const [existingLesson] = await db.select({ kind: lessons.kind, contentUrl: lessons.contentUrl }).from(lessons).where(and(
      eq(lessons.id, lessonId),
      eq(lessons.courseId, courseId),
    ));
    if (!existingLesson) return res.status(404).json({ message: 'Lesson not found' });
    const mediaError = await validateProtectedLessonMedia(
      req.user!.userId,
      parsed.data.kind ?? existingLesson.kind,
      parsed.data.contentUrl === undefined ? existingLesson.contentUrl : parsed.data.contentUrl,
    );
    if (mediaError) return res.status(400).json({ message: mediaError });
    const [updated] = await db.update(lessons).set(parsed.data).where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId))).returning();
    if (!updated) return res.status(404).json({ message: 'Lesson not found' });
    res.json(updated);
  } catch (err: any) {
    logger.error('lesson.patch.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.delete('/creator/courses/:id/lessons/:lessonId', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const lessonId = Number(req.params.lessonId);
    const c = await assertCreatorOwnsCourse(req, courseId);
    if (!c) return res.status(404).json({ message: 'Course not found' });
    await db.delete(lessons).where(and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)));
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('lesson.delete.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// Institute teachers use the same curriculum model, scoped to their current
// institute. Keeping distinct endpoints prevents a dual-role user from
// accidentally editing creator-owned content while working as an institute.
router.post('/institute/courses/:id/sections', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const course = await assertInstituteOwnsCourse(req, courseId);
    if (!course) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    const parsed = z.object({
      title: z.string().trim().min(2).max(120),
      position: z.coerce.number().int().min(0).default(0),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Check the section details', errors: parsed.error.flatten() });
    const [created] = await db.insert(courseSections).values({ courseId, ...parsed.data }).returning();
    res.status(201).json(created);
  } catch (err) {
    logger.error('institute.section.create.error', { err });
    res.status(500).json({ message: 'Failed to create section' });
  }
});

router.post('/institute/courses/:id/lessons', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const course = await assertInstituteOwnsCourse(req, courseId);
    if (!course) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    const parsed = z.object({
      sectionId: z.coerce.number().int().positive(),
      title: z.string().trim().min(2).max(160),
      kind: z.enum(['video', 'pdf', 'text', 'quiz', 'link']).default('video'),
      contentUrl: lessonContentUrlSchema,
      contentText: z.string().max(100_000).optional().nullable(),
      durationSec: z.coerce.number().int().min(0).default(0),
      position: z.coerce.number().int().min(0).default(0),
      isPreview: z.boolean().default(false),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Check the lesson details and content URL', errors: parsed.error.flatten() });
    const mediaError = await validateProtectedLessonMedia(req.user!.userId, parsed.data.kind, parsed.data.contentUrl);
    if (mediaError) return res.status(400).json({ message: mediaError });
    const [section] = await db.select({ id: courseSections.id }).from(courseSections).where(and(
      eq(courseSections.id, parsed.data.sectionId),
      eq(courseSections.courseId, courseId),
    ));
    if (!section) return res.status(400).json({ message: 'Section does not belong to this course' });
    const [created] = await db.insert(lessons).values({ courseId, ...parsed.data }).returning();
    res.status(201).json(created);
  } catch (err) {
    logger.error('institute.lesson.create.error', { err });
    res.status(500).json({ message: 'Failed to create lesson' });
  }
});

router.patch('/institute/courses/:id/sections/:sectionId', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const sectionId = Number(req.params.sectionId);
    const course = await assertInstituteOwnsCourse(req, courseId);
    if (!course) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    const parsed = z.object({
      title: z.string().trim().min(2).max(120).optional(),
      position: z.coerce.number().int().min(0).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Check the section details', errors: parsed.error.flatten() });
    const [updated] = await db.update(courseSections).set(parsed.data).where(and(
      eq(courseSections.id, sectionId),
      eq(courseSections.courseId, courseId),
    )).returning();
    if (!updated) return res.status(404).json({ message: 'Section not found in this course' });
    res.json(updated);
  } catch (err) {
    logger.error('institute.section.update.error', { err });
    res.status(500).json({ message: 'Failed to update section' });
  }
});

router.delete('/institute/courses/:id/sections/:sectionId', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const sectionId = Number(req.params.sectionId);
    const course = await assertInstituteOwnsCourse(req, courseId);
    if (!course) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    const [section] = await db.select({ id: courseSections.id }).from(courseSections).where(and(
      eq(courseSections.id, sectionId),
      eq(courseSections.courseId, courseId),
    ));
    if (!section) return res.status(404).json({ message: 'Section not found in this course' });
    await db.delete(lessons).where(and(eq(lessons.sectionId, sectionId), eq(lessons.courseId, courseId)));
    await db.delete(courseSections).where(and(eq(courseSections.id, sectionId), eq(courseSections.courseId, courseId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('institute.section.delete.error', { err });
    res.status(500).json({ message: 'Failed to delete section' });
  }
});

router.patch('/institute/courses/:id/lessons/:lessonId', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const lessonId = Number(req.params.lessonId);
    const course = await assertInstituteOwnsCourse(req, courseId);
    if (!course) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    const parsed = z.object({
      title: z.string().trim().min(2).max(160).optional(),
      kind: z.enum(['video', 'pdf', 'text', 'quiz', 'link']).optional(),
      contentUrl: lessonContentUrlSchema,
      contentText: z.string().max(100_000).nullable().optional(),
      durationSec: z.coerce.number().int().min(0).optional(),
      position: z.coerce.number().int().min(0).optional(),
      isPreview: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Check the lesson details and content URL', errors: parsed.error.flatten() });
    const [existingLesson] = await db.select({ kind: lessons.kind, contentUrl: lessons.contentUrl }).from(lessons).where(and(
      eq(lessons.id, lessonId),
      eq(lessons.courseId, courseId),
    ));
    if (!existingLesson) return res.status(404).json({ message: 'Lesson not found in this course' });
    const mediaError = await validateProtectedLessonMedia(
      req.user!.userId,
      parsed.data.kind ?? existingLesson.kind,
      parsed.data.contentUrl === undefined ? existingLesson.contentUrl : parsed.data.contentUrl,
    );
    if (mediaError) return res.status(400).json({ message: mediaError });
    const [updated] = await db.update(lessons).set(parsed.data).where(and(
      eq(lessons.id, lessonId),
      eq(lessons.courseId, courseId),
    )).returning();
    if (!updated) return res.status(404).json({ message: 'Lesson not found in this course' });
    res.json(updated);
  } catch (err) {
    logger.error('institute.lesson.update.error', { err });
    res.status(500).json({ message: 'Failed to update lesson' });
  }
});

router.delete('/institute/courses/:id/lessons/:lessonId', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const lessonId = Number(req.params.lessonId);
    const course = await assertInstituteOwnsCourse(req, courseId);
    if (!course) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    const [deleted] = await db.delete(lessons).where(and(
      eq(lessons.id, lessonId),
      eq(lessons.courseId, courseId),
    )).returning({ id: lessons.id });
    if (!deleted) return res.status(404).json({ message: 'Lesson not found in this course' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('institute.lesson.delete.error', { err });
    res.status(500).json({ message: 'Failed to delete lesson' });
  }
});

router.post('/lessons/:id/progress', authenticateToken, async (req: any, res: Response) => {
  try {
    const lessonId = Number(req.params.id);
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
    const [course] = await db.select().from(courses).where(eq(courses.id, lesson.courseId));
    if (!course || !course.isActive || course.visibility !== 'public') {
      return res.status(404).json({ message: 'Course not found' });
    }
    if (course.productType !== 'assessment' && !lesson.isPreview) {
      const [entitlement] = await db.select({ id: courseEntitlements.id }).from(courseEntitlements).where(and(
        eq(courseEntitlements.userId, req.user.userId),
        eq(courseEntitlements.courseId, lesson.courseId),
        eq(courseEntitlements.status, 'active'),
        sql`(${courseEntitlements.expiresAt} IS NULL OR ${courseEntitlements.expiresAt} > NOW())`,
      ));
      if (!entitlement) return res.status(403).json({ message: 'Course access is required before progress can be recorded' });
    }
    const schema = z.object({
      status: z.enum(['started', 'completed']).default('started'),
      positionSec: z.number().int().min(0).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const values = {
      userId: req.user.userId,
      lessonId,
      courseId: lesson.courseId,
      status: parsed.data.status,
      positionSec: parsed.data.positionSec ?? 0,
      completedAt: parsed.data.status === 'completed' ? new Date() : null,
      updatedAt: new Date(),
    };
    await execRows(sql`
      INSERT INTO lesson_progress (user_id, lesson_id, course_id, status, position_sec, completed_at, updated_at)
      VALUES (${values.userId}, ${values.lessonId}, ${values.courseId}, ${values.status}, ${values.positionSec}, ${values.completedAt}, ${values.updatedAt})
      ON CONFLICT (user_id, lesson_id) DO UPDATE
        SET status = EXCLUDED.status,
            position_sec = EXCLUDED.position_sec,
            completed_at = COALESCE(EXCLUDED.completed_at, lesson_progress.completed_at),
            updated_at = EXCLUDED.updated_at
    `);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('lesson.progress.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// ====================================================================
// EXAM INSTANCES — share-link exams with cohort gating + heartbeat
// ====================================================================
function generateShareCode() {
  return crypto.randomBytes(5).toString('base64url').replace(/[-_]/g, '').slice(0, 8).toLowerCase();
}

type ActiveInstituteSubscription = {
  id: number;
  plan: string;
  startsAt: Date | null;
  renewsAt: Date;
};

async function activeInstituteExamSubscription(instituteId: number): Promise<ActiveInstituteSubscription | null> {
  const [subscription] = await db.select({
    id: subscriptions.id,
    plan: subscriptions.plan,
    startsAt: subscriptions.startsAt,
    renewsAt: subscriptions.renewsAt,
  }).from(subscriptions).where(and(
    eq(subscriptions.ownerType, 'institute'),
    eq(subscriptions.ownerId, instituteId),
    eq(subscriptions.status, 'active'),
    sql`(${subscriptions.startsAt} IS NULL OR ${subscriptions.startsAt} <= NOW())`,
    sql`${subscriptions.renewsAt} IS NOT NULL AND ${subscriptions.renewsAt} > NOW()`,
  )).orderBy(desc(subscriptions.renewsAt), desc(subscriptions.id)).limit(1);
  return subscription?.renewsAt ? subscription as ActiveInstituteSubscription : null;
}

async function verifyInstituteExamFunding(inst: typeof examInstances.$inferSelect): Promise<ActiveInstituteSubscription | null> {
  if (inst.ownerType !== 'institute') return null;
  const subscription = await activeInstituteExamSubscription(inst.ownerId);
  if (!subscription) return null;
  if (inst.fundingSubscriptionId !== subscription.id) {
    await db.update(examInstances).set({
      fundingSubscriptionId: subscription.id,
      fundingVerifiedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(examInstances.id, inst.id));
  }
  return subscription;
}

function inviteCredentials(req: Request): { email: string; tokenHash: string } | null {
  const rawToken = req.header('x-exam-invite-token');
  const rawEmail = req.header('x-exam-invite-email');
  if (!rawToken || !rawEmail || !isValidExamInviteToken(rawToken)) return null;
  const email = normalizeExamInviteEmail(rawEmail);
  if (!z.string().email().safeParse(email).success) return null;
  return { email, tokenHash: hashExamInviteToken(rawToken) };
}

async function validExamInvitation(
  examInstanceId: number,
  email: string,
  tokenHash: string,
) {
  const [invitation] = await db.select().from(examInstanceInvitations).where(and(
    eq(examInstanceInvitations.examInstanceId, examInstanceId),
    eq(examInstanceInvitations.email, normalizeExamInviteEmail(email)),
    eq(examInstanceInvitations.tokenHash, tokenHash),
    sql`${examInstanceInvitations.status} <> 'revoked'`,
    sql`${examInstanceInvitations.expiresAt} > NOW()`,
  )).limit(1);
  return invitation ?? null;
}

function examInviteBaseUrl(req: Request): string {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

router.post('/exam-instances', authenticateToken, async (req: any, res: Response) => {
  try {
    const schema = z.object({
      title: z.string().min(3).max(160),
      bankId: z.number().int(),
      courseId: z.number().int().optional(),
      cohortId: z.number().int().optional(),
      durationMin: z.number().int().min(5).max(360).default(30),
      passingScore: z.number().int().min(10).max(100).default(50),
      maxAttempts: z.number().int().min(1).max(10).default(1),
      questionCount: z.number().int().min(1).max(500).optional(),
      reviewPolicy: z.enum(['immediate', 'after_final_attempt', 'after_window', 'score_only']).optional(),
      reviewReleaseAt: z.string().datetime().optional(),
      retakeCooldownMin: z.number().int().min(0).max(43_200).default(0),
      proctorMode: z.enum(['standard', 'browser_evidence']).default('standard'),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      password: z.string().min(4).max(60).optional(),
      status: z.enum(['draft', 'live']).optional(),
      ownerType: z.enum(['creator', 'institute', 'admin']),
      ownerId: z.number().int(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const d = parsed.data;
    const requestedStatus = d.status ?? (d.ownerType === 'institute' ? 'draft' : 'live');

    if (d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt)) {
      return res.status(400).json({ message: 'Exam end time must be after its start time' });
    }
    const reviewPolicy = d.reviewPolicy ?? (
      d.ownerType === 'admin'
        ? 'immediate'
        : d.ownerType === 'creator'
          ? 'after_final_attempt'
          : d.endsAt ? 'after_window' : 'score_only'
    );
    const reviewReleaseAt = d.reviewReleaseAt ? new Date(d.reviewReleaseAt) : null;
    if (requestedStatus === 'live' && reviewPolicy === 'after_window' && !reviewReleaseAt && !d.endsAt) {
      return res.status(400).json({ message: 'After-window review requires an exam end time or a review release time' });
    }
    if (reviewReleaseAt && reviewPolicy !== 'after_window') {
      return res.status(400).json({ message: 'A review release time is only valid with the after-window review policy' });
    }
    if (reviewReleaseAt && d.endsAt && reviewReleaseAt < new Date(d.endsAt)) {
      return res.status(400).json({ message: 'Review release time cannot be before the exam closes' });
    }
    if (d.cohortId && d.ownerType !== 'institute') {
      return res.status(400).json({ message: 'Cohort restrictions are available only for institute exams' });
    }
    if (d.ownerType === 'institute' && requestedStatus === 'live' && !d.cohortId) {
      return res.status(400).json({
        message: 'Choose a cohort before publishing. Institute exams are delivered through private candidate invitations.',
        code: 'INSTITUTE_EXAM_COHORT_REQUIRED',
      });
    }

    // Ownership check — must be member of the institute or owner of the creator profile
    let instituteSubscription: ActiveInstituteSubscription | null = null;
    if (d.ownerType === 'institute') {
      const inst = await execRows(sql`
        SELECT 1 FROM institute_members
        WHERE institute_id = ${d.ownerId} AND user_id = ${req.user.userId}
          AND status = 'active' AND role IN ('owner','admin','teacher')
        LIMIT 1
      `) as any as Array<{ id: number }>;
      if (!inst[0]) return res.status(403).json({ message: 'Not a member of this institute' });

      if (d.cohortId) {
        const cohort = await execRows(sql`
          SELECT 1 FROM cohorts
          WHERE id = ${d.cohortId} AND institute_id = ${d.ownerId}
          LIMIT 1
        `) as any[];
        if (!cohort[0]) return res.status(400).json({ message: 'Cohort does not belong to this institute' });
      }
      instituteSubscription = await activeInstituteExamSubscription(d.ownerId);
      if (requestedStatus === 'live' && !instituteSubscription) {
        return res.status(402).json({
          message: 'An active institute subscription is required to publish this exam. Save it as a draft or renew the workspace plan.',
          code: 'INSTITUTE_SUBSCRIPTION_REQUIRED',
          candidateCharge: false,
        });
      }
    } else if (d.ownerType === 'creator') {
      const [c] = await db.select({ id: creators.id }).from(creators)
        .where(and(eq(creators.id, d.ownerId), eq(creators.userId, req.user.userId)));
      if (!c) return res.status(403).json({ message: 'Not your creator profile' });
    } else if (d.ownerType === 'admin' && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin only' });
    }

    const [bank] = await db.select({
      id: questionBanks.id,
      ownerType: questionBanks.ownerType,
      ownerId: questionBanks.ownerId,
    }).from(questionBanks).where(eq(questionBanks.id, d.bankId));
    if (!bank) return res.status(400).json({ message: 'Question bank not found' });
    const canUseBank = canAttachQuestionBank(
      { ownerType: d.ownerType, ownerId: d.ownerId },
      { ownerType: bank.ownerType, ownerId: bank.ownerId },
      !!req.user.isAdmin,
    );
    if (!canUseBank) return res.status(403).json({ message: 'Question bank is not available to this workspace' });
    const [runnableBank] = await execRows(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE is_active = true
            AND review_status = 'approved'
            AND question_format IN ('mcq_single', 'true_false')
            AND max_points > 0
            AND negative_marks BETWEEN 0 AND max_points
            AND json_typeof(options) = 'array'
            AND correct_answer >= 0
            AND correct_answer < json_array_length(options)
        )::int AS supported,
        COUNT(*) FILTER (
          WHERE is_active = true
            AND review_status = 'approved'
            AND question_format IN ('mcq_single', 'true_false')
            AND NOT (
              max_points > 0
              AND negative_marks BETWEEN 0 AND max_points
              AND json_typeof(options) = 'array'
              AND correct_answer >= 0
              AND correct_answer < json_array_length(options)
            )
        )::int AS invalid,
        COUNT(*) FILTER (
          WHERE is_active = true
            AND review_status = 'approved'
            AND question_format NOT IN ('mcq_single', 'true_false')
        )::int AS unsupported
      FROM questions WHERE bank_id = ${d.bankId}
    `) as any as Array<{ supported: number; invalid: number; unsupported: number }>;
    if ((runnableBank?.supported ?? 0) === 0) {
      return res.status(400).json({
        message: 'This scheduled-exam runner needs at least one valid active single-choice or true/false question. Check option keys, marks and negative marks.',
        invalidQuestionCount: runnableBank?.invalid ?? 0,
        unsupportedQuestionCount: runnableBank?.unsupported ?? 0,
      });
    }
    const questionCount = d.questionCount ?? Math.min(50, runnableBank.supported);
    if (questionCount > runnableBank.supported) {
      return res.status(400).json({
        message: `This bank has only ${runnableBank.supported} valid runnable question${runnableBank.supported === 1 ? '' : 's'}`,
        availableQuestionCount: runnableBank.supported,
      });
    }

    if (d.courseId) {
      const [course] = await db.select({
        id: courses.id,
        ownerType: courses.ownerType,
        ownerId: courses.ownerId,
        visibility: courses.visibility,
      }).from(courses).where(eq(courses.id, d.courseId));
      if (!course) return res.status(400).json({ message: 'Course not found' });
      const canUseCourse = d.ownerType === 'admin'
        || course.visibility === 'public'
        || (course.ownerType === d.ownerType && course.ownerId === d.ownerId);
      if (!canUseCourse) return res.status(403).json({ message: 'Course is not available to this workspace' });
    }

    const passwordHash = d.password ? await bcrypt.hash(d.password, Number(process.env.BCRYPT_ROUNDS) || 12) : null;
    let code = generateShareCode();
    for (let i = 0; i < 5; i++) {
      const [exists] = await db.select({ id: examInstances.id }).from(examInstances).where(eq(examInstances.shareCode, code));
      if (!exists) break;
      code = generateShareCode();
    }
    const [created] = await db.insert(examInstances).values({
      title: d.title,
      bankId: d.bankId ?? null,
      courseId: d.courseId ?? null,
      cohortId: d.cohortId ?? null,
      accessMode: d.ownerType === 'institute' && d.cohortId ? 'cohort_invite' : 'public_link',
      fundingSubscriptionId: instituteSubscription?.id ?? null,
      fundingVerifiedAt: instituteSubscription ? new Date() : null,
      ownerType: d.ownerType,
      ownerId: d.ownerId,
      durationMin: d.durationMin,
      passingScore: d.passingScore,
      maxAttempts: d.maxAttempts,
      questionCount,
      reviewPolicy,
      reviewReleaseAt,
      retakeCooldownMin: d.retakeCooldownMin,
      proctorMode: d.proctorMode,
      startsAt: d.startsAt ? new Date(d.startsAt) : null,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      passwordHash,
      shareCode: code,
      status: requestedStatus,
      createdBy: req.user.userId,
    }).returning();
    audit({ action: 'exam_instance.create', userId: req.user.userId, resourceType: 'exam_instance', resourceId: created.id, req });
    res.status(201).json({
      ...withoutExamPasswordHash(created),
      shareUrl: `${req.protocol}://${req.get('host')}/x/${code}`,
      fundingActive: d.ownerType === 'institute' ? !!instituteSubscription : null,
      candidateCharge: d.ownerType === 'institute' ? false : null,
      excludedUnsupportedQuestions: runnableBank?.unsupported ?? 0,
    });
  } catch (err: any) {
    logger.error('exam-instance.create.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.get('/exam-instances', authenticateToken, async (req: any, res: Response) => {
  try {
    const ownerType = String(req.query.ownerType || '');
    const ownerId = Number(req.query.ownerId);
    if (!['creator', 'institute', 'admin'].includes(ownerType) || !Number.isFinite(ownerId)) {
      return res.status(400).json({ message: 'ownerType and ownerId required' });
    }
    if (ownerType === 'institute') {
      const inst = await execRows(sql`
        SELECT i.id FROM institutes i
        JOIN institute_members m ON m.institute_id = i.id
        WHERE i.id = ${ownerId} AND m.user_id = ${req.user.userId}
          AND m.status = 'active' AND m.role IN ('owner','admin','teacher')
        LIMIT 1
      `) as any as Array<{ id: number }>;
      if (!inst[0]) return res.status(403).json({ message: 'Not your institute' });
    } else if (ownerType === 'creator') {
      const [c] = await db.select({ id: creators.id }).from(creators).where(and(eq(creators.id, ownerId), eq(creators.userId, req.user.userId)));
      if (!c) return res.status(403).json({ message: 'Not your creator profile' });
    } else if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const rows = await db.select({
      instance: examInstances,
      cohortName: cohorts.name,
    }).from(examInstances)
      .leftJoin(cohorts, eq(cohorts.id, examInstances.cohortId))
      .where(and(eq(examInstances.ownerType, ownerType), eq(examInstances.ownerId, ownerId)))
      .orderBy(desc(examInstances.id))
      .limit(100);
    const invitationRows = ownerType === 'institute'
      ? await execRows(sql`
          SELECT
            invitation.exam_instance_id AS "examInstanceId",
            COUNT(*)::int AS "total",
            COUNT(*) FILTER (WHERE invitation.status IN ('sent','opened','started'))::int AS "delivered",
            COUNT(*) FILTER (WHERE invitation.status = 'delivery_failed')::int AS "failed",
            COUNT(*) FILTER (WHERE invitation.status = 'started')::int AS "started"
          FROM exam_instance_invitations invitation
          INNER JOIN exam_instances exam ON exam.id = invitation.exam_instance_id
          WHERE exam.owner_type = 'institute' AND exam.owner_id = ${ownerId}
          GROUP BY invitation.exam_instance_id
        `) as any as Array<{ examInstanceId: number; total: number; delivered: number; failed: number; started: number }>
      : [];
    const invitationByExam = new Map(invitationRows.map((row) => [Number(row.examInstanceId), {
      total: Number(row.total),
      delivered: Number(row.delivered),
      failed: Number(row.failed),
      started: Number(row.started),
    }]));
    const activeSubscription = ownerType === 'institute'
      ? await activeInstituteExamSubscription(ownerId)
      : null;
    res.json(rows.map(({ instance, cohortName }) => ({
      ...withoutExamPasswordHash(instance),
      cohortName,
      shareUrl: `${req.protocol}://${req.get('host')}/x/${instance.shareCode}`,
      fundingActive: ownerType === 'institute' ? !!activeSubscription : null,
      candidateCharge: ownerType === 'institute' ? false : null,
      invitationSummary: invitationByExam.get(instance.id) ?? { total: 0, delivered: 0, failed: 0, started: 0 },
    })));
  } catch (err: any) {
    logger.error('exam-instances.list.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// Helper: verify that the current user owns the given exam instance
async function ensureExamOwnership(userId: number, instanceId: number, isAdmin = false): Promise<{ ok: boolean; inst?: any; reason?: string }> {
  const [inst] = await db.select().from(examInstances).where(eq(examInstances.id, instanceId));
  if (!inst) return { ok: false, reason: 'Exam not found' };
  if (inst.ownerType === 'institute') {
    const rows = await execRows(sql`
      SELECT 1 FROM institute_members
      WHERE institute_id = ${inst.ownerId} AND user_id = ${userId}
        AND status = 'active' AND role IN ('owner','admin','teacher')
      LIMIT 1
    `) as any[];
    if (!rows[0]) return { ok: false, reason: 'Not a member of this institute' };
  } else if (inst.ownerType === 'creator') {
    const [c] = await db.select({ id: creators.id }).from(creators).where(and(eq(creators.id, inst.ownerId), eq(creators.userId, userId)));
    if (!c) return { ok: false, reason: 'Not your exam' };
  } else if (inst.ownerType === 'admin' && !isAdmin) {
    return { ok: false, reason: 'Admin only' };
  } else if (!['institute', 'creator', 'admin'].includes(inst.ownerType)) {
    return { ok: false, reason: 'Unsupported exam owner' };
  }
  return { ok: true, inst };
}

const resultQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['all', 'in_progress', 'submitted', 'timed_out', 'abandoned']).default('all'),
  search: z.string().trim().max(160).default(''),
});

async function getOwnedExamResults(req: any, res: Response, exportAll = false) {
  const instanceId = Number(req.params.id);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return res.status(400).json({ message: 'Invalid exam id' });
  }
  const ownership = await ensureExamOwnership(req.user.userId, instanceId, !!req.user.isAdmin);
  if (!ownership.ok) {
    return res.status(ownership.reason === 'Exam not found' ? 404 : 403).json({ message: ownership.reason });
  }
  const parsed = resultQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid result filters', errors: parsed.error.flatten() });
  const { page, pageSize, status, search } = parsed.data;
  const offset = exportAll ? 0 : (page - 1) * pageSize;
  const limit = exportAll ? 50_000 : pageSize;
  const searchPattern = `%${search.toLowerCase()}%`;

  const [summary] = await execRows(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE a.submitted_at IS NOT NULL)::int AS completed,
      COUNT(*) FILTER (WHERE a.submitted_at IS NULL)::int AS in_progress,
      COUNT(*) FILTER (WHERE a.submitted_at IS NOT NULL AND a.passed = true)::int AS passed,
      COUNT(*) FILTER (WHERE a.status = 'timed_out')::int AS timed_out,
      COALESCE(ROUND(AVG(CASE WHEN a.total_points > 0 AND a.submitted_at IS NOT NULL
        THEN (a.score::numeric / a.total_points::numeric) * 100 END), 1), 0) AS average_score
    FROM exam_instance_attempts a
    WHERE a.instance_id = ${instanceId}
  `) as any as Array<Record<string, any>>;

  const [countRow] = await execRows(sql`
    SELECT COUNT(*)::int AS total
    FROM exam_instance_attempts a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.instance_id = ${instanceId}
      AND (${status === 'all'} OR a.status = ${status})
      AND (${search === ''} OR lower(COALESCE(a.email, u.email, '')) LIKE ${searchPattern}
        OR lower(COALESCE(u.name, '')) LIKE ${searchPattern})
  `) as any as Array<{ total: number }>;

  const attempts = await execRows(sql`
    SELECT
      a.id,
      a.user_id,
      COALESCE(a.email, u.email) AS email,
      u.name,
      a.started_at,
      a.last_heartbeat_at,
      a.submitted_at,
      a.score,
      a.total_points,
      a.total_questions,
      CASE WHEN a.total_points > 0 THEN ROUND((a.score::numeric / a.total_points::numeric) * 100, 1) ELSE 0 END AS score_pct,
      a.passed,
      a.status,
      GREATEST(0, ROUND(EXTRACT(EPOCH FROM (COALESCE(a.submitted_at, a.last_heartbeat_at) - a.started_at))))::int AS duration_sec
    FROM exam_instance_attempts a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.instance_id = ${instanceId}
      AND (${status === 'all'} OR a.status = ${status})
      AND (${search === ''} OR lower(COALESCE(a.email, u.email, '')) LIKE ${searchPattern}
        OR lower(COALESCE(u.name, '')) LIKE ${searchPattern})
    ORDER BY a.started_at DESC, a.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as any as Array<Record<string, any>>;

  if (exportAll) {
    const header = ['attempt_id', 'name', 'email', 'status', 'score', 'total_points', 'total_questions', 'score_percent', 'passed', 'started_at', 'submitted_at', 'duration_seconds'];
    const rows = attempts.map((attempt) => [
      attempt.id,
      attempt.name,
      attempt.email,
      attempt.status,
      attempt.score,
      attempt.total_points,
      attempt.total_questions,
      attempt.score_pct,
      attempt.submitted_at ? (attempt.passed ? 'yes' : 'no') : '',
      attempt.started_at instanceof Date ? attempt.started_at.toISOString() : attempt.started_at,
      attempt.submitted_at instanceof Date ? attempt.submitted_at.toISOString() : attempt.submitted_at,
      attempt.duration_sec,
    ].map(safeCsvCell).join(','));
    const filename = `exam-${instanceId}-results-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(`\uFEFF${[header.map(safeCsvCell).join(','), ...rows].join('\n')}`);
  }

  const completed = Number(summary?.completed ?? 0);
  const passed = Number(summary?.passed ?? 0);
  return res.json({
    exam: {
      id: ownership.inst.id,
      title: ownership.inst.title,
      status: ownership.inst.status,
      passingScore: ownership.inst.passingScore,
      startsAt: ownership.inst.startsAt,
      endsAt: ownership.inst.endsAt,
      ownerType: ownership.inst.ownerType,
    },
    summary: {
      total: Number(summary?.total ?? 0),
      completed,
      inProgress: Number(summary?.in_progress ?? 0),
      passed,
      failed: Math.max(completed - passed, 0),
      timedOut: Number(summary?.timed_out ?? 0),
      passRate: completed > 0 ? Math.round((passed / completed) * 100) : 0,
      averageScore: Number(summary?.average_score ?? 0),
    },
    attempts,
    pagination: {
      page,
      pageSize,
      total: Number(countRow?.total ?? 0),
      pages: Math.max(1, Math.ceil(Number(countRow?.total ?? 0) / pageSize)),
    },
  });
}

router.get('/exam-instances/:id/results', authenticateToken, async (req: any, res: Response) => {
  try {
    await getOwnedExamResults(req, res);
  } catch (err) {
    logger.error('exam-instance.results.error', { err });
    if (!res.headersSent) res.status(500).json({ message: 'Failed to load exam results' });
  }
});

router.get('/exam-instances/:id/results/export', authenticateToken, async (req: any, res: Response) => {
  try {
    await getOwnedExamResults(req, res, true);
  } catch (err) {
    logger.error('exam-instance.results.export.error', { err });
    if (!res.headersSent) res.status(500).json({ message: 'Failed to export exam results' });
  }
});

router.patch('/exam-instances/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ownership = await ensureExamOwnership(req.user.userId, id, !!req.user.isAdmin);
    if (!ownership.ok) return res.status(ownership.reason === 'Exam not found' ? 404 : 403).json({ message: ownership.reason });

    const schema = z.object({
      title: z.string().min(3).max(160).optional(),
      bankId: z.number().int().nullable().optional(),
      cohortId: z.number().int().nullable().optional(),
      durationMin: z.number().int().min(5).max(360).optional(),
      passingScore: z.number().int().min(10).max(100).optional(),
      maxAttempts: z.number().int().min(1).max(10).optional(),
      questionCount: z.number().int().min(1).max(500).optional(),
      reviewPolicy: z.enum(['immediate', 'after_final_attempt', 'after_window', 'score_only']).optional(),
      reviewReleaseAt: z.string().datetime().nullable().optional(),
      retakeCooldownMin: z.number().int().min(0).max(43_200).optional(),
      proctorMode: z.enum(['standard', 'browser_evidence']).optional(),
      startsAt: z.string().datetime().nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
      password: z.string().min(4).max(60).nullable().optional(),
      status: z.enum(['draft', 'live', 'closed']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const d = parsed.data;
    const update: any = { updatedAt: new Date() };

    const nextStatus = d.status ?? ownership.inst.status;
    const nextCohortId = d.cohortId === undefined ? ownership.inst.cohortId : d.cohortId;
    if (ownership.inst.ownerType === 'institute') {
      if (d.cohortId !== undefined && d.cohortId !== ownership.inst.cohortId) {
        if (d.cohortId !== null) {
          const cohort = await execRows(sql`
            SELECT 1 FROM cohorts
            WHERE id = ${d.cohortId} AND institute_id = ${ownership.inst.ownerId}
            LIMIT 1
          `) as any[];
          if (!cohort[0]) return res.status(400).json({ message: 'Cohort does not belong to this institute' });
        }
        const [{ count }] = await execRows(sql`
          SELECT (
            (SELECT COUNT(*) FROM exam_instance_attempts WHERE instance_id = ${id})
            + (SELECT COUNT(*) FROM exam_instance_invitations WHERE exam_instance_id = ${id})
          )::int AS count
        `) as any as Array<{ count: number }>;
        if (Number(count) > 0) {
          return res.status(409).json({ message: 'The cohort cannot be changed after invitations or attempts exist. Create a new exam for the new cohort.' });
        }
      }
      if (nextStatus === 'live' && !nextCohortId) {
        return res.status(400).json({
          message: 'Choose a cohort before publishing. Institute exams use private candidate invitations.',
          code: 'INSTITUTE_EXAM_COHORT_REQUIRED',
        });
      }
      if (nextStatus === 'live') {
        const subscription = await activeInstituteExamSubscription(ownership.inst.ownerId);
        if (!subscription) {
          return res.status(402).json({
            message: 'An active institute subscription is required while this exam is live. Candidates are never charged.',
            code: 'INSTITUTE_SUBSCRIPTION_REQUIRED',
            candidateCharge: false,
          });
        }
        update.fundingSubscriptionId = subscription.id;
        update.fundingVerifiedAt = new Date();
      }
      if (d.cohortId !== undefined) {
        update.cohortId = d.cohortId;
        update.accessMode = d.cohortId ? 'cohort_invite' : 'public_link';
      }
    } else if (d.cohortId !== undefined) {
      return res.status(400).json({ message: 'Cohorts are available only for institute exams' });
    }

    const nextStart = d.startsAt === undefined ? ownership.inst.startsAt : (d.startsAt ? new Date(d.startsAt) : null);
    const nextEnd = d.endsAt === undefined ? ownership.inst.endsAt : (d.endsAt ? new Date(d.endsAt) : null);
    const nextReviewPolicy = d.reviewPolicy ?? ownership.inst.reviewPolicy;
    const nextReviewReleaseAt = d.reviewReleaseAt === undefined
      ? ownership.inst.reviewReleaseAt
      : d.reviewReleaseAt ? new Date(d.reviewReleaseAt) : null;
    if (nextStart && nextEnd && new Date(nextEnd) <= new Date(nextStart)) {
      return res.status(400).json({ message: 'Exam end time must be after its start time' });
    }
    if (nextStatus === 'live' && nextReviewPolicy === 'after_window' && !nextReviewReleaseAt && !nextEnd) {
      return res.status(400).json({ message: 'After-window review requires an exam end time or a review release time' });
    }
    if (nextReviewReleaseAt && nextReviewPolicy !== 'after_window') {
      return res.status(400).json({ message: 'A review release time is only valid with the after-window review policy' });
    }
    if (nextReviewReleaseAt && nextEnd && new Date(nextReviewReleaseAt) < new Date(nextEnd)) {
      return res.status(400).json({ message: 'Review release time cannot be before the exam closes' });
    }
    if (d.bankId) {
      const [bank] = await db.select({
        id: questionBanks.id,
        ownerType: questionBanks.ownerType,
        ownerId: questionBanks.ownerId,
      }).from(questionBanks).where(eq(questionBanks.id, d.bankId));
      if (!bank) return res.status(400).json({ message: 'Question bank not found' });
      const canUseBank = canAttachQuestionBank(
        { ownerType: ownership.inst.ownerType, ownerId: ownership.inst.ownerId },
        { ownerType: bank.ownerType, ownerId: bank.ownerId },
        !!req.user.isAdmin,
      );
      if (!canUseBank) return res.status(403).json({ message: 'Question bank is not available to this workspace' });
      const [runnableBank] = await execRows(sql`
        SELECT COUNT(*) FILTER (
          WHERE is_active = true
            AND review_status = 'approved'
            AND question_format IN ('mcq_single', 'true_false')
            AND max_points > 0
            AND negative_marks BETWEEN 0 AND max_points
            AND json_typeof(options) = 'array'
            AND correct_answer >= 0
            AND correct_answer < json_array_length(options)
        )::int AS supported
        FROM questions WHERE bank_id = ${d.bankId}
      `) as any as Array<{ supported: number }>;
      if ((runnableBank?.supported ?? 0) === 0) {
        return res.status(400).json({ message: 'Choose a bank with at least one active single-choice or true/false question.' });
      }
      const nextQuestionCount = d.questionCount ?? ownership.inst.questionCount;
      if (nextQuestionCount > runnableBank.supported) {
        return res.status(400).json({
          message: `This bank has only ${runnableBank.supported} valid runnable question${runnableBank.supported === 1 ? '' : 's'}`,
          availableQuestionCount: runnableBank.supported,
        });
      }
    } else if (d.questionCount !== undefined && ownership.inst.bankId) {
      const [runnableBank] = await execRows(sql`
        SELECT COUNT(*) FILTER (
          WHERE is_active = true
            AND review_status = 'approved'
            AND question_format IN ('mcq_single', 'true_false')
            AND max_points > 0
            AND negative_marks BETWEEN 0 AND max_points
            AND json_typeof(options) = 'array'
            AND correct_answer >= 0
            AND correct_answer < json_array_length(options)
        )::int AS supported
        FROM questions WHERE bank_id = ${ownership.inst.bankId}
      `) as any as Array<{ supported: number }>;
      if (d.questionCount > (runnableBank?.supported ?? 0)) {
        return res.status(400).json({
          message: `This bank has only ${runnableBank?.supported ?? 0} valid runnable questions`,
          availableQuestionCount: runnableBank?.supported ?? 0,
        });
      }
    }
    if (d.title !== undefined) update.title = d.title;
    if (d.bankId !== undefined) update.bankId = d.bankId;
    if (d.durationMin !== undefined) update.durationMin = d.durationMin;
    if (d.passingScore !== undefined) update.passingScore = d.passingScore;
    if (d.maxAttempts !== undefined) update.maxAttempts = d.maxAttempts;
    if (d.questionCount !== undefined) update.questionCount = d.questionCount;
    if (d.reviewPolicy !== undefined) update.reviewPolicy = d.reviewPolicy;
    if (d.reviewReleaseAt !== undefined) update.reviewReleaseAt = d.reviewReleaseAt ? new Date(d.reviewReleaseAt) : null;
    if (d.retakeCooldownMin !== undefined) update.retakeCooldownMin = d.retakeCooldownMin;
    if (d.proctorMode !== undefined) update.proctorMode = d.proctorMode;
    if (d.startsAt !== undefined) update.startsAt = d.startsAt ? new Date(d.startsAt) : null;
    if (d.endsAt !== undefined) update.endsAt = d.endsAt ? new Date(d.endsAt) : null;
    if (d.status !== undefined) update.status = d.status;
    if (d.password !== undefined) update.passwordHash = d.password ? await bcrypt.hash(d.password, Number(process.env.BCRYPT_ROUNDS) || 12) : null;

    const [updated] = await db.update(examInstances).set(update).where(eq(examInstances.id, id)).returning();
    audit({ action: 'exam_instance.update', userId: req.user.userId, resourceType: 'exam_instance', resourceId: id, req });
    res.json({ ...withoutExamPasswordHash(updated), shareUrl: `${req.protocol}://${req.get('host')}/x/${updated.shareCode}` });
  } catch (err: any) {
    logger.error('exam-instance.update.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/exam-instances/:id/invitations/send', authenticateToken, async (req: any, res: Response) => {
  try {
    const instanceId = Number(req.params.id);
    if (!Number.isInteger(instanceId)) return res.status(400).json({ message: 'Invalid exam id' });
    const parsed = z.object({
      mode: z.enum(['unsent', 'failed', 'all']).default('unsent'),
      limit: z.number().int().min(1).max(100).default(50),
    }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const ownership = await ensureExamOwnership(req.user.userId, instanceId, !!req.user.isAdmin);
    if (!ownership.ok) return res.status(ownership.reason === 'Exam not found' ? 404 : 403).json({ message: ownership.reason });
    const inst = ownership.inst as typeof examInstances.$inferSelect;
    if (inst.ownerType !== 'institute' || inst.accessMode !== 'cohort_invite' || !inst.cohortId) {
      return res.status(409).json({ message: 'Candidate invitations are available only for institute cohort exams.' });
    }
    if (inst.status !== 'live') {
      return res.status(409).json({ message: 'Publish the exam before sending candidate invitations.' });
    }
    const subscription = await verifyInstituteExamFunding(inst);
    if (!subscription) {
      return res.status(402).json({
        message: 'An active institute subscription is required to deliver this exam. Candidates are never charged.',
        code: 'INSTITUTE_SUBSCRIPTION_REQUIRED',
        candidateCharge: false,
      });
    }

    const requestStartedAt = new Date();
    const delivery = await withSessionAdvisoryLock(pool, 7303, instanceId, async (client) => {
      const lockedDb = drizzlePgClient(client);
      const recipientResult: any = await lockedDb.execute(sql`
        SELECT DISTINCT ON (lower(student.email))
          student.id,
          lower(btrim(student.email)) AS email,
          student.name,
          invitation.id AS "invitationId",
          invitation.status AS "invitationStatus"
        FROM cohort_students student
        LEFT JOIN exam_instance_invitations invitation
          ON invitation.exam_instance_id = ${instanceId}
         AND invitation.email = lower(btrim(student.email))
        WHERE student.cohort_id = ${inst.cohortId}
          AND student.institute_id = ${inst.ownerId}
          AND student.status <> 'inactive'
          AND (
            (${parsed.data.mode} = 'all' AND (
              invitation.id IS NULL
              OR invitation.last_sent_at IS NULL
              OR invitation.last_sent_at < ${requestStartedAt}
            ))
            OR (${parsed.data.mode} = 'failed' AND invitation.status = 'delivery_failed')
            OR (${parsed.data.mode} = 'unsent' AND (invitation.id IS NULL OR invitation.status IN ('pending','delivery_failed')))
          )
        ORDER BY lower(student.email), student.id
        LIMIT ${parsed.data.limit}
      `);
      const recipients = (recipientResult?.rows ?? recipientResult ?? []) as Array<{
        id: number;
        email: string;
        name: string | null;
        invitationId: number | null;
        invitationStatus: string | null;
      }>;

      const expiresAt = instituteInviteExpiry(subscription.renewsAt, inst.endsAt);
      const deliverable = recipients.filter((recipient) => z.string().email().safeParse(recipient.email).success);
      const invalidRecipients = recipients.length - deliverable.length;
      const staged: Array<{ invitationId: number; email: string; name: string | null; rawToken: string }> = [];
      for (const recipient of deliverable) {
        const token = createExamInviteToken();
        const [invitation] = await lockedDb.insert(examInstanceInvitations).values({
          examInstanceId: instanceId,
          cohortStudentId: recipient.id,
          email: recipient.email,
          recipientName: recipient.name,
          tokenHash: token.tokenHash,
          status: 'pending',
          expiresAt,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [examInstanceInvitations.examInstanceId, examInstanceInvitations.email],
          set: {
            cohortStudentId: recipient.id,
            recipientName: recipient.name,
            tokenHash: token.tokenHash,
            status: 'pending',
            expiresAt,
            updatedAt: new Date(),
          },
        }).returning({ id: examInstanceInvitations.id });
        staged.push({ invitationId: invitation.id, email: recipient.email, name: recipient.name, rawToken: token.rawToken });
      }

      let sent = 0;
      let failed = 0;
      const baseUrl = examInviteBaseUrl(req);
      const safeTitle = escapeExamInviteHtml(inst.title);
      const safeInstituteName = escapeExamInviteHtml(
        (await lockedDb.select({ name: institutes.name }).from(institutes).where(eq(institutes.id, inst.ownerId)).limit(1))[0]?.name
          ?? 'your institute',
      );
      const concurrency = 5;
      for (let offset = 0; offset < staged.length; offset += concurrency) {
        const batch = staged.slice(offset, offset + concurrency);
        const results = await Promise.all(batch.map(async (recipient) => {
          // Keep the bearer credential in the URL fragment. Browsers do not send
          // fragments to nginx, Express, analytics referrers or access logs; the
          // SPA moves it into request headers for the validation handshake.
          const link = buildExamInviteLink(baseUrl, inst.shareCode, recipient.rawToken, recipient.email);
          const safeLink = escapeExamInviteHtml(link);
          const safeName = escapeExamInviteHtml(recipient.name?.trim() || 'Learner');
          const delivered = await emailService.sendEmail({
            to: recipient.email,
            subject: `${inst.title} · private assessment invitation`,
            html: `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#172033"><div style="max-width:600px;margin:0 auto;padding:32px 16px"><div style="background:#fff;border:1px solid #dfe5ec;border-radius:14px;overflow:hidden"><div style="background:#111827;color:#fff;padding:24px"><div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1">Octamy secure assessment</div><h1 style="font-size:22px;margin:8px 0 0">${safeTitle}</h1></div><div style="padding:24px"><p>Hi ${safeName},</p><p>${safeInstituteName} has invited you to a private assessment on Octamy. The institute has funded this assessment; you will not be asked to pay.</p><p style="margin:26px 0"><a href="${safeLink}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700">Open secure assessment</a></p><p style="font-size:13px;color:#64748b">This link is issued only for ${escapeExamInviteHtml(recipient.email)}. Do not forward it. It expires ${escapeExamInviteHtml(expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST.</p></div></div></div></body></html>`,
          });
          const deliveredAt = new Date();
          await lockedDb.update(examInstanceInvitations).set({
            status: delivered ? 'sent' : 'delivery_failed',
            sentAt: delivered ? sql`COALESCE(${examInstanceInvitations.sentAt}, ${deliveredAt})` : undefined,
            lastSentAt: deliveredAt,
            sendCount: sql`${examInstanceInvitations.sendCount} + 1`,
            updatedAt: deliveredAt,
          }).where(eq(examInstanceInvitations.id, recipient.invitationId));
          return delivered;
        }));
        sent += results.filter(Boolean).length;
        failed += results.filter((delivered) => !delivered).length;
      }
      return { recipients, invalidRecipients, sent, failed };
    });
    const { recipients, invalidRecipients, sent, failed } = delivery;

    await audit({
      action: parsed.data.mode === 'unsent' ? 'exam_invitation.send' : 'exam_invitation.resend',
      userId: req.user.userId,
      actorRole: 'institute',
      resourceType: 'exam_instance',
      resourceId: instanceId,
      metadata: {
        mode: parsed.data.mode,
        selected: recipients.length,
        sent,
        failed,
        invalidRecipients,
        batchLimit: parsed.data.limit,
      },
      status: sent > 0 || recipients.length === 0 ? 'success' : 'failure',
      req,
    });

    const response = {
      selected: recipients.length,
      sent,
      failed,
      invalidRecipients,
      hasMore: recipients.length === parsed.data.limit,
      candidateCharge: false,
      message: recipients.length === 0
        ? 'No matching cohort invitations are waiting to be sent.'
        : failed === 0
          ? `${sent} private invitation${sent === 1 ? '' : 's'} sent.`
          : `${sent} sent; ${failed} could not be delivered. Check SMTP and retry failed invitations.`,
    };
    if (failed > 0 && sent === 0) {
      return res.status(503).json({ ...response, code: 'EXAM_INVITATION_DELIVERY_UNAVAILABLE' });
    }
    return res.status(failed > 0 ? 207 : 200).json(response);
  } catch (err: any) {
    logger.error('exam-invitation.send.error', { err });
    return res.status(500).json({ message: 'Failed to send private exam invitations' });
  }
});

router.delete('/exam-instances/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ownership = await ensureExamOwnership(req.user.userId, id, !!req.user.isAdmin);
    if (!ownership.ok) return res.status(ownership.reason === 'Exam not found' ? 404 : 403).json({ message: ownership.reason });

    // Block hard-delete if attempts exist; offer soft-close instead via PATCH status='closed'
    const attempts = await execRows(sql`SELECT COUNT(*)::int AS c FROM exam_instance_attempts WHERE instance_id = ${id}`) as any as Array<{ c: number }>;
    if ((attempts[0]?.c ?? 0) > 0) {
      return res.status(409).json({ message: 'Cannot delete exam with submitted attempts. Close it instead.', attemptCount: attempts[0].c });
    }
    await db.delete(examInstances).where(eq(examInstances.id, id));
    audit({ action: 'exam_instance.delete', userId: req.user.userId, resourceType: 'exam_instance', resourceId: id, req });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('exam-instance.delete.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// Result rows remain separate from the evidence timeline. Signals support a human
// review; they are not labelled as cheating and never change the score automatically.
router.get('/exam-instances/:id/attempts', authenticateToken, async (req: any, res: Response) => {
  try {
    const instanceId = Number(req.params.id);
    const ownership = await ensureExamOwnership(req.user.userId, instanceId, !!req.user.isAdmin);
    if (!ownership.ok) return res.status(ownership.reason === 'Exam not found' ? 404 : 403).json({ message: ownership.reason });

    const rows = await execRows(sql`
      SELECT
        a.id,
        a.user_id,
        a.email,
        a.started_at,
        a.last_heartbeat_at,
        a.last_autosave_at,
        a.submitted_at,
        a.score,
        a.total_points,
        a.total_questions,
        a.passed,
        a.status,
        a.proctor_mode,
        a.evidence_consent_at,
        (COUNT(e.id) FILTER (WHERE e.event_type = 'visibility_hidden'))::int AS visibility_hidden_count,
        (COUNT(e.id) FILTER (WHERE e.event_type = 'window_blur'))::int AS window_blur_count,
        (COUNT(e.id) FILTER (WHERE e.event_type = 'fullscreen_exit'))::int AS fullscreen_exit_count,
        (COUNT(e.id) FILTER (WHERE e.event_type = 'paste'))::int AS paste_count,
        (COUNT(e.id) FILTER (WHERE e.event_type = 'network_offline'))::int AS network_interruption_count,
        COALESCE((SUM(
          CASE WHEN e.event_type = 'network_online'
            THEN COALESCE((e.metadata->>'durationMs')::integer, 0)
            ELSE 0 END
        ) / 1000)::int, 0) AS disconnected_seconds
      FROM exam_instance_attempts a
      LEFT JOIN exam_proctor_events e ON e.attempt_id = a.id
      WHERE a.instance_id = ${instanceId}
      GROUP BY a.id
      ORDER BY a.id DESC
      LIMIT 500
    `);
    res.json({
      exam: {
        id: ownership.inst.id,
        title: ownership.inst.title,
        passingScore: ownership.inst.passingScore,
        proctorMode: ownership.inst.proctorMode,
      },
      attempts: rows,
      evidenceBoundary: 'Browser events are contextual signals for human review only. They are not proof of misconduct and do not alter scoring.',
    });
  } catch (err: any) {
    logger.error('exam-instance.attempts.error', { err });
    res.status(500).json({ message: 'Failed to load exam attempts' });
  }
});

router.get('/exam-instances/:instanceId/attempts/:attemptId', authenticateToken, async (req: any, res: Response) => {
  try {
    const instanceId = Number(req.params.instanceId);
    const attemptId = Number(req.params.attemptId);
    if (!Number.isFinite(attemptId)) return res.status(400).json({ message: 'Bad attempt id' });
    const ownership = await ensureExamOwnership(req.user.userId, instanceId, !!req.user.isAdmin);
    if (!ownership.ok) return res.status(ownership.reason === 'Exam not found' ? 404 : 403).json({ message: ownership.reason });

    const [attempt] = await db.select({
      id: examInstanceAttempts.id,
      instanceId: examInstanceAttempts.instanceId,
      userId: examInstanceAttempts.userId,
      email: examInstanceAttempts.email,
      startedAt: examInstanceAttempts.startedAt,
      lastHeartbeatAt: examInstanceAttempts.lastHeartbeatAt,
      lastAutosaveAt: examInstanceAttempts.lastAutosaveAt,
      submittedAt: examInstanceAttempts.submittedAt,
      score: examInstanceAttempts.score,
      totalPoints: examInstanceAttempts.totalPoints,
      totalQuestions: examInstanceAttempts.totalQuestions,
      passed: examInstanceAttempts.passed,
      status: examInstanceAttempts.status,
      proctorMode: examInstanceAttempts.proctorMode,
      evidenceConsentAt: examInstanceAttempts.evidenceConsentAt,
      evidenceConsentVersion: examInstanceAttempts.evidenceConsentVersion,
    }).from(examInstanceAttempts).where(and(
      eq(examInstanceAttempts.id, attemptId),
      eq(examInstanceAttempts.instanceId, instanceId),
    ));
    if (!attempt) return res.status(404).json({ message: 'Attempt not found for this exam' });

    const events = await db.select({
      id: examProctorEvents.id,
      eventType: examProctorEvents.eventType,
      clientAt: examProctorEvents.clientAt,
      occurredAt: examProctorEvents.occurredAt,
      metadata: examProctorEvents.metadata,
    }).from(examProctorEvents)
      .where(eq(examProctorEvents.attemptId, attemptId))
      .orderBy(examProctorEvents.occurredAt)
      .limit(1000);

    audit({ action: 'exam_attempt.evidence_view', userId: req.user.userId, resourceType: 'exam_instance_attempt', resourceId: attemptId, req });
    res.json({
      exam: { id: ownership.inst.id, title: ownership.inst.title, passingScore: ownership.inst.passingScore },
      attempt,
      events,
      evidenceBoundary: {
        humanReviewOnly: true,
        affectsScore: false,
        capturesWebcam: false,
        capturesMicrophone: false,
        capturesScreenContents: false,
        capturesClipboardContents: false,
        automatedCheatingVerdict: false,
      },
    });
  } catch (err: any) {
    logger.error('exam-instance.attempt-detail.error', { err });
    res.status(500).json({ message: 'Failed to load attempt evidence' });
  }
});

router.get('/x/:code', async (req: Request, res: Response) => {
  try {
    const [inst] = await db.select().from(examInstances).where(eq(examInstances.shareCode, req.params.code));
    if (!inst || inst.status !== 'live') return res.status(404).json({ message: 'Exam not found or not live' });
    if (inst.endsAt && new Date(inst.endsAt) < new Date()) return res.status(410).json({ message: 'Exam window closed' });
    if (inst.ownerType === 'institute') {
      const subscription = await verifyInstituteExamFunding(inst);
      if (!subscription) {
        return res.status(503).json({
          message: 'This institute assessment is temporarily unavailable. The candidate is not responsible for payment; please contact the institute.',
          code: 'INSTITUTE_FUNDING_INACTIVE',
          candidateCharge: false,
        });
      }
    }
    let invitationEmail: string | null = null;
    if (inst.accessMode === 'cohort_invite') {
      const credentials = inviteCredentials(req);
      if (!credentials) {
        return res.status(403).json({
          message: 'Open the private invitation sent to your cohort email address.',
          code: 'EXAM_INVITATION_REQUIRED',
        });
      }
      const invitation = await validExamInvitation(inst.id, credentials.email, credentials.tokenHash);
      if (!invitation) {
        return res.status(403).json({
          message: 'This private invitation is invalid, expired or has been replaced. Ask the institute to resend it.',
          code: 'EXAM_INVITATION_INVALID',
        });
      }
      invitationEmail = invitation.email;
      await db.update(examInstanceInvitations).set({
        openedAt: sql`COALESCE(${examInstanceInvitations.openedAt}, NOW())`,
        status: sql`CASE WHEN ${examInstanceInvitations.status} IN ('pending','sent','delivery_failed') THEN 'opened' ELSE ${examInstanceInvitations.status} END`,
        updatedAt: new Date(),
      }).where(eq(examInstanceInvitations.id, invitation.id));
    }
    const requiresPassword = !!inst.passwordHash;
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      id: inst.id,
      title: inst.title,
      durationMin: inst.durationMin,
      passingScore: inst.passingScore,
      requiresPassword,
      startsAt: inst.startsAt,
      endsAt: inst.endsAt,
      maxAttempts: inst.maxAttempts,
      questionCount: inst.questionCount,
      reviewPolicy: inst.reviewPolicy,
      reviewAvailableAt: inst.reviewPolicy === 'after_window'
        ? (inst.reviewReleaseAt ?? inst.endsAt)
        : null,
      retakeCooldownMin: inst.retakeCooldownMin,
      cohortRestricted: !!inst.cohortId,
      accessMode: inst.accessMode,
      invitationEmail,
      candidateCharge: inst.ownerType === 'institute' ? false : null,
      proctorMode: inst.proctorMode,
      evidenceDisclosure: inst.proctorMode === 'browser_evidence'
        ? 'This exam records autosave/connectivity plus tab visibility, window focus, fullscreen and paste events for human review. It does not access your camera, microphone, screen contents, clipboard contents or keystrokes, and it does not make an automated cheating decision.'
        : 'This exam autosaves answers and records connection interruptions for recovery. It does not access your camera, microphone or screen.',
    });
  } catch (err: any) {
    logger.error('exam-share.lookup.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/x/:code/start', examStartLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      password: z.string().optional(),
      email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
      inviteToken: z.string().optional(),
      evidenceConsent: z.boolean(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const [inst] = await db.select().from(examInstances).where(eq(examInstances.shareCode, req.params.code));
    if (!inst || inst.status !== 'live') return res.status(404).json({ message: 'Exam not found' });
    const now = new Date();
    if (inst.startsAt && new Date(inst.startsAt) > now) {
      return res.status(403).json({ message: `Exam opens ${new Date(inst.startsAt).toISOString()}` });
    }
    if (inst.endsAt && new Date(inst.endsAt) < now) {
      return res.status(410).json({ message: 'Exam window closed' });
    }
    if (inst.ownerType === 'institute') {
      const subscription = await verifyInstituteExamFunding(inst);
      if (!subscription) {
        return res.status(503).json({
          message: 'This institute assessment is temporarily unavailable. You will never be asked to pay; contact the institute.',
          code: 'INSTITUTE_FUNDING_INACTIVE',
          candidateCharge: false,
        });
      }
    }
    if (inst.passwordHash) {
      if (!parsed.data.password) return res.status(401).json({ message: 'Password required' });
      const ok = await bcrypt.compare(parsed.data.password, inst.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Invalid password' });
    }
    const authenticatedUser = (req as any).user as { userId: number; email: string } | undefined;
    const authenticatedEmail = authenticatedUser?.email?.trim().toLowerCase();
    if (authenticatedEmail && parsed.data.email && authenticatedEmail !== parsed.data.email) {
      return res.status(400).json({ message: 'Use the email address associated with your signed-in account' });
    }
    const resolvedEmail = authenticatedEmail || parsed.data.email;
    if (!resolvedEmail) return res.status(400).json({ message: 'Email is required' });
    if (parsed.data.evidenceConsent !== true) {
      return res.status(400).json({ message: 'Review and accept the exam evidence notice before starting' });
    }

    let invitationId: number | null = null;
    let invitationTokenHash: string | null = null;
    if (inst.accessMode === 'cohort_invite') {
      if (!parsed.data.inviteToken || !isValidExamInviteToken(parsed.data.inviteToken)) {
        return res.status(403).json({
          message: 'A valid private invitation is required for this cohort exam.',
          code: 'EXAM_INVITATION_REQUIRED',
        });
      }
      invitationTokenHash = hashExamInviteToken(parsed.data.inviteToken);
      const invitation = await validExamInvitation(inst.id, resolvedEmail, invitationTokenHash);
      if (!invitation) {
        return res.status(403).json({
          message: 'This invitation does not match the candidate email, has expired or was replaced. Ask the institute to resend it.',
          code: 'EXAM_INVITATION_INVALID',
        });
      }
      invitationId = invitation.id;
    }

    if (inst.cohortId) {
      const member = await execRows(sql`
        SELECT 1 FROM cohort_students
        WHERE cohort_id = ${inst.cohortId}
          AND lower(email) = ${resolvedEmail}
          AND status <> 'inactive'
        LIMIT 1
      `) as any[];
      if (!member[0]) return res.status(403).json({ message: 'This email is not an active member of the assigned cohort' });
    }

    const userId = authenticatedUser?.userId ?? null;
    if (!inst.bankId) {
      return res.status(409).json({ message: 'This exam has no question bank attached. Contact the exam owner.' });
    }
    const deadlineAt = scheduledAttemptDeadline(now, inst.durationMin, inst.endsAt);

    const attempt = await db.transaction(async (tx) => {
      if (invitationId && invitationTokenHash) {
        const lockedInvitation: any = await tx.execute(sql`
          SELECT id
          FROM exam_instance_invitations
          WHERE id = ${invitationId}
            AND exam_instance_id = ${inst.id}
            AND email = ${resolvedEmail}
            AND token_hash = ${invitationTokenHash}
            AND status <> 'revoked'
            AND expires_at > NOW()
          FOR UPDATE
        `);
        const validRows = (lockedInvitation?.rows ?? lockedInvitation ?? []) as Array<{ id: number }>;
        if (!validRows[0]) {
          throw Object.assign(new Error('Invitation is no longer valid'), { code: 'EXAM_INVITATION_INVALID' });
        }
      }
      // Count/check/create is one serialised operation per exam + learner
      // identity. Without this lock, parallel start requests can both pass the
      // max-attempt check on horizontally scaled application instances.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(7201, hashtext(${`${inst.id}:${resolvedEmail}`}))`);
      const identityPredicate = userId
        ? sql`(user_id = ${userId} OR lower(email) = ${resolvedEmail})`
        : sql`lower(email) = ${resolvedEmail}`;
      const priorResult: any = await tx.execute(sql`
        SELECT id, started_at, deadline_at, submitted_at, status, answers, passing_score_snapshot
        FROM exam_instance_attempts
        WHERE instance_id = ${inst.id} AND ${identityPredicate}
        ORDER BY started_at DESC, id DESC
        FOR UPDATE
      `);
      const priorAttempts = (priorResult?.rows ?? priorResult ?? []) as Array<{
        id: number;
        started_at: Date | string;
        deadline_at: Date | string | null;
        submitted_at: Date | string | null;
        status: string;
        answers: Record<string, number | string | number[]> | null;
        passing_score_snapshot: number | null;
      }>;
      // A device may disappear after its last autosave and never send the final
      // request. Finalise an expired immutable snapshot here so that orphaned
      // state cannot permanently block a legitimate retake.
      for (const candidate of priorAttempts) {
        if (candidate.submitted_at || candidate.status !== 'in_progress') continue;
        const frozenDeadline = candidate.deadline_at
          ? new Date(candidate.deadline_at)
          : scheduledAttemptDeadline(candidate.started_at, inst.durationMin, inst.endsAt);
        if (!isScheduledDeadlineExceeded(frozenDeadline, now.getTime())) continue;
        const expiredItems = await tx.select({
          questionId: examInstanceAttemptItems.questionId,
          correctAnswer: examInstanceAttemptItems.correctAnswer,
          maxPoints: examInstanceAttemptItems.maxPoints,
          negativeMarks: examInstanceAttemptItems.negativeMarks,
        }).from(examInstanceAttemptItems)
          .where(eq(examInstanceAttemptItems.attemptId, candidate.id))
          .orderBy(examInstanceAttemptItems.position);
        let expiredScoring: ReturnType<typeof scoreScheduledQuestionSnapshots> | null = null;
        if (expiredItems.length > 0) {
          try {
            expiredScoring = scoreScheduledQuestionSnapshots(expiredItems, candidate.answers ?? {});
          } catch {
            // A legacy malformed snapshot must not leave the identity locked in
            // progress forever. Preserve its existing totals and fail it closed.
          }
        }
        const expiredScorePct = expiredScoring
          ? scheduledScorePercentage(expiredScoring.score, expiredScoring.totalPoints)
          : null;
        const expiredPassed = expiredScorePct === null
          ? false
          : scheduledAttemptPassed(expiredScorePct, candidate.passing_score_snapshot ?? inst.passingScore);
        await tx.update(examInstanceAttempts).set({
          submittedAt: frozenDeadline,
          status: 'timed_out',
          passed: expiredPassed,
          ...(expiredScoring ? {
            score: expiredScoring.score,
            totalPoints: expiredScoring.totalPoints,
            totalQuestions: expiredScoring.totalQuestions,
          } : {}),
        }).where(and(
          eq(examInstanceAttempts.id, candidate.id),
          isNull(examInstanceAttempts.submittedAt),
        ));
        candidate.submitted_at = frozenDeadline;
        candidate.status = 'timed_out';
      }
      const activeAttempt = priorAttempts.find((candidate) => !candidate.submitted_at && candidate.status === 'in_progress');
      if (activeAttempt) {
        throw Object.assign(new Error('An attempt is already in progress'), {
          code: 'ACTIVE_EXAM_ATTEMPT',
          attemptId: activeAttempt.id,
        });
      }
      if (priorAttempts.length >= inst.maxAttempts) {
        throw Object.assign(new Error('Maximum attempts reached'), {
          code: 'MAX_EXAM_ATTEMPTS',
          maxAttempts: inst.maxAttempts,
        });
      }
      const latest = priorAttempts[0];
      const retakeAvailableAt = scheduledRetakeAvailableAt(
        latest ? (latest.submitted_at ?? latest.started_at) : null,
        inst.retakeCooldownMin,
        now.getTime(),
      );
      if (retakeAvailableAt) {
        throw Object.assign(new Error('Retake cooldown is active'), {
          code: 'EXAM_RETAKE_COOLDOWN',
          availableAt: retakeAvailableAt.toISOString(),
        });
      }

      const [created] = await tx.insert(examInstanceAttempts).values({
        instanceId: inst.id,
        invitationId,
        userId,
        email: resolvedEmail,
        // Write application UTC explicitly. PostgreSQL `now()` on a timestamp-without-
        // timezone column can otherwise be reinterpreted with the host timezone and
        // silently extend/shorten the server-enforced exam timer.
        startedAt: now,
        deadlineAt,
        passingScoreSnapshot: inst.passingScore,
        maxAttemptsSnapshot: inst.maxAttempts,
        reviewPolicySnapshot: inst.reviewPolicy,
        reviewReleaseAtSnapshot: inst.reviewReleaseAt ?? inst.endsAt,
        questionSnapshotSource: 'start',
        lastHeartbeatAt: now,
        proctorMode: inst.proctorMode,
        evidenceConsentAt: now,
        evidenceConsentVersion: inst.proctorMode === 'browser_evidence'
          ? 'browser-evidence-v1'
          : 'resilient-assessment-v1',
      }).returning();

      // Select exactly once. Every subsequent render, sync validation and score
      // reads these rows rather than the mutable source question bank.
      const sourceQuestions = await tx.select().from(questions).where(and(
        eq(questions.bankId, inst.bankId!),
        eq(questions.isActive, true),
        eq(questions.reviewStatus, 'approved'),
        sql`${questions.questionFormat} IN ('mcq_single', 'true_false')`,
        sql`${questions.maxPoints} > 0`,
        sql`${questions.negativeMarks} BETWEEN 0 AND ${questions.maxPoints}`,
        sql`json_typeof(${questions.options}) = 'array'`,
        sql`${questions.correctAnswer} >= 0`,
        sql`${questions.correctAnswer} < json_array_length(${questions.options})`,
      )).orderBy(
        sql`md5(${questions.id}::text || ${String(created.id)})`,
        questions.id,
      ).limit(inst.questionCount);

      if (sourceQuestions.length !== inst.questionCount) {
        throw Object.assign(new Error('Question bank does not have enough runnable questions'), {
          code: 'INSUFFICIENT_EXAM_SNAPSHOT',
          availableQuestionCount: sourceQuestions.length,
          requestedQuestionCount: inst.questionCount,
        });
      }

      let snapshots: ReturnType<typeof createScheduledQuestionSnapshot>[];
      try {
        snapshots = sourceQuestions.map((question, position) =>
          createScheduledQuestionSnapshot(question, position));
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error('Invalid question scoring configuration'), {
          code: 'INVALID_EXAM_SCORING',
        });
      }
      const [{ unsupportedCount }] = await tx.select({
        unsupportedCount: sql<number>`COUNT(*)::int`,
      }).from(questions).where(and(
        eq(questions.bankId, inst.bankId!),
        eq(questions.isActive, true),
        eq(questions.reviewStatus, 'approved'),
        sql`NOT (
          ${questions.questionFormat} IN ('mcq_single', 'true_false')
          AND ${questions.maxPoints} > 0
          AND ${questions.negativeMarks} BETWEEN 0 AND ${questions.maxPoints}
          AND json_typeof(${questions.options}) = 'array'
          AND ${questions.correctAnswer} >= 0
          AND ${questions.correctAnswer} < json_array_length(${questions.options})
        )`,
      ));

      await tx.insert(examInstanceAttemptItems).values(snapshots.map((snapshot) => ({
        attemptId: created.id,
        ...snapshot,
      })));

      const [materialized] = await tx.update(examInstanceAttempts).set({
        totalQuestions: snapshots.length,
        totalPoints: snapshots.reduce((sum, snapshot) => sum + snapshot.maxPoints, 0),
        excludedQuestionCount: Number(unsupportedCount ?? 0),
      }).where(eq(examInstanceAttempts.id, created.id)).returning();
      if (invitationId) {
        await tx.update(examInstanceInvitations).set({
          status: 'started',
          lastStartedAt: now,
          updatedAt: now,
        }).where(eq(examInstanceInvitations.id, invitationId));
      }
      return materialized;
    });
    const accessExpiresAt = authoritativeAttemptDeadline(attempt, inst).getTime() + 60 * 60_000;
    const accessToken = createAttemptAccessToken(attempt.id, accessExpiresAt, attemptTokenSecret());
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(201).json({
      attemptId: attempt.id,
      accessToken,
      accessExpiresAt: new Date(accessExpiresAt).toISOString(),
      durationMin: inst.durationMin,
      startedAt: attempt.startedAt,
      proctorMode: attempt.proctorMode,
    });
  } catch (err: any) {
    if (err?.code === 'INSUFFICIENT_EXAM_SNAPSHOT') {
      return res.status(409).json({
        message: `This exam requires ${err.requestedQuestionCount} valid questions, but only ${err.availableQuestionCount} are currently available. Contact the exam owner.`,
        availableQuestionCount: err.availableQuestionCount,
        requestedQuestionCount: err.requestedQuestionCount,
      });
    }
    if (err?.code === 'INVALID_EXAM_SCORING') {
      return res.status(409).json({ message: 'A selected question has invalid marks or answer-key configuration. Contact the exam owner.' });
    }
    if (err?.code === 'ACTIVE_EXAM_ATTEMPT') {
      return res.status(409).json({
        message: 'An exam attempt is already in progress. Resume it from this browser instead of starting another.',
        attemptId: err.attemptId,
      });
    }
    if (err?.code === 'MAX_EXAM_ATTEMPTS') {
      return res.status(409).json({ message: `Maximum of ${err.maxAttempts} attempts reached` });
    }
    if (err?.code === 'EXAM_RETAKE_COOLDOWN') {
      return res.status(429).json({
        message: `Your next attempt is available at ${err.availableAt}`,
        availableAt: err.availableAt,
      });
    }
    if (err?.code === 'EXAM_INVITATION_INVALID') {
      return res.status(403).json({
        message: 'This invitation is no longer valid. Ask the institute to resend it.',
        code: 'EXAM_INVITATION_INVALID',
      });
    }
    logger.error('exam-share.start.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/exam-attempts/:id/heartbeat', async (req: Request, res: Response) => {
  try {
    const ctx = await loadAttemptOrUnauthorized(req, res);
    if (!ctx) return;
    const id = ctx.attempt.id;
    await db.update(examInstanceAttempts).set({ lastHeartbeatAt: new Date() }).where(eq(examInstanceAttempts.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: 'Failed' });
  }
});

const examEvidenceEventSchema = z.object({
  clientEventId: z.string().min(8).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  eventType: z.enum([
    'session_started',
    'session_resumed',
    'network_offline',
    'network_online',
    'visibility_hidden',
    'visibility_visible',
    'window_blur',
    'window_focus',
    'fullscreen_enter',
    'fullscreen_exit',
    'fullscreen_unavailable',
    'paste',
  ]),
  clientAt: z.string().datetime(),
  // Deliberately narrow: no clipboard text, answer text, keystrokes, media, or fingerprints.
  metadata: z.object({
    durationMs: z.number().int().min(0).max(86_400_000).optional(),
    reason: z.string().max(80).optional(),
  }).optional(),
});

// Durable answer autosave + idempotent event batching. Clients call this on answer
// changes, heartbeat, page lifecycle transitions and reconnection.
router.post('/exam-attempts/:id/sync', async (req: Request, res: Response) => {
  try {
    const ctx = await loadAttemptOrUnauthorized(req, res);
    if (!ctx) return;
    const { attempt, inst } = ctx;

    if (attempt.submittedAt) {
      return res.status(409).json({
        message: 'Attempt already submitted',
        submitted: true,
        result: storedScheduledAttemptResult(attempt),
      });
    }

    const parsed = z.object({
      answers: z.record(z.union([z.number().int().min(0), z.string().max(10_000), z.array(z.number().int().min(0)).max(50)])).optional(),
      events: z.array(examEvidenceEventSchema).max(50).default([]),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid exam sync payload', errors: parsed.error.flatten() });
    // Exam instances allow up to 500 questions, so a full autosave must support
    // the same bounded inventory instead of failing once question 101 is answered.
    if (parsed.data.answers && Object.keys(parsed.data.answers).length > 500) {
      return res.status(400).json({ message: 'Too many answers in one sync' });
    }

    if (parsed.data.events.some((event) => !canCollectEvidenceEvent(attempt.proctorMode, event.eventType))) {
      return res.status(400).json({ message: 'Browser-monitoring events are not enabled for this exam' });
    }

    let safeAnswers = parsed.data.answers;
    const attemptDeadline = authoritativeAttemptDeadline(attempt, inst);
    const deadlineExceeded = isScheduledDeadlineExceeded(attemptDeadline);
    const submissionClosesAt = new Date(attemptDeadline.getTime() + 15_000);
    // Browser/network retries after the grace window may still deliver evidence,
    // but they must never rewrite the answer snapshot that existed at deadline.
    if (deadlineExceeded) safeAnswers = undefined;
    if (safeAnswers) {
      const selected = await db.select({ questionId: examInstanceAttemptItems.questionId })
        .from(examInstanceAttemptItems)
        .where(eq(examInstanceAttemptItems.attemptId, attempt.id));
      if (selected.length === 0) return res.status(409).json({ message: 'Attempt question snapshot is unavailable. Contact support.' });
      const validIds = new Set(selected.map((row) => String(row.questionId)));
      const invalidId = Object.keys(safeAnswers).find((id) => !validIds.has(id));
      if (invalidId) return res.status(400).json({ message: 'Answer does not belong to this attempt' });
    }

    const now = new Date();
    const syncApplied = await db.transaction(async (tx) => {
      const update: Record<string, any> = { lastHeartbeatAt: now };
      if (safeAnswers) {
        update.answers = safeAnswers;
        update.lastAutosaveAt = now;
      }
      // A sync request that was already in flight when submit acquired the row
      // lock must not overwrite the immutable submitted answer snapshot.
      const updated = await tx.update(examInstanceAttempts).set(update).where(and(
        eq(examInstanceAttempts.id, attempt.id),
        isNull(examInstanceAttempts.submittedAt),
        // Re-check at write time so a request that waited on a row lock cannot
        // cross the grace boundary and persist late answer changes.
        // PostgreSQL NOW() is fixed at transaction start; clock_timestamp()
        // prevents a row-lock wait from carrying a stale pre-deadline time.
        sql`clock_timestamp() <= ${submissionClosesAt}`,
      )).returning({ id: examInstanceAttempts.id });
      if (updated.length === 0) return false;

      if (parsed.data.events.length) {
        await tx.insert(examProctorEvents).values(parsed.data.events.map((event) => {
          const clientAt = boundedClientTimestamp(event.clientAt, now);
          return {
            attemptId: attempt.id,
            clientEventId: event.clientEventId,
            eventType: event.eventType,
            clientAt,
            occurredAt: now,
            metadata: event.metadata ?? null,
          };
        })).onConflictDoNothing();
      }
      return true;
    });

    if (!syncApplied) {
      const [submittedAttempt] = await db.select().from(examInstanceAttempts)
        .where(eq(examInstanceAttempts.id, attempt.id));
      if (submittedAttempt && !submittedAttempt.submittedAt) {
        return res.status(409).json({
          message: 'The exam timer has ended. Late answer changes were not saved; submit will grade the last server-saved snapshot.',
          code: 'EXAM_TIME_EXPIRED',
          remainingSeconds: 0,
          deadlineExceeded: true,
          answerWriteAccepted: false,
        });
      }
      return res.status(409).json({
        message: 'Attempt already submitted',
        submitted: true,
        result: submittedAttempt ? storedScheduledAttemptResult(submittedAttempt) : undefined,
      });
    }

    if (deadlineExceeded && parsed.data.answers !== undefined) {
      return res.status(409).json({
        message: 'The exam timer has ended. Late answer changes were not saved; submit will grade the last server-saved snapshot.',
        code: 'EXAM_TIME_EXPIRED',
        remainingSeconds: 0,
        deadlineExceeded: true,
        answerWriteAccepted: false,
      });
    }

    res.json({
      ok: true,
      serverTime: now.toISOString(),
      savedAt: safeAnswers ? now.toISOString() : attempt.lastAutosaveAt,
      remainingSeconds: scheduledDeadlineRemainingSeconds(
        authoritativeAttemptDeadline(attempt, inst),
        now.getTime(),
      ),
      deadlineExceeded,
      answerWriteAccepted: parsed.data.answers === undefined || Boolean(safeAnswers),
    });
  } catch (err: any) {
    logger.error('exam-attempt.sync.error', { err });
    res.status(500).json({ message: 'Could not sync exam progress' });
  }
});

// Fetch questions for an in-progress attempt (sanitised — no correct answers)
router.get('/exam-attempts/:id/questions', async (req: Request, res: Response) => {
  try {
    const ctx = await loadAttemptOrUnauthorized(req, res);
    if (!ctx) return;
    const { attempt, inst } = ctx;
    const id = attempt.id;
    if (attempt.submittedAt) return res.status(400).json({ message: 'Already submitted' });
    const rows = await db.select().from(examInstanceAttemptItems)
      .where(eq(examInstanceAttemptItems.attemptId, id))
      .orderBy(examInstanceAttemptItems.position);

    if (rows.length === 0) return res.status(409).json({ message: 'Attempt question snapshot is unavailable. Contact support.' });

    res.json({
      attemptId: id,
      durationMin: inst.durationMin,
      startedAt: attempt.startedAt,
      serverTime: new Date().toISOString(),
      remainingSeconds: scheduledDeadlineRemainingSeconds(authoritativeAttemptDeadline(attempt, inst)),
      savedAnswers: (attempt.answers && typeof attempt.answers === 'object') ? attempt.answers : {},
      lastAutosaveAt: attempt.lastAutosaveAt,
      proctorMode: attempt.proctorMode,
      excludedUnsupportedQuestions: attempt.excludedQuestionCount ?? 0,
      questions: rows.map(toScheduledQuestionPayload),
    });
  } catch (err: any) {
    logger.error('exam-attempt.questions.error', { err });
    res.status(500).json({ message: 'Failed to load questions' });
  }
});

// Answer keys are a separate, fail-closed surface. Submission never includes
// them, and this endpoint evaluates the policy snapshot captured at start.
router.get('/exam-attempts/:id/review', async (req: Request, res: Response) => {
  try {
    const ctx = await loadAttemptOrUnauthorized(req, res);
    if (!ctx) return;
    const { attempt, inst } = ctx;
    const identityPredicate = attempt.userId
      ? sql`(user_id = ${attempt.userId} OR lower(email) = ${String(attempt.email || '').toLowerCase()})`
      : sql`lower(email) = ${String(attempt.email || '').toLowerCase()}`;
    const [attemptCountRow] = await execRows(sql`
      SELECT COUNT(*)::int AS count
      FROM exam_instance_attempts
      WHERE instance_id = ${attempt.instanceId} AND ${identityPredicate}
    `) as any as Array<{ count: number }>;
    const decision = scheduledReviewDecision({
      submitted: !!attempt.submittedAt,
      policy: attempt.reviewPolicySnapshot ?? inst.reviewPolicy ?? 'score_only',
      releaseAt: attempt.reviewReleaseAtSnapshot ?? inst.reviewReleaseAt ?? inst.endsAt,
      attemptNumber: Number(attemptCountRow?.count ?? 0),
      maxAttempts: attempt.maxAttemptsSnapshot ?? inst.maxAttempts,
      examClosed: inst.status === 'closed',
    });
    if (!decision.allowed) {
      return res.status(decision.reason === 'not_submitted' ? 409 : 403).json({
        message: decision.reason === 'score_only'
          ? 'This assessment is configured for score-only results.'
          : decision.reason === 'attempts_remaining'
            ? 'Answer review becomes available after the final permitted attempt.'
            : decision.reason === 'window_open'
              ? 'Answer review is not available until the assessment review window opens.'
              : 'Answer review is not available for this attempt.',
        review: decision,
      });
    }

    const rows = await db.select().from(examInstanceAttemptItems)
      .where(eq(examInstanceAttemptItems.attemptId, attempt.id))
      .orderBy(examInstanceAttemptItems.position);
    if (rows.length === 0) {
      return res.status(409).json({ message: 'Answer review is unavailable because this legacy attempt has no immutable question snapshot.' });
    }
    const submittedAnswers = (attempt.answers && typeof attempt.answers === 'object')
      ? attempt.answers as Record<string, number | string | number[]>
      : {};
    const items = rows.map((item) => {
      const submittedAnswer = submittedAnswers[String(item.questionId)];
      const answered = submittedAnswer !== undefined && submittedAnswer !== null && submittedAnswer !== '';
      const isCorrect = answered && typeof submittedAnswer === 'number' && submittedAnswer === item.correctAnswer;
      return {
        ...toScheduledQuestionPayload(item),
        submittedAnswer: answered ? submittedAnswer : null,
        correctAnswer: item.correctAnswer,
        correctOption: item.options[item.correctAnswer] ?? null,
        isCorrect,
        maxPoints: item.maxPoints,
        negativeMarks: item.negativeMarks,
        awardedPoints: !answered ? 0 : isCorrect ? item.maxPoints : -item.negativeMarks,
        explanation: item.explanation,
      };
    });

    audit({
      action: 'exam_attempt.answer_review',
      userId: attempt.userId ?? undefined,
      resourceType: 'exam_instance_attempt',
      resourceId: attempt.id,
      req,
    });
    res.json({
      attemptId: attempt.id,
      review: decision,
      result: storedScheduledAttemptResult(attempt),
      questions: items,
    });
  } catch (err: any) {
    logger.error('exam-attempt.review.error', { err });
    res.status(500).json({ message: 'Failed to load answer review' });
  }
});

router.post('/exam-attempts/:id/submit', async (req: Request, res: Response) => {
  try {
    const ctx = await loadAttemptOrUnauthorized(req, res);
    if (!ctx) return;
    const { attempt, inst } = ctx;
    const id = attempt.id;
    const schema = z.object({
      // answers map: { [questionId]: number (option index) | string (free text) }
      answers: z.record(z.union([z.number(), z.string(), z.array(z.number())])).default({}),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const result = await db.transaction(async (tx) => {
      // Serialise retries/concurrent final requests. Only the first request may
      // turn mutable autosave state into the authoritative submitted record.
      await tx.execute(sql`SELECT id FROM exam_instance_attempts WHERE id = ${id} FOR UPDATE`);
      const [lockedAttempt] = await tx.select().from(examInstanceAttempts)
        .where(eq(examInstanceAttempts.id, id));
      if (!lockedAttempt) throw Object.assign(new Error('Attempt disappeared'), { code: 'ATTEMPT_SNAPSHOT_MISSING' });
      if (lockedAttempt.submittedAt) {
        return { ok: true, alreadySubmitted: true, ...storedScheduledAttemptResult(lockedAttempt) };
      }

      // Server-side timer enforcement: the earlier of the frozen deadline and
      // its small network grace period wins.
      const timedOut = isScheduledDeadlineExceeded(authoritativeAttemptDeadline(lockedAttempt, inst));
      const submittedAnswers = scheduledSubmissionAnswers(
        (lockedAttempt.answers && typeof lockedAttempt.answers === 'object')
          ? lockedAttempt.answers as Record<string, number | string | number[]>
          : {},
        parsed.data.answers,
        timedOut,
      );
      const snapshotItems = await tx.select({
        questionId: examInstanceAttemptItems.questionId,
        correctAnswer: examInstanceAttemptItems.correctAnswer,
        maxPoints: examInstanceAttemptItems.maxPoints,
        negativeMarks: examInstanceAttemptItems.negativeMarks,
      }).from(examInstanceAttemptItems)
        .where(eq(examInstanceAttemptItems.attemptId, id))
        .orderBy(examInstanceAttemptItems.position);
      if (snapshotItems.length === 0) {
        throw Object.assign(new Error('Attempt question snapshot is unavailable'), { code: 'ATTEMPT_SNAPSHOT_MISSING' });
      }
      const validIds = new Set(snapshotItems.map((item) => String(item.questionId)));
      const invalidId = Object.keys(submittedAnswers).find((questionId) => !validIds.has(questionId));
      if (invalidId) {
        throw Object.assign(new Error('Answer does not belong to this attempt'), { code: 'INVALID_ATTEMPT_ANSWER' });
      }
      const scoring = scoreScheduledQuestionSnapshots(snapshotItems, submittedAnswers);
      const scorePct = scheduledScorePercentage(scoring.score, scoring.totalPoints);
      const passingScore = lockedAttempt.passingScoreSnapshot ?? inst.passingScore;
      const passed = scheduledAttemptPassed(scorePct, passingScore);
      const submittedAt = new Date();
      await tx.update(examInstanceAttempts).set({
        answers: submittedAnswers as any,
        score: scoring.score,
        totalPoints: scoring.totalPoints,
        totalQuestions: scoring.totalQuestions,
        passed,
        submittedAt,
        status: timedOut ? 'timed_out' : 'submitted',
      }).where(and(eq(examInstanceAttempts.id, id), isNull(examInstanceAttempts.submittedAt)));

      return {
        ok: true,
        passed,
        scorePct,
        score: scoring.score,
        totalPoints: scoring.totalPoints,
        totalQuestions: scoring.totalQuestions,
        correctAnswers: scoring.correctAnswers,
        answeredQuestions: scoring.answeredQuestions,
        timedOut,
      };
    });

    res.json(result);
  } catch (err: any) {
    if (err?.code === 'ATTEMPT_SNAPSHOT_MISSING') {
      return res.status(409).json({ message: 'Attempt question snapshot is unavailable. Contact support.' });
    }
    if (err?.code === 'INVALID_ATTEMPT_ANSWER') {
      return res.status(400).json({ message: 'Answer does not belong to this attempt' });
    }
    logger.error('exam-attempt.submit.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// ====================================================================
// CREATOR PAYOUTS
// ====================================================================
router.get('/creator/payouts', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const requests = await db.select().from(payoutRequests).where(and(eq(payoutRequests.ownerType, 'creator'), eq(payoutRequests.ownerId, req.creator!.id))).orderBy(desc(payoutRequests.createdAt));
    const splits = await db.select().from(splitPayouts).where(and(eq(splitPayouts.beneficiaryType, 'creator'), eq(splitPayouts.beneficiaryId, req.creator!.id))).orderBy(desc(splitPayouts.createdAt)).limit(50);

    const [{ earned }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS earned
      FROM split_payouts
      WHERE beneficiary_type='creator' AND beneficiary_id=${req.creator!.id} AND status='settled'
    `) as any as Array<{ earned: string }>;
    const [{ paid }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS paid
      FROM payout_requests
      WHERE owner_type='creator' AND owner_id=${req.creator!.id} AND status='paid'
    `) as any as Array<{ paid: string }>;
    const [{ committed }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS committed
      FROM payout_requests
      WHERE owner_type='creator' AND owner_id=${req.creator!.id}
        AND status IN ('pending', 'approved', 'paid')
    `) as any as Array<{ committed: string }>;

    res.json({
      availableINR: Math.max(0, parseFloat(earned) - parseFloat(committed)),
      lifetimePayoutsINR: parseFloat(paid),
      requests,
      recentSplits: splits,
      policy: {
        ownerSharePercent: Number(process.env.CREATOR_REVENUE_SHARE_PERCENT || 80),
        basis: 'Certificate activation fee, excluding shipping',
        settlement: 'Added after the payment provider confirms success; refunds and chargebacks may reverse availability',
      },
    });
  } catch (err: any) {
    logger.error('payouts.list.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/creator/payouts/request', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const schema = z.object({
      amount: z.coerce.number().min(500), // min payout ₹500
      upi: z.string().regex(/^[\w.-]+@[\w]+$/).optional(),
      bankAccount: z.string().min(6).max(20).optional(),
      ifsc: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)).optional(),
    }).refine((d) => d.upi || (d.bankAccount && d.ifsc), { message: 'Provide either UPI or bank account + IFSC' });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const created = await db.transaction(async (tx) => {
      // Serialise requests per creator so two simultaneous requests cannot
      // reserve the same settled balance.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${req.creator!.id})`);
      const result: any = await tx.execute(sql`
        SELECT
          COALESCE((
            SELECT SUM(amount) FROM split_payouts
            WHERE beneficiary_type='creator'
              AND beneficiary_id=${req.creator!.id}
              AND status='settled'
          ), 0)::numeric AS earned,
          COALESCE((
            SELECT SUM(amount) FROM payout_requests
            WHERE owner_type='creator'
              AND owner_id=${req.creator!.id}
              AND status IN ('pending', 'approved', 'paid')
          ), 0)::numeric AS committed
      `);
      const balance = Array.isArray(result) ? result[0] : result?.rows?.[0];
      const available = Math.max(0, Number(balance?.earned ?? 0) - Number(balance?.committed ?? 0));
      if (parsed.data.amount > available) {
        const error = new Error(`Only ₹${available.toLocaleString('en-IN')} is available for payout`);
        (error as any).code = 'INSUFFICIENT_PAYOUT_BALANCE';
        throw error;
      }

      const [row] = await tx.insert(payoutRequests).values({
        ownerType: 'creator',
        ownerId: req.creator!.id,
        amount: String(parsed.data.amount),
        upi: parsed.data.upi ?? null,
        bankAccount: parsed.data.bankAccount ?? null,
        ifsc: parsed.data.ifsc ?? null,
      }).returning();
      return row;
    });
    audit({ action: 'payout.request', userId: req.user!.userId, actorRole: 'creator', resourceType: 'payout', resourceId: created.id, metadata: { amount: parsed.data.amount }, req });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'INSUFFICIENT_PAYOUT_BALANCE') {
      return res.status(409).json({ message: err.message });
    }
    logger.error('payouts.request.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.get('/institute/payouts', authenticateToken, requireInstituteRole('admin'), async (req: InstituteRequest, res: Response) => {
  try {
    const instituteId = req.institute!.id;
    const requests = await db.select().from(payoutRequests)
      .where(and(eq(payoutRequests.ownerType, 'institute'), eq(payoutRequests.ownerId, instituteId)))
      .orderBy(desc(payoutRequests.createdAt));
    const splits = await db.select().from(splitPayouts)
      .where(and(eq(splitPayouts.beneficiaryType, 'institute'), eq(splitPayouts.beneficiaryId, instituteId)))
      .orderBy(desc(splitPayouts.createdAt)).limit(50);
    const [{ earned }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS earned FROM split_payouts
      WHERE beneficiary_type='institute' AND beneficiary_id=${instituteId} AND status='settled'
    `) as any as Array<{ earned: string }>;
    const [{ paid }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS paid FROM payout_requests
      WHERE owner_type='institute' AND owner_id=${instituteId} AND status='paid'
    `) as any as Array<{ paid: string }>;
    const [{ committed }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS committed FROM payout_requests
      WHERE owner_type='institute' AND owner_id=${instituteId} AND status IN ('pending','approved','paid')
    `) as any as Array<{ committed: string }>;
    res.json({
      availableINR: Math.max(0, Number(earned) - Number(committed)),
      lifetimePayoutsINR: Number(paid),
      requests,
      recentSplits: splits,
      policy: {
        ownerSharePercent: Number(process.env.INSTITUTE_REVENUE_SHARE_PERCENT || 80),
        basis: 'Certificate activation fee, excluding shipping',
        settlement: 'Added after the payment provider confirms success; refunds and chargebacks may reverse availability',
      },
    });
  } catch (err: any) {
    logger.error('institute.payouts.list.error', { err });
    res.status(500).json({ message: 'Failed to load institute payouts' });
  }
});

router.post('/institute/payouts/request', authenticateToken, requireInstituteRole('admin'), async (req: InstituteRequest, res: Response) => {
  try {
    const schema = z.object({
      amount: z.coerce.number().min(500),
      upi: z.string().regex(/^[\w.-]+@[\w]+$/).optional(),
      bankAccount: z.string().min(6).max(20).optional(),
      ifsc: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/)).optional(),
    }).refine((data) => data.upi || (data.bankAccount && data.ifsc), { message: 'Provide either UPI or bank account + IFSC' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Check payout details', errors: parsed.error.flatten() });
    const instituteId = req.institute!.id;
    const created = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${1_000_000_000 + instituteId})`);
      const result: any = await tx.execute(sql`
        SELECT
          COALESCE((SELECT SUM(amount) FROM split_payouts WHERE beneficiary_type='institute' AND beneficiary_id=${instituteId} AND status='settled'),0)::numeric AS earned,
          COALESCE((SELECT SUM(amount) FROM payout_requests WHERE owner_type='institute' AND owner_id=${instituteId} AND status IN ('pending','approved','paid')),0)::numeric AS committed
      `);
      const balance = Array.isArray(result) ? result[0] : result?.rows?.[0];
      const available = Math.max(0, Number(balance?.earned ?? 0) - Number(balance?.committed ?? 0));
      if (parsed.data.amount > available) {
        const error = new Error(`Only ₹${available.toLocaleString('en-IN')} is available for payout`);
        (error as any).code = 'INSUFFICIENT_PAYOUT_BALANCE';
        throw error;
      }
      const [row] = await tx.insert(payoutRequests).values({
        ownerType: 'institute',
        ownerId: instituteId,
        amount: String(parsed.data.amount),
        upi: parsed.data.upi ?? null,
        bankAccount: parsed.data.bankAccount ?? null,
        ifsc: parsed.data.ifsc ?? null,
      }).returning();
      return row;
    });
    audit({ action: 'institute.payout.request', userId: req.user!.userId, actorRole: 'institute', resourceType: 'payout', resourceId: created.id, metadata: { amount: parsed.data.amount }, req });
    res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'INSUFFICIENT_PAYOUT_BALANCE') return res.status(409).json({ message: err.message });
    logger.error('institute.payout.request.error', { err });
    res.status(500).json({ message: 'Payout request could not be created' });
  }
});

// ====================================================================
// CREATOR INTEGRATIONS — Nodukan + others (skeleton)
// ====================================================================
router.get('/creator/integrations', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const rows = await db.select({
      id: creatorIntegrations.id,
      provider: creatorIntegrations.provider,
      externalAccountId: creatorIntegrations.externalAccountId,
      isActive: creatorIntegrations.isActive,
      createdAt: creatorIntegrations.createdAt,
    }).from(creatorIntegrations).where(eq(creatorIntegrations.creatorId, req.creator!.id));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/creator/integrations/:provider/connect', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const provider = String(req.params.provider);
    if (!['nodukan', 'youtube', 'substack'].includes(provider)) return res.status(400).json({ message: 'Unknown provider' });

    if (provider === 'nodukan' && !process.env.NODUKAN_API_BASE) {
      return res.status(503).json({
        message: 'Nodukan integration not configured on server. Set NODUKAN_API_BASE + NODUKAN_API_KEY.',
        configured: false,
      });
    }

    const schema = z.object({ accessToken: z.string(), externalAccountId: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    await execRows(sql`
      INSERT INTO creator_integrations (creator_id, provider, access_token, external_account_id, is_active)
      VALUES (${req.creator!.id}, ${provider}, ${parsed.data.accessToken}, ${parsed.data.externalAccountId ?? null}, true)
      ON CONFLICT (creator_id, provider) DO UPDATE
        SET access_token = EXCLUDED.access_token,
            external_account_id = EXCLUDED.external_account_id,
            is_active = true
    `);
    audit({ action: 'integration.connect', userId: req.user!.userId, actorRole: 'creator', resourceType: 'integration', resourceId: provider, req });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('integration.connect.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

export default router;
