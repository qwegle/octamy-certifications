import { describe, it, expect, beforeEach } from '@jest/globals';
import { cleanupTestData, setupTestData } from '../setup';
import { DatabaseStorage } from '../../server/storage';
import type {
  ExamAttempt,
  InsertCertificate,
  InsertExamAttempt,
} from '../../shared/schema';
import { getBadgeFromScore } from '../../server/utils';

describe('Certificate storage contracts', () => {
  let storage: DatabaseStorage;
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
    testData = await setupTestData();
  });

  async function createAttempt(
    score = 85,
    suffix = '001',
  ): Promise<ExamAttempt> {
    const attempt: InsertExamAttempt = {
      userId: testData.testUser.id,
      courseId: testData.testCourse.id,
      userEmail: testData.testUser.email,
      userName: testData.testUser.name,
      score,
      totalQuestions: 2,
      timeTaken: 120,
      answers: { '1': 1, '2': 2 },
      passed: score >= testData.testCourse.passingScore,
      mastered: score >= 90,
      sessionId: `certificate-session-${suffix}`,
    };

    return storage.createExamAttempt(attempt);
  }

  function certificateFixture(
    attempt: ExamAttempt,
    suffix = '001',
    overrides: Partial<InsertCertificate> = {},
  ): InsertCertificate {
    return {
      userId: testData.testUser.id,
      courseId: testData.testCourse.id,
      examAttemptId: attempt.id,
      certificateId: `OCT-2026-TEST-${suffix}`,
      certificateNumber: `OCT-NUMBER-${suffix}`,
      userEmail: testData.testUser.email,
      userName: testData.testUser.name,
      courseTitle: testData.testCourse.title,
      score: attempt.score,
      badge: getBadgeFromScore(attempt.score),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isPaid: false,
      isActive: true,
      ...overrides,
    };
  }

  describe('Certificate generation records', () => {
    it('creates a credential record from a passing exam attempt', async () => {
      const examAttempt = await createAttempt();
      const certificateData = certificateFixture(examAttempt);

      const certificate = await storage.createCertificate(certificateData);

      expect(certificate.id).toBeDefined();
      expect(certificate.certificateId).toBe(
        certificateData.certificateId,
      );
      expect(certificate.certificateNumber).toBe(
        certificateData.certificateNumber,
      );
      expect(certificate.examAttemptId).toBe(examAttempt.id);
      expect(certificate.userId).toBe(testData.testUser.id);
      expect(certificate.courseId).toBe(testData.testCourse.id);
      expect(certificate.userEmail).toBe(testData.testUser.email);
      expect(certificate.courseTitle).toBe(testData.testCourse.title);
      expect(certificate.isPaid).toBe(false);
      expect(certificate.isActive).toBe(true);
      expect(certificate.expiresAt).toEqual(certificateData.expiresAt);
    });

    it('enforces unique public certificate IDs', async () => {
      const firstAttempt = await createAttempt(85, '001');
      const secondAttempt = await createAttempt(85, '002');
      await storage.createCertificate(certificateFixture(firstAttempt));

      await expect(
        storage.createCertificate(
          certificateFixture(secondAttempt, '002', {
            certificateId: 'OCT-2026-TEST-001',
          }),
        ),
      ).rejects.toThrow();
    });

    it('enforces unique certificate numbers independently of public IDs', async () => {
      const firstAttempt = await createAttempt(85, '001');
      const secondAttempt = await createAttempt(85, '002');
      await storage.createCertificate(certificateFixture(firstAttempt));

      await expect(
        storage.createCertificate(
          certificateFixture(secondAttempt, '002', {
            certificateNumber: 'OCT-NUMBER-001',
          }),
        ),
      ).rejects.toThrow();
    });

    it('maps score bands with the current badge utility', () => {
      expect(getBadgeFromScore(95)).toBe('platinum');
      expect(getBadgeFromScore(85)).toBe('gold');
      expect(getBadgeFromScore(75)).toBe('silver');
      expect(getBadgeFromScore(70)).toBe('silver');
      expect(getBadgeFromScore(69)).toBe('bronze');
    });
  });

  describe('Certificate retrieval', () => {
    it('gets all credential records belonging to a learner', async () => {
      const examAttempt = await createAttempt();
      await storage.createCertificate(certificateFixture(examAttempt));

      const certificates = await storage.getUserCertificates(
        testData.testUser.id,
      );

      expect(certificates).toHaveLength(1);
      expect(certificates[0].userId).toBe(testData.testUser.id);
    });

    it('finds a credential record by its public certificate ID', async () => {
      const examAttempt = await createAttempt();
      const certificate = await storage.createCertificate(
        certificateFixture(examAttempt),
      );

      const found = await storage.getCertificateByCertificateId(
        certificate.certificateId,
      );

      expect(found?.id).toBe(certificate.id);
      expect(found?.certificateId).toBe(certificate.certificateId);
    });

    it('returns undefined for an unknown certificate ID', async () => {
      await expect(
        storage.getCertificateByCertificateId('INVALID-CERT-ID'),
      ).resolves.toBeUndefined();
    });
  });

  describe('Credential lifecycle state', () => {
    it('activates certificate access only after payment metadata is recorded', async () => {
      const examAttempt = await createAttempt();
      const certificate = await storage.createCertificate(
        certificateFixture(examAttempt),
      );

      await storage.updateCertificatePayment(certificate.id, {
        isPaid: true,
        paymentId: 'payment_test_123',
      });
      const activated = await storage.getCertificate(certificate.id);

      expect(activated?.isPaid).toBe(true);
      expect(activated?.paymentId).toBe('payment_test_123');
    });

    it('persists revocation through the active flag', async () => {
      const examAttempt = await createAttempt();
      const certificate = await storage.createCertificate(
        certificateFixture(examAttempt, '001', { isPaid: true }),
      );

      const revoked = await storage.updateCertificate(certificate.id, {
        isActive: false,
      });

      expect(revoked.isPaid).toBe(true);
      expect(revoked.isActive).toBe(false);
    });

    it('stores physical-copy requests using the current shipping fields', async () => {
      const examAttempt = await createAttempt();
      const certificate = await storage.createCertificate(
        certificateFixture(examAttempt, '001', {
          needsPhysicalCopy: true,
          shippingStatus: 'pending',
        }),
      );

      expect(certificate.needsPhysicalCopy).toBe(true);
      expect(certificate.shippingStatus).toBe('pending');
    });
  });
});
