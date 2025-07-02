import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { cleanupTestData, setupTestData, testPool } from '../setup';
import { registerRoutes } from '../../server/routes';
import jwt from 'jsonwebtoken';

describe('API Integration Tests', () => {
  let app: express.Application;
  let testData: any;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = express();
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

  afterAll(async () => {
    await testPool.end();
  });

  describe('Authentication Endpoints', () => {
    it('POST /api/register should create new user', async () => {
      const userData = {
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123'
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

    it('GET /api/courses/:slug should return specific course', async () => {
      const response = await request(app)
        .get(`/api/courses/${testData.testCourse.slug}`)
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
    it('POST /api/exam/start should create exam session', async () => {
      const response = await request(app)
        .post('/api/exam/start')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ courseId: testData.testCourse.id })
        .expect(200);

      expect(response.body.sessionId).toBeDefined();
      expect(response.body.questions).toBeDefined();
      expect(Array.isArray(response.body.questions)).toBe(true);
    });

    it('POST /api/exam/submit should submit exam answers', async () => {
      // First start exam
      const startResponse = await request(app)
        .post('/api/exam/start')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ courseId: testData.testCourse.id });

      const { sessionId } = startResponse.body;

      const submitResponse = await request(app)
        .post('/api/exam/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courseId: testData.testCourse.id,
          sessionId: sessionId,
          answers: [1, 2], // Answers for the test questions
          timeTaken: 1800
        })
        .expect(200);

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
          answers: [1, 2],
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
    it('GET /api/certificates should return user certificates', async () => {
      // First create a certificate by passing an exam
      const startResponse = await request(app)
        .post('/api/exam/start')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ courseId: testData.testCourse.id });

      await request(app)
        .post('/api/exam/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          courseId: testData.testCourse.id,
          sessionId: startResponse.body.sessionId,
          answers: [1, 2], // Correct answers
          timeTaken: 1800
        });

      const certResponse = await request(app)
        .get('/api/certificates')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(certResponse.body)).toBe(true);
    });

    it('GET /api/verify/:certificateId should verify certificate', async () => {
      // This test would need a valid certificate ID
      // For now, test with invalid ID
      await request(app)
        .get('/api/verify/INVALID-CERT-ID')
        .expect(404);
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
        .post('/api/exam/start')
        .send({ courseId: testData.testCourse.id })
        .expect(401);
    });

    it('should handle malformed JSON gracefully', async () => {
      await request(app)
        .post('/api/register')
        .send('invalid json')
        .expect(400);
    });
  });
});