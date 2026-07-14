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
import progressRoutes from './progressRoutes';
import learningPathRoutes from './learningPathRoutes';
import uploadRoutes from './upload';
import preferenceRoutes from './preferenceRoutes';
import evidencePassportRoutes from './evidencePassportRoutes';
import mediaRoutes from './mediaRoutes';
import aiCourseRoutes from './aiCourseRoutes';
import curriculumImportRoutes from './curriculumImportRoutes';
import aiQuestionDraftRoutes from './aiQuestionDraftRoutes';
import taxonomyRoutes from './taxonomyRoutes';
import catalogRoutes from './catalogRoutes';
import learnerSubscriptionRoutes from './learnerSubscriptionRoutes';
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
router.use('/', progressRoutes); // Learner progress and achievements
router.use('/', learningPathRoutes); // Learning paths and personalized recommendations
router.use('/', uploadRoutes); // Authenticated résumé uploads
router.use('/', preferenceRoutes); // Learner preferences
router.use('/', evidencePassportRoutes); // Learner-owned, privacy-aware evidence sharing
router.use('/', mediaRoutes); // Reusable per-user media library
router.use('/', aiCourseRoutes); // AI-assisted creator/institute course drafting
router.use('/', curriculumImportRoutes); // Atomic, idempotent AI curriculum application
router.use('/', aiQuestionDraftRoutes); // Review-first AI question-bank drafting (never auto-persists)
router.use('/', taxonomyRoutes); // Admin taxonomy CRUD + public audience bands
router.use('/', catalogRoutes); // Split Octamy/creator assessment discovery with server filters
router.use('/', learnerSubscriptionRoutes); // In-house-only learner subscription benefits
// Remove seller routes mounting - handled directly in main routes.ts

// Register recruiter routes
registerRecruiterRoutes(router);

export default router;
