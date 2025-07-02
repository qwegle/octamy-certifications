import { describe, it, expect, beforeEach } from '@jest/globals';
import { cleanupTestData, setupTestData } from '../setup';
import { DatabaseStorage } from '../../server/storage';

describe('Certificate System Tests', () => {
  let storage: DatabaseStorage;
  let testData: any;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
    testData = await setupTestData();
  });

  describe('Certificate Generation', () => {
    it('should create certificate for passing exam attempt', async () => {
      // First create a passing exam attempt
      const examAttempt = await storage.createExamAttempt({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
        passed: true
      });

      const certificateData = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: examAttempt.id,
        certificateId: 'OCT-2025-TEST-001',
        transactionId: 'txn_test_123',
        amount: '99.00',
        status: 'completed'
      };

      const certificate = await storage.createCertificate(certificateData);

      expect(certificate.id).toBeDefined();
      expect(certificate.certificateId).toBe(certificateData.certificateId);
      expect(certificate.userId).toBe(testData.testUser.id);
      expect(certificate.courseId).toBe(testData.testCourse.id);
      expect(certificate.status).toBe('completed');
    });

    it('should generate unique certificate ID', async () => {
      const examAttempt = await storage.createExamAttempt({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
        passed: true
      });

      const cert1Data = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: examAttempt.id,
        certificateId: 'OCT-2025-TEST-001',
        transactionId: 'txn_test_123',
        amount: '99.00',
        status: 'completed'
      };

      const cert2Data = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: examAttempt.id,
        certificateId: 'OCT-2025-TEST-002',
        transactionId: 'txn_test_456',
        amount: '99.00',
        status: 'completed'
      };

      const cert1 = await storage.createCertificate(cert1Data);
      const cert2 = await storage.createCertificate(cert2Data);

      expect(cert1.certificateId).not.toBe(cert2.certificateId);
    });

    it('should determine correct badge level based on score', async () => {
      const scores = [
        { score: 95, expectedBadge: 'platinum' },
        { score: 85, expectedBadge: 'gold' },
        { score: 75, expectedBadge: 'silver' },
        { score: 70, expectedBadge: 'bronze' }
      ];

      for (const { score, expectedBadge } of scores) {
        const examAttempt = await storage.createExamAttempt({
          userId: testData.testUser.id,
          courseId: testData.testCourse.id,
          score,
          totalQuestions: 10,
          timeTaken: 1800,
          answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
          passed: true
        });

        const certificateData = {
          userId: testData.testUser.id,
          courseId: testData.testCourse.id,
          examAttemptId: examAttempt.id,
          certificateId: `OCT-2025-TEST-${score}`,
          transactionId: `txn_test_${score}`,
          amount: '99.00',
          status: 'completed'
        };

        const certificate = await storage.createCertificate(certificateData);
        expect(certificate.badge).toBe(expectedBadge);
      }
    });
  });

  describe('Certificate Retrieval', () => {
    it('should get user certificates', async () => {
      const examAttempt = await storage.createExamAttempt({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
        passed: true
      });

      await storage.createCertificate({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: examAttempt.id,
        certificateId: 'OCT-2025-TEST-001',
        transactionId: 'txn_test_123',
        amount: '99.00',
        status: 'completed'
      });

      const certificates = await storage.getUserCertificates(testData.testUser.id);
      expect(Array.isArray(certificates)).toBe(true);
      expect(certificates.length).toBe(1);
      expect(certificates[0].userId).toBe(testData.testUser.id);
    });

    it('should verify certificate by ID', async () => {
      const examAttempt = await storage.createExamAttempt({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
        passed: true
      });

      const certificate = await storage.createCertificate({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: examAttempt.id,
        certificateId: 'OCT-2025-TEST-001',
        transactionId: 'txn_test_123',
        amount: '99.00',
        status: 'completed'
      });

      const verified = await storage.verifyCertificate(certificate.certificateId);
      expect(verified).toBeDefined();
      expect(verified?.certificateId).toBe(certificate.certificateId);
      expect(verified?.isValid).toBe(true);
    });

    it('should reject invalid certificate verification', async () => {
      const verified = await storage.verifyCertificate('INVALID-CERT-ID');
      expect(verified).toBeNull();
    });
  });

  describe('Certificate Status Management', () => {
    it('should update certificate status', async () => {
      const examAttempt = await storage.createExamAttempt({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
        passed: true
      });

      const certificate = await storage.createCertificate({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: examAttempt.id,
        certificateId: 'OCT-2025-TEST-001',
        transactionId: 'txn_test_123',
        amount: '99.00',
        status: 'pending'
      });

      const updated = await storage.updateCertificateStatus(certificate.id, 'completed');
      expect(updated.status).toBe('completed');
    });

    it('should handle physical copy requests', async () => {
      const examAttempt = await storage.createExamAttempt({
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2],
        passed: true
      });

      const certificateData = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        examAttemptId: examAttempt.id,
        certificateId: 'OCT-2025-TEST-001',
        transactionId: 'txn_test_123',
        amount: '99.00',
        status: 'completed',
        includesPhysicalCopy: true
      };

      const certificate = await storage.createCertificate(certificateData);
      expect(certificate.includesPhysicalCopy).toBe(true);
    });
  });
});