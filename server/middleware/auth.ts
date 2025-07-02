import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    isAdmin?: boolean;
  };
}

interface SellerAuthenticatedRequest extends Request {
  seller?: {
    sellerId: number;
    email: string;
  };
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth middleware - Header:', authHeader);
    console.log('Auth middleware - Token:', token ? 'Present' : 'Missing');

    if (!token) {
      console.log('Auth middleware - No token provided');
      return res.status(401).json({ message: "Access token required" });
    }

    console.log('Auth middleware - JWT_SECRET available:', !!process.env.JWT_SECRET);
    console.log('Auth middleware - JWT_SECRET length:', process.env.JWT_SECRET?.length);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    console.log('Auth middleware - Decoded token:', { userId: decoded.userId, email: decoded.email });
    
    // Get fresh user data to ensure user still exists and is active
    const user = await storage.getUser(decoded.userId);
    console.log('Auth middleware - User lookup result:', user ? 'Found' : 'Not found');
    
    if (!user) {
      console.log('Auth middleware - User not found in database');
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    };

    console.log('Auth middleware - Success, user authenticated:', req.user);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await storage.getUser(decoded.userId);
        
        if (user) {
          req.user = {
            userId: user.id,
            email: user.email,
            isAdmin: user.isAdmin
          };
        }
      } catch (error) {
        // Token invalid but continue without auth
        console.log("Optional auth failed, continuing without authentication");
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next();
  }
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export const authenticateSellerToken = async (req: SellerAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Get fresh seller data
    const seller = await storage.getSeller(decoded.sellerId);
    if (!seller || !seller.isActive) {
      return res.status(401).json({ message: "Invalid seller token" });
    }

    req.seller = {
      sellerId: seller.id,
      email: seller.email
    };

    next();
  } catch (error) {
    console.error("Seller auth middleware error:", error);
    return res.status(401).json({ message: "Invalid seller token" });
  }
};