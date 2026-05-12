import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { storage } from '../storage';
import { db } from '../db';
import { passwordResetTokens, users } from '@shared/schema';
import { emailService } from '../utils/emailService';
import { audit } from '../lib/audit';
import { logger } from '../lib/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: "User created successfully",
        token,
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      res.json({
        message: "Login successful",
        token,
        user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getCurrentUser(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin
      });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async logout(req: Request, res: Response) {
    // Since we're using JWT, logout is handled client-side
    res.json({ message: "Logout successful" });
  }

  // ------------------------------------------------------------
  // Forgot / reset password
  // ------------------------------------------------------------
  static async forgotPassword(req: Request, res: Response) {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: 'Valid email required' });
      }

      // Always respond success to avoid email-enumeration leaks.
      const ackResponse = { message: 'If an account exists for this email, a reset link has been sent.' };

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        // No account, OR account is Google-only (no password). Still ack.
        return res.json(ackResponse);
      }

      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const link = `${baseUrl}/reset-password?token=${rawToken}`;

      // Fire-and-forget email; never block the response.
      emailService.sendPasswordResetEmail(user.email, user.name || 'there', link).catch((err) => {
        logger.error('forgot.password.email.failed', { err, userId: user.id });
      });

      audit({ action: 'auth.forgot_password.requested', userId: user.id, req });
      logger.info('forgot.password.token.created', { userId: user.id });
      res.json(ackResponse);
    } catch (error: any) {
      logger.error('forgot.password.error', { err: error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const token = String(req.body?.token || '').trim();
      const password = String(req.body?.password || '');
      if (!token || password.length < 8) {
        return res.status(400).json({ message: 'Token and password (min 8 chars) required' });
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const [row] = await db.select().from(passwordResetTokens).where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        )
      );
      if (!row) {
        return res.status(400).json({ message: 'Invalid or expired reset token' });
      }

      const hashed = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
      await db.update(users).set({ password: hashed }).where(eq(users.id, row.userId));
      await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));

      audit({ action: 'auth.password.reset', userId: row.userId, req });
      logger.info('password.reset.completed', { userId: row.userId });
      res.json({ message: 'Password updated. You can now sign in.' });
    } catch (error: any) {
      logger.error('reset.password.error', { err: error });
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}