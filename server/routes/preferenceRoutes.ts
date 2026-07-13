import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth';
import { storage } from '../storage';

const router = Router();

const notificationSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  courseRecommendations: z.boolean(),
  newCourses: z.boolean(),
  achievements: z.boolean(),
});

const updateSchema = z.object({
  preferredCategories: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  skillLevel: z.enum(['novice', 'beginner', 'intermediate', 'advanced', 'expert']).optional(),
  learningGoals: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  notificationSettings: notificationSchema.optional(),
}).strict();

const defaults = {
  preferredCategories: [] as string[],
  skillLevel: 'novice',
  learningGoals: [] as string[],
  notificationSettings: {
    email: true,
    push: true,
    frequency: 'weekly' as const,
    courseRecommendations: true,
    newCourses: true,
    achievements: true,
  },
};

router.get('/preferences', authenticateToken, async (req, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user!.userId;
    const preferences = await storage.getUserPreferences(userId);
    res.json(preferences || { id: 0, userId, ...defaults });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load preferences' });
  }
});

router.put('/preferences', authenticateToken, async (req, res: Response) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid preferences', errors: parsed.error.flatten() });

    const userId = (req as AuthenticatedRequest).user!.userId;
    const existing = await storage.getUserPreferences(userId);
    const merged = {
      preferredCategories: parsed.data.preferredCategories ?? existing?.preferredCategories ?? defaults.preferredCategories,
      skillLevel: parsed.data.skillLevel ?? existing?.skillLevel ?? defaults.skillLevel,
      learningGoals: parsed.data.learningGoals ?? existing?.learningGoals ?? defaults.learningGoals,
      notificationSettings: parsed.data.notificationSettings ?? existing?.notificationSettings ?? defaults.notificationSettings,
    };
    const saved = existing
      ? await storage.updateUserPreferences(userId, merged)
      : await storage.createUserPreferences({ userId, ...merged });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: 'Failed to save preferences' });
  }
});

export default router;
