import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


interface AnswerScoreResult {
  score: number;
  feedback: string;
  perAnswerScores: { question: string; score: number; feedback: string }[];
}

export async function evaluateAnswersWithAI(
  answers: Record<string, string>
): Promise<AnswerScoreResult> {
  const questionList = Object.entries(answers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join("\n\n");

  const prompt = `
You're an AI technical interviewer. Given the following interview Q&A, score each answer from 0 to 10 based on accuracy, depth, clarity, and relevance. At the end, give a total percentage score out of 100 and brief feedback.

${questionList}

Respond in this format:

{
  "overallScore": 84,
  "feedback": "Good answers overall. Could improve depth on some technical questions.",
  "perAnswerScores": [
    { "question": "What is closure in JS?", "score": 9, "feedback": "Clear and correct." },
    { "question": "Explain event loop.", "score": 7, "feedback": "Good explanation, missing examples." }
  ]
}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: "You are an expert coding interview evaluator.",
      },
      { role: "user", content: prompt },
    ],
  });

  // Extract JSON from response
  const raw = response.choices[0].message.content || "";
  const jsonStart = raw.indexOf("{");
  const json = raw.slice(jsonStart);

  try {
    const result = JSON.parse(json);
    return {
      score: result.overallScore,
      feedback: result.feedback,
      perAnswerScores: result.perAnswerScores,
    };
  } catch (e) {
    console.error("AI scoring response parsing failed:", e);
    return {
      score: 0,
      feedback: "AI evaluation failed. Using fallback scoring.",
      perAnswerScores: [],
    };
  }
}
