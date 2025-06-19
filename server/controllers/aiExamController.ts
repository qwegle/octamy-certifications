import { Request, Response } from "express";
import { db } from "../db";
import { examAttempts, questions, courses, aiConversations, users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { openaiService, ConversationTurn } from "../services/openaiService";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export class AiExamController {

  // Start AI Interactive Exam
  async startAiExam(req: AuthenticatedRequest, res: Response) {
    try {
      const { courseId } = req.params;
      const userId = req.user?.userId;
      const { userEmail, userName } = req.body;

      // Get course details
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, Number(courseId)))
        .limit(1);

      if (!course || course.courseType !== 'ai_interactive') {
        return res.status(404).json({ error: "AI Interactive course not found" });
      }

      // Get AI interactive questions
      const aiQuestions = await db
        .select()
        .from(questions)
        .where(and(
          eq(questions.courseId, Number(courseId)),
          eq(questions.questionType, 'ai_interactive')
        ));

      if (aiQuestions.length === 0) {
        return res.status(400).json({ error: "No AI questions available for this course" });
      }

      // Create exam attempt
      const [examAttempt] = await db
        .insert(examAttempts)
        .values({
          userId,
          courseId: Number(courseId),
          userEmail: userEmail || req.user?.email || '',
          userName: userName || '',
          score: 0,
          totalQuestions: aiQuestions.length,
          answers: {},
          timeTaken: 0,
          passed: false,
          aiConversationLog: [],
          aiTotalScore: 0,
          recruitmentReady: false,
        })
        .returning();

      res.json({
        examAttemptId: examAttempt.id,
        courseTitle: course.title,
        totalQuestions: aiQuestions.length,
        questions: aiQuestions.map(q => ({
          id: q.id,
          question: q.question,
          scenario: q.aiScenario || 'Technical interview scenario',
          maxPoints: q.maxPoints || 100,
          difficulty: q.difficulty || 'medium',
        })),
        instructions: course.aiInstructions,
      });
    } catch (error) {
      console.error("Start AI exam error:", error);
      res.status(500).json({ error: "Failed to start AI exam" });
    }
  }

  // Handle AI Conversation
  async processAiConversation(req: AuthenticatedRequest, res: Response) {
    try {
      const { examAttemptId, questionId, userMessage, conversationHistory = [] } = req.body;

      // Get question details
      const [question] = await db
        .select()
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1);

      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }

      // Get exam attempt
      const [examAttempt] = await db
        .select()
        .from(examAttempts)
        .where(eq(examAttempts.id, examAttemptId))
        .limit(1);

      if (!examAttempt) {
        return res.status(404).json({ error: "Exam attempt not found" });
      }

      // Process AI conversation
      const result = await openaiService.conductInteractiveInterview(
        question.aiScenario || '',
        userMessage,
        conversationHistory,
        question.aiEvaluationCriteria || []
      );

      // Update conversation history
      const updatedHistory = [
        ...conversationHistory,
        { role: 'user', content: userMessage, timestamp: new Date() },
        { role: 'assistant', content: result.aiResponse, timestamp: new Date() }
      ];

      // If conversation is complete, save the evaluation
      if (!result.shouldContinue && result.currentEvaluation) {
        await db
          .insert(aiConversations)
          .values({
            examAttemptId,
            questionId,
            conversationHistory: updatedHistory,
            userResponse: userMessage,
            aiEvaluation: result.currentEvaluation.analysis,
            scoreAwarded: result.currentEvaluation.score,
            maxScore: result.currentEvaluation.maxScore,
            evaluationCriteria: question.aiEvaluationCriteria || [],
            keywordsFound: result.currentEvaluation.keywordsFound,
          });
      }

      res.json({
        aiResponse: result.aiResponse,
        shouldContinue: result.shouldContinue,
        conversationHistory: updatedHistory,
        evaluation: result.currentEvaluation,
      });
    } catch (error) {
      console.error("AI conversation error:", error);
      res.status(500).json({ error: "Failed to process AI conversation" });
    }
  }

  // Submit AI Exam
  async submitAiExam(req: AuthenticatedRequest, res: Response) {
    try {
      const { examAttemptId, timeTaken } = req.body;

      // Get exam attempt
      const [examAttempt] = await db
        .select()
        .from(examAttempts)
        .where(eq(examAttempts.id, examAttemptId))
        .limit(1);

      if (!examAttempt) {
        return res.status(404).json({ error: "Exam attempt not found" });
      }

      // Get all AI conversations for this exam
      const conversations = await db
        .select()
        .from(aiConversations)
        .where(eq(aiConversations.examAttemptId, examAttemptId));

      // Calculate total score
      const totalScore = conversations.reduce((sum, conv) => sum + conv.scoreAwarded, 0);
      const maxPossibleScore = conversations.reduce((sum, conv) => sum + conv.maxScore, 0);
      const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

      // Get course passing score
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, examAttempt.courseId))
        .limit(1);

      const passed = percentage >= (course?.passingScore || 60);

      // Generate comprehensive AI analysis
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, examAttempt.userId || 0))
        .limit(1);

      const aiAnalysis = await openaiService.analyzeCandidateProfile(
        [{ 
          courseTitle: course?.title,
          score: percentage,
          aiAnalysis: conversations.map(c => c.aiEvaluation).join(' '),
          passed 
        }],
        user || { name: examAttempt.userName },
        [course?.title || '']
      );

      // Update exam attempt
      const [updatedExam] = await db
        .update(examAttempts)
        .set({
          score: percentage,
          aiTotalScore: totalScore,
          timeTaken,
          passed,
          aiAnalysis: aiAnalysis.summary,
          recruitmentReady: passed && course?.isPreferred,
          aiConversationLog: conversations.map(c => ({
            questionId: c.questionId,
            score: c.scoreAwarded,
            maxScore: c.maxScore,
            evaluation: c.aiEvaluation,
            keywordsFound: c.keywordsFound,
          })),
        })
        .where(eq(examAttempts.id, examAttemptId))
        .returning();

      res.json({
        examResult: updatedExam,
        totalScore,
        maxScore: maxPossibleScore,
        percentage,
        passed,
        aiAnalysis,
        conversations: conversations.map(c => ({
          questionId: c.questionId,
          scoreAwarded: c.scoreAwarded,
          maxScore: c.maxScore,
          evaluation: c.aiEvaluation,
          keywordsFound: c.keywordsFound,
        })),
      });
    } catch (error) {
      console.error("Submit AI exam error:", error);
      res.status(500).json({ error: "Failed to submit AI exam" });
    }
  }

  // Get AI Exam Results
  async getAiExamResults(req: AuthenticatedRequest, res: Response) {
    try {
      const { examAttemptId } = req.params;

      // Get exam attempt with course details
      const [examResult] = await db
        .select({
          examAttempt: examAttempts,
          courseTitle: courses.title,
          courseType: courses.courseType,
          isPreferred: courses.isPreferred,
        })
        .from(examAttempts)
        .leftJoin(courses, eq(examAttempts.courseId, courses.id))
        .where(eq(examAttempts.id, Number(examAttemptId)))
        .limit(1);

      if (!examResult) {
        return res.status(404).json({ error: "Exam results not found" });
      }

      // Get conversation details
      const conversations = await db
        .select({
          questionId: aiConversations.questionId,
          question: questions.question,
          scenario: questions.aiScenario,
          scoreAwarded: aiConversations.scoreAwarded,
          maxScore: aiConversations.maxScore,
          evaluation: aiConversations.aiEvaluation,
          keywordsFound: aiConversations.keywordsFound,
          conversationHistory: aiConversations.conversationHistory,
        })
        .from(aiConversations)
        .leftJoin(questions, eq(aiConversations.questionId, questions.id))
        .where(eq(aiConversations.examAttemptId, Number(examAttemptId)));

      res.json({
        examResult,
        conversations,
        isRecruitmentReady: examResult.examAttempt.recruitmentReady,
      });
    } catch (error) {
      console.error("Get AI exam results error:", error);
      res.status(500).json({ error: "Failed to fetch AI exam results" });
    }
  }
}

export const aiExamController = new AiExamController();