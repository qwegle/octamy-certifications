import { Router } from 'express';
import authRoutes from './authRoutes';
import courseRoutes from './courseRoutes';
import examRoutes from './examRoutes';
import certificateRoutes from './certificateRoutes';
import analyticsRoutes from './analytics';
import userProfileRoutes from './userProfileRoutes';
import { registerRecruiterRoutes } from './recruiterRoutes';
import dashboardRoutes from './dashboardRoutes';
import featureRoutes from './featureRoutes';
import adminApprovalRoutes from './adminApprovalRoutes';
// Remove sellerRoutes import to prevent conflicts - seller routes are handled directly in main routes.ts

const router = Router();

// Mount route modules with proper API prefixing
router.use('/auth', authRoutes);
// Remove /courses mounting to prevent conflict with frontend routing
// router.use('/courses', courseRoutes);
router.use('/exam', examRoutes);
router.use('/certificates', certificateRoutes);
router.use('/user', userProfileRoutes); // Mount user profile routes
router.use('/', analyticsRoutes); // Mount analytics routes at root level for /api/user/profile
router.use('/', dashboardRoutes); // Dashboard CRUD: creator/institute/recruiter + subscriptions
router.use('/', featureRoutes); // Plan limits, uploads/sign, exam instances, payouts, integrations
router.use('/', adminApprovalRoutes); // Admin approval queues for creators/institutes/recruiters
// Remove seller routes mounting - handled directly in main routes.ts

// Register recruiter routes
registerRecruiterRoutes(router);

export default router;