import { Request, Response } from 'express';
import { storage } from '../storage';
import { 
  insertLearningPathSchema, 
  insertUserLearningPathSchema,
  insertSkillAssessmentSchema,
  type LearningPath,
  type Course,
  type UserActivity,
  type UserCourseProgress
} from '@shared/schema';
import { z } from 'zod';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export class LearningPathController {
  // Get all available learning paths
  static async getLearningPaths(req: Request, res: Response) {
    try {
      const { categoryId, difficulty } = req.query;
      
      const learningPaths = await storage.getLearningPaths({
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        difficulty: difficulty as string,
      });
      
      res.json(learningPaths);
    } catch (error) {
      console.error('Error fetching learning paths:', error);
      res.status(500).json({ message: 'Failed to fetch learning paths' });
    }
  }

  // Get user's enrolled learning paths
  static async getUserLearningPaths(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const userPaths = await storage.getUserLearningPaths(userId);
      res.json(userPaths);
    } catch (error) {
      console.error('Error fetching user learning paths:', error);
      res.status(500).json({ message: 'Failed to fetch user learning paths' });
    }
  }

  // Enroll user in a learning path
  static async enrollInLearningPath(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const { learningPathId } = req.body;
      const data = insertUserLearningPathSchema.parse({
        userId,
        learningPathId,
        status: 'not_started',
        currentCourseIndex: 0,
        progressPercentage: 0,
        startedAt: new Date(),
      });

      const enrollment = await storage.enrollInLearningPath(data);
      res.json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      console.error('Error enrolling in learning path:', error);
      res.status(500).json({ message: 'Failed to enroll in learning path' });
    }
  }

  // Generate personalized recommendations
  static async generatePersonalizedRecommendations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Get user's learning history and preferences
      const userActivity = await storage.getUserActivity(userId);
      const userProgress = await storage.getUserCourseProgress(userId);
      const userPreferences = await storage.getUserPreferences(userId);
      
      // Generate recommendations based on multiple factors
      const recommendations = await LearningPathController.calculateRecommendations(
        userId, 
        userActivity, 
        userProgress, 
        userPreferences
      );

      // Store recommendations for tracking
      for (const rec of recommendations) {
        await storage.createCourseRecommendation({
          userId,
          courseId: rec.courseId,
          reason: rec.reason,
          score: rec.score.toString(),
          metadata: rec.metadata,
        });
      }

      res.json(recommendations);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      res.status(500).json({ message: 'Failed to generate recommendations' });
    }
  }

  // Skill assessment endpoint
  static async createSkillAssessment(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const data = insertSkillAssessmentSchema.parse({
        ...req.body,
        userId,
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      const assessment = await storage.createSkillAssessment(data);
      res.json(assessment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid data', errors: error.errors });
      }
      console.error('Error creating skill assessment:', error);
      res.status(500).json({ message: 'Failed to create skill assessment' });
    }
  }

  // Get learning path recommendations for a user
  static async getLearningPathRecommendations(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      const userProgress = await storage.getUserCourseProgress(userId);
      const userPreferences = await storage.getUserPreferences(userId);
      const allPaths = await storage.getLearningPaths({});

      // Calculate path recommendations
      const pathRecommendations = await LearningPathController.calculatePathRecommendations(
        userId,
        userProgress,
        userPreferences,
        allPaths
      );

      res.json(pathRecommendations);
    } catch (error) {
      console.error('Error getting path recommendations:', error);
      res.status(500).json({ message: 'Failed to get path recommendations' });
    }
  }

  // Private method to calculate course recommendations
  private static async calculateRecommendations(
    userId: number,
    userActivity: UserActivity[],
    userProgress: UserCourseProgress[],
    userPreferences: any
  ) {
    const recommendations = [];
    const completedCourseIds = userProgress
      .filter(p => p.status === 'completed')
      .map(p => p.courseId);

    // Get all available courses
    const allCourses = await storage.getCourses();
    
    // Filter out completed courses
    const availableCourses = allCourses.filter(course => 
      !completedCourseIds.includes(course.id)
    );

    for (const course of availableCourses) {
      let score = 0;
      let reason = '';
      const metadata: any = {};

      // Category preference matching
      if (userPreferences?.preferredCategories?.includes(course.categoryId.toString())) {
        score += 0.4;
        reason = 'based_on_category';
        metadata.categoryMatch = true;
      }

      // Skill level matching
      const userSkillLevel = userPreferences?.skillLevel || 'novice';
      if (course.level === userSkillLevel) {
        score += 0.3;
        metadata.skillLevelMatch = true;
      }

      // Progressive difficulty (suggest slightly harder courses)
      if (this.isProgressiveDifficulty(course, userProgress)) {
        score += 0.2;
        reason = 'skill_progression';
      }

      // Popular courses boost
      const popularityScore = await this.calculatePopularityScore(course.id);
      score += popularityScore * 0.1;
      metadata.popularityScore = popularityScore;

      if (score > 0.2) { // Only recommend courses with decent score
        recommendations.push({
          courseId: course.id,
          course,
          reason,
          score: Math.min(score, 1.0),
          metadata: {
            ...metadata,
            completedCourseIds,
          }
        });
      }
    }

    // Sort by score and return top 10
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  // Calculate learning path recommendations
  private static async calculatePathRecommendations(
    userId: number,
    userProgress: UserCourseProgress[],
    userPreferences: any,
    allPaths: LearningPath[]
  ) {
    const recommendations = [];
    const completedCourseIds = userProgress
      .filter(p => p.status === 'completed')
      .map(p => p.courseId);

    for (const path of allPaths) {
      let score = 0;
      const metadata: any = {};

      // Check if user has completed prerequisite courses
      const hasPrerequisites = this.checkPrerequisites(path, completedCourseIds);
      if (!hasPrerequisites) continue;

      // Category preference matching
      if (userPreferences?.preferredCategories?.includes(path.categoryId.toString())) {
        score += 0.5;
        metadata.categoryMatch = true;
      }

      // Skill level matching
      const userSkillLevel = userPreferences?.skillLevel || 'novice';
      if (path.difficulty === userSkillLevel || 
          (userSkillLevel === 'novice' && path.difficulty === 'beginner')) {
        score += 0.3;
        metadata.skillLevelMatch = true;
      }

      // Path completion potential
      const completionPotential = this.calculateCompletionPotential(path, completedCourseIds);
      score += completionPotential * 0.2;
      metadata.completionPotential = completionPotential;

      if (score > 0.3) {
        recommendations.push({
          learningPath: path,
          score: Math.min(score, 1.0),
          metadata,
          estimatedTimeToComplete: this.estimateTimeToComplete(path, userProgress)
        });
      }
    }

    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  // Helper methods
  private static isProgressiveDifficulty(course: Course, userProgress: UserCourseProgress[]): boolean {
    const avgScore = userProgress.length > 0 
      ? userProgress.reduce((sum, p) => sum + p.bestScore, 0) / userProgress.length 
      : 0;
    
    // Suggest harder courses if user is performing well
    return avgScore > 70 && course.level !== 'novice';
  }

  private static async calculatePopularityScore(courseId: number): Promise<number> {
    // Popularity data is not persisted yet. A deterministic neutral score keeps
    // recommendations stable instead of reordering them randomly on every call.
    return 0;
  }

  private static checkPrerequisites(path: LearningPath, completedCourseIds: number[]): boolean {
    if (!path.prerequisites?.length) return true;

    return path.prerequisites.every((reqId) =>
      completedCourseIds.includes(reqId)
    );
  }

  private static calculateCompletionPotential(path: LearningPath, completedCourseIds: number[]): number {
    if (!path.courseIds.length) return 0;

    const completedInPath = path.courseIds.filter((courseId) =>
      completedCourseIds.includes(courseId)
    ).length;

    return completedInPath / path.courseIds.length;
  }

  private static estimateTimeToComplete(path: LearningPath, userProgress: UserCourseProgress[]): number {
    // Base estimate from path duration
    let baseTime = path.estimatedDuration;
    
    // Adjust based on user's average performance
    const avgPerformance = userProgress.length > 0 
      ? userProgress.reduce((sum, p) => sum + (p.bestScore / 100), 0) / userProgress.length 
      : 0.7;
    
    // Better performers might complete faster
    return Math.round(baseTime / Math.max(avgPerformance, 0.5));
  }
}
