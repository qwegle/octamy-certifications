import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { storage } from '../storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AuthenticatedRecruiterRequest extends Request {
  recruiter?: {
    recruiterId: number;
    email: string;
  };
}

// Middleware to authenticate recruiter token
const authenticateRecruiterToken = (req: AuthenticatedRecruiterRequest, res: Response, next: NextFunction) => {
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
  app.post('/api/recruiter/register', async (req: Request, res: Response) => {
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

      const hashedPassword = await bcrypt.hash(password, 10);

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
  app.post('/api/recruiter/login', async (req: Request, res: Response) => {
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
  app.post('/api/recruiter/onboarding/step1', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
  app.post('/api/recruiter/onboarding/step2', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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

  // Onboarding Step 3: KYC Documents
  app.post('/api/recruiter/onboarding/step3', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
  app.get('/api/recruiter/dashboard', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
  app.post('/api/recruiter/search', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
  app.post('/api/recruiter/access-profile', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
      
      // Check if recruiter has enough credits
      const currentBalance = parseFloat(recruiter.creditsBalance);
      if (currentBalance < creditsRequired) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Process the access request
      const accessResult = await storage.processProfileAccess(recruiterId, candidateId, accessType, creditsRequired);
      
      res.json(accessResult);
    } catch (error: any) {
      console.error("Profile access error:", error);
      res.status(500).json({ message: "Failed to access profile", error: error.message });
    }
  });

  // Get Wallet Information
  app.get('/api/recruiter/wallet', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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

  // Purchase Credits
  app.post('/api/recruiter/purchase-credits', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { amount, paymentId } = req.body;
      
      // Process credit purchase
      const purchaseResult = await storage.purchaseCredits(recruiterId, amount, paymentId);
      
      res.json(purchaseResult);
    } catch (error: any) {
      console.error("Credit purchase error:", error);
      res.status(500).json({ message: "Failed to purchase credits", error: error.message });
    }
  });

  // Get Candidate Profile by ID
  app.get('/api/recruiter/candidate/:id', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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

      // Get candidate profile data
      console.log(`Fetching candidate profile for ID: ${candidateId}`);
      const candidateProfile = await storage.getCandidateProfile(candidateId);
      console.log('Profile data received:', candidateProfile ? 'Found' : 'Not found');
      
      if (!candidateProfile) {
        console.log('Returning 404 - candidate not found');
        return res.status(404).json({ message: "The candidate profile you're looking for doesn't exist." });
      }

      console.log('Returning profile data for candidate:', candidateProfile.name);
      res.json(candidateProfile);
    } catch (error: any) {
      console.error("Candidate profile error:", error);
      res.status(500).json({ message: "Failed to load candidate profile", error: error.message });
    }
  });

  // Get Recruiter Profile
  app.get('/api/recruiter/profile', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
    try {
      const recruiterId = req.recruiter?.recruiterId;
      if (!recruiterId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const recruiter = await storage.getRecruiterById(recruiterId);
      if (!recruiter) {
        return res.status(404).json({ message: "Recruiter not found" });
      }

      res.json(recruiter);
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({ message: "Failed to fetch profile", error: error.message });
    }
  });

  // Update Recruiter Profile
  app.put('/api/recruiter/profile', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
  app.put('/api/recruiter/company', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
  app.put('/api/recruiter/change-password', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateRecruiterPassword(recruiterId, hashedPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Failed to change password", error: error.message });
    }
  });

  // Generate PayUMoney Payment Hash
  app.post('/api/recruiter/generate-payment-hash', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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
  app.post('/api/recruiter/payment-success', async (req: Request, res: Response) => {
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
  app.post('/api/recruiter/payment-failed', async (req: Request, res: Response) => {
    try {
      const { txnid } = req.body;
      res.redirect(`/recruiter/payment-failed?txnid=${txnid}`);
    } catch (error: any) {
      console.error("Payment failure handler error:", error);
      res.redirect('/recruiter/payment-failed');
    }
  });

  // Access Interview Video with Credit Deduction
  app.post('/api/recruiter/access-interview-video', authenticateRecruiterToken, async (req: AuthenticatedRecruiterRequest, res: Response) => {
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

      if (parseFloat(recruiter.creditsBalance) < 2) {
        return res.status(400).json({ message: "Insufficient credits. Interview videos require 2 credits." });
      }

      // Get interview details
      const interview = await storage.getInterviewById(interviewId);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      if (!interview.videoUrl) {
        return res.status(404).json({ message: "Video not available for this interview" });
      }

      // Deduct 2 credits
      const newBalance = parseFloat(recruiter.creditsBalance) - 2;
      await storage.updateRecruiterCredits(recruiterId, newBalance);

      // Log the credit transaction
      await storage.createCreditTransaction({
        recruiterId,
        amount: -2,
        type: 'deduction',
        description: `Interview video access - Candidate ${candidateId}`,
        metadata: { interviewId, candidateId }
      });

      // Log profile access
      await storage.logProfileAccess({
        recruiterId,
        candidateId: parseInt(candidateId),
        accessType: 'interview_video',
        creditsUsed: 2
      });

      res.json({ 
        videoUrl: interview.videoUrl,
        creditsRemaining: recruiter.credits - 2,
        message: "Video access granted. 2 credits deducted."
      });

    } catch (error: any) {
      console.error("Interview video access error:", error);
      res.status(500).json({ message: "Failed to access interview video", error: error.message });
    }
  });
}