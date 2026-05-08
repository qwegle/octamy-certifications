// AI evaluation feature has been removed.
// Stub kept only to satisfy server/routes.ts import; the call path is unreachable
// from the UI now that AI Interview pages are deleted.

interface AnswerScoreResult {
  score: number;
  feedback: string;
  perAnswerScores: { question: string; score: number; feedback: string }[];
}

export async function evaluateAnswersWithAI(
  _answers: Record<string, string>
): Promise<AnswerScoreResult> {
  return {
    score: 0,
    feedback: "AI evaluation has been disabled.",
    perAnswerScores: [],
  };
}
