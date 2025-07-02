import { describe, it, expect, beforeEach } from '@jest/globals';
import { cleanupTestData, setupTestData } from '../setup';
import { DatabaseStorage } from '../../server/storage';

describe('Course Management Tests', () => {
  let storage: DatabaseStorage;
  let testData: any;

  beforeEach(async () => {
    await cleanupTestData();
    storage = new DatabaseStorage();
    testData = await setupTestData();
  });

  describe('Course Creation', () => {
    it('should create a new course with valid data', async () => {
      const courseData = {
        title: 'New Test Course',
        description: 'A new course for testing',
        slug: 'new-test-course',
        categoryId: testData.testCategory.id,
        duration: 90,
        passingScore: 75,
        price: '149.00',
        level: 'intermediate',
        isActive: true,
        isInternship: false
      };

      const course = await storage.createCourseAdmin(courseData);

      expect(course.id).toBeDefined();
      expect(course.title).toBe(courseData.title);
      expect(course.slug).toBe(courseData.slug);
      expect(course.categoryId).toBe(courseData.categoryId);
      expect(course.price).toBe(courseData.price);
    });

    it('should auto-generate slug if not provided', async () => {
      const courseData = {
        title: 'Course With No Slug!',
        description: 'Testing slug generation',
        categoryId: testData.testCategory.id,
        duration: 60,
        passingScore: 70,
        price: '99.00',
        level: 'beginner',
        isActive: true,
        isInternship: false
      };

      const course = await storage.createCourseAdmin(courseData);
      expect(course.slug).toBe('course-with-no-slug');
    });
  });

  describe('Course Updates', () => {
    it('should update course information', async () => {
      const updates = {
        title: 'Updated Course Title',
        price: '199.00',
        passingScore: 80
      };

      const updatedCourse = await storage.updateCourseAdmin(testData.testCourse.id, updates);

      expect(updatedCourse.title).toBe(updates.title);
      expect(updatedCourse.price).toBe(updates.price);
      expect(updatedCourse.passingScore).toBe(updates.passingScore);
    });

    it('should update slug when title changes', async () => {
      const updates = {
        title: 'Completely New Course Name',
        slug: 'completely-new-course-name'
      };

      const updatedCourse = await storage.updateCourseAdmin(testData.testCourse.id, updates);
      expect(updatedCourse.slug).toBe(updates.slug);
    });
  });

  describe('Course Retrieval', () => {
    it('should get all courses', async () => {
      const courses = await storage.getCourses();
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.length).toBeGreaterThan(0);
    });

    it('should get course by slug', async () => {
      const course = await storage.getCourseBySlug(testData.testCourse.slug);
      expect(course).toBeDefined();
      expect(course?.id).toBe(testData.testCourse.id);
    });

    it('should get courses by category', async () => {
      const courses = await storage.getCoursesByCategory(testData.testCategory.id);
      expect(Array.isArray(courses)).toBe(true);
      expect(courses.every(course => course.categoryId === testData.testCategory.id)).toBe(true);
    });
  });

  describe('Course Search and Filtering', () => {
    it('should search courses by title', async () => {
      const searchResults = await storage.searchCourses('Test');
      expect(Array.isArray(searchResults)).toBe(true);
      expect(searchResults.some(course => course.title.includes('Test'))).toBe(true);
    });

    it('should filter active courses only', async () => {
      // Create inactive course
      await storage.createCourseAdmin({
        title: 'Inactive Course',
        description: 'This course is inactive',
        slug: 'inactive-course',
        categoryId: testData.testCategory.id,
        duration: 60,
        passingScore: 70,
        price: '99.00',
        level: 'beginner',
        isActive: false,
        isInternship: false
      });

      const activeCourses = await storage.getActiveCourses();
      expect(activeCourses.every(course => course.isActive)).toBe(true);
    });
  });

  describe('Course Deletion', () => {
    it('should delete course and related data', async () => {
      await storage.deleteCourseAdmin(testData.testCourse.id);
      
      const deletedCourse = await storage.getCourseById(testData.testCourse.id);
      expect(deletedCourse).toBeNull();
    });
  });
});