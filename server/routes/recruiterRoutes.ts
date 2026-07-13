import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { assertStrongPassword } from '../lib/bcrypt-helper';
import crypto from 'crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET!;

const recruiterKycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, PNG, JPG, and WebP files are allowed'));
  },
});

export interface AuthenticatedRecruiterRequest extends Request {
  recruiter?: {
    recruiterId: number;
    email: string;
  };
}

// Middleware to authenticate recruiter token
export const authenticateRecruiterToken = (req: AuthenticatedRecruiterRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.recruiter = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

export function registerRecruiterRoutes(app: any) {
  // Recruiter Registration
  app.post('/recruiter/register', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // Check if recruiter already exists
      const existingRecruiter = await storage.getRecruiterByEmail(email);
      if (existingRecruiter) {
        return res.status(400).json({ message: "Recruiter already exists with this email" });
      }

      try { assertStrongPassword(password); } catch (e: any) { return res.status(400).json({ message: e.message }); }
      const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);

      const recruiter = await storage.createRecruiter({
        email,
        password: hashedPassword,
        firstName: '',
        lastName: '',
        phone: '',
        designation: '',
        linkedinProfile: '',
        companyName: '',
        companyWebsite: '',
        companySize: '1-10',
        industry: '',
        companyAddress: '',
        companyCity: '',
        companyState: '',
        companyCountry: 'India',
        gstNumber: '',
        panNumber: '',
        companyRegistrationNumber: '',
        gstCertificate: '',
        panCard: '',
        companyRegistrationCertificate: '',
        isActive: true,
        kycStatus: 'pending',
        creditsBalance: '0.00',
        registrationStep: 1
      });

      const token = jwt.sign(
        { recruiterId: recruiter.id, email: recruiter.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: "Recruiter registered successfully",
        token,
        recruiter: {
          id: recruiter.id,
          email: recruiter.email,
          firstName: recruiter.firstName,
          lastName: recruiter.lastName,
          companyName: recruiter.companyName,
          kycStatus: recruiter.kycStatus,
          creditsBalance: recruiter.creditsBalance,
          registrationStep: recruiter.registrationStep
        }
      });
    } catch (error: any) {
      console.error("Recruiter registration error:", error);
      res.status(500).json({ message: "Registration failed", error: error.message });
    }
  });

  // Recruiter Login
  app.post('/recruiter/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      const recruiter = await storage.getRecruiterByEmail(email);
      if (!recruiter) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, recruiter.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update last login
      await storage.updateRecruiterLastLogin(recruiter.id);

      const token = jwt.sign(
        { recruiterId: recruiter.id, email: recruiter.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: "Login successful",
        token,
        recruiter: {
          id: recruiter.id,
          email: recruiter.email,
          firstName: recruiter.firstName,
          lastName: recruiter.lastName,
          companyName: recruiter.companyName,
          kycStatus: recruiter.kycStatus,
          creditsBalance: recruiter.creditsBalance,
          registrationStep: recruiter.registrationStep
        }
      });
    } catch (error: any) {
      console.error("Recruiter login error:", error);
      res.status(500).json({ message: "Login failed", error: error.message });
    }
  });

  // Onboarding Step 1: Personal Information
  app.post('/recruiter/onboarding/step1', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { firstName, lastName, phone, designation, linkedinProfile } = req.body;
      
      await storage.updateRecruiterStep1({
        id: recruiterId,
        firstName,
        lastName,
        phone,
        designation,
        linkedinProfile,
        registrationStep: 2
      });

      res.json({ message: "Step 1 completed successfully" });
    } catch (error: any) {
      console.error("Step 1 error:", error);
      res.status(500).json({ message: "Failed to save step 1 data", error: error.message });
    }
  });

  // Onboarding Step 2: Company Information
  app.post('/recruiter/onboarding/step2', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { 
        companyName, 
        companyWebsite, 
        companySize, 
        industry, 
        companyAddress, 
        companyCity, 
        companyState, 
        companyCountry 
      } = req.body;
      
      await storage.updateRecruiterStep2({
        id: recruiterId,
        companyName,
        companyWebsite,
        companySize,
        industry,
        companyAddress,
        companyCity,
        companyState,
        companyCountry,
        registrationStep: 3
      });

      res.json({ message: "Step 2 completed successfully" });
    } catch (error: any) {
      console.error("Step 2 error:", error);
      res.status(500).json({ message: "Failed to save step 2 data", error: error.message });
    }
  });

  app.post('/recruiter/kyc-upload', authenticateRecruiterToken, recruiterKycUpload.single('file'), async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) return res.status(401).json({ message: 'Unauthorized' });
      if (!req.file) return res.status(400).json({ message: 'Choose a document to upload' });
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return res.status(503).json({ message: 'Secure document storage is not configured' });
      }

      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder: `octamy/recruiter-kyc/${recruiterId}`,
          resource_type: 'auto',
          type: 'authenticated',
          access_mode: 'authenticated',
          use_filename: false,
          unique_filename: true,
        }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
        stream.end(req.file!.buffer);
      });
      res.json({ fileUrl: result.secure_url, publicId: result.public_id, fileName: req.file.originalname });
    } catch (error: any) {
      console.error('Recruiter KYC upload error:', error?.message);
      res.status(500).json({ message: error?.message || 'Document upload failed' });
    }
  });

  // Onboarding Step 3: KYC Documents
  app.post('/recruiter/onboarding/step3', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { 
        gstNumber, 
        panNumber, 
        companyRegistrationNumber,
        gstCertificate,
        panCard,
        companyRegistrationCertificate
      } = req.body;
      
      await storage.updateRecruiterStep3({
        id: recruiterId,
        gstNumber,
        panNumber,
        companyRegistrationNumber,
        gstCertificate,
        panCard,
        companyRegistrationCertificate,
        registrationStep: 4,
        kycStatus: 'under_review'
      });

      res.json({ message: "Registration completed successfully" });
    } catch (error: any) {
      console.error("Step 3 error:", error);
      res.status(500).json({ message: "Failed to save step 3 data", error: error.message });
    }
  });

  // Get Dashboard Data
  app.get('/recruiter/dashboard', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get recruiter's activity stats
      const dashboardData = await storage.getRecruiterDashboardData(recruiterId);
      
      res.json(dashboardData);
    } catch (error: any) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Failed to fetch dashboard data", error: error.message });
    }
  });

  // Search Candidates
  app.post('/recruiter/search', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { filters, page = 1, limit = 10 } = req.body;
      
      // Check if recruiter is KYC approved
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter || recruiter.kycStatus !== 'approved') {
        return res.status(403).json({ message: "KYC verification required to search candidates" });
      }

      console.log('About to call storage.searchCandidates with:', { filters, page, limit });
      const searchResults = await storage.searchCandidates(filters, page, limit);
      console.log('Search results from storage:', searchResults);
      
      res.json(searchResults);
    } catch (error: any) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Failed to search candidates", error: error.message });
    }
  });

  // Access Profile (View/CV/Interview)
  app.post('/recruiter/access-profile', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { candidateId, accessType } = req.body;
      
      // Check if recruiter is KYC approved
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter || recruiter.kycStatus !== 'approved') {
        return res.status(403).json({ message: "KYC verification required to access profiles" });
      }

      // Define credit costs
      const creditCosts = {
        view: 1,
        cv: 1,
        interview: 2
      };

      const creditsRequired = creditCosts[accessType as keyof typeof creditCosts];
      if (!creditsRequired || !Number.isInteger(Number(candidateId))) {
        return res.status(400).json({ message: 'Invalid profile access request' });
      }
      
      // Check if recruiter has enough credits
      const currentBalance = Number(recruiter.creditsBalance || 0);
      if (currentBalance < creditsRequired) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Process the access request
      const normalizedAccessType = accessType === 'view'
        ? 'profile_view'
        : accessType === 'cv'
          ? 'cv_download'
          : 'interview_access';
      const accessResult = await storage.processProfileAccess(recruiterId, Number(candidateId), normalizedAccessType, creditsRequired);
      
      res.json(accessResult);
    } catch (error: any) {
      console.error("Profile access error:", error);
      res.status(500).json({ message: "Failed to access profile", error: error.message });
    }
  });

  // Get Wallet Information
  app.get('/recruiter/wallet', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const walletData = await storage.getRecruiterWallet(recruiterId);
      
      res.json(walletData);
    } catch (error: any) {
      console.error("Wallet error:", error);
      res.status(500).json({ message: "Failed to fetch wallet data", error: error.message });
    }
  });

  // Purchase Credits — REQUIRES gateway-verified order id; client-supplied amount is ignored.
  app.post('/recruiter/credit-orders', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) return res.status(401).json({ message: 'Unauthorized' });

      const credits = Number(req.body?.credits);
      const packages: Record<number, number> = { 100: 1000, 500: 4500, 1000: 8000 };
      const amount = packages[credits];
      if (!amount) return res.status(400).json({ message: 'Select a valid credit package' });

      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter || !recruiter.isActive) return res.status(403).json({ message: 'Recruiter account is not active' });

      const orderId = `RC_${recruiterId}_${credits}_${crypto.randomBytes(8).toString('hex')}`;
      const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const { createCashfreeOrder } = await import('../lib/cashfree.js');
      const order = await createCashfreeOrder({
        orderId,
        amount: amount.toFixed(2),
        customerId: `oct_recruiter_${recruiterId}`,
        customerName: `${recruiter.firstName || ''} ${recruiter.lastName || ''}`.trim() || recruiter.companyName || 'Octamy Recruiter',
        customerEmail: recruiter.email,
        customerPhone: recruiter.phone || '9999999999',
        returnUrl: `${baseUrl}/recruiter/payment-success?order_id=${encodeURIComponent(orderId)}`,
        notifyUrl: `${baseUrl}/api/webhooks/cashfree`,
        notes: { kind: 'recruiter_credits', recruiterId: String(recruiterId), credits: String(credits) },
      });

      res.json({
        orderId: order.orderId,
        paymentSessionId: order.paymentSessionId,
        paymentLink: order.paymentLink,
        amount,
        credits,
      });
    } catch (error: any) {
      console.error('Recruiter credit order error:', error?.message);
      res.status(500).json({ message: error?.message || 'Failed to start credit checkout' });
    }
  });

  app.post('/recruiter/purchase-credits', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { orderId } = req.body as { orderId?: string };
      if (!orderId || typeof orderId !== 'string') {
        return res.status(400).json({ message: "orderId required (must be a paid Cashfree order)" });
      }

      const orderMatch = /^RC_(\d+)_(100|500|1000)_[a-f0-9]{16}$/.exec(orderId);
      if (!orderMatch || Number(orderMatch[1]) !== recruiterId) {
        return res.status(403).json({ message: 'This payment order does not belong to your account' });
      }
      const credits = Number(orderMatch[2]);
      const packagePrices: Record<number, number> = { 100: 1000, 500: 4500, 1000: 8000 };

      // Idempotency: reject duplicate orderId.
      const { db } = await import('../db');
      const { creditTransactions } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      const existing = await db.execute(sql`SELECT id FROM credit_transactions WHERE description LIKE ${'%' + orderId + '%'} LIMIT 1`);
      if ((existing as any).rows?.length) {
        return res.status(409).json({ message: 'Order already credited' });
      }

      // Verify with Cashfree.
      const { fetchCashfreeOrderStatus } = await import('../lib/cashfree.js');
      let payments: any;
      try {
        payments = await fetchCashfreeOrderStatus(orderId);
      } catch (err: any) {
        return res.status(400).json({ message: `Order verification failed: ${err.message}` });
      }
      const paymentList = Array.isArray(payments) ? payments : [];
      const successful = paymentList.find((p: any) => (p.payment_status || '').toUpperCase() === 'SUCCESS');
      if (!successful) {
        return res.status(402).json({ message: 'No successful payment found for this order' });
      }
      const verifiedAmount = Number(successful.payment_amount || successful.order_amount || 0);
      if (!Number.isFinite(verifiedAmount) || Math.abs(verifiedAmount - packagePrices[credits]) > 0.01) {
        return res.status(400).json({ message: 'Paid amount does not match the selected credit package' });
      }

      // Credit the server-defined package only after gateway amount verification.
      const purchaseResult = await storage.purchaseCredits(recruiterId, credits, orderId);
      res.json(purchaseResult);
    } catch (error: any) {
      console.error("Credit purchase error:", error?.message);
      res.status(500).json({ message: "Failed to purchase credits" });
    }
  });

  // Get Candidate Profile by ID
  app.get('/recruiter/candidate/:id', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const candidateId = parseInt(req.params.id);
      if (!candidateId || isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      // Check if recruiter is KYC approved
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter || recruiter.kycStatus !== 'approved') {
        return res.status(403).json({ message: "KYC verification required to view candidate profiles" });
      }

      const { db } = await import('../db');
      const { profileAccessLogs } = await import('@shared/schema');
      const { eq, and, desc } = await import('drizzle-orm');
      const [profileAccess] = await db.select({ id: profileAccessLogs.id }).from(profileAccessLogs)
        .where(and(eq(profileAccessLogs.recruiterId, recruiterId), eq(profileAccessLogs.userId, candidateId), eq(profileAccessLogs.accessType, 'profile_view')))
        .orderBy(desc(profileAccessLogs.createdAt)).limit(1);
      if (!profileAccess) return res.status(402).json({ message: 'Unlock this profile from candidate search first' });

      // Get candidate profile data
      const candidateProfile = await storage.getCandidateProfile(candidateId);
      if (!candidateProfile) {
        return res.status(404).json({ message: "The candidate profile you're looking for doesn't exist." });
      }

      res.json(candidateProfile);
    } catch (error: any) {
      console.error("Candidate profile error:", error);
      res.status(500).json({ message: "Failed to load candidate profile", error: error.message });
    }
  });

  app.get('/recruiter/download-cv/:id', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      const candidateId = Number(req.params.id);
      if (!recruiterId || !Number.isInteger(candidateId)) return res.status(400).json({ message: 'Invalid request' });

      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter || recruiter.kycStatus !== 'approved') return res.status(403).json({ message: 'KYC approval required' });

      const { db } = await import('../db');
      const { users, profileAccessLogs } = await import('@shared/schema');
      const { eq, and, desc } = await import('drizzle-orm');
      const [access] = await db.select({ id: profileAccessLogs.id }).from(profileAccessLogs)
        .where(and(eq(profileAccessLogs.recruiterId, recruiterId), eq(profileAccessLogs.userId, candidateId), eq(profileAccessLogs.accessType, 'cv_download')))
        .orderBy(desc(profileAccessLogs.createdAt)).limit(1);
      if (!access) return res.status(403).json({ message: 'Purchase CV access first' });

      const [candidate] = await db.select({ resume: users.resume, visible: users.profileVisibility }).from(users).where(eq(users.id, candidateId));
      if (!candidate?.visible || !candidate.resume) return res.status(404).json({ message: 'Candidate CV is not available' });

      if (/^https:\/\//i.test(candidate.resume)) return res.redirect(candidate.resume);
      const localMatch = /^\/api\/uploads\/resumes\/([^/]+)$/.exec(candidate.resume);
      if (!localMatch || !localMatch[1].startsWith(`${candidateId}-`)) return res.status(404).json({ message: 'Candidate CV is not available' });

      const path = await import('node:path');
      return res.sendFile(path.join(process.cwd(), 'uploads', 'resumes', path.basename(localMatch[1])));
    } catch (error: any) {
      console.error('Recruiter CV download error:', error?.message);
      res.status(500).json({ message: 'Failed to download CV' });
    }
  });

  // Get Recruiter Profile
  app.get('/recruiter/profile', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      const { password: _password, ...safeRecruiter } = recruiter;
      res.json(safeRecruiter);
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Failed to fetch profile", error: error.message });
    }
  });

  // Update Recruiter Profile
  app.put('/recruiter/profile', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { firstName, lastName, phone, designation, linkedinProfile } = req.body;
      
      await storage.updateRecruiterStep1({
        id: recruiterId,
        firstName,
        lastName,
        phone,
        designation,
        linkedinProfile
      });

      res.json({ message: "Profile updated successfully" });
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Failed to update profile", error: error.message });
    }
  });

  // Update Company Information
  app.put('/recruiter/company', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { 
        companyName, 
        companyWebsite, 
        companySize, 
        industry, 
        companyAddress, 
        companyCity, 
        companyState, 
        companyCountry 
      } = req.body;
      
      await storage.updateRecruiterStep2({
        id: recruiterId,
        companyName,
        companyWebsite,
        companySize,
        industry,
        companyAddress,
        companyCity,
        companyState,
        companyCountry
      });

      res.json({ message: "Company information updated successfully" });
    } catch (error: any) {
      console.error("Update company error:", error);
      res.status(500).json({ message: "Failed to update company information", error: error.message });
    }
  });

  // Change Password
  app.put('/recruiter/change-password', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;
      
      // Get current recruiter
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }
      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, recruiter.password);
      if (!validPassword) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      try { assertStrongPassword(newPassword); } catch (e: any) { return res.status(400).json({ message: e.message }); }
      const hashedPassword = await bcrypt.hash(newPassword, Number(process.env.BCRYPT_ROUNDS) || 12);
      
      // Update password
      await storage.updateRecruiterPassword(recruiterId, hashedPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password", error: error.message });
    }
  });

  // Generate PayUMoney Payment Hash
  app.post('/recruiter/generate-payment-hash', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const { key, amount, productinfo, firstname, email, txnid, surl, furl, service_provider } = req.body;
      
      const PAYUMONEY_SALT = process.env.PAYUMONEY_SALT || 'eCwWELxi';
      
      // Create hash string: key|txnid|amount|productinfo|firstname|email|||||||||||salt
      const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${PAYUMONEY_SALT}`;
      
      const hash = crypto.createHash('sha512').update(hashString).digest('hex');
      
      res.json({ hash });
    } catch (error: any) {
      console.error("Payment hash generation error:", error);
      res.status(500).json({ message: "Failed to generate payment hash", error: error.message });
    }
  });

  // Payment Success Handler
  app.post('/recruiter/payment-success', async (req: Request, res: Response) => {
    try {
      const { txnid, amount, status, hash } = req.body;
      
      if (status === 'success') {
        // Extract recruiter ID from transaction ID or use session
        // For now, let's parse transaction ID format: TXN_timestamp_randomstring
        // You would normally store this mapping when creating the transaction
        
        // Process the successful payment
        const credits = Math.floor(parseFloat(amount) / 50); // ₹50 per credit
        
        // Redirect to success page with parameters
        res.redirect(`/recruiter/payment-success?txnid=${txnid}&amount=${amount}&credits=${credits}`);
      } else {
        res.redirect(`/recruiter/payment-failed?txnid=${txnid}`);
      }
    } catch (error: any) {
      console.error("Payment success handler error:", error);
      res.redirect('/recruiter/payment-failed');
    }
  });

  // Payment Failure Handler  
  app.post('/recruiter/payment-failed', async (req: Request, res: Response) => {
    try {
      const { txnid } = req.body;
      res.redirect(`/recruiter/payment-failed?txnid=${txnid}`);
    } catch (error: any) {
      console.error("Payment failure handler error:", error);
      res.redirect('/recruiter/payment-failed');
    }
  });

  // Access Interview Video with Credit Deduction
  app.post('/recruiter/access-interview-video', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const { interviewId, candidateId } = req.body;
      const recruiterId = req.recruiter?.recruiterId;

      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check recruiter's credit balance
      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }
      if (recruiter.kycStatus !== 'approved') {
        return res.status(403).json({ message: 'KYC verification required' });
      }

      if (Number(recruiter.creditsBalance || 0) < 2) {
        return res.status(400).json({ message: "Insufficient credits. Interview videos require 2 credits." });
      }

      // Get interview details
      const interview = await storage.getInterviewById(interviewId);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }
      if (interview.userId !== Number(candidateId)) {
        return res.status(403).json({ message: 'Interview does not belong to this candidate' });
      }

      if (!interview.videoUrl) {
        return res.status(404).json({ message: "Video not available for this interview" });
      }

      // Process credit transaction and access logging
      await storage.processProfileAccess(recruiterId, parseInt(candidateId), 'interview_access', 2);

      res.json({ 
        videoUrl: interview.videoUrl,
        creditsRemaining: (Number(recruiter.creditsBalance || 0) - 2).toFixed(2),
        message: "Video access granted. 2 credits deducted."
      });

    } catch (error: any) {
      console.error("Interview video access error:", error);
      res.status(500).json({ message: "Failed to access interview video", error: error.message });
    }
  });

  // Analytics aggregations for the recruiter analytics page.
  app.get('/recruiter/analytics', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) return res.status(401).json({ message: 'Unauthorized' });
      const { db: drizzleDb } = await import('../db');
      const { sql } = await import('drizzle-orm');

      const totals = await drizzleDb.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE access_type='profile_view')::int AS profile_views,
          COUNT(*) FILTER (WHERE access_type='cv_download')::int AS cv_downloads,
          COUNT(*) FILTER (WHERE access_type='interview_access')::int AS interview_access,
          COALESCE(SUM(credits_used::numeric), 0)::float AS credits_used
        FROM profile_access_logs WHERE recruiter_id = ${recruiterId}
      `) as any as Array<{ profile_views: number; cv_downloads: number; interview_access: number; credits_used: number }>;

      const last30 = await drizzleDb.execute(sql`
        SELECT date_trunc('day', created_at)::date AS day,
               COUNT(*)::int AS accesses,
               COALESCE(SUM(credits_used::numeric),0)::float AS credits
        FROM profile_access_logs
        WHERE recruiter_id = ${recruiterId} AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY 1 ORDER BY 1 ASC
      `) as any as Array<{ day: string; accesses: number; credits: number }>;

      const recentAccess = await drizzleDb.execute(sql`
        SELECT pal.id, pal.access_type, pal.credits_used, pal.created_at, u.name AS user_name
        FROM profile_access_logs pal
        LEFT JOIN users u ON u.id = pal.user_id
        WHERE pal.recruiter_id = ${recruiterId}
        ORDER BY pal.id DESC LIMIT 25
      `) as any as Array<{ id: number; access_type: string; credits_used: string; created_at: string; user_name: string | null }>;

      const recentTransactions = await drizzleDb.execute(sql`
        SELECT id, type, amount, description, balance_after, created_at
        FROM credit_transactions
        WHERE recruiter_id = ${recruiterId}
        ORDER BY id DESC LIMIT 25
      `) as any as Array<{ id: number; type: string; amount: string; description: string; balance_after: string; created_at: string }>;

      res.json({
        totals: {
          profileViews: totals[0]?.profile_views ?? 0,
          cvDownloads: totals[0]?.cv_downloads ?? 0,
          interviewAccess: totals[0]?.interview_access ?? 0,
          creditsUsed: totals[0]?.credits_used ?? 0,
        },
        daily: last30,
        recentAccess,
        recentTransactions,
      });
    } catch (err: any) {
      console.error('GET /recruiter/analytics', err);
      res.status(500).json({ message: 'Failed to load analytics' });
    }
  });
}
