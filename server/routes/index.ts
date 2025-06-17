import { Router } from 'express';
import authRoutes from './authRoutes';
import courseRoutes from './courseRoutes';
import examRoutes from './examRoutes';
import certificateRoutes from './certificateRoutes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/exam', examRoutes);
router.use('/certificates', certificateRoutes);

export default router;