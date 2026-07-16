import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';
import { and, eq } from 'drizzle-orm';
import { cleanupTestData, setupTestData, testDb } from '../setup';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import {
  interviewStudioDailyUsage,
  interviewStudioEvaluationJobs,
  interviewStudioEvents,
  interviewStudioSessions,
  interviewStudioTemplates,
} from '../../shared/schema';
import {
  INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
  canonicalizeInterviewStudioBlueprint,
  type InterviewStudioBlueprint,
} from '../../shared/interview-studio';

const interviewStudioTestBlueprint: InterviewStudioBlueprint = {
  schemaVersion: INTERVIEW_STUDIO_BLUEPRINT_SCHEMA_VERSION,
  templateKey: 'integration.frontend-foundations',
  version: 1,
  title: 'Frontend Foundations Interview',
  summary: 'A disposable private-practice interview used only by integration tests.',
  role: 'Frontend Engineer',
  level: 'foundation',
  skills: ['JavaScript', 'Communication'],
  allowedModes: ['practice'],
  estimatedDurationMinutes: 5,
  rubricVersion: 'integration-rubric-v1',
  items: [
    {
      key: 'communication.answer',
      kind: 'structured_response',
      title: 'Explain a technical decision',
      competency: 'Communication',
      timeLimitSeconds: 120,
      instructions: 'Explain the decision, trade-offs, and resulting outcome.',
      prompt: 'Describe a frontend technical decision and the trade-offs you considered.',
      responseFormat: 'text_or_transient_voice',
      minimumWords: 0,
      maximumWords: 20,
      rubric: [{
        key: 'communication.clarity',
        label: 'Clarity',
        description: 'Explains the decision and trade-offs with concrete evidence.',
        weight: 100,
      }],
    },
    {
      key: 'coding.sum',
      kind: 'coding',
      title: 'Sum two integers',
      competency: 'JavaScript',
      timeLimitSeconds: 180,
      instructions: 'Read two integers from stdin and print their sum to stdout.',
      language: 'javascript',
      runtime: INTERVIEW_STUDIO_JAVASCRIPT_RUNTIME,
      interface: 'stdin_stdout',
      problemStatement: 'Read two integer values from standard input and print their sum.',
      starterCode: "const fs = require('node:fs');\n",
      constraints: ['Inputs are safe integers.'],
      testCases: [
        {
          key: 'public.basic',
          title: 'Public basic case',
          visibility: 'public',
          input: '2 3\n',
          expectedOutput: '5\n',
          weight: 50,
        },
        {
          key: 'hidden.negative-secret',
          title: 'Never expose this hidden title',
          visibility: 'hidden',
          input: '-17 4\n',
          expectedOutput: '-13\n',
          weight: 50,
        },
      ],
      rubric: [{
        key: 'coding.correctness',
        label: 'Correctness',
        description: 'Produces correct output for the governed test cases.',
        weight: 100,
      }],
    },
  ],
};

function interviewStudioBlueprintHash() {
  return crypto.createHash('sha256')
    .update(canonicalizeInterviewStudioBlueprint(interviewStudioTestBlueprint), 'utf8')
    .digest('hex');
}

describe('API Integration Tests', () => {
  let app: Express;
  let testData: any;
  let userToken: string;
  let adminToken: string;
  let storage: any;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error(
        'TEST_DATABASE_URL is required for API integration tests. It must point to a disposable database.',
      );
    }

    // The application reads DATABASE_URL at module load. Keep integration tests
    // isolated by explicitly wiring it to the disposable test database before
    // importing any server modules.
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET ||= 'test-secret';
    process.env.PAYMENT_DEFAULT_GATEWAY = 'payu';
    process.env.PAYUMONEY_MERCHANT_ID = 'test-merchant';
    process.env.PAYUMONEY_MERCHANT_KEY = 'test-key';
    process.env.PAYUMONEY_SALT = 'test-salt';
    process.env.INTERVIEW_STUDIO_ENABLED = 'true';
    process.env.INTERVIEW_STUDIO_DAILY_EVALUATION_LIMIT = '10';

    const { registerRoutes } = await import('../../server/routes');
    const { DatabaseStorage } = await import('../../server/storage');
    storage = new DatabaseStorage();
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    await registerRoutes(app);
  });

  beforeEach(async () => {
    await cleanupTestData();
    testData = await setupTestData();
    
    // Generate test tokens
    userToken = jwt.sign(
      { userId: testData.testUser.id, email: testData.testUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
    
    adminToken = jwt.sign(
      { userId: testData.adminUser.id, email: testData.adminUser.email, isAdmin: true },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Authentication Endpoints', () => {
    it('POST /api/register should create new user', async () => {
      const userData = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/register')
        .send(userData)
        .expect(201);

      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.token).toBeDefined();
    });

    it('POST /api/login should authenticate user', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          email: testData.testUser.email,
          password: 'password123' // This should match hashed password in setup
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(testData.testUser.email);
    });

    it('POST /api/login should reject a missing password without a server error', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({ email: testData.testUser.email })
        .expect(400);

      expect(response.body.message).toBe('Email and password are required');
    });

    it('POST /api/admin/login should authenticate admin', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({
          email: testData.adminUser.email,
          password: 'admin123'
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
    });
  });

  describe('Course Endpoints', () => {
    it('GET /api/courses should return all courses', async () => {
      const response = await request(app)
        .get('/api/courses')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('GET /api/courses/slug/:slug should return specific course', async () => {
      const response = await request(app)
        .get(`/api/courses/slug/${testData.testCourse.slug}`)
        .expect(200);

      expect(response.body.id).toBe(testData.testCourse.id);
      expect(response.body.title).toBe(testData.testCourse.title);
    });

    it('GET /api/categories should return all categories', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((cat: any) => cat.id === testData.testCategory.id)).toBe(true);
    });
  });

  describe('Interview Studio Endpoints', () => {
    let templateId: number;

    beforeEach(async () => {
      const [template] = await testDb.insert(interviewStudioTemplates).values({
        templateKey: interviewStudioTestBlueprint.templateKey,
        version: interviewStudioTestBlueprint.version,
        ownerType: 'admin',
        ownerId: null,
        title: interviewStudioTestBlueprint.title,
        summary: interviewStudioTestBlueprint.summary,
        state: 'published',
        isCurrent: true,
        supportedModes: ['practice'],
        rubricVersion: interviewStudioTestBlueprint.rubricVersion,
        blueprint: interviewStudioTestBlueprint,
        blueprintHash: interviewStudioBlueprintHash(),
        publishedAt: new Date(),
        createdBy: testData.adminUser.id,
      }).returning({ id: interviewStudioTemplates.id });
      templateId = template.id;
    });

    function createPracticeSession(token = userToken, consent: Record<string, unknown> = {}) {
      return request(app)
        .post('/api/interview-studio/sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          templateId,
          mode: 'practice',
          consent: {
            aiProcessing: true,
            microphone: false,
            camera: true,
            screen: true,
            consentVersion: 'interview-practice-2026-07-16',
            ...consent,
          },
        });
    }

    function startPracticeSession(sessionId: string, token = userToken) {
      return request(app)
        .post(`/api/interview-studio/sessions/${sessionId}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({ permissions: { camera: true, microphone: false, screen: true } });
    }

    it('requires authentication and redacts every hidden test detail from template and session payloads', async () => {
      await request(app)
        .get('/api/interview-studio/templates')
        .expect(401);

      const templatesResponse = await request(app)
        .get('/api/interview-studio/templates')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(templatesResponse.headers['cache-control']).toContain('no-store');
      expect(templatesResponse.body.items).toHaveLength(1);
      const codingItem = templatesResponse.body.items[0].blueprint.items.find(
        (item: { key: string }) => item.key === 'coding.sum',
      );
      expect(codingItem.testCases).toEqual([
        expect.objectContaining({
          key: 'public.basic',
          visibility: 'public',
          input: '2 3\n',
          expectedOutput: '5\n',
        }),
      ]);
      expect(codingItem.testCaseSummary).toEqual({ publicCount: 1, hiddenCount: 1, totalCount: 2 });

      const created = await createPracticeSession().expect(201);
      expect(created.body.status).toBe('ready');
      expect(created.body.deadlineAt).toBeNull();
      const serializedCreation = JSON.stringify(created.body);
      expect(serializedCreation).not.toContain('hidden.negative-secret');
      expect(serializedCreation).not.toContain('Never expose this hidden title');
      expect(serializedCreation).not.toContain('-17 4');
      expect(serializedCreation).not.toContain('-13');

      const resumed = await request(app)
        .get(`/api/interview-studio/sessions/${created.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(JSON.stringify(resumed.body)).not.toContain('hidden.negative-secret');
      expect(resumed.body.blueprint.items.find((item: { key: string }) => item.key === 'coding.sum').testCaseSummary)
        .toEqual({ publicCount: 1, hiddenCount: 1, totalCount: 2 });
    });

    it('enforces learner ownership, server timing, autosave shape, and structured-response word limits', async () => {
      const created = await createPracticeSession().expect(201);
      const sessionId = created.body.id as string;

      await request(app)
        .get(`/api/interview-studio/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      await startPracticeSession(sessionId, adminToken).expect(404);

      const started = await startPracticeSession(sessionId).expect(200);
      expect(started.body.status).toBe('in_progress');
      expect(new Date(started.body.deadlineAt).getTime()).toBeGreaterThan(new Date(started.body.startedAt).getTime());
      expect(started.body.permissions).toMatchObject({
        camera: { required: true, state: 'granted' },
        microphone: { required: false, state: 'not_requested' },
        screen: { required: true, state: 'granted' },
      });

      const tooManyWords = Array.from({ length: 21 }, (_value, index) => `word${index}`).join(' ');
      const rejected = await request(app)
        .put(`/api/interview-studio/sessions/${sessionId}/responses/communication.answer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ answerText: tooManyWords, timeSpentSeconds: 12 })
        .expect(422);
      expect(rejected.body.code).toBe('INTERVIEW_RESPONSE_WORD_LIMIT');

      const saved = await request(app)
        .put(`/api/interview-studio/sessions/${sessionId}/responses/communication.answer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ answerText: 'I chose composition to isolate state and make behavior easier to test.', timeSpentSeconds: 37 })
        .expect(200);
      expect(saved.body.saved).toBe(true);
      expect(saved.body.response).toMatchObject({
        itemKey: 'communication.answer',
        itemKind: 'structured_response',
        timeSpentSeconds: 37,
      });

      await request(app)
        .put(`/api/interview-studio/sessions/${sessionId}/responses/communication.answer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ answerText: 'An unauthorized replacement.' })
        .expect(404);

      const resumed = await request(app)
        .get(`/api/interview-studio/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(resumed.body.responses).toEqual([
        expect.objectContaining({
          itemKey: 'communication.answer',
          answerText: 'I chose composition to isolate state and make behavior easier to test.',
          timeSpentSeconds: 37,
        }),
      ]);
    });

    it('accepts only allowlisted browser telemetry and replaces browser timestamps with server time', async () => {
      const created = await createPracticeSession().expect(201);
      const sessionId = created.body.id as string;
      await startPracticeSession(sessionId).expect(200);

      await request(app)
        .post(`/api/interview-studio/sessions/${sessionId}/events`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventType: 'focus_left',
          metadata: {
            itemKey: 'communication.answer',
            deviceFingerprint: 'must-never-be-persisted',
          },
        })
        .expect(400);

      await request(app)
        .post(`/api/interview-studio/sessions/${sessionId}/events`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ eventType: 'keystrokes_captured', metadata: {} })
        .expect(400);

      await request(app)
        .post(`/api/interview-studio/sessions/${sessionId}/events`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          eventType: 'focus_left',
          idempotencyKey: 'browser-focus-left-0001',
          occurredAt: '2001-01-01T00:00:00.000Z',
          severity: 'warning',
          metadata: { itemKey: 'communication.answer' },
        })
        .expect(202);

      const persisted = await testDb.select().from(interviewStudioEvents)
        .where(and(
          eq(interviewStudioEvents.sessionId, sessionId),
          eq(interviewStudioEvents.type, 'focus_left'),
        ));
      expect(persisted).toHaveLength(1);
      expect(persisted[0].payload).toEqual({ itemKey: 'communication.answer' });
      expect(persisted[0].occurredAt.getUTCFullYear()).toBeGreaterThan(2020);
      expect(JSON.stringify(persisted[0])).not.toContain('must-never-be-persisted');
    });

    it('returns 202 and atomically persists one evaluation job, one usage charge, and immutable submission state', async () => {
      const created = await createPracticeSession().expect(201);
      const sessionId = created.body.id as string;
      await startPracticeSession(sessionId).expect(200);
      await request(app)
        .put(`/api/interview-studio/sessions/${sessionId}/responses/communication.answer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ answerText: 'I used an explicit interface and verified the behavior with focused tests.', timeSpentSeconds: 42 })
        .expect(200);

      const submitted = await request(app)
        .post(`/api/interview-studio/sessions/${sessionId}/submit`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(202);
      expect(submitted.body).toMatchObject({ status: 'evaluating', evaluationStatus: 'pending' });

      const [storedSession] = await testDb.select().from(interviewStudioSessions)
        .where(eq(interviewStudioSessions.id, sessionId));
      const jobs = await testDb.select().from(interviewStudioEvaluationJobs)
        .where(eq(interviewStudioEvaluationJobs.sessionId, sessionId));
      const usage = await testDb.select().from(interviewStudioDailyUsage)
        .where(eq(interviewStudioDailyUsage.userId, testData.testUser.id));
      const submissionEvents = await testDb.select().from(interviewStudioEvents)
        .where(and(
          eq(interviewStudioEvents.sessionId, sessionId),
          eq(interviewStudioEvents.type, 'session_submitted'),
        ));

      expect(storedSession).toMatchObject({ status: 'evaluating', evaluationStatus: 'pending' });
      expect(storedSession.submittedAt).toBeInstanceOf(Date);
      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ status: 'queued', attempts: 0 });
      expect(usage).toHaveLength(1);
      expect(usage[0].evaluationJobs).toBe(1);
      expect(submissionEvents).toHaveLength(1);

      await request(app)
        .post(`/api/interview-studio/sessions/${sessionId}/submit`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(202);
      expect(await testDb.select().from(interviewStudioEvaluationJobs)
        .where(eq(interviewStudioEvaluationJobs.sessionId, sessionId))).toHaveLength(1);
      expect((await testDb.select().from(interviewStudioDailyUsage)
        .where(eq(interviewStudioDailyUsage.userId, testData.testUser.id)))[0].evaluationJobs).toBe(1);

      await request(app)
        .put(`/api/interview-studio/sessions/${sessionId}/responses/communication.answer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ answerText: 'This late replacement must be rejected.' })
        .expect(409);
    });

    it('lets only the owning learner delete private practice data', async () => {
      const created = await createPracticeSession().expect(201);
      const sessionId = created.body.id as string;

      await request(app)
        .delete(`/api/interview-studio/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      await request(app)
        .delete(`/api/interview-studio/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);
      await request(app)
        .get(`/api/interview-studio/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
      expect(await testDb.select().from(interviewStudioSessions)
        .where(eq(interviewStudioSessions.id, sessionId))).toHaveLength(0);
    });
  });

  describe('Exam Endpoints', () => {
    it('requires explicit browser-evidence consent before issuing an exam session', async () => {
      const response = await request(app)
        .post(`/api/courses/${testData.testCourse.id}/questions`)
        .send({})
        .expect(400);

      expect(response.body.code).toBe('EVIDENCE_CONSENT_REQUIRED');
    });

    it('POST /api/courses/:id/questions should create exam session', async () => {
      const response = await request(app)
        .post(`/api/courses/${testData.testCourse.id}/questions`)
        .send({ evidenceConsent: true })
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.questions).toBeDefined();
      expect(Array.isArray(response.body.questions)).toBe(true);
    });

    it('POST /api/exam/submit should submit exam answers', async () => {
      // First start exam
      const startResponse = await request(app)
        .post(`/api/courses/${testData.testCourse.id}/questions`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ evidenceConsent: true })
        .expect(200);

      const { sessionId, questions } = startResponse.body;
      const answers = Object.fromEntries(
        questions.map((question: { id: number }) => [String(question.id), 0]),
      );

      await request(app)
        .post('/api/exam/submit')
        .send({
          courseId: testData.testCourse.id,
          sessionId,
          answers,
          userEmail: testData.testUser.email,
          userName: testData.testUser.name,
        })
        .expect(403);

      const submitResponse = await request(app)
        .post('/api/exam/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courseId: testData.testCourse.id,
          sessionId,
          answers,
          timeTaken: Math.max(questions.length, 1),
          userEmail: testData.testUser.email,
          userName: testData.testUser.name,
        })
        .expect(200);

      expect(submitResponse.body.tempExamId).toBeDefined();
      expect(submitResponse.body.score).toBeDefined();
      expect(submitResponse.body.passed).toBeDefined();

      const replayResponse = await request(app)
        .post('/api/exam/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courseId: testData.testCourse.id,
          sessionId,
          answers,
          // This deliberately differs: the server must replay the immutable
          // first result and never trust a client-reported elapsed time.
          timeTaken: 999999,
          userEmail: testData.testUser.email,
          userName: testData.testUser.name,
        })
        .expect(200);

      expect(replayResponse.body.tempExamId).toBe(submitResponse.body.tempExamId);
      expect(replayResponse.body.score).toBe(submitResponse.body.score);
    });

    it('should prevent exam submission without valid session', async () => {
      await request(app)
        .post('/api/exam/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courseId: testData.testCourse.id,
          sessionId: 'invalid-session',
          answers: {},
          timeTaken: 1800
        })
        .expect(400);
    });
  });

  describe('Admin Endpoints', () => {
    it('GET /api/admin/courses should return admin course data', async () => {
      const response = await request(app)
        .get('/api/admin/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('POST /api/admin/courses should create new course', async () => {
      const courseData = {
        title: 'Admin Created Course',
        description: 'Course created via API',
        categoryId: testData.testCategory.id,
        duration: 120,
        passingScore: 75,
        price: '199.00',
        level: 'intermediate',
        isActive: true,
        isInternship: false
      };

      const response = await request(app)
        .post('/api/admin/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(courseData)
        .expect(201);

      expect(response.body.title).toBe(courseData.title);
      expect(response.body.slug).toBe('admin-created-course');
    });

    it('PUT /api/admin/courses/:id should update course', async () => {
      const updates = {
        title: 'Updated Course Title',
        price: '299.00'
      };

      const response = await request(app)
        .put(`/api/admin/courses/${testData.testCourse.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.title).toBe(updates.title);
      expect(response.body.price).toBe(updates.price);
    });

    it('should reject admin operations without admin token', async () => {
      await request(app)
        .get('/api/admin/courses')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('Certificate Endpoints', () => {
    async function createPendingCredential(overrides: Record<string, unknown> = {}) {
      const attempt = await storage.createExamAttempt({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        userEmail: testData.testUser.email,
        userName: testData.testUser.name,
        score: 88,
        totalQuestions: 2,
        answers: { '1': 1, '2': 2 },
        timeTaken: 90,
        passed: true,
        mastered: false,
        sessionId: `activation-${Date.now()}-${Math.random()}`,
      });
      return storage.createCertificate({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: attempt.id,
        certificateId: `OCT-ACT-${Date.now()}-${Math.random()}`,
        certificateNumber: `OCT-ACT-NUM-${Date.now()}-${Math.random()}`,
        userEmail: testData.testUser.email,
        userName: testData.testUser.name,
        courseTitle: testData.testCourse.title,
        score: 88,
        badge: 'gold',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        isPaid: false,
        isActive: true,
        ...overrides,
      });
    }

    it('GET /api/user/certificates should return user certificates', async () => {
      const certResponse = await request(app)
        .get('/api/user/certificates')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(certResponse.body)).toBe(true);
    });

    it('GET /api/certificates/verify/:certificateId should verify certificate', async () => {
      // This test would need a valid certificate ID
      // For now, test with invalid ID
      await request(app)
        .get('/api/certificates/verify/INVALID-CERT-ID')
        .expect(404);
    });

    it('loads an owned pending credential through the private activation contract', async () => {
      const certificate = await createPendingCredential();

      const response = await request(app)
        .get(`/api/certificates/${encodeURIComponent(certificate.certificateId)}/activation`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.pricing.digital).toBe(testData.testCourse.price);
      expect(response.body.pricing.physicalShipping).toBe('50.00');
      expect(response.body).not.toHaveProperty('userEmail');
      expect(response.body).not.toHaveProperty('courseId');
    });

    it('recovers an unclaimed legacy pending credential by the account email', async () => {
      const certificate = await createPendingCredential({ userId: null });

      const dashboard = await request(app)
        .get('/api/user/certificates')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(dashboard.body.some((item: any) => item.certificateId === certificate.certificateId)).toBe(true);

      const activation = await request(app)
        .get(`/api/certificates/${encodeURIComponent(certificate.certificateId)}/activation`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      expect(activation.body.status).toBe('ready');
    });

    it('does not disclose another learner credential through activation checkout', async () => {
      const certificate = await createPendingCredential();

      const response = await request(app)
        .get(`/api/certificates/${encodeURIComponent(certificate.certificateId)}/activation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.code).toBe('CREDENTIAL_NOT_FOUND');
    });

    it('uses server-owned identity and price when initiating legacy credential activation', async () => {
      const certificate = await createPendingCredential();

      const response = await request(app)
        .post('/api/payment/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          certificateId: certificate.certificateId,
          amount: '0.01',
          courseId: testData.testCourse.id + 999,
          userEmail: 'attacker@example.com',
          userName: 'Attacker',
        })
        .expect(200);

      expect(response.body.gateway).toBe('payumoney');
      expect(response.body.amount).toBe(testData.testCourse.price);
      expect(response.body.paymentForm.fields.amount).toBe(testData.testCourse.price);
      expect(response.body.paymentForm.fields.email).toBe(testData.testUser.email);
      expect(response.body.paymentForm.fields.firstname).toBe(testData.testUser.name);
      expect(response.body.paymentForm.fields.udf1).toBe(String(testData.testCourse.id));
      expect(response.body.paymentForm.fields.udf5).toBe(`credential:${certificate.certificateId}`);
    });

    it('prevents a second payable checkout while one activation order is open', async () => {
      const certificate = await createPendingCredential();
      const body = { certificateId: certificate.certificateId };

      await request(app)
        .post('/api/payment/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(body)
        .expect(200);

      const duplicate = await request(app)
        .post('/api/payment/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(body)
        .expect(409);

      expect(duplicate.body.code).toBe('CHECKOUT_ALREADY_OPEN');
    });

    it('activates the existing legacy credential exactly once after a verified PayU callback', async () => {
      const certificate = await createPendingCredential();
      const checkout = await request(app)
        .post('/api/payment/initiate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ certificateId: certificate.certificateId })
        .expect(200);
      const fields = checkout.body.paymentForm.fields;
      const callback = {
        ...fields,
        status: 'success',
        unmappedstatus: 'captured',
        mihpayid: 'PAYU-ACTIVATION-001',
      };
      const responseHashInput = [
        process.env.PAYUMONEY_SALT,
        callback.status,
        '', '', '', '', '',
        callback.udf5,
        callback.udf4,
        callback.udf3,
        callback.udf2,
        callback.udf1,
        callback.email,
        callback.firstname,
        callback.productinfo,
        callback.amount,
        callback.txnid,
        process.env.PAYUMONEY_MERCHANT_KEY,
      ].join('|');
      callback.hash = crypto.createHash('sha512').update(responseHashInput).digest('hex');

      const firstCallback = await request(app)
        .post('/api/payment/success')
        .type('form')
        .send(callback)
        .expect(302);
      expect(firstCallback.headers.location).toContain(
        `certificateId=${encodeURIComponent(certificate.certificateId)}`,
      );

      const activated = await storage.getCertificate(certificate.id);
      expect(activated.isPaid).toBe(true);
      expect(activated.paymentId).toBe(callback.mihpayid);
      expect(new Date(activated.expiresAt).getTime()).toBeGreaterThan(Date.now());

      await request(app)
        .post('/api/payment/success')
        .type('form')
        .send(callback)
        .expect(302);
      const payment = await storage.getPaymentByTransactionId(callback.txnid);
      expect(payment.status).toBe('completed');
      expect(payment.certificateId).toBe(certificate.id);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);
    });

    it('should return 401 for protected routes without token', async () => {
      await request(app)
        .get('/api/user/certificates')
        .expect(401);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app)
        .post('/api/register')
        .set('Content-Type', 'application/json')
        .send('{"name":')
        .expect(400);
    });
  });
});
