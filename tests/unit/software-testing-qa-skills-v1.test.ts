import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeQuestionPackItem } from "../../scripts/lib/question-pack-contract";
import {
  SOFTWARE_TESTING_QA_SKILLS_V1,
  auditSoftwareTestingQaSkillsV1,
} from "../../scripts/generate-software-testing-qa-skills-v1";

describe("Software Testing and QA Skills v1", () => {
  it("provides a valid 100-item, four-times rotation certification pool", () => {
    const audit = auditSoftwareTestingQaSkillsV1();
    expect(audit.errors).toEqual([]);
    expect(audit.rows).toBe(100);
    expect(audit.uniquePrompts).toBe(100);
    expect(audit.uniqueSemanticPrompts).toBe(100);
    expect(audit.uniqueContent).toBe(100);
    expect(audit.answerPositions).toEqual([25, 25, 25, 25]);
    expect(audit.proposedDraw).toBe(25);
    expect(audit.rotationDepth).toBe(4);
    expect(Object.values(audit.topicCounts)).toEqual(Array(10).fill(10));
    for (const topic of Object.keys(audit.topicCounts)) {
      expect(audit.difficultyCounts[`${topic}:easy`]).toBe(3);
      expect(audit.difficultyCounts[`${topic}:medium`]).toBe(5);
      expect(audit.difficultyCounts[`${topic}:hard`]).toBe(2);
    }
  });

  it("carries release-shaped evidence and authoritative references on every item", () => {
    const allowedSources = [
      "https://www.istqb.org/",
      "https://owasp.org/www-project-web-security-testing-guide/",
      "https://www.w3.org/TR/WCAG22/",
      "https://playwright.dev/docs/",
      "https://spec.openapis.org/oas/latest.html",
      "https://www.rfc-editor.org/rfc/rfc9110.html",
    ];
    for (const item of SOFTWARE_TESTING_QA_SKILLS_V1) {
      expect(normalizeQuestionPackItem(item).ok).toBe(true);
      expect(allowedSources.some((prefix) => item.provenance.sourceLocator.startsWith(prefix))).toBe(true);
      expect(item.explanation.length).toBeGreaterThanOrEqual(30);
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options.map((option) => option.toLowerCase()))).toHaveProperty("size", 4);
      expect(item.metadata.releaseEvidence).toMatchObject({
        syllabusVersion: "OCT-STQA-2026.1 (ISTQB CTFL 4.0, OWASP WSTG, WCAG 2.2, Playwright, OpenAPI; 2026-07-28)",
        answerValidation: { status: "verified", method: "primary_source" },
        distractorReview: { status: "verified" },
      });
      expect(item.metadata.releaseEvidence.objectiveCode).toMatch(/^STQA-[A-Z0-9]+-\d{2}$/);
    }
  });

  it("exactly reproduces the committed JSONL artifact", () => {
    const generated = `${SOFTWARE_TESTING_QA_SKILLS_V1.map((item) => JSON.stringify(item)).join("\n")}\n`;
    const committed = readFileSync(
      path.resolve("content/question-packs/octamy-software-testing-qa-skills-v1.jsonl"),
      "utf8",
    );
    expect(generated).toBe(committed);
  });
});
