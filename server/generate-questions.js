import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const questionTemplatesByLevel = {
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
    "How do you get started with {concept} as a complete beginner?",
    "What are the key benefits of implementing {concept} in simple projects?",
    "Which resources are most helpful when learning {concept} fundamentals?",
    "What is the typical learning curve for mastering basic {concept}?",
    "How does {concept} compare to similar foundational technologies?"
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
    "What testing strategies work best for {concept} implementations?",
    "How do you maintain and update {concept} systems over time?",
    "What team collaboration practices enhance {concept} development?",
    "How would you document {concept} solutions for other developers?",
    "What deployment strategies minimize risks when using {concept}?"
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
    "What architectural patterns complement {concept} in large systems?",
    "How do you evaluate the long-term viability of {concept} technologies?",
    "What governance frameworks ensure quality in {concept} implementations?",
    "How would you migrate legacy systems to modern {concept} approaches?",
    "What risk management strategies apply to advanced {concept} projects?"
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
    "How do you influence industry direction through {concept} innovation?",
    "What ecosystem partnerships accelerate {concept} advancement?",
    "How would you position an organization as a {concept} leader?",
    "What investment strategies maximize {concept} technology returns?",
    "How do you anticipate and prepare for {concept} paradigm shifts?"
  ]
};

const answerOptionsByLevel = {
  novice: [
    ["Comprehensive correct explanation with clear examples", "Partially correct basic answer", "Common beginner misconception", "Clearly incorrect fundamental concept"],
    ["Best practice approach for beginners", "Alternative basic method", "Outdated simple approach", "Wrong foundational methodology"],
    ["Standard introductory solution", "Common beginner alternative", "Deprecated basic method", "Unrelated basic concept"],
    ["Optimal beginner-friendly approach", "Acceptable starter method", "Limited basic technique", "Incorrect foundational practice"]
  ],
  intermediate: [
    ["Industry-standard professional solution", "Viable alternative approach", "Suboptimal but functional method", "Incorrect professional approach"],
    ["Best practice in production environments", "Acceptable alternative method", "Outdated industry practice", "Wrong professional standard"],
    ["Optimal professional solution", "Good alternative practice", "Acceptable but limited approach", "Incorrect industry method"],
    ["State-of-the-practice methodology", "Solid alternative approach", "Traditional but effective method", "Wrong professional technique"]
  ],
  advanced: [
    ["Cutting-edge best practice solution", "Advanced alternative approach", "Traditional but effective method", "Incorrect advanced technique"],
    ["State-of-the-art methodology", "Sophisticated alternative", "Conventional advanced practice", "Wrong expert-level method"],
    ["Research-backed optimal approach", "Innovative alternative method", "Established advanced technique", "Incorrect specialized solution"],
    ["Next-generation best practice", "Advanced strategic alternative", "Proven sophisticated method", "Wrong specialized approach"]
  ],
  expert: [
    ["Pioneering industry transformation solution", "Innovative strategic approach", "Established expert methodology", "Incorrect thought leadership approach"],
    ["Next-generation transformative methodology", "Advanced strategic innovation", "Current expert standard practice", "Wrong visionary approach"],
    ["Industry-defining best practice", "Strategic innovation method", "Traditional expert approach", "Incorrect leadership methodology"],
    ["Paradigm-shifting solution", "Transformative strategic approach", "Advanced expert methodology", "Wrong industry transformation method"]
  ]
};

async function generateQuestionsForAllCourses() {
  try {
    console.log('Generating comprehensive questions for all courses...');
    
    // Get all courses with their levels
    const coursesResult = await pool.query('SELECT id, title, level FROM courses ORDER BY id');
    const courses = coursesResult.rows;
    
    console.log(`Found ${courses.length} courses to generate questions for`);
    
    for (const course of courses) {
      const courseLevel = course.level || 'novice';
      const templates = questionTemplatesByLevel[courseLevel];
      const answerOptions = answerOptionsByLevel[courseLevel];
      
      // Extract main concept from course title
      const titleWords = course.title.toLowerCase().split(' ');
      const mainConcept = titleWords[0] || 'technology';
      
      console.log(`Generating 120 questions for: ${course.title} (${courseLevel} level)`);
      
      // Generate 120 unique questions per course
      for (let i = 0; i < 120; i++) {
        const templateIndex = i % templates.length;
        const optionIndex = i % answerOptions.length;
        
        const template = templates[templateIndex];
        const options = answerOptions[optionIndex];
        
        const question = template.replace(/{concept}/g, mainConcept);
        
        await pool.query(
          'INSERT INTO questions (course_id, question, options, correct_answer, is_active) VALUES ($1, $2, $3, $4, $5)',
          [
            course.id,
            `${question} (${courseLevel.toUpperCase()} Level - Q${i + 1})`,
            JSON.stringify(options),
            0, // First option is always correct
            true
          ]
        );
      }
    }
    
    console.log('Question generation completed successfully!');
    console.log(`Total questions generated: ${courses.length * 120}`);
    
  } catch (error) {
    console.error('Error generating questions:', error);
  } finally {
    await pool.end();
  }
}

generateQuestionsForAllCourses();