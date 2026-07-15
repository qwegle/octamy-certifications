import { describe, expect, it } from "@jest/globals";
import { buildExamReview } from "../../server/lib/exam-review";

describe("exam answer review", () => {
  it("returns the selected and correct option without trusting client answer text", () => {
    const review = buildExamReview([
      { id: 10, question: "2 + 2?", options: ["3", "4", "5"], correctAnswer: 1 },
      { id: 11, question: "3 + 3?", options: ["5", "6", "7"], correctAnswer: 1 },
      { id: 12, question: "4 + 4?", options: ["7", "8", "9"], correctAnswer: 1 },
    ], { "10": 1, "11": 0 });

    expect(review).toEqual([
      expect.objectContaining({ questionId: 10, selectedOption: "4", correctOption: "4", isCorrect: true }),
      expect.objectContaining({ questionId: 11, selectedOption: "5", correctOption: "6", isCorrect: false }),
      expect.objectContaining({ questionId: 12, selectedOption: null, correctOption: "8", isCorrect: false }),
    ]);
  });

  it("drops malformed snapshots instead of exposing inconsistent review data", () => {
    expect(buildExamReview([
      { id: 1, question: "Broken", options: ["A"], correctAnswer: 5 },
    ], {})).toEqual([]);
  });
});
