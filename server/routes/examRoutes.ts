import { Router } from 'express';
import { ExamController } from '../controllers/examController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

// Exam routes
router.post('/submit', optionalAuth, ExamController.submitExam);
router.get('/results/:id', authenticateToken, ExamController.getExamResults);
router.get('/history', authenticateToken, ExamController.getUserExamHistory);

export default router;