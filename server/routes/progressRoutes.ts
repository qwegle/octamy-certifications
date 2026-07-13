import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';

const router = Router();
const requireUser = authenticateToken as RequestHandler;

router.get('/progress', requireUser, async (req: any, res) => {
  const parsedCourseId = req.query.courseId === undefined
    ? undefined
    : Number(req.query.courseId);
  if (parsedCourseId !== undefined && (!Number.isInteger(parsedCourseId) || parsedCourseId <= 0)) {
    return res.status(400).json({ message: 'Invalid course ID' });
  }
  const progress = await storage.getUserCourseProgress(req.user.userId, parsedCourseId);
  res.json(progress);
});

router.get('/user/achievements', requireUser, async (req: any, res) => {
  const achievements = await storage.getUserAchievements(req.user.userId, true);
  res.json(achievements);
});

const checkSchema = z.object({ courseId: z.number().int().positive().optional() });
router.post('/achievements/check', requireUser, async (req: any, res) => {
  const parsed = checkSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid achievement context' });
  }
  const unlocked = await storage.checkAndUnlockAchievements(req.user.userId, parsed.data.courseId);
  if (unlocked.length === 0) return res.json([]);
  const unlockedIds = new Set(unlocked.map((item) => item.id));
  const withDetails = await storage.getUserAchievements(req.user.userId, true);
  res.json(withDetails.filter((item) => unlockedIds.has(item.id)));
});

export default router;
