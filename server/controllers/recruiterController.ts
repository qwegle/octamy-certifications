import { Request, Response } from "express";
import { db } from "../db";
import { recruiters, candidateShortlists, examAttempts, users, certificates, courses } from "../../shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { openaiService } from "../services/openaiService";

export interface AuthenticatedRecruiterRequest extends Request {
  recruiter?: {
    recruiterId: number;
    email: string;
  };
}

export class RecruiterController {
  
  // Recruiter Authentication
  async register(req: Request, res: Response) {
    try {
      const { 
        email, 
        password, 
        firstName, 
        lastName, 
        companyName, 
        companyWebsite,
        jobTitle,
        phone,
        linkedinUrl,
        companySize,
        industry 
      } = req.body;

      // Check if recruiter already exists
      const existingRecruiter = await db
        .select()
        .from(recruiters)
        .where(eq(recruiters.email, email))
        .limit(1);

      if (existingRecruiter.length > 0) {
        return res.status(400).json({ error: "Recruiter already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create recruiter
      const [newRecruiter] = await db
        .insert(recruiters)
        .values({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          companyName,
          companyWebsite,
          jobTitle,
          phone,
          linkedinUrl,
          companySize,
          industry,
        })
        .returning();

      // Generate JWT token
      const token = jwt.sign(
        { recruiterId: newRecruiter.id, email: newRecruiter.email },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        message: "Recruiter registered successfully",
        token,
        recruiter: {
          id: newRecruiter.id,
          email: newRecruiter.email,
          firstName: newRecruiter.firstName,
          lastName: newRecruiter.lastName,
          companyName: newRecruiter.companyName,
        },
      });
    } catch (error) {
      console.error("Recruiter registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Find recruiter
      const [recruiter] = await db
        .select()
        .from(recruiters)
        .where(and(eq(recruiters.email, email), eq(recruiters.isActive, true)))
        .limit(1);

      if (!recruiter) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, recruiter.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        { recruiterId: recruiter.id, email: recruiter.email },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
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
          subscriptionPlan: recruiter.subscriptionPlan,
        },
      });
    } catch (error) {
      console.error("Recruiter login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  }

  // Dashboard Analytics
  async getDashboard(req: AuthenticatedRecruiterRequest, res: Response) {
    try {
      const recruiterId = req.recruiter!.recruiterId;

      // Get shortlisted candidates count
      const shortlistedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(candidateShortlists)
        .where(eq(candidateShortlists.recruiterId, recruiterId));

      // Get candidates by status
      const candidatesByStatus = await db
        .select({
          status: candidateShortlists.status,
          count: sql<number>`count(*)`
        })
        .from(candidateShortlists)
        .where(eq(candidateShortlists.recruiterId, recruiterId))
        .groupBy(candidateShortlists.status);

      // Get recent activity
      const recentActivity = await db
        .select({
          id: candidateShortlists.id,
          candidateName: users.name,
          courseTitle: courses.title,
          status: candidateShortlists.status,
          createdAt: candidateShortlists.createdAt,
        })
        .from(candidateShortlists)
        .leftJoin(users, eq(candidateShortlists.userId, users.id))
        .leftJoin(examAttempts, eq(candidateShortlists.examAttemptId, examAttempts.id))
        .leftJoin(courses, eq(examAttempts.courseId, courses.id))
        .where(eq(candidateShortlists.recruiterId, recruiterId))
        .orderBy(desc(candidateShortlists.createdAt))
        .limit(10);

      res.json({
        totalCandidates: shortlistedCount[0]?.count || 0,
        candidatesByStatus: candidatesByStatus.reduce((acc, item) => {
          acc[item.status] = item.count;
          return acc;
        }, {} as Record<string, number>),
        recentActivity,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  }

  // Search Candidates
  async searchCandidates(req: AuthenticatedRecruiterRequest, res: Response) {
    try {
      const {
        skills,
        experienceLevel,
        location,
        courseType,
        minScore,
        isOpenToWork,
        preferredCourses,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      // Build query conditions
      let whereConditions = [
        eq(examAttempts.passed, true),
        eq(examAttempts.recruitmentReady, true),
        eq(users.isOpenToWork, true)
      ];

      if (experienceLevel) {
        whereConditions.push(eq(users.experienceLevel, experienceLevel as string));
      }

      if (location) {
        whereConditions.push(sql`${users.location} ILIKE ${'%' + location + '%'}`);
      }

      if (minScore) {
        whereConditions.push(sql`${examAttempts.score} >= ${Number(minScore)}`);
      }

      if (courseType === 'ai_interactive') {
        whereConditions.push(eq(courses.courseType, 'ai_interactive'));
      }

      if (preferredCourses) {
        whereConditions.push(eq(courses.isPreferred, true));
      }

      // Search candidates
      const candidates = await db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          experienceLevel: users.experienceLevel,
          location: users.location,
          skills: users.skills,
          preferredJobTitle: users.preferredJobTitle,
          expectedSalary: users.expectedSalary,
          linkedinUrl: users.linkedinUrl,
          githubUrl: users.githubUrl,
          portfolioUrl: users.portfolioUrl,
          bio: users.bio,
          cvFileName: users.cvFileName,
          examAttemptId: examAttempts.id,
          courseTitle: courses.title,
          courseType: courses.courseType,
          isPreferred: courses.isPreferred,
          score: examAttempts.score,
          aiAnalysis: examAttempts.aiAnalysis,
          aiTotalScore: examAttempts.aiTotalScore,
          createdAt: examAttempts.createdAt,
        })
        .from(examAttempts)
        .leftJoin(users, eq(examAttempts.userId, users.id))
        .leftJoin(courses, eq(examAttempts.courseId, courses.id))
        .where(and(...whereConditions))
        .orderBy(desc(examAttempts.score))
        .limit(Number(limit))
        .offset(offset);

      // Apply skills filter if provided
      let filteredCandidates = candidates;
      if (skills) {
        const skillsArray = (skills as string).split(',').map(s => s.trim().toLowerCase());
        filteredCandidates = candidates.filter(candidate => {
          const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
          return skillsArray.some(skill => 
            candidateSkills.some(cs => cs.includes(skill))
          );
        });
      }

      res.json({
        candidates: filteredCandidates,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredCandidates.length,
        }
      });
    } catch (error) {
      console.error("Search candidates error:", error);
      res.status(500).json({ error: "Failed to search candidates" });
    }
  }

  // Get Candidate Details
  async getCandidateDetails(req: AuthenticatedRecruiterRequest, res: Response) {
    try {
      const { userId } = req.params;

      // Get candidate profile
      const [candidate] = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(userId)))
        .limit(1);

      if (!candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Get exam history
      const examHistory = await db
        .select({
          id: examAttempts.id,
          courseTitle: courses.title,
          courseType: courses.courseType,
          isPreferred: courses.isPreferred,
          score: examAttempts.score,
          aiTotalScore: examAttempts.aiTotalScore,
          aiAnalysis: examAttempts.aiAnalysis,
          passed: examAttempts.passed,
          timeTaken: examAttempts.timeTaken,
          createdAt: examAttempts.createdAt,
        })
        .from(examAttempts)
        .leftJoin(courses, eq(examAttempts.courseId, courses.id))
        .where(and(
          eq(examAttempts.userId, Number(userId)),
          eq(examAttempts.passed, true)
        ))
        .orderBy(desc(examAttempts.createdAt));

      // Get certificates
      const certificateHistory = await db
        .select({
          id: certificates.id,
          certificateNumber: certificates.certificateNumber,
          courseTitle: certificates.courseTitle,
          score: certificates.score,
          issuedAt: certificates.issuedAt,
        })
        .from(certificates)
        .where(and(
          eq(certificates.userId, Number(userId)),
          eq(certificates.isPaid, true)
        ))
        .orderBy(desc(certificates.issuedAt));

      // Generate AI analysis of candidate
      const aiAnalysis = await openaiService.analyzeCandidateProfile(
        examHistory,
        candidate,
        examHistory.map(e => e.courseTitle || '')
      );

      res.json({
        candidate,
        examHistory,
        certificateHistory,
        aiAnalysis,
      });
    } catch (error) {
      console.error("Get candidate details error:", error);
      res.status(500).json({ error: "Failed to fetch candidate details" });
    }
  }

  // Shortlist Candidate
  async shortlistCandidate(req: AuthenticatedRecruiterRequest, res: Response) {
    try {
      const recruiterId = req.recruiter!.recruiterId;
      const { userId, examAttemptId, notes } = req.body;

      // Check if already shortlisted
      const existing = await db
        .select()
        .from(candidateShortlists)
        .where(and(
          eq(candidateShortlists.recruiterId, recruiterId),
          eq(candidateShortlists.userId, userId),
          eq(candidateShortlists.examAttemptId, examAttemptId)
        ))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: "Candidate already shortlisted" });
      }

      // Create shortlist entry
      const [shortlist] = await db
        .insert(candidateShortlists)
        .values({
          recruiterId,
          userId,
          examAttemptId,
          notes,
          status: 'interested'
        })
        .returning();

      res.status(201).json({
        message: "Candidate shortlisted successfully",
        shortlist,
      });
    } catch (error) {
      console.error("Shortlist candidate error:", error);
      res.status(500).json({ error: "Failed to shortlist candidate" });
    }
  }

  // Update Candidate Status
  async updateCandidateStatus(req: AuthenticatedRecruiterRequest, res: Response) {
    try {
      const recruiterId = req.recruiter!.recruiterId;
      const { shortlistId } = req.params;
      const { status, notes, interviewScheduled } = req.body;

      const [updated] = await db
        .update(candidateShortlists)
        .set({
          status,
          notes,
          interviewScheduled: interviewScheduled ? new Date(interviewScheduled) : undefined,
          contactedAt: status === 'contacted' ? new Date() : undefined,
        })
        .where(and(
          eq(candidateShortlists.id, Number(shortlistId)),
          eq(candidateShortlists.recruiterId, recruiterId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Shortlist entry not found" });
      }

      res.json({
        message: "Candidate status updated successfully",
        shortlist: updated,
      });
    } catch (error) {
      console.error("Update candidate status error:", error);
      res.status(500).json({ error: "Failed to update candidate status" });
    }
  }

  // Get Shortlisted Candidates
  async getShortlistedCandidates(req: AuthenticatedRecruiterRequest, res: Response) {
    try {
      const recruiterId = req.recruiter!.recruiterId;
      const { status, page = 1, limit = 20 } = req.query;

      const offset = (Number(page) - 1) * Number(limit);

      let whereConditions = [eq(candidateShortlists.recruiterId, recruiterId)];
      
      if (status) {
        whereConditions.push(eq(candidateShortlists.status, status as string));
      }

      const shortlisted = await db
        .select({
          shortlistId: candidateShortlists.id,
          status: candidateShortlists.status,
          notes: candidateShortlists.notes,
          interviewScheduled: candidateShortlists.interviewScheduled,
          contactedAt: candidateShortlists.contactedAt,
          shortlistedAt: candidateShortlists.createdAt,
          candidateName: users.name,
          candidateEmail: users.email,
          candidatePhone: users.phone,
          experienceLevel: users.experienceLevel,
          preferredJobTitle: users.preferredJobTitle,
          location: users.location,
          expectedSalary: users.expectedSalary,
          courseTitle: courses.title,
          courseType: courses.courseType,
          isPreferred: courses.isPreferred,
          score: examAttempts.score,
          aiTotalScore: examAttempts.aiTotalScore,
        })
        .from(candidateShortlists)
        .leftJoin(users, eq(candidateShortlists.userId, users.id))
        .leftJoin(examAttempts, eq(candidateShortlists.examAttemptId, examAttempts.id))
        .leftJoin(courses, eq(examAttempts.courseId, courses.id))
        .where(and(...whereConditions))
        .orderBy(desc(candidateShortlists.createdAt))
        .limit(Number(limit))
        .offset(offset);

      res.json({
        candidates: shortlisted,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: shortlisted.length,
        }
      });
    } catch (error) {
      console.error("Get shortlisted candidates error:", error);
      res.status(500).json({ error: "Failed to fetch shortlisted candidates" });
    }
  }
}

export const recruiterController = new RecruiterController();