import { db } from './db.ts';
import { courses, questions, categories } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';

export async function createDemoTestCourse() {
  try {
    console.log('Creating demo test course...');

    // Check if demo test course already exists
    const existingCourse = await db
      .select()
      .from(courses)
      .where(eq(courses.title, 'Demo Test Course'))
      .limit(1);

    if (existingCourse.length > 0) {
      console.log('Demo test course already exists with ID:', existingCourse[0].id);
      return existingCourse[0];
    }

    // Get a category (use first available)
    const availableCategories = await db.select().from(categories).limit(1);
    if (availableCategories.length === 0) {
      throw new Error('No categories available');
    }
    const categoryId = availableCategories[0].id;

    // Create the demo course
    const newCourse = await db
      .insert(courses)
      .values({
        title: 'Demo Test Course',
        description: 'A simple demo course with 1 question for testing purposes only. Complete this quick test to validate the certification system.',
        duration: 5, // 5 minutes
        price: '1.00', // 1 INR
        originalPrice: '99.00',
        categoryId: categoryId,
        passingScore: 80,
        isActive: true,
        slug: 'demo-test-course',
        metaTitle: 'Demo Test Course - Quick Certification Test',
        metaDescription: 'Complete a quick 1-question test for only ₹1 to validate our certification system.'
      })
      .returning();

    const courseId = newCourse[0].id;
    console.log('Created demo course with ID:', courseId);

    // Create a simple question
    await db.insert(questions).values({
      courseId: courseId,
      question: 'What is the primary purpose of this demo test course?',
      options: [
        'To test the certification system functionality',
        'To learn advanced programming concepts',
        'To complete a full professional course',
        'To practice complex problem solving'
      ],
      correctAnswer: 0, // First option is correct
      questionType: 'multiple_choice',
      isActive: true,
      difficulty: 'easy'
    });

    console.log('Demo test course created successfully!');
    console.log('Course details:', {
      id: courseId,
      title: 'Demo Test Course',
      price: '₹1.00',
      questions: 1,
      passingScore: '80%'
    });

    return newCourse[0];

  } catch (error) {
    console.error('Error creating demo test course:', error);
    throw error;
  }
}

// Run if called directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createDemoTestCourse()
    .then(() => {
      console.log('Demo test course creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to create demo test course:', error);
      process.exit(1);
    });
}
