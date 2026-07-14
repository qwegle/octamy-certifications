import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  categories,
  certificates,
  cohorts,
  cohortStudents,
  courses,
  examAttempts,
  institutes,
  recruiters,
  users,
} from '../../shared/schema';
import { testDb, testPool } from '../setup';

const password = 'OctamyRecruiter2026!';

describe('recruiter discovery and wallet safety', () => {
  let app: Express;
  const createdResumePaths: string[] = [];

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL must point to a disposable database');
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'recruiter-integration-secret';
    process.env.AUTO_APPROVE_PROFILES = 'false';

    const { registerRoutes } = await import('../../server/routes');
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    await registerRoutes(app);
  });

  afterEach(async () => {
    try {
      await testPool.query('TRUNCATE TABLE recruiters, users, categories, institutes CASCADE');
      await Promise.all(createdResumePaths.splice(0).map((filePath) => unlink(filePath).catch(() => undefined)));
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message || 'no message'}` : String(error);
      throw new Error(`Recruiter test cleanup failed: ${detail}`, { cause: error });
    }
  });

  async function registerRecruiter() {
    const response = await request(app)
      .post('/api/recruiter/register')
      .send({ email: '  Recruiter.Smoke@Example.COM ', password })
      .expect(201);

    expect(response.body.recruiter.email).toBe('recruiter.smoke@example.com');
    expect(response.body.recruiter.kycStatus).toBe('pending');
    expect(response.body.recruiter.creditsBalance).toBe('0.00');
    return response.body as { token: string; recruiter: { id: number } };
  }

  async function addEvidence(
    candidate: typeof users.$inferSelect,
    course: typeof courses.$inferSelect,
    options: { paid?: boolean; active?: boolean; expiresAt?: Date } = {},
  ) {
    const [attempt] = await testDb.insert(examAttempts).values({
      userId: candidate.id,
      courseId: course.id,
      userEmail: candidate.email,
      userName: candidate.name,
      score: 88,
      totalQuestions: 10,
      answers: {},
      timeTaken: 600,
      passed: true,
    }).returning();
    const suffix = `${candidate.id}-${attempt.id}`;
    await testDb.insert(certificates).values({
      certificateId: `RECRUITER-SMOKE-${suffix}`,
      certificateNumber: `OCT-SMOKE-${suffix}`,
      examAttemptId: attempt.id,
      courseId: course.id,
      userId: candidate.id,
      userEmail: candidate.email,
      userName: candidate.name,
      courseTitle: course.title,
      score: 88,
      badge: 'gold',
      isPaid: options.paid ?? true,
      isActive: options.active ?? true,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
    });
  }

  it('normalizes auth identity, rejects duplicates, and blocks inactive workspaces', async () => {
    const registered = await registerRecruiter();

    await request(app)
      .post('/api/recruiter/register')
      .send({ email: 'RECRUITER.SMOKE@EXAMPLE.COM', password })
      .expect(400);
    await request(app)
      .post('/api/recruiter/login')
      .send({ email: 'not-an-email', password })
      .expect(400);

    const login = await request(app)
      .post('/api/recruiter/login')
      .send({ email: ' Recruiter.Smoke@Example.com ', password })
      .expect(200);
    expect(login.body.token).toBeTruthy();

    const { storage } = await import('../../server/storage');
    const creditResults = await Promise.all([
      storage.purchaseCredits(registered.recruiter.id, 100, 'RC_RECRUITER_SMOKE_PAID_ORDER'),
      storage.purchaseCredits(registered.recruiter.id, 100, 'RC_RECRUITER_SMOKE_PAID_ORDER'),
    ]).catch((error: unknown) => {
      const detail = error instanceof Error ? `${error.name}: ${error.message || 'no message'}` : String(error);
      throw new Error(`Concurrent recruiter credit purchase failed: ${detail}`, { cause: error });
    });
    const [firstCredit, repeatedCredit] = creditResults;
    expect([firstCredit.creditsAdded, repeatedCredit.creditsAdded].sort((a, b) => a - b)).toEqual([0, 100]);
    expect(firstCredit.newBalance).toBe('100.00');
    expect(repeatedCredit.newBalance).toBe('100.00');
    const purchaseRows = await testPool.query(
      'SELECT amount, balance_after FROM credit_transactions WHERE recruiter_id = $1 AND external_reference = $2',
      [registered.recruiter.id, 'RC_RECRUITER_SMOKE_PAID_ORDER'],
    );
    expect(purchaseRows.rows).toEqual([{ amount: '100.00', balance_after: '100.00' }]);

    await testDb.update(recruiters).set({ isActive: false }).where(eq(recruiters.id, registered.recruiter.id));
    await request(app)
      .post('/api/recruiter/login')
      .send({ email: 'recruiter.smoke@example.com', password })
      .expect(403);
  });

  it('enforces evidence and consent gates and charges each unlock only once', async () => {
    const registered = await registerRecruiter();
    const auth = { Authorization: `Bearer ${registered.token}` };

    await request(app).post('/api/recruiter/search').set(auth).send({ filters: {} }).expect(403);
    await testDb.update(recruiters).set({ kycStatus: 'approved', creditsBalance: '3.00' })
      .where(eq(recruiters.id, registered.recruiter.id));

    const [category] = await testDb.insert(categories).values({
      name: 'Recruiter smoke',
      description: 'Disposable recruiter integration data',
      icon: 'ShieldCheck',
      slug: 'recruiter-smoke',
    }).returning();
    const [course] = await testDb.insert(courses).values({
      title: 'Verified Skills Evidence',
      description: 'Disposable recruiter integration data',
      slug: 'verified-skills-evidence',
      categoryId: category.id,
      duration: 30,
      passingScore: 70,
      price: '499.00',
      level: 'intermediate',
      isActive: true,
    }).returning();

    const candidateRows = await testDb.insert(users).values([
      { name: 'Eligible no experience', email: 'eligible-null@example.com', profileVisibility: true, experience: null },
      { name: 'Eligible senior', email: 'eligible-senior@example.com', profileVisibility: true, experience: 35 },
      { name: 'Hidden learner', email: 'hidden@example.com', profileVisibility: false, experience: 2 },
      { name: 'Unpaid evidence', email: 'unpaid@example.com', profileVisibility: true, experience: 2 },
      { name: 'Expired evidence', email: 'expired@example.com', profileVisibility: true, experience: 2 },
      { name: 'Institute blocked', email: 'institute-blocked@example.com', profileVisibility: true, experience: 2 },
      { name: 'Institute allowed', email: 'institute-allowed@example.com', profileVisibility: true, experience: 2 },
    ]).returning();
    const [eligibleNoExperience, eligibleSenior, hidden, unpaid, expired, instituteBlocked, instituteAllowed] = candidateRows;

    await addEvidence(eligibleNoExperience, course);
    await addEvidence(eligibleSenior, course);
    await addEvidence(hidden, course);
    await addEvidence(unpaid, course, { paid: false });
    await addEvidence(expired, course, { expiresAt: new Date(Date.now() - 60_000) });
    await addEvidence(instituteBlocked, course);
    await addEvidence(instituteAllowed, course);

    const [blockedInstitute, allowedInstitute] = await testDb.insert(institutes).values([
      { slug: 'blocked-institute', name: 'Blocked Institute', status: 'verified', recruiterDiscoveryEnabled: false },
      { slug: 'allowed-institute', name: 'Allowed Institute', status: 'verified', recruiterDiscoveryEnabled: true },
    ]).returning();
    const [blockedCohort, allowedCohort] = await testDb.insert(cohorts).values([
      { instituteId: blockedInstitute.id, name: 'Blocked cohort' },
      { instituteId: allowedInstitute.id, name: 'Allowed cohort' },
    ]).returning();
    await testDb.insert(cohortStudents).values([
      { instituteId: blockedInstitute.id, cohortId: blockedCohort.id, userId: instituteBlocked.id, email: instituteBlocked.email, status: 'active' },
      { instituteId: allowedInstitute.id, cohortId: allowedCohort.id, userId: instituteAllowed.id, email: instituteAllowed.email, status: 'active' },
    ]);

    const search = await request(app)
      .post('/api/recruiter/search')
      .set(auth)
      .send({ filters: { experience: { min: '', max: '' } }, page: 1, limit: 20 })
      .expect(200);
    const visibleIds = search.body.candidates.map((candidate: { id: number }) => candidate.id);
    expect(visibleIds).toEqual(expect.arrayContaining([eligibleNoExperience.id, eligibleSenior.id, instituteAllowed.id]));
    expect(visibleIds).not.toEqual(expect.arrayContaining([hidden.id, unpaid.id, expired.id, instituteBlocked.id]));
    expect(search.body.eligibility).toEqual({
      learnerConsentRequired: true,
      activePaidEvidenceRequired: true,
      institutePolicyRequiredForActiveAffiliations: true,
    });

    const [firstUnlock, retryUnlock] = await Promise.all([
      request(app).post('/api/recruiter/access-profile').set(auth).send({ candidateId: eligibleNoExperience.id, accessType: 'view' }),
      request(app).post('/api/recruiter/access-profile').set(auth).send({ candidateId: eligibleNoExperience.id, accessType: 'view' }),
    ]);
    expect(firstUnlock.status).toBe(200);
    expect(retryUnlock.status).toBe(200);
    expect([firstUnlock.body.creditsUsed, retryUnlock.body.creditsUsed].sort()).toEqual([0, 1]);

    const walletAfterUnlock = await request(app).get('/api/recruiter/wallet').set(auth).expect(200);
    expect(walletAfterUnlock.body.balance).toBe('2.00');
    expect(walletAfterUnlock.body.transactions).toHaveLength(1);
    await request(app).get(`/api/recruiter/candidate/${eligibleNoExperience.id}`).set(auth).expect(200);

    await testDb.update(users).set({ profileVisibility: false }).where(eq(users.id, eligibleNoExperience.id));
    await request(app).get(`/api/recruiter/candidate/${eligibleNoExperience.id}`).set(auth).expect(404);
    await request(app)
      .post('/api/recruiter/access-profile')
      .set(auth)
      .send({ candidateId: eligibleNoExperience.id, accessType: 'view' })
      .expect(404);
    const walletAfterWithdrawal = await request(app).get('/api/recruiter/wallet').set(auth).expect(200);
    expect(walletAfterWithdrawal.body.balance).toBe('2.00');

    await request(app)
      .post('/api/recruiter/access-profile')
      .set(auth)
      .send({ candidateId: eligibleSenior.id, accessType: 'cv' })
      .expect(404);
    const walletAfterUnavailableCv = await request(app).get('/api/recruiter/wallet').set(auth).expect(200);
    expect(walletAfterUnavailableCv.body.balance).toBe('2.00');

    const resumeFileName = `resume-${eligibleSenior.id}-recruiter-smoke.pdf`;
    const resumePath = path.join(process.cwd(), 'uploads', 'resumes', resumeFileName);
    await mkdir(path.dirname(resumePath), { recursive: true });
    await writeFile(resumePath, '%PDF-1.4\n% disposable recruiter smoke fixture\n');
    createdResumePaths.push(resumePath);
    await testDb.update(users)
      .set({ resume: `/api/uploads/resumes/${resumeFileName}` })
      .where(eq(users.id, eligibleSenior.id));

    const cvUnlock = await request(app)
      .post('/api/recruiter/access-profile')
      .set(auth)
      .send({ candidateId: eligibleSenior.id, accessType: 'cv' })
      .expect(200);
    expect(cvUnlock.body.creditsUsed).toBe(1);
    expect(cvUnlock.body.remainingCredits).toBe('1.00');
    await request(app).get(cvUnlock.body.cvUrl).expect(401);
    const cvDownload = await request(app).get(cvUnlock.body.cvUrl).set(auth).expect(200);
    expect(cvDownload.headers['content-type']).toContain('application/pdf');

    const repeatedCvUnlock = await request(app)
      .post('/api/recruiter/access-profile')
      .set(auth)
      .send({ candidateId: eligibleSenior.id, accessType: 'cv' })
      .expect(200);
    expect(repeatedCvUnlock.body.creditsUsed).toBe(0);
    expect(repeatedCvUnlock.body.remainingCredits).toBe('1.00');

    await testDb.update(institutes).set({ recruiterDiscoveryEnabled: false }).where(eq(institutes.id, allowedInstitute.id));
    const afterInstituteWithdrawal = await request(app)
      .post('/api/recruiter/search')
      .set(auth)
      .send({ filters: {}, page: 1, limit: 20 })
      .expect(200);
    expect(afterInstituteWithdrawal.body.candidates.map((candidate: { id: number }) => candidate.id)).not.toContain(instituteAllowed.id);

    await testDb.update(recruiters).set({ isActive: false }).where(eq(recruiters.id, registered.recruiter.id));
    await request(app).post('/api/recruiter/search').set(auth).send({ filters: {} }).expect(403);
    await request(app).get(`/api/recruiter/candidate/${eligibleSenior.id}`).set(auth).expect(403);
  });
});
