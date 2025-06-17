import { Request, Response } from 'express';
import { storage } from '../storage';
import { generateCertificateHTML } from '../utils/certificateGenerator';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
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
        retakeCount: 0
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
      const certificate = await storage.getCertificate(certificateId);
      
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      res.json(certificate);
    } catch (error) {
      console.error("Get certificate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async downloadCertificate(req: Request, res: Response) {
    try {
      const certificateId = req.params.id;
      const certificate = await storage.getCertificate(certificateId);
      
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      const htmlContent = generateCertificateHTML(certificate);
      
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="certificate-${certificateId}.html"`);
      res.send(htmlContent);
    } catch (error) {
      console.error("Download certificate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  static async verifyCertificate(req: Request, res: Response) {
    try {
      const certificateId = req.params.id;
      const certificate = await storage.getCertificate(certificateId);
      
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      const isValid = new Date() < new Date(certificate.expiresAt);
      
      res.json({
        valid: isValid,
        certificate: {
          certificateId: certificate.certificateId,
          userName: certificate.userName,
          courseTitle: certificate.courseTitle,
          score: certificate.score,
          issuedAt: certificate.issuedAt,
          expiresAt: certificate.expiresAt,
          badge: certificate.badge
        }
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

      const certificates = await storage.getUserCertificates(userId);
      res.json(certificates);
    } catch (error) {
      console.error("Get user certificates error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}