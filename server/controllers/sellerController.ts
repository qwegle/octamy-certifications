import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { insertSellerSchema, insertWithdrawalRequestSchema } from '@shared/schema';

interface SellerAuthenticatedRequest extends Request {
  seller?: {
    sellerId: number;
    email: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export class SellerController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name, phone } = insertSellerSchema.parse(req.body);
      
      // Check if seller already exists
      const existingSeller = await storage.getSellerByEmail(email);
      if (existingSeller) {
        return res.status(400).json({ message: "Seller already exists with this email" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create seller
      const seller = await storage.createSeller({
        email,
        password: hashedPassword,
        name,
        phone,
        isApproved: false,
        isActive: true,
        referralCode: `REF${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase()
      });

      // Generate token
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
          totalEarnings: seller.totalEarnings,
          pendingEarnings: seller.pendingEarnings
        }
      });
    } catch (error: any) {
      console.error("Seller registration error:", error);
      res.status(500).json({ message: "Registration failed", error: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Find seller
      const seller = await storage.getSellerByEmail(email);
      if (!seller) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, seller.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check if seller is active
      if (!seller.isActive) {
        return res.status(401).json({ message: "Account is deactivated" });
      }

      // Generate token
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
          totalEarnings: seller.totalEarnings,
          pendingEarnings: seller.pendingEarnings
        }
      });
    } catch (error: any) {
      console.error("Seller login error:", error);
      res.status(500).json({ message: "Login failed", error: error.message });
    }
  }

  static async getDashboard(req: SellerAuthenticatedRequest, res: Response) {
    try {
      const sellerId = req.seller?.sellerId;
      if (!sellerId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get seller data
      const seller = await storage.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }

      // Get sales data
      const sales = await storage.getSalesBySeller(sellerId);
      
      // Get withdrawals data
      const withdrawals = await storage.getWithdrawalsBySeller(sellerId);

      // Get click analytics
      const clickAnalytics = await storage.getSellerClickAnalytics(sellerId);

      // Calculate analytics
      const totalSales = sales.length;
      const totalCommission = sales.reduce((sum: number, sale: any) => sum + parseFloat(sale.commission || "0"), 0);
      const pendingWithdrawals = withdrawals
        .filter((w: any) => w.status === 'pending')
        .reduce((sum: number, w: any) => sum + parseFloat(w.amount), 0);

      const dashboardData = {
        seller: {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          isApproved: seller.isApproved,
          totalEarnings: seller.totalEarnings || "0",
          pendingEarnings: seller.pendingEarnings || "0",
          commissionRate: "10" // 10% commission rate
        },
        sales: sales.map((sale: any) => ({
          id: sale.id,
          amount: sale.amount,
          commission: sale.commission,
          status: sale.status,
          referralCode: sale.referralCode,
          createdAt: sale.createdAt?.toISOString() || new Date().toISOString()
        })),
        withdrawals: withdrawals.map((withdrawal: any) => ({
          id: withdrawal.id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt?.toISOString() || new Date().toISOString()
        })),
        analytics: {
          totalSales,
          totalCommission,
          pendingWithdrawals
        },
        clickAnalytics
      };

      res.json(dashboardData);
    } catch (error: any) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data", error: error.message });
    }
  }

  static async getShareableItems(req: SellerAuthenticatedRequest, res: Response) {
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
      res.status(500).json({ message: "Failed to fetch shareable items", error: error.message });
    }
  }

  static async generateReferralUrl(req: SellerAuthenticatedRequest, res: Response) {
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

      // Get course details to use slug instead of ID
      const course = await storage.getCourse(targetCourseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Generate referral URL using slug
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const referralUrl = `${baseUrl}/course/${course.slug}?ref=${seller.referralCode}`;

      res.json({
        referralUrl,
        referralCode: seller.referralCode
      });
    } catch (error: any) {
      console.error("Generate referral URL error:", error);
      res.status(500).json({ message: "Failed to generate referral URL", error: error.message });
    }
  }

  static async requestWithdrawal(req: SellerAuthenticatedRequest, res: Response) {
    try {
      const sellerId = req.seller?.sellerId;
      if (!sellerId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const withdrawalData = insertWithdrawalRequestSchema.parse({
        ...req.body,
        sellerId
      });

      // Check if seller has enough earnings
      const seller = await storage.getSeller(sellerId);
      if (!seller) {
        return res.status(404).json({ message: "Seller not found" });
      }

      const availableEarnings = parseFloat(seller.totalEarnings || "0");
      const requestedAmount = parseFloat(withdrawalData.amount);

      if (requestedAmount > availableEarnings) {
        return res.status(400).json({ message: "Insufficient earnings for withdrawal" });
      }

      // Create withdrawal request
      const withdrawal = await storage.createWithdrawalRequest(withdrawalData);

      res.status(201).json({
        message: "Withdrawal request submitted successfully",
        withdrawal: {
          id: withdrawal.id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt?.toISOString() || new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error("Withdrawal request error:", error);
      res.status(500).json({ message: "Failed to create withdrawal request", error: error.message });
    }
  }
}