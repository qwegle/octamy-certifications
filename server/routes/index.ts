import { Router } from 'express';
import authRoutes from './authRoutes';
import courseRoutes from './courseRoutes';
import examRoutes from './examRoutes';
import certificateRoutes from './certificateRoutes';
// Remove sellerRoutes import to prevent conflicts - seller routes are handled directly in main routes.ts

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/exam', examRoutes);
router.use('/certificates', certificateRoutes);
// Remove seller routes mounting - handled directly in main routes.ts

export default router;