import { Request, Response } from 'express';
import { storage } from '../storage';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export class CourseController {
  static async getAllCourses(req: Request, res: Response) {
    try {
      const courses = await storage.getAllCourses();
      res.json(courses);
    } catch (error) {
      console.error("Get courses error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getCourseById(req: Request, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }

      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Get course error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async createCourse(req: AuthenticatedRequest, res: Response) {
    try {
      const courseData = req.body;
      const course = await storage.createCourse(courseData);
      res.status(201).json(course);
    } catch (error) {
      console.error("Create course error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async updateCourse(req: AuthenticatedRequest, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }

      const courseData = req.body;
      const course = await storage.updateCourse(courseId, courseData);
      
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      res.json(course);
    } catch (error) {
      console.error("Update course error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async deleteCourse(req: AuthenticatedRequest, res: Response) {
    try {
      const courseId = parseInt(req.params.id);
      if (isNaN(courseId)) {
        return res.status(400).json({ message: "Invalid course ID" });
      }

      await storage.deleteCourse(courseId);
      res.json({ message: "Course deleted successfully" });
    } catch (error) {
      console.error("Delete course error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getCoursesByCategory(req: Request, res: Response) {
    try {
      const categoryId = parseInt(req.params.categoryId);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const courses = await storage.getCoursesByCategory(categoryId);
      res.json(courses);
    } catch (error) {
      console.error("Get courses by category error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}