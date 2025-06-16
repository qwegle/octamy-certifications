import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertExamAttemptSchema, insertCertificateSchema, insertSellerSchema, insertSaleSchema, insertWithdrawalRequestSchema } from "@shared/schema";
import { payuMoneyService } from "./payumoney";
import { getBadgeFromScore, generateCertificateNumber, calculateExpiryDate } from "./utils";
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
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err: any, seller: any) => {
    if (err) return res.sendStatus(403);
    req.seller = seller;
    next();
  });
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

  app.get("/api/courses/slug/:slug", async (req, res) => {
    try {
      const course = await storage.getCourseBySlug(req.params.slug);
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
  app.get("/api/courses/:id/questions", async (req, res) => {
    try {
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
      
      // Store the question mapping in a temporary store (in production, use Redis or similar)
      const sessionId = `session_${Date.now()}_${Math.random()}`;
      (global as any).questionMappings = (global as any).questionMappings || {};
      (global as any).questionMappings[sessionId] = questionsWithShuffledOptions.reduce((acc: any, q) => {
        acc[q.id] = q.correctAnswer;
        return acc;
      }, {});
      
      // Remove correct answers from response
      const questionsWithoutAnswers = questionsWithShuffledOptions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options
      }));
      
      res.json({ questions: questionsWithoutAnswers, sessionId });
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

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
      
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const passed = score >= 50;
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
  app.post("/api/certificates/create", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
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
      
      // Calculate badge based on score
      const badge = getBadgeFromScore(examAttempt.score);
      
      // Generate unique certificate number
      const certificateNumber = generateCertificateNumber();
      
      // Create certificate with badge system and enhanced features
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
        businessName: req.body.businessName || null, // For business certificates
        retakeCount: 0,
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
  app.get("/api/user/certificates", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const certificates = await storage.getUserCertificates(req.user!.userId);
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching user certificates:", error);
      res.status(500).json({ message: "Failed to fetch user certificates" });
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

      // Generate JWT token
      const token = jwt.sign({ sellerId: seller.id, email: seller.email }, JWT_SECRET);
      
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

      const token = jwt.sign({ sellerId: seller.id, email: seller.email }, JWT_SECRET);
      
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
        }
      });
    } catch (error) {
      console.error("Error fetching seller dashboard:", error);
      res.status(500).json({ message: "Failed to fetch dashboard" });
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
      const { certificateId, courseId, userEmail, userName, userPhone, sellerCode } = req.body;

      if (!courseId || isNaN(parseInt(courseId))) {
        return res.status(400).json({ message: "Invalid course ID" });
      }

      if (!certificateId || isNaN(parseInt(certificateId))) {
        return res.status(400).json({ message: "Invalid certificate ID" });
      }

      const course = await storage.getCourse(parseInt(courseId));
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Verify certificate exists
      const certificate = await storage.getCertificate(parseInt(certificateId));
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      const txnid = payuMoneyService.generateTransactionId();
      const amount = payuMoneyService.formatAmount(course.price);

      console.log('Payment data being created:', {
        userId: req.user?.userId || null,
        courseId: parseInt(courseId),
        certificateId: parseInt(certificateId),
        amount: amount,
        status: "pending",
        paymentMethod: "payumoney",
        transactionId: txnid
      });

      // Create payment record with certificate link
      const payment = await storage.createPayment({
        userId: req.user?.userId || null,
        courseId: parseInt(courseId),
        certificateId: parseInt(certificateId),
        amount: amount,
        status: "pending",
        paymentMethod: "payumoney",
        transactionId: txnid
      });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const paymentData = {
        txnid,
        amount,
        productinfo: `${course.title} - Professional Certification`,
        firstname: userName,
        email: userEmail,
        phone: userPhone,
        surl: `${baseUrl}/api/payment/success`,
        furl: `${baseUrl}/api/payment/failure`,
        udf1: courseId,
        udf2: payment.id.toString(),
        udf3: sellerCode || '',
        udf4: req.user?.userId?.toString() || '',
        udf5: ''
      };

      const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

      res.json({
        success: true,
        paymentForm,
        transactionId: txnid,
        amount: amount
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
          const payments = await storage.getAllPayments();
          const payment = payments.find(p => p.transactionId === responseData.txnid);
          if (payment) {
            await storage.updatePayment(payment.id, {
              status: 'completed',
              paymentMethod: 'payumoney',
              razorpayPaymentId: responseData.mihpayid,
              razorpayOrderId: responseData.txnid
            });
          }

          // Handle seller commission if applicable
          if (sellerCode) {
            const seller = await storage.getSellerByEmail(sellerCode);
            if (seller && seller.isApproved) {
              const course = await storage.getCourse(courseId);
              if (course) {
                const commissionAmount = (parseFloat(course.price) * parseFloat(seller.commissionRate)) / 100;
                
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
                await storage.updateSeller(seller.id, {
                  totalEarnings: (currentEarnings + commissionAmount).toString()
                });
              }
            }
          }

          // Send success notification to user if registered
          if (userId) {
            const user = await storage.getUser(userId);
            if (user) {
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

      // HTML-based certificate download - users can print to PDF
      
      // Generate certificate HTML with exact frontend styling
      const certificateHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 40px 20px;
            }
            .certificate-container {
              background: white;
              border-radius: 20px;
              padding: 60px;
              max-width: 800px;
              width: 100%;
              box-shadow: 0 25px 50px rgba(0,0,0,0.15);
              position: relative;
              overflow: hidden;
            }
            .certificate-bg {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(45deg, #f8fafc 0%, #e2e8f0 100%);
              opacity: 0.3;
            }
            .certificate-content {
              position: relative;
              z-index: 2;
              text-align: center;
            }
            .logo {
              font-size: 32px;
              font-weight: 900;
              color: #000;
              margin-bottom: 40px;
              letter-spacing: -1px;
            }
            .certificate-title {
              font-size: 48px;
              font-weight: 800;
              color: #1a202c;
              margin-bottom: 20px;
              line-height: 1.2;
            }
            .certificate-subtitle {
              font-size: 20px;
              color: #4a5568;
              margin-bottom: 40px;
            }
            .recipient-name {
              font-size: 36px;
              font-weight: 700;
              color: #2d3748;
              margin-bottom: 20px;
              border-bottom: 3px solid #000;
              display: inline-block;
              padding-bottom: 10px;
            }
            .course-title {
              font-size: 28px;
              font-weight: 600;
              color: #1a202c;
              margin: 30px 0;
            }
            .score-badge {
              display: inline-block;
              background: ${certificate.badge === 'Excellent' ? '#10b981' : certificate.badge === 'Good' ? '#f59e0b' : '#ef4444'};
              color: white;
              padding: 12px 24px;
              border-radius: 25px;
              font-weight: 700;
              font-size: 18px;
              margin: 20px 0;
            }
            .certificate-details {
              display: flex;
              justify-content: space-between;
              margin-top: 50px;
              padding-top: 30px;
              border-top: 2px solid #e2e8f0;
            }
            .detail-item {
              text-align: center;
            }
            .detail-label {
              font-size: 14px;
              color: #718096;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 5px;
            }
            .detail-value {
              font-size: 16px;
              font-weight: 600;
              color: #2d3748;
            }
            .qr-section {
              position: absolute;
              bottom: 40px;
              right: 40px;
              text-align: center;
            }
            .qr-text {
              font-size: 12px;
              color: #718096;
              margin-top: 10px;
            }
            .signature-section {
              position: absolute;
              bottom: 40px;
              left: 40px;
            }
            .signature-line {
              width: 200px;
              height: 2px;
              background: #000;
              margin-bottom: 5px;
            }
            .signature-text {
              font-size: 14px;
              color: #4a5568;
            }
            .watermark {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-45deg);
              font-size: 120px;
              font-weight: 900;
              color: rgba(0,0,0,0.03);
              z-index: 1;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <div class="certificate-bg"></div>
            <div class="watermark">OCTAMY</div>
            <div class="certificate-content">
              <div class="logo">OCTAMY</div>
              <h1 class="certificate-title">CERTIFICATE</h1>
              <p class="certificate-subtitle">of Achievement</p>
              
              <div class="recipient-name">${certificate.userName}</div>
              
              <p style="font-size: 18px; color: #4a5568; margin: 20px 0;">
                has successfully completed the course
              </p>
              
              <div class="course-title">${certificate.courseTitle}</div>
              
              <div class="score-badge">
                ${certificate.badge} - ${certificate.score}%
              </div>
              
              <div class="certificate-details">
                <div class="detail-item">
                  <div class="detail-label">Certificate ID</div>
                  <div class="detail-value">${certificate.certificateNumber}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Issue Date</div>
                  <div class="detail-value">${new Date(certificate.issuedAt).toLocaleDateString()}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Valid Until</div>
                  <div class="detail-value">${new Date(certificate.expiresAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
            
            <div class="signature-section">
              <div class="signature-line"></div>
              <div class="signature-text">Authorized Signature</div>
            </div>
            
            <div class="qr-section">
              <div style="width: 80px; height: 80px; background: #000; margin: 0 auto;"></div>
              <div class="qr-text">Verify Online</div>
            </div>
          </div>
        </body>
        </html>
      `;

      const options = {
        format: 'A4',
        orientation: 'landscape',
        border: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        },
        quality: '100',
        type: 'pdf'
      };

      // For now, return the HTML content as a simplified certificate
      // Users can use browser's print-to-PDF functionality
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="Octamy-Certificate-${certificate.certificateNumber}.html"`);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Certificate - ${certificate.userName}</title>
          <style>
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
              .certificate-container { 
                width: 100vw; 
                height: 100vh; 
                page-break-inside: avoid;
              }
            }
            ${certificateHtml.match(/<style>(.*?)<\/style>/s)?.[1] || ''}
          </style>
        </head>
        <body>
          <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #000; color: #fff; padding: 10px; border-radius: 5px; z-index: 1000;">
            <button onclick="window.print()" style="background: #fff; color: #000; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
              Print to PDF
            </button>
          </div>
          ${certificateHtml.match(/<body>(.*?)<\/body>/s)?.[1] || certificateHtml}
        </body>
        </html>
      `);

    } catch (error) {
      console.error("Certificate download error:", error);
      res.status(500).json({ message: "Failed to download certificate" });
    }
  });

  // Smart Notifications API endpoints
  
  // Get user notifications
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
      const notificationId = parseInt(req.params.id);
      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true });
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
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Get course recommendations
  app.get("/api/recommendations", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const recommendations = await storage.getUserRecommendations(userId);
      
      // Mark recommendations as shown
      for (const rec of recommendations) {
        await storage.markRecommendationAsShown(rec.id);
      }

      res.json(recommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // Generate course recommendations based on user activity
  app.post("/api/recommendations/generate", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user's completed courses and preferences
      const userCertificates = await storage.getUserCertificates(userId);
      const userPrefs = await storage.getUserPreferences(userId);
      const allCourses = await storage.getCourses();

      // Get completed course IDs
      const completedCourseIds = userCertificates.map(cert => 
        parseInt(cert.certificateId.split('-')[2]) || 0
      ).filter(id => id > 0);

      // Simple recommendation algorithm
      const recommendations = [];
      
      for (const course of allCourses) {
        // Skip if user already completed this course
        if (completedCourseIds.includes(course.id)) continue;

        let score = 0.5; // Base score
        let reason = 'popular';
        const metadata: any = {
          completedCourseIds,
          categoryMatch: false,
          skillLevelMatch: false
        };

        // Category-based recommendations
        if (userPrefs?.preferredCategories?.includes(course.category.name)) {
          score += 0.3;
          reason = 'based_on_category';
          metadata.categoryMatch = true;
        }

        // Skill level matching
        if (userPrefs?.skillLevel === course.level) {
          score += 0.2;
          metadata.skillLevelMatch = true;
        }

        // Popular courses get higher score
        if (course.isActive) {
          score += 0.1;
        }

        // Create recommendation if score is above threshold
        if (score >= 0.6) {
          await storage.createCourseRecommendation({
            userId,
            courseId: course.id,
            reason,
            score: score.toString(),
            metadata
          });
          recommendations.push({
            courseId: course.id,
            score,
            reason,
            course
          });
        }
      }

      res.json({
        success: true,
        recommendationsGenerated: recommendations.length,
        recommendations: recommendations.slice(0, 5) // Return top 5
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // Track user activity
  app.post("/api/activity", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { activityType, entityId, entityType, metadata } = req.body;

      if (userId) {
        await storage.recordUserActivity({
          userId,
          activityType,
          entityId: entityId ? parseInt(entityId) : undefined,
          entityType,
          metadata
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error recording activity:", error);
      res.status(500).json({ message: "Failed to record activity" });
    }
  });

  // Get/Update user preferences
  app.get("/api/preferences", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let preferences = await storage.getUserPreferences(userId);
      
      // Create default preferences if none exist
      if (!preferences) {
        preferences = await storage.createUserPreferences({
          userId,
          preferredCategories: [],
          skillLevel: 'novice',
          learningGoals: [],
          notificationSettings: {
            email: true,
            push: true,
            frequency: 'weekly',
            courseRecommendations: true,
            newCourses: true,
            achievements: true
          }
        });
      }

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.put("/api/preferences", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const updates = req.body;
      const preferences = await storage.updateUserPreferences(userId, updates);
      res.json(preferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
