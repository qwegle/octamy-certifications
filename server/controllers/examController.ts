import { Request, Response } from 'express';
import { storage } from '../storage';
import { loadQuestionMapping, deleteQuestionMapping } from '../utils/examState';
import { normalizeExamAnswers, scoreExam } from '../utils/examScoring';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export class ExamController {
  static async submitExam(req: AuthenticatedRequest, res: Response) {
    try {
      const { courseId, answers, timeSpent, timeTaken, userEmail, userName, sessionId, tabSwitches } = req.body;
      const userId = req.user?.userId; // Optional for anonymous users
      const finalTimeTaken = timeTaken || timeSpent || 60;

      // Get correct answers from persisted session mapping
      const numericCourseId = Number(courseId);
      if (!sessionId || !Number.isInteger(numericCourseId) || numericCourseId <= 0) {
        return res.status(400).json({ message: "Valid course and exam session are required" });
      }
      const correctAnswersMapping = (await loadQuestionMapping(sessionId, numericCourseId)) || {};
      
      const answersRecord = normalizeExamAnswers(answers);
      const { correctAnswers, totalQuestions, score } = scoreExam(
        correctAnswersMapping,
        answersRecord,
      );
      
      // Clean up persisted session mapping
      await deleteQuestionMapping(sessionId).catch(() => {});
      
      const passed = score >= 50;
      const mastered = score >= 90;
      
      // Anti-cheating validation
      const minTimePerQuestion = 1;
      const expectedMinTime = totalQuestions * minTimePerQuestion;
      if (finalTimeTaken < expectedMinTime) {
        return res.status(400).json({ 
          message: `Exam completed too quickly. Please spend at least ${minTimePerQuestion} seconds per question.` 
        });
      }

      // Create exam attempt with anti-cheating data
      const examAttempt = await storage.createExamAttempt({
        userId: userId || null,
        courseId: numericCourseId,
        userEmail: userEmail || 'anonymous@example.com',
        userName: userName || 'Anonymous User',
        score: score,
        totalQuestions: totalQuestions,
        answers: answersRecord,
        timeTaken: finalTimeTaken,
        passed: passed,
        mastered: mastered,
        sessionId: sessionId || null,
        ipAddress: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('User-Agent') || null,
        tabSwitches: tabSwitches || 0,
      });

      // Update user progress (only for authenticated users)
      if (userId) {
        await storage.updateCourseProgress(userId, courseId, {
          progressPercentage: 100,
          bestScore: score,
          timeSpent: finalTimeTaken,
          status: passed ? 'completed' : 'failed',
          attemptCount: 1
        });
      }

      res.json({
        examAttemptId: examAttempt.id,
        score,
        totalQuestions,
        correctAnswers,
        passed,
        passingScore: 50 // Default passing score
      });
    } catch (error) {
      console.error("Submit exam error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getExamResults(req: AuthenticatedRequest, res: Response) {
    try {
      const examAttemptId = parseInt(req.params.id);
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (isNaN(examAttemptId)) {
        return res.status(400).json({ message: "Invalid exam attempt ID" });
      }

      const examAttempt = await storage.getExamAttempt(examAttemptId);
      if (!examAttempt || examAttempt.userId !== userId) {
        return res.status(404).json({ message: "Exam attempt not found" });
      }

      res.json(examAttempt);
    } catch (error) {
      console.error("Get exam results error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getUserExamHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const examAttempts = await storage.getUserExamAttempts(userId, courseId);
      res.json(examAttempts);
    } catch (error) {
      console.error("Get exam history error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}
