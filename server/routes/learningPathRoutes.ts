import { Router, type RequestHandler } from 'express';
import { LearningPathController } from '../controllers/learningPathController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;

router.get('/learning-paths', LearningPathController.getLearningPaths as RequestHandler);
router.get('/user/learning-paths', requireUser, LearningPathController.getUserLearningPaths as RequestHandler);
router.post('/learning-paths/:learningPathId/enroll', requireUser, (req: any, res, next) => {
  req.body = { ...req.body, learningPathId: Number(req.params.learningPathId) };
  return (LearningPathController.enrollInLearningPath as RequestHandler)(req, res, next);
});
router.get('/recommendations/personalized', requireUser, LearningPathController.generatePersonalizedRecommendations as RequestHandler);
router.get('/recommendations/learning-paths', requireUser, LearningPathController.getLearningPathRecommendations as RequestHandler);
router.get('/recommendations/enrolled-paths', requireUser, LearningPathController.generatePersonalizedRecommendations as RequestHandler);

export default router;
