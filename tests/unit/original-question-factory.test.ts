import { describe, expect, it, jest } from "@jest/globals";
import {
  ORIGINAL_QUESTION_PACK_SOURCE_KEY,
  ORIGINAL_QUESTION_TEMPLATES,
  generateOriginalQuestion,
  verifyOriginalQuestionRecord,
} from "../../server/content/original-question-factory";

describe("Octamy original question factory", () => {
  jest.setTimeout(20_000);

  it("builds 100,000 unique, independently verified question records", () => {
    const prompts = new Set<string>();
    const sourceIds = new Set<string>();
    const answerPositions = [0, 0, 0, 0];

    for (let index = 0; index < 100_000; index += 1) {
      const record = generateOriginalQuestion(index);
      if (!verifyOriginalQuestionRecord(record)
        || !record.sourceRecordId.startsWith(`${ORIGINAL_QUESTION_PACK_SOURCE_KEY}:`)
        || record.options.length !== 4
        || new Set(record.options).size !== 4
        || record.explanation.length < 10
        || record.provenance.answerEvidence.length <= 20) {
        throw new Error(`Invalid generated record at index ${index}`);
      }
      prompts.add(record.question);
      sourceIds.add(record.sourceRecordId);
      answerPositions[record.answer.correctOption] += 1;
    }

    expect(prompts.size).toBe(100_000);
    expect(sourceIds.size).toBe(100_000);
    expect(Math.max(...answerPositions) - Math.min(...answerPositions)).toBeLessThan(100);
  });

  it("uses stable SEO-safe assessment and topic slugs", () => {
    expect(ORIGINAL_QUESTION_TEMPLATES.length).toBeGreaterThanOrEqual(40);
    for (let index = 0; index < ORIGINAL_QUESTION_TEMPLATES.length; index += 1) {
      const record = generateOriginalQuestion(index);
      expect(record.metadata.topicSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(record.metadata.assessmentSlugs.length).toBeGreaterThan(0);
      for (const slug of record.metadata.assessmentSlugs) {
        expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      }
    }
  });

  it("rejects a tampered answer key", () => {
    const record = generateOriginalQuestion(0);
    const tampered = {
      ...record,
      answer: {
        ...record.answer,
        correctOption: (record.answer.correctOption + 1) % 4,
      },
    };
    expect(verifyOriginalQuestionRecord(tampered)).toBe(false);
  });
});
