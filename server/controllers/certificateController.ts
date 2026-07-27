import { Request, Response } from 'express';
import { storage } from '../storage';
import { generateCertificateHTML, generateCertificatePDF } from '../utils/newCertificateGenerator';
import { db } from '../db';
import { institutes } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  CredentialActivationError,
  getCredentialActivationContext,
} from '../lib/credential-activation';
import { isCredentialEligibleAssessment } from '../lib/certificate-policy';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

async function getVerifiedInstituteIssuer(course: { ownerType?: string | null; ownerId?: number | null }) {
  if (course.ownerType !== 'institute' || !course.ownerId) return null;
  const [institute] = await db.select({
    name: institutes.name,
    logoUrl: institutes.logoUrl,
    status: institutes.status,
  }).from(institutes).where(eq(institutes.id, course.ownerId));
  return institute?.status === 'verified' ? institute : null;
}

function absoluteAssetUrl(req: Request, value?: string | null) {
  if (!value || /^https?:\/\//i.test(value)) return value ?? null;
  if (!value.startsWith('/')) return null;
  return `${req.protocol}://${req.get('host')}${value}`;
}

export class CertificateController {
  static async createCertificate(req: AuthenticatedRequest, res: Response) {
    try {
      const { examAttemptId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get exam attempt details
      const examAttempt = await storage.getExamAttempt(examAttemptId);
      if (!examAttempt || examAttempt.userId !== userId) {
        return res.status(404).json({ message: "Exam attempt not found" });
      }

      // Get course details
      const course = await storage.getCourse(examAttempt.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      if (!isCredentialEligibleAssessment(course)) {
        return res.status(409).json({
          message: "This assessment is not eligible to issue a credential",
          code: "ASSESSMENT_NOT_CREDENTIAL_ELIGIBLE",
        });
      }

      // Check if user passed
      if (examAttempt.score < course.passingScore) {
        return res.status(400).json({ message: "Score too low for certificate" });
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate certificate
      const certificateId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const certificate = await storage.createCertificate({
        userId,
        courseId: course.id,
        certificateId,
        examAttemptId,
        userEmail: user.email,
        userName: user.name,
        score: examAttempt.score,
        courseTitle: course.title,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        badge: examAttempt.score >= 90 ? 'Gold' : examAttempt.score >= 80 ? 'Silver' : 'Bronze',
        certificateNumber: certificateId,
        retakeCount: 0,
        isPaid: false, // Always create as unpaid
        paymentId: null, // No payment initially
        isActive: true
      });

      res.status(201).json(certificate);
    } catch (error) {
      console.error("Create certificate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getCertificate(req: Request, res: Response) {
    try {
      const certificateId = req.params.id;
      const certificate = await storage.getCertificateByCertificateId(certificateId);
      
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      const publicCourse = await storage.getCourse(certificate.courseId);
      const publicCoIssuer = publicCourse ? await getVerifiedInstituteIssuer(publicCourse) : null;

      // Public certificate pages receive only display-safe fields. Never expose
      // recipient email, payment references or internal database identifiers.
      res.json({
        certificateId: certificate.certificateId,
        certificateNumber: certificate.certificateNumber,
        userName: certificate.userName,
        courseTitle: certificate.courseTitle,
        score: certificate.score,
        badge: certificate.badge,
        mastered: certificate.mastered,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt,
        issuedBy: certificate.issuedBy,
        issuer: {
          platform: 'Octamy Solutions Private Limited',
          coIssuer: publicCoIssuer ? { name: publicCoIssuer.name, logoUrl: publicCoIssuer.logoUrl } : null,
        },
        isPaid: certificate.isPaid,
        isActive: certificate.isActive,
      });
    } catch (error) {
      console.error("Get certificate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getActivationCheckout(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Access token required' });
      }

      const context = await getCredentialActivationContext(req.params.id, userId);
      const { certificate, course } = context;
      const status = certificate.isPaid
        ? 'activated'
        : !certificate.isActive
          ? 'revoked'
          : 'ready';

      res.setHeader('Cache-Control', 'private, no-store');
      return res.json({
        certificateId: certificate.certificateId,
        certificateNumber: certificate.certificateNumber,
        userName: certificate.userName,
        courseTitle: certificate.courseTitle,
        score: certificate.score,
        badge: certificate.badge,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt,
        status,
        isPaid: certificate.isPaid,
        isActive: certificate.isActive,
        pricing: {
          currency: 'INR',
          digital: context.amount,
          physicalShipping: '50.00',
          originalDigital:
            course.isOnSale && course.originalPrice
              ? Number(course.originalPrice).toFixed(2)
              : null,
          isOnSale: course.isOnSale,
        },
      });
    } catch (error) {
      if (error instanceof CredentialActivationError) {
        return res.status(error.statusCode).json({
          message: error.message,
          code: error.code,
        });
      }
      console.error('Get credential activation checkout error:', error);
      return res.status(500).json({ message: 'Credential activation could not be loaded' });
    }
  }

  static async downloadCertificate(req: Request, res: Response) {
    try {
      const certificateId = req.params.id;
      const certificate = await storage.getCertificateByCertificateId(certificateId);
      
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      // Check if certificate is paid (security check)
      if (!certificate.isPaid) {
        return res.status(403).json({ message: "Certificate access denied. Payment required." });
      }
      if (!certificate.isActive) {
        return res.status(410).json({ message: "Certificate access denied. This credential has been revoked." });
      }
      if (certificate.expiresAt <= new Date()) {
        return res.status(410).json({ message: "Certificate access denied. This credential has expired." });
      }

      // Get course details for the certificate
      const course = await storage.getCourse(certificate.courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Get exam attempt for completion date
      let examAttempt = null;
      if (certificate.examAttemptId) {
        examAttempt = await storage.getExamAttempt(certificate.examAttemptId);
      }
      const coIssuer = await getVerifiedInstituteIssuer(course);
      const publicBase = `${req.protocol}://${req.get('host')}`;

      // Prepare certificate data for the new professional design
      const certificateData = {
        certificateId: certificate.certificateId || 'N/A',
        userName: certificate.userName || 'Certificate Holder',
        courseTitle: course.title || 'Professional Course',
        issueDate: certificate.issuedAt || new Date(),
        completionDate: examAttempt?.createdAt || certificate.issuedAt || new Date(),
        passingScore: course.passingScore || 50,
        userScore: certificate.score || 0,
        courseLevel: course.level || 'Beginner',
        expiryDate: certificate.expiresAt,
        verificationUrl: `${publicBase}/verify/${encodeURIComponent(certificate.certificateId)}`,
        coIssuerName: coIssuer?.name ?? null,
        coIssuerLogoUrl: absoluteAssetUrl(req, coIssuer?.logoUrl),
      };

      // Check if PDF download is requested
      const format = req.query.format;
      
      if (format === 'pdf') {
        // Generate PDF using the new professional design
        const pdfBuffer = await generateCertificatePDF(certificateData);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="certificate-${certificateId}.pdf"`);
        res.send(pdfBuffer);
      } else {
        // Return HTML version for viewing
        const htmlContent = generateCertificateHTML(certificateData);
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="certificate-${certificateId}.html"`);
        res.send(htmlContent);
      }
    } catch (error) {
      console.error("Download certificate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async verifyCertificate(req: Request, res: Response) {
    try {
      const certificateId = req.params.id;
      const certificate = await storage.getCertificateByCertificateId(certificateId);
      
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      const now = new Date();
      const status = !certificate.isPaid
        ? 'pending_activation'
        : !certificate.isActive
          ? 'revoked'
          : certificate.expiresAt <= now
            ? 'expired'
            : 'active';
      const examAttempt = certificate.examAttemptId
        ? await storage.getExamAttempt(certificate.examAttemptId)
        : null;
      const course = await storage.getCourse(certificate.courseId);
      const coIssuer = course ? await getVerifiedInstituteIssuer(course) : null;

      // Authenticity and current validity are deliberately separate. An
      // existing database record is not a currently valid credential when it
      // is unpaid, expired or revoked.
      res.json({
        authentic: true,
        valid: status === 'active',
        status,
        certificateId: certificate.certificateId,
        userName: certificate.userName,
        courseTitle: certificate.courseTitle,
        score: certificate.score,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt,
        badge: certificate.badge,
        issuedBy: certificate.issuedBy,
        issuer: {
          platform: 'Octamy Solutions Private Limited',
          coIssuer: coIssuer ? { name: coIssuer.name, logoUrl: coIssuer.logoUrl } : null,
        },
        assessment: {
          passingScore: course?.passingScore ?? null,
          questionCount: examAttempt?.totalQuestions ?? null,
          durationSeconds: examAttempt?.timeTaken ?? null,
          completedAt: examAttempt?.createdAt ?? null,
          level: course?.level ?? null,
        },
      });
    } catch (error) {
      console.error("Verify certificate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async getUserCertificates(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const certificates = await storage.getUserCertificates(userId, req.user?.email);
      res.json(certificates);
    } catch (error) {
      console.error("Get user certificates error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}
