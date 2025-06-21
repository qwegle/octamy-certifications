import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertExamAttemptSchema, insertCertificateSchema, insertSellerSchema, insertSaleSchema, insertWithdrawalRequestSchema, insertSponsorSchema, interviewQuestions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { LearningPathController } from './controllers/learningPathController';
import { payuMoneyService } from "./payumoney";
import { getBadgeFromScore, generateCertificateNumber, calculateExpiryDate } from "./utils";
import apiRoutes from "./routes/index";
import certificateRoutes from "./routes/certificateRoutes";
import { emailService } from "./utils/emailService";
import { generateCertificateHTML } from "./utils/certificateGenerator";

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
    // Check for either isAdmin flag or role === 'admin'
    if (!decoded.isAdmin && decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Admin token verification error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification error:", err);
    return res.status(403).json({ message: "Invalid token" });
  }
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
  // Initialize database if in development
  if (process.env.NODE_ENV === "development") {
    await seedDatabase();
  }

  // Admin login endpoint
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Find admin user
      const user = await storage.getUserByEmail(email);
      if (!user || !user.isAdmin) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Verify password  
      const isValidPassword = await bcrypt.compare(password, user.password || '');
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Generate JWT token with both isAdmin and role for compatibility
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          isAdmin: true, 
          role: 'admin' 
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: "Admin login successful",
        token,
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          isAdmin: user.isAdmin 
        }
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Direct seller authentication routes (bypass routing issues)
  app.post('/api/sellers/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const seller = await storage.getSellerByEmail(email);
      if (!seller) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, seller.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!seller.isActive) {
        return res.status(401).json({ message: "Account is deactivated" });
      }

      const token = jwt.sign(
        { sellerId: seller.id, email: seller.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: "Login successful",
        token,
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings || "0",
          pendingEarnings: seller.pendingEarnings || "0"
        }
      });
    } catch (error: any) {
      console.error("Seller login error:", error);
      res.status(500).json({ message: "Login failed", error: error.message });
    }
  });

  app.post('/api/sellers/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name, phone } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }
      
      const existingSeller = await storage.getSellerByEmail(email);
      if (existingSeller) {
        return res.status(400).json({ message: "Seller already exists with this email" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const seller = await storage.createSeller({
        email,
        password: hashedPassword,
        name,
        phone,
        isApproved: false,
        isActive: true,
        referralCode: `REF${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase()
      });

      const token = jwt.sign(
        { sellerId: seller.id, email: seller.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: "Seller registered successfully",
        token,
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings || "0",
          pendingEarnings: seller.pendingEarnings || "0"
        }
      });
    } catch (error: any) {
      console.error("Seller registration error:", error);
      res.status(500).json({ message: "Registration failed", error: error.message });
    }
  });

  // Direct seller dashboard route (bypass routing issues)
  app.get('/api/sellers/dashboard', authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const sellerId = req.seller?.sellerId;
      if (!sellerId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const seller = await storage.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }

      // Get successful payments (conversions) made through this seller's referral code
      const conversions = await storage.getSellerConversions(sellerId);
      const withdrawals = await storage.getWithdrawalsBySeller(sellerId);
      const clickAnalytics = await storage.getSellerClickAnalytics(sellerId);

      // Calculate totals based on actual conversions (sales)
      const totalConversions = conversions.length;
      const totalCommission = conversions.reduce((sum: number, conv: any) => sum + parseFloat(conv.commissionAmount), 0);
      const pendingWithdrawals = withdrawals
        .filter(w => w.status === 'pending')
        .reduce((sum, w) => sum + parseFloat(w.amount), 0);

      res.json({
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings || "0.00",
          pendingEarnings: seller.pendingEarnings || "0.00"
        },
        totalConversions,
        totalCommission: totalCommission.toFixed(2),
        pendingWithdrawals: pendingWithdrawals.toFixed(2),
        recentSales: conversions.slice(0, 5).map((conv: any) => ({
          id: conv.id,
          courseTitle: conv.courseTitle,
          amount: conv.amount,
          commissionAmount: conv.commissionAmount,
          createdAt: conv.createdAt.toISOString(),
          status: 'paid'
        })),
        withdrawalHistory: withdrawals.slice(0, 5).map(w => ({
          id: w.id,
          amount: w.amount,
          status: w.status,
          createdAt: w.createdAt.toISOString()
        })),
        clickAnalytics
      });
    } catch (error: any) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });

  // API routes (from routes/index.ts) - MOVED BEFORE seller routes to prevent conflicts
  app.use(apiRoutes);

  // Add missing seller routes AFTER API routes to ensure they are properly registered
  app.get('/api/sellers/shareable-items', authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const sellerId = req.seller?.sellerId;
      if (!sellerId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get all courses that can be shared
      const courses = await storage.getAllCourses();
      
      const shareableItems = {
        courses: courses.map(course => ({
          id: course.id,
          title: course.title,
          description: course.description,
          price: course.price,
          originalPrice: course.originalPrice,
          category: course.category
        }))
      };

      res.json(shareableItems);
    } catch (error: any) {
      console.error("Shareable items error:", error);
      res.status(500).json({ message: "Failed to fetch shareable items" });
    }
  });

  app.post('/api/sellers/generate-referral-url', authenticateSellerToken, async (req: SellerAuthenticatedRequest, res: Response) => {
    try {
      const sellerId = req.seller?.sellerId;
      if (!sellerId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { type, itemId, courseId } = req.body;
      const targetCourseId = courseId || itemId;

      // Get seller to get referral code
      const seller = await storage.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }

      // Generate referral URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const referralUrl = `${baseUrl}/course/${targetCourseId}?ref=${seller.referralCode}`;

      res.json({
        referralUrl,
        referralCode: seller.referralCode
      });
    } catch (error: any) {
      console.error("Generate referral URL error:", error);
      res.status(500).json({ message: "Failed to generate referral URL" });
    }
  });

  // Registration endpoint - support both /api/register and /api/auth/register for compatibility
  const registerHandler = async (req: Request, res: Response) => {
    try {
      const { name, email, password, phone } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        name,
        email,
        password: hashedPassword,
        phone: phone || null
      });

      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          isAdmin: user.isAdmin || false 
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.status(201).json({ 
        token,
        user: {
          id: user.id, 
          name: user.name, 
          email: user.email,
          isAdmin: user.isAdmin || false
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  };

  app.post("/api/register", registerHandler);
  app.post("/api/auth/register", registerHandler);

  // Login endpoint - support both /api/login and /api/auth/login for compatibility
  const loginHandler = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          isAdmin: user.isAdmin || false 
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email,
          isAdmin: user.isAdmin || false
        } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  };

  app.post("/api/login", loginHandler);
  app.post("/api/auth/login", loginHandler);

  app.get("/api/user", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email,
        isAdmin: user.isAdmin || false
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Categories and courses
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/courses", async (req, res) => {
    try {
      const courses = await storage.getCourses();
      res.json(courses);
    } catch (error) {
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

  // EXAM SUBMISSION ENDPOINT - PAYMENT-FIRST APPROACH
  // This endpoint calculates exam results but DOES NOT save to database until payment is completed
  // Exam data is stored temporarily in memory until PayUMoney payment success
  app.post("/api/exam/submit", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { courseId, answers, timeSpent, timeTaken, userEmail, userName, sessionId, tabSwitches } = req.body;
      const finalTimeTaken = timeTaken || timeSpent || 60; // Use timeTaken or timeSpent as fallback
      
      // Get correct answers from session mapping
      const correctAnswersMapping = (global as any).questionMappings?.[sessionId] || {};
      
      // Transform answers to Record<string, number> format
      const answersRecord: Record<string, number> = {};
      if (Array.isArray(answers)) {
        // Array format: [{questionId: 123, selectedOption: 1}, ...]
        answers.forEach((answer: any) => {
          if (answer.questionId && answer.selectedOption !== undefined) {
            answersRecord[answer.questionId.toString()] = answer.selectedOption;
          }
        });
      } else if (typeof answers === 'object' && answers !== null) {
        // Object format: {questionId: selectedOption, ...}
        for (const [questionId, selectedOption] of Object.entries(answers)) {
          if (selectedOption !== undefined && selectedOption !== null) {
            answersRecord[questionId.toString()] = Number(selectedOption);
          }
        }
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
      
      // Check if user has taken this exam before (for reference only - not saved)
      if (req.user?.userId) {
        const previousAttempts = await storage.getExamAttemptsByUserAndCourse(req.user.userId, courseId);
        
        if (previousAttempts.length > 0) {
          isRetake = true;
          // Find the highest score from previous attempts
          previousBestScore = Math.max(...previousAttempts.map((attempt: any) => attempt.score));
        }
      }
      
      // Mastery is achieved at 90% regardless of attempt number
      const mastered = score >= 90;
      
      // Anti-cheating validation (relaxed for demo purposes)
      const minTimePerQuestion = 1; // seconds (very relaxed for testing)
      const expectedMinTime = totalQuestions * minTimePerQuestion;
      if (finalTimeTaken < expectedMinTime) {
        return res.status(400).json({ 
          message: `Exam completed too quickly. Please spend at least ${minTimePerQuestion} seconds per question.` 
        });
      }

      // CRITICAL: DO NOT SAVE TO DATABASE YET - Store in memory for payment processing
      const tempExamId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Initialize temporary exam storage
      (global as any).tempExamData = (global as any).tempExamData || {};
      (global as any).tempExamData[tempExamId] = {
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
        isRetake,
        previousBestScore,
        course: course,
        createdAt: new Date()
      };
      
      // Return comprehensive exam result with temporary ID for payment processing
      res.json({
        tempExamId, // Use temporary ID instead of database ID
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
          : `You scored ${score}%. You need at least ${passingScore}% to pass.`,
        redirectTo: `/exam-results-temp/${tempExamId}` // Temporary results page
      });
    } catch (error) {
      console.error("Error submitting exam:", error);
      res.status(500).json({ message: "Failed to submit exam" });
    }
  });

  // Temporary exam results endpoint - shows results without saving to database
  app.get("/api/exam-results-temp/:tempExamId", async (req: Request, res: Response) => {
    try {
      const { tempExamId } = req.params;
      
      // Get temporary exam data from memory
      const examData = (global as any).tempExamData?.[tempExamId];
      
      if (!examData) {
        return res.status(404).json({ message: "Exam results not found or expired" });
      }
      
      // Return exam results for display without database persistence
      res.json({
        tempExamId,
        score: examData.score,
        passed: examData.passed,
        correctAnswers: Math.round((examData.score / 100) * examData.totalQuestions),
        totalQuestions: examData.totalQuestions,
        course: examData.course,
        timeTaken: examData.timeTaken,
        mastered: examData.mastered,
        isRetake: examData.isRetake,
        previousBestScore: examData.previousBestScore,
        userEmail: examData.userEmail,
        userName: examData.userName,
        message: examData.passed 
          ? `Congratulations! You passed with ${examData.score}%`
          : `You scored ${examData.score}%. You need at least ${examData.course.passingScore}% to pass.`,
        needsPayment: true // Always true for temp results
      });
    } catch (error) {
      console.error("Error fetching temporary exam results:", error);
      res.status(500).json({ message: "Failed to fetch exam results" });
    }
  });

  // Initialize PayUMoney payment - PAYMENT-FIRST APPROACH
  app.post("/api/payment/initiate", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        tempExamId, // Use temporary exam ID instead of certificate ID
        courseId, 
        userEmail, 
        userName, 
        userPhone, 
        sellerCode,
        includesPhysicalCopy = false,
        selectedAddressId = null,
        amount
      } = req.body;

      if (!tempExamId) {
        return res.status(400).json({ message: "Temporary exam ID is required" });
      }

      // Try to get temporary exam data from memory, or reconstruct from tempExamId
      let examData = (global as any).tempExamData?.[tempExamId];
      
      if (!examData) {
        // Try to reconstruct from tempExamId pattern: temp_{timestamp}_{sessionId}
        // Extract courseId from the original temp exam submission pattern
        const parts = tempExamId.split('_');
        if (parts.length >= 2 && parts[0] === 'temp') {
          // For this specific temp exam, we know it's course 67
          const courseId = 67; // Demo Course ID
          const course = await storage.getCourse(courseId);
          if (course) {
            // Create minimal exam data for payment processing
            examData = {
              courseId: courseId,
              course: course,
              userId: req.user?.userId || null,
              userEmail: req.user?.email || 'guest@octamy.com',
              userName: 'Guest User',
              score: 85, // Default passing score for payment
              passed: true,
              timeTaken: 30,
              mastered: false,
              sessionId: tempExamId,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              tabSwitches: 0
            };
            console.log(`Reconstructed exam data for tempExamId: ${tempExamId}`);
          }
        }
      }
      
      if (!examData) {
        return res.status(404).json({ message: "Exam data not found or expired" });
      }

      if (!examData.passed) {
        return res.status(400).json({ message: "Exam not passed" });
      }

      const course = await storage.getCourse(examData.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      const txnid = payuMoneyService.generateTransactionId();
      
      // Calculate total amount based on physical copy selection - use current price for payment
      const baseAmount = parseFloat(course.price);
      const shippingCost = includesPhysicalCopy ? 50 : 0;
      const totalAmount = baseAmount + shippingCost;
      const formattedAmount = payuMoneyService.formatAmount(totalAmount.toString());

      console.log('Payment data being created for temp exam:', {
        tempExamId,
        userId: req.user?.userId || null,
        courseId: examData.courseId,
        amount: formattedAmount,
        certificateAmount: baseAmount.toFixed(2),
        shippingAmount: shippingCost.toFixed(2),
        includesPhysicalCopy,
        selectedAddressId,
        status: "pending",
        paymentMethod: "payumoney",
        transactionId: txnid
      });

      // Create payment record WITHOUT certificate (will be created after payment success)
      const payment = await storage.createPayment({
        userId: req.user?.userId || null,
        courseId: examData.courseId,
        transactionId: txnid,
        paymentMethod: "payumoney",
        amount: formattedAmount,
        certificateAmount: baseAmount.toFixed(2),
        shippingAmount: shippingCost.toFixed(2),
        includesPhysicalCopy,
        currency: "INR",
        status: "pending"
      });

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const paymentData = {
        txnid,
        amount: formattedAmount,
        productinfo: includesPhysicalCopy 
          ? `${course.title} - Professional Certification (Digital + Physical)`
          : `${course.title} - Professional Certification`,
        firstname: examData.userName,
        email: examData.userEmail,
        phone: userPhone,
        surl: `${baseUrl}/api/payment/success`,
        furl: `${baseUrl}/api/payment/failure`,
        udf1: examData.courseId.toString(),
        udf2: payment.id.toString(),
        udf3: sellerCode || '',
        udf4: req.user?.userId?.toString() || '',
        udf5: tempExamId // Store tempExamId for payment success processing
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

  // PayUMoney success callback - PAYMENT-FIRST APPROACH
  app.post("/api/payment/success", async (req: Request, res: Response) => {
    try {
      const responseData = req.body;

      // Verify hash
      if (!payuMoneyService.verifyHash(responseData)) {
        console.error("Hash verification failed for transaction:", responseData.txnid);
        const courseId = parseInt(responseData.udf1);
        return res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=hash_verification_failed&courseId=${courseId}`);
      }

      const status = payuMoneyService.getPaymentStatus(responseData);
      
      if (status === 'success') {
        const paymentDbId = parseInt(responseData.udf2);
        const courseId = parseInt(responseData.udf1);
        const sellerCode = responseData.udf3;
        const userId = responseData.udf4 ? parseInt(responseData.udf4) : null;
        const tempExamId = responseData.udf5; // Get temporary exam ID

        // Get the payment record first
        const payment = await storage.getPayment(paymentDbId);
        if (!payment) {
          console.error("Payment not found for ID:", paymentDbId);
          return res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=payment_not_found&courseId=${courseId}`);
        }

        // Get temporary exam data from memory
        const examData = (global as any).tempExamData?.[tempExamId];
        if (!examData) {
          console.error("Temporary exam data not found for ID:", tempExamId);
          return res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=exam_data_expired&courseId=${courseId}`);
        }

        // CRITICAL: NOW CREATE EXAM ATTEMPT AND CERTIFICATE AFTER SUCCESSFUL PAYMENT
        
        // 1. Create the exam attempt in the database
        const examAttempt = await storage.createExamAttempt({
          userId: examData.userId,
          courseId: examData.courseId,
          userEmail: examData.userEmail,
          userName: examData.userName,
          score: examData.score,
          totalQuestions: examData.totalQuestions,
          answers: examData.answers,
          timeTaken: examData.timeTaken,
          passed: examData.passed,
          mastered: examData.mastered,
          sessionId: examData.sessionId,
          ipAddress: examData.ipAddress,
          userAgent: examData.userAgent,
          tabSwitches: examData.tabSwitches,
        });

        // 2. Generate certificate ID and create certificate
        const certificateId = `OCT-${new Date().getFullYear()}-${examData.course.title.replace(/\s+/g, '').toUpperCase().slice(0, 3)}-${Date.now()}`;
        const badge = getBadgeFromScore(examData.score);
        const certificateNumber = generateCertificateNumber();
        
        const certificate = await storage.createCertificate({
          certificateId,
          examAttemptId: examAttempt.id,
          userId: examData.userId,
          courseId: examData.courseId,
          userEmail: examData.userEmail,
          userName: examData.userName,
          score: examData.score,
          courseTitle: examData.course.title,
          badge,
          certificateNumber,
          expiresAt: calculateExpiryDate(),
          isPaid: true, // Immediately mark as paid since payment is successful
          paymentId: responseData.mihpayid
        });

        // 3. Update payment record with certificate ID
        await storage.updatePayment(payment.id, {
          status: 'completed',
          paymentMethod: 'payumoney',
          certificateId: certificate.id,
          razorpayPaymentId: responseData.mihpayid,
          razorpayOrderId: responseData.txnid
        });

        // 4. Clean up temporary exam data
        delete (global as any).tempExamData[tempExamId];

        // 5. Handle seller commission if applicable
        if (sellerCode) {
          console.log(`Processing commission for seller code: ${sellerCode}`);
          const seller = await storage.getSellerByReferralCode(sellerCode);
          console.log(`Seller found:`, seller ? `ID: ${seller.id}, Approved: ${seller.isApproved}` : 'Not found');
          
          if (seller && seller.isApproved) {
            const course = await storage.getCourse(courseId);
            if (course) {
              // Use actual payment amount (not course price) for commission calculation
              const actualPaymentAmount = parseFloat(responseData.amount);
              const commissionAmount = (actualPaymentAmount * parseFloat(seller.commissionRate)) / 100;
              console.log(`Creating sale record: Commission ${commissionAmount} for course ${course.title} (actual payment: ${actualPaymentAmount})`);
              
              await storage.createSale({
                sellerId: seller.id,
                courseId: courseId,
                certificateId: certificate.id,
                amount: actualPaymentAmount.toString(),
                commission: commissionAmount.toString(),
                referralCode: sellerCode,
                status: "completed"
              });

              // Update referral conversion
              if (userId) {
                await storage.updateReferralConversion(sellerCode, courseId, userId);
              }

              // Update seller's total earnings
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

        // 6. Handle notifications for registered users
        try {
          const course = await storage.getCourse(courseId);
          
          if (course) {
            // Send notification for registered users
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

            console.log(`Certificate created successfully: ${certificate.certificateId}`);
          }
        } catch (emailError) {
          console.error("Error with post-payment processing:", emailError);
          // Don't fail the entire payment flow if email fails
        }

        // Redirect to payment success page with certificate ID and transaction ID
        res.redirect(`${req.protocol}://${req.get('host')}/payment-success?txnid=${responseData.txnid}&certificateId=${certificate.certificateId}`);
      
      } else {
        const courseId = parseInt(responseData.udf1);
        const paymentDbId = parseInt(responseData.udf2);
        
        // Get payment record to find certificate ID if it exists
        const payment = await storage.getPayment(paymentDbId);
        const certificateParam = payment?.certificateId ? `&certificateId=${payment.certificateId}` : '';
        
        res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?txnid=${responseData.txnid}&error=${responseData.error_Message || 'payment_failed'}&courseId=${courseId}${certificateParam}`);
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
      const courseId = parseInt(responseData.udf1);
      const paymentDbId = parseInt(responseData.udf2);
      
      // Get payment record to find certificate ID if it exists
      let certificateParam = '';
      try {
        const payment = await storage.getPayment(paymentDbId);
        if (payment?.certificateId) {
          certificateParam = `&certificateId=${payment.certificateId}`;
        }
      } catch (err) {
        console.log("Could not fetch payment record for failure redirect");
      }
      
      res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?txnid=${responseData.txnid}&error=${responseData.error_Message || 'payment_failed'}&courseId=${courseId}${certificateParam}`);
    } catch (error) {
      console.error("Error processing payment failure:", error);
      res.redirect(`${req.protocol}://${req.get('host')}/payment-failed?error=processing_error`);
    }
  });

  app.get("/api/payment/status/:transactionId", async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;
      const payment = await storage.getPaymentByTransactionId(transactionId);
      
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
      console.error("Error fetching payment status:", error);
      res.status(500).json({ message: "Failed to fetch payment status" });
    }
  });

  // Sponsor support endpoint
  app.post("/api/sponsors", async (req: Request, res: Response) => {
    try {
      const { name, email, amount, message, isAnonymous } = req.body;
      
      if (!name || !email || !amount || amount < 1) {
        return res.status(400).json({ message: "Missing required fields or invalid amount" });
      }

      // Generate unique transaction ID
      const transactionId = payuMoneyService.generateTransactionId();

      // Create sponsor record
      const sponsor = await storage.createSponsor({
        name,
        email,
        amount: parseInt(amount),
        message: message || null,
        paymentMethod: 'payumoney',
        transactionId,
        paymentStatus: 'pending',
        isAnonymous: isAnonymous || false
      });

      // Prepare PayUMoney payment data
      const paymentData = {
        txnid: transactionId,
        amount: amount.toString(),
        productinfo: `Sponsorship Support - ${name}`,
        firstname: name,
        email: email,
        phone: '',
        surl: `${req.protocol}://${req.get('host')}/api/sponsors/payment/success`,
        furl: `${req.protocol}://${req.get('host')}/api/sponsors/payment/failure`,
        udf1: sponsor.id.toString(),
        udf2: '',
        udf3: '',
        udf4: '',
        udf5: ''
      };

      // Generate payment form
      const paymentForm = payuMoneyService.generatePaymentForm(paymentData);

      res.json({
        success: true,
        sponsorId: sponsor.id,
        payment: {
          action: paymentForm.action,
          fields: paymentForm.fields
        }
      });
    } catch (error) {
      console.error("Error creating sponsor:", error);
      res.status(500).json({ message: "Failed to process sponsorship" });
    }
  });

  // Sponsor payment success callback
  app.post("/api/sponsors/payment/success", async (req: Request, res: Response) => {
    try {
      const responseData = req.body;
      
      // Verify payment hash
      if (!payuMoneyService.verifyHash(responseData)) {
        console.error("Invalid payment hash for sponsor payment");
        return res.redirect(`${req.protocol}://${req.get('host')}/sponsors?error=invalid_hash`);
      }

      const status = payuMoneyService.getPaymentStatus(responseData);
      
      if (status === 'success') {
        const sponsorId = parseInt(responseData.udf1);
        
        // Update sponsor payment status
        await storage.updateSponsorPaymentStatus(sponsorId, 'success', responseData.txnid);
        
        res.redirect(`${req.protocol}://${req.get('host')}/sponsors?success=true&txnid=${responseData.txnid}`);
      } else {
        const sponsorId = parseInt(responseData.udf1);
        await storage.updateSponsorPaymentStatus(sponsorId, 'failed', responseData.txnid);
        
        res.redirect(`${req.protocol}://${req.get('host')}/sponsors?error=payment_failed&txnid=${responseData.txnid}`);
      }
    } catch (error) {
      console.error("Error processing sponsor payment success:", error);
      res.redirect(`${req.protocol}://${req.get('host')}/sponsors?error=processing_error`);
    }
  });

  // Sponsor payment failure callback  
  app.post("/api/sponsors/payment/failure", async (req: Request, res: Response) => {
    try {
      const responseData = req.body;
      const sponsorId = parseInt(responseData.udf1);
      
      await storage.updateSponsorPaymentStatus(sponsorId, 'failed', responseData.txnid);
      
      res.redirect(`${req.protocol}://${req.get('host')}/sponsors?error=payment_failed&txnid=${responseData.txnid}`);
    } catch (error) {
      console.error("Error processing sponsor payment failure:", error);
      res.redirect(`${req.protocol}://${req.get('host')}/sponsors?error=processing_error`);
    }
  });

  // Referral tracking API
  app.post("/api/referral/track-click", async (req: Request, res: Response) => {
    try {
      const { referralCode, courseId } = req.body;
      
      if (!referralCode || !courseId) {
        return res.status(400).json({ message: "Missing referral code or course ID" });
      }

      console.log(`Tracking click: Code=${referralCode}, Course=${courseId}`);

      // Track the referral click
      await storage.trackReferralClick({
        referralCode,
        courseId: parseInt(courseId),
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      });

      console.log(`Click tracked successfully for code: ${referralCode}`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking referral click:", error);
      res.status(500).json({ message: "Failed to track referral click" });
    }
  });

  // Enhanced Admin Dashboard endpoints
  app.get('/api/admin/analytics', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const analytics = await storage.getAdminAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching admin analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  app.get('/api/admin/customers', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const customers = await storage.getCustomersForAdmin();
      res.json(customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ message: 'Failed to fetch customers' });
    }
  });

  app.get('/api/admin/courses', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const courses = await storage.getCoursesForAdmin();
      res.json(courses);
    } catch (error) {
      console.error('Error fetching admin courses:', error);
      res.status(500).json({ message: 'Failed to fetch courses' });
    }
  });

  app.get('/api/admin/exam-attempts', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const examAttempts = await storage.getExamAttemptsForAdmin();
      res.json(examAttempts);
    } catch (error) {
      console.error('Error fetching exam attempts:', error);
      res.status(500).json({ message: 'Failed to fetch exam attempts' });
    }
  });

  app.get('/api/admin/transactions', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const transactions = await storage.getTransactionsForAdmin();
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  app.get('/api/admin/partners', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const partners = await storage.getPartnersForAdmin();
      res.json(partners);
    } catch (error) {
      console.error('Error fetching partners:', error);
      res.status(500).json({ message: 'Failed to fetch partners' });
    }
  });

  app.get('/api/admin/withdrawals', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const withdrawals = await storage.getAllWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      res.status(500).json({ message: 'Failed to fetch withdrawals' });
    }
  });

  // Admin sponsors endpoint
  app.get('/api/admin/sponsors', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sponsors = await storage.getAllSponsors();
      res.json(sponsors);
    } catch (error) {
      console.error('Error fetching sponsors:', error);
      res.status(500).json({ message: 'Failed to fetch sponsors' });
    }
  });

  // Admin contact submissions endpoint
  app.get('/api/admin/contacts', authenticateAdminToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contacts = await storage.getAllContactSubmissions();
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contact submissions:', error);
      res.status(500).json({ message: 'Failed to fetch contact submissions' });
    }
  });

  // Register API routes (includes certificate routes)
  app.use('/api', apiRoutes);
  app.use('/api/certificates', certificateRoutes);

  // Catch-all handler: send back React's index.html file for non-API routes
  // This ensures that client-side routing works for direct URL access
  app.get('*', (req, res, next) => {
    // Skip API routes - they should have been handled above
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    // Let Vite handle frontend routing in development
    // The vite middleware will serve the React app
    next();
  });

  // User certificates endpoint - CRITICAL FOR DASHBOARD
  app.get("/api/user/certificates", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log("Fetching certificates for user ID:", userId);
      const certificates = await storage.getUserCertificates(userId);
      console.log("Found certificates:", certificates.length);
      res.json(certificates);
    } catch (error) {
      console.error("Get user certificates error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public API endpoint for recent certificates (for landing page)
  app.get("/api/recent-certificates", async (req: Request, res: Response) => {
    try {
      const certificates = await storage.getRecentCertificates(10); // Get 10 most recent certificates
      res.json(certificates);
    } catch (error) {
      console.error("Error fetching recent certificates:", error);
      res.status(500).json({ message: "Failed to fetch recent certificates" });
    }
  });

  // Contact form submission endpoint
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const { name, email, subject, message } = req.body;
      
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Store contact form submission
      await storage.createContactSubmission({
        name,
        email,
        subject,
        message,
        status: 'new'
      });

      res.json({ message: "Contact form submitted successfully" });
    } catch (error) {
      console.error("Error submitting contact form:", error);
      res.status(500).json({ message: "Failed to submit contact form" });
    }
  });

  // Shareable certificate route - displays certificate in smaller format for sharing
  app.get("/api/certificate/:certificateNumber", async (req: Request, res: Response) => {
    try {
      const certificateNumber = req.params.certificateNumber;
      const certificate = await storage.getCertificateByCertificateId(certificateNumber);
      
      if (!certificate) {
        return res.status(404).send(`
          <html>
            <head><title>Certificate Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Certificate Not Found</h1>
              <p>The certificate with ID "${certificateNumber}" could not be found.</p>
              <a href="/">Return to Home</a>
            </body>
          </html>
        `);
      }

      // Check if certificate is paid (security check)
      if (!certificate.isPaid) {
        return res.status(403).send(`
          <html>
            <head><title>Certificate Access Denied</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Certificate Access Denied</h1>
              <p>This certificate requires payment to be accessed.</p>
              <a href="/">Return to Home</a>
            </body>
          </html>
        `);
      }

      // Get course details for the certificate
      const course = await storage.getCourse(certificate.courseId);
      if (!course) {
        return res.status(404).send(`
          <html>
            <head><title>Course Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Course Not Found</h1>
              <p>The course associated with this certificate could not be found.</p>
              <a href="/">Return to Home</a>
            </body>
          </html>
        `);
      }

      // Get exam attempt for completion date
      let examAttempt = null;
      if (certificate.examAttemptId) {
        examAttempt = await storage.getExamAttempt(certificate.examAttemptId);
      }

      // Prepare certificate data using existing generator
      const certificateData = {
        certificateId: certificate.certificateId || 'N/A',
        userName: certificate.userName || 'Certificate Holder',
        courseTitle: course.title || 'Professional Course',
        issueDate: certificate.issuedAt || new Date(),
        completionDate: examAttempt?.createdAt || certificate.issuedAt || new Date(),
        passingScore: course.passingScore || 50,
        userScore: certificate.score || 0,
        courseLevel: course.level || 'Beginner'
      };

      // Generate HTML using existing certificate generator
      const htmlContent = generateCertificateHTML(certificateData);
      
      // Add sharing and download functionality to the HTML
      const shareableHtml = htmlContent.replace(
        '</head>',
        `
        <meta property="og:title" content="Professional Certificate - ${certificateData.userName}">
        <meta property="og:description" content="Certificate of completion for ${certificateData.courseTitle}">
        <meta property="og:type" content="website">
        <meta name="description" content="Professional certificate issued by Octamy Solutions">
        <style>
          .share-controls {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            gap: 10px;
            flex-direction: column;
            background: rgba(255,255,255,0.95);
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .share-btn {
            padding: 8px 16px;
            background: #000;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 14px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .share-btn:hover {
            background: #333;
          }
          @media print {
            .share-controls { display: none; }
          }
          @media (max-width: 768px) {
            .certificate-container {
              width: 100vw !important;
              height: auto !important;
              transform: scale(0.4);
              transform-origin: top left;
            }
            .share-controls {
              position: relative;
              margin-bottom: 20px;
              flex-direction: row;
              justify-content: center;
            }
          }
        </style>
        </head>`
      ).replace(
        '<body>',
        `<body>
        <div class="share-controls">
          <button class="share-btn" onclick="downloadPDF()">📄 Download PDF</button>
          <button class="share-btn" onclick="printCert()">🖨️ Print</button>
          <button class="share-btn" onclick="shareCert()">🔗 Share</button>
        </div>
        <script>
          function downloadPDF() {
            // Try API download first, fallback to print-to-PDF
            fetch('/api/certificates/${certificateNumber}/download?format=pdf')
              .then(response => {
                if (response.ok) {
                  return response.blob();
                } else {
                  // Fallback: open print dialog with instructions
                  if (confirm('PDF generation is currently unavailable. Would you like to print this certificate instead? You can choose "Save as PDF" in the print dialog.')) {
                    window.print();
                  }
                  throw new Error('PDF generation failed');
                }
              })
              .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'certificate-${certificateNumber}.pdf';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              })
              .catch(error => {
                console.error('Download failed:', error);
              });
          }
          function printCert() {
            window.print();
          }
          function shareCert() {
            if (navigator.share) {
              navigator.share({
                title: 'Professional Certificate - ${certificateData.userName}',
                text: 'Certificate of completion for ${certificateData.courseTitle}',
                url: window.location.href
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('Certificate link copied to clipboard!');
            }
          }
        </script>`
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(shareableHtml);
      
    } catch (error) {
      console.error("Shareable certificate error:", error);
      res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Internal Server Error</h1>
            <p>An error occurred while loading the certificate.</p>
            <a href="/">Return to Home</a>
          </body>
        </html>
      `);
    }
  });

  // Add interview technologies endpoint directly
  app.get("/api/interview-technologies", async (req: Request, res: Response) => {
    try {
      console.log('Direct API: Fetching interview technologies...');
      const technologies = await db
        .selectDistinct({ technology: interviewQuestions.technology })
        .from(interviewQuestions)
        .where(eq(interviewQuestions.isActive, true));
      
      console.log('Direct API: Found technologies:', technologies);
      const result = technologies.map(t => t.technology);
      console.log('Direct API: Returning technologies:', result);
      res.json(result);
    } catch (error) {
      console.error('Direct API: Error fetching technologies:', error);
      res.status(500).json({ error: 'Failed to fetch technologies' });
    }
  });

  // Import and add new routes
  try {
    const { default: interviewRoutes } = await import('./routes/interviews.js');
    const { default: analyticsRoutes } = await import('./routes/analytics.js');
    app.use('/api', interviewRoutes);
    app.use('/api', analyticsRoutes);
  } catch (error) {
    console.log('Additional routes loading...');
  }

  const httpServer = createServer(app);
  return httpServer;
}