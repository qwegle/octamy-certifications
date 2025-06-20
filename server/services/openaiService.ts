import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
}) : null;

export interface AiEvaluationResult {
  score: number;
  maxScore: number;
  analysis: string;
  keywordsFound: string[];
  improvementAreas: string[];
  strengths: string[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export class OpenAIService {
  
  /**
   * Conduct AI interactive interview session
   */
  async conductInteractiveInterview(
    scenario: string,
    userResponse: string,
    conversationHistory: ConversationTurn[] = [],
    evaluationCriteria: string[]
  ): Promise<{
    aiResponse: string;
    shouldContinue: boolean;
    currentEvaluation?: AiEvaluationResult;
  }> {
    if (!openai) {
      throw new Error("OpenAI API key not configured. Please provide OPENAI_API_KEY to enable AI interactive features.");
    }
    const systemPrompt = `You are an expert technical interviewer conducting an AI-powered assessment. 

SCENARIO: ${scenario}

EVALUATION CRITERIA:
${evaluationCriteria.map((criteria, index) => `${index + 1}. ${criteria}`).join('\n')}

INSTRUCTIONS:
- Engage in a natural, professional conversation
- Ask follow-up questions to assess technical depth
- Probe for understanding of concepts, not just memorization
- Ask 3-5 questions total before concluding
- Keep responses concise and focused
- When ready to conclude, start your response with "EVALUATION_COMPLETE:"

CONVERSATION RULES:
- Be encouraging but thorough
- Ask one question at a time
- Build on previous answers
- Test both theoretical knowledge and practical application`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...conversationHistory.map(turn => ({
        role: turn.role as const,
        content: turn.content
      })),
      { role: "user" as const, content: userResponse }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = response.choices[0].message.content || "";
    const shouldContinue = !aiResponse.startsWith("EVALUATION_COMPLETE:");

    return {
      aiResponse: aiResponse.replace("EVALUATION_COMPLETE:", "").trim(),
      shouldContinue,
      currentEvaluation: shouldContinue ? undefined : await this.evaluateConversation(
        scenario,
        [...conversationHistory, { role: 'user', content: userResponse, timestamp: new Date() }],
        evaluationCriteria
      )
    };
  }

  /**
   * Evaluate complete conversation and provide final score
   */
  async evaluateConversation(
    scenario: string,
    conversationHistory: ConversationTurn[],
    evaluationCriteria: string[]
  ): Promise<AiEvaluationResult> {
    if (!openai) {
      throw new Error("OpenAI API key not configured");
    }
    const evaluationPrompt = `Evaluate this technical interview conversation:

SCENARIO: ${scenario}

CONVERSATION:
${conversationHistory.map(turn => `${turn.role.toUpperCase()}: ${turn.content}`).join('\n\n')}

EVALUATION CRITERIA:
${evaluationCriteria.map((criteria, index) => `${index + 1}. ${criteria}`).join('\n')}

Provide evaluation in JSON format:
{
  "score": number (0-100),
  "maxScore": 100,
  "analysis": "detailed analysis of performance",
  "keywordsFound": ["relevant", "keywords", "mentioned"],
  "improvementAreas": ["areas", "to", "improve"],
  "strengths": ["demonstrated", "strengths"]
}

SCORING GUIDELINES:
- 90-100: Exceptional understanding, clear explanations, handles edge cases
- 80-89: Strong grasp, good explanations, minor gaps
- 70-79: Adequate knowledge, some confusion or missing details
- 60-69: Basic understanding, significant gaps
- 50-59: Limited knowledge, major misconceptions
- Below 50: Inadequate understanding`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert technical interviewer. Provide fair, detailed evaluations." },
        { role: "user", content: evaluationPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const evaluation = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      score: Math.max(0, Math.min(100, evaluation.score || 0)),
      maxScore: 100,
      analysis: evaluation.analysis || "No analysis provided",
      keywordsFound: evaluation.keywordsFound || [],
      improvementAreas: evaluation.improvementAreas || [],
      strengths: evaluation.strengths || []
    };
  }

  /**
   * Generate AI interactive questions for courses
   */
  async generateInteractiveQuestions(courseTitle: string, category: string, difficulty: string): Promise<{
    question: string;
    scenario: string;
    evaluationCriteria: string[];
    expectedKeywords: string[];
  }[]> {
    if (!openai) {
      throw new Error("OpenAI API key not configured");
    }
    const prompt = `Generate 3 AI interactive interview questions for a ${difficulty} level ${courseTitle} course in ${category}.

Each question should:
- Test practical problem-solving skills
- Require explanation of thought process
- Allow for follow-up questions
- Be scenario-based, not just theoretical

Format as JSON array:
[
  {
    "question": "Initial question to pose",
    "scenario": "Detailed scenario description",
    "evaluationCriteria": ["criteria 1", "criteria 2", "criteria 3"],
    "expectedKeywords": ["keyword1", "keyword2", "keyword3"]
  }
]

Focus on real-world applications and problem-solving.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert technical curriculum designer." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{"questions": []}');
    return result.questions || result || [];
  }

  /**
   * Analyze candidate profile for recruiter insights
   */
  async analyzeCandidateProfile(
    examResults: any[],
    userProfile: any,
    courseTitles: string[]
  ): Promise<{
    overallRating: number;
    technicalStrengths: string[];
    recommendedRoles: string[];
    skillGaps: string[];
    summary: string;
  }> {
    if (!openai) {
      // Return a fallback analysis when OpenAI is not available
      return {
        overallRating: Math.min(10, Math.max(1, Math.round((examResults.reduce((sum, result) => sum + (result.score || 0), 0) / examResults.length) / 10))),
        technicalStrengths: userProfile.skills || [],
        recommendedRoles: [userProfile.preferredJobTitle || "Software Developer"],
        skillGaps: ["OpenAI analysis not available"],
        summary: `Candidate with ${userProfile.experienceLevel || 'unknown'} experience level. Completed ${examResults.length} assessment(s).`
      };
    }
    const analysisPrompt = `Analyze this candidate's technical profile:

CANDIDATE PROFILE:
Name: ${userProfile.name}
Experience Level: ${userProfile.experienceLevel || 'Not specified'}
Skills: ${(userProfile.skills || []).join(', ') || 'Not specified'}
Preferred Job Title: ${userProfile.preferredJobTitle || 'Not specified'}

EXAM RESULTS:
${examResults.map(result => 
  `Course: ${result.courseTitle}
  Score: ${result.score}%
  AI Analysis: ${result.aiAnalysis || 'N/A'}
  Passed: ${result.passed ? 'Yes' : 'No'}`
).join('\n\n')}

COURSES COMPLETED: ${courseTitles.join(', ')}

Provide analysis in JSON format:
{
  "overallRating": number (1-10),
  "technicalStrengths": ["strength1", "strength2"],
  "recommendedRoles": ["role1", "role2"],
  "skillGaps": ["gap1", "gap2"],
  "summary": "brief professional summary"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert technical recruiter and talent assessor." },
        { role: "user", content: analysisPrompt }
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
}

export const openaiService = new OpenAIService();