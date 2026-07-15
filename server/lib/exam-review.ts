import type { ExamQuestionSnapshot } from "../utils/examState";

export type ExamReviewItem = {
  questionId: number;
  question: string;
  options: string[];
  selectedAnswer: number | null;
  correctAnswer: number;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
};

export function buildExamReview(
  snapshot: ExamQuestionSnapshot[],
  answers: Record<string, number>,
): ExamReviewItem[] {
  return snapshot.flatMap((item) => {
    if (
      !Number.isInteger(item.id)
      || typeof item.question !== "string"
      || !Array.isArray(item.options)
      || !Number.isInteger(item.correctAnswer)
      || item.correctAnswer < 0
      || item.correctAnswer >= item.options.length
    ) return [];

    const submitted = answers[String(item.id)];
    const selectedAnswer = Number.isInteger(submitted)
      && submitted >= 0
      && submitted < item.options.length
      ? submitted
      : null;

    return [{
      questionId: item.id,
      question: item.question,
      options: item.options,
      selectedAnswer,
      correctAnswer: item.correctAnswer,
      selectedOption: selectedAnswer == null ? null : item.options[selectedAnswer],
      correctOption: item.options[item.correctAnswer],
      isCorrect: selectedAnswer === item.correctAnswer,
    }];
  });
}
