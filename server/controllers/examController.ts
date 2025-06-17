import { Request, Response } from 'express';
import { storage } from '../storage';

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

      // Get correct answers from session mapping
      const correctAnswersMapping = (global as any).questionMappings?.[sessionId] || {};
      
      // Transform answers array to Record<string, number> format
      const answersRecord: Record<string, number> = {};
      if (Array.isArray(answers)) {
        answers.forEach((answer: any) => {
          if (answer.questionId && answer.selectedOption !== undefined) {
            answersRecord[answer.questionId.toString()] = answer.selectedOption;
          }
        });
      } else {
        Object.assign(answersRecord, answers);
      }

      // Calculate score using session-specific correct answers
      let correctAnswers = 0;
      const totalQuestions = Object.keys(answersRecord).length;
      
      for (const [questionId, userAnswer] of Object.entries(answersRecord)) {
        const correctAnswer = correctAnswersMapping[parseInt(questionId)];
        if (correctAnswer !== undefined && correctAnswer === userAnswer) {
          correctAnswers++;
        }
      }
      
      // Clean up session data
      if ((global as any).questionMappings?.[sessionId]) {
        delete (global as any).questionMappings[sessionId];
      }
      
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const passed = score >= 50;
      const mastered = score >= 90;
      
      // Anti-cheating validation
      const minTimePerQuestion = 2;
      const expectedMinTime = totalQuestions * minTimePerQuestion;
      if (finalTimeTaken < expectedMinTime) {
        return res.status(400).json({ 
          message: `Exam completed too quickly. Please spend at least ${minTimePerQuestion} seconds per question.` 
        });
      }

      // Create exam attempt with anti-cheating data
      const examAttempt = await storage.createExamAttempt({
        userId: userId || null,
        courseId,
        userEmail,
        userName,
        score,
        totalQuestions,
        answers: answersRecord,
        timeTaken: finalTimeTaken,
        passed,
        mastered,
        sessionId,
        ipAddress: req.ip || req.connection?.remoteAddress || '',
        userAgent: req.get('User-Agent') || '',
        tabSwitches: tabSwitches || 0,
        passed: score >= course.passingScore
      });

      // Update user progress
      await storage.updateCourseProgress(userId, courseId, {
        progressPercentage: 100,
        bestScore: score,
        timeSpent: timeSpent || 0,
        status: score >= course.passingScore ? 'completed' : 'failed',
        attemptCount: 1
      });

      res.json({
        examAttemptId: examAttempt.id,
        score,
        totalQuestions,
        correctAnswers,
        passed: score >= course.passingScore,
        passingScore: course.passingScore
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