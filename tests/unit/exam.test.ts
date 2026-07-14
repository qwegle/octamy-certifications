import { describe, it, expect, beforeEach } from '@jest/globals';
import { cleanupTestData, setupTestData } from '../setup';
import { DatabaseStorage } from '../../server/storage';
import type { InsertExamAttempt } from '../../shared/schema';

describe('Exam storage contracts', () => {
  let storage: DatabaseStorage;
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
    testData = await setupTestData();
  });

  function attemptFixture(
    overrides: Partial<InsertExamAttempt> = {},
  ): InsertExamAttempt {
    return {
      userId: testData.testUser.id,
      courseId: testData.testCourse.id,
      userEmail: testData.testUser.email,
      userName: testData.testUser.name,
      score: 85,
      totalQuestions: 2,
      timeTaken: 120,
      answers: { '1': 1, '2': 2 },
      passed: true,
      mastered: false,
      sessionId: 'test-session-123',
      tabSwitches: 0,
      ...overrides,
    };
  }

  describe('Exam attempts', () => {
    it('persists learner identity, answer mapping, and integrity metadata', async () => {
      const attemptData = attemptFixture({
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        tabSwitches: 2,
      });

      const attempt = await storage.createExamAttempt(attemptData);

      expect(attempt.id).toBeDefined();
      expect(attempt.userId).toBe(testData.testUser.id);
      expect(attempt.userEmail).toBe(testData.testUser.email);
      expect(attempt.answers).toEqual(attemptData.answers);
      expect(attempt.sessionId).toBe('test-session-123');
      expect(attempt.ipAddress).toBe('127.0.0.1');
      expect(attempt.userAgent).toBe('jest');
      expect(attempt.tabSwitches).toBe(2);
    });

    it('allows only one persisted attempt per server-issued session ID', async () => {
      await storage.createExamAttempt(attemptFixture());

      await expect(
        storage.createExamAttempt(
          attemptFixture({ score: 60, passed: false }),
        ),
      ).rejects.toThrow();
    });

    it('supports an identified anonymous attempt without a user row', async () => {
      const attempt = await storage.createExamAttempt(
        attemptFixture({
          userId: null,
          userEmail: 'candidate@example.com',
          userName: 'Guest Candidate',
          sessionId: 'anonymous-session-123',
        }),
      );

      expect(attempt.userId).toBeNull();
      expect(attempt.userEmail).toBe('candidate@example.com');
      expect(attempt.userName).toBe('Guest Candidate');
    });

    it('retrieves an attempt by its database ID', async () => {
      const created = await storage.createExamAttempt(attemptFixture());

      const attempt = await storage.getExamAttempt(created.id);

      expect(attempt?.id).toBe(created.id);
      expect(attempt?.score).toBe(85);
      expect(attempt?.passed).toBe(true);
    });

    it('gets a learner exam history and supports a course filter', async () => {
      await storage.createExamAttempt(attemptFixture());

      const allAttempts = await storage.getUserExamAttempts(
        testData.testUser.id,
      );
      const courseAttempts = await storage.getUserExamAttempts(
        testData.testUser.id,
        testData.testCourse.id,
      );

      expect(allAttempts).toHaveLength(1);
      expect(courseAttempts).toHaveLength(1);
      expect(courseAttempts[0].courseId).toBe(testData.testCourse.id);
    });

    it('preserves an explicitly failed result', async () => {
      const attempt = await storage.createExamAttempt(
        attemptFixture({ score: 65, passed: false }),
      );

      expect(attempt.score).toBe(65);
      expect(attempt.passed).toBe(false);
    });
  });

  describe('Question management', () => {
    it('gets active legacy questions for a course', async () => {
      const questions = await storage.getQuestionsByCourse(
        testData.testCourse.id,
      );

      expect(questions).toHaveLength(2);
      expect(
        questions.every(
          (question) => question.courseId === testData.testCourse.id,
        ),
      ).toBe(true);
    });

    it('creates a multiple-choice question with structured options', async () => {
      const questionData = {
        courseId: testData.testCourse.id,
        question: 'What is the result of 5 + 5?',
        options: ['8', '9', '10', '11'],
        correctAnswer: 2,
        difficulty: 'easy',
        isActive: true,
      };

      const question = await storage.createQuestion(questionData);

      expect(question.id).toBeDefined();
      expect(question.question).toBe(questionData.question);
      expect(question.correctAnswer).toBe(questionData.correctAnswer);
      expect(question.options).toEqual(questionData.options);
      expect(question.questionFormat).toBe('mcq_single');
    });

    it('updates an existing question', async () => {
      const [question] = await storage.getQuestionsByCourse(
        testData.testCourse.id,
      );

      const updatedQuestion = await storage.updateQuestion(question.id, {
        question: 'Updated question text',
        difficulty: 'medium',
      });

      expect(updatedQuestion.question).toBe('Updated question text');
      expect(updatedQuestion.difficulty).toBe('medium');
    });

    it('excludes inactive questions from an exam question set', async () => {
      await storage.createQuestion({
        courseId: testData.testCourse.id,
        question: 'Inactive question',
        options: ['A', 'B'],
        correctAnswer: 0,
        difficulty: 'easy',
        isActive: false,
      });

      const questions = await storage.getQuestionsByCourse(
        testData.testCourse.id,
      );

      expect(questions.map((question) => question.question)).not.toContain(
        'Inactive question',
      );
    });
  });
});
