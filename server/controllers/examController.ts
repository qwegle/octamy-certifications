import { Request, Response } from 'express';
import { storage } from '../storage';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export class ExamController {
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
