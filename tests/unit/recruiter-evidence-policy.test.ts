import { describe, expect, it } from "@jest/globals";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CANDIDATE_EVIDENCE_CONSENT_VERSION,
  RECRUITER_EVIDENCE_CACHE_HEADERS,
  evaluateRecruiterEvidenceDisclosure,
  type RecruiterEvidencePolicyInput,
} from "../../server/lib/recruiter-evidence-policy";

const now = new Date("2026-07-27T09:00:00.000Z");

function input(overrides: Partial<RecruiterEvidencePolicyInput> = {}): RecruiterEvidencePolicyInput {
  return {
    now,
    authenticatedRecruiterId: 10,
    requestedLearnerId: 20,
    recruiter: { id: 10, isActive: true, kycStatus: "approved" },
    grant: {
      id: "03c94882-bd08-4dda-8481-7f62900879c8",
      learnerUserId: 20,
      targetRecruiterId: 10,
      purpose: "Senior frontend engineer application",
      jobReference: "JOB-42",
      consentVersion: CANDIDATE_EVIDENCE_CONSENT_VERSION,
      grantedAt: "2026-07-26T09:00:00.000Z",
      expiresAt: "2026-08-03T09:00:00.000Z",
      revokedAt: null,
    },
    hasExactProfileInteraction: true,
    certificates: [{
      id: 101,
      learnerUserId: 20,
      certificateId: "CERT-101",
      courseTitle: "TypeScript Application Development",
      score: 88,
      badge: "gold",
      issuedAt: "2026-07-01T09:00:00.000Z",
      expiresAt: "2027-07-01T09:00:00.000Z",
      issuedBy: "Octamy",
      isActive: true,
      isPaid: true,
      courseProductType: "assessment",
      assessmentPurpose: "certification",
      certificationMode: "octamy",
      courseIsActive: true,
      courseReviewStatus: "approved",
      answers: { 1: 2 },
      ipAddress: "203.0.113.10",
      userAgent: "unsafe-agent",
      rawIntegrityEvents: [{ type: "focus_left" }],
    }],
    practiceSummaries: [],
    ...overrides,
  };
}

function denial(overrides: Partial<RecruiterEvidencePolicyInput>) {
  const result = evaluateRecruiterEvidenceDisclosure(input(overrides));
  expect(result.allowed).toBe(false);
  return result.allowed ? "unexpected" : result.code;
}

describe("recruiter selected-evidence policy", () => {
  it("denies cross-recruiter and cross-learner grant use", () => {
    expect(denial({ authenticatedRecruiterId: 11, recruiter: { id: 11, isActive: true, kycStatus: "approved" } }))
      .toBe("GRANT_TARGET_MISMATCH");
    expect(denial({ requestedLearnerId: 21 })).toBe("GRANT_TARGET_MISMATCH");
  });

  it("revalidates active and approved recruiter state plus exact interaction", () => {
    expect(denial({ recruiter: { id: 10, isActive: false, kycStatus: "approved" } })).toBe("RECRUITER_INACTIVE");
    expect(denial({ recruiter: { id: 10, isActive: true, kycStatus: "pending" } })).toBe("KYC_REQUIRED");
    expect(denial({ hasExactProfileInteraction: false })).toBe("PROFILE_INTERACTION_REQUIRED");
  });

  it("makes revocation and expiry authoritative on every read", () => {
    expect(denial({ grant: { ...input().grant!, revokedAt: "2026-07-27T08:59:59.000Z" } })).toBe("GRANT_REVOKED");
    expect(denial({ grant: { ...input().grant!, expiresAt: now } })).toBe("GRANT_EXPIRED");
  });

  it("does not turn withdrawn global discovery visibility into grant authorization", () => {
    const withDiscoveryOff = {
      ...input(),
      // Deliberately outside the policy contract: discovery is neither a grant
      // nor a grant revocation mechanism.
      profileVisibility: false,
    } as RecruiterEvidencePolicyInput & { profileVisibility: boolean };
    expect(evaluateRecruiterEvidenceDisclosure(withDiscoveryOff).allowed).toBe(true);
    expect(denial({ grant: null })).toBe("GRANT_NOT_FOUND");
  });

  it.each([
    ["ownership", { learnerUserId: 21 }],
    ["active status", { isActive: false }],
    ["payment", { isPaid: false }],
    ["expiry", { expiresAt: now }],
    ["assessment product", { courseProductType: "video_course" }],
    ["certification purpose", { assessmentPurpose: "practice" }],
    ["credential mode", { certificationMode: "none" }],
    ["course state", { courseIsActive: false }],
    ["course review", { courseReviewStatus: "pending" }],
  ])("rejects a certificate when %s revalidation fails", (_label, patch) => {
    const certificate = { ...input().certificates[0], ...patch };
    expect(denial({ certificates: [certificate] })).toBe("CERTIFICATE_INELIGIBLE");
  });

  it("returns only allowlisted certification fields", () => {
    const result = evaluateRecruiterEvidenceDisclosure(input());
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.payload.certifications).toEqual([{
      id: 101,
      certificateId: "CERT-101",
      courseTitle: "TypeScript Application Development",
      score: 88,
      badge: "gold",
      issuedAt: "2026-07-01T09:00:00.000Z",
      expiresAt: "2027-07-01T09:00:00.000Z",
      issuedBy: "Octamy",
    }]);
    const json = JSON.stringify(result.payload);
    expect(json).not.toContain("answers");
    expect(json).not.toContain("ipAddress");
    expect(json).not.toContain("userAgent");
    expect(json).not.toContain("Integrity");
    expect(json).not.toContain("lastActive");
  });

  it("allows only non-Interview practice summaries and removes answers and telemetry", () => {
    const practice = {
      id: 301,
      learnerUserId: 20,
      courseTitle: "React Practice",
      score: 72,
      totalQuestions: 20,
      timeTaken: 900,
      passed: true,
      mastered: false,
      completedAt: "2026-07-25T09:00:00.000Z",
      sourceType: "exam_attempt",
      courseProductType: "assessment",
      assessmentPurpose: "practice",
      courseIsActive: true,
      courseReviewStatus: "approved",
      answers: { 1: 3 },
      ipAddress: "198.51.100.7",
      userAgent: "unsafe-agent",
      integrityEvents: ["focus_left"],
    };
    const result = evaluateRecruiterEvidenceDisclosure(input({ practiceSummaries: [practice] }));
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    expect(result.payload.practiceSummaries).toEqual([{
      id: 301,
      courseTitle: "React Practice",
      score: 72,
      totalQuestions: 20,
      durationSeconds: 900,
      passed: true,
      mastered: false,
      completedAt: "2026-07-25T09:00:00.000Z",
    }]);
    expect(JSON.stringify(result.payload)).not.toMatch(/answers|ipAddress|userAgent|integrityEvents/);
    expect(denial({ practiceSummaries: [{ ...practice, sourceType: "interview_studio" }] }))
      .toBe("PRACTICE_SUMMARY_INELIGIBLE");
    expect(denial({ practiceSummaries: [{ ...practice, sourceType: "legacy_interview" }] }))
      .toBe("PRACTICE_SUMMARY_INELIGIBLE");
  });

  it("fails closed if the required certification selection is unexpectedly missing", () => {
    expect(denial({ certificates: [], practiceSummaries: [] })).toBe("CERTIFICATE_INELIGIBLE");
  });

  it("defines headers that prohibit stale disclosure caching", () => {
    expect(RECRUITER_EVIDENCE_CACHE_HEADERS).toEqual({
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Authorization",
    });
  });
});

describe("recruiter evidence source invariants", () => {
  const source = async (relative: string) => readFile(path.join(process.cwd(), relative), "utf8");

  it("ships 0032 after 0031 with immutable selections and append-only learner history", async () => {
    const [migration, journal] = await Promise.all([
      source("migrations/0032_recruiter_evidence_grants.sql"),
      source("migrations/meta/_journal.json"),
    ]);
    expect(journal.indexOf("0032_recruiter_evidence_grants")).toBeGreaterThan(journal.indexOf("0031_quarantine_unreviewed_practice_restore"));
    expect(migration).toContain("candidate_evidence_access_events_append_only");
    expect(migration).toContain("BEFORE UPDATE OR DELETE ON \"candidate_evidence_access_events\"");
    expect(migration).toContain("candidate_evidence_grant_certificates_immutable");
    expect(migration).toContain("candidate_evidence_grants_require_certificate");
    expect(migration).toContain("assessment_purpose\" = 'certification'");
    expect(migration).toContain("assessment_purpose\" = 'practice'");
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
  });

  it("serializes disclosure with revocation and appends history before responding", async () => {
    const route = await source("server/routes/recruiterEvidenceGrantRoutes.ts");
    const lock = route.indexOf("FOR UPDATE OF grant_row");
    const policy = route.indexOf("evaluateRecruiterEvidenceDisclosure({", lock);
    const event = route.indexOf("tx.insert(candidateEvidenceAccessEvents)", policy);
    const response = route.indexOf("return res.json({ ...disclosure.payload", event);
    expect(lock).toBeGreaterThan(0);
    expect(policy).toBeGreaterThan(lock);
    expect(event).toBeGreaterThan(policy);
    expect(response).toBeGreaterThan(event);
    expect(route).toContain("noStore(res)");
    expect(route).not.toContain("users.profileVisibility");
    expect(route).not.toMatch(/interviewStudio(Sessions|Responses|Events)/);
  });

  it("keeps profileVisibility and profile unlocks discovery-only", async () => {
    const storage = await source("server/storage.ts");
    const searchStart = storage.indexOf("async searchCandidates(");
    const profileStart = storage.indexOf("async getCandidateProfile(", searchStart);
    const accessStart = storage.indexOf("async processProfileAccess(", profileStart);
    const searchBody = storage.slice(searchStart, profileStart);
    const profileBody = storage.slice(profileStart, accessStart);
    expect(searchBody).toContain("profileVisibility");
    expect(searchBody).toContain("certificates: []");
    expect(searchBody).toContain("evidenceGrantRequired: true");
    expect(searchBody).not.toContain("certificates: certs");
    expect(profileBody).toContain("profileVisibility");
    expect(profileBody).toContain("certificates: []");
    expect(profileBody).toContain("evidenceGrantRequired: true");
    expect(profileBody).not.toContain("certificates: certs");
  });

  it("wires learner creation, revocation, access history, and dashboard navigation", async () => {
    const [app, dashboard, sharing] = await Promise.all([
      source("client/src/App.tsx"),
      source("client/src/pages/dashboard.tsx"),
      source("client/src/pages/evidence-sharing.tsx"),
    ]);
    expect(app).toContain('lazy(() => import("@/pages/evidence-sharing"))');
    expect(app).toContain('<Route path="/evidence-sharing" component={EvidenceSharing} />');
    expect(dashboard).toContain('href="/evidence-sharing"');
    expect(sharing).toContain('consentVersion: CONSENT_VERSION');
    expect(sharing).toContain('/api/user/evidence-grants/access-history');
    expect(sharing).toContain('/revoke`');
    expect(sharing).toContain('Revoke now');
    expect(sharing).toContain('Answers, questions, hidden tests, IP addresses, user agents, raw integrity events, recordings, transcripts, global activity, and Interview Studio data are never shared.');
  });

  it("renders recruiter evidence only after loading an exact active grant", async () => {
    const profile = await source("recruiter/pages/CandidateProfile.tsx");
    const grantList = profile.indexOf('/evidence-grants`');
    const exactEvidence = profile.indexOf('/evidence/${encodeURIComponent(activeGrant.id)}`', grantList);
    const assignment = profile.indexOf("certs = grantedEvidence.certifications", exactEvidence);
    expect(grantList).toBeGreaterThan(0);
    expect(exactEvidence).toBeGreaterThan(grantList);
    expect(assignment).toBeGreaterThan(exactEvidence);
    expect(profile).not.toContain("profileData.certificates");
    expect(profile).toContain("Practice is non-proctored and is not certification evidence.");
    expect(profile).toContain("Profile unlock does not disclose certification or Practice activity.");
  });
});


describe("recruiter evidence production hardening", () => {
  it("fails closed on malformed grant and certificate timestamps and unsupported consent", () => {
    expect(denial({ grant: { ...input().grant!, expiresAt: "not-a-date" } })).toBe("GRANT_EXPIRED");
    expect(denial({ grant: { ...input().grant!, consentVersion: "candidate-evidence-consent.v0" } })).toBe("CONSENT_VERSION_UNSUPPORTED");
    expect(denial({ certificates: [{ ...input().certificates[0], expiresAt: "not-a-date" }] })).toBe("CERTIFICATE_INELIGIBLE");
    expect(denial({ certificates: [{ ...input().certificates[0], certificationMode: "" }] })).toBe("CERTIFICATE_INELIGIBLE");
    expect(denial({ certificates: [{ ...input().certificates[0], certificationMode: undefined as unknown as string }] })).toBe("CERTIFICATE_INELIGIBLE");
  });

  it.each([
    ["learner ownership", { learnerUserId: 21 }],
    ["exam-attempt source", { sourceType: "interview_studio" }],
    ["assessment product", { courseProductType: "video_course" }],
    ["practice purpose", { assessmentPurpose: "certification" }],
    ["active course", { courseIsActive: false }],
    ["approved course", { courseReviewStatus: "pending" }],
  ])("rejects practice evidence when %s fails", (_label, patch) => {
    const practice = {
      id: 301,
      learnerUserId: 20,
      courseTitle: "Governed Practice",
      score: 72,
      totalQuestions: 20,
      timeTaken: 900,
      passed: true,
      mastered: false,
      completedAt: "2026-07-25T09:00:00.000Z",
      sourceType: "exam_attempt",
      courseProductType: "assessment",
      assessmentPurpose: "practice",
      courseIsActive: true,
      courseReviewStatus: "approved",
      ...patch,
    };
    expect(denial({ practiceSummaries: [practice] })).toBe("PRACTICE_SUMMARY_INELIGIBLE");
  });

  it("never copies question, answer, network, integrity, media, transcript, hidden-test, activity, or Interview Studio fields", () => {
    const forbidden = {
      answers: { one: 2 },
      question: "private prompt",
      questions: ["private prompt"],
      questionData: { correctAnswer: 2 },
      ip: "203.0.113.1",
      ipAddress: "203.0.113.1",
      userAgent: "private-agent",
      rawIntegrityEvents: [{ type: "focus_left" }],
      integrityEvents: [{ type: "focus_left" }],
      recordingUrl: "https://private.invalid/recording",
      videoUrl: "https://private.invalid/video",
      transcript: "private transcript",
      audioTranscription: "private transcript",
      hiddenTests: [{ input: "secret" }],
      finalTestResult: { hidden: true },
      lastActive: "2026-07-27T08:00:00.000Z",
      interviewStudioSession: { id: "private" },
    };
    const practice = {
      id: 301,
      learnerUserId: 20,
      courseTitle: "Governed Practice",
      score: 72,
      totalQuestions: 20,
      timeTaken: 900,
      passed: true,
      mastered: false,
      completedAt: "2026-07-25T09:00:00.000Z",
      sourceType: "exam_attempt",
      courseProductType: "assessment",
      assessmentPurpose: "practice",
      courseIsActive: true,
      courseReviewStatus: "approved",
      ...forbidden,
    };
    const result = evaluateRecruiterEvidenceDisclosure(input({
      certificates: [{ ...input().certificates[0], ...forbidden }],
      practiceSummaries: [practice],
    }));
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    for (const key of Object.keys(forbidden)) {
      expect(result.payload.certifications[0]).not.toHaveProperty(key);
      expect(result.payload.practiceSummaries[0]).not.toHaveProperty(key);
    }
    expect(Object.keys(result.payload.grant).sort()).toEqual([
      "consentVersion", "expiresAt", "grantedAt", "id", "jobReference", "learnerUserId", "purpose",
    ]);
  });

  it("binds disclosure to immutable purpose and applies no-store to the whole evidence router", async () => {
    const [migration, route, sharing] = await Promise.all([
      readFile(path.join(process.cwd(), "migrations/0032_recruiter_evidence_grants.sql"), "utf8"),
      readFile(path.join(process.cwd(), "server/routes/recruiterEvidenceGrantRoutes.ts"), "utf8"),
      readFile(path.join(process.cwd(), "client/src/pages/evidence-sharing.tsx"), "utf8"),
    ]);
    expect(migration).toContain('NEW."purpose" IS DISTINCT FROM OLD."purpose"');
    expect(migration).toContain("Evidence grant creation metadata is immutable");
    expect(route).toMatch(/router\.use\([\s\S]*noStore\(res\);[\s\S]*next\(\);/);
    expect(route).toContain("FOR UPDATE OF grant_row");
    expect(route).toContain("eq(candidateEvidenceGrants.version, parsed.data.version)");
    expect(route).toContain("isNull(candidateEvidenceGrants.revokedAt)");
    expect(sharing).toContain('aria-busy=');
    expect(sharing).toContain('role="alert"');
    expect(sharing).toContain("Grant history");
    expect(sharing).toContain("Loading append-only access history");
    expect(sharing).toContain("Try again");
  });
});
