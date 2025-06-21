import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { interviews, interviewQuestions, interviewResponses, users } from '../../shared/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get available technologies for interviews
router.get('/interview-technologies', requireAuth, async (req, res) => {
  try {
    const technologies = await db
      .selectDistinct({ technology: interviewQuestions.technology })
      .from(interviewQuestions)
      .where(eq(interviewQuestions.isActive, true));
    
    res.json(technologies.map(t => t.technology));
  } catch (error) {
    console.error('Error fetching technologies:', error);
    res.status(500).json({ error: 'Failed to fetch technologies' });
  }
});

// Get user's interviews
router.get('/user/interviews', requireAuth, async (req, res) => {
  try {
    const userInterviews = await db
      .select()
      .from(interviews)
      .where(eq(interviews.userId, req.user!.id))
      .orderBy(desc(interviews.createdAt));
    
    res.json(userInterviews);
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

// Create new interview
router.post('/interviews/create', requireAuth, async (req, res) => {
  try {
    const { technology } = req.body;
    
    if (!technology) {
      return res.status(400).json({ error: 'Technology is required' });
    }

    // Get questions for the technology
    const questions = await db
      .select()
      .from(interviewQuestions)
      .where(and(
        eq(interviewQuestions.technology, technology),
        eq(interviewQuestions.isActive, true)
      ));

    if (questions.length === 0) {
      return res.status(404).json({ error: 'No questions available for this technology' });
    }

    // Create interview
    const [interview] = await db
      .insert(interviews)
      .values({
        userId: req.user!.id,
        title: `${technology} Technical Interview`,
        technology,
        totalQuestions: questions.length,
        status: 'pending',
        paymentStatus: 'pending',
        paymentAmount: '99.00',
      })
      .returning();

    res.json(interview);
  } catch (error) {
    console.error('Error creating interview:', error);
    res.status(500).json({ error: 'Failed to create interview' });
  }
});

// Get interview details
router.get('/interviews/:id', requireAuth, async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id);
    
    const [interview] = await db
      .select()
      .from(interviews)
      .where(and(
        eq(interviews.id, interviewId),
        eq(interviews.userId, req.user!.id)
      ));

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Get questions for this technology
    const questions = await db
      .select()
      .from(interviewQuestions)
      .where(and(
        eq(interviewQuestions.technology, interview.technology),
        eq(interviewQuestions.isActive, true)
      ));

    res.json({ interview, questions });
  } catch (error) {
    console.error('Error fetching interview:', error);
    res.status(500).json({ error: 'Failed to fetch interview' });
  }
});

// Start interview (mark as in_progress)
router.post('/interviews/:id/start', requireAuth, async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id);
    
    const [interview] = await db
      .update(interviews)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
      })
      .where(and(
        eq(interviews.id, interviewId),
        eq(interviews.userId, req.user!.id),
        eq(interviews.paymentStatus, 'paid')
      ))
      .returning();

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found or not paid' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// Submit interview response
router.post('/interviews/:id/responses', requireAuth, async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id);
    const { questionId, videoSegmentUrl, audioTranscription, eyeTrackingData, timeSpent } = req.body;
    
    // Verify interview belongs to user
    const [interview] = await db
      .select()
      .from(interviews)
      .where(and(
        eq(interviews.id, interviewId),
        eq(interviews.userId, req.user!.id)
      ));

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Save response
    const [response] = await db
      .insert(interviewResponses)
      .values({
        interviewId,
        questionId,
        videoSegmentUrl,
        audioTranscription,
        eyeTrackingData,
        timeSpent,
      })
      .returning();

    // Update completed questions count
    await db
      .update(interviews)
      .set({
        completedQuestions: interview.completedQuestions + 1,
      })
      .where(eq(interviews.id, interviewId));

    res.json(response);
  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Complete interview and get AI analysis
router.post('/interviews/:id/complete', requireAuth, async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id);
    const { videoUrl } = req.body;
    
    // Verify interview belongs to user
    const [interview] = await db
      .select()
      .from(interviews)
      .where(and(
        eq(interviews.id, interviewId),
        eq(interviews.userId, req.user!.id)
      ));

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // Get all responses for AI analysis
    const responses = await db
      .select()
      .from(interviewResponses)
      .where(eq(interviewResponses.interviewId, interviewId));

    // TODO: Implement AI analysis using OpenAI
    // For now, generate mock analysis
    const mockScore = Math.floor(Math.random() * 40) + 60; // 60-100
    const mockGrade = mockScore >= 90 ? 'A+' : mockScore >= 80 ? 'A' : mockScore >= 70 ? 'B+' : mockScore >= 60 ? 'B' : 'C';
    
    const mockSwotAnalysis = {
      strengths: ['Good technical knowledge', 'Clear communication'],
      weaknesses: ['Could improve problem-solving approach', 'Need more practice with algorithms'],
      opportunities: ['Focus on system design', 'Practice more coding challenges'],
      threats: ['Time management during interviews', 'Nervousness affecting performance'],
    };

    const mockAiSummary = `The candidate demonstrated solid technical knowledge in ${interview.technology} with good communication skills. Areas for improvement include problem-solving methodology and time management. Overall performance shows potential for growth with focused practice.`;

    // Update interview with results
    const [updatedInterview] = await db
      .update(interviews)
      .set({
        status: 'completed',
        completedAt: new Date(),
        videoUrl,
        score: mockScore,
        grade: mockGrade,
        swotAnalysis: mockSwotAnalysis,
        aiSummary: mockAiSummary,
      })
      .where(eq(interviews.id, interviewId))
      .returning();

    res.json(updatedInterview);
  } catch (error) {
    console.error('Error completing interview:', error);
    res.status(500).json({ error: 'Failed to complete interview' });
  }
});

// Process payment for interview
router.post('/interviews/:id/payment', requireAuth, async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id);
    const { amount, paymentMethod } = req.body;
    
    // Verify interview belongs to user
    const [interview] = await db
      .select()
      .from(interviews)
      .where(and(
        eq(interviews.id, interviewId),
        eq(interviews.userId, req.user!.id)
      ));

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    // For now, simulate successful payment
    // In production, integrate with actual PayUMoney API
    const mockTransactionId = `TXN_${Date.now()}`;
    
    const [updatedInterview] = await db
      .update(interviews)
      .set({
        paymentStatus: 'paid',
        transactionId: mockTransactionId,
      })
      .where(eq(interviews.id, interviewId))
      .returning();

    res.json({ 
      success: true, 
      interview: updatedInterview,
      transactionId: mockTransactionId 
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Get interview results
router.get('/interviews/:id/results', requireAuth, async (req, res) => {
  try {
    const interviewId = parseInt(req.params.id);
    
    const [interview] = await db
      .select()
      .from(interviews)
      .where(and(
        eq(interviews.id, interviewId),
        eq(interviews.userId, req.user!.id)
      ));

    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (interview.status !== 'completed') {
      return res.status(400).json({ error: 'Interview not completed yet' });
    }

    // Get responses for detailed analysis
    const responses = await db
      .select()
      .from(interviewResponses)
      .where(eq(interviewResponses.interviewId, interviewId));

    res.json({ interview, responses });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

export default router;