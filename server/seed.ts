import { db } from "./db";
import { categories, courses, questions, users } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  try {
    // Check if categories already exist
    const existingCategories = await db.select().from(categories);
    if (existingCategories.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    console.log("Seeding database...");

    // Insert categories
    const categoryData = [
      {
        name: "AI",
        description: "Machine Learning, Deep Learning, NLP, and AI Ethics certifications",
        icon: "brain",
        slug: "ai"
      },
      {
        name: "Development",
        description: "Frontend, Backend, Mobile, and DevOps development certifications",
        icon: "code",
        slug: "development"
      },
      {
        name: "Business",
        description: "Marketing, Analytics, Strategy, and Leadership certifications",
        icon: "trending-up",
        slug: "business"
      },
      {
        name: "Internships",
        description: "Virtual internship completion and skill development certifications",
        icon: "graduation-cap",
        slug: "internships"
      }
    ];

    const insertedCategories = await db.insert(categories).values(categoryData).returning();
    console.log("Categories seeded:", insertedCategories.length);

    // Create an admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const adminUser = await db.insert(users).values({
      email: "admin@octamy.com",
      password: hashedPassword,
      name: "Admin User",
      isAdmin: true,
    }).returning();
    console.log("Admin user created:", adminUser[0].email);

    // Insert sample courses
    const courseData = [
      // AI Courses
      {
        title: "Machine Learning Fundamentals",
        description: "Master the basics of ML algorithms, supervised and unsupervised learning, model evaluation, and real-world applications.",
        categoryId: insertedCategories[0].id,
        duration: 15,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Deep Learning with Neural Networks",
        description: "Comprehensive course on neural networks, backpropagation, CNNs, RNNs, and modern deep learning frameworks.",
        categoryId: insertedCategories[0].id,
        duration: 20,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Natural Language Processing",
        description: "Learn text processing, sentiment analysis, language models, and NLP applications using modern techniques.",
        categoryId: insertedCategories[0].id,
        duration: 18,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },

      // Development Courses
      {
        title: "React.js Professional",
        description: "Advanced React concepts, hooks, state management, testing, and best practices for modern web development.",
        categoryId: insertedCategories[1].id,
        duration: 12,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Node.js Backend Development",
        description: "Build scalable backend applications with Node.js, Express, databases, authentication, and API design.",
        categoryId: insertedCategories[1].id,
        duration: 16,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Full Stack JavaScript",
        description: "Complete full-stack development with JavaScript, including frontend frameworks and backend technologies.",
        categoryId: insertedCategories[1].id,
        duration: 25,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },

      // Business Courses
      {
        title: "Digital Marketing Strategy",
        description: "SEO, SEM, social media marketing, content strategy, and analytics for business growth and customer acquisition.",
        categoryId: insertedCategories[2].id,
        duration: 10,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Business Analytics with Data",
        description: "Data-driven decision making, KPI analysis, business intelligence, and strategic insights from data.",
        categoryId: insertedCategories[2].id,
        duration: 14,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Project Management Essentials",
        description: "Agile methodologies, project planning, team leadership, risk management, and delivery optimization.",
        categoryId: insertedCategories[2].id,
        duration: 12,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },

      // Internship Courses
      {
        title: "Virtual Software Development Internship",
        description: "Complete software development internship with real projects, code reviews, and industry mentorship.",
        categoryId: insertedCategories[3].id,
        duration: 20,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Data Science Internship Program",
        description: "Hands-on data science experience with real datasets, analysis projects, and professional guidance.",
        categoryId: insertedCategories[3].id,
        duration: 18,
        passingScore: 50,
        price: "199.00",
        isActive: true
      }
    ];

    const insertedCourses = await db.insert(courses).values(courseData).returning();
    console.log("Courses seeded:", insertedCourses.length);

    // Insert sample questions for Machine Learning Fundamentals course
    const mlCourse = insertedCourses.find(c => c.title === "Machine Learning Fundamentals");
    if (mlCourse) {
      const mlQuestions = [
        {
          courseId: mlCourse.id,
          question: "Which of the following is NOT a supervised learning algorithm?",
          options: ["Linear Regression", "K-Means Clustering", "Decision Trees", "Support Vector Machine"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "What is the primary purpose of cross-validation in machine learning?",
          options: ["To increase training speed", "To evaluate model performance", "To reduce overfitting", "To clean the dataset"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "Which metric is most appropriate for evaluating a binary classification model with imbalanced classes?",
          options: ["Accuracy", "Precision", "F1-Score", "Mean Squared Error"],
          correctAnswer: 2,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "What does 'overfitting' mean in machine learning?",
          options: ["Model performs well on training data but poorly on test data", "Model performs poorly on both training and test data", "Model performs well on test data but poorly on training data", "Model takes too long to train"],
          correctAnswer: 0,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "Which algorithm is best suited for clustering tasks?",
          options: ["Linear Regression", "K-Means", "Logistic Regression", "Random Forest"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "What is the purpose of feature scaling in machine learning?",
          options: ["To reduce the number of features", "To normalize the range of feature values", "To remove irrelevant features", "To create new features"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "Which of the following is an ensemble learning method?",
          options: ["K-Nearest Neighbors", "Random Forest", "Linear Regression", "K-Means"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "What is the main difference between classification and regression?",
          options: ["Classification predicts continuous values, regression predicts categories", "Classification predicts categories, regression predicts continuous values", "There is no difference", "Classification is supervised, regression is unsupervised"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "Which technique is used to prevent overfitting?",
          options: ["Regularization", "Feature scaling", "Data cleaning", "Increasing model complexity"],
          correctAnswer: 0,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "What is the purpose of a validation set in machine learning?",
          options: ["To train the model", "To test the final model performance", "To tune hyperparameters", "To clean the data"],
          correctAnswer: 2,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "Which algorithm is known for being interpretable and easy to understand?",
          options: ["Neural Networks", "Support Vector Machine", "Decision Trees", "Deep Learning"],
          correctAnswer: 2,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "What does the term 'gradient descent' refer to?",
          options: ["A data preprocessing technique", "An optimization algorithm", "A model evaluation metric", "A feature selection method"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "Which of the following is NOT a common data preprocessing step?",
          options: ["Handling missing values", "Feature scaling", "Model training", "Outlier detection"],
          correctAnswer: 2,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "What is the bias-variance tradeoff?",
          options: ["A method to select features", "A balance between model complexity and generalization", "A way to split data", "A type of regularization"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: mlCourse.id,
          question: "Which metric would you use to evaluate a regression model?",
          options: ["Accuracy", "Precision", "Mean Squared Error", "F1-Score"],
          correctAnswer: 2,
          isActive: true
        }
      ];

      await db.insert(questions).values(mlQuestions);
      console.log("Questions seeded for Machine Learning course");
    }

    // Insert sample questions for React.js Professional course
    const reactCourse = insertedCourses.find(c => c.title === "React.js Professional");
    if (reactCourse) {
      const reactQuestions = [
        {
          courseId: reactCourse.id,
          question: "What is the primary purpose of React hooks?",
          options: ["To replace class components", "To manage state and lifecycle in functional components", "To improve performance", "To handle routing"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "Which hook is used for managing component state?",
          options: ["useEffect", "useState", "useContext", "useReducer"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "What is the Virtual DOM in React?",
          options: ["A real DOM element", "A JavaScript representation of the real DOM", "A database", "A routing system"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "Which method is called when a component is first mounted?",
          options: ["componentDidUpdate", "componentWillUnmount", "componentDidMount", "render"],
          correctAnswer: 2,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "What is JSX?",
          options: ["A new programming language", "JavaScript XML syntax extension", "A database query language", "A styling framework"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "Which hook is used for side effects in functional components?",
          options: ["useState", "useEffect", "useContext", "useMemo"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "What is the purpose of React.memo()?",
          options: ["To manage state", "To optimize performance by memoizing components", "To handle events", "To manage routing"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "Which pattern is recommended for passing data to deeply nested components?",
          options: ["Props drilling", "Context API", "Global variables", "Local storage"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "What is the difference between controlled and uncontrolled components?",
          options: ["No difference", "Controlled components manage their own state", "Controlled components have their state managed by React", "Uncontrolled components use hooks"],
          correctAnswer: 2,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "Which tool is commonly used for state management in large React applications?",
          options: ["Redux", "jQuery", "Bootstrap", "Webpack"],
          correctAnswer: 0,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "What is the purpose of useCallback hook?",
          options: ["To manage state", "To memoize functions", "To handle side effects", "To access context"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: reactCourse.id,
          question: "Which of the following is NOT a valid way to handle events in React?",
          options: ["onClick={handleClick}", "onClick={handleClick()}", "onClick={() => handleClick()}", "onClick={function() { handleClick(); }}"],
          correctAnswer: 1,
          isActive: true
        }
      ];

      await db.insert(questions).values(reactQuestions);
      console.log("Questions seeded for React.js course");
    }

    // Insert sample questions for Digital Marketing Strategy course
    const marketingCourse = insertedCourses.find(c => c.title === "Digital Marketing Strategy");
    if (marketingCourse) {
      const marketingQuestions = [
        {
          courseId: marketingCourse.id,
          question: "What does SEO stand for?",
          options: ["Social Engine Optimization", "Search Engine Optimization", "Secure Email Operation", "Site Enhancement Organization"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "Which metric is most important for measuring social media engagement?",
          options: ["Follower count", "Engagement rate", "Post frequency", "Account age"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "What is the primary goal of content marketing?",
          options: ["To sell products directly", "To provide value and build relationships", "To increase website traffic only", "To reduce advertising costs"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "Which platform is best for B2B marketing?",
          options: ["Instagram", "TikTok", "LinkedIn", "Snapchat"],
          correctAnswer: 2,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "What is A/B testing in digital marketing?",
          options: ["Testing two different audiences", "Comparing two versions of content to see which performs better", "Testing website security", "Analyzing competitor strategies"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "What does CTR stand for?",
          options: ["Customer Target Rate", "Click-Through Rate", "Content Transfer Rate", "Campaign Time Ratio"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "Which is the most important factor for email marketing success?",
          options: ["Email design", "Subject line", "Sending frequency", "List size"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "What is the purpose of a sales funnel?",
          options: ["To increase website speed", "To guide prospects through the buying process", "To improve SEO rankings", "To manage social media"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "Which Google Analytics metric shows how long users stay on your site?",
          options: ["Bounce rate", "Session duration", "Page views", "Conversion rate"],
          correctAnswer: 1,
          isActive: true
        },
        {
          courseId: marketingCourse.id,
          question: "What is retargeting in digital advertising?",
          options: ["Targeting new customers", "Showing ads to people who previously visited your website", "Targeting competitors' customers", "Optimizing ad spending"],
          correctAnswer: 1,
          isActive: true
        }
      ];

      await db.insert(questions).values(marketingQuestions);
      console.log("Questions seeded for Digital Marketing course");
    }

    console.log("Database seeding completed successfully!");
    console.log("Admin login: admin@octamy.com / admin123");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
