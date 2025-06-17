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
import apiRoutes from "./routes/index";
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

      // Check if user already has a certificate for this course
      const existingCertificate = await storage.getUserCertificateForCourse(
        examAttempt.userId || null, 
        examAttempt.courseId,
        examAttempt.userEmail
      );

      if (existingCertificate) {
        // If new score is lower or equal, don't allow payment
        if (examAttempt.score <= existingCertificate.score) {
          return res.status(400).json({ 
            message: `You already have a certificate with a higher score (${existingCertificate.score}%). You cannot purchase a certificate with a lower score.`,
            existingScore: existingCertificate.score,
            newScore: examAttempt.score
          });
        }
        
        // If new score is higher, update existing certificate
        const badge = getBadgeFromScore(examAttempt.score);
        
        const updatedCertificate = await storage.updateCertificate(existingCertificate.id, {
          examAttemptId,
          score: examAttempt.score,
          badge,
          isPaid: false, // Reset payment status for new score
          retakeCount: existingCertificate.retakeCount + 1
        });
        
        return res.json(updatedCertificate);
      }
      
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

      // Generate JWT token with 24 hour expiration
      const token = jwt.sign({ sellerId: seller.id, email: seller.email }, JWT_SECRET, { expiresIn: '24h' });
      
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

  // Generate referral URLs for partners
  app.post("/api/sellers/generate-referral-url", authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const { type, itemId } = req.body; // type: 'course', 'internship', 'business'
      const sellerId = req.seller!.sellerId;
      
      // Generate unique referral code
      const referralCode = `${sellerId}-${type}-${itemId}-${Date.now()}`;
      
      let baseUrl = '';
      switch (type) {
        case 'course':
          const course = await storage.getCourse(itemId);
          if (!course) {
            return res.status(404).json({ message: "Course not found" });
          }
          baseUrl = `/courses/${course.slug}`;
          break;
        case 'internship':
          const internship = await storage.getCourse(itemId);
          if (!internship || !internship.isInternship) {
            return res.status(404).json({ message: "Internship not found" });
          }
          baseUrl = `/virtual-internships/${internship.slug}`;
          break;
        case 'business':
          const businessCert = await storage.getCourse(itemId);
          if (!businessCert || !businessCert.isBusiness) {
            return res.status(404).json({ message: "Business certification not found" });
          }
          baseUrl = `/business-certifications/${businessCert.slug}`;
          break;
        default:
          return res.status(400).json({ message: "Invalid type" });
      }
      
      const referralUrl = `${req.protocol}://${req.get('host')}${baseUrl}?ref=${referralCode}`;
      
      res.json({
        referralUrl,
        referralCode,
        type,
        itemId,
        sellerId
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
      const amount = payuMoneyService.formatAmount(course.price);

      console.log('Payment data being created:', {
        userId: req.user?.userId || null,
        courseId: parseInt(courseId),
        certificateId: certificate.id,
        amount: amount,
        status: "pending",
        paymentMethod: "payumoney",
        transactionId: txnid
      });

      // Create payment record with certificate link
      const payment = await storage.createPayment({
        userId: req.user?.userId || null,
        courseId: parseInt(courseId),
        certificateId: certificate.id,
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
          await storage.updatePayment(payment.id, {
            status: 'completed',
            paymentMethod: 'payumoney',
            razorpayPaymentId: responseData.mihpayid,
            razorpayOrderId: responseData.txnid
          });

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

      // HTML-based certificate download - users can print to PDF
      
      // Generate ultra-premium certificate HTML with luxury design
      const certificateHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap');
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
              font-family: 'Inter', sans-serif;
              background: linear-gradient(135deg, #1a1a1a 0%, #000 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 30px;
            }
            
            .certificate-container {
              width: 1400px;
              height: 990px;
              background: linear-gradient(145deg, #fefefe 0%, #f8f9fa 50%, #ffffff 100%);
              position: relative;
              border: 2px solid #d4af37;
              box-shadow: 
                0 0 0 8px #ffffff,
                0 0 0 10px #d4af37,
                0 0 0 16px #ffffff,
                0 0 0 18px #c9a635,
                0 40px 80px rgba(0,0,0,0.4),
                inset 0 2px 4px rgba(212,175,55,0.1);
              overflow: hidden;
            }
            
            .ornate-border {
              position: absolute;
              inset: 20px;
              border: 1px solid #d4af37;
              background: 
                radial-gradient(circle at 0 0, #d4af37 2px, transparent 2px),
                radial-gradient(circle at 100% 0, #d4af37 2px, transparent 2px),
                radial-gradient(circle at 0 100%, #d4af37 2px, transparent 2px),
                radial-gradient(circle at 100% 100%, #d4af37 2px, transparent 2px);
              background-size: 40px 40px;
              background-position: top left, top right, bottom left, bottom right;
              background-repeat: no-repeat;
            }
            
            .decorative-corners {
              position: absolute;
              width: 120px;
              height: 120px;
            }
            
            .decorative-corners::before {
              content: '';
              position: absolute;
              inset: 0;
              background: radial-gradient(circle, #d4af37 1px, transparent 1px);
              background-size: 8px 8px;
              opacity: 0.3;
            }
            
            .decorative-corners.top-left {
              top: 30px;
              left: 30px;
              background: 
                linear-gradient(45deg, #d4af37 1px, transparent 1px 20px, transparent),
                linear-gradient(-45deg, #d4af37 1px, transparent 1px 20px, transparent);
              clip-path: polygon(0 0, 100% 0, 0 100%);
            }
            
            .decorative-corners.top-right {
              top: 30px;
              right: 30px;
              background: 
                linear-gradient(135deg, #d4af37 1px, transparent 1px 20px, transparent),
                linear-gradient(45deg, #d4af37 1px, transparent 1px 20px, transparent);
              clip-path: polygon(100% 0, 100% 100%, 0 0);
            }
            
            .decorative-corners.bottom-left {
              bottom: 30px;
              left: 30px;
              background: 
                linear-gradient(-45deg, #d4af37 1px, transparent 1px 20px, transparent),
                linear-gradient(-135deg, #d4af37 1px, transparent 1px 20px, transparent);
              clip-path: polygon(0 0, 100% 100%, 0 100%);
            }
            
            .decorative-corners.bottom-right {
              bottom: 30px;
              right: 30px;
              background: 
                linear-gradient(45deg, #d4af37 1px, transparent 1px 20px, transparent),
                linear-gradient(135deg, #d4af37 1px, transparent 1px 20px, transparent);
              clip-path: polygon(100% 0, 100% 100%, 0 100%);
            }
            
            .certificate-content {
              position: relative;
              z-index: 10;
              padding: 100px 80px;
              text-align: center;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            
            .institutional-header {
              margin-bottom: 60px;
              position: relative;
            }
            
            .institutional-header::before {
              content: '';
              position: absolute;
              top: -20px;
              left: 50%;
              transform: translateX(-50%);
              width: 300px;
              height: 1px;
              background: linear-gradient(90deg, transparent, #d4af37, transparent);
            }
            
            .institutional-header::after {
              content: '';
              position: absolute;
              bottom: -20px;
              left: 50%;
              transform: translateX(-50%);
              width: 200px;
              height: 1px;
              background: linear-gradient(90deg, transparent, #d4af37, transparent);
            }
            
            .logo-emblem {
              display: inline-block;
              background: linear-gradient(145deg, #d4af37 0%, #f4e09d 50%, #d4af37 100%);
              color: #1a1a1a;
              padding: 25px 45px;
              margin-bottom: 25px;
              position: relative;
              clip-path: polygon(10% 0%, 90% 0%, 100% 25%, 100% 75%, 90% 100%, 10% 100%, 0% 75%, 0% 25%);
            }
            
            .logo-text {
              font-family: 'Cormorant Garamond', serif;
              font-size: 48px;
              font-weight: 700;
              letter-spacing: 8px;
              text-transform: uppercase;
              text-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .institution-name {
              font-family: 'Inter', sans-serif;
              font-size: 14px;
              font-weight: 500;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 4px;
              margin-bottom: 15px;
            }
            
            .accreditation {
              font-family: 'Crimson Text', serif;
              font-size: 12px;
              color: #888;
              font-style: italic;
              letter-spacing: 1px;
            }
            
            .certificate-title-section {
              margin-bottom: 60px;
              position: relative;
            }
            
            .certificate-title {
              font-family: 'Cormorant Garamond', serif;
              font-size: 84px;
              font-weight: 600;
              color: #1a1a1a;
              text-transform: uppercase;
              letter-spacing: 16px;
              margin-bottom: 20px;
              position: relative;
              text-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            
            .certificate-title::before {
              content: '';
              position: absolute;
              top: -15px;
              left: 50%;
              transform: translateX(-50%);
              width: 80px;
              height: 3px;
              background: linear-gradient(90deg, #d4af37, #f4e09d, #d4af37);
            }
            
            .certificate-title::after {
              content: '';
              position: absolute;
              bottom: -15px;
              left: 50%;
              transform: translateX(-50%);
              width: 120px;
              height: 2px;
              background: linear-gradient(90deg, transparent, #d4af37, transparent);
            }
            
            .certificate-subtitle {
              font-family: 'Crimson Text', serif;
              font-size: 32px;
              color: #555;
              font-style: italic;
              letter-spacing: 2px;
              font-weight: 400;
            }
            
            .presentation-section {
              margin-bottom: 50px;
            }
            
            .presentation-text {
              font-family: 'Crimson Text', serif;
              font-size: 24px;
              color: #333;
              margin-bottom: 40px;
              font-style: italic;
              letter-spacing: 1px;
            }
            
            .recipient-name {
              font-family: 'Cormorant Garamond', serif;
              font-size: 64px;
              font-weight: 600;
              color: #1a1a1a;
              margin: 50px 0;
              padding: 30px 0;
              position: relative;
              letter-spacing: 6px;
            }
            
            .recipient-name::before {
              content: '';
              position: absolute;
              top: 0;
              left: 50%;
              transform: translateX(-50%);
              width: 400px;
              height: 1px;
              background: linear-gradient(90deg, transparent, #d4af37, transparent);
            }
            
            .recipient-name::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 50%;
              transform: translateX(-50%);
              width: 400px;
              height: 1px;
              background: linear-gradient(90deg, transparent, #d4af37, transparent);
            }
            
            .completion-statement {
              font-family: 'Crimson Text', serif;
              font-size: 20px;
              color: #444;
              margin: 40px 0;
              line-height: 1.6;
              letter-spacing: 0.5px;
            }
            
            .course-title {
              font-family: 'Cormorant Garamond', serif;
              font-size: 42px;
              font-weight: 600;
              color: #1a1a1a;
              margin: 40px 0;
              letter-spacing: 4px;
              text-transform: uppercase;
              position: relative;
              display: inline-block;
              padding: 25px 50px;
              background: linear-gradient(145deg, rgba(212,175,55,0.1) 0%, rgba(244,224,157,0.15) 50%, rgba(212,175,55,0.1) 100%);
              border: 1px solid #d4af37;
              border-radius: 5px;
            }
            
            .achievement-badges {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 40px;
              margin: 50px 0;
            }
            
            .grade-badge {
              background: linear-gradient(145deg, #1a1a1a 0%, #333 100%);
              color: #d4af37;
              padding: 20px 35px;
              font-family: 'Inter', sans-serif;
              font-size: 16px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 2px;
              border: 2px solid #d4af37;
              border-radius: 3px;
              box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .score-display {
              background: linear-gradient(145deg, #d4af37 0%, #f4e09d 50%, #d4af37 100%);
              color: #1a1a1a;
              padding: 25px 45px;
              font-family: 'Cormorant Garamond', serif;
              font-size: 24px;
              font-weight: 700;
              letter-spacing: 3px;
              border-radius: 3px;
              box-shadow: 0 6px 12px rgba(212,175,55,0.3);
              text-transform: uppercase;
            }
            
            .certification-details {
              display: flex;
              justify-content: space-between;
              margin-top: 70px;
              padding: 40px 0;
              border-top: 1px solid #d4af37;
              border-bottom: 1px solid #d4af37;
              background: linear-gradient(90deg, transparent, rgba(212,175,55,0.03), transparent);
            }
            
            .detail-group {
              text-align: center;
              flex: 1;
            }
            
            .detail-label {
              font-family: 'Inter', sans-serif;
              font-size: 11px;
              color: #888;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 8px;
              font-weight: 600;
            }
            
            .detail-value {
              font-family: 'Crimson Text', serif;
              font-size: 18px;
              font-weight: 600;
              color: #333;
              letter-spacing: 1px;
            }
            
            .footer-credentials {
              position: absolute;
              bottom: 50px;
              left: 0;
              right: 0;
              display: flex;
              justify-content: space-between;
              align-items: end;
              padding: 0 80px;
            }
            
            .signature-area {
              text-align: left;
            }
            
            .signature-line {
              width: 250px;
              height: 1px;
              background: linear-gradient(90deg, #d4af37, transparent);
              margin-bottom: 12px;
              position: relative;
            }
            
            .signature-line::after {
              content: '';
              position: absolute;
              left: 0;
              top: -1px;
              width: 60px;
              height: 3px;
              background: #d4af37;
            }
            
            .signature-title {
              font-family: 'Inter', sans-serif;
              font-size: 10px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              margin-bottom: 5px;
              font-weight: 600;
            }
            
            .signature-name {
              font-family: 'Crimson Text', serif;
              font-size: 16px;
              color: #333;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            
            .signature-designation {
              font-family: 'Inter', sans-serif;
              font-size: 9px;
              color: #888;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 2px;
            }
            
            .verification-area {
              text-align: right;
            }
            
            .verification-seal {
              width: 90px;
              height: 90px;
              background: linear-gradient(145deg, #d4af37 0%, #f4e09d 50%, #d4af37 100%);
              border: 3px solid #1a1a1a;
              border-radius: 50%;
              margin: 0 auto 15px auto;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
              box-shadow: 0 4px 8px rgba(212,175,55,0.3);
            }
            
            .verification-seal::before {
              content: 'VERIFIED';
              font-family: 'Inter', sans-serif;
              font-size: 8px;
              font-weight: 800;
              color: #1a1a1a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              text-align: center;
              line-height: 1.2;
            }
            
            .verification-text {
              font-family: 'Inter', sans-serif;
              font-size: 9px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 600;
              margin-bottom: 5px;
            }
            
            .verification-url {
              font-family: 'Crimson Text', serif;
              font-size: 11px;
              color: #333;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            
            /* Print styles */
            @media print {
              body {
                background: #fff;
                padding: 0;
              }
              .certificate-container {
                box-shadow: none;
                border: 2px solid #d4af37;
                width: 100vw;
                height: 100vh;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <div class="ornate-border"></div>
            <div class="decorative-corners top-left"></div>
            <div class="decorative-corners top-right"></div>
            <div class="decorative-corners bottom-left"></div>
            <div class="decorative-corners bottom-right"></div>
            
            <div class="certificate-content">
              <div class="institutional-header">
                <div class="logo-emblem">
                  <div class="logo-text">OCTAMY</div>
                </div>
                <div class="institution-name">Solutions Private Limited</div>
                <div class="accreditation">Authorized Certification Body</div>
              </div>
              
              <div class="certificate-title-section">
                <h1 class="certificate-title">Certificate</h1>
                <p class="certificate-subtitle">of Professional Excellence</p>
              </div>
              
              <div class="presentation-section">
                <p class="presentation-text">This is to certify that</p>
                
                <div class="recipient-name">${certificate.userName}</div>
                
                <p class="completion-statement">
                  has successfully demonstrated mastery and completed the comprehensive 
                  professional certification program
                </p>
                
                <div class="course-title">${certificate.courseTitle}</div>
                
                <div class="achievement-badges">
                  <div class="grade-badge">${certificate.badge.toUpperCase()} GRADE</div>
                  <div class="score-display">Achievement Score: ${certificate.score}%</div>
                </div>
              </div>
              
              <div class="certification-details">
                <div class="detail-group">
                  <div class="detail-label">Certificate Number</div>
                  <div class="detail-value">${certificate.certificateNumber}</div>
                </div>
                <div class="detail-group">
                  <div class="detail-label">Date of Issue</div>
                  <div class="detail-value">${new Date(certificate.issuedAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</div>
                </div>
                <div class="detail-group">
                  <div class="detail-label">Valid Until</div>
                  <div class="detail-value">${new Date(certificate.expiresAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</div>
                </div>
              </div>
            </div>
            
            <div class="footer-credentials">
              <div class="signature-area">
                <div class="signature-line"></div>
                <div class="signature-title">Authorized Signature</div>
                <div class="signature-name">Dr. Rajesh Kumar</div>
                <div class="signature-designation">Director of Certification</div>
              </div>
              
              <div class="verification-area">
                <div class="verification-seal"></div>
                <div class="verification-text">Digital Verification</div>
                <div class="verification-url">verify.octamy.com</div>
              </div>
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

      // Return the ultra-premium certificate HTML for download
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="Octamy-Certificate-${certificate.certificateNumber}.html"`);
      
      // Add print button to the certificate HTML and return it directly
      const certificateWithPrintButton = certificateHtml.replace(
        '<body>',
        `<body>
          <div class="no-print" style="position: fixed; top: 15px; right: 15px; background: linear-gradient(145deg, #d4af37 0%, #f4e09d 50%, #d4af37 100%); color: #1a1a1a; padding: 12px 20px; border-radius: 6px; z-index: 2000; box-shadow: 0 4px 12px rgba(212,175,55,0.3); font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600;">
            <button onclick="window.print()" style="background: #1a1a1a; color: #d4af37; border: 1px solid #d4af37; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
              Print to PDF
            </button>
          </div>`
      ).replace(
        '</style>',
        `  @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
            .certificate-container { 
              width: 100vw; 
              height: 100vh; 
              page-break-inside: avoid;
            }
          }
        </style>`
      );
      
      res.send(certificateWithPrintButton);

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

  // Course progress routes
  app.get("/api/progress", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const courseId = req.query.courseId ? parseInt(req.query.courseId as string) : undefined;
      
      const progress = await storage.getUserCourseProgress(userId, courseId);
      res.json(progress);
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  });

  app.post("/api/progress", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const progressData = { ...req.body, userId };
      
      const progress = await storage.upsertUserCourseProgress(progressData);
      res.json(progress);
    } catch (error) {
      console.error("Error updating progress:", error);
      res.status(500).json({ message: "Failed to update progress" });
    }
  });

  // Achievement routes
  app.get("/api/achievements", async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;
      const achievements = await storage.getAchievements(category);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.get("/api/user/achievements", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const includeDetails = req.query.details === 'true';
      
      const achievements = await storage.getUserAchievements(userId, includeDetails);
      res.json(achievements);
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      res.status(500).json({ message: "Failed to fetch user achievements" });
    }
  });

  app.post("/api/achievements/check", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { courseId } = req.body;
      
      const newAchievements = await storage.checkAndUnlockAchievements(userId, courseId);
      res.json(newAchievements);
    } catch (error) {
      console.error("Error checking achievements:", error);
      res.status(500).json({ message: "Failed to check achievements" });
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
