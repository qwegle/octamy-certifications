/**
 * Feature routes — wires plans enforcement, signed uploads, exam instances,
 * payouts, course curriculum, and creator integrations into one mounted router.
 *
 * Mounted at /api by server/routes/index.ts.
 */
import { Router, type Response, type Request, type NextFunction } from 'express';
import { execRows } from '../lib/db-exec';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../db';
import {
  authenticateToken,
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
  examInstances,
  examInstanceAttempts,
  splitPayouts,
  payoutRequests,
  creatorIntegrations,
  cohortStudents,
  questions,
  creators,
  institutes,
} from '@shared/schema';
import { logger } from '../lib/logger';
import { audit } from '../lib/audit';

// ====================================================================
// EXAM ATTEMPT ACCESS CONTROL
// ----------------------------------------------------------------
// Attempts can be started two ways:
//   (A) by an authenticated learner -> attempt.userId is set
//   (B) anonymously via share link  -> attempt.userId is null
// To prevent IDOR on numeric attempt ids we issue a short-lived HMAC
// "attempt token" at start time. Subsequent heartbeat / questions /
// submit calls must present it (Authorization: Bearer <token> OR
// `?accessToken=` query OR X-Attempt-Token header). Authenticated owners
// can also call without the token if their userId matches.
// ====================================================================
function attemptTokenSecret() {
  return process.env.JWT_SECRET || 'dev-secret-please-set-jwt-secret';
}
function signAttemptToken(attemptId: number): string {
  const payload = String(attemptId);
  const sig = crypto.createHmac('sha256', attemptTokenSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyAttemptToken(token: string | undefined, attemptId: number): boolean {
  if (!token) return false;
  const expected = signAttemptToken(attemptId);
  if (token.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)); } catch { return false; }
}
function extractAttemptToken(req: Request): string | undefined {
  const hdr = (req.headers['x-attempt-token'] as string) || undefined;
  if (hdr) return hdr;
  const auth = req.headers.authorization;
  if (auth?.startsWith('AttemptToken ')) return auth.slice('AttemptToken '.length);
  if (typeof req.query.accessToken === 'string') return req.query.accessToken;
  return undefined;
}
async function loadAttemptOrUnauthorized(req: Request, res: Response): Promise<{ attempt: any; inst: any } | null> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ message: 'Bad attempt id' }); return null; }
  const [attempt] = await db.select().from(examInstanceAttempts).where(eq(examInstanceAttempts.id, id));
  if (!attempt) { res.status(404).json({ message: 'Attempt not found' }); return null; }

  // Ownership: either valid attempt token, OR authenticated user matches owner.
  const token = extractAttemptToken(req);
  let allowed = verifyAttemptToken(token, id);
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

const router = Router();

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
async function assertCreatorOwnsCourse(req: CreatorRequest, courseId: number) {
  const [c] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!c || c.ownerType !== 'creator' || c.ownerId !== req.creator!.id) return null;
  return c;
}

router.get('/courses/:id/curriculum', async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.id);
    const sections = await db.select().from(courseSections).where(eq(courseSections.courseId, courseId)).orderBy(courseSections.position);
    const allLessons = await db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(lessons.position);
    const grouped = sections.map((s) => ({
      ...s,
      lessons: allLessons.filter((l) => l.sectionId === s.id),
    }));
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
      contentUrl: z.string().url().optional().nullable(),
      contentText: z.string().optional().nullable(),
      durationSec: z.number().int().min(0).default(0),
      position: z.number().int().min(0).default(0),
      isPreview: z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
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
      contentUrl: z.string().url().nullable().optional(),
      contentText: z.string().nullable().optional(),
      durationSec: z.number().int().min(0).optional(),
      position: z.number().int().min(0).optional(),
      isPreview: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
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

router.post('/lessons/:id/progress', authenticateToken, async (req: any, res: Response) => {
  try {
    const lessonId = Number(req.params.id);
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });
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
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      password: z.string().min(4).max(60).optional(),
      ownerType: z.enum(['creator', 'institute', 'admin']),
      ownerId: z.number().int(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const d = parsed.data;

    // Ownership check — must be member of the institute or owner of the creator profile
    if (d.ownerType === 'institute') {
      const inst = await execRows(sql`
        SELECT 1 FROM institute_members
        WHERE institute_id = ${d.ownerId} AND user_id = ${req.user.userId}
          AND role IN ('owner','admin','teacher','staff')
        LIMIT 1
      `) as any as Array<{ id: number }>;
      if (!inst[0]) return res.status(403).json({ message: 'Not a member of this institute' });
    } else if (d.ownerType === 'creator') {
      const [c] = await db.select({ id: creators.id }).from(creators)
        .where(and(eq(creators.id, d.ownerId), eq(creators.userId, req.user.userId)));
      if (!c) return res.status(403).json({ message: 'Not your creator profile' });
    } else if (d.ownerType === 'admin' && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin only' });
    }

    const passwordHash = d.password ? await bcrypt.hash(d.password, 10) : null;
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
      ownerType: d.ownerType,
      ownerId: d.ownerId,
      durationMin: d.durationMin,
      passingScore: d.passingScore,
      maxAttempts: d.maxAttempts,
      startsAt: d.startsAt ? new Date(d.startsAt) : null,
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      passwordHash,
      shareCode: code,
      status: 'live',
      createdBy: req.user.userId,
    }).returning();
    audit({ action: 'exam_instance.create', userId: req.user.userId, resourceType: 'exam_instance', resourceId: created.id, req });
    res.status(201).json({ ...created, shareUrl: `${req.protocol}://${req.get('host')}/x/${code}` });
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
        WHERE i.id = ${ownerId} AND m.user_id = ${req.user.userId} AND m.role IN ('owner','admin','teacher','staff')
        LIMIT 1
      `) as any as Array<{ id: number }>;
      if (!inst[0]) return res.status(403).json({ message: 'Not your institute' });
    } else if (ownerType === 'creator') {
      const [c] = await db.select({ id: creators.id }).from(creators).where(and(eq(creators.id, ownerId), eq(creators.userId, req.user.userId)));
      if (!c) return res.status(403).json({ message: 'Not your creator profile' });
    }
    const rows = await db.select().from(examInstances)
      .where(and(eq(examInstances.ownerType, ownerType), eq(examInstances.ownerId, ownerId)))
      .orderBy(desc(examInstances.id))
      .limit(100);
    res.json(rows.map((r) => ({ ...r, shareUrl: `${req.protocol}://${req.get('host')}/x/${r.shareCode}` })));
  } catch (err: any) {
    logger.error('exam-instances.list.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// Helper: verify that the current user owns the given exam instance
async function ensureExamOwnership(userId: number, instanceId: number): Promise<{ ok: boolean; inst?: any; reason?: string }> {
  const [inst] = await db.select().from(examInstances).where(eq(examInstances.id, instanceId));
  if (!inst) return { ok: false, reason: 'Exam not found' };
  if (inst.ownerType === 'institute') {
    const rows = await execRows(sql`
      SELECT 1 FROM institute_members
      WHERE institute_id = ${inst.ownerId} AND user_id = ${userId}
        AND role IN ('owner','admin','teacher','staff')
      LIMIT 1
    `) as any[];
    if (!rows[0]) return { ok: false, reason: 'Not a member of this institute' };
  } else if (inst.ownerType === 'creator') {
    const [c] = await db.select({ id: creators.id }).from(creators).where(and(eq(creators.id, inst.ownerId), eq(creators.userId, userId)));
    if (!c) return { ok: false, reason: 'Not your exam' };
  }
  return { ok: true, inst };
}

router.patch('/exam-instances/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ownership = await ensureExamOwnership(req.user.userId, id);
    if (!ownership.ok) return res.status(ownership.reason === 'Exam not found' ? 404 : 403).json({ message: ownership.reason });

    const schema = z.object({
      title: z.string().min(3).max(160).optional(),
      bankId: z.number().int().nullable().optional(),
      durationMin: z.number().int().min(5).max(360).optional(),
      passingScore: z.number().int().min(10).max(100).optional(),
      maxAttempts: z.number().int().min(1).max(10).optional(),
      startsAt: z.string().datetime().nullable().optional(),
      endsAt: z.string().datetime().nullable().optional(),
      password: z.string().min(4).max(60).nullable().optional(),
      status: z.enum(['draft', 'live', 'closed']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const d = parsed.data;
    const update: any = { updatedAt: new Date() };
    if (d.title !== undefined) update.title = d.title;
    if (d.bankId !== undefined) update.bankId = d.bankId;
    if (d.durationMin !== undefined) update.durationMin = d.durationMin;
    if (d.passingScore !== undefined) update.passingScore = d.passingScore;
    if (d.maxAttempts !== undefined) update.maxAttempts = d.maxAttempts;
    if (d.startsAt !== undefined) update.startsAt = d.startsAt ? new Date(d.startsAt) : null;
    if (d.endsAt !== undefined) update.endsAt = d.endsAt ? new Date(d.endsAt) : null;
    if (d.status !== undefined) update.status = d.status;
    if (d.password !== undefined) update.passwordHash = d.password ? await bcrypt.hash(d.password, 10) : null;

    const [updated] = await db.update(examInstances).set(update).where(eq(examInstances.id, id)).returning();
    audit({ action: 'exam_instance.update', userId: req.user.userId, resourceType: 'exam_instance', resourceId: id, req });
    res.json({ ...updated, shareUrl: `${req.protocol}://${req.get('host')}/x/${updated.shareCode}` });
  } catch (err: any) {
    logger.error('exam-instance.update.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.delete('/exam-instances/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ownership = await ensureExamOwnership(req.user.userId, id);
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

router.get('/x/:code', async (req: Request, res: Response) => {
  try {
    const [inst] = await db.select().from(examInstances).where(eq(examInstances.shareCode, req.params.code));
    if (!inst || inst.status !== 'live') return res.status(404).json({ message: 'Exam not found or not live' });
    if (inst.endsAt && new Date(inst.endsAt) < new Date()) return res.status(410).json({ message: 'Exam window closed' });
    const requiresPassword = !!inst.passwordHash;
    res.json({
      id: inst.id,
      title: inst.title,
      durationMin: inst.durationMin,
      passingScore: inst.passingScore,
      requiresPassword,
      startsAt: inst.startsAt,
      endsAt: inst.endsAt,
    });
  } catch (err: any) {
    logger.error('exam-share.lookup.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.post('/x/:code/start', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ password: z.string().optional(), email: z.string().email().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const [inst] = await db.select().from(examInstances).where(eq(examInstances.shareCode, req.params.code));
    if (!inst || inst.status !== 'live') return res.status(404).json({ message: 'Exam not found' });
    if (inst.passwordHash) {
      if (!parsed.data.password) return res.status(401).json({ message: 'Password required' });
      const ok = await bcrypt.compare(parsed.data.password, inst.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Invalid password' });
    }
    if (inst.cohortId && parsed.data.email) {
      const [member] = await db.select().from(cohortStudents).where(and(eq(cohortStudents.cohortId, inst.cohortId), eq(cohortStudents.email, parsed.data.email)));
      if (!member) return res.status(403).json({ message: 'Email not in cohort' });
    }
    const userId = (req as any).user?.userId ?? null;
    const [attempt] = await db.insert(examInstanceAttempts).values({
      instanceId: inst.id,
      userId,
      email: parsed.data.email ?? null,
    }).returning();
    const accessToken = signAttemptToken(attempt.id);
    res.status(201).json({ attemptId: attempt.id, accessToken, durationMin: inst.durationMin, startedAt: attempt.startedAt });
  } catch (err: any) {
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

// Fetch questions for an in-progress attempt (sanitised — no correct answers)
router.get('/exam-attempts/:id/questions', async (req: Request, res: Response) => {
  try {
    const ctx = await loadAttemptOrUnauthorized(req, res);
    if (!ctx) return;
    const { attempt, inst } = ctx;
    const id = attempt.id;
    if (attempt.submittedAt) return res.status(400).json({ message: 'Already submitted' });
    if (!inst.bankId) return res.status(400).json({ message: 'Exam has no question bank attached. Contact the exam owner.' });

    const rows = await execRows(sql`
      SELECT id, question, options, question_type, question_format, image_url, code_language, time_limit_sec, max_points
      FROM questions
      WHERE bank_id = ${inst.bankId} AND is_active = true
      ORDER BY random()
      LIMIT 50
    `) as any as Array<{ id: number; question: string; options: string[]; question_type: string; question_format: string; image_url: string | null; code_language: string | null; time_limit_sec: number | null; max_points: number }>;

    if (rows.length === 0) return res.status(400).json({ message: 'Question bank is empty.' });

    res.json({
      attemptId: id,
      durationMin: inst.durationMin,
      questions: rows.map((r) => ({
        id: r.id,
        question: r.question,
        options: r.options,
        type: r.question_type,
        format: r.question_format,
        imageUrl: r.image_url,
        codeLanguage: r.code_language,
        timeLimitSec: r.time_limit_sec,
        maxPoints: r.max_points,
      })),
    });
  } catch (err: any) {
    logger.error('exam-attempt.questions.error', { err });
    res.status(500).json({ message: 'Failed to load questions' });
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
    if (attempt.submittedAt) return res.status(400).json({ message: 'Already submitted' });

    // Server-side timer enforcement: reject if past duration + 15s grace.
    const startedAt = attempt.startedAt instanceof Date ? attempt.startedAt : new Date(attempt.startedAt);
    const elapsedSec = (Date.now() - startedAt.getTime()) / 1000;
    const allowedSec = (inst.durationMin * 60) + 15;
    const timedOut = elapsedSec > allowedSec;

    // Server-side grading: pull correct answers for the questions the user answered
    const submittedAnswers = parsed.data.answers;
    const questionIds = Object.keys(submittedAnswers).map((k) => Number(k)).filter((n) => Number.isFinite(n));

    let score = 0;
    let totalQuestions = 0;

    if (inst.bankId) {
      // Pull correct answers for this bank — only score questions that belong to it (defend against tampering)
      const correctRows = questionIds.length
        ? await execRows(sql`
            SELECT id, correct_answer FROM questions
            WHERE bank_id = ${inst.bankId} AND id = ANY(${questionIds})
          `) as any as Array<{ id: number; correct_answer: number }>
        : [];
      // Also count the bank's total questions to compute denominator fairly
      const [{ c: bankTotal }] = await execRows(sql`
        SELECT COUNT(*)::int AS c FROM questions WHERE bank_id = ${inst.bankId} AND is_active = true
      `) as any as Array<{ c: number }>;
      totalQuestions = Math.min(bankTotal, 50);
      for (const row of correctRows) {
        const submitted = submittedAnswers[String(row.id)];
        if (typeof submitted === 'number' && submitted === row.correct_answer) score++;
      }
    } else {
      // Legacy/no-bank: accept client-reported only as a hard fallback (will be 0)
      totalQuestions = 1;
      score = 0;
    }

    const denom = Math.max(totalQuestions, 1);
    const scorePct = Math.round((score / denom) * 100);
    const passed = scorePct >= inst.passingScore;
    await db.update(examInstanceAttempts).set({
      answers: submittedAnswers as any,
      score,
      totalQuestions,
      passed,
      submittedAt: new Date(),
      status: timedOut ? 'timed_out' : 'submitted',
    }).where(eq(examInstanceAttempts.id, id));

    res.json({ ok: true, passed, scorePct, score, totalQuestions, timedOut });
  } catch (err: any) {
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

    const [{ available }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS available
      FROM split_payouts
      WHERE beneficiary_type='creator' AND beneficiary_id=${req.creator!.id} AND status='settled'
    `) as any as Array<{ available: string }>;
    const [{ paid }] = await execRows(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS paid
      FROM payout_requests
      WHERE owner_type='creator' AND owner_id=${req.creator!.id} AND status='paid'
    `) as any as Array<{ paid: string }>;

    res.json({
      availableINR: Math.max(0, parseFloat(available) - parseFloat(paid)),
      lifetimePayoutsINR: parseFloat(paid),
      requests,
      recentSplits: splits,
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
      ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional(),
    }).refine((d) => d.upi || (d.bankAccount && d.ifsc), { message: 'Provide either UPI or bank account + IFSC' });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const [created] = await db.insert(payoutRequests).values({
      ownerType: 'creator',
      ownerId: req.creator!.id,
      amount: String(parsed.data.amount),
      upi: parsed.data.upi ?? null,
      bankAccount: parsed.data.bankAccount ?? null,
      ifsc: parsed.data.ifsc ?? null,
    }).returning();
    audit({ action: 'payout.request', userId: req.user!.userId, actorRole: 'creator', resourceType: 'payout', resourceId: created.id, metadata: { amount: parsed.data.amount }, req });
    res.status(201).json(created);
  } catch (err: any) {
    logger.error('payouts.request.error', { err });
    res.status(500).json({ message: 'Failed' });
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
