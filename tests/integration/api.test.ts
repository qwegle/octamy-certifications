import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';
import { cleanupTestData, setupTestData } from '../setup';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

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

  describe('Exam Endpoints', () => {
    it('POST /api/courses/:id/questions should create exam session', async () => {
      const response = await request(app)
        .post(`/api/courses/${testData.testCourse.id}/questions`)
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.questions).toBeDefined();
      expect(Array.isArray(response.body.questions)).toBe(true);
    });

    it('POST /api/exam/submit should submit exam answers', async () => {
      // First start exam
      const startResponse = await request(app)
        .post(`/api/courses/${testData.testCourse.id}/questions`)
        .expect(200);

      const { sessionId, questions } = startResponse.body;
      const answers = Object.fromEntries(
        questions.map((question: { id: number }) => [String(question.id), 0]),
      );

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
