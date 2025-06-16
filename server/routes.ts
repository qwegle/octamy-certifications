import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertExamAttemptSchema, insertCertificateSchema } from "@shared/schema";

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware to verify JWT token
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Optional auth middleware
const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with seed data
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Failed to seed database:", error);
  }

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password as string, 10);
      
      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        isAdmin: false,
      });

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
      
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
      
      res.json({ token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Categories and courses
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/courses", async (req, res) => {
    try {
      const { categoryId } = req.query;
      const courses = await storage.getCourses(categoryId ? parseInt(categoryId as string) : undefined);
      res.json(courses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(parseInt(req.params.id));
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      console.error("Error fetching course:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  // Exam routes
  app.get("/api/courses/:id/questions", async (req, res) => {
    try {
      const questions = await storage.getQuestionsByCourse(parseInt(req.params.id));
      // Randomize and limit questions (10-15 questions)
      const shuffled = questions.sort(() => 0.5 - Math.random());
      const limitedQuestions = shuffled.slice(0, Math.min(15, questions.length));
      
      // Remove correct answers from response
      const questionsWithoutAnswers = limitedQuestions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options
      }));
      
      res.json(questionsWithoutAnswers);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.post("/api/exam/submit", optionalAuth, async (req, res) => {
    try {
      const { courseId, answers, timeTaken, userEmail, userName } = req.body;
      
      // Get all questions for the course
      const questions = await storage.getQuestionsByCourse(courseId);
      
      // Calculate score
      let correctAnswers = 0;
      const totalQuestions = Object.keys(answers).length;
      
      for (const [questionId, userAnswer] of Object.entries(answers)) {
        const question = questions.find(q => q.id === parseInt(questionId));
        if (question && question.correctAnswer === userAnswer) {
          correctAnswers++;
        }
      }
      
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const passed = score >= 50;
      
      // Create exam attempt
      const examAttempt = await storage.createExamAttempt({
        userId: req.user?.userId || null,
        courseId,
        userEmail,
        userName,
        score,
        totalQuestions,
        answers: answers as Record<string, number>,
        timeTaken,
        passed,
      });
      
      res.json({
        examAttemptId: examAttempt.id,
        score,
        passed,
        correctAnswers,
        totalQuestions,
      });
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Failed to submit exam" });
    }
  });

  // Certificate routes
  app.post("/api/certificates/create", optionalAuth, async (req, res) => {
    try {
      const { examAttemptId } = req.body;
      
      const examAttempt = await storage.getExamAttempt(examAttemptId);
      if (!examAttempt) {
        return res.status(404).json({ message: "Exam attempt not found" });
      }
      
      if (!examAttempt.passed) {
        return res.status(400).json({ message: "Exam not passed" });
      }
      
      const course = await storage.getCourse(examAttempt.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // Generate certificate ID
      const certificateId = `OCT-${new Date().getFullYear()}-${course.title.replace(/\s+/g, '').toUpperCase().slice(0, 3)}-${Date.now()}`;
      
      // Create certificate
      const certificate = await storage.createCertificate({
        certificateId,
        examAttemptId,
        userId: req.user?.userId || null,
        userEmail: examAttempt.userEmail,
        userName: examAttempt.userName,
        courseTitle: course.title,
        score: examAttempt.score,
        expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), // 2 years
        isPaid: false,
        isActive: true,
      });
      
      res.json(certificate);
    } catch (error) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ message: "Failed to create certificate" });
    }
  });

  app.get("/api/certificates/:certificateId", async (req, res) => {
    try {
      const certificate = await storage.getCertificateByCertificateId(req.params.certificateId);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ message: "Failed to fetch certificate" });
    }
  });

  app.post("/api/certificates/:id/payment", async (req, res) => {
    try {
      const { razorpayPaymentId, razorpayOrderId } = req.body;
      
      const certificate = await storage.getCertificate(parseInt(req.params.id));
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      
      // Update certificate as paid
      await storage.updateCertificatePayment(certificate.id, {
        isPaid: true,
        paymentId: razorpayPaymentId,
      });
      
      // Create payment record
      await storage.createPayment({
        certificateId: certificate.id,
        razorpayPaymentId,
        razorpayOrderId,
        amount: "199.00",
        currency: "INR",
        status: "completed",
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // User dashboard
  app.get("/api/user/certificates", authenticateToken, async (req, res) => {
    try {
      const certificates = await storage.getUserCertificates(req.user.userId);
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching user certificates:", error);
      res.status(500).json({ message: "Failed to fetch user certificates" });
    }
  });

  // Admin routes
  app.get("/api/admin/courses", authenticateToken, async (req, res) => {
    try {
      // Check if user is admin
      const user = await storage.getUser(req.user.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
      console.error("Error fetching admin courses:", error);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.post("/api/admin/courses", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const course = await storage.createCourse(req.body);
      res.json(course);
    } catch (error) {
      console.error("Error creating course:", error);
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  app.get("/api/admin/questions/:courseId", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const questions = await storage.getQuestionsByCourse(parseInt(req.params.courseId));
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.post("/api/admin/questions", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const question = await storage.createQuestion(req.body);
      res.json(question);
    } catch (error) {
      console.error("Error creating question:", error);
      res.status(500).json({ message: "Failed to create question" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
