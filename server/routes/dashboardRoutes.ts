/**
 * Dashboard routes — wires creator/institute/recruiter dashboards to real data.
 *
 * - Creator: course CRUD scoped to creator owner
 * - Institute: cohorts + students CRUD + CSV import
 * - Recruiter: saved searches CRUD
 * - Cross-cutting: subscriptions checkout (Cashfree one-off → updates plan column on webhook)
 *
 * Mounted at /api by server/routes/index.ts.
 */
import { Router, type Response } from 'express';
import { execRows } from '../lib/db-exec';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
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
  categories,
  certificates,
  examAttempts,
  payments,
  cohorts,
  cohortStudents,
  subscriptions,
  savedSearches,
  recruiters,
  creators,
  institutes,
  instituteMembers,
  audienceBands,
  courseAudienceBands,
  mediaAssets,
  users,
} from '@shared/schema';
import { storage } from '../storage';
import { createCashfreeOrder } from '../lib/cashfree';
import { z } from 'zod';
import crypto from 'node:crypto';
import { authenticateRecruiterToken } from './recruiterRoutes';
import { audit } from '../lib/audit';

const router = Router();

// ---------- helpers ----------
function makeSlug(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uniqueSlug(base: string, attempts = 5): Promise<string> {
  let candidate = base;
  for (let i = 0; i < attempts; i++) {
    const [hit] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, candidate));
    if (!hit) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now()}`;
}

async function resolveRecruiterByUser(email: string) {
  return storage.getRecruiterByEmail(email.trim().toLowerCase());
}

// =================================================================
// CREATOR — courses & stats
// =================================================================

router.get('/creator/courses', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(courses)
      .where(and(eq(courses.ownerType, 'creator'), eq(courses.ownerId, req.creator!.id)))
      .orderBy(desc(courses.createdAt));
    res.json(rows);
  } catch (err: any) {
    console.error('GET /creator/courses', err);
    res.status(500).json({ message: 'Failed to load courses' });
  }
});

const courseCreateSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(10_000),
  categoryId: z.coerce.number().int().positive('Select a category'),
  duration: z.coerce.number().int().min(5).max(600),
  passingScore: z.coerce.number().int().min(10).max(100).default(60),
  price: z.coerce.number().min(0).default(199),
  productType: z.enum(['assessment', 'video_course', 'ebook', 'bundle']).default('assessment'),
  contentPrice: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  level: z.enum(['novice', 'intermediate', 'advanced', 'expert']).default('novice'),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
  language: z.string().trim().min(2).max(20).default('en'),
  certificationMode: z.enum(['creator', 'institute', 'octamy_creator', 'octamy_institute']).optional(),
  defaultReviewPolicy: z.enum(['immediate', 'after_final_attempt', 'after_window', 'score_only']).default('after_final_attempt'),
  audienceBandIds: z.array(z.coerce.number().int().positive()).max(7).default([]),
  thumbnailUrl: z.string().trim().max(2000).refine(
    (value) => value.startsWith('/api/media/files/') || /^https?:\/\//i.test(value),
    'Thumbnail must be an Octamy media URL or an http(s) URL',
  ).nullable().optional(),
});

const courseUpdateSchema = courseCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one course field to update' },
);

function validationResponse(error: z.ZodError) {
  const flattened = error.flatten();
  const first = Object.values(flattened.fieldErrors).flat().find(Boolean);
  return { message: first || flattened.formErrors[0] || 'Check the highlighted fields', errors: flattened };
}

class CourseInputError extends Error {}

async function insertOwnedCourse(
  data: z.infer<typeof courseCreateSchema>,
  ownerType: 'creator' | 'institute',
  ownerId: number,
  ownerApproved: boolean,
) {
  const baseSlug = makeSlug(data.title) || 'course';
  const slug = await uniqueSlug(baseSlug);
  // An unapproved workspace may build safely, but cannot request public listing.
  // For approved workspaces, public/unlisted + inactive represents "submitted";
  // private + inactive represents a draft; active is controlled by an admin.
  const visibility = ownerApproved ? data.visibility : 'private';
  const allowedCertificationModes = ownerType === 'creator'
    ? new Set(['creator', 'octamy_creator'])
    : new Set(['institute', 'octamy_institute']);
  const requestedCertificationMode = data.certificationMode || ownerType;
  const certificationMode = allowedCertificationModes.has(requestedCertificationMode)
    ? requestedCertificationMode
    : ownerType;
  const reviewStatus = visibility === 'private' ? 'draft' : 'pending';

  const created = await db.transaction(async (tx) => {
    const audienceIds = Array.from(new Set(data.audienceBandIds));
    if (audienceIds.length > 0) {
      const validBands = await tx.select({ id: audienceBands.id }).from(audienceBands).where(and(
        inArray(audienceBands.id, audienceIds),
        eq(audienceBands.isActive, true),
      ));
      if (validBands.length !== audienceIds.length) {
        throw new CourseInputError('One or more selected audience bands are unavailable. Refresh and try again.');
      }
    }

    const [inserted] = await tx.insert(courses).values({
      title: data.title,
      description: data.description,
      slug,
      categoryId: data.categoryId,
      duration: data.duration,
      passingScore: data.passingScore,
      price: String(data.price),
      productType: data.productType,
      contentPrice: data.productType === 'assessment' ? null : String(data.contentPrice ?? 0),
      level: data.level,
      visibility,
      language: data.language,
      certificationMode,
      reviewStatus,
      defaultReviewPolicy: data.defaultReviewPolicy,
      subscriptionEligible: false,
      resellerEligible: false,
      thumbnailUrl: data.thumbnailUrl ?? null,
      ownerType,
      ownerId,
      isActive: false,
    }).returning();

    if (audienceIds.length > 0) {
      await tx.insert(courseAudienceBands).values(audienceIds.map((audienceBandId) => ({
        courseId: inserted.id,
        audienceBandId,
      })));
    }
    return inserted;
  });
  return {
    ...created,
    reviewState: visibility === 'private' ? 'draft' : 'submitted',
    submissionBlockedReason: !ownerApproved
      ? `${ownerType === 'creator' ? 'Creator' : 'Institute'} approval is required before submission`
      : certificationMode.startsWith('octamy_')
        ? 'Octamy certification is requested, not granted. The locked assessment and evidence policy require platform review before approval.'
        : null,
  };
}

router.post('/creator/courses', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const parsed = courseCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationResponse(parsed.error));
    const [category] = await db.select({ id: categories.id }).from(categories).where(and(
      eq(categories.id, parsed.data.categoryId),
      eq(categories.isActive, true),
    ));
    if (!category) return res.status(400).json({ message: 'The selected category no longer exists. Refresh and choose another category.' });
    const created = await insertOwnedCourse(
      parsed.data,
      'creator',
      req.creator!.id,
      req.creator!.status === 'approved',
    );
    res.status(201).json(created);
  } catch (err: any) {
    if (err instanceof CourseInputError) return res.status(400).json({ message: err.message });
    console.error('POST /creator/courses', err);
    res.status(500).json({ message: 'Failed to create course' });
  }
});

router.patch('/creator/courses/:id', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid course id' });
    const [existing] = await db.select().from(courses).where(eq(courses.id, id));
    if (!existing || existing.ownerType !== 'creator' || existing.ownerId !== req.creator!.id) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const parsed = courseUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationResponse(parsed.error));
    if (parsed.data.categoryId) {
      const [category] = await db.select({ id: categories.id }).from(categories).where(and(
        eq(categories.id, parsed.data.categoryId),
        eq(categories.isActive, true),
      ));
      if (!category) return res.status(400).json({ message: 'The selected category no longer exists. Refresh and choose another category.' });
    }
    if (parsed.data.certificationMode && !['creator', 'octamy_creator'].includes(parsed.data.certificationMode)) {
      return res.status(400).json({ message: 'Choose creator-issued or request Octamy + creator certification.' });
    }
    const { audienceBandIds, ...courseUpdates } = parsed.data;
    const updates: any = { ...courseUpdates };
    if (updates.price !== undefined) updates.price = String(updates.price);
    if (updates.contentPrice !== undefined) updates.contentPrice = updates.contentPrice == null ? null : String(updates.contentPrice);
    if (updates.productType === 'assessment') updates.contentPrice = null;
    // Pending creators can edit drafts, but cannot submit them for listing.
    if (req.creator!.status !== 'approved') updates.visibility = 'private';
    updates.reviewStatus = updates.visibility === 'private' || (updates.visibility === undefined && existing.visibility === 'private')
      ? 'draft'
      : 'pending';
    updates.isActive = false;
    const updated = await db.transaction(async (tx) => {
      if (audienceBandIds !== undefined) {
        const audienceIds = Array.from(new Set(audienceBandIds));
        if (audienceIds.length > 0) {
          const validBands = await tx.select({ id: audienceBands.id }).from(audienceBands).where(and(
            inArray(audienceBands.id, audienceIds),
            eq(audienceBands.isActive, true),
          ));
          if (validBands.length !== audienceIds.length) throw new CourseInputError('One or more selected audience bands are unavailable.');
        }
        await tx.delete(courseAudienceBands).where(eq(courseAudienceBands.courseId, id));
        if (audienceIds.length > 0) {
          await tx.insert(courseAudienceBands).values(audienceIds.map((audienceBandId) => ({ courseId: id, audienceBandId })));
        }
      }
      const [row] = await tx.update(courses).set(updates).where(eq(courses.id, id)).returning();
      return row;
    });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof CourseInputError) return res.status(400).json({ message: err.message });
    console.error('PATCH /creator/courses/:id', err);
    res.status(500).json({ message: 'Failed to update course' });
  }
});

router.delete('/creator/courses/:id', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(courses).where(eq(courses.id, id));
    if (!existing || existing.ownerType !== 'creator' || existing.ownerId !== req.creator!.id) {
      return res.status(404).json({ message: 'Course not found' });
    }
    // Soft-delete: deactivate. Hard-delete blocked if exam attempts exist.
    await db.update(courses).set({ isActive: false, visibility: 'private' }).where(eq(courses.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /creator/courses/:id', err);
    res.status(500).json({ message: 'Failed to delete course' });
  }
});

// =================================================================
// INSTITUTE — owned course drafts
// =================================================================

router.get('/institute/courses', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const rows = await db.select().from(courses)
      .where(and(eq(courses.ownerType, 'institute'), eq(courses.ownerId, req.institute!.id)))
      .orderBy(desc(courses.createdAt));
    res.json(rows);
  } catch (err) {
    console.error('GET /institute/courses', err);
    res.status(500).json({ message: 'Failed to load institute courses' });
  }
});

router.post('/institute/courses', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const parsed = courseCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationResponse(parsed.error));
    const [category] = await db.select({ id: categories.id }).from(categories).where(and(
      eq(categories.id, parsed.data.categoryId),
      eq(categories.isActive, true),
    ));
    if (!category) return res.status(400).json({ message: 'The selected category no longer exists. Refresh and choose another category.' });
    const [institute] = await db.select({ status: institutes.status }).from(institutes)
      .where(eq(institutes.id, req.institute!.id));
    if (!institute) return res.status(404).json({ message: 'Institute workspace not found' });
    const created = await insertOwnedCourse(
      parsed.data,
      'institute',
      req.institute!.id,
      institute.status === 'verified',
    );
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof CourseInputError) return res.status(400).json({ message: err.message });
    console.error('POST /institute/courses', err);
    res.status(500).json({ message: 'Failed to create institute course' });
  }
});

router.patch('/institute/courses/:id', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid course id' });
    const [existing] = await db.select().from(courses).where(and(
      eq(courses.id, id),
      eq(courses.ownerType, 'institute'),
      eq(courses.ownerId, req.institute!.id),
    ));
    if (!existing) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    const parsed = courseUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationResponse(parsed.error));
    if (parsed.data.categoryId) {
      const [category] = await db.select({ id: categories.id }).from(categories).where(and(
        eq(categories.id, parsed.data.categoryId),
        eq(categories.isActive, true),
      ));
      if (!category) return res.status(400).json({ message: 'The selected category no longer exists. Refresh and choose another category.' });
    }
    const [institute] = await db.select({ status: institutes.status }).from(institutes)
      .where(eq(institutes.id, req.institute!.id));
    if (parsed.data.certificationMode && !['institute', 'octamy_institute'].includes(parsed.data.certificationMode)) {
      return res.status(400).json({ message: 'Choose institute-issued or request Octamy + institute certification.' });
    }
    const { audienceBandIds, ...courseUpdates } = parsed.data;
    const updates: any = { ...courseUpdates };
    if (updates.price !== undefined) updates.price = String(updates.price);
    if (updates.contentPrice !== undefined) updates.contentPrice = updates.contentPrice == null ? null : String(updates.contentPrice);
    if (updates.productType === 'assessment') updates.contentPrice = null;
    if (institute?.status !== 'verified') updates.visibility = 'private';
    updates.reviewStatus = updates.visibility === 'private' || (updates.visibility === undefined && existing.visibility === 'private')
      ? 'draft'
      : 'pending';
    updates.isActive = false;
    const updated = await db.transaction(async (tx) => {
      if (audienceBandIds !== undefined) {
        const audienceIds = Array.from(new Set(audienceBandIds));
        if (audienceIds.length > 0) {
          const validBands = await tx.select({ id: audienceBands.id }).from(audienceBands).where(and(
            inArray(audienceBands.id, audienceIds),
            eq(audienceBands.isActive, true),
          ));
          if (validBands.length !== audienceIds.length) throw new CourseInputError('One or more selected audience bands are unavailable.');
        }
        await tx.delete(courseAudienceBands).where(eq(courseAudienceBands.courseId, id));
        if (audienceIds.length > 0) {
          await tx.insert(courseAudienceBands).values(audienceIds.map((audienceBandId) => ({ courseId: id, audienceBandId })));
        }
      }
      const [row] = await tx.update(courses).set(updates).where(and(
        eq(courses.id, id),
        eq(courses.ownerType, 'institute'),
        eq(courses.ownerId, req.institute!.id),
      )).returning();
      return row;
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof CourseInputError) return res.status(400).json({ message: err.message });
    console.error('PATCH /institute/courses/:id', err);
    res.status(500).json({ message: 'Failed to update institute course' });
  }
});

router.delete('/institute/courses/:id', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid course id' });
    const [existing] = await db.select().from(courses).where(and(
      eq(courses.id, id),
      eq(courses.ownerType, 'institute'),
      eq(courses.ownerId, req.institute!.id),
    ));
    if (!existing) return res.status(404).json({ message: 'Course not found in this institute workspace' });
    await db.update(courses).set({ isActive: false, visibility: 'private' }).where(and(
      eq(courses.id, id),
      eq(courses.ownerType, 'institute'),
      eq(courses.ownerId, req.institute!.id),
    ));
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /institute/courses/:id', err);
    res.status(500).json({ message: 'Failed to archive institute course' });
  }
});

const instituteBrandingSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).nullable().optional(),
  websiteUrl: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().url().max(500).refine((value) => /^https:\/\//i.test(value), 'Website must use HTTPS').nullable().optional(),
  ),
  contactEmail: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().email().max(320).nullable().optional(),
  ),
  logoUrl: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().trim().max(2000).nullable().optional(),
  ),
});

router.patch('/institute/profile', authenticateToken, requireInstituteRole('admin'), async (req: InstituteRequest, res: Response) => {
  try {
    const parsed = instituteBrandingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(validationResponse(parsed.error));

    if (parsed.data.logoUrl) {
      // Co-issuer logos are rendered into public credentials. Only an image
      // uploaded by the acting user may be attached; arbitrary remote URLs are
      // deliberately rejected to prevent spoofing and server-side fetches.
      const [ownedLogo] = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(
        eq(mediaAssets.userId, req.user!.userId),
        eq(mediaAssets.kind, 'image'),
        eq(mediaAssets.url, parsed.data.logoUrl),
      ));
      if (!ownedLogo) {
        return res.status(400).json({ message: 'Choose an image from your Octamy media library for the institute logo.' });
      }
    }

    const [updated] = await db.update(institutes).set({
      ...parsed.data,
      updatedAt: new Date(),
    }).where(eq(institutes.id, req.institute!.id)).returning();
    if (!updated) return res.status(404).json({ message: 'Institute workspace not found' });
    audit({ action: 'institute.profile.updated', userId: req.user!.userId, actorRole: req.institute!.memberRole, resourceType: 'institute', resourceId: updated.id, req });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /institute/profile', err);
    res.status(500).json({ message: 'Institute profile could not be saved' });
  }
});

router.get('/creator/stats', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const creatorId = req.creator!.id;
    const myCourseIds = (await db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.ownerType, 'creator'), eq(courses.ownerId, creatorId))))
      .map((r) => r.id);

    let attemptCount = 0;
    let certCount = 0;
    let revenuePaise = 0;

    if (myCourseIds.length > 0) {
      const [a] = await execRows(sql`SELECT COUNT(*)::int AS c FROM exam_attempts WHERE course_id = ANY(${myCourseIds})`);
      attemptCount = (a as any)?.c ?? 0;
      const [cer] = await execRows(sql`SELECT COUNT(*)::int AS c FROM certificates WHERE course_id = ANY(${myCourseIds}) AND is_paid = true`);
      certCount = (cer as any)?.c ?? 0;
      const [rev] = await execRows(sql`SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status='completed' AND course_id = ANY(${myCourseIds})`);
      revenuePaise = Math.round(parseFloat(((rev as any)?.s ?? '0').toString()) * 100);
    }

    res.json({
      coursesCount: myCourseIds.length,
      attempts: attemptCount,
      certificates: certCount,
      revenueINR: Math.round(revenuePaise / 100),
      plan: req.creator!.plan,
      status: req.creator!.status,
    });
  } catch (err: any) {
    console.error('GET /creator/stats', err);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

// Recent activity feed for the creator earnings tab.
router.get('/creator/earnings', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const creatorId = req.creator!.id;
    const myCourseIds = (await db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.ownerType, 'creator'), eq(courses.ownerId, creatorId))))
      .map((r) => r.id);

    if (myCourseIds.length === 0) {
      return res.json({ payments: [], attempts: [], totals: { revenueINR: 0, attempts: 0, certificates: 0 } });
    }

    const payments = await execRows(sql`
      SELECT p.id, p.amount, p.status, p.created_at, c.title AS course_title
      FROM payments p
      LEFT JOIN courses c ON c.id = p.course_id
      WHERE p.course_id = ANY(${myCourseIds}) AND p.status='completed'
      ORDER BY p.id DESC LIMIT 25
    `) as any as Array<{ id: number; amount: string; status: string; created_at: string; course_title: string }>;

    const attempts = await execRows(sql`
      SELECT a.id, a.score, a.passed, a.created_at, c.title AS course_title
      FROM exam_attempts a
      LEFT JOIN courses c ON c.id = a.course_id
      WHERE a.course_id = ANY(${myCourseIds})
      ORDER BY a.id DESC LIMIT 25
    `) as any as Array<{ id: number; score: number; passed: boolean; created_at: string; course_title: string }>;

    const [totals] = await execRows(sql`
      SELECT
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='completed' AND course_id = ANY(${myCourseIds}))::float AS revenue,
        (SELECT COUNT(*) FROM exam_attempts WHERE course_id = ANY(${myCourseIds}))::int AS attempts,
        (SELECT COUNT(*) FROM certificates WHERE is_paid=true AND course_id = ANY(${myCourseIds}))::int AS certs
    `) as any as Array<{ revenue: number; attempts: number; certs: number }>;

    res.json({
      payments,
      attempts,
      totals: {
        revenueINR: Math.round((totals?.revenue ?? 0)),
        attempts: totals?.attempts ?? 0,
        certificates: totals?.certs ?? 0,
      },
    });
  } catch (err: any) {
    console.error('GET /creator/earnings', err);
    res.status(500).json({ message: 'Failed to load earnings' });
  }
});

// =================================================================
// INSTITUTE — cohorts & students
// =================================================================

router.get('/institute/cohorts', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const rows = await db.select().from(cohorts).where(eq(cohorts.instituteId, req.institute!.id)).orderBy(desc(cohorts.createdAt));
    res.json(rows);
  } catch (err: any) {
    console.error('GET /institute/cohorts', err);
    res.status(500).json({ message: 'Failed to load cohorts' });
  }
});

router.post('/institute/cohorts', authenticateToken, requireInstituteRole('admin'), async (req: any, res: Response) => {
  try {
    const { name, code, description, startDate, endDate } = req.body;
    if (!name || String(name).trim().length < 2) return res.status(400).json({ message: 'Name required' });
    const [created] = await db.insert(cohorts).values({
      instituteId: req.institute.id,
      name: String(name).trim(),
      code: code ? String(code).trim() : null,
      description: description || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.user.userId,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    console.error('POST /institute/cohorts', err);
    res.status(500).json({ message: 'Failed to create cohort' });
  }
});

router.get('/institute/students', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const cohortId = req.query.cohortId ? Number(req.query.cohortId) : undefined;
    if (cohortId && !Number.isInteger(cohortId)) return res.status(400).json({ message: 'Invalid cohort id' });
    const rows = await execRows(sql`
      SELECT
        cs.id,
        cs.cohort_id AS "cohortId",
        cs.institute_id AS "instituteId",
        cs.email,
        cs.name,
        cs.roll_number AS "rollNumber",
        cs.user_id AS "userId",
        cs.status,
        cs.invited_at AS "invitedAt",
        cs.joined_at AS "joinedAt",
        cs.created_at AS "createdAt",
        COALESCE(u.profile_visibility, false) AS "learnerConsent",
        (u.id IS NOT NULL) AS "hasOctamyAccount",
        EXISTS (
          SELECT 1 FROM certificates cert
          WHERE cert.user_id = u.id
            AND cert.is_paid = true
            AND cert.is_active = true
            AND cert.expires_at > NOW()
        ) AS "hasActiveEvidence"
      FROM cohort_students cs
      LEFT JOIN users u ON u.id = cs.user_id OR lower(u.email) = lower(cs.email)
      WHERE cs.institute_id = ${req.institute!.id}
        AND (${cohortId ?? null}::int IS NULL OR cs.cohort_id = ${cohortId ?? null})
      ORDER BY cs.created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    console.error('GET /institute/students', err);
    res.status(500).json({ message: 'Failed to load students' });
  }
});

router.get('/institute/recruiter-sharing', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const [institute] = await db.select({
      enabled: institutes.recruiterDiscoveryEnabled,
      status: institutes.status,
    }).from(institutes).where(eq(institutes.id, req.institute!.id));
    if (!institute) return res.status(404).json({ message: 'Institute not found' });

    const [summary] = await execRows(sql`
      SELECT
        COUNT(*) FILTER (WHERE cs.status = 'active')::int AS "activeAffiliations",
        COUNT(*) FILTER (
          WHERE cs.status = 'active'
            AND u.profile_visibility = true
            AND EXISTS (
              SELECT 1 FROM certificates cert
              WHERE cert.user_id = u.id
                AND cert.is_paid = true AND cert.is_active = true AND cert.expires_at > NOW()
            )
        )::int AS "eligibleLearners"
      FROM cohort_students cs
      LEFT JOIN users u ON u.id = cs.user_id OR lower(u.email) = lower(cs.email)
      WHERE cs.institute_id = ${req.institute!.id}
    `) as any as Array<{ activeAffiliations: number; eligibleLearners: number }>;

    res.json({
      enabled: institute.enabled,
      instituteStatus: institute.status,
      activeAffiliations: summary?.activeAffiliations ?? 0,
      eligibleLearners: summary?.eligibleLearners ?? 0,
      requirements: {
        instituteOptIn: true,
        learnerOptIn: true,
        currentPaidEvidence: true,
      },
    });
  } catch (err: any) {
    console.error('GET /institute/recruiter-sharing', err);
    res.status(500).json({ message: 'Failed to load recruiter sharing controls' });
  }
});

router.patch('/institute/recruiter-sharing', authenticateToken, requireInstituteRole('admin'), async (req: InstituteRequest, res: Response) => {
  try {
    const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'enabled must be true or false' });

    const [updated] = await db.update(institutes)
      .set({ recruiterDiscoveryEnabled: parsed.data.enabled, updatedAt: new Date() })
      .where(eq(institutes.id, req.institute!.id))
      .returning({ enabled: institutes.recruiterDiscoveryEnabled, status: institutes.status });
    if (!updated) return res.status(404).json({ message: 'Institute not found' });

    void audit({
      action: 'institute.recruiter_discovery.updated',
      userId: req.user?.userId,
      actorRole: 'institute',
      resourceType: 'institute',
      resourceId: req.institute!.id,
      metadata: { enabled: parsed.data.enabled },
      req,
    });
    res.json({
      enabled: updated.enabled,
      instituteStatus: updated.status,
      message: parsed.data.enabled
        ? 'Institute sharing is enabled. Only learners who independently opt in and hold current paid evidence can appear.'
        : 'Institute-affiliated learners are excluded from recruiter discovery.',
    });
  } catch (err: any) {
    console.error('PATCH /institute/recruiter-sharing', err);
    res.status(500).json({ message: 'Failed to update recruiter sharing controls' });
  }
});

router.post('/institute/students', authenticateToken, requireInstituteRole('teacher'), async (req: any, res: Response) => {
  try {
    const { cohortId, email, name, rollNumber } = req.body;
    if (!cohortId || !email) return res.status(400).json({ message: 'cohortId and email required' });
    const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.id, Number(cohortId)), eq(cohorts.instituteId, req.institute.id)));
    if (!cohort) return res.status(404).json({ message: 'Cohort not found' });
    const [created] = await db.insert(cohortStudents).values({
      cohortId: cohort.id,
      instituteId: req.institute.id,
      email: String(email).toLowerCase().trim(),
      name: name || null,
      rollNumber: rollNumber || null,
    }).onConflictDoNothing({ target: [cohortStudents.cohortId, cohortStudents.email] }).returning();
    if (!created) return res.status(409).json({ message: 'Student already in cohort' });
    res.status(201).json(created);
  } catch (err: any) {
    console.error('POST /institute/students', err);
    res.status(500).json({ message: 'Failed to add student' });
  }
});

router.post('/institute/students/import', authenticateToken, requireInstituteRole('admin'), async (req: any, res: Response) => {
  try {
    const { cohortId, csv } = req.body;
    if (!cohortId || !csv) return res.status(400).json({ message: 'cohortId and csv required' });
    const [cohort] = await db.select().from(cohorts).where(and(eq(cohorts.id, Number(cohortId)), eq(cohorts.instituteId, req.institute.id)));
    if (!cohort) return res.status(404).json({ message: 'Cohort not found' });

    // Parse simple CSV: name,email,rollNumber (one per line; header row tolerated)
    const lines = String(csv).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let imported = 0;
    let skipped = 0;
    for (const line of lines) {
      const cols = line.split(',').map((c) => c.trim());
      if (!cols[0] || !cols[1]) { skipped++; continue; }
      const looksHeader = /email/i.test(cols[1]) && /name/i.test(cols[0]);
      if (looksHeader) continue;
      const name = cols[0];
      const email = cols[1].toLowerCase();
      const rollNumber = cols[2] || null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped++; continue; }
      const [row] = await db.insert(cohortStudents).values({
        cohortId: cohort.id,
        instituteId: req.institute.id,
        email,
        name,
        rollNumber,
      }).onConflictDoNothing({ target: [cohortStudents.cohortId, cohortStudents.email] }).returning();
      if (row) imported++; else skipped++;
    }
    res.json({ imported, skipped, total: lines.length });
  } catch (err: any) {
    console.error('POST /institute/students/import', err);
    res.status(500).json({ message: 'Import failed' });
  }
});

// The overview is the one institute surface available to operational staff.
// Mutation and drill-down routes below continue to require teacher/admin roles.
router.get('/institute/stats', authenticateToken, requireInstituteRole('staff'), async (req: InstituteRequest, res: Response) => {
  try {
    const [cohortRow] = await execRows(sql`SELECT COUNT(*)::int AS c FROM cohorts WHERE institute_id = ${req.institute!.id}`);
    const [studentRow] = await execRows(sql`SELECT COUNT(*)::int AS c FROM cohort_students WHERE institute_id = ${req.institute!.id}`);
    const [examRow] = await execRows(sql`SELECT COUNT(*)::int AS c FROM exam_instances WHERE owner_type='institute' AND owner_id = ${req.institute!.id} AND status='live'`);
    res.json({
      cohorts: (cohortRow as any)?.c ?? 0,
      students: (studentRow as any)?.c ?? 0,
      activeExams: (examRow as any)?.c ?? 0,
      plan: req.institute!.plan,
    });
  } catch (err: any) {
    console.error('GET /institute/stats', err);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

router.get('/institute/team', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const rows = await execRows(sql`
      SELECT m.id, m.role, m.status, m.invited_at, m.joined_at, u.id AS user_id, u.name, u.email
      FROM institute_members m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.institute_id = ${req.institute!.id}
      ORDER BY m.id ASC
    `) as any as Array<{ id: number; role: string; status: string; invited_at: string | null; joined_at: string | null; user_id: number | null; name: string | null; email: string | null }>;
    res.json(rows);
  } catch (err: any) {
    console.error('GET /institute/team', err);
    res.status(500).json({ message: 'Failed to load team' });
  }
});

router.post('/institute/team/invite', authenticateToken, requireInstituteRole('admin'), async (req: InstituteRequest, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'teacher', 'staff']).default('teacher'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    // If a user with that email already exists, attach them. Otherwise create
    // a placeholder member row keyed off invited email so we can re-link on signup.
    const email = parsed.data.email.toLowerCase();
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));
    const userId = existingUser?.id ?? null;

    if (userId) {
      const [existingMember] = await db.select().from(instituteMembers)
        .where(and(eq(instituteMembers.instituteId, req.institute!.id), eq(instituteMembers.userId, userId)));
      if (existingMember) return res.status(409).json({ message: 'Already a member' });
      const [created] = await db.insert(instituteMembers).values({
        instituteId: req.institute!.id,
        userId,
        role: parsed.data.role,
        status: 'invited',
        invitedBy: (req as any).user.userId,
        invitedAt: new Date(),
      }).returning();
      return res.status(201).json(created);
    }

    // No user yet: store a pending invite by raw SQL so we can keep the email.
    await execRows(sql`
      INSERT INTO institute_invites (institute_id, email, role, invited_by, created_at)
      VALUES (${req.institute!.id}, ${email}, ${parsed.data.role}, ${(req as any).user.userId}, NOW())
      ON CONFLICT DO NOTHING
    `);
    res.status(202).json({ message: 'Invite recorded; user will be linked when they sign up.', email });
  } catch (err: any) {
    console.error('POST /institute/team/invite', err);
    res.status(500).json({ message: 'Failed to invite' });
  }
});

router.delete('/institute/team/:memberId', authenticateToken, requireInstituteRole('admin'), async (req: InstituteRequest, res: Response) => {
  try {
    const memberId = Number(req.params.memberId);
    const [m] = await db.select().from(instituteMembers).where(and(eq(instituteMembers.id, memberId), eq(instituteMembers.instituteId, req.institute!.id)));
    if (!m) return res.status(404).json({ message: 'Member not found' });
    if (m.role === 'owner') return res.status(400).json({ message: 'Cannot remove owner' });
    await db.delete(instituteMembers).where(eq(instituteMembers.id, memberId));
    res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /institute/team', err);
    res.status(500).json({ message: 'Failed' });
  }
});

router.get('/institute/reports', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const id = req.institute!.id;
    const [cohorts] = await execRows(sql`SELECT COUNT(*)::int AS c FROM cohorts WHERE institute_id = ${id}`);
    const [students] = await execRows(sql`SELECT COUNT(*)::int AS c FROM cohort_students WHERE institute_id = ${id}`);
    const [attempts] = await execRows(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE a.submitted_at IS NOT NULL AND a.passed = true)::int AS passed,
             COUNT(*) FILTER (WHERE a.submitted_at IS NOT NULL)::int AS submitted
      FROM exam_instance_attempts a
      JOIN exam_instances i ON i.id = a.instance_id
      WHERE i.owner_type='institute' AND i.owner_id = ${id}
    `);
    const recent = await execRows(sql`
      SELECT a.id, a.instance_id, a.email, u.name, a.score, a.total_questions,
             CASE WHEN a.total_questions > 0 THEN ROUND((a.score::numeric / a.total_questions::numeric) * 100, 1) ELSE 0 END AS score_pct,
             a.passed, a.status, a.proctor_mode, a.started_at, a.submitted_at, i.title AS exam_title
      FROM exam_instance_attempts a
      JOIN exam_instances i ON i.id = a.instance_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE i.owner_type='institute' AND i.owner_id = ${id}
      ORDER BY a.id DESC LIMIT 25
    `) as any as Array<{ id: number; instance_id: number; email: string | null; name: string | null; score: number | null; total_questions: number | null; score_pct: number; passed: boolean | null; status: string; proctor_mode: string; started_at: string; submitted_at: string | null; exam_title: string }>;
    res.json({
      cohorts: (cohorts as any)?.c ?? 0,
      students: (students as any)?.c ?? 0,
      attempts: (attempts as any)?.total ?? 0,
      passed: (attempts as any)?.passed ?? 0,
      submitted: (attempts as any)?.submitted ?? 0,
      passRate: ((attempts as any)?.submitted ?? 0) > 0
        ? Math.round((((attempts as any).passed ?? 0) / ((attempts as any).submitted ?? 1)) * 100)
        : 0,
      recent,
    });
  } catch (err: any) {
    console.error('GET /institute/reports', err);
    res.status(500).json({ message: 'Failed to load reports' });
  }
});

// =================================================================
// RECRUITER — saved searches
// =================================================================

router.get('/recruiter/saved-searches', authenticateRecruiterToken, async (req: any, res: Response) => {
  try {
    const recruiterId = req.recruiter.recruiterId;
    const rows = await db.select().from(savedSearches).where(eq(savedSearches.recruiterId, recruiterId)).orderBy(desc(savedSearches.createdAt));
    res.json(rows);
  } catch (err: any) {
    console.error('GET /recruiter/saved-searches', err);
    res.status(500).json({ message: 'Failed to load saved searches' });
  }
});

router.post('/recruiter/saved-searches', authenticateRecruiterToken, async (req: any, res: Response) => {
  try {
    const recruiterId = req.recruiter.recruiterId;
    const { name, filters } = req.body;
    if (!name || !filters) return res.status(400).json({ message: 'name and filters required' });
    const [row] = await db.insert(savedSearches).values({
      recruiterId,
      name: String(name).trim().slice(0, 100),
      filters,
    }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    console.error('POST /recruiter/saved-searches', err);
    res.status(500).json({ message: 'Failed to save search' });
  }
});

router.delete('/recruiter/saved-searches/:id', authenticateRecruiterToken, async (req: any, res: Response) => {
  try {
    const recruiterId = req.recruiter.recruiterId;
    const id = Number(req.params.id);
    await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.recruiterId, recruiterId)));
    res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /recruiter/saved-searches/:id', err);
    res.status(500).json({ message: 'Failed to delete' });
  }
});

// =================================================================
// LEARNER — payments + in-progress exams (extends existing dashboard data)
// =================================================================

router.get('/user/payments', authenticateToken, async (req: any, res: Response) => {
  try {
    const rows = await db.select({
      id: payments.id,
      amount: payments.amount,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      gateway: payments.gateway,
      courseId: payments.courseId,
      certificateId: payments.certificateId,
      createdAt: payments.createdAt,
    }).from(payments).where(eq(payments.userId, req.user.userId)).orderBy(desc(payments.createdAt)).limit(50);
    res.json(rows);
  } catch (err: any) {
    console.error('GET /user/payments', err);
    res.status(500).json({ message: 'Failed to load payments' });
  }
});

router.get('/user/exam-history', authenticateToken, async (req: any, res: Response) => {
  try {
    const rows = await execRows(sql`
      SELECT ea.id, ea.course_id AS "courseId", ea.score, ea.total_questions AS "totalQuestions",
             ea.passed, ea.created_at AS "createdAt",
             c.title AS "courseTitle", c.slug AS "courseSlug", c.passing_score AS "passingScore",
             EXISTS (SELECT 1 FROM certificates ct WHERE ct.exam_attempt_id = ea.id AND ct.is_paid = true) AS "hasCertificate"
      FROM exam_attempts ea
      LEFT JOIN courses c ON c.id = ea.course_id
      WHERE ea.user_id = ${req.user.userId}
      ORDER BY ea.created_at DESC
      LIMIT 50
    `);
    res.json((rows as any).rows ?? rows);
  } catch (err: any) {
    console.error('GET /user/exam-history', err);
    res.status(500).json({ message: 'Failed to load exam history' });
  }
});

// =================================================================
// SUBSCRIPTIONS — checkout (creates Cashfree order tagged kind=subscription)
// =================================================================

const SUB_PLANS: Record<string, Record<string, { amount: number; cycle: 'monthly' | 'yearly' }>> = {
  learner: {
    // Internal plan key kept for backward compatibility; product copy is Practice Pass.
    all_access: { amount: 299, cycle: 'monthly' },
  },
  creator: {
    free:    { amount: 0,    cycle: 'monthly' },
    pro:     { amount: 499,  cycle: 'monthly' },
    premium: { amount: 1999, cycle: 'monthly' },
  },
  institute: {
    starter: { amount: 2999, cycle: 'monthly' },
    growth:  { amount: 9999, cycle: 'monthly' },
  },
};

router.post('/subscriptions/checkout', authenticateToken, async (req: any, res: Response) => {
  try {
    const { ownerType, plan, cycle = 'monthly' } = req.body || {};
    if (!ownerType || !plan) return res.status(400).json({ message: 'ownerType and plan required' });
    if (cycle !== 'monthly' && cycle !== 'yearly') return res.status(400).json({ message: 'Invalid billing cycle' });
    const planRow = SUB_PLANS[ownerType]?.[plan];
    if (!planRow) return res.status(400).json({ message: 'Unknown plan' });
    const chargeAmount = cycle === 'yearly' ? planRow.amount * 10 : planRow.amount;

    let ownerId: number | null = null;
    if (ownerType === 'learner') {
      ownerId = req.user.userId;
    } else if (ownerType === 'creator') {
      const c = await storage.getCreatorByUserId(req.user.userId);
      if (!c) return res.status(403).json({ message: 'Creator profile required' });
      ownerId = c.id;
    } else if (ownerType === 'institute') {
      const i = await (storage as any).getInstituteByUserId(req.user.userId);
      if (!i) return res.status(403).json({ message: 'Institute profile required' });
      if (!['owner', 'admin'].includes(i.memberRole)) return res.status(403).json({ message: 'Only owner/admin can change plan' });
      ownerId = i.id;
    } else if (ownerType === 'recruiter') {
      const rec = await resolveRecruiterByUser(req.user.email);
      if (!rec) return res.status(403).json({ message: 'Recruiter profile required' });
      ownerId = rec.id;
    }

    // Free plan = activate directly, no payment.
    if (planRow.amount === 0) {
      await activatePlan(ownerType, ownerId!, plan, null, cycle);
      return res.json({ ok: true, activated: true, free: true, plan });
    }

    const baseUrl = (process.env.APP_URL || process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const customer = await storage.getUser(req.user.userId);
    const orderId = `SUB_${crypto.randomUUID()}`;
    const order = await createCashfreeOrder({
      orderId,
      amount: chargeAmount.toFixed(2),
      customerId: `oct_user_${req.user.userId}`,
      customerEmail: req.user.email,
      customerName: customer?.name || req.user.email.split('@')[0],
      customerPhone: customer?.phone || '9999999999',
      returnUrl: `${baseUrl}/billing/return?ownerType=${ownerType}&plan=${plan}`,
      notifyUrl: `${baseUrl}/api/webhooks/cashfree`,
      notes: {
        kind: 'subscription',
        ownerType,
        ownerId: String(ownerId),
        userId: String(req.user.userId),
        plan,
        cycle,
      },
    });

    const [sub] = await db.insert(subscriptions).values({
      ownerType,
      ownerId: ownerId!,
      userId: req.user.userId,
      plan,
      status: 'pending',
      amount: String(chargeAmount),
      cycle,
      cashfreeOrderId: order.orderId,
    }).returning();

    res.json({
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      paymentLink: order.paymentLink,
      subscriptionId: sub.id,
      amount: chargeAmount,
    });
  } catch (err: any) {
    console.error('POST /subscriptions/checkout', err);
    res.status(500).json({ message: err?.message || 'Checkout failed' });
  }
});

// Used by the Cashfree webhook (server/routes.ts) to flip plan + renewal date.
export async function activatePlan(
  ownerType: 'learner' | 'creator' | 'institute' | 'recruiter',
  ownerId: number,
  plan: string,
  cashfreeOrderId: string | null,
  requestedCycle: 'monthly' | 'yearly' = 'monthly',
) {
  let cycle = requestedCycle;
  if (cashfreeOrderId) {
    const [subscription] = await db.select({ cycle: subscriptions.cycle })
      .from(subscriptions)
      .where(eq(subscriptions.cashfreeOrderId, cashfreeOrderId));
    if (subscription?.cycle === 'yearly') cycle = 'yearly';
  }
  const durationDays = cycle === 'yearly' ? 365 : 30;
  const renewsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  if (ownerType === 'learner') {
    // Learner plan state lives in the immutable subscription row; unlike
    // workspace plans it never mutates a user role/profile record.
  } else if (ownerType === 'creator') {
    await db.update(creators).set({ plan, planRenewsAt: renewsAt }).where(eq(creators.id, ownerId));
  } else if (ownerType === 'institute') {
    await db.update(institutes).set({ plan, planRenewsAt: renewsAt }).where(eq(institutes.id, ownerId));
  } else if (ownerType === 'recruiter') {
    await db.update(recruiters).set({ plan, planRenewsAt: renewsAt }).where(eq(recruiters.id, ownerId));
  }
  if (cashfreeOrderId) {
    await db.update(subscriptions).set({
      status: 'active',
      startsAt: new Date(),
      renewsAt,
    }).where(eq(subscriptions.cashfreeOrderId, cashfreeOrderId));
  }
}

router.get('/me/subscription', authenticateToken, async (req: any, res: Response) => {
  try {
    const [creatorRow] = await db.select().from(creators).where(eq(creators.userId, req.user.userId));
    const inst = await (storage as any).getInstituteByUserId(req.user.userId);
    const rec = await resolveRecruiterByUser(req.user.email);
    const [learner] = await db.select().from(subscriptions).where(and(
      eq(subscriptions.ownerType, 'learner'),
      eq(subscriptions.ownerId, req.user.userId),
      eq(subscriptions.status, 'active'),
      sql`(${subscriptions.renewsAt} IS NULL OR ${subscriptions.renewsAt} > NOW())`,
    )).orderBy(desc(subscriptions.createdAt)).limit(1);
    res.json({
      learner: learner ? { plan: learner.plan, renewsAt: learner.renewsAt, status: learner.status } : null,
      creator: creatorRow ? { plan: creatorRow.plan, renewsAt: creatorRow.planRenewsAt } : null,
      institute: inst ? { plan: inst.plan, renewsAt: inst.planRenewsAt, memberRole: inst.memberRole } : null,
      recruiter: rec ? { plan: rec.plan, renewsAt: rec.planRenewsAt, credits: rec.creditsBalance } : null,
    });
  } catch (err: any) {
    console.error('GET /me/subscription', err);
    res.status(500).json({ message: 'Failed' });
  }
});

// =================================================================
// ADMIN — audit log viewer
// =================================================================
router.get('/admin/audit-logs', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'Forbidden' });
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const action = req.query.action ? String(req.query.action) : null;

    const rows = action
      ? await execRows(sql`SELECT * FROM audit_logs WHERE action = ${action} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`)
      : await execRows(sql`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);
    const data = (rows as any).rows ?? rows;
    res.json({ logs: data, limit, offset });
  } catch (err: any) {
    console.error('GET /admin/audit-logs', err);
    res.status(500).json({ message: 'Failed to load audit logs' });
  }
});

export default router;
