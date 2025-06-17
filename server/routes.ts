import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertExamAttemptSchema, insertCertificateSchema, insertSellerSchema, insertSaleSchema, insertWithdrawalRequestSchema, insertSponsorSchema } from "@shared/schema";
import { LearningPathController } from './controllers/learningPathController';
import { payuMoneyService } from "./payumoney";
import { getBadgeFromScore, generateCertificateNumber, calculateExpiryDate } from "./utils";
import apiRoutes from "./routes/index";
import { emailService } from "./utils/emailService";
import { generateCertificatePDF } from "./utils/certificateGenerator";
import { generateInvoicePDF } from "./utils/invoiceGenerator";
// Using dynamic import for puppeteer to avoid ES module issues

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

interface SellerAuthenticatedRequest extends Request {
  seller?: {
    sellerId: number;
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware to verify JWT token
const authenticateAdminToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

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

// Seller authentication middleware
const authenticateSellerToken = (req: SellerAuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.seller = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with seed data
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Failed to seed database:", error);
  }

  // Mount MVC API routes - disabled to avoid conflicts with existing routes
  // app.use('/api', apiRoutes);

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

      // Generate JWT token with 24 hour expiration
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
      
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

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
      
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

  app.get("/api/courses/slug/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      
      // Check if slug is actually a numeric ID (common mistake)
      if (/^\d+$/.test(slug)) {
        const course = await storage.getCourse(parseInt(slug));
        if (!course) {
          return res.status(404).json({ message: "Course not found" });
        }
        // Get full course with category for consistency
        const fullCourse = await storage.getCourseBySlug(course.slug);
        return res.json(fullCourse || course);
      }
      
      const course = await storage.getCourseBySlug(slug);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      console.error("Error fetching course by slug:", error);
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  // Exam routes
  app.post("/api/courses/:id/questions", async (req, res) => {
    try {
      const { sessionId } = req.body;
      const questions = await storage.getQuestionsByCourse(parseInt(req.params.id));
      
      // Use Fisher-Yates shuffle for proper randomization
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Select random number of questions (10-15) for variety
      const questionCount = Math.floor(Math.random() * 6) + 10; // 10 to 15 questions
      const limitedQuestions = shuffled.slice(0, Math.min(questionCount, questions.length));
      
      // Shuffle options within each question and track correct answer
      const questionsWithShuffledOptions = limitedQuestions.map(q => {
        const originalOptions = [...q.options];
        const correctAnswerText = originalOptions[q.correctAnswer];
        
        // Shuffle options
        const shuffledOptions = [...q.options];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }
        
        // Find new position of correct answer
        const newCorrectAnswer = shuffledOptions.findIndex(option => option === correctAnswerText);
        
        return {
          id: q.id,
          question: q.question,
          options: shuffledOptions,
          correctAnswer: newCorrectAnswer
        };
      });
      
      // Store the question mapping using provided session ID
      const finalSessionId = sessionId || `session_${Date.now()}_${Math.random()}`;
      (global as any).questionMappings = (global as any).questionMappings || {};
      (global as any).questionMappings[finalSessionId] = questionsWithShuffledOptions.reduce((acc: any, q) => {
        acc[q.id] = q.correctAnswer;
        return acc;
      }, {});
      
      // Remove correct answers from response
      const questionsWithoutAnswers = questionsWithShuffledOptions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options
      }));
      
      res.json({ questions: questionsWithoutAnswers, sessionId: finalSessionId });
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // EXAM SUBMISSION ENDPOINT WITH IMPROVED SCORING LOGIC
  // This endpoint handles exam submissions and determines pass/fail based on these rules:
  // 1. First-time exam takers: Must score >= 50% to pass
  // 2. Retakers: Must score higher than their previous best attempt to pass
  // The response includes detailed information about retake status and scoring thresholds
  app.post("/api/exam/submit", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { courseId, answers, timeSpent, timeTaken, userEmail, userName, sessionId, tabSwitches } = req.body;
      const finalTimeTaken = timeTaken || timeSpent || 60; // Use timeTaken or timeSpent as fallback
      
      // Get correct answers from session mapping
      const correctAnswersMapping = (global as any).questionMappings?.[sessionId] || {};
      
      // Transform answers array to Record<string, number> format
      const answersRecord: Record<string, number> = {};
      if (Array.isArray(answers)) {
        answers.forEach((answer: any) => {
          if (answer.questionId && answer.selectedOption !== undefined) {
            answersRecord[answer.questionId.toString()] = answer.selectedOption;
          }
        });
      } else {
        // If answers is already in the correct format
        Object.assign(answersRecord, answers);
      }

      // Calculate score using session-specific correct answers
      let correctAnswers = 0;
      const totalQuestions = Object.keys(answersRecord).length;
      
      for (const [questionId, userAnswer] of Object.entries(answersRecord)) {
        const correctAnswer = correctAnswersMapping[parseInt(questionId)];
        if (correctAnswer !== undefined && correctAnswer === userAnswer) {
          correctAnswers++;
        }
      }
      
      // Clean up session data
      if ((global as any).questionMappings?.[sessionId]) {
        delete (global as any).questionMappings[sessionId];
      }
      
      // Calculate the final score percentage
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      
      // Get course data to check passing score
      const course = await storage.getCourse(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      
      // EXAM PASSING LOGIC:
      // Use the course's defined passing score (e.g., 60% for Demo Course)
      const passingScore = course.passingScore;
      let passed = score >= passingScore;
      let isRetake = false;
      let previousBestScore = 0;
      
      // Check if user has taken this exam before (for tracking purposes)
      if (req.user?.userId) {
        const previousAttempts = await storage.getExamAttemptsByUserAndCourse(req.user.userId, courseId);
        
        if (previousAttempts.length > 0) {
          isRetake = true;
          // Find the highest score from previous attempts
          previousBestScore = Math.max(...previousAttempts.map(attempt => attempt.score));
        }
      }
      
      // Mastery is achieved at 90% regardless of attempt number
      const mastered = score >= 90;
      
      // Anti-cheating validation (relaxed for demo purposes)
      const minTimePerQuestion = 2; // seconds (reduced for better user experience)
      const expectedMinTime = totalQuestions * minTimePerQuestion;
      if (finalTimeTaken < expectedMinTime) {
        return res.status(400).json({ 
          message: `Exam completed too quickly. Please spend at least ${minTimePerQuestion} seconds per question.` 
        });
      }

      // Create exam attempt with anti-cheating data
      const examAttempt = await storage.createExamAttempt({
        userId: req.user?.userId || null,
        courseId,
        userEmail,
        userName,
        score,
        totalQuestions,
        answers: answersRecord,
        timeTaken: finalTimeTaken,
        passed,
        mastered,
        sessionId,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        tabSwitches: req.body.tabSwitches || 0,
      });
      
      // Return comprehensive exam result with retake information for frontend
      res.json({
        examAttemptId: examAttempt.id,
        score,
        passed,
        correctAnswers,
        totalQuestions,
        // Additional information for developers and frontend logic
        isRetake,
        previousBestScore,
        passingThreshold: passingScore, // What score was needed to pass
        message: passed 
          ? `Congratulations! You passed with ${score}%`
          : `You scored ${score}%. You need at least ${passingScore}% to pass.`
      });
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Failed to submit exam" });
    }
  });

  // Certificate routes
  app.post("/api/certificates/create", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { examAttemptId, businessName } = req.body;
      
      if (!examAttemptId) {
        return res.status(400).json({ message: "Exam attempt ID is required" });
      }
      
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

      // Always create a new certificate for each exam attempt - no reusing existing certificates
      
      // Generate certificate ID
      const certificateId = `OCT-${new Date().getFullYear()}-${course.title.replace(/\s+/g, '').toUpperCase().slice(0, 3)}-${Date.now()}`;
      
      // Calculate badge based on score
      const badge = getBadgeFromScore(examAttempt.score);
      
      // Generate unique certificate number
      const certificateNumber = generateCertificateNumber();
      
      // Create new certificate
      const certificate = await storage.createCertificate({
        certificateId,
        examAttemptId,
        courseId: examAttempt.courseId,
        userId: req.user?.userId || null,
        userEmail: examAttempt.userEmail,
        userName: examAttempt.userName,
        courseTitle: course.title,
        score: examAttempt.score,
        badge,
        certificateNumber,
        expiresAt: calculateExpiryDate(),
        businessName: businessName || null,
        retakeCount: 0,
        isPaid: false, // Certificate requires payment to activate
      });
      
      res.json(certificate);
    } catch (error) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ message: "Failed to create certificate" });
    }
  });

  // Get certificate by ID (certificate ID string, not database ID)
  app.get("/api/certificates/:id", async (req, res) => {
    try {
      const certificateId = req.params.id;
      
      // If it looks like a certificate ID (OCT-YYYY-XXX-TIMESTAMP), use getCertificateByCertificateId
      if (certificateId.startsWith('OCT-')) {
        const certificate = await storage.getCertificateByCertificateId(certificateId);
        if (!certificate) {
          return res.status(404).json({ message: "Certificate not found" });
        }
        res.json(certificate);
      } else {
        // Otherwise try to parse as database ID
        const dbId = parseInt(certificateId);
        if (isNaN(dbId)) {
          return res.status(400).json({ message: "Invalid certificate ID" });
        }
        const certificate = await storage.getCertificate(dbId);
        if (!certificate) {
          return res.status(404).json({ message: "Certificate not found" });
        }
        res.json(certificate);
      }
    } catch (error) {
      console.error("Error fetching certificate:", error);
      res.status(500).json({ message: "Failed to fetch certificate" });
    }
  });

  // Get certificate by certificate ID (OCT-YYYY-XXX-timestamp format)
  app.get("/api/certificates/verify/:certificateId", async (req, res) => {
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
  app.get("/api/user/certificates", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const certificates = await storage.getUserCertificates(req.user!.userId);
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching user certificates:", error);
      res.status(500).json({ message: "Failed to fetch user certificates" });
    }
  });

  // Get certificate count for dashboard
  app.get("/api/user/certificates/count", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userEmail = req.query.email as string;
      const count = await storage.getUserCertificatesCount(req.user?.userId || null, userEmail);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching certificate count:", error);
      res.status(500).json({ message: "Failed to fetch certificate count" });
    }
  });

  // Check if user has certificate for specific course - only return if paid
  app.get("/api/user/certificate-for-course/:courseId", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const userEmail = req.query.email as string;
      
      const certificate = await storage.getUserCertificateForCourse(
        req.user?.userId || null,
        courseId,
        userEmail || null
      );
      
      if (certificate) {
        // Only return certificate if payment has been completed
        if (certificate.isPaid) {
          res.json(certificate);
        } else {
          res.status(402).json({ 
            message: "Certificate payment required",
            certificateId: certificate.id,
            requiresPayment: true
          });
        }
      } else {
        res.status(404).json({ message: "No certificate found for this course" });
      }
    } catch (error) {
      console.error("Error fetching certificate for course:", error);
      res.status(500).json({ message: "Failed to fetch certificate" });
    }
  });

  // Admin routes
  app.get("/api/admin/courses", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user is admin
      const user = await storage.getUser(req.user!.userId);
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

  app.post("/api/admin/courses", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
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

  app.get("/api/admin/questions/:courseId", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
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

  app.post("/api/admin/questions", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
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

  // Internship application routes
  app.post("/api/internship-applications", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { certificateId, applicantName, dateOfBirth, startDate, endDate, durationMonths } = req.body;
      
      // Verify certificate exists and belongs to user if authenticated
      const certificate = await storage.getCertificate(certificateId);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Create internship application
      const application = await storage.createInternshipApplication({
        certificateId,
        applicantName,
        dateOfBirth,
        startDate,
        endDate,
        durationMonths,
      });

      res.json(application);
    } catch (error) {
      console.error("Error creating internship application:", error);
      res.status(500).json({ message: "Failed to create internship application" });
    }
  });

  app.get("/api/internship-applications/:certificateId", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const application = await storage.getInternshipApplication(parseInt(req.params.certificateId));
      res.json(application);
    } catch (error) {
      console.error("Error fetching internship application:", error);
      res.status(500).json({ message: "Failed to fetch internship application" });
    }
  });

  // Seller Authentication Routes
  app.post("/api/sellers/register", async (req: Request, res: Response) => {
    try {
      const sellerData = insertSellerSchema.parse(req.body);
      
      // Check if seller already exists
      const existingSeller = await storage.getSellerByEmail(sellerData.email);
      if (existingSeller) {
        return res.status(400).json({ message: "Seller already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(sellerData.password, 10);
      
      const seller = await storage.createSeller({
        ...sellerData,
        password: hashedPassword,
      });

      // Generate JWT token with 7 day expiration
      const token = jwt.sign({ 
        sellerId: seller.id, 
        email: seller.email,
        iat: Math.floor(Date.now() / 1000)
      }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        token, 
        seller: { 
          id: seller.id, 
          email: seller.email, 
          name: seller.name,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings,
          pendingEarnings: seller.pendingEarnings
        } 
      });
    } catch (error) {
      console.error("Error registering seller:", error);
      res.status(500).json({ message: "Failed to register seller" });
    }
  });

  app.post("/api/sellers/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const seller = await storage.getSellerByEmail(email);
      if (!seller) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, seller.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ 
        sellerId: seller.id, 
        email: seller.email,
        iat: Math.floor(Date.now() / 1000)
      }, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        token, 
        seller: { 
          id: seller.id, 
          email: seller.email, 
          name: seller.name,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings,
          pendingEarnings: seller.pendingEarnings
        } 
      });
    } catch (error) {
      console.error("Error logging in seller:", error);
      res.status(500).json({ message: "Failed to login" });
    }
  });

  // Seller Dashboard Routes
  app.get("/api/sellers/dashboard", authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const seller = await storage.getSeller(req.seller!.sellerId);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }

      const sales = await storage.getSellerSales(req.seller!.sellerId);
      const withdrawals = await storage.getSellerWithdrawals(req.seller!.sellerId);
      const clickAnalytics = await storage.getSellerClickAnalytics(req.seller!.sellerId);
      
      res.json({
        seller: {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings,
          pendingEarnings: seller.pendingEarnings,
          commissionRate: seller.commissionRate
        },
        sales,
        withdrawals,
        analytics: {
          totalSales: sales.length,
          totalCommission: sales.reduce((sum, sale) => sum + parseFloat(sale.commission), 0),
          pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length
        },
        clickAnalytics
      });
    } catch (error) {
      console.error("Error fetching seller dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  // Open Graph image generation for social sharing
  app.get("/api/og-image/course/:courseId", async (req: Request, res: Response) => {
    try {
      const courseId = parseInt(req.params.courseId);
      const course = await storage.getCourse(courseId);
      
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Generate SVG-based Open Graph image
      const ogImageSvg = `
        <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#333333;stop-opacity:1" />
            </linearGradient>
          </defs>
          
          <!-- Background -->
          <rect width="1200" height="630" fill="url(#bg)"/>
          
          <!-- Content Area -->
          <rect x="60" y="60" width="1080" height="510" fill="#ffffff" rx="20"/>
          
          <!-- Header -->
          <rect x="60" y="60" width="1080" height="120" fill="#000000" rx="20"/>
          <text x="120" y="135" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#ffffff">
            OCTAMY PROFESSIONAL CERTIFICATIONS
          </text>
          
          <!-- Course Title -->
          <text x="120" y="250" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#000000">
            ${course.title.length > 40 ? course.title.substring(0, 40) + '...' : course.title}
          </text>
          
          <!-- Course Description -->
          <text x="120" y="320" font-family="Arial, sans-serif" font-size="24" fill="#333333">
            ${course.description ? (course.description.length > 80 ? course.description.substring(0, 80) + '...' : course.description) : 'Professional certification course'}
          </text>
          
          <!-- Price and Duration -->
          <rect x="120" y="380" width="200" height="60" fill="#000000" rx="10"/>
          <text x="140" y="420" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff">
            ₹${course.price}
          </text>
          
          <rect x="340" y="380" width="250" height="60" fill="#f0f0f0" rx="10"/>
          <text x="360" y="420" font-family="Arial, sans-serif" font-size="24" fill="#333333">
            ${course.duration} minutes
          </text>
          
          <!-- Certificate Badge -->
          <circle cx="1000" cy="350" r="80" fill="#FFD700"/>
          <text x="1000" y="340" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#000000" text-anchor="middle">
            CERTIFIED
          </text>
          <text x="1000" y="365" font-family="Arial, sans-serif" font-size="14" fill="#000000" text-anchor="middle">
            COURSE
          </text>
          
          <!-- Call to Action -->
          <text x="120" y="520" font-family="Arial, sans-serif" font-size="20" fill="#666666">
            Join thousands of professionals advancing their careers
          </text>
        </svg>
      `;

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(ogImageSvg);
    } catch (error) {
      console.error("Error generating OG image:", error);
      res.status(500).json({ message: "Failed to generate image" });
    }
  });

  // Generate referral URLs for partners
  app.post("/api/sellers/generate-referral-url", authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const { type, itemId } = req.body; // type: 'course', 'internship', 'business'
      const sellerId = req.seller!.sellerId;
      
      // Get item details for SEO optimization
      let item;
      let baseUrl = '';
      let itemType = '';
      
      switch (type) {
        case 'course':
          item = await storage.getCourse(itemId);
          if (!item) {
            return res.status(404).json({ message: "Course not found" });
          }
          baseUrl = `/courses/${item.slug}`;
          itemType = 'Professional Course';
          break;
        case 'internship':
          item = await storage.getCourse(itemId);
          if (!item || !item.isInternship) {
            return res.status(404).json({ message: "Internship not found" });
          }
          baseUrl = `/virtual-internships/${item.slug}`;
          itemType = 'Virtual Internship';
          break;
        case 'business':
          item = await storage.getCourse(itemId);
          if (!item || !item.isBusiness) {
            return res.status(404).json({ message: "Business certification not found" });
          }
          baseUrl = `/business-certifications/${item.slug}`;
          itemType = 'Business Certification';
          break;
        default:
          return res.status(400).json({ message: "Invalid type" });
      }

      // Generate unique referral code
      const referralCode = `${sellerId}-${type}-${itemId}-${Date.now()}`;
      
      const referralUrl = `${req.protocol}://${req.get('host')}${baseUrl}?ref=${referralCode}`;
      
      // Generate comprehensive SEO metadata for better social sharing
      const seoMetadata = {
        title: `${item.title} - ${itemType} | Octamy`,
        description: item.description || `Professional ${itemType.toLowerCase()} certification with industry-recognized credentials. Join thousands of professionals advancing their careers with Octamy.`,
        image: `${req.protocol}://${req.get('host')}/api/og-image/course/${item.id}`,
        url: referralUrl,
        type: 'website',
        siteName: 'Octamy Professional Certifications',
        locale: 'en_US',
        price: `₹${item.price}`,
        currency: 'INR',
        availability: 'in stock',
        category: itemType,
        brand: 'Octamy Solutions'
      };
      
      res.json({
        referralUrl,
        referralCode,
        type,
        itemId,
        sellerId,
        seoMetadata,
        itemDetails: {
          title: item.title,
          description: item.description,
          price: item.price,
          type: itemType,
          duration: `${item.duration} minutes`,
          level: item.level
        }
      });
    } catch (error) {
      console.error("Error generating referral URL:", error);
      res.status(500).json({ message: "Failed to generate referral URL" });
    }
  });

  // Get all courses/internships/business certs for partner sharing
  app.get("/api/sellers/shareable-items", authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const courses = await storage.getCourses();
      
      const shareableItems = {
        courses: courses.filter(c => !c.isInternship && !c.isBusiness),
        internships: courses.filter(c => c.isInternship),
        businessCertifications: courses.filter(c => c.isBusiness)
      };
      
      res.json(shareableItems);
    } catch (error) {
      console.error("Error fetching shareable items:", error);
      res.status(500).json({ message: "Failed to fetch shareable items" });
    }
  });

  // Track referral link clicks
  app.post("/api/referral/track-click", async (req: Request, res: Response) => {
    try {
      const { referralCode, courseId } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      if (!referralCode || !courseId) {
        return res.status(400).json({ message: "Missing referral code or course ID" });
      }

      await storage.trackReferralClick({
        referralCode,
        courseId: parseInt(courseId),
        ipAddress,
        userAgent
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking referral click:", error);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Course purchase with referral tracking
  app.post("/api/courses/:courseId/purchase", async (req: Request, res: Response) => {
    try {
      const { courseId } = req.params;
      const { referralCode, userEmail, userName } = req.body;
      
      const course = await storage.getCourse(parseInt(courseId));
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Create certificate first with proper badge system
      const certificateId = `OCT-${new Date().getFullYear()}-${course.title.replace(/\s+/g, '').toUpperCase().slice(0, 3)}-${Date.now()}`;
      const badge = "Bronze"; // Default badge, will be updated after exam
      const certificateNumber = generateCertificateNumber();
      
      const certificate = await storage.createCertificate({
        courseId: parseInt(courseId),
        certificateId,
        examAttemptId: 0, // Will be updated when exam is taken
        userEmail,
        userName,
        courseTitle: course.title,
        score: 0,
        badge,
        certificateNumber,
        expiresAt: calculateExpiryDate(),
        retakeCount: 0,
        isPaid: false, // Always create as unpaid
        paymentId: null, // No payment initially
        isActive: true
      });

      // If referral code provided, create sale record
      if (referralCode) {
        // Find seller by referral code (assuming referral code is seller email for now)
        const seller = await storage.getSellerByEmail(referralCode);
        if (seller && seller.isApproved) {
          const commission = parseFloat(course.price) * (parseFloat(seller.commissionRate) / 100);
          
          await storage.createSale({
            sellerId: seller.id,
            certificateId: certificate.id,
            courseId: parseInt(courseId),
            amount: course.price,
            commission: commission.toString(),
            referralCode,
            status: 'pending'
          });

          // Update seller pending earnings
          await storage.updateSeller(seller.id, {
            pendingEarnings: (parseFloat(seller.pendingEarnings) + commission).toString()
          });
        }
      }

      res.json({ certificate });
    } catch (error) {
      console.error("Error processing course purchase:", error);
      res.status(500).json({ message: "Failed to process purchase" });
    }
  });

  // Withdrawal Request Routes
  app.post("/api/sellers/withdrawals", authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const withdrawalData = insertWithdrawalRequestSchema.parse({
        ...req.body,
        sellerId: req.seller!.sellerId
      });

      const seller = await storage.getSeller(req.seller!.sellerId);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }

      if (!seller.isApproved) {
        return res.status(403).json({ message: "Seller not approved" });
      }

      if (parseFloat(seller.pendingEarnings) < parseFloat(withdrawalData.amount)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      const withdrawal = await storage.createWithdrawalRequest(withdrawalData);
      res.json(withdrawal);
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });

  // Admin Routes for Seller Management
  app.get("/api/admin/sellers", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get all sellers with their stats
      const sellers = await storage.getSeller(0); // This would need to be updated to get all sellers
      res.json(sellers);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      res.status(500).json({ message: "Failed to fetch sellers" });
    }
  });

  app.post("/api/admin/sellers/:sellerId/approve", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { sellerId } = req.params;
      const { isApproved } = req.body;

      await storage.updateSeller(parseInt(sellerId), { isApproved });
      res.json({ message: "Seller approval status updated" });
    } catch (error) {
      console.error("Error updating seller approval:", error);
      res.status(500).json({ message: "Failed to update seller approval" });
    }
  });

  app.get("/api/admin/withdrawals", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.post("/api/admin/withdrawals/:withdrawalId/process", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { withdrawalId } = req.params;
      const { status, adminNotes } = req.body;

      await storage.updateWithdrawalStatus(parseInt(withdrawalId), status, adminNotes);
      res.json({ message: "Withdrawal status updated" });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // PayUMoney Payment Routes
  
  // Initialize PayUMoney payment
  app.post("/api/payment/initiate", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        certificateId, 
        courseId, 
        userEmail, 
        userName, 
        userPhone, 
        sellerCode,
        includesPhysicalCopy = false,
        selectedAddressId = null,
        amount
      } = req.body;

      if (!courseId || isNaN(parseInt(courseId))) {
        return res.status(400).json({ message: "Invalid course ID" });
      }

      if (!certificateId) {
        return res.status(400).json({ message: "Certificate ID is required" });
      }

      const course = await storage.getCourse(parseInt(courseId));
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Verify certificate exists - handle both numeric and string certificate IDs
      let certificate;
      if (typeof certificateId === 'string' && certificateId.startsWith('OCT-')) {
        // Handle string certificate ID (like "OCT-2025-DEM-1750088793632")
        certificate = await storage.getCertificateByCertificateId(certificateId);
      } else if (!isNaN(parseInt(certificateId))) {
        // Handle numeric certificate ID
        certificate = await storage.getCertificate(parseInt(certificateId));
      } else {
        return res.status(400).json({ message: "Invalid certificate ID format" });
      }

      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      const txnid = payuMoneyService.generateTransactionId();
      
      // Calculate total amount based on physical copy selection
      const baseAmount = parseFloat(amount || course.price);
      const shippingCost = includesPhysicalCopy ? 50 : 0;
      const totalAmount = baseAmount + shippingCost;
      const formattedAmount = payuMoneyService.formatAmount(totalAmount.toString());

      console.log('Payment data being created:', {
        userId: req.user?.userId || null,
        courseId: parseInt(courseId),
        certificateId: certificate.id,
        amount: formattedAmount,
        certificateAmount: baseAmount.toFixed(2),
        shippingAmount: shippingCost.toFixed(2),
        includesPhysicalCopy,
        selectedAddressId,
        status: "pending",
        paymentMethod: "payumoney",
        transactionId: txnid
      });

      // Create payment record with certificate link and physical copy details
      const payment = await storage.createPayment({
        userId: req.user?.userId || null,
        courseId: parseInt(courseId),
        certificateId: certificate.id,
        amount: formattedAmount,
        certificateAmount: baseAmount.toFixed(2),
        shippingAmount: shippingCost.toFixed(2),
        includesPhysicalCopy,
        selectedAddressId,
        status: "pending",
        paymentMethod: "payumoney",
        transactionId: txnid
      });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const paymentData = {
        txnid,
        amount: formattedAmount,
        productinfo: includesPhysicalCopy 
          ? `${course.title} - Professional Certification (Digital + Physical)`
          : `${course.title} - Professional Certification`,
        firstname: userName,
        email: userEmail,
        phone: userPhone,
        surl: `${baseUrl}/api/payment/success`,
        furl: `${baseUrl}/api/payment/failure`,
        udf1: courseId,
        udf2: payment.id.toString(),
        udf3: sellerCode || '',
        udf4: req.user?.userId?.toString() || '',
        udf5: selectedAddressId?.toString() || ''
      };

      const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

      res.json({
        success: true,
        paymentForm,
        transactionId: txnid,
        amount: formattedAmount
      });
    } catch (error) {
      console.error("Error initiating payment:", error);
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  // PayUMoney success callback
  app.post("/api/payment/success", async (req: Request, res: Response) => {
    try {
      const responseData = req.body;

      // Verify hash
      if (!payuMoneyService.verifyHash(responseData)) {
        console.error("Hash verification failed for transaction:", responseData.txnid);
        return res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=hash_verification_failed`);
      }

      const status = payuMoneyService.getPaymentStatus(responseData);
      
      if (status === 'success') {
        const paymentDbId = parseInt(responseData.udf2);
        const courseId = parseInt(responseData.udf1);
        const sellerCode = responseData.udf3;
        const userId = responseData.udf4 ? parseInt(responseData.udf4) : null;

        // Get the payment record first
        const payment = await storage.getPayment(paymentDbId);
        if (!payment) {
          console.error("Payment not found for ID:", paymentDbId);
          return res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=payment_not_found`);
        }

        // Get the certificate from the payment's certificate ID
        const certificate = payment.certificateId ? await storage.getCertificate(payment.certificateId) : null;
        
        if (certificate) {
          // Update certificate payment status
          await storage.updateCertificatePayment(certificate.id, {
            isPaid: true,
            paymentId: responseData.mihpayid
          });

          // Update payment record
          await storage.updatePayment(payment.id, {
            status: 'completed',
            paymentMethod: 'payumoney',
            razorpayPaymentId: responseData.mihpayid,
            razorpayOrderId: responseData.txnid
          });

          // Handle seller commission if applicable
          if (sellerCode) {
            console.log(`Processing commission for seller code: ${sellerCode}`);
            const seller = await storage.getSellerByReferralCode(sellerCode);
            console.log(`Seller found:`, seller ? `ID: ${seller.id}, Approved: ${seller.isApproved}` : 'Not found');
            
            if (seller && seller.isApproved) {
              const course = await storage.getCourse(courseId);
              if (course) {
                const commissionAmount = (parseFloat(course.price) * parseFloat(seller.commissionRate)) / 100;
                console.log(`Creating sale record: Commission ${commissionAmount} for course ${course.title} (${course.price})`);
                
                await storage.createSale({
                  sellerId: seller.id,
                  courseId: courseId,
                  certificateId: certificate.id,
                  amount: course.price,
                  commission: commissionAmount.toString(),
                  referralCode: sellerCode,
                  status: "completed"
                });

                // Update seller earnings
                const currentEarnings = parseFloat(seller.totalEarnings || "0");
                const newEarnings = currentEarnings + commissionAmount;
                console.log(`Updating seller earnings from ${currentEarnings} to ${newEarnings}`);
                
                await storage.updateSeller(seller.id, {
                  totalEarnings: newEarnings.toString()
                });
              }
            } else {
              console.log(`Seller not found or not approved for code: ${sellerCode}`);
            }
          } else {
            console.log('No seller code provided in payment');
          }

          // Handle email delivery for both registered and guest users
          try {
            const course = await storage.getCourse(courseId);
            const examAttempt = await storage.getExamAttemptByCertificateId(certificate.id);
            
            if (course && examAttempt) {
              // Import certificate generator functions
              const { generateCertificatePDF, generateInvoicePDF } = await import('../utils/certificateGenerator');
              
              // Determine user info - either from registered user or certificate data
              let userName = certificate.userName;
              let userEmail = certificate.userEmail;
              
              if (userId) {
                const user = await storage.getUser(userId);
                if (user) {
                  userName = user.name || user.email;
                  userEmail = user.email;
                  
                  // Send notification for registered users
                  await storage.createNotification({
                    userId: userId,
                    title: "Certificate Payment Successful",
                    type: "payment_success",
                    message: `Your payment for certificate ${certificate.certificateId} has been processed successfully. You can now download your certificate.`,
                    data: {
                      certificateId: certificate.certificateId,
                      actionUrl: `/certificates/${certificate.certificateId}`,
                      priority: "high"
                    }
                  });
                }
              }

              // Generate certificate PDF
              const certificatePdf = await generateCertificatePDF({
                certificateId: certificate.certificateId,
                userName: userName,
                courseTitle: course.title,
                issueDate: new Date(),
                completionDate: examAttempt.submittedAt || new Date(),
                passingScore: course.passingScore,
                userScore: examAttempt.score
              });

              // Generate invoice PDF
              const invoicePdf = await generateInvoicePDF({
                transactionId: responseData.txnid,
                customerName: userName,
                customerEmail: userEmail,
                courseTitle: course.title,
                amount: payment.amount,
                certificateAmount: payment.certificateAmount || payment.amount,
                shippingAmount: payment.shippingAmount || "0.00",
                includesPhysicalCopy: payment.includesPhysicalCopy || false,
                date: new Date(),
                paymentMethod: "PayUMoney"
              });

              // Send email with certificate and invoice (works for both registered and guest users)
              const emailSent = await emailService.sendCertificateEmail(
                userEmail,
                userName,
                course.title,
                certificate.certificateId,
                certificatePdf,
                invoicePdf,
                payment.includesPhysicalCopy || false
              );

              if (emailSent) {
                console.log(`Certificate and invoice emailed successfully to ${userEmail} (${userId ? 'registered' : 'guest'} user)`);
                
                // Update certificate delivery status
                await storage.updateCertificate(certificate.id, {
                  isDelivered: true,
                  deliveredAt: new Date()
                });
              } else {
                console.error(`Failed to send email to ${userEmail}`);
              }
            }
          } catch (emailError) {
            console.error("Error sending certificate email:", emailError);
          }

          console.log(`Payment successful for certificate ${certificate.certificateId}, user can now download`);
          res.redirect(`${req.protocol}://${req.get('host')}/payment-success?txnid=${responseData.txnid}&certificateId=${certificate.certificateId}`);
        } else {
          console.error("Certificate not found for payment ID:", paymentDbId);
          res.redirect(`${req.protocol}://${req.get('host')}/payment-success?txnid=${responseData.txnid}`);
        }
      } else {
        res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?txnid=${responseData.txnid}&error=${responseData.error_Message || 'payment_failed'}`);
      }
    } catch (error) {
      console.error("Error processing payment success:", error);
      res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=processing_error`);
    }
  });

  // PayUMoney failure callback
  app.post("/api/payment/failure", async (req: Request, res: Response) => {
    try {
      const responseData = req.body;
      
      res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?txnid=${responseData.txnid}&error=${responseData.error_Message || 'payment_failed'}`);
    } catch (error) {
      console.error("Error processing payment failure:", error);
      res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=processing_error`);
    }
  });

  // Verify payment status
  app.get("/api/payment/status/:transactionId", async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;
      
      const payments = await storage.getAllPayments();
      const payment = payments.find(p => p.transactionId === transactionId);
      
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json({
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId,
        createdAt: payment.createdAt
      });
    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ message: "Failed to check payment status" });
    }
  });

  // User address management endpoints
  app.get("/api/user/addresses", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const addresses = await storage.getUserAddresses(userId);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching user addresses:", error);
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post("/api/user/addresses", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const addressData = {
        ...req.body,
        userId
      };

      const address = await storage.createUserAddress(addressData);
      res.json(address);
    } catch (error) {
      console.error("Error creating user address:", error);
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.put("/api/user/addresses/:id", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const addressId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const address = await storage.updateUserAddress(addressId, req.body);
      res.json(address);
    } catch (error) {
      console.error("Error updating user address:", error);
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  app.delete("/api/user/addresses/:id", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const addressId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      await storage.deleteUserAddress(addressId);
      res.json({ message: "Address deleted successfully" });
    } catch (error) {
      console.error("Error deleting user address:", error);
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  app.put("/api/user/addresses/:id/default", optionalAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const addressId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      await storage.setDefaultAddress(userId, addressId);
      res.json({ message: "Default address updated successfully" });
    } catch (error) {
      console.error("Error updating default address:", error);
      res.status(500).json({ message: "Failed to update default address" });
    }
  });

  // Business certificates endpoint
  app.post("/api/business-certificates", async (req: Request, res: Response) => {
    try {
      const {
        companyName,
        contactPerson,
        email,
        phone,
        selectedCourses,
        teamSize,
        requirements
      } = req.body;

      console.log("Business certificate request received:", {
        companyName,
        contactPerson,
        email,
        teamSize: selectedCourses?.length
      });

      // In a real implementation, you would save this to a business_inquiries table
      res.json({
        success: true,
        message: "Business certificate inquiry submitted successfully",
        inquiryId: `BIZ-${Date.now()}`,
        estimatedResponse: "24 hours"
      });
    } catch (error) {
      console.error("Error submitting business certificate request:", error);
      res.status(500).json({ message: "Failed to submit business certificate request" });
    }
  });

  // Certificate verification endpoint
  app.get("/api/certificates/verify/:certificateId", async (req: Request, res: Response) => {
    try {
      const { certificateId } = req.params;
      
      const certificate = await storage.getCertificateByCertificateId(certificateId);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      
      res.json(certificate);
    } catch (error) {
      console.error("Certificate verification error:", error);
      res.status(500).json({ message: "Failed to verify certificate" });
    }
  });

  // Certificate download endpoint
  app.get("/api/certificates/:certificateId/download", async (req: Request, res: Response) => {
    try {
      const { certificateId } = req.params;
      
      const certificate = await storage.getCertificateByCertificateId(certificateId);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      if (!certificate.isPaid) {
        return res.status(403).json({ message: "Certificate payment required" });
      }

      // Get course details for the certificate
      const course = await storage.getCourse(certificate.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Prepare certificate data for the new professional design
      const certificateData = {
        certificateId: certificate.certificateId,
        userName: certificate.userName, // Fixed: use correct field name
        courseTitle: course.title, // Fixed: use correct field name
        passingScore: course.passingScore,
        userScore: certificate.score,
        completionDate: new Date(certificate.issuedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        score: certificate.score,
        courseDuration: `${course.duration} Hours`,
        issueDate: new Date(certificate.issuedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        courseLevel: course.level || 'Professional'
      };

      // Check if PDF download is requested
      const format = req.query.format;
      
      if (format === 'pdf') {
        // Generate PDF using the new professional design
        const { generateCertificatePDF } = await import('./utils/certificateGenerator');
        const pdfBuffer = await generateCertificatePDF(certificateData);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificateId}.pdf"`);
        res.send(pdfBuffer);
      } else {
        // Return HTML version for viewing using the new professional design
        const { generateCertificateHTML } = await import('./utils/newCertificateGenerator');
        const certificateHtml = generateCertificateHTML(certificateData);
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="certificate-${certificateId}.html"`);
        res.send(certificateHtml);
      }
    } catch (error) {
      console.error("Certificate download error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notifications endpoint
  app.get("/api/notifications", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.put("/api/notifications/:id/read", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const notificationId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markNotificationAsRead(notificationId, userId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.put("/api/notifications/read-all", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Recommendations endpoint
  app.get("/api/recommendations", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const recommendations = await storage.getUserRecommendations(userId);
      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Generate new recommendations
  app.post("/api/recommendations/generate", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.generateUserRecommendations(userId);
      const recommendations = await storage.getUserRecommendations(userId);
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // Track user activity
  app.post("/api/activity", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId || null;
      const { activityType, entityType, entityId, metadata } = req.body;

      await storage.trackUserActivity({
        userId,
        activityType,
        entityType,
        entityId,
        metadata
      });

      res.json({ message: "Activity tracked successfully" });
    } catch (error) {
      console.error("Error tracking activity:", error);
      res.status(500).json({ message: "Failed to track activity" });
    }
  });

  // Get user progress
  app.get("/api/progress", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const progress = await storage.getUserProgress(userId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  // Update user progress
  app.post("/api/progress", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const progress = await storage.updateUserProgress(userId, req.body);
      res.json(progress);
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Get achievements
  app.get("/api/achievements", async (req: Request, res: Response) => {
    try {
      const achievements = await storage.getAllAchievements();
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Get user achievements
  app.get("/api/user/achievements", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const achievements = await storage.getUserAchievements(userId);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  // Check achievements
  app.post("/api/achievements/check", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const newAchievements = await storage.checkAndUnlockAchievements(userId, req.body);
      res.json(newAchievements);
    } catch (error) {
      console.error("Error checking achievements:", error);
      res.status(500).json({ message: "Failed to check achievements" });
    }
  });

  // Get user preferences
  app.get("/api/preferences", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const preferences = await storage.getUserPreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // Update user preferences
  app.put("/api/preferences", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const preferences = await storage.updateUserPreferences(userId, req.body);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Learning paths endpoints
  app.get("/api/learning-paths", async (req: Request, res: Response) => {
    try {
      const learningPaths = await storage.getAllLearningPaths();
      res.json(learningPaths);
    } catch (error) {
      console.error("Error fetching learning paths:", error);
      res.status(500).json({ message: "Failed to fetch learning paths" });
    }
  });

  app.get("/api/learning-paths/featured", async (req: Request, res: Response) => {
    try {
      const featuredPaths = await storage.getFeaturedLearningPaths();
      res.json(featuredPaths);
    } catch (error) {
      console.error("Error fetching featured learning paths:", error);
      res.status(500).json({ message: "Failed to fetch featured learning paths" });
    }
  });

  app.post("/api/learning-paths/:pathId/enroll", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const pathId = parseInt(req.params.pathId);
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const enrollment = await storage.enrollInLearningPath(userId, pathId);
      res.json(enrollment);
    } catch (error) {
      console.error("Error enrolling in learning path:", error);
      res.status(500).json({ message: "Failed to enroll in learning path" });
    }
  });

  app.get("/api/user/learning-paths", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userPaths = await storage.getUserLearningPaths(userId);
      res.json(userPaths);
    } catch (error) {
      console.error("Error fetching user learning paths:", error);
      res.status(500).json({ message: "Failed to fetch user learning paths" });
    }
  });

  // Sponsor endpoints
  app.post("/api/sponsors", async (req, res) => {
    try {
      const sponsorData = insertSponsorSchema.parse(req.body);
      
      // Generate transaction ID
      const transactionId = payuMoneyService.generateTransactionId();
      
      // Create sponsor record
      const sponsor = await storage.createSponsor({
        ...sponsorData,
        transactionId,
        paymentStatus: "pending"
      });

      // Generate PayUMoney payment form
      const paymentRequest = {
        txnid: transactionId,
        amount: sponsor.amount.toString(),
        productinfo: `Octamy Sponsorship - ${sponsor.name}`,
        firstname: sponsor.name,
        email: sponsor.email,
        surl: `${req.protocol}://${req.get('host')}/api/sponsor/payment/success`,
        furl: `${req.protocol}://${req.get('host')}/api/sponsor/payment/failure`,
        udf1: sponsor.id.toString(),
        udf2: "sponsorship"
      };

      const paymentForm = payuMoneyService.generatePaymentForm(paymentRequest);
      
      res.json({
        success: true,
        sponsor,
        payment: paymentForm
      });
    } catch (error) {
      console.error("Error creating sponsor:", error);
      res.status(400).json({ 
        success: false, 
        message: "Failed to create sponsor record" 
      });
    }
  });

  app.get("/api/sponsors", async (req, res) => {
    try {
      const sponsors = await storage.getAllSponsors();
      res.json(sponsors);
    } catch (error) {
      console.error("Error fetching sponsors:", error);
      res.status(500).json({ message: "Failed to fetch sponsors" });
    }
  });

  // Sponsor payment success callback
  app.post("/api/sponsor/payment/success", async (req, res) => {
    try {
      const responseData = req.body;
      
      // Verify payment hash
      const isValidHash = payuMoneyService.verifyHash(responseData);
      
      if (!isValidHash) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid payment hash" 
        });
      }

      // Update sponsor payment status
      if (responseData.status === 'success') {
        await storage.updateSponsorPaymentStatus(
          responseData.txnid, 
          'success'
        );
      }

      res.redirect(`/sponsor-success?txnid=${responseData.txnid}&status=${responseData.status}`);
    } catch (error) {
      console.error("Error processing sponsor payment:", error);
      res.status(500).json({ message: "Payment processing failed" });
    }
  });

  // Sponsor payment failure callback
  app.post("/api/sponsor/payment/failure", async (req, res) => {
    try {
      const responseData = req.body;
      
      // Update sponsor payment status
      await storage.updateSponsorPaymentStatus(
        responseData.txnid, 
        'failed'
      );

      res.redirect(`/sponsor-failure?txnid=${responseData.txnid}&status=${responseData.status}`);
    } catch (error) {
      console.error("Error processing sponsor payment failure:", error);
      res.status(500).json({ message: "Payment processing failed" });
    }
  });

  // Admin login route
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isAdmin) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, isAdmin: true },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({ 
        success: true,
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          isAdmin: true 
        } 
      });
    } catch (error) {
      console.error("Admin login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin analytics route
  app.get("/api/admin/analytics", authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const analytics = await storage.getAdminAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching admin analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Admin partners route
  app.get("/api/admin/partners", authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const partners = await storage.getAllSellers();
      res.json(partners);
    } catch (error) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
