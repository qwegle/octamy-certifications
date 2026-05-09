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
import { eq, and, desc, sql } from 'drizzle-orm';
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
} from '@shared/schema';
import { storage } from '../storage';
import { createCashfreeOrder } from '../lib/cashfree';
import { z } from 'zod';

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
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  categoryId: z.number().int().positive(),
  duration: z.number().int().min(5).max(600),
  passingScore: z.number().int().min(10).max(100).default(60),
  price: z.coerce.number().min(0).default(199),
  level: z.enum(['novice', 'intermediate', 'advanced', 'expert']).default('novice'),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
});

router.post('/creator/courses', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    if (req.creator!.status !== 'approved') {
      return res.status(403).json({ message: 'Your creator profile must be approved before publishing courses.' });
    }
    const parsed = courseCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
    const data = parsed.data;
    const baseSlug = makeSlug(data.title);
    const slug = await uniqueSlug(baseSlug);

    const [created] = await db.insert(courses).values({
      title: data.title,
      description: data.description,
      slug,
      categoryId: data.categoryId,
      duration: data.duration,
      passingScore: data.passingScore,
      price: String(data.price),
      level: data.level,
      visibility: data.visibility,
      ownerType: 'creator',
      ownerId: req.creator!.id,
      isActive: false, // requires admin approval before going live
    } as any).returning();
    res.status(201).json(created);
  } catch (err: any) {
    console.error('POST /creator/courses', err);
    res.status(500).json({ message: 'Failed to create course' });
  }
});

router.patch('/creator/courses/:id', authenticateToken, requireCreator, async (req: CreatorRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(courses).where(eq(courses.id, id));
    if (!existing || existing.ownerType !== 'creator' || existing.ownerId !== req.creator!.id) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const updates: any = {};
    const allowed = ['title', 'description', 'duration', 'passingScore', 'price', 'level', 'visibility', 'metaTitle', 'metaDescription'];
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
    const [updated] = await db.update(courses).set(updates).where(eq(courses.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
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
      const [a] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM exam_attempts WHERE course_id = ANY(${myCourseIds})`);
      attemptCount = (a as any)?.c ?? 0;
      const [cer] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM certificates WHERE course_id = ANY(${myCourseIds}) AND is_paid = true`);
      certCount = (cer as any)?.c ?? 0;
      const [rev] = await db.execute(sql`SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE status='completed' AND course_id = ANY(${myCourseIds})`);
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
    const where = cohortId
      ? and(eq(cohortStudents.instituteId, req.institute!.id), eq(cohortStudents.cohortId, cohortId))
      : eq(cohortStudents.instituteId, req.institute!.id);
    const rows = await db.select().from(cohortStudents).where(where).orderBy(desc(cohortStudents.createdAt));
    res.json(rows);
  } catch (err: any) {
    console.error('GET /institute/students', err);
    res.status(500).json({ message: 'Failed to load students' });
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

router.get('/institute/stats', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const [cohortRow] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM cohorts WHERE institute_id = ${req.institute!.id}`);
    const [studentRow] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM cohort_students WHERE institute_id = ${req.institute!.id}`);
    const [examRow] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM exam_instances WHERE owner_type='institute' AND owner_id = ${req.institute!.id} AND status='live'`);
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

router.get('/institute/reports', authenticateToken, requireInstituteRole('teacher'), async (req: InstituteRequest, res: Response) => {
  try {
    const id = req.institute!.id;
    const [cohorts] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM cohorts WHERE institute_id = ${id}`);
    const [students] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM cohort_students WHERE institute_id = ${id}`);
    const [attempts] = await db.execute(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE a.passed = true)::int AS passed,
             COUNT(*) FILTER (WHERE a.status = 'submitted')::int AS submitted
      FROM exam_instance_attempts a
      JOIN exam_instances i ON i.id = a.instance_id
      WHERE i.owner_type='institute' AND i.owner_id = ${id}
    `);
    const recent = await db.execute(sql`
      SELECT a.id, a.email, a.score, a.passed, a.submitted_at, i.title AS exam_title
      FROM exam_instance_attempts a
      JOIN exam_instances i ON i.id = a.instance_id
      WHERE i.owner_type='institute' AND i.owner_id = ${id}
      ORDER BY a.id DESC LIMIT 25
    `) as any as Array<{ id: number; email: string | null; score: number | null; passed: boolean | null; submitted_at: string | null; exam_title: string }>;
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
// RECRUITER — saved searches (uses generic auth — recruiter ID resolved by email)
// =================================================================

async function resolveRecruiterByUser(userEmail: string) {
  const [rec] = await db.select().from(recruiters).where(eq(recruiters.email, userEmail.toLowerCase()));
  return rec;
}

router.get('/recruiter/saved-searches', authenticateToken, async (req: any, res: Response) => {
  try {
    const rec = await resolveRecruiterByUser(req.user.email);
    if (!rec) return res.status(403).json({ message: 'Recruiter profile required' });
    const rows = await db.select().from(savedSearches).where(eq(savedSearches.recruiterId, rec.id)).orderBy(desc(savedSearches.createdAt));
    res.json(rows);
  } catch (err: any) {
    console.error('GET /recruiter/saved-searches', err);
    res.status(500).json({ message: 'Failed to load saved searches' });
  }
});

router.post('/recruiter/saved-searches', authenticateToken, async (req: any, res: Response) => {
  try {
    const rec = await resolveRecruiterByUser(req.user.email);
    if (!rec) return res.status(403).json({ message: 'Recruiter profile required' });
    const { name, filters } = req.body;
    if (!name || !filters) return res.status(400).json({ message: 'name and filters required' });
    const [row] = await db.insert(savedSearches).values({
      recruiterId: rec.id,
      name: String(name).trim().slice(0, 100),
      filters,
    }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    console.error('POST /recruiter/saved-searches', err);
    res.status(500).json({ message: 'Failed to save search' });
  }
});

router.delete('/recruiter/saved-searches/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const rec = await resolveRecruiterByUser(req.user.email);
    if (!rec) return res.status(403).json({ message: 'Recruiter profile required' });
    const id = Number(req.params.id);
    await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.recruiterId, rec.id)));
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
    const rows = await db.execute(sql`
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
  creator: {
    free:    { amount: 0,    cycle: 'monthly' },
    pro:     { amount: 999,  cycle: 'monthly' },
    premium: { amount: 2999, cycle: 'monthly' },
  },
  institute: {
    starter:    { amount: 0,     cycle: 'monthly' },
    growth:     { amount: 4999,  cycle: 'monthly' },
    enterprise: { amount: 19999, cycle: 'monthly' },
  },
  recruiter: {
    starter:    { amount: 0,     cycle: 'monthly' },
    growth:     { amount: 2999,  cycle: 'monthly' },
    enterprise: { amount: 9999,  cycle: 'monthly' },
  },
};

router.post('/subscriptions/checkout', authenticateToken, async (req: any, res: Response) => {
  try {
    const { ownerType, plan, cycle = 'monthly' } = req.body || {};
    if (!ownerType || !plan) return res.status(400).json({ message: 'ownerType and plan required' });
    const planRow = SUB_PLANS[ownerType]?.[plan];
    if (!planRow) return res.status(400).json({ message: 'Unknown plan' });

    let ownerId: number | null = null;
    if (ownerType === 'creator') {
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
      await activatePlan(ownerType, ownerId!, plan, null);
      return res.json({ ok: true, free: true, plan });
    }

    const baseUrl = process.env.PUBLIC_URL || `https://${req.get('host')}`;
    const order = await createCashfreeOrder({
      orderAmount: planRow.amount,
      customerEmail: req.user.email,
      customerName: req.user.email.split('@')[0],
      customerPhone: '0000000000',
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
      amount: String(planRow.amount),
      cycle,
      cashfreeOrderId: order.orderId,
    }).returning();

    res.json({
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      paymentLink: order.paymentLink,
      subscriptionId: sub.id,
      amount: planRow.amount,
    });
  } catch (err: any) {
    console.error('POST /subscriptions/checkout', err);
    res.status(500).json({ message: err?.message || 'Checkout failed' });
  }
});

// Used by the Cashfree webhook (server/routes.ts) to flip plan + renewal date.
export async function activatePlan(
  ownerType: 'creator' | 'institute' | 'recruiter',
  ownerId: number,
  plan: string,
  cashfreeOrderId: string | null,
) {
  const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30d
  if (ownerType === 'creator') {
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
    res.json({
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
      ? await db.execute(sql`SELECT * FROM audit_logs WHERE action = ${action} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`)
      : await db.execute(sql`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`);
    const data = (rows as any).rows ?? rows;
    res.json({ logs: data, limit, offset });
  } catch (err: any) {
    console.error('GET /admin/audit-logs', err);
    res.status(500).json({ message: 'Failed to load audit logs' });
  }
});

export default router;
