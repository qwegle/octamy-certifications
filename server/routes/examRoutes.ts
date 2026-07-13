import { Router } from 'express';
import type { RequestHandler } from 'express';
import { ExamController } from '../controllers/examController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;
const allowAnonymous = optionalAuth as RequestHandler;

// Exam routes
router.post('/submit', allowAnonymous, ExamController.submitExam as RequestHandler);
router.get('/history', requireUser, ExamController.getUserExamHistory as RequestHandler);
router.get('/results/:id', requireUser, ExamController.getExamResults as RequestHandler);

export default router;
