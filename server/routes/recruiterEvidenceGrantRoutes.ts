import crypto from "node:crypto";
import { Router, type Request, type RequestHandler, type Response } from "express";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  candidateEvidenceAccessEvents,
  candidateEvidenceGrantCertificates,
  candidateEvidenceGrantPracticeSummaries,
  candidateEvidenceGrants,
  certificates,
  courses,
  examAttempts,
  profileAccessLogs,
  recruiters,
} from "@shared/schema";
import { db } from "../db";
import { authenticateToken } from "../middleware/auth";
import { authenticateRecruiterToken, type AuthenticatedRecruiterRequest } from "./recruiterRoutes";
import {
  CANDIDATE_EVIDENCE_POLICY_VERSION,
  RECRUITER_EVIDENCE_CACHE_HEADERS,
  candidateEvidenceExpiry,
  createCandidateEvidenceGrantSchema,
  evaluateRecruiterEvidenceDisclosure,
  revokeCandidateEvidenceGrantSchema,
  type RecruiterEvidenceCertificate,
  type RecruiterEvidencePracticeSummary,
} from "../lib/recruiter-evidence-policy";

const router = Router();
// Evidence authorization and history are sensitive, time-dependent data. Apply
// the same cache prohibition to learner and recruiter responses, including
// errors, so a browser or intermediary cannot replay a pre-revocation view.
router.use((_req, res, next) => {
  noStore(res);
  next();
});
const requireLearner = authenticateToken as RequestHandler;
const requireRecruiter = authenticateRecruiterToken as RequestHandler;
const grantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function requestId(req: Request) {
  const value = String((req as Request & { requestId?: string }).requestId || crypto.randomUUID());
  return value.slice(0, 64);
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] } | null)?.rows || []);
}

function noStore(res: Response) {
  res.set(RECRUITER_EVIDENCE_CACHE_HEADERS);
}

function grantStatus(grant: { revokedAt: Date | null; expiresAt: Date }) {
  if (grant.revokedAt) return "revoked" as const;
  if (grant.expiresAt.getTime() <= Date.now()) return "expired" as const;
  return "active" as const;
}

async function selectedEvidenceForGrant(grantId: string) {
  const [certificationRows, practiceRows] = await Promise.all([
    db.select({
      id: certificates.id,
      certificateId: certificates.certificateId,
      courseTitle: certificates.courseTitle,
      score: certificates.score,
      badge: certificates.badge,
      issuedAt: certificates.issuedAt,
      expiresAt: certificates.expiresAt,
      issuedBy: certificates.issuedBy,
    }).from(candidateEvidenceGrantCertificates)
      .innerJoin(certificates, eq(certificates.id, candidateEvidenceGrantCertificates.certificateId))
      .where(eq(candidateEvidenceGrantCertificates.grantId, grantId))
      .orderBy(desc(certificates.issuedAt)),
    db.select({
      id: examAttempts.id,
      courseTitle: courses.title,
      score: examAttempts.score,
      totalQuestions: examAttempts.totalQuestions,
      durationSeconds: examAttempts.timeTaken,
      passed: examAttempts.passed,
      mastered: examAttempts.mastered,
      completedAt: examAttempts.createdAt,
    }).from(candidateEvidenceGrantPracticeSummaries)
      .innerJoin(examAttempts, eq(examAttempts.id, candidateEvidenceGrantPracticeSummaries.examAttemptId))
      .innerJoin(courses, eq(courses.id, examAttempts.courseId))
      .where(eq(candidateEvidenceGrantPracticeSummaries.grantId, grantId))
      .orderBy(desc(examAttempts.createdAt)),
  ]);
  return { certifications: certificationRows, practiceSummaries: practiceRows };
}

// A prior paid profile-view interaction is the narrow relationship gate for
// grant targeting. It is not evidence consent and does not authorize this API.
router.get("/user/evidence-grants/eligible-recruiters", requireLearner, async (req: any, res) => {
  try {
    const learnerUserId = Number(req.user.userId);
    const eligible = await db.selectDistinctOn([recruiters.id], {
      id: recruiters.id,
      companyName: recruiters.companyName,
      companyWebsite: recruiters.companyWebsite,
      industry: recruiters.industry,
      interactionAt: profileAccessLogs.createdAt,
    }).from(profileAccessLogs)
      .innerJoin(recruiters, eq(recruiters.id, profileAccessLogs.recruiterId))
      .where(and(
        eq(profileAccessLogs.userId, learnerUserId),
        eq(profileAccessLogs.accessType, "profile_view"),
        eq(recruiters.isActive, true),
        eq(recruiters.kycStatus, "approved"),
      ))
      .orderBy(recruiters.id, desc(profileAccessLogs.createdAt))
      .limit(100);
    return res.json({ recruiters: eligible });
  } catch (error) {
    console.error("List eligible evidence recruiters failed", error);
    return res.status(500).json({ message: "Failed to list eligible recruiters" });
  }
});

// Strict allowlist used by a learner to preview selectable evidence. Practice
// rows are exam-attempt summaries only; no answers or integrity telemetry are selected.
router.get("/user/evidence-grants/options", requireLearner, async (req: any, res) => {
  try {
    const learnerUserId = Number(req.user.userId);
    const now = new Date();
    const [certificationRows, practiceRows] = await Promise.all([
      db.select({
        id: certificates.id,
        certificateId: certificates.certificateId,
        courseTitle: certificates.courseTitle,
        score: certificates.score,
        badge: certificates.badge,
        issuedAt: certificates.issuedAt,
        expiresAt: certificates.expiresAt,
        issuedBy: certificates.issuedBy,
      }).from(certificates)
        .innerJoin(courses, eq(courses.id, certificates.courseId))
        .where(and(
          eq(certificates.userId, learnerUserId),
          eq(certificates.isActive, true),
          eq(certificates.isPaid, true),
          gt(certificates.expiresAt, now),
          eq(courses.productType, "assessment"),
          eq(courses.assessmentPurpose, "certification"),
          sql`${courses.certificationMode} <> 'none'`,
          eq(courses.isActive, true),
          eq(courses.reviewStatus, "approved"),
        )).orderBy(desc(certificates.issuedAt)),
      db.select({
        id: examAttempts.id,
        courseTitle: courses.title,
        score: examAttempts.score,
        totalQuestions: examAttempts.totalQuestions,
        durationSeconds: examAttempts.timeTaken,
        passed: examAttempts.passed,
        mastered: examAttempts.mastered,
        completedAt: examAttempts.createdAt,
      }).from(examAttempts)
        .innerJoin(courses, eq(courses.id, examAttempts.courseId))
        .where(and(
          eq(examAttempts.userId, learnerUserId),
          eq(courses.productType, "assessment"),
          eq(courses.assessmentPurpose, "practice"),
          eq(courses.isActive, true),
          eq(courses.reviewStatus, "approved"),
        )).orderBy(desc(examAttempts.createdAt)),
    ]);
    return res.json({ certifications: certificationRows, practiceSummaries: practiceRows });
  } catch (error) {
    console.error("List evidence grant options failed", error);
    return res.status(500).json({ message: "Failed to load selectable evidence" });
  }
});

router.post("/user/evidence-grants", requireLearner, async (req: any, res) => {
  const parsed = createCandidateEvidenceGrantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid evidence grant", details: parsed.error.issues });
  const now = new Date();
  const expiresAt = candidateEvidenceExpiry(parsed.data, now);
  if (!expiresAt) return res.status(400).json({ message: "Expiry must be in the next 30 days" });

  try {
    const learnerUserId = Number(req.user.userId);
    const grant = await db.transaction(async (tx) => {
      const [interaction] = await tx.select({
        id: profileAccessLogs.id,
      }).from(profileAccessLogs)
        .innerJoin(recruiters, eq(recruiters.id, profileAccessLogs.recruiterId))
        .where(and(
          eq(profileAccessLogs.userId, learnerUserId),
          eq(profileAccessLogs.recruiterId, parsed.data.targetRecruiterId),
          eq(profileAccessLogs.accessType, "profile_view"),
          eq(recruiters.isActive, true),
          eq(recruiters.kycStatus, "approved"),
        )).orderBy(desc(profileAccessLogs.createdAt)).limit(1);
      if (!interaction) throw new EvidenceGrantRequestError("Recruiter is not eligible for a grant", "RECRUITER_INTERACTION_REQUIRED");

      const eligibleCertificates = await tx.select({ id: certificates.id }).from(certificates)
        .innerJoin(courses, eq(courses.id, certificates.courseId))
        .where(and(
          inArray(certificates.id, parsed.data.certificateIds),
          eq(certificates.userId, learnerUserId),
          eq(certificates.isActive, true),
          eq(certificates.isPaid, true),
          gt(certificates.expiresAt, now),
          eq(courses.productType, "assessment"),
          eq(courses.assessmentPurpose, "certification"),
          sql`${courses.certificationMode} <> 'none'`,
          eq(courses.isActive, true),
          eq(courses.reviewStatus, "approved"),
        ));
      if (eligibleCertificates.length !== parsed.data.certificateIds.length) {
        throw new EvidenceGrantRequestError("Every certificate must be current and learner-owned", "CERTIFICATE_INELIGIBLE");
      }

      if (parsed.data.practiceSummaryIds.length > 0) {
        const eligiblePractice = await tx.select({ id: examAttempts.id }).from(examAttempts)
          .innerJoin(courses, eq(courses.id, examAttempts.courseId))
          .where(and(
            inArray(examAttempts.id, parsed.data.practiceSummaryIds),
            eq(examAttempts.userId, learnerUserId),
            eq(courses.productType, "assessment"),
            eq(courses.assessmentPurpose, "practice"),
            eq(courses.isActive, true),
            eq(courses.reviewStatus, "approved"),
          ));
        if (eligiblePractice.length !== parsed.data.practiceSummaryIds.length) {
          throw new EvidenceGrantRequestError("Every summary must be learner-owned non-Interview practice evidence", "PRACTICE_SUMMARY_INELIGIBLE");
        }
      }

      const id = crypto.randomUUID();
      const [created] = await tx.insert(candidateEvidenceGrants).values({
        id,
        learnerUserId,
        targetRecruiterId: parsed.data.targetRecruiterId,
        sourceProfileAccessLogId: interaction.id,
        purpose: parsed.data.purpose,
        jobReference: parsed.data.jobReference || null,
        consentVersion: parsed.data.consentVersion,
        grantedAt: now,
        expiresAt,
        creationRequestId: requestId(req),
      }).returning();
      await tx.insert(candidateEvidenceGrantCertificates).values(
        parsed.data.certificateIds.map((certificateId) => ({ grantId: id, certificateId })),
      );
      if (parsed.data.practiceSummaryIds.length > 0) {
        await tx.insert(candidateEvidenceGrantPracticeSummaries).values(
          parsed.data.practiceSummaryIds.map((examAttemptId) => ({ grantId: id, examAttemptId })),
        );
      }
      return created;
    });
    return res.status(201).json({ grant: { ...grant, status: grantStatus(grant) } });
  } catch (error) {
    if (error instanceof EvidenceGrantRequestError) {
      return res.status(409).json({ message: error.message, code: error.code });
    }
    console.error("Create evidence grant failed", error);
    return res.status(500).json({ message: "Failed to create evidence grant" });
  }
});

router.get("/user/evidence-grants", requireLearner, async (req: any, res) => {
  try {
    const learnerUserId = Number(req.user.userId);
    const grants = await db.select({
      id: candidateEvidenceGrants.id,
      targetRecruiterId: candidateEvidenceGrants.targetRecruiterId,
      recruiterCompany: recruiters.companyName,
      purpose: candidateEvidenceGrants.purpose,
      jobReference: candidateEvidenceGrants.jobReference,
      consentVersion: candidateEvidenceGrants.consentVersion,
      grantedAt: candidateEvidenceGrants.grantedAt,
      expiresAt: candidateEvidenceGrants.expiresAt,
      revokedAt: candidateEvidenceGrants.revokedAt,
      revocationReason: candidateEvidenceGrants.revocationReason,
      version: candidateEvidenceGrants.version,
    }).from(candidateEvidenceGrants)
      .innerJoin(recruiters, eq(recruiters.id, candidateEvidenceGrants.targetRecruiterId))
      .where(eq(candidateEvidenceGrants.learnerUserId, learnerUserId))
      .orderBy(desc(candidateEvidenceGrants.grantedAt))
      .limit(100);
    const result = await Promise.all(grants.map(async (grant) => ({
      ...grant,
      status: grantStatus(grant),
      selectedEvidence: await selectedEvidenceForGrant(grant.id),
    })));
    return res.json({ grants: result });
  } catch (error) {
    console.error("List evidence grants failed", error);
    return res.status(500).json({ message: "Failed to list evidence grants" });
  }
});

router.post("/user/evidence-grants/:grantId/revoke", requireLearner, async (req: any, res) => {
  const parsed = revokeCandidateEvidenceGrantSchema.safeParse(req.body);
  if (!grantIdPattern.test(req.params.grantId) || !parsed.success) {
    return res.status(400).json({ message: "Invalid revocation request" });
  }
  try {
    const learnerUserId = Number(req.user.userId);
    const [revoked] = await db.update(candidateEvidenceGrants).set({
      revokedAt: new Date(),
      revocationReason: parsed.data.reason || "Revoked by learner",
      version: sql`${candidateEvidenceGrants.version} + 1`,
    }).where(and(
      eq(candidateEvidenceGrants.id, req.params.grantId),
      eq(candidateEvidenceGrants.learnerUserId, learnerUserId),
      eq(candidateEvidenceGrants.version, parsed.data.version),
      isNull(candidateEvidenceGrants.revokedAt),
    )).returning({
      id: candidateEvidenceGrants.id,
      revokedAt: candidateEvidenceGrants.revokedAt,
      version: candidateEvidenceGrants.version,
    });
    if (!revoked) {
      const [existing] = await db.select({ id: candidateEvidenceGrants.id })
        .from(candidateEvidenceGrants)
        .where(and(eq(candidateEvidenceGrants.id, req.params.grantId), eq(candidateEvidenceGrants.learnerUserId, learnerUserId)))
        .limit(1);
      return existing
        ? res.status(409).json({ message: "Grant changed or was already revoked", code: "GRANT_VERSION_CONFLICT" })
        : res.status(404).json({ message: "Grant not found" });
    }
    return res.json({ grant: { ...revoked, status: "revoked" } });
  } catch (error) {
    console.error("Revoke evidence grant failed", error);
    return res.status(500).json({ message: "Failed to revoke evidence grant" });
  }
});

router.get("/user/evidence-grants/access-history", requireLearner, async (req: any, res) => {
  try {
    const learnerUserId = Number(req.user.userId);
    const events = await db.select({
      id: candidateEvidenceAccessEvents.id,
      grantId: candidateEvidenceAccessEvents.grantId,
      recruiterId: candidateEvidenceAccessEvents.recruiterId,
      recruiterCompany: recruiters.companyName,
      action: candidateEvidenceAccessEvents.action,
      scopes: candidateEvidenceAccessEvents.scopes,
      selectedCertificateIds: candidateEvidenceAccessEvents.selectedCertificateIds,
      selectedPracticeSummaryIds: candidateEvidenceAccessEvents.selectedPracticeSummaryIds,
      requestId: candidateEvidenceAccessEvents.requestId,
      policyVersion: candidateEvidenceAccessEvents.policyVersion,
      occurredAt: candidateEvidenceAccessEvents.occurredAt,
    }).from(candidateEvidenceAccessEvents)
      .innerJoin(recruiters, eq(recruiters.id, candidateEvidenceAccessEvents.recruiterId))
      .where(eq(candidateEvidenceAccessEvents.learnerUserId, learnerUserId))
      .orderBy(desc(candidateEvidenceAccessEvents.occurredAt), desc(candidateEvidenceAccessEvents.id))
      .limit(200);
    return res.json({ events });
  } catch (error) {
    console.error("List evidence access history failed", error);
    return res.status(500).json({ message: "Failed to list evidence access history" });
  }
});

router.get(
  "/recruiter/selected-candidates/:learnerId/evidence-grants",
  requireRecruiter,
  async (req: AuthenticatedRecruiterRequest, res: Response) => {
    noStore(res);
    const recruiterId = Number(req.recruiter?.recruiterId);
    const learnerUserId = Number(req.params.learnerId);
    if (!Number.isInteger(learnerUserId) || learnerUserId <= 0) {
      return res.status(400).json({ message: "Invalid selected candidate" });
    }
    try {
      const [recruiter] = await db.select({
        id: recruiters.id,
        isActive: recruiters.isActive,
        kycStatus: recruiters.kycStatus,
      }).from(recruiters).where(eq(recruiters.id, recruiterId)).limit(1);
      if (!recruiter?.isActive) return res.status(403).json({ message: "Recruiter workspace is inactive" });
      if (recruiter.kycStatus !== "approved") return res.status(403).json({ message: "KYC approval is required" });

      const [interaction] = await db.select({ id: profileAccessLogs.id }).from(profileAccessLogs).where(and(
        eq(profileAccessLogs.recruiterId, recruiterId),
        eq(profileAccessLogs.userId, learnerUserId),
        eq(profileAccessLogs.accessType, "profile_view"),
      )).limit(1);
      if (!interaction) return res.status(404).json({ message: "Selected candidate is not available" });

      const grants = await db.select({
        id: candidateEvidenceGrants.id,
        purpose: candidateEvidenceGrants.purpose,
        jobReference: candidateEvidenceGrants.jobReference,
        grantedAt: candidateEvidenceGrants.grantedAt,
        expiresAt: candidateEvidenceGrants.expiresAt,
      }).from(candidateEvidenceGrants).where(and(
        eq(candidateEvidenceGrants.targetRecruiterId, recruiterId),
        eq(candidateEvidenceGrants.learnerUserId, learnerUserId),
        isNull(candidateEvidenceGrants.revokedAt),
        gt(candidateEvidenceGrants.expiresAt, new Date()),
      )).orderBy(desc(candidateEvidenceGrants.grantedAt)).limit(20);
      return res.json({ grants });
    } catch (error) {
      console.error("List selected candidate grants failed", error);
      return res.status(500).json({ message: "Failed to list selected candidate grants" });
    }
  },
);

router.get(
  "/recruiter/selected-candidates/:learnerId/evidence/:grantId",
  requireRecruiter,
  async (req: AuthenticatedRecruiterRequest, res: Response) => {
    noStore(res);
    const recruiterId = Number(req.recruiter?.recruiterId);
    const learnerUserId = Number(req.params.learnerId);
    const grantId = req.params.grantId;
    if (!Number.isInteger(learnerUserId) || learnerUserId <= 0 || !grantIdPattern.test(grantId)) {
      return res.status(400).json({ message: "Invalid selected-candidate evidence request" });
    }

    try {
      const disclosure = await db.transaction(async (tx) => {
        // The row lock serializes this read with learner revocation. Under READ
        // COMMITTED, a revocation that obtains the lock first is observed after
        // this statement waits, so the request fails closed before disclosure.
        const grantRows = rowsOf<any>(await tx.execute(sql`
          SELECT
            grant_row.id,
            grant_row.learner_user_id,
            grant_row.target_recruiter_id,
            grant_row.purpose,
            grant_row.job_reference,
            grant_row.consent_version,
            grant_row.granted_at,
            grant_row.expires_at,
            grant_row.revoked_at,
            recruiter.id AS recruiter_id,
            recruiter.is_active AS recruiter_is_active,
            recruiter.kyc_status AS recruiter_kyc_status,
            EXISTS (
              SELECT 1 FROM profile_access_logs interaction
              WHERE interaction.recruiter_id = grant_row.target_recruiter_id
                AND interaction.user_id = grant_row.learner_user_id
                AND interaction.access_type = 'profile_view'
            ) AS has_exact_profile_interaction
          FROM candidate_evidence_grants grant_row
          INNER JOIN recruiters recruiter ON recruiter.id = grant_row.target_recruiter_id
          WHERE grant_row.id = ${grantId}
          FOR UPDATE OF grant_row
        `));
        const row = grantRows[0] || null;

        const certificateRows = await tx.select({
          id: certificates.id,
          learnerUserId: certificates.userId,
          certificateId: certificates.certificateId,
          courseTitle: certificates.courseTitle,
          score: certificates.score,
          badge: certificates.badge,
          issuedAt: certificates.issuedAt,
          expiresAt: certificates.expiresAt,
          issuedBy: certificates.issuedBy,
          isActive: certificates.isActive,
          isPaid: certificates.isPaid,
          courseProductType: courses.productType,
          assessmentPurpose: courses.assessmentPurpose,
          certificationMode: courses.certificationMode,
          courseIsActive: courses.isActive,
          courseReviewStatus: courses.reviewStatus,
        }).from(candidateEvidenceGrantCertificates)
          .innerJoin(certificates, eq(certificates.id, candidateEvidenceGrantCertificates.certificateId))
          .innerJoin(courses, eq(courses.id, certificates.courseId))
          .where(eq(candidateEvidenceGrantCertificates.grantId, grantId));

        const practiceRows = await tx.select({
          id: examAttempts.id,
          learnerUserId: examAttempts.userId,
          courseTitle: courses.title,
          score: examAttempts.score,
          totalQuestions: examAttempts.totalQuestions,
          timeTaken: examAttempts.timeTaken,
          passed: examAttempts.passed,
          mastered: examAttempts.mastered,
          completedAt: examAttempts.createdAt,
          courseProductType: courses.productType,
          assessmentPurpose: courses.assessmentPurpose,
          courseIsActive: courses.isActive,
          courseReviewStatus: courses.reviewStatus,
        }).from(candidateEvidenceGrantPracticeSummaries)
          .innerJoin(examAttempts, eq(examAttempts.id, candidateEvidenceGrantPracticeSummaries.examAttemptId))
          .innerJoin(courses, eq(courses.id, examAttempts.courseId))
          .where(eq(candidateEvidenceGrantPracticeSummaries.grantId, grantId));

        const policy = evaluateRecruiterEvidenceDisclosure({
          now: new Date(),
          authenticatedRecruiterId: recruiterId,
          requestedLearnerId: learnerUserId,
          recruiter: row ? {
            id: Number(row.recruiter_id),
            isActive: row.recruiter_is_active === true,
            kycStatus: String(row.recruiter_kyc_status),
          } : null,
          grant: row ? {
            id: String(row.id),
            learnerUserId: Number(row.learner_user_id),
            targetRecruiterId: Number(row.target_recruiter_id),
            purpose: String(row.purpose),
            jobReference: row.job_reference == null ? null : String(row.job_reference),
            consentVersion: String(row.consent_version),
            grantedAt: row.granted_at,
            expiresAt: row.expires_at,
            revokedAt: row.revoked_at,
          } : null,
          hasExactProfileInteraction: row?.has_exact_profile_interaction === true,
          certificates: certificateRows as RecruiterEvidenceCertificate[],
          practiceSummaries: practiceRows.map((practice) => ({
            ...practice,
            sourceType: "exam_attempt",
          })) as RecruiterEvidencePracticeSummary[],
        });
        if (!policy.allowed) return policy;

        await tx.insert(candidateEvidenceAccessEvents).values({
          grantId,
          learnerUserId,
          recruiterId,
          action: "evidence_disclosed",
          scopes: policy.payload.scopes,
          selectedCertificateIds: policy.payload.certifications.map((item) => item.id),
          selectedPracticeSummaryIds: policy.payload.practiceSummaries.map((item) => item.id),
          requestId: requestId(req),
          policyVersion: CANDIDATE_EVIDENCE_POLICY_VERSION,
        });
        return policy;
      });

      if (!disclosure.allowed) {
        const gone = disclosure.code === "GRANT_REVOKED" || disclosure.code === "GRANT_EXPIRED";
        const notFound = disclosure.code === "GRANT_NOT_FOUND" || disclosure.code === "GRANT_TARGET_MISMATCH";
        return res.status(notFound ? 404 : gone ? 410 : 403).json({
          message: "Selected evidence is not available",
          code: disclosure.code,
        });
      }
      return res.json({ ...disclosure.payload, policyVersion: CANDIDATE_EVIDENCE_POLICY_VERSION });
    } catch (error) {
      console.error("Recruiter selected evidence failed", error);
      return res.status(500).json({ message: "Failed to load selected evidence" });
    }
  },
);

class EvidenceGrantRequestError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "EvidenceGrantRequestError";
  }
}

export default router;
