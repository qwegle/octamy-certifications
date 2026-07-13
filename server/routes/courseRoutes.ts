import { Router } from 'express';
import type { RequestHandler } from 'express';
import { CourseController } from '../controllers/courseController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;
const requireAdministrator = requireAdmin as RequestHandler;

// Public routes
router.get('/', CourseController.getAllCourses as RequestHandler);
// Specific routes must precede /:id or Express treats "category" as an ID.
router.get('/category/:categoryId', CourseController.getCoursesByCategory as RequestHandler);
router.get('/:id', CourseController.getCourseById as RequestHandler);

// Admin only routes
router.post('/', requireUser, requireAdministrator, CourseController.createCourse as RequestHandler);
router.put('/:id', requireUser, requireAdministrator, CourseController.updateCourse as RequestHandler);
router.delete('/:id', requireUser, requireAdministrator, CourseController.deleteCourse as RequestHandler);

export default router;
