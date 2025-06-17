import { Router } from 'express';
import { CourseController } from '../controllers/courseController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', CourseController.getAllCourses);
router.get('/:id', CourseController.getCourseById);
router.get('/category/:categoryId', CourseController.getCoursesByCategory);

// Admin only routes
router.post('/', authenticateToken, requireAdmin, CourseController.createCourse);
router.put('/:id', authenticateToken, requireAdmin, CourseController.updateCourse);
router.delete('/:id', authenticateToken, requireAdmin, CourseController.deleteCourse);

export default router;