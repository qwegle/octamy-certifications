import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeQuestionPackItem } from "../../scripts/lib/question-pack-contract";
import {
  API_DESIGN_MICROSERVICES_SKILLS_V1,
  auditApiDesignMicroservicesSkillsV1,
} from "../../scripts/generate-api-design-microservices-skills-v1";

describe("API Design and Microservices Skills v1", () => {
  it("provides a valid 80-item, five-times topic blueprint pool", () => {
    const audit = auditApiDesignMicroservicesSkillsV1();
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

  it("carries release-shaped evidence and authoritative references on every item", () => {
    const allowedSources = [
      "https://www.rfc-editor.org/rfc/rfc9110.html",
      "https://www.rfc-editor.org/rfc/rfc9111.html",
      "https://spec.openapis.org/oas/latest.html",
      "https://owasp.org/API-Security/editions/2023/en/0x11-t10/",
      "https://12factor.net/",
      "https://kubernetes.io/docs/",
    ];
    for (const item of API_DESIGN_MICROSERVICES_SKILLS_V1) {
      expect(normalizeQuestionPackItem(item).ok).toBe(true);
      expect(allowedSources.some((prefix) => item.provenance.sourceLocator.startsWith(prefix))).toBe(true);
      expect(item.explanation.length).toBeGreaterThanOrEqual(30);
      expect(item.options).toHaveLength(4);
      expect(new Set(item.options.map((option) => option.toLowerCase()))).toHaveProperty("size", 4);
      expect(item.metadata.releaseEvidence).toMatchObject({
        syllabusVersion: "OCT-ADMS-2026.1 (RFC 9110/9111, OpenAPI 3.1, OWASP API Security 2023, Twelve-Factor, Kubernetes docs snapshot 2026-07-28)",
        answerValidation: { status: "verified", method: "primary_source" },
        distractorReview: { status: "verified" },
      });
      expect(item.metadata.releaseEvidence.objectiveCode).toMatch(/^ADMS-[A-Z]+-\d{2}$/);
    }
  });

  it("exactly reproduces the committed JSONL artifact", () => {
    const generated = `${API_DESIGN_MICROSERVICES_SKILLS_V1.map((item) => JSON.stringify(item)).join("\n")}\n`;
    const committed = readFileSync(
      path.resolve("content/question-packs/octamy-api-design-microservices-skills-v1.jsonl"),
      "utf8",
    );
    expect(generated).toBe(committed);
  });
});
