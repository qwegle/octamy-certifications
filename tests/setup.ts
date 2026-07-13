import { expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

// Test database setup
const testDbUrl = process.env.TEST_DATABASE_URL;
export const testPool = testDbUrl
  ? new Pool({ connectionString: testDbUrl })
  : null as unknown as Pool;
export const testDb = testDbUrl
  ? drizzle({ client: testPool, schema })
  : null as unknown as ReturnType<typeof drizzle<typeof schema>>;

function requireTestDatabase() {
  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL is required for database tests. The suite never falls back to DATABASE_URL because it deletes data.');
  }
}

// Test data cleanup
export async function cleanupTestData() {
  requireTestDatabase();
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
  requireTestDatabase();
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
  if (testDbUrl) await cleanupTestData();
});

afterAll(async () => {
  if (testDbUrl) {
    await cleanupTestData();
    await testPool.end();
  }
});

beforeEach(async () => {
  if (testDbUrl) await cleanupTestData();
});
