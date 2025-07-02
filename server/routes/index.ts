import { Router } from 'express';
import authRoutes from './authRoutes';
import courseRoutes from './courseRoutes';
import examRoutes from './examRoutes';
import certificateRoutes from './certificateRoutes';
import analyticsRoutes from './analytics';
import { registerRecruiterRoutes } from './recruiterRoutes';
// Remove sellerRoutes import to prevent conflicts - seller routes are handled directly in main routes.ts

const router = Router();

// Mount route modules with proper API prefixing
router.use('/auth', authRoutes);
// Remove /courses mounting to prevent conflict with frontend routing
// router.use('/courses', courseRoutes);
router.use('/exam', examRoutes);
router.use('/certificates', certificateRoutes);
router.use('/', analyticsRoutes); // Mount analytics routes at root level for /api/user/profile
// Remove seller routes mounting - handled directly in main routes.ts

// Register recruiter routes
registerRecruiterRoutes(router);

export default router;