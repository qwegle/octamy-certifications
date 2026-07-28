import { describe, expect, it } from "@jest/globals";
import {
  GRADE_3_MATHEMATICS_V1,
  auditGrade3MathematicsV1,
} from "../../scripts/generate-grade-3-mathematics-practice-v1";
import { normalizeQuestionPackItem } from "../../scripts/lib/question-pack-contract";

const blueprintDraws: Record<string, number> = {
  division: 4,
  "elapsed-time": 3,
  "fractions-of-quantities": 3,
  "missing-number-equations": 3,
  multiplication: 3,
  perimeter: 3,
  "whole-number-addition": 3,
  "whole-number-subtraction": 3,
};

function independentlyRecalculate(item: (typeof GRADE_3_MATHEMATICS_V1)[number]): number {
  const topic = String(item.metadata.topicSlug);
  if (topic === "elapsed-time") {
    const times = Array.from(item.question.matchAll(/(\d{1,2}):(\d{2}) (a\.m|p\.m)/g));
    expect(times).toHaveLength(2);
    const minutes = times.map((match) => {
      const hour = (Number(match[1]) % 12) + (match[3] === "p.m" ? 12 : 0);
      return hour * 60 + Number(match[2]);
    });
    return minutes[1] - minutes[0];
  }
  const expression = item.explanation.match(/(\d+(?:\s*\+\s*\d+)+|\d+\s*[−×÷]\s*\d+)\s*=\s*(\d+)/);
  expect(expression).not.toBeNull();
  const operands = expression![1].match(/\d+/g)!.map(Number);
  if (expression![1].includes("+")) return operands.reduce((sum, value) => sum + value, 0);
  if (expression![1].includes("−")) return operands[0] - operands[1];
  if (expression![1].includes("×")) return operands[0] * operands[1];
  return operands[0] / operands[1];
}

describe("Grade 3 mathematics practice bank v1", () => {
  it("contains 200 contract-valid, unique, assessment-specific records", () => {
    const audit = auditGrade3MathematicsV1();
    expect(audit).toMatchObject({
      errors: [],
      rows: 200,
      uniquePrompts: 200,
      uniqueContent: 200,
    });

    const normalizedStems = new Set(GRADE_3_MATHEMATICS_V1.map((item) => (
      item.question.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ")
    )));
    expect(normalizedStems.size).toBe(200);

    for (const item of GRADE_3_MATHEMATICS_V1) {
      const normalized = normalizeQuestionPackItem(item);
      expect(normalized.ok).toBe(true);
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options).size).toBe(4);
      expect(item.options[item.answer.correctOption]).toMatch(/^\d+$/);
      expect(item.explanation.length).toBeGreaterThanOrEqual(10);
      expect(item.metadata.assessmentSlugs).toEqual(["grade-3-mathematics-practice"]);
      expect(item.exam).toBe("Grade 3 Arithmetic, Time and Perimeter Practice");
      expect(item.metadata.releaseEvidence).toMatchObject({
        syllabusVersion: "Grade 3 Arithmetic, Time and Perimeter Practice Blueprint v1",
        answerValidation: { status: "verified", method: "independent_calculation" },
        distractorReview: { status: "verified" },
      });
      expect(item.metadata.releaseEvidence.objectiveCode).toMatch(/^G3-ATP-/);
      expect(independentlyRecalculate(item)).toBe(Number(item.options[item.answer.correctOption]));
    }
  });

  it("keeps the narrowed age envelope and removes unsupported thirds and factors above ten", () => {
    const multiplication = GRADE_3_MATHEMATICS_V1.filter((item) => item.metadata.topicSlug === "multiplication");
    const division = GRADE_3_MATHEMATICS_V1.filter((item) => item.metadata.topicSlug === "division");
    const fractions = GRADE_3_MATHEMATICS_V1.filter((item) => item.metadata.topicSlug === "fractions-of-quantities");
    expect(multiplication.every((item) => {
      const factors = item.explanation.match(/(\d+) × (\d+)/)!.slice(1).map(Number);
      return factors.every((factor) => factor <= 10);
    })).toBe(true);
    expect(division.every((item) => Number(item.explanation.match(/^(\d+) shared/)![1]) <= 100)).toBe(true);
    expect(fractions.every((item) => /One of [24] equal shares/.test(item.explanation))).toBe(true);
    expect(GRADE_3_MATHEMATICS_V1.some((item) => /1\/3|one-third|3 equal shares/i.test(`${item.question} ${item.explanation}`))).toBe(false);
  });

  it("keeps every fraction stem, denominator, calculation, and key consistent", () => {
    const fractions = GRADE_3_MATHEMATICS_V1.filter((item) => item.metadata.topicSlug === "fractions-of-quantities");
    for (const item of fractions) {
      const statedDenominator = /one-half/i.test(item.question) ? 2
        : /one-fourth/i.test(item.question) ? 4
          : Number(item.question.match(/1\/([24])|(?:into|among|of|in|make) ([24])\b/i)?.slice(1).find(Boolean));
      const calculation = item.explanation.match(/(\d+) ÷ ([24]) = (\d+)/);
      expect(statedDenominator).toBe(Number(calculation?.[2]));
      expect(Number(calculation?.[1]) / statedDenominator).toBe(Number(calculation?.[3]));
      expect(Number(item.options[item.answer.correctOption])).toBe(Number(calculation?.[3]));
    }
  });

  it("keeps generated articles and singular/plural prompt forms grammatical", () => {
    const malformedForms = [
      /\bA [^.?!]+s contains the statement\b/i,
      /\bIf \d+ leave the group\b/i,
      /\b(?:A fair coupons|An museum|An story|An bus|An football|An library)\b/i,
      /\bin each [^.?!]+ in each group\b/i,
      /\bChildren made \d+ (?:notebooks|plants)\b/i,
      /\bRiya sees \d+ visitors\b/i,
      /\bFrom \d+ [^.?!]+ before [^.?!]+, \d+ were taken away\b/i,
      /\b(?:saplings|pebbles|shells) on \d+ equal plates\b/i,
      /\bmissing-number equation [^.?!]+ used in the\b/i,
    ];
    for (const item of GRADE_3_MATHEMATICS_V1) {
      for (const pattern of malformedForms) expect(item.question).not.toMatch(pattern);
      for (const match of item.question.matchAll(/\b(A|An) ([A-Za-z]+)/g)) {
        const beginsWithVowel = /^[aeiou]/i.test(match[2]);
        expect(match[1] === "An").toBe(beginsWithVowel);
      }
    }
  });

  it("supports five disjoint representative attempts at the production blueprint quotas", () => {
    const byTopic = new Map<string, typeof GRADE_3_MATHEMATICS_V1>();
    for (const item of GRADE_3_MATHEMATICS_V1) {
      const topic = String(item.metadata.topicSlug);
      byTopic.set(topic, [...(byTopic.get(topic) ?? []), item]);
    }

    const used = new Set<string>();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const selected: typeof GRADE_3_MATHEMATICS_V1 = [];
      for (const [topic, draw] of Object.entries(blueprintDraws)) {
        const pool = byTopic.get(topic) ?? [];
        selected.push(...pool.slice(attempt * draw, (attempt + 1) * draw));
      }
      expect(selected).toHaveLength(25);
      expect(new Set(selected.map((item) => item.sourceRecordId)).size).toBe(25);
      for (const item of selected) {
        expect(used.has(item.sourceRecordId)).toBe(false);
        used.add(item.sourceRecordId);
      }
    }
    expect(used.size).toBe(125);
  });
});
