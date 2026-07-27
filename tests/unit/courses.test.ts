import { describe, it, expect, beforeEach } from '@jest/globals';
import { cleanupTestData, setupTestData } from '../setup';
import { DatabaseStorage } from '../../server/storage';
import type { InsertCourse } from '../../shared/schema';

describe('Course storage contracts', () => {
  let storage: DatabaseStorage;
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
    testData = await setupTestData();
  });

  function courseFixture(overrides: Partial<InsertCourse> = {}): InsertCourse {
    return {
      title: 'New Test Course',
      description: 'A new course for testing',
      slug: 'new-test-course',
      categoryId: testData.testCategory.id,
      duration: 90,
      passingScore: 75,
      price: '149.00',
      level: 'intermediate',
      isActive: true,
      isInternship: false,
      ...overrides,
    };
  }

  describe('Course creation and updates', () => {
    it('creates a course with an explicit unique slug', async () => {
      const courseData = courseFixture();

      const course = await storage.createCourse(courseData);

      expect(course.id).toBeDefined();
      expect(course.title).toBe(courseData.title);
      expect(course.slug).toBe(courseData.slug);
      expect(course.categoryId).toBe(courseData.categoryId);
      expect(course.price).toBe(courseData.price);
      expect(course.ownerType).toBe('admin');
      expect(course.visibility).toBe('public');
    });

    it('enforces unique course slugs', async () => {
      await storage.createCourse(courseFixture());

      await expect(
        storage.createCourse(
          courseFixture({ title: 'Another course with the same slug' }),
        ),
      ).rejects.toThrow();
    });

    it('updates mutable course information', async () => {
      const updates = {
        title: 'Updated Course Title',
        price: '199.00',
        passingScore: 80,
      };

      const updatedCourse = await storage.updateCourse(
        testData.testCourse.id,
        updates,
      );

      expect(updatedCourse.title).toBe(updates.title);
      expect(updatedCourse.price).toBe(updates.price);
      expect(updatedCourse.passingScore).toBe(updates.passingScore);
    });

    it('updates the slug only when the caller supplies the new slug', async () => {
      const updatedCourse = await storage.updateCourse(testData.testCourse.id, {
        title: 'Completely New Course Name',
        slug: 'completely-new-course-name',
      });

      expect(updatedCourse.slug).toBe('completely-new-course-name');
    });
  });

  describe('Public catalog retrieval', () => {
    it('returns active public courses with their category', async () => {
      const courses = await storage.getCourses();

      const seeded = courses.find((course) => course.id === testData.testCourse.id);
      expect(courses.map((course) => course.slug).sort()).toEqual([
        testData.testCourse.slug,
        testData.testExamCourse.slug,
      ].sort());
      expect(seeded?.category.id).toBe(testData.testCategory.id);
    });

    it('gets an active public course by slug', async () => {
      const course = await storage.getCourseBySlug(testData.testCourse.slug);

      expect(course?.id).toBe(testData.testCourse.id);
      expect(course?.category.id).toBe(testData.testCategory.id);
    });

    it('gets active public courses by category', async () => {
      const courses = await storage.getCoursesByCategory(
        testData.testCategory.id,
      );

      expect(courses).not.toHaveLength(0);
      expect(
        courses.every(
          (course) => course.categoryId === testData.testCategory.id,
        ),
      ).toBe(true);
    });

    it('excludes inactive and private courses from the public catalog', async () => {
      await storage.createCourse(
        courseFixture({
          title: 'Inactive Course',
          slug: 'inactive-course',
          isActive: false,
        }),
      );
      await storage.createCourse(
        courseFixture({
          title: 'Private Course',
          slug: 'private-course',
          visibility: 'private',
        }),
      );

      const publicCourses = await storage.getCourses();

      expect(publicCourses.map((course) => course.slug).sort()).toEqual([
        testData.testCourse.slug,
        testData.testExamCourse.slug,
      ].sort());
      await expect(
        storage.getCourseBySlug('private-course'),
      ).resolves.toBeUndefined();
    });
  });

  describe('Course deletion', () => {
    it('deletes a course and its legacy course questions', async () => {
      await storage.deleteCourse(testData.testCourse.id);

      await expect(
        storage.getCourse(testData.testCourse.id),
      ).resolves.toBeUndefined();
      await expect(
        storage.getQuestionsByCourse(testData.testCourse.id),
      ).resolves.toEqual([]);
    });
  });
});
