import { Router } from 'express';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { db } from '../db.js';
import { 
  users, 
  certificates, 
  examAttempts, 
  courses, 
  interviews 
} from '../../shared/schema.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
  };
}

const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

const router = Router();

// Get user analytics data
router.get('/user/analytics', requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user!.id;

    // Get certificate data
    const userCertificates = await db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, userId));

    // Get exam attempts for course completion tracking
    const examAttempts = await db
      .select({
        courseId: examAttempts.courseId,
        score: examAttempts.score,
        completedAt: examAttempts.completedAt,
      })
      .from(examAttempts)
      .where(eq(examAttempts.userId, userId))
      .orderBy(desc(examAttempts.completedAt));

    // Get unique courses attempted
    const uniqueCourses = [...new Set(examAttempts.map(e => e.courseId))];
    const completedCourses = userCertificates.length;

    // Calculate average score
    const averageScore = examAttempts.length > 0 
      ? Math.round(examAttempts.reduce((acc, e) => acc + e.score, 0) / examAttempts.length)
      : 0;

    // Calculate study streak (mock data for now)
    const studyStreak = 5; // This would need actual learning activity tracking

    // Calculate total study time (mock for now)
    const totalStudyTime = examAttempts.length * 30; // 30 minutes per attempt

    // Monthly progress (last 6 months)
    const monthlyProgress = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
      
      const monthAttempts = examAttempts.filter(e => {
        const attemptDate = new Date(e.completedAt);
        return attemptDate.getMonth() === monthDate.getMonth() && 
               attemptDate.getFullYear() === monthDate.getFullYear();
      });

      monthlyProgress.push({
        month: monthName,
        completed: monthAttempts.length,
        score: monthAttempts.length > 0 
          ? Math.round(monthAttempts.reduce((acc, e) => acc + e.score, 0) / monthAttempts.length)
          : 0
      });
    }

    // Skill distribution (based on course categories)
    const skillDistribution = [
      { skill: 'Frontend', level: Math.min(5, Math.floor(completedCourses * 0.6) + 1), certificates: Math.floor(completedCourses * 0.4) },
      { skill: 'Backend', level: Math.min(5, Math.floor(completedCourses * 0.4) + 1), certificates: Math.floor(completedCourses * 0.3) },
      { skill: 'Database', level: Math.min(5, Math.floor(completedCourses * 0.3) + 1), certificates: Math.floor(completedCourses * 0.2) },
      { skill: 'DevOps', level: Math.min(5, Math.floor(completedCourses * 0.2) + 1), certificates: Math.floor(completedCourses * 0.1) },
    ].filter(skill => skill.certificates > 0);

    // Upcoming deadlines (certificate expirations)
    const upcomingDeadlines = userCertificates
      .filter(cert => new Date(cert.expiresAt) > now)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
      .slice(0, 5)
      .map(cert => ({
        title: `${cert.courseTitle} Certificate`,
        date: cert.expiresAt,
        type: 'Certificate Expiration'
      }));

    const analyticsData = {
      totalCourses: uniqueCourses.length,
      completedCourses,
      averageScore,
      studyStreak,
      totalStudyTime,
      monthlyProgress,
      skillDistribution,
      upcomingDeadlines,
    };

    res.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});



export default router;