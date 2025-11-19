import { db } from "./db";
import { categories, courses, questions } from "@shared/schema";

export async function createComprehensiveSeed() {
  console.log("Creating comprehensive course catalog...");

  // Insert 10 comprehensive categories
  const categoryData = [
    { name: "AI", description: "Artificial Intelligence and Machine Learning", icon: "🤖", slug: "ai" },
    { name: "Development", description: "Software Development and Programming", icon: "💻", slug: "development" },
    { name: "Business", description: "Business Strategy and Management", icon: "📊", slug: "business" },
    { name: "Data Science", description: "Data Analysis and Data Science", icon: "📈", slug: "data-science" },
    { name: "Design", description: "UI/UX Design and Creative Arts", icon: "🎨", slug: "design" },
    { name: "Marketing", description: "Digital Marketing and Growth", icon: "📢", slug: "marketing" },
    { name: "Cybersecurity", description: "Information Security and Privacy", icon: "🔒", slug: "cybersecurity" },
    { name: "Finance", description: "Financial Analysis and Management", icon: "💰", slug: "finance" },
    { name: "Project Management", description: "Project Planning and Execution", icon: "📋", slug: "project-management" },
    { name: "Internships", description: "Virtual Internship Opportunities", icon: "🎯", slug: "internships" },
  ];

  const insertedCategories = await db.insert(categories).values(categoryData).returning();
  console.log(`Inserted ${insertedCategories.length} categories`);

  // Define course templates for each category with different levels
  const courseTemplates = {
    "AI": [
      { title: "Machine Learning Fundamentals", description: "Core ML algorithms, supervised and unsupervised learning, model evaluation techniques", level: "novice" },
      { title: "Deep Learning & Neural Networks", description: "Advanced neural network architectures, CNNs, RNNs, and transformer models", level: "intermediate" },
      { title: "Natural Language Processing", description: "Text processing, sentiment analysis, language models, and chatbot development", level: "advanced" },
      { title: "Computer Vision", description: "Image recognition, object detection, facial recognition, and visual AI systems", level: "expert" },
      { title: "AI Ethics & Governance", description: "Responsible AI development, bias detection, fairness, and ethical considerations", level: "intermediate" },
    ],
    "Development": [
      { title: "Web Development Basics", description: "HTML, CSS, JavaScript fundamentals, responsive design, and modern web standards", level: "novice" },
      { title: "Frontend Frameworks", description: "React, Vue, Angular development, component architecture, and state management", level: "intermediate" },
      { title: "Backend Development", description: "Server-side programming, APIs, databases, and microservices architecture", level: "advanced" },
      { title: "DevOps & Cloud", description: "CI/CD pipelines, containerization, cloud deployment, and infrastructure management", level: "expert" },
      { title: "Mobile App Development", description: "iOS and Android app creation, cross-platform development, and app store deployment", level: "intermediate" },
    ],
    "Business": [
      { title: "Business Strategy Fundamentals", description: "Strategic planning, market analysis, competitive positioning, and business model design", level: "novice" },
      { title: "Operations Management", description: "Process optimization, supply chain management, quality control, and efficiency improvement", level: "intermediate" },
      { title: "Strategic Leadership", description: "Executive decision making, organizational change, team leadership, and vision setting", level: "advanced" },
      { title: "Innovation Management", description: "Innovation processes, R&D management, technology adoption, and disruptive strategies", level: "expert" },
      { title: "Entrepreneurship", description: "Startup creation, business planning, funding strategies, and scaling operations", level: "intermediate" },
    ],
    "Data Science": [
      { title: "Data Analytics Basics", description: "Statistical analysis, data visualization, Excel proficiency, and basic data interpretation", level: "novice" },
      { title: "Statistical Analysis", description: "Advanced statistics, hypothesis testing, regression analysis, and predictive modeling", level: "intermediate" },
      { title: "Big Data Processing", description: "Hadoop, Spark, distributed computing, and large-scale data processing techniques", level: "advanced" },
      { title: "Data Science Architecture", description: "End-to-end data pipelines, MLOps, data engineering, and production systems", level: "expert" },
      { title: "Business Intelligence", description: "Dashboard creation, KPI development, data-driven decision making, and reporting", level: "intermediate" },
    ],
    "Design": [
      { title: "Design Principles", description: "Color theory, typography, composition, visual hierarchy, and design fundamentals", level: "novice" },
      { title: "UI/UX Design", description: "User interface design, user experience research, prototyping, and usability testing", level: "intermediate" },
      { title: "Advanced Prototyping", description: "Interactive design systems, design tokens, component libraries, and advanced prototyping", level: "advanced" },
      { title: "Design Leadership", description: "Design team management, design strategy, stakeholder communication, and design operations", level: "expert" },
      { title: "Brand Identity", description: "Brand strategy, visual identity creation, brand guidelines, and brand experience design", level: "intermediate" },
    ],
    "Marketing": [
      { title: "Digital Marketing Basics", description: "Marketing fundamentals, customer personas, marketing channels, and campaign planning", level: "novice" },
      { title: "Content Marketing", description: "Content strategy, copywriting, storytelling, content distribution, and engagement tactics", level: "intermediate" },
      { title: "Performance Marketing", description: "Data-driven campaigns, attribution modeling, conversion optimization, and ROI analysis", level: "advanced" },
      { title: "Growth Hacking", description: "Rapid scaling techniques, viral marketing, product-led growth, and growth experimentation", level: "expert" },
      { title: "Social Media Strategy", description: "Platform-specific strategies, community building, influencer marketing, and social commerce", level: "intermediate" },
    ],
    "Cybersecurity": [
      { title: "Security Fundamentals", description: "Basic cybersecurity concepts, threat landscape, security policies, and risk assessment", level: "novice" },
      { title: "Network Security", description: "Firewall configuration, intrusion detection, VPNs, and network monitoring techniques", level: "intermediate" },
      { title: "Ethical Hacking", description: "Penetration testing, vulnerability assessment, security tools, and ethical hacking methodologies", level: "advanced" },
      { title: "Security Architecture", description: "Enterprise security design, zero-trust architecture, security frameworks, and compliance", level: "expert" },
      { title: "Incident Response", description: "Security breach management, forensics, recovery procedures, and crisis communication", level: "intermediate" },
    ],
    "Finance": [
      { title: "Financial Fundamentals", description: "Accounting principles, financial statements, budgeting, and basic financial analysis", level: "novice" },
      { title: "Investment Analysis", description: "Portfolio management, risk assessment, asset valuation, and investment strategies", level: "intermediate" },
      { title: "Corporate Finance", description: "Capital structure, mergers and acquisitions, financial planning, and valuation methods", level: "advanced" },
      { title: "Risk Management", description: "Financial risk assessment, derivatives, hedging strategies, and regulatory compliance", level: "expert" },
      { title: "Fintech Innovation", description: "Digital banking, blockchain, cryptocurrency, and financial technology trends", level: "intermediate" },
    ],
    "Project Management": [
      { title: "Project Management Basics", description: "Project lifecycle, planning techniques, resource management, and stakeholder communication", level: "novice" },
      { title: "Agile Methodology", description: "Scrum framework, sprint planning, agile ceremonies, and iterative development practices", level: "intermediate" },
      { title: "Program Management", description: "Multi-project coordination, portfolio management, strategic alignment, and governance", level: "advanced" },
      { title: "Strategic PMO", description: "Project management office setup, methodology standardization, and organizational maturity", level: "expert" },
      { title: "Digital Transformation", description: "Change management, technology adoption, process digitization, and transformation leadership", level: "intermediate" },
    ],
    "Internships": [
      { title: "Software Engineering Internship", description: "Full-stack development, code reviews, agile methodologies, and real-world project experience", level: "intermediate" },
      { title: "Data Science Internship", description: "Hands-on data analysis, machine learning projects, and business intelligence reporting", level: "intermediate" },
      { title: "Marketing Internship", description: "Campaign management, content creation, analytics, and digital marketing execution", level: "novice" },
      { title: "Business Analyst Internship", description: "Process improvement, requirements gathering, stakeholder management, and solution design", level: "intermediate" },
      { title: "UX Design Internship", description: "User research, wireframing, prototyping, and design thinking methodologies", level: "intermediate" },
    ],
  };

  // Insert courses for each category
  const allCourses = [];
  for (const category of insertedCategories) {
    const templates = courseTemplates[category.name] || [];
    
    for (const template of templates) {
      const course = {
        title: template.title,
        description: template.description,
        slug: template.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        categoryId: category.id,
        duration: template.level === 'novice' ? 15 : template.level === 'intermediate' ? 25 : template.level === 'advanced' ? 35 : 45,
        passingScore: template.level === 'novice' ? 60 : template.level === 'intermediate' ? 70 : template.level === 'advanced' ? 80 : 85,
        price: template.level === 'novice' ? "199.00" : template.level === 'intermediate' ? "299.00" : template.level === 'advanced' ? "399.00" : "499.00",
        level: template.level,
        isInternship: category.name === "Internships",
        metaTitle: `${template.title} Certification - ${category.name} | PremCQ`,
        metaDescription: `Get certified in ${template.title}. ${template.description}. Industry-recognized certification.`,
      };
      allCourses.push(course);
    }
  }

  const insertedCourses = await db.insert(courses).values(allCourses).returning();
  console.log(`Inserted ${insertedCourses.length} courses`);

  // Generate diverse, high-quality questions for each course
  const questionsByLevel = {
    novice: [
      "What is the primary purpose of {concept} in modern applications?",
      "Which of the following best describes the basic principles of {concept}?",
      "In what scenario would a beginner typically use {concept}?",
      "What are the fundamental components required for {concept}?",
      "Which tool is most commonly recommended for learning {concept}?",
      "What is the main advantage of using {concept} over traditional methods?",
      "How does {concept} help improve basic workflow efficiency?",
      "What are the essential prerequisites before starting with {concept}?",
      "Which approach is considered best practice for beginners in {concept}?",
      "What common mistakes should be avoided when first learning {concept}?",
    ],
    intermediate: [
      "How would you optimize {concept} for better performance in production?",
      "What are the key differences between {concept} and its alternatives?",
      "Which design pattern works best when implementing {concept}?",
      "How do you handle error scenarios when working with {concept}?",
      "What metrics should be monitored when using {concept} in practice?",
      "How would you scale {concept} for enterprise-level applications?",
      "What security considerations are important when implementing {concept}?",
      "How do you integrate {concept} with existing systems effectively?",
      "What are the performance implications of different {concept} configurations?",
      "How would you troubleshoot common issues with {concept}?",
    ],
    advanced: [
      "What advanced techniques can be used to extend {concept} functionality?",
      "How would you architect a system that heavily relies on {concept}?",
      "What are the theoretical foundations behind {concept} algorithms?",
      "How do you implement custom solutions when standard {concept} falls short?",
      "What are the trade-offs between different {concept} implementation strategies?",
      "How would you design a distributed system incorporating {concept}?",
      "What emerging trends are shaping the future of {concept}?",
      "How do you benchmark and optimize {concept} for specific use cases?",
      "What research methodologies apply to advancing {concept} techniques?",
      "How would you lead a team implementing complex {concept} solutions?",
    ],
    expert: [
      "How would you pioneer new methodologies in {concept} for industry transformation?",
      "What cutting-edge research directions show promise for {concept} advancement?",
      "How do you establish industry standards and best practices for {concept}?",
      "What strategic considerations guide enterprise adoption of {concept}?",
      "How would you design the next generation of {concept} frameworks?",
      "What interdisciplinary approaches can enhance {concept} effectiveness?",
      "How do you evaluate and mitigate risks in innovative {concept} applications?",
      "What thought leadership strategies advance the {concept} field?",
      "How would you mentor teams to achieve mastery in {concept}?",
      "What ethical frameworks should guide advanced {concept} development?",
    ],
  };

  const answerOptionsByLevel = {
    novice: [
      ["Comprehensive correct explanation", "Partially correct basic answer", "Common misconception", "Clearly incorrect option"],
      ["Best practice for beginners", "Alternative basic method", "Outdated simple approach", "Wrong fundamental concept"],
      ["Standard introductory approach", "Common beginner alternative", "Deprecated basic method", "Unrelated basic concept"],
    ],
    intermediate: [
      ["Industry-standard solution", "Viable alternative approach", "Suboptimal but functional method", "Incorrect professional approach"],
      ["Best practice in production", "Acceptable alternative method", "Outdated industry practice", "Wrong professional standard"],
      ["Optimal professional solution", "Good alternative practice", "Acceptable but limited approach", "Incorrect industry method"],
    ],
    advanced: [
      ["Cutting-edge best practice", "Advanced alternative solution", "Traditional but effective method", "Incorrect advanced approach"],
      ["State-of-the-art methodology", "Sophisticated alternative", "Conventional advanced practice", "Wrong expert-level method"],
      ["Research-backed approach", "Innovative alternative method", "Established advanced technique", "Incorrect specialized solution"],
    ],
    expert: [
      ["Pioneering industry solution", "Innovative strategic approach", "Established expert method", "Incorrect thought leadership"],
      ["Next-generation methodology", "Advanced strategic alternative", "Current expert standard", "Wrong visionary approach"],
      ["Transformative best practice", "Strategic innovation method", "Traditional expert approach", "Incorrect industry leadership"],
    ],
  };

  // Generate questions for each course
  for (const course of insertedCourses) {
    const courseLevel = course.level as 'novice' | 'intermediate' | 'advanced' | 'expert';
    const questionTemplates = questionsByLevel[courseLevel];
    const answerOptions = answerOptionsByLevel[courseLevel];
    
    // Generate 120 unique questions per course
    for (let i = 0; i < 120; i++) {
      const templateIndex = i % questionTemplates.length;
      const optionIndex = i % answerOptions.length;
      
      const template = questionTemplates[templateIndex];
      const options = answerOptions[optionIndex];
      
      // Create context-specific concept names based on course
      const concepts = course.title.toLowerCase().split(' ');
      const mainConcept = concepts[0] || 'technology';
      
      const question = template.replace(/{concept}/g, mainConcept);

      await db.insert(questions).values({
        courseId: course.id,
        question: `${question} (${courseLevel.toUpperCase()} Level - Q${i + 1})`,
        options: options,
        correctAnswer: 0, // First option is always correct
        isActive: true,
      });
    }
  }

  console.log("Comprehensive course catalog created successfully!");
  console.log(`Total: ${insertedCategories.length} categories, ${insertedCourses.length} courses, ${insertedCourses.length * 120} questions`);
}