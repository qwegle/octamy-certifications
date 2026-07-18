import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeQuestionPackItem } from "../../scripts/lib/question-pack-contract";
import {
  REACT_APPLICATION_ENGINEERING_SKILLS_V1,
  auditReactApplicationEngineeringSkillsV1,
} from "../../scripts/generate-react-application-engineering-skills-v1";

describe("React Application Engineering Skills v1", () => {
  it("provides a valid 80-item, five-times topic blueprint pool", () => {
    const audit = auditReactApplicationEngineeringSkillsV1();
    expect(audit.errors).toEqual([]);
    expect(audit.rows).toBe(80);
    expect(audit.uniquePrompts).toBe(80);
    expect(audit.uniqueSemanticPrompts).toBe(80);
    expect(audit.uniqueContent).toBe(80);
    expect(audit.answerPositions).toEqual([20, 20, 20, 20]);
    expect(audit.proposedDraw).toBe(16);
    expect(audit.rotationDepth).toBe(5);
    expect(Object.values(audit.topicCounts)).toEqual(Array(8).fill(10));
    for (const topic of Object.keys(audit.topicCounts)) {
      expect(audit.difficultyCounts[`${topic}:easy`]).toBe(3);
      expect(audit.difficultyCounts[`${topic}:medium`]).toBe(5);
      expect(audit.difficultyCounts[`${topic}:hard`]).toBe(2);
    }
  });

  it("carries release-shaped evidence and official primary references on every item", () => {
    for (const item of REACT_APPLICATION_ENGINEERING_SKILLS_V1) {
      expect(normalizeQuestionPackItem(item).ok).toBe(true);
      expect(item.provenance.sourceLocator).toMatch(/^https:\/\/(?:react\.dev\/|www\.w3\.org\/WAI\/)/);
      expect(item.explanation.length).toBeGreaterThanOrEqual(30);
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options.map((option) => option.toLowerCase()))).toHaveProperty("size", 4);
      expect(item.metadata.releaseEvidence).toMatchObject({
        syllabusVersion: "OCT-RAES-2026.1 (React 19.2; react.dev snapshot 2026-07-19)",
        answerValidation: { status: "verified", method: "primary_source" },
        distractorReview: { status: "verified" },
      });
      expect(item.metadata.releaseEvidence.objectiveCode).toMatch(/^RAES-[A-Z]{2}-\d{2}$/);
    }
  });

  it("exactly reproduces the committed JSONL artifact", () => {
    const generated = `${REACT_APPLICATION_ENGINEERING_SKILLS_V1.map((item) => JSON.stringify(item)).join("\n")}\n`;
    const committed = readFileSync(
      path.resolve("content/question-packs/octamy-react-application-engineering-skills-v1.jsonl"),
      "utf8",
    );
    expect(generated).toBe(committed);
  });
});
