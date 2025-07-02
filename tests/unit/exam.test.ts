import { describe, it, expect, beforeEach } from '@jest/globals';
import { cleanupTestData, setupTestData } from '../setup';
import { DatabaseStorage } from '../../server/storage';

describe('Exam System Tests', () => {
  let storage: DatabaseStorage;
  let testData: any;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
    testData = await setupTestData();
  });

  describe('Exam Sessions', () => {
    it('should create exam session for user', async () => {
      const sessionData = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        sessionId: 'test-session-123',
        startedAt: new Date()
      };

      const session = await storage.createExamSession(sessionData);
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(sessionData.userId);
      expect(session.courseId).toBe(sessionData.courseId);
      expect(session.sessionId).toBe(sessionData.sessionId);
    });

    it('should prevent duplicate active sessions', async () => {
      const sessionData = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        sessionId: 'test-session-123',
        startedAt: new Date()
      };

      await storage.createExamSession(sessionData);
      
      // Try to create another session for same user/course
      await expect(storage.createExamSession({
        ...sessionData,
        sessionId: 'test-session-456'
      })).rejects.toThrow();
    });

    it('should get active session for user', async () => {
      const sessionData = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        sessionId: 'test-session-123',
        startedAt: new Date()
      };

      await storage.createExamSession(sessionData);
      const activeSession = await storage.getActiveExamSession(testData.testUser.id, testData.testCourse.id);
      
      expect(activeSession).toBeDefined();
      expect(activeSession?.sessionId).toBe(sessionData.sessionId);
    });
  });

  describe('Exam Attempts', () => {
    it('should record exam attempt with score', async () => {
      const attemptData = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800, // 30 minutes
        answers: [0, 1, 2, 1, 0, 1, 2, 0, 1, 2],
        passed: true
      };

      const attempt = await storage.createExamAttempt(attemptData);
      
      expect(attempt.id).toBeDefined();
      expect(attempt.score).toBe(attemptData.score);
      expect(attempt.passed).toBe(true);
      expect(attempt.timeTaken).toBe(attemptData.timeTaken);
    });

    it('should calculate pass/fail correctly', async () => {
      const failingAttempt = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 65, // Below 70% passing score
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [0, 1, 2, 1, 0, 1, 2, 0, 1, 2],
        passed: false
      };

      const attempt = await storage.createExamAttempt(failingAttempt);
      expect(attempt.passed).toBe(false);
    });

    it('should get user exam attempts', async () => {
      const attemptData = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 85,
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [0, 1, 2, 1, 0, 1, 2, 0, 1, 2],
        passed: true
      };

      await storage.createExamAttempt(attemptData);
      const attempts = await storage.getUserExamAttempts(testData.testUser.id);
      
      expect(Array.isArray(attempts)).toBe(true);
      expect(attempts.length).toBe(1);
      expect(attempts[0].score).toBe(85);
    });
  });

  describe('Question Management', () => {
    it('should get questions for course', async () => {
      const questions = await storage.getQuestionsByCourse(testData.testCourse.id);
      
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
      expect(questions.every(q => q.courseId === testData.testCourse.id)).toBe(true);
    });

    it('should create new question', async () => {
      const questionData = {
        courseId: testData.testCourse.id,
        question: 'What is the result of 5 + 5?',
        options: ['8', '9', '10', '11'],
        correctAnswer: 2,
        difficulty: 'easy',
        isActive: true
      };

      const question = await storage.createQuestion(questionData);
      
      expect(question.id).toBeDefined();
      expect(question.question).toBe(questionData.question);
      expect(question.correctAnswer).toBe(questionData.correctAnswer);
      expect(question.options).toEqual(questionData.options);
    });

    it('should update question', async () => {
      const questions = await storage.getQuestionsByCourse(testData.testCourse.id);
      const questionId = questions[0].id;
      
      const updates = {
        question: 'Updated question text',
        difficulty: 'medium'
      };

      const updatedQuestion = await storage.updateQuestionAdmin(questionId, updates);
      expect(updatedQuestion.question).toBe(updates.question);
      expect(updatedQuestion.difficulty).toBe(updates.difficulty);
    });

    it('should validate correct answer index', async () => {
      const invalidQuestionData = {
        courseId: testData.testCourse.id,
        question: 'Invalid question',
        options: ['A', 'B', 'C'],
        correctAnswer: 5, // Invalid index
        difficulty: 'easy',
        isActive: true
      };

      await expect(storage.createQuestion(invalidQuestionData))
        .rejects.toThrow();
    });
  });

  describe('Score Validation', () => {
    it('should validate score within 0-100 range', async () => {
      const invalidAttempt = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 150, // Invalid score > 100
        totalQuestions: 10,
        timeTaken: 1800,
        answers: [0, 1, 2, 1, 0, 1, 2, 0, 1, 2],
        passed: true
      };

      await expect(storage.createExamAttempt(invalidAttempt))
        .rejects.toThrow();
    });

    it('should handle perfect score', async () => {
      const perfectAttempt = {
        userId: testData.testUser.id,
        courseId: testData.testCourse.id,
        score: 100,
        totalQuestions: 10,
        timeTaken: 1200,
        answers: [1, 2, 1, 2, 1, 2, 1, 2, 1, 2], // All correct
        passed: true
      };

      const attempt = await storage.createExamAttempt(perfectAttempt);
      expect(attempt.score).toBe(100);
      expect(attempt.passed).toBe(true);
    });
  });
});