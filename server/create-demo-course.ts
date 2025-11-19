import { db } from "./db";
import { categories, courses, questions } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function createDemoContent() {
  try {
    // Get AI category
    const [aiCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, "AI"))
      .limit(1);

    if (!aiCategory) {
      console.error("AI category not found");
      return;
    }

    // Check if demo course already exists
    const [existingCourse] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, "demo"))
      .limit(1);

    if (existingCourse) {
      console.log("Demo course already exists");
      return;
    }

    // Create demo course
    const [demoCourse] = await db
      .insert(courses)
      .values({
        title: "Demo Course",
        description: "A simple demo course for testing the platform with one question.",
        slug: "demo",
        categoryId: aiCategory.id,
        duration: 5,
        passingScore: 60,
        price: "99",
        level: "Beginner",
        isActive: true,
        isInternship: false,
        metaTitle: "Demo Course - Test Your Knowledge",
        metaDescription: "Take this quick demo course to test the PremCQ certification platform."
      })
      .returning();

    // Create demo question
    await db
      .insert(questions)
      .values({
        courseId: demoCourse.id,
        question: "What is the primary goal of artificial intelligence?",
        options: [
          "To replace human workers completely",
          "To augment human capabilities and solve complex problems",
          "To create robots that look like humans",
          "To make computers faster"
        ],
        correctAnswer: 1,
        explanation: "The primary goal of AI is to augment human capabilities and help solve complex problems, not to replace humans entirely."
      });

    console.log("Demo course and question created successfully!");
    
  } catch (error) {
    console.error("Error creating demo content:", error);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1])) {
  createDemoContent().then(() => process.exit(0));
}