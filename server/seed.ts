import { db } from "./db";
import { categories, courses, questions, users, examAttempts, certificates } from "@shared/schema";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  try {
    const existingCategories = await db.select().from(categories);
    if (existingCategories.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    console.log("Seeding database...");

    const categoryData = [
      {
        name: "AI & Machine Learning",
        description: "Machine Learning, Deep Learning, NLP, Computer Vision, and AI Ethics certifications",
        icon: "brain",
        slug: "ai-ml"
      },
      {
        name: "Development",
        description: "Frontend, Backend, Mobile, DevOps, and Full-Stack development certifications",
        icon: "code",
        slug: "development"
      },
      {
        name: "Business & Marketing",
        description: "Digital Marketing, Analytics, Strategy, Leadership, and Business Management certifications",
        icon: "trending-up",
        slug: "business"
      },
      {
        name: "Data Science & Analytics",
        description: "Data Analysis, Statistics, Big Data, Business Intelligence, and Data Visualization certifications",
        icon: "database",
        slug: "data-science"
      },
      {
        name: "Public Sector - UPSC",
        description: "UPSC Civil Services Examination preparation including IAS, IPS, IFS, and yearly previous papers",
        icon: "landmark",
        slug: "upsc"
      },
      {
        name: "Public Sector - SSC",
        description: "Staff Selection Commission exams including SSC CGL, SSC CHSL, SSC MTS, and yearly papers",
        icon: "file-text",
        slug: "ssc"
      },
      {
        name: "Public Sector - Railway",
        description: "Railway Recruitment Board exams including RRB NTPC, RRB JE, Group D, and yearly papers",
        icon: "train",
        slug: "railway"
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

    const hashedPassword = await bcrypt.hash("admin123", 10);
    const adminUser = await db.insert(users).values({
      email: "admin@premcq.com",
      password: hashedPassword,
      name: "Admin User",
      isAdmin: true,
    }).returning();
    console.log("Admin user created:", adminUser[0].email);

    const testUserPassword = await bcrypt.hash("test123", 10);
    const testUsers = await db.insert(users).values([
      {
        email: "john.doe@example.com",
        password: testUserPassword,
        name: "John Doe",
        isAdmin: false,
      },
      {
        email: "jane.smith@example.com",
        password: testUserPassword,
        name: "Jane Smith",
        isAdmin: false,
      },
      {
        email: "rahul.kumar@example.com",
        password: testUserPassword,
        name: "Rahul Kumar",
        isAdmin: false,
      }
    ]).returning();
    console.log("Test users created:", testUsers.length);

    const aiCategory = insertedCategories.find(c => c.slug === "ai-ml")!;
    const devCategory = insertedCategories.find(c => c.slug === "development")!;
    const businessCategory = insertedCategories.find(c => c.slug === "business")!;
    const dataCategory = insertedCategories.find(c => c.slug === "data-science")!;
    const upscCategory = insertedCategories.find(c => c.slug === "upsc")!;
    const sscCategory = insertedCategories.find(c => c.slug === "ssc")!;
    const railwayCategory = insertedCategories.find(c => c.slug === "railway")!;
    const internshipCategory = insertedCategories.find(c => c.slug === "internships")!;

    const courseData = [
      {
        title: "Machine Learning Fundamentals",
        slug: "machine-learning-fundamentals",
        description: "Master the basics of ML algorithms, supervised and unsupervised learning, model evaluation, and real-world applications.",
        categoryId: aiCategory.id,
        duration: 15,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Deep Learning with Neural Networks",
        slug: "deep-learning-neural-networks",
        description: "Comprehensive course on neural networks, backpropagation, CNNs, RNNs, and modern deep learning frameworks.",
        categoryId: aiCategory.id,
        duration: 20,
        passingScore: 50,
        price: "249.00",
        isActive: true
      },
      {
        title: "Natural Language Processing",
        slug: "natural-language-processing",
        description: "Learn text processing, sentiment analysis, language models, transformers, and NLP applications.",
        categoryId: aiCategory.id,
        duration: 18,
        passingScore: 50,
        price: "229.00",
        isActive: true
      },
      {
        title: "Computer Vision Professional",
        slug: "computer-vision-professional",
        description: "Image processing, object detection, facial recognition, and computer vision applications with OpenCV and TensorFlow.",
        categoryId: aiCategory.id,
        duration: 22,
        passingScore: 50,
        price: "269.00",
        isActive: true
      },
      {
        title: "React.js Professional",
        slug: "reactjs-professional",
        description: "Advanced React concepts, hooks, state management, testing, and best practices for modern web development.",
        categoryId: devCategory.id,
        duration: 12,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Node.js Backend Development",
        slug: "nodejs-backend-development",
        description: "Build scalable backend applications with Node.js, Express, databases, authentication, and API design.",
        categoryId: devCategory.id,
        duration: 16,
        passingScore: 50,
        price: "219.00",
        isActive: true
      },
      {
        title: "Full Stack JavaScript Developer",
        slug: "fullstack-javascript-developer",
        description: "Complete full-stack development with JavaScript, React, Node.js, MongoDB, and deployment strategies.",
        categoryId: devCategory.id,
        duration: 25,
        passingScore: 50,
        price: "299.00",
        isActive: true
      },
      {
        title: "Python for Backend Development",
        slug: "python-backend-development",
        description: "Django, Flask, FastAPI, database integration, REST APIs, and Python web development best practices.",
        categoryId: devCategory.id,
        duration: 18,
        passingScore: 50,
        price: "239.00",
        isActive: true
      },
      {
        title: "DevOps Engineering Essentials",
        slug: "devops-engineering-essentials",
        description: "CI/CD, Docker, Kubernetes, AWS, monitoring, automation, and infrastructure as code.",
        categoryId: devCategory.id,
        duration: 20,
        passingScore: 50,
        price: "259.00",
        isActive: true
      },
      {
        title: "Digital Marketing Strategy",
        slug: "digital-marketing-strategy",
        description: "SEO, SEM, social media marketing, content strategy, analytics, and customer acquisition.",
        categoryId: businessCategory.id,
        duration: 10,
        passingScore: 50,
        price: "179.00",
        isActive: true
      },
      {
        title: "Business Analytics with Data",
        slug: "business-analytics-data",
        description: "Data-driven decision making, KPI analysis, business intelligence, and strategic insights from data.",
        categoryId: businessCategory.id,
        duration: 14,
        passingScore: 50,
        price: "199.00",
        isActive: true
      },
      {
        title: "Project Management Professional",
        slug: "project-management-professional",
        description: "Agile, Scrum, project planning, team leadership, risk management, and delivery optimization.",
        categoryId: businessCategory.id,
        duration: 12,
        passingScore: 50,
        price: "189.00",
        isActive: true
      },
      {
        title: "Data Science with Python",
        slug: "data-science-python",
        description: "NumPy, Pandas, Scikit-learn, data cleaning, exploratory analysis, and machine learning pipelines.",
        categoryId: dataCategory.id,
        duration: 20,
        passingScore: 50,
        price: "249.00",
        isActive: true
      },
      {
        title: "SQL for Data Analysis",
        slug: "sql-data-analysis",
        description: "Advanced SQL queries, joins, subqueries, window functions, and database optimization for analytics.",
        categoryId: dataCategory.id,
        duration: 12,
        passingScore: 50,
        price: "179.00",
        isActive: true
      },
      {
        title: "Data Visualization with Tableau",
        slug: "data-visualization-tableau",
        description: "Create interactive dashboards, storytelling with data, advanced charts, and business reporting.",
        categoryId: dataCategory.id,
        duration: 10,
        passingScore: 50,
        price: "169.00",
        isActive: true
      },
      {
        title: "UPSC Prelims - General Studies 2024",
        slug: "upsc-prelims-general-studies-2024",
        description: "Comprehensive preparation for UPSC Civil Services Prelims with previous year papers and practice tests.",
        categoryId: upscCategory.id,
        duration: 30,
        passingScore: 60,
        price: "299.00",
        isActive: true
      },
      {
        title: "UPSC Mains - Essay Writing",
        slug: "upsc-mains-essay-writing",
        description: "Master essay writing for UPSC Mains with structured approach, examples, and expert guidance.",
        categoryId: upscCategory.id,
        duration: 15,
        passingScore: 60,
        price: "249.00",
        isActive: true
      },
      {
        title: "IAS Interview Preparation",
        slug: "ias-interview-preparation",
        description: "Personality test preparation with mock interviews, current affairs, and communication skills.",
        categoryId: upscCategory.id,
        duration: 20,
        passingScore: 60,
        price: "349.00",
        isActive: true
      },
      {
        title: "SSC CGL 2024 - Complete Preparation",
        slug: "ssc-cgl-2024-complete",
        description: "Staff Selection Commission Combined Graduate Level exam preparation with all sections covered.",
        categoryId: sscCategory.id,
        duration: 25,
        passingScore: 60,
        price: "249.00",
        isActive: true
      },
      {
        title: "SSC CHSL - Tier 1 & Tier 2",
        slug: "ssc-chsl-tier-1-2",
        description: "Combined Higher Secondary Level exam preparation with quantitative aptitude, reasoning, and English.",
        categoryId: sscCategory.id,
        duration: 20,
        passingScore: 60,
        price: "219.00",
        isActive: true
      },
      {
        title: "RRB NTPC 2024 - Complete Guide",
        slug: "rrb-ntpc-2024-complete",
        description: "Railway Non-Technical Popular Categories exam with mathematics, reasoning, and general awareness.",
        categoryId: railwayCategory.id,
        duration: 22,
        passingScore: 60,
        price: "229.00",
        isActive: true
      },
      {
        title: "RRB Group D - Technical Preparation",
        slug: "rrb-group-d-technical",
        description: "Railway Group D examination covering mathematics, reasoning, science, and general awareness.",
        categoryId: railwayCategory.id,
        duration: 18,
        passingScore: 60,
        price: "199.00",
        isActive: true
      },
      {
        title: "Virtual Software Development Internship",
        slug: "virtual-software-dev-internship",
        description: "Complete software development internship with real projects, code reviews, and industry mentorship.",
        categoryId: internshipCategory.id,
        duration: 20,
        passingScore: 50,
        price: "399.00",
        isActive: true
      },
      {
        title: "Data Science Internship Program",
        slug: "data-science-internship",
        description: "Hands-on data science experience with real datasets, analysis projects, and professional guidance.",
        categoryId: internshipCategory.id,
        duration: 18,
        passingScore: 50,
        price: "379.00",
        isActive: true
      }
    ];

    const insertedCourses = await db.insert(courses).values(courseData).returning();
    console.log("Courses seeded:", insertedCourses.length);

    const mlCourse = insertedCourses.find(c => c.title === "Machine Learning Fundamentals")!;
    const mlQuestions = [
      {
        courseId: mlCourse.id,
        question: "Which of the following is NOT a supervised learning algorithm?",
        options: ["Linear Regression", "K-Means Clustering", "Decision Trees", "Support Vector Machine"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "What is the primary purpose of cross-validation in machine learning?",
        options: ["To increase training speed", "To evaluate model performance", "To reduce overfitting", "To clean the dataset"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "Which metric is most appropriate for evaluating a binary classification model with imbalanced classes?",
        options: ["Accuracy", "Precision", "F1-Score", "Mean Squared Error"],
        correctAnswer: 2,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "What does 'overfitting' mean in machine learning?",
        options: ["Model performs well on training data but poorly on test data", "Model performs poorly on both training and test data", "Model performs well on test data but poorly on training data", "Model takes too long to train"],
        correctAnswer: 0,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "Which algorithm is best suited for clustering tasks?",
        options: ["Linear Regression", "K-Means", "Logistic Regression", "Random Forest"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "What is the purpose of feature scaling in machine learning?",
        options: ["To reduce the number of features", "To normalize the range of feature values", "To remove irrelevant features", "To create new features"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "Which of the following is an ensemble learning method?",
        options: ["K-Nearest Neighbors", "Random Forest", "Linear Regression", "K-Means"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "What is the main difference between classification and regression?",
        options: ["Classification predicts continuous values, regression predicts categories", "Classification predicts categories, regression predicts continuous values", "There is no difference", "Classification is supervised, regression is unsupervised"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "Which technique is used to prevent overfitting?",
        options: ["Regularization", "Feature scaling", "Data cleaning", "Increasing model complexity"],
        correctAnswer: 0,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "What is the purpose of a validation set in machine learning?",
        options: ["To train the model", "To test the final model performance", "To tune hyperparameters", "To clean the data"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "Which algorithm is known for being interpretable and easy to understand?",
        options: ["Neural Networks", "Support Vector Machine", "Decision Trees", "Deep Learning"],
        correctAnswer: 2,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "What does the term 'gradient descent' refer to?",
        options: ["A data preprocessing technique", "An optimization algorithm", "A model evaluation metric", "A feature selection method"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "Which of the following is NOT a common data preprocessing step?",
        options: ["Handling missing values", "Feature scaling", "Model training", "Outlier detection"],
        correctAnswer: 2,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "What is the bias-variance tradeoff?",
        options: ["A method to select features", "A balance between model complexity and generalization", "A way to split data", "A type of regularization"],
        correctAnswer: 1,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: mlCourse.id,
        question: "Which metric would you use to evaluate a regression model?",
        options: ["Accuracy", "Precision", "Mean Squared Error", "F1-Score"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      }
    ];

    await db.insert(questions).values(mlQuestions);
    console.log("Machine Learning questions seeded");

    const reactCourse = insertedCourses.find(c => c.title === "React.js Professional")!;
    const reactQuestions = [
      {
        courseId: reactCourse.id,
        question: "What is the primary purpose of React hooks?",
        options: ["To replace class components", "To manage state and lifecycle in functional components", "To improve performance", "To handle routing"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "Which hook is used for managing component state?",
        options: ["useEffect", "useState", "useContext", "useReducer"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "What is the Virtual DOM in React?",
        options: ["A real DOM element", "A JavaScript representation of the real DOM", "A database", "A routing system"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "Which method is called when a component is first mounted?",
        options: ["componentDidUpdate", "componentWillUnmount", "componentDidMount", "render"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "What is JSX?",
        options: ["A new programming language", "JavaScript XML syntax extension", "A database query language", "A styling framework"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "Which hook is used for side effects in functional components?",
        options: ["useState", "useEffect", "useContext", "useMemo"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "What is the purpose of React.memo()?",
        options: ["To manage state", "To optimize performance by memoizing components", "To handle events", "To manage routing"],
        correctAnswer: 1,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "Which pattern is recommended for passing data to deeply nested components?",
        options: ["Props drilling", "Context API", "Global variables", "Local storage"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "What is the difference between controlled and uncontrolled components?",
        options: ["No difference", "Controlled components manage their own state", "Controlled components have their state managed by React", "Uncontrolled components use hooks"],
        correctAnswer: 2,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "Which tool is commonly used for state management in large React applications?",
        options: ["Redux", "jQuery", "Bootstrap", "Webpack"],
        correctAnswer: 0,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "What is the purpose of useCallback hook?",
        options: ["To manage state", "To memoize functions", "To handle side effects", "To access context"],
        correctAnswer: 1,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "Which of the following is NOT a valid way to handle events in React?",
        options: ["onClick={handleClick}", "onClick={handleClick()}", "onClick={() => handleClick()}", "onClick={function() { handleClick(); }}"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "What is prop drilling in React?",
        options: ["Passing props to child components", "Passing props through multiple component layers", "Using TypeScript with props", "Validating props"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "Which lifecycle method is invoked immediately after a component is mounted?",
        options: ["componentWillMount", "componentDidMount", "componentWillUpdate", "shouldComponentUpdate"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: reactCourse.id,
        question: "What does the useReducer hook help with?",
        options: ["Managing complex state logic", "Creating reusable components", "Handling side effects", "Performance optimization"],
        correctAnswer: 0,
        difficulty: "hard",
        isActive: true
      }
    ];

    await db.insert(questions).values(reactQuestions);
    console.log("React.js questions seeded");

    const marketingCourse = insertedCourses.find(c => c.title === "Digital Marketing Strategy")!;
    const marketingQuestions = [
      {
        courseId: marketingCourse.id,
        question: "What does SEO stand for?",
        options: ["Social Engine Optimization", "Search Engine Optimization", "Secure Email Operation", "Site Enhancement Organization"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "Which metric is most important for measuring social media engagement?",
        options: ["Follower count", "Engagement rate", "Post frequency", "Account age"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "What is the primary goal of content marketing?",
        options: ["To sell products directly", "To provide value and build relationships", "To increase website traffic only", "To reduce advertising costs"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "Which platform is best for B2B marketing?",
        options: ["Instagram", "TikTok", "LinkedIn", "Snapchat"],
        correctAnswer: 2,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "What is A/B testing in digital marketing?",
        options: ["Testing two different audiences", "Comparing two versions of content to see which performs better", "Testing website security", "Analyzing competitor strategies"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "What does CTR stand for?",
        options: ["Customer Target Rate", "Click-Through Rate", "Content Transfer Rate", "Campaign Time Ratio"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "Which is the most important factor for email marketing success?",
        options: ["Email design", "Subject line", "Sending frequency", "List size"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "What is the purpose of a sales funnel?",
        options: ["To increase website speed", "To guide prospects through the buying process", "To improve SEO rankings", "To manage social media"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "Which Google Analytics metric shows how long users stay on your site?",
        options: ["Bounce rate", "Session duration", "Page views", "Conversion rate"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "What is retargeting in digital advertising?",
        options: ["Targeting new customers", "Showing ads to people who previously visited your website", "Targeting competitors' customers", "Optimizing ad spending"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "What does KPI stand for in marketing?",
        options: ["Key Performance Indicator", "Knowledge Process Integration", "Key Product Information", "Keyword Positioning Index"],
        correctAnswer: 0,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: marketingCourse.id,
        question: "Which type of content typically generates the most engagement on social media?",
        options: ["Text posts", "Images", "Videos", "Links"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      }
    ];

    await db.insert(questions).values(marketingQuestions);
    console.log("Digital Marketing questions seeded");

    const upscCourse = insertedCourses.find(c => c.title === "UPSC Prelims - General Studies 2024")!;
    const upscQuestions = [
      {
        courseId: upscCourse.id,
        question: "The Directive Principles of State Policy in the Indian Constitution are:",
        options: ["Justiciable and enforceable by courts", "Non-justiciable but fundamental in governance", "Applicable only to Central Government", "Binding on citizens"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "Which Article of the Indian Constitution deals with the amendment of the Constitution?",
        options: ["Article 356", "Article 368", "Article 370", "Article 352"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "The Preamble of the Indian Constitution declares India as:",
        options: ["Sovereign, Socialist, Secular, Democratic Republic", "Federal, Socialist, Secular, Democratic State", "Sovereign, Federal, Secular, Democratic Republic", "Sovereign, Socialist, Federal, Democratic Republic"],
        correctAnswer: 0,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "Which of the following is a greenhouse gas?",
        options: ["Nitrogen", "Oxygen", "Carbon Dioxide", "Hydrogen"],
        correctAnswer: 2,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "The Indian National Congress was founded in which year?",
        options: ["1857", "1885", "1905", "1920"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "Which river is known as the 'Sorrow of Bihar'?",
        options: ["Ganges", "Kosi", "Yamuna", "Brahmaputra"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "The Battle of Plassey was fought in:",
        options: ["1757", "1764", "1857", "1947"],
        correctAnswer: 0,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "Which is the largest national park in India?",
        options: ["Jim Corbett National Park", "Kaziranga National Park", "Hemis National Park", "Bandipur National Park"],
        correctAnswer: 2,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "The Reserve Bank of India was nationalized in:",
        options: ["1935", "1947", "1949", "1969"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "Which Five-Year Plan focused on 'Growth with Social Justice and Equality'?",
        options: ["First Plan", "Fifth Plan", "Seventh Plan", "Tenth Plan"],
        correctAnswer: 1,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "The Indian Constitution is borrowed most heavily from which country's constitution?",
        options: ["USA", "UK", "Canada", "Government of India Act, 1935"],
        correctAnswer: 3,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "Which state in India has the longest coastline?",
        options: ["Tamil Nadu", "Andhra Pradesh", "Gujarat", "Maharashtra"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "The Quit India Movement was launched in:",
        options: ["1940", "1942", "1945", "1947"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "Which Article prohibits discrimination on grounds of religion, race, caste, sex, or place of birth?",
        options: ["Article 14", "Article 15", "Article 16", "Article 17"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: upscCourse.id,
        question: "The concept of Public Interest Litigation (PIL) was introduced in India during which decade?",
        options: ["1960s", "1970s", "1980s", "1990s"],
        correctAnswer: 2,
        difficulty: "hard",
        isActive: true
      }
    ];

    await db.insert(questions).values(upscQuestions);
    console.log("UPSC questions seeded");

    const sscCourse = insertedCourses.find(c => c.title === "SSC CGL 2024 - Complete Preparation")!;
    const sscQuestions = [
      {
        courseId: sscCourse.id,
        question: "If 20% of a number is 50, what is 40% of that number?",
        options: ["80", "100", "120", "150"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "A train 100 meters long passes a pole in 10 seconds. What is its speed in km/hr?",
        options: ["36", "30", "40", "50"],
        correctAnswer: 0,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "Find the odd one out: 2, 5, 10, 17, 26, 37",
        options: ["2", "10", "26", "37"],
        correctAnswer: 3,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "The average of 5 consecutive numbers is 27. What is the largest number?",
        options: ["27", "28", "29", "30"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "Choose the correct synonym for 'METICULOUS':",
        options: ["Careless", "Careful", "Hasty", "Negligent"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "Choose the correct antonym for 'VERBOSE':",
        options: ["Concise", "Wordy", "Lengthy", "Elaborate"],
        correctAnswer: 0,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "If CRICKET is coded as DSJDLFU, how is FOOTBALL coded?",
        options: ["GPPUCBMM", "GPPUCAMM", "GPPTCBMM", "GPPUCBML"],
        correctAnswer: 0,
        difficulty: "hard",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "What is 15% of 200?",
        options: ["25", "30", "35", "40"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "The LCM of 12 and 18 is:",
        options: ["36", "54", "72", "108"],
        correctAnswer: 0,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "Complete the series: 2, 6, 12, 20, 30, ?",
        options: ["40", "42", "44", "46"],
        correctAnswer: 1,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "Which of the following is a prime number?",
        options: ["91", "87", "83", "93"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: sscCourse.id,
        question: "The ratio of 3:4 is the same as:",
        options: ["6:7", "9:12", "12:15", "15:18"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      }
    ];

    await db.insert(questions).values(sscQuestions);
    console.log("SSC CGL questions seeded");

    const dataScienceCourse = insertedCourses.find(c => c.title === "Data Science with Python")!;
    const dataScienceQuestions = [
      {
        courseId: dataScienceCourse.id,
        question: "Which library is primarily used for data manipulation in Python?",
        options: ["NumPy", "Pandas", "Matplotlib", "Scikit-learn"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "What does the 'iloc' function in Pandas do?",
        options: ["Index location-based indexing", "Label-based indexing", "Boolean indexing", "Random indexing"],
        correctAnswer: 0,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "Which of the following is used for creating visualizations in Python?",
        options: ["NumPy", "Pandas", "Matplotlib", "Requests"],
        correctAnswer: 2,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "What is the purpose of train_test_split in scikit-learn?",
        options: ["To clean data", "To split data into training and testing sets", "To normalize data", "To create new features"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "Which method is used to handle missing values in Pandas?",
        options: ["dropna()", "fillna()", "Both A and B", "None of the above"],
        correctAnswer: 2,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "What is feature engineering in data science?",
        options: ["Creating new features from existing data", "Removing features", "Scaling features", "Encoding features"],
        correctAnswer: 0,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "Which algorithm is commonly used for regression tasks?",
        options: ["K-Means", "Linear Regression", "Decision Trees", "Random Forest"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "What does EDA stand for in data science?",
        options: ["Exploratory Data Analysis", "Experimental Data Analysis", "Enhanced Data Analysis", "Efficient Data Analysis"],
        correctAnswer: 0,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "Which library is used for implementing machine learning algorithms in Python?",
        options: ["NumPy", "Pandas", "Scikit-learn", "Matplotlib"],
        correctAnswer: 2,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "What is the purpose of StandardScaler in scikit-learn?",
        options: ["To normalize features", "To encode categorical variables", "To split data", "To handle missing values"],
        correctAnswer: 0,
        difficulty: "medium",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "Which plot is best for showing the distribution of a single variable?",
        options: ["Scatter plot", "Histogram", "Line plot", "Bar chart"],
        correctAnswer: 1,
        difficulty: "easy",
        isActive: true
      },
      {
        courseId: dataScienceCourse.id,
        question: "What does the 'groupby' function in Pandas do?",
        options: ["Groups data by a column", "Sorts data", "Filters data", "Merges data"],
        correctAnswer: 0,
        difficulty: "easy",
        isActive: true
      }
    ];

    await db.insert(questions).values(dataScienceQuestions);
    console.log("Data Science questions seeded");

    const examDate1 = new Date();
    examDate1.setDate(examDate1.getDate() - 5);
    
    const examDate2 = new Date();
    examDate2.setDate(examDate2.getDate() - 10);

    const examDate3 = new Date();
    examDate3.setDate(examDate3.getDate() - 15);

    const examAttemptData = [
      {
        userId: testUsers[0].id,
        courseId: mlCourse.id,
        score: 80,
        totalQuestions: 15,
        correctAnswers: 12,
        answers: JSON.stringify([
          { questionId: 1, selectedAnswer: 1, isCorrect: true },
          { questionId: 2, selectedAnswer: 1, isCorrect: true },
          { questionId: 3, selectedAnswer: 2, isCorrect: true }
        ]),
        startedAt: examDate1,
        completedAt: examDate1,
      },
      {
        userId: testUsers[1].id,
        courseId: reactCourse.id,
        score: 73,
        totalQuestions: 15,
        correctAnswers: 11,
        answers: JSON.stringify([
          { questionId: 16, selectedAnswer: 1, isCorrect: true },
          { questionId: 17, selectedAnswer: 1, isCorrect: true },
          { questionId: 18, selectedAnswer: 1, isCorrect: true }
        ]),
        startedAt: examDate2,
        completedAt: examDate2,
      },
      {
        userId: testUsers[2].id,
        courseId: upscCourse.id,
        score: 67,
        totalQuestions: 15,
        correctAnswers: 10,
        answers: JSON.stringify([
          { questionId: 40, selectedAnswer: 1, isCorrect: true },
          { questionId: 41, selectedAnswer: 1, isCorrect: true },
          { questionId: 42, selectedAnswer: 0, isCorrect: true }
        ]),
        startedAt: examDate3,
        completedAt: examDate3,
      },
    ];

    const insertedExamAttempts = await db.insert(examAttempts).values(examAttemptData).returning();
    console.log("Exam attempts seeded:", insertedExamAttempts.length);

    const certDate1 = new Date();
    certDate1.setDate(certDate1.getDate() - 3);
    
    const certDate2 = new Date();
    certDate2.setDate(certDate2.getDate() - 8);

    const expiryDate1 = new Date();
    expiryDate1.setFullYear(expiryDate1.getFullYear() + 2);
    
    const expiryDate2 = new Date();
    expiryDate2.setFullYear(expiryDate2.getFullYear() + 2);

    const certificateData = [
      {
        userId: testUsers[0].id,
        courseId: mlCourse.id,
        examAttemptId: insertedExamAttempts[0].id,
        certificateNumber: "OCT-ML-2024-001",
        score: 80,
        grade: "Distinction",
        issuedAt: certDate1,
        expiresAt: expiryDate1,
        certificateUrl: null,
      },
      {
        userId: testUsers[1].id,
        courseId: reactCourse.id,
        examAttemptId: insertedExamAttempts[1].id,
        certificateNumber: "OCT-REACT-2024-002",
        score: 73,
        grade: "Merit",
        issuedAt: certDate2,
        expiresAt: expiryDate2,
        certificateUrl: null,
      },
    ];

    const insertedCertificates = await db.insert(certificates).values(certificateData).returning();
    console.log("Certificates seeded:", insertedCertificates.length);

    console.log("\n===========================================");
    console.log("Database seeding completed successfully!");
    console.log("===========================================\n");
    console.log("Admin login: admin@premcq.com / admin123");
    console.log("Test users (password: test123):");
    console.log("  - john.doe@example.com (has ML certificate)");
    console.log("  - jane.smith@example.com (has React certificate)");
    console.log("  - rahul.kumar@example.com (has UPSC exam attempt)");
    console.log("\nCategories:", insertedCategories.length);
    console.log("Courses:", insertedCourses.length);
    console.log("Total Questions:", mlQuestions.length + reactQuestions.length + marketingQuestions.length + upscQuestions.length + sscQuestions.length + dataScienceQuestions.length);
    console.log("Exam Attempts:", insertedExamAttempts.length);
    console.log("Certificates:", insertedCertificates.length);
    console.log("===========================================\n");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
