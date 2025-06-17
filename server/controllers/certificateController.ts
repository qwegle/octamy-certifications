import { Request, Response } from 'express';
import { storage } from '../storage';
import { generateCertificateHTML, generateCertificatePDF } from '../utils/newCertificateGenerator';

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
      const certificate = await storage.getCertificateByCertificateId(certificateId);
      
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
      const certificate = await storage.getCertificateByCertificateId(certificateId);
      
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
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

      // Prepare certificate data for the new professional design
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