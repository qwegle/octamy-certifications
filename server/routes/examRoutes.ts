import { Router } from 'express';
import type { RequestHandler } from 'express';
import { ExamController } from '../controllers/examController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;

// Public submission is registered once in server/routes.ts. Keeping a second,
// weaker handler here made correctness depend on Express mount order.
router.get('/history', requireUser, ExamController.getUserExamHistory as RequestHandler);
router.get('/results/:id', requireUser, ExamController.getExamResults as RequestHandler);

export default router;
