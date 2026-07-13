import { Router } from 'express';
import type { RequestHandler } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Protected routes
router.get('/user', requireUser, AuthController.getCurrentUser as RequestHandler);
router.get('/me', requireUser, AuthController.getCurrentUser as RequestHandler); // alias

export default router;
