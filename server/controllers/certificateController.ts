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

      // Always return JSON for API requests - React Query sends proper headers
      res.json(certificate);
    } catch (error) {
      console.error("Get certificate error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate Preview - ${certificate.certificateId}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Poppins', sans-serif; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen py-8">
        <div class="max-w-6xl mx-auto px-4">
            <!-- Header -->
            <div class="mb-8 text-center">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Certificate Preview</h1>
                <p class="text-gray-600">Certificate ID: ${certificate.certificateId}</p>
            </div>

            <!-- Certificate Preview Card -->
            <div class="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
                <div class="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <h2 class="text-xl font-semibold">Professional Certification</h2>
                    <p class="opacity-90">Octamy Solutions</p>
                </div>
                
                <!-- Certificate Content in iframe -->
                <div class="p-6">
                    <iframe 
                        src="/api/certificates/${certificateId}/download" 
                        class="w-full h-[600px] border border-gray-200 rounded"
                        title="Certificate Preview"
                        onload="handleIframeLoad(this)">
                    </iframe>
                    <div id="certificate-fallback" class="hidden w-full h-[600px] border border-gray-200 rounded bg-gray-100 flex items-center justify-center">
                        <div class="text-center p-8">
                            <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-700 mb-2">Certificate Preview</h3>
                            <p class="text-gray-600 mb-4">Professional Certificate for ${certificate.courseTitle || 'Course'}</p>
                            <p class="text-sm text-gray-500">Recipient: ${certificate.userName || 'N/A'}</p>
                            <p class="text-sm text-gray-500">Score: ${certificate.score || 0}%</p>
                            ${!certificate.isPaid ? '<p class="text-sm text-orange-600 mt-2">Payment required for full access</p>' : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-4 justify-center mb-8">
                <button onclick="downloadPDF()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Download PDF
                </button>
                
                <button onclick="printCertificate()" class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                    </svg>
                    Print
                </button>
                
                <button onclick="shareCertificate()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                    </svg>
                    Share
                </button>

                <a href="/" class="bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    Back to Home
                </a>
            </div>

            <!-- Certificate Details -->
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold mb-4">Certificate Details</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="text-sm font-medium text-gray-500">Recipient</label>
                        <p class="text-gray-900">${certificate.userName || 'N/A'}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500">Course</label>
                        <p class="text-gray-900">${certificate.courseTitle || 'N/A'}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500">Score</label>
                        <p class="text-gray-900">${certificate.score || 0}%</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500">Badge</label>
                        <p class="text-gray-900">${certificate.badge || 'N/A'}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500">Issue Date</label>
                        <p class="text-gray-900">${new Date(certificate.issuedAt || '').toLocaleDateString()}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500">Valid Until</label>
                        <p class="text-gray-900">${new Date(certificate.expiresAt || '').toLocaleDateString()}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function handleIframeLoad(iframe) {
            try {
                // Check if iframe loaded successfully
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (!iframeDoc || iframeDoc.body.innerHTML.trim() === '') {
                    showFallback();
                }
            } catch (e) {
                // Cross-origin or other loading issue
                console.log('Certificate preview loaded in iframe');
            }
        }
        
        function showFallback() {
            document.querySelector('iframe').style.display = 'none';
            document.getElementById('certificate-fallback').classList.remove('hidden');
        }
        
        function downloadPDF() {
            ${certificate.isPaid ? 
                `window.open('/api/certificates/${certificateId}/download?format=pdf', '_blank');` :
                `alert('Certificate payment is required before download. Please complete payment first.');`
            }
        }
        
        function printCertificate() {
            ${certificate.isPaid ? `
                const iframe = document.querySelector('iframe');
                if (iframe.style.display !== 'none') {
                    iframe.contentWindow.print();
                } else {
                    alert('Certificate preview not available. Please download PDF instead.');
                }` :
                `alert('Certificate payment is required before printing. Please complete payment first.');`
            }
        }
        
        function shareCertificate() {
            const url = window.location.href;
            if (navigator.share) {
                navigator.share({
                    title: 'Certificate - ${certificate.courseTitle}',
                    text: 'Check out this professional certificate!',
                    url: url
                });
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Certificate link copied to clipboard!');
                });
            }
        }
        
        // Handle iframe errors
        window.addEventListener('message', function(event) {
            if (event.data === 'certificate-load-error') {
                showFallback();
            }
        });
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

      // Check if certificate is paid (security check)
      if (!certificate.isPaid) {
        return res.status(403).json({ message: "Certificate access denied. Payment required." });
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