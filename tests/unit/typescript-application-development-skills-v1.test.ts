import { describe, expect, it } from "@jest/globals";
import { normalizeQuestionPackItem } from "../../scripts/lib/question-pack-contract";
import {
  TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1,
  auditTypeScriptApplicationDevelopmentSkillsV1,
} from "../../scripts/generate-typescript-application-development-skills-v1";

describe("TypeScript Application Development Skills v1", () => {
  it("provides a valid 80-item, five-times topic blueprint pool", () => {
    const audit = auditTypeScriptApplicationDevelopmentSkillsV1();
    expect(audit.errors).toEqual([]);
    expect(audit.rows).toBe(80);
    expect(audit.uniquePrompts).toBe(80);
    expect(audit.uniqueSemanticPrompts).toBe(80);
    expect(audit.uniqueContent).toBe(80);
    expect(audit.answerPositions).toEqual([20, 20, 20, 20]);
    expect(audit.proposedDraw).toBe(16);
    expect(audit.rotationDepth).toBe(5);
    expect(Object.values(audit.topicCounts)).toEqual(Array(8).fill(10));
  });

  it("carries release-shaped evidence and official primary references on every item", () => {
    for (const item of TYPESCRIPT_APPLICATION_DEVELOPMENT_SKILLS_V1) {
      expect(normalizeQuestionPackItem(item).ok).toBe(true);
      expect(item.provenance.sourceLocator).toMatch(/^https:\/\/www\.typescriptlang\.org\//);
      expect(item.explanation.length).toBeGreaterThanOrEqual(30);
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options.map((option) => option.toLowerCase()))).toHaveProperty("size", 4);
      expect(item.metadata.releaseEvidence).toMatchObject({
        syllabusVersion: "OCT-TSAD-2026.1 (TypeScript 5.6.3; Handbook snapshot 2026-07-18)",
        answerValidation: { status: "verified", method: "primary_source" },
        distractorReview: { status: "verified" },
      });
      expect(item.metadata.releaseEvidence.objectiveCode).toMatch(/^TSAD-[A-Z]{2}-\d{2}$/);
    }
  });
});
