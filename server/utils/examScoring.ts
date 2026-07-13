import type { CorrectMap } from './examState';

export function normalizeExamAnswers(input: unknown): Record<string, number> {
  const normalized: Record<string, number> = {};

  if (Array.isArray(input)) {
    for (const answer of input) {
      const questionId = Number(answer?.questionId);
      const selectedOption = Number(answer?.selectedOption);
      if (Number.isInteger(questionId) && questionId > 0 &&
          Number.isInteger(selectedOption) && selectedOption >= 0) {
        normalized[String(questionId)] = selectedOption;
      }
    }
    return normalized;
  }

  if (input && typeof input === 'object') {
    for (const [rawQuestionId, rawOption] of Object.entries(input)) {
      const questionId = Number(rawQuestionId);
      const selectedOption = Number(rawOption);
      if (Number.isInteger(questionId) && questionId > 0 &&
          Number.isInteger(selectedOption) && selectedOption >= 0) {
        normalized[String(questionId)] = selectedOption;
      }
    }
  }

  return normalized;
}

export function scoreExam(correctMap: CorrectMap, answers: Record<string, number>) {
  const totalQuestions = Object.keys(correctMap).length;
  let correctAnswers = 0;

  for (const [questionId, selectedOption] of Object.entries(answers)) {
    if (Object.prototype.hasOwnProperty.call(correctMap, questionId) &&
        correctMap[questionId] === selectedOption) {
      correctAnswers += 1;
    }
  }

  return {
    totalQuestions,
    correctAnswers,
    score: totalQuestions === 0 ? 0 : Math.round((correctAnswers / totalQuestions) * 100),
  };
}
