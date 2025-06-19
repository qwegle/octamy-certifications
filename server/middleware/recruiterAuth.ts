import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRecruiterRequest extends Request {
  recruiter?: {
    recruiterId: number;
    email: string;
  };
}

export const authenticateRecruiterToken = (
  req: AuthenticatedRecruiterRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.recruiter = {
      recruiterId: decoded.recruiterId,
      email: decoded.email,
    };
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};