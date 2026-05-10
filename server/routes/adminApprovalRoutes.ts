import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { creators, institutes, recruiters, users } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { audit } from '../lib/audit';
import { logger } from '../lib/logger';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'octamy-secret-key-change-in-production';

function authenticateAdmin(req: Request, res: Response, next: any) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin && decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

const StatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'verified', 'under_review']),
  reason: z.string().max(500).optional(),
});

// ===== Pending queue summary =====
router.get('/admin/approvals/summary', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const [creatorPending] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM creators WHERE status = 'pending'`) as any;
    const [institutePending] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM institutes WHERE status = 'pending'`) as any;
    const [recruiterPending] = await db.execute(sql`SELECT COUNT(*)::int AS c FROM recruiters WHERE kyc_status IN ('pending','under_review')`) as any;
    res.json({
      creators: creatorPending?.c ?? 0,
      institutes: institutePending?.c ?? 0,
      recruiters: recruiterPending?.c ?? 0,
    });
  } catch (err) {
    logger.error('admin.approvals.summary.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// ===== Creators =====
router.get('/admin/creators', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || '');
    const rows = await db.execute(sql`
      SELECT c.id, c.user_id, c.display_name, c.slug, c.bio, c.status, c.created_at,
             u.email, u.username
      FROM creators c
      LEFT JOIN users u ON u.id = c.user_id
      ${status ? sql`WHERE c.status = ${status}` : sql``}
      ORDER BY c.created_at DESC LIMIT 200
    `) as any;
    res.json(rows);
  } catch (err) {
    logger.error('admin.creators.list.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.patch('/admin/creators/:id/status', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });
    const parsed = StatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const [updated] = await db.update(creators).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(creators.id, id)).returning();
    if (!updated) return res.status(404).json({ message: 'Not found' });
    audit({ action: 'admin.creator.status', userId: (req as any).user.userId, resourceType: 'creator', resourceId: id, metadata: { status: parsed.data.status, reason: parsed.data.reason }, req });
    res.json(updated);
  } catch (err) {
    logger.error('admin.creator.status.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// ===== Institutes =====
router.get('/admin/institutes', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || '');
    const rows = await db.execute(sql`
      SELECT i.id, i.name, i.slug, i.contact_email, i.industry, i.size_range, i.status, i.plan, i.created_at
      FROM institutes i
      ${status ? sql`WHERE i.status = ${status}` : sql``}
      ORDER BY i.created_at DESC LIMIT 200
    `) as any;
    res.json(rows);
  } catch (err) {
    logger.error('admin.institutes.list.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.patch('/admin/institutes/:id/status', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });
    const parsed = StatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const [updated] = await db.update(institutes).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(institutes.id, id)).returning();
    if (!updated) return res.status(404).json({ message: 'Not found' });
    audit({ action: 'admin.institute.status', userId: (req as any).user.userId, resourceType: 'institute', resourceId: id, metadata: { status: parsed.data.status, reason: parsed.data.reason }, req });
    res.json(updated);
  } catch (err) {
    logger.error('admin.institute.status.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

// ===== Recruiters =====
router.get('/admin/recruiters', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const status = String(req.query.status || '');
    const rows = await db.execute(sql`
      SELECT id, full_name, email, company_name, designation, kyc_status, credits, created_at
      FROM recruiters
      ${status ? sql`WHERE kyc_status = ${status}` : sql``}
      ORDER BY created_at DESC LIMIT 200
    `) as any;
    res.json(rows);
  } catch (err) {
    logger.error('admin.recruiters.list.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

router.patch('/admin/recruiters/:id/kyc-status', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'Bad id' });
    const parsed = StatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const [updated] = await db.update(recruiters).set({ kycStatus: parsed.data.status as any, updatedAt: new Date() }).where(eq(recruiters.id, id)).returning();
    if (!updated) return res.status(404).json({ message: 'Not found' });
    audit({ action: 'admin.recruiter.kyc', userId: (req as any).user.userId, resourceType: 'recruiter', resourceId: id, metadata: { status: parsed.data.status, reason: parsed.data.reason }, req });
    res.json(updated);
  } catch (err) {
    logger.error('admin.recruiter.kyc.error', { err });
    res.status(500).json({ message: 'Failed' });
  }
});

export default router;
