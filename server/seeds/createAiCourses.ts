import { db } from "../db";
import { courses, questions, categories } from "../../shared/schema";
import { eq } from "drizzle-orm";

export async function createAiCourses() {
  try {
    console.log("Creating AI Interactive Courses...");

    // First ensure we have AI category
    const [aiCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, "AI"))
      .limit(1);

    if (!aiCategory) {
      console.log("AI category not found, please run the main seed first");
      return;
    }

    // Create AI Interactive courses
    const aiCourses = [
      {
        title: "AI Algorithm Master Class",
        description: "Advanced AI-powered assessment testing algorithmic thinking and problem-solving skills through interactive conversations with our AI interviewer.",
        slug: "ai-algorithm-master-class",
        categoryId: aiCategory.id,
        duration: 90,
        passingScore: 70,
        price: "299.00",
        courseType: "ai_interactive",
        isPreferred: true,
        aiSystemPrompt: "You are an expert technical interviewer specializing in algorithms and problem-solving. Conduct thorough technical interviews to assess the candidate's programming and analytical skills.",
        aiInstructions: "This is an AI-powered interactive assessment. You will engage in conversations with our AI interviewer who will ask you technical questions and follow-up questions based on your responses. Think aloud, explain your reasoning, and be prepared to discuss your approach to problem-solving.",
      },
      {
        title: "Full Stack Technical Interview",
        description: "Interactive technical interview covering frontend, backend, databases, and system design through AI conversations.",
        slug: "fullstack-technical-interview",
        categoryId: aiCategory.id,
        duration: 120,
        passingScore: 75,
        price: "399.00",
        courseType: "ai_interactive",
        isPreferred: true,
        aiSystemPrompt: "You are a senior full-stack developer conducting technical interviews. Assess the candidate's knowledge across frontend, backend, databases, and system design.",
        aiInstructions: "Engage with our AI technical interviewer in a comprehensive full-stack development assessment. Be ready to discuss your experience with various technologies, explain architectural decisions, and solve real-world development challenges.",
      },
      {
        title: "System Design & Architecture",
        description: "Advanced AI assessment focusing on data structures, algorithms, and system design principles through interactive problem-solving.",
        slug: "system-design-architecture",
        categoryId: aiCategory.id,
        duration: 100,
        passingScore: 72,
        price: "349.00",
        courseType: "ai_interactive",
        isPreferred: true,
        aiSystemPrompt: "You are an expert software architect and algorithm specialist. Evaluate the candidate's understanding of data structures, algorithms, and system design through practical scenarios.",
        aiInstructions: "Work through complex technical challenges with our AI interviewer. You'll be assessed on your knowledge of data structures, algorithmic thinking, and ability to design scalable systems.",
      }
    ];

    // Insert or update courses
    const insertedCourses = [];
    for (const courseData of aiCourses) {
      const [existingCourse] = await db
        .select()
        .from(courses)
        .where(eq(courses.slug, courseData.slug))
        .limit(1);

      if (existingCourse) {
        const [updatedCourse] = await db
          .update(courses)
          .set(courseData)
          .where(eq(courses.id, existingCourse.id))
          .returning();
        insertedCourses.push(updatedCourse);
      } else {
        const [newCourse] = await db
          .insert(courses)
          .values(courseData)
          .returning();
        insertedCourses.push(newCourse);
      }
    }

    // AI Interactive Questions for each course
    const aiQuestions = [
      // AI Algorithm Master Class
      {
        courseId: insertedCourses[0].id,
        question: "Design an efficient algorithm to find the shortest path between two nodes in a weighted graph.",
        questionType: "ai_interactive",
        aiScenario: "You are working on a navigation system for a delivery company. The system needs to find the shortest route between any two locations in a city. The city can be represented as a weighted graph where intersections are nodes and roads are edges with travel time as weights. Explain your approach to solving this problem, discuss different algorithms you could use, their time complexities, and justify your choice.",
        aiEvaluationCriteria: [
          "Correctly identifies this as a shortest path problem",
          "Mentions appropriate algorithms (Dijkstra's, A*, Bellman-Ford)",
          "Explains time and space complexity accurately",
          "Discusses trade-offs between different approaches",
          "Considers real-world constraints and optimizations"
        ],
        expectedKeywords: ["dijkstra", "shortest path", "graph", "algorithm", "complexity", "optimization"],
        maxPoints: 100,
        difficulty: "hard"
      },
      {
        courseId: insertedCourses[0].id,
        question: "Implement a solution for the classic Two Sum problem and explain how you would optimize it.",
        questionType: "ai_interactive",
        aiScenario: "Given an array of integers and a target sum, find two numbers in the array that add up to the target. Explain your approach, implement a solution, and discuss how you would optimize it for different constraints. Consider scenarios where the array is very large, when there are multiple solutions, and when no solution exists.",
        aiEvaluationCriteria: [
          "Provides correct algorithm approach",
          "Explains brute force and optimized solutions",
          "Discusses time and space complexity",
          "Handles edge cases appropriately",
          "Shows clear problem-solving methodology"
        ],
        expectedKeywords: ["hash map", "two pointers", "complexity", "optimization", "edge cases"],
        maxPoints: 100,
        difficulty: "medium"
      },
      {
        courseId: insertedCourses[0].id,
        question: "Design a data structure that supports insert, delete, and getRandom operations in O(1) time.",
        questionType: "ai_interactive",
        aiScenario: "You need to design a data structure that supports three operations: insert(val) - inserts an item val to the set if not already present, remove(val) - removes an item val from the set if present, and getRandom() - returns a random element from the current set. All operations must run in average O(1) time. Explain your design choices and implementation approach.",
        aiEvaluationCriteria: [
          "Identifies need for multiple data structures",
          "Correctly proposes array + hash map solution",
          "Explains how to maintain O(1) for all operations",
          "Handles the deletion strategy correctly",
          "Discusses the random generation approach"
        ],
        expectedKeywords: ["hash map", "array", "random", "O(1)", "data structure", "swap"],
        maxPoints: 100,
        difficulty: "hard"
      },

      // Full Stack Technical Interview
      {
        courseId: insertedCourses[1].id,
        question: "Design and explain the architecture for a scalable e-commerce platform.",
        questionType: "ai_interactive",
        aiScenario: "You are the lead architect for a new e-commerce platform that needs to handle thousands of users, product catalog management, order processing, payments, and inventory tracking. Design the overall system architecture including frontend, backend services, database design, and infrastructure. Consider scalability, security, and performance requirements.",
        aiEvaluationCriteria: [
          "Designs appropriate microservices architecture",
          "Considers database design and data consistency",
          "Addresses security concerns and authentication",
          "Plans for scalability and load handling",
          "Discusses technology choices and trade-offs"
        ],
        expectedKeywords: ["microservices", "database", "authentication", "scalability", "API", "security"],
        maxPoints: 100,
        difficulty: "hard"
      },
      {
        courseId: insertedCourses[1].id,
        question: "Implement user authentication and authorization in a web application.",
        questionType: "ai_interactive",
        aiScenario: "Design and implement a secure user authentication system for a web application. Include user registration, login, password security, session management, and role-based access control. Explain your security considerations, token management strategy, and how you would handle common security vulnerabilities.",
        aiEvaluationCriteria: [
          "Understands security best practices",
          "Implements proper password hashing",
          "Designs appropriate session/token management",
          "Considers CSRF, XSS, and other vulnerabilities",
          "Explains role-based access control"
        ],
        expectedKeywords: ["JWT", "bcrypt", "session", "CSRF", "XSS", "authorization", "security"],
        maxPoints: 100,
        difficulty: "medium"
      },
      {
        courseId: insertedCourses[1].id,
        question: "Optimize database queries for a high-traffic application.",
        questionType: "ai_interactive",
        aiScenario: "Your application is experiencing slow response times due to inefficient database queries. You have a user table with millions of records, and queries for user profiles, friend lists, and activity feeds are taking too long. Analyze the performance issues and propose optimization strategies including indexing, query optimization, and architectural changes.",
        aiEvaluationCriteria: [
          "Identifies common performance bottlenecks",
          "Proposes appropriate indexing strategies",
          "Suggests query optimization techniques",
          "Considers caching and architectural solutions",
          "Discusses monitoring and profiling approaches"
        ],
        expectedKeywords: ["indexing", "caching", "query optimization", "performance", "database", "monitoring"],
        maxPoints: 100,
        difficulty: "medium"
      },

      // System Design & Architecture
      {
        courseId: insertedCourses[2].id,
        question: "Design a distributed cache system like Redis.",
        questionType: "ai_interactive",
        aiScenario: "Design a distributed caching system that can handle high throughput and provide low latency data access. The system should support basic operations like GET, SET, DELETE, and handle cache eviction policies. Consider consistency, partitioning, replication, and fault tolerance. Explain your design decisions and trade-offs.",
        aiEvaluationCriteria: [
          "Understands distributed systems principles",
          "Designs appropriate partitioning strategy",
          "Considers consistency models and trade-offs",
          "Plans for fault tolerance and replication",
          "Explains cache eviction policies"
        ],
        expectedKeywords: ["distributed", "partitioning", "consistency", "replication", "hash ring", "eviction"],
        maxPoints: 100,
        difficulty: "hard"
      },
      {
        courseId: insertedCourses[2].id,
        question: "Implement and optimize a binary search tree with additional operations.",
        questionType: "ai_interactive",
        aiScenario: "Implement a binary search tree that supports standard operations (insert, delete, search) plus additional operations like finding the kth smallest element and range queries. Discuss how you would balance the tree for optimal performance and explain the time complexities of your operations.",
        aiEvaluationCriteria: [
          "Correctly implements BST operations",
          "Explains balancing strategies (AVL, Red-Black)",
          "Implements efficient kth smallest element algorithm",
          "Handles range queries optimally",
          "Analyzes time and space complexities accurately"
        ],
        expectedKeywords: ["binary search tree", "balancing", "kth smallest", "range query", "complexity", "AVL"],
        maxPoints: 100,
        difficulty: "medium"
      },
      {
        courseId: insertedCourses[2].id,
        question: "Design a rate limiting system for an API gateway.",
        questionType: "ai_interactive",
        aiScenario: "Design a rate limiting system for an API gateway that serves multiple clients with different rate limits. The system should be able to handle millions of requests per second and provide different algorithms like token bucket, sliding window, and fixed window. Consider distributed deployment and how to handle state consistency across multiple servers.",
        aiEvaluationCriteria: [
          "Understands different rate limiting algorithms",
          "Designs for high throughput and low latency",
          "Considers distributed system challenges",
          "Plans for different client tiers and limits",
          "Addresses consistency and synchronization"
        ],
        expectedKeywords: ["rate limiting", "token bucket", "sliding window", "distributed", "throughput", "consistency"],
        maxPoints: 100,
        difficulty: "hard"
      }
    ];

    // Delete existing questions for these courses and insert new ones
    for (const course of insertedCourses) {
      await db.delete(questions).where(eq(questions.courseId, course.id));
    }

    // Insert new AI questions
    await db.insert(questions).values(aiQuestions);

    console.log(`Created ${insertedCourses.length} AI Interactive courses with ${aiQuestions.length} questions`);
    
    return {
      courses: insertedCourses,
      questionsCount: aiQuestions.length
    };
  } catch (error) {
    console.error("Error creating AI courses:", error);
    throw error;
  }
}