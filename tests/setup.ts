import { expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Test database setup
const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDbUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL environment variable is required');
}

export const testPool = new Pool({ connectionString: testDbUrl });
export const testDb = drizzle({ client: testPool, schema });

// Test data cleanup
export async function cleanupTestData() {
  // Clean in reverse order to respect foreign key constraints
  await testDb.delete(schema.certificates);
  await testDb.delete(schema.examAttempts);
  await testDb.delete(schema.interviews);
  await testDb.delete(schema.questions);
  await testDb.delete(schema.courses);
  await testDb.delete(schema.categories);
  await testDb.delete(schema.users);
  await testDb.delete(schema.recruiters);
  await testDb.delete(schema.sellers);
}

// Setup test users and data
export async function setupTestData() {
  // Create test category
  const [testCategory] = await testDb.insert(schema.categories).values({
    name: 'Test Category',
    description: 'Category for testing',
    icon: 'Folder',
    slug: 'test-category',
  }).returning();

  // Create test user
  const [testUser] = await testDb.insert(schema.users).values({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashed_password',
    isAdmin: false
  }).returning();

  // Create admin user
  const [adminUser] = await testDb.insert(schema.users).values({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'hashed_admin_password',
    isAdmin: true
  }).returning();

  // Create test course
  const [testCourse] = await testDb.insert(schema.courses).values({
    title: 'Test Course',
    description: 'A course for testing',
    slug: 'test-course',
    categoryId: testCategory.id,
    duration: 60,
    passingScore: 70,
    price: '99.00',
    level: 'beginner',
    isActive: true,
    isInternship: false
  }).returning();

  // Create test questions
  await testDb.insert(schema.questions).values([
    {
      courseId: testCourse.id,
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      difficulty: 'easy',
      isActive: true
    },
    {
      courseId: testCourse.id,
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2,
      difficulty: 'easy',
      isActive: true
    }
  ]);

  return {
    testCategory,
    testUser,
    adminUser,
    testCourse
  };
}

// Global test setup
beforeAll(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await testPool.end();
});

beforeEach(async () => {
  await cleanupTestData();
});