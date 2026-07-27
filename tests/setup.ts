import { beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcrypt';
import * as schema from '../shared/schema';

// Some local `.env` files explicitly set development. Test setup must override
// that before any route module starts seed jobs or background timers.
process.env.NODE_ENV = 'test';

// Test database setup
const testDbUrl = process.env.TEST_DATABASE_URL;

// DatabaseStorage imports the application database singleton, which reads
// DATABASE_URL. In tests, force that singleton onto the explicitly supplied
// disposable database so storage calls can never drift onto another database.
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
} else {
  // Pure unit tests import route modules whose production dependencies create
  // a lazy pg Pool at module load. Give that pool an intentionally unreachable
  // address so those modules can be type/contract tested without ever falling
  // back to a developer database. Database-backed suites still fail fast via
  // requireTestDatabase() unless TEST_DATABASE_URL is explicitly supplied.
  process.env.DATABASE_URL = 'postgresql://octamy_unit_tests:disabled@127.0.0.1:1/octamy_unit_tests';
}

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

let passwordHashes: Promise<[string, string]> | undefined;

function getPasswordHashes() {
  passwordHashes ??= Promise.all([
    bcrypt.hash('password123', 10),
    bcrypt.hash('admin123', 10),
  ]);
  return passwordHashes;
}

// Test data cleanup
export async function cleanupTestData() {
  requireTestDatabase();
  // This database is explicitly disposable. Truncate every public table so a
  // newly added relation cannot leave foreign-key data behind and make an
  // unrelated suite order-dependent. Do not RESTART IDENTITY: CI may grant a
  // test role table privileges without transferring sequence ownership.
  const tableRows = await testPool.query<{ table_name: string }>(`
    SELECT format('%I.%I', schemaname, tablename) AS table_name
      FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename
  `);
  if (tableRows.rows.length > 0) {
    await testPool.query(`TRUNCATE TABLE ${tableRows.rows.map((row) => row.table_name).join(', ')} CASCADE`);
  }
}

// Setup test users and data
export async function setupTestData() {
  requireTestDatabase();
  const [userPassword, adminPassword] = await getPasswordHashes();

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
    password: userPassword,
    isAdmin: false
  }).returning();

  // Create admin user
  const [adminUser] = await testDb.insert(schema.users).values({
    name: 'Admin User',
    email: 'admin@example.com',
    password: adminPassword,
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
    isInternship: false,
    ownerType: 'admin',
    visibility: 'public',
    certificationMode: 'octamy',
    assessmentPurpose: 'certification',
    reviewStatus: 'approved',
    useBlueprintEngine: false,
  }).returning();

  // Legacy direct-question delivery remains available only for learning courses.
  // Certification assessments must use the reviewed blueprint engine, so exam
  // endpoint tests use this separate non-credential fixture.
  const [testExamCourse] = await testDb.insert(schema.courses).values({
    title: 'Test Learning Course',
    description: 'A disposable learning course for direct-question API tests',
    slug: 'test-learning-course',
    categoryId: testCategory.id,
    duration: 60,
    passingScore: 70,
    price: '0.00',
    productType: 'course',
    level: 'beginner',
    isActive: true,
    isInternship: false,
    ownerType: 'admin',
    visibility: 'public',
    certificationMode: 'none',
    assessmentPurpose: 'certification',
    reviewStatus: 'approved',
    useBlueprintEngine: false,
  }).returning();

  // Create test questions
  await testDb.insert(schema.questions).values([
    {
      courseId: testExamCourse.id,
      question: 'What is 2 + 2?',
      options: ['3', '4', '5', '6'],
      correctAnswer: 1,
      difficulty: 'easy',
      questionFormat: 'mcq_single',
      reviewStatus: 'approved',
      createdBy: testUser.id,
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      isActive: true
    },
    {
      courseId: testExamCourse.id,
      question: 'What is the capital of France?',
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 2,
      difficulty: 'easy',
      questionFormat: 'mcq_single',
      reviewStatus: 'approved',
      createdBy: testUser.id,
      reviewedBy: adminUser.id,
      reviewedAt: new Date(),
      isActive: true
    }
  ]);

  return {
    testCategory,
    testUser,
    adminUser,
    testCourse,
    testExamCourse,
  };
}

// Global test setup
beforeAll(async () => {
  if (testDbUrl) await cleanupTestData();
});

afterAll(async () => {
  if (testDbUrl) {
    await cleanupTestData();
    // DatabaseStorage owns a second pool through server/db. Close both pools so
    // Jest does not hang after database-backed suites finish.
    const { pool: applicationPool } = await import('../server/db');
    await applicationPool.end();
    await testPool.end();
  }
});
