import crypto from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { certificates, courses, examAttempts, users } from '@shared/schema';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const requireUser = authenticateToken as RequestHandler;

function evidenceSecret() {
  const secret = process.env.EVIDENCE_LINK_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('EVIDENCE_LINK_SECRET or JWT_SECRET is required');
  return secret;
}

function signatureFor(userId: number) {
  return crypto
    .createHmac('sha256', evidenceSecret())
    .update(`octamy-evidence-passport:${userId}`)
    .digest('base64url')
    .slice(0, 22);
}

function createEvidenceToken(userId: number) {
  return `${userId.toString(36)}.${signatureFor(userId)}`;
}

function readEvidenceToken(token: string) {
  const [encodedId, suppliedSignature, extra] = token.split('.');
  if (extra || !encodedId || !suppliedSignature || !/^[a-z0-9]+$/.test(encodedId)) return null;

  const userId = Number.parseInt(encodedId, 36);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;

  const expected = Buffer.from(signatureFor(userId));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  return userId;
}

function evidenceStatus(record: { isPaid: boolean; isActive: boolean; expiresAt: Date }) {
  if (!record.isPaid) return 'pending_activation' as const;
  if (!record.isActive) return 'revoked' as const;
  if (record.expiresAt.getTime() <= Date.now()) return 'expired' as const;
  return 'active' as const;
}

router.get('/user/evidence-passport-link', requireUser, async (req: any, res) => {
  try {
    const userId = Number(req.user?.userId);
    const [user] = await db
      .select({ evidencePassportPublic: users.evidencePassportPublic })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = createEvidenceToken(userId);
    return res.json({ token, path: `/evidence/${token}`, isPublic: user.evidencePassportPublic === true });
  } catch (error) {
    console.error('Evidence passport link error:', error);
    return res.status(500).json({ message: 'Failed to create evidence passport link' });
  }
});

router.get('/evidence/:token', async (req, res) => {
  try {
    const userId = readEvidenceToken(req.params.token);
    if (!userId) return res.status(404).json({ message: 'Evidence passport not found' });

    const [holder] = await db
      .select({
        name: users.name,
        currentRole: users.currentRole,
        location: users.location,
        bio: users.bio,
        skills: users.skills,
        workType: users.workType,
        portfolioUrl: users.portfolioUrl,
        linkedinProfile: users.linkedinProfile,
        evidencePassportPublic: users.evidencePassportPublic,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Private and unknown passports deliberately share a response to prevent
    // learner-account enumeration.
    if (!holder || holder.evidencePassportPublic !== true) {
      return res.status(404).json({ message: 'Evidence passport not found' });
    }

    const records = await db
      .select({
        certificateId: certificates.certificateId,
        courseTitle: certificates.courseTitle,
        score: certificates.score,
        badge: certificates.badge,
        issuedAt: certificates.issuedAt,
        expiresAt: certificates.expiresAt,
        issuedBy: certificates.issuedBy,
        isPaid: certificates.isPaid,
        isActive: certificates.isActive,
        completedAt: examAttempts.createdAt,
        questionCount: examAttempts.totalQuestions,
        durationSeconds: examAttempts.timeTaken,
        passingScore: courses.passingScore,
        level: courses.level,
      })
      .from(certificates)
      .leftJoin(examAttempts, eq(certificates.examAttemptId, examAttempts.id))
      .leftJoin(courses, eq(certificates.courseId, courses.id))
      .where(and(eq(certificates.userId, userId), eq(certificates.isPaid, true)))
      .orderBy(desc(certificates.issuedAt));

    const evidence = records.map((record) => ({
      certificateId: record.certificateId,
      courseTitle: record.courseTitle,
      score: record.score,
      badge: record.badge,
      issuedAt: record.issuedAt,
      expiresAt: record.expiresAt,
      issuedBy: record.issuedBy,
      status: evidenceStatus(record),
      assessment: {
        completedAt: record.completedAt,
        questionCount: record.questionCount,
        durationSeconds: record.durationSeconds,
        passingScore: record.passingScore,
        level: record.level,
      },
    }));

    const activeEvidence = evidence.filter((record) => record.status === 'active');
    const averageScore = activeEvidence.length
      ? Math.round(activeEvidence.reduce((total, record) => total + record.score, 0) / activeEvidence.length)
      : null;

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json({
      holder: {
        name: holder.name,
        currentRole: holder.currentRole,
        location: holder.location,
        bio: holder.bio,
        selfReportedSkills: holder.skills || [],
        workType: holder.workType || [],
        portfolioUrl: holder.portfolioUrl,
        linkedinProfile: holder.linkedinProfile,
      },
      summary: {
        activeEvidenceCount: activeEvidence.length,
        totalEvidenceCount: evidence.length,
        averageScore,
        lastIssuedAt: evidence[0]?.issuedAt ?? null,
      },
      evidence,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Public evidence passport error:', error);
    return res.status(500).json({ message: 'Failed to load evidence passport' });
  }
});

export default router;
