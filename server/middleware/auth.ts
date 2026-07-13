import { Request, Response, NextFunction, type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
    isAdmin?: boolean;
  };
}

export interface SellerAuthenticatedRequest extends Request {
  seller?: {
    sellerId: number;
    email: string;
  };
}

export const authenticateToken = (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Get fresh user data to ensure user still exists and is active
    const user = await storage.getUser(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Invalid token", code: "INVALID_TOKEN" });
  }
}) as RequestHandler;

export const optionalAuth = (async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
}) as RequestHandler;

export const requireAdmin = ((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}) as RequestHandler;

export const authenticateSellerToken = (async (req: SellerAuthenticatedRequest, res: Response, next: NextFunction) => {
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
}) as RequestHandler;

// ---------- Role middleware: creator / institute / plan tier --------------
// All assume `authenticateToken` ran first.

export interface CreatorRequest extends AuthenticatedRequest {
  creator?: { id: number; userId: number; plan: string; status: string };
}

export const requireCreator = (async (req: CreatorRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ message: "Auth required" });
  const creator = await storage.getCreatorByUserId(req.user.userId);
  if (!creator) return res.status(403).json({ message: "Creator profile required" });
  req.creator = {
    id: creator.id,
    userId: creator.userId,
    plan: creator.plan,
    status: creator.status,
  };
  next();
}) as RequestHandler;

export interface InstituteRequest extends AuthenticatedRequest {
  institute?: { id: number; plan: string; memberRole: string };
}

const INSTITUTE_ROLE_RANK: Record<string, number> = { staff: 1, teacher: 2, admin: 3, owner: 4 };

export const requireInstituteRole = (minRole: 'staff' | 'teacher' | 'admin' | 'owner' = 'teacher') =>
  (async (req: InstituteRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Auth required" });
    const inst = await (storage as any).getInstituteByUserId(req.user.userId);
    if (!inst) return res.status(403).json({ message: "Institute membership required" });
    if ((INSTITUTE_ROLE_RANK[inst.memberRole] || 0) < INSTITUTE_ROLE_RANK[minRole]) {
      return res.status(403).json({ message: `Institute ${minRole} role required` });
    }
    req.institute = { id: inst.id, plan: inst.plan, memberRole: inst.memberRole };
    next();
  }) as RequestHandler;

const PLAN_RANK: Record<string, number> = {
  free: 0, starter: 1, pro: 2, growth: 2, premium: 3, enterprise: 3,
};

export const requirePlan = (
  ownerType: 'creator' | 'institute' | 'recruiter',
  minPlan: string,
) => (async (req: any, res: Response, next: NextFunction) => {
  let actualPlan: string | undefined;
  if (ownerType === 'creator') actualPlan = req.creator?.plan;
  else if (ownerType === 'institute') actualPlan = req.institute?.plan;
  else if (ownerType === 'recruiter') actualPlan = req.recruiter?.plan;
  if (!actualPlan) return res.status(403).json({ message: "Plan context missing" });
  if ((PLAN_RANK[actualPlan] || 0) < (PLAN_RANK[minPlan] || 0)) {
    return res.status(402).json({
      message: `Upgrade required: this feature needs ${minPlan} plan or higher.`,
      currentPlan: actualPlan,
      requiredPlan: minPlan,
      upgradeUrl: `/pricing?role=${ownerType}`,
    });
  }
  next();
}) as RequestHandler;
