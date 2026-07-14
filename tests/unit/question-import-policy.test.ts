import { describe, expect, it } from "@jest/globals";
import {
  MAX_IMPORT_ROWS,
  normalizeRow,
} from "../../server/routes/question-banks";

const validRow = {
  topic: "Fractions",
  question: "Which fraction is equivalent to one half?",
  format: "mcq_single",
  optionA: "2/4",
  optionB: "3/4",
  correctAnswer: "A",
  marks: "2",
  negativeMarks: "1",
  difficulty: "easy",
  tags: "math, fractions",
  explanation: "Two fourths simplifies to one half.",
  generationSource: "ai_draft",
};

describe("question import boundaries", () => {
  it("keeps a bounded batch size", () => {
    expect(MAX_IMPORT_ROWS).toBe(5_000);
  });

  it("normalizes a valid AI draft as inactive and pending review", () => {
    const result = normalizeRow(validRow);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      generationSource: "ai_draft",
      reviewStatus: "pending",
      isActive: false,
      maxPoints: 2,
      negativeMarks: 1,
    });
  });

  it.each([
    [{ ...validRow, question: "q".repeat(10_001) }, "String must contain at most 10000"],
    [{ ...validRow, optionA: "a".repeat(2_001) }, "String must contain at most 2000"],
    [{ ...validRow, topic: "t".repeat(121) }, "Topic must be 120"],
    [{ ...validRow, marks: 1, negativeMarks: 2 }, "Negative marks cannot exceed"],
    [{ ...validRow, tags: Array.from({ length: 51 }, (_, index) => `tag${index}`).join(",") }, "Array must contain at most 50"],
  ])("rejects oversized or invalid fields", (row, expectedMessage) => {
    const result = normalizeRow(row);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(expectedMessage);
  });
});
