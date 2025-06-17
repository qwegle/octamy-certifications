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
      const { courseId, answers, timeSpent } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get course and questions
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      const questions = await storage.getQuestionsByCourse(courseId);
      if (!questions.length) {
        return res.status(404).json({ message: "No questions found for this course" });
      }

      // Calculate score
      let correctAnswers = 0;
      const totalQuestions = questions.length;

      questions.forEach((question, index) => {
        const userAnswer = answers[index];
        if (userAnswer === question.correctAnswer) {
          correctAnswers++;
        }
      });

      const score = Math.round((correctAnswers / totalQuestions) * 100);

      // Create exam attempt record
      const examAttempt = await storage.createExamAttempt({
        userId,
        courseId,
        answers,
        score,
        timeTaken: timeSpent || 0,
        userEmail: '',
        userName: '',
        totalQuestions,
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