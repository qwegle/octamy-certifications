import { describe, expect, it } from "@jest/globals";
import {
  normalizeQuestionPackItem,
  normalizeQuestionPackManifest,
  questionTopicSlug,
} from "../../scripts/lib/question-pack-contract";
import { generateOriginalQuestion } from "../../server/content/original-question-factory";

const manifest = {
  schemaVersion: 1,
  sourceKey: "octamy-original:quant-science:v1",
  name: "Octamy Original Quantitative Science",
  publisher: "Octamy Solutions Private Limited",
  datasetVersion: "1.0.0",
  description: "Deterministically authored quantitative science items.",
  sourceUrl: "https://octamy.com/internal-rights-register/quant-science-v1",
  retrievedAt: "2026-07-14T00:00:00.000Z",
  license: {
    identifier: "Proprietary-Octamy-Original-1.0",
    name: "Octamy original-content licence",
    url: "https://octamy.com/legal/original-content-rights",
    rightsBasis: "owned",
    commercialUseAllowed: true,
    derivativesAllowed: true,
    shareAlikeObligation: "none",
    attributionText: "© Octamy Solutions Private Limited",
    evidenceReference: "internal-rights-register:quant-science-v1",
  },
  provenance: {
    acquisitionMethod: "first_party",
    originalFormat: "jsonl",
    chainOfTitle: "Questions and explanations are deterministically authored by Octamy without third-party question text.",
  },
};

const numericItem = {
  schemaVersion: 1,
  sourceRecordId: "quant-science-v1:physics:motion:000001",
  language: "en",
  question: "A body travels 125 m in 10 s. What is its speed?",
  format: "numeric",
  options: [],
  answer: { kind: "numeric", value: 12.5, tolerance: 0.01, unit: "m/s" },
  explanation: "Speed equals distance divided by time, so 125 / 10 = 12.5 m/s.",
  subject: "Physics",
  topic: "Motion",
  syllabus: "CBSE",
  exam: null,
  examYear: null,
  objective: "Apply the speed formula v = d/t.",
  difficulty: "medium",
  maxPoints: 2,
  negativeMarks: 0,
  timeLimitSec: 90,
  tags: ["kinematics"],
  provenance: {
    sourceLocator: "generator:physics-motion:v1:seed-1",
    questionOrigin: "original",
    answerEvidence: "Deterministic calculation: 125 / 10 = 12.5 m/s.",
    explanationOrigin: "original",
  },
  metadata: { generatorVersion: "1.0.0", seed: 1 },
};

describe("question-pack rights manifest", () => {
  it("accepts an explicit first-party chain of title and hashes it deterministically", () => {
    const first = normalizeQuestionPackManifest(manifest);
    const reordered = normalizeQuestionPackManifest(JSON.parse(JSON.stringify(manifest)));
    expect(first.ok).toBe(true);
    expect(reordered.ok).toBe(true);
    if (!first.ok || !reordered.ok) return;
    expect(first.value.manifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.value.manifestSha256).toBe(reordered.value.manifestSha256);
  });

  it("fails closed for NC/ND and unapproved open-content identifiers", () => {
    for (const identifier of ["CC-BY-NC-4.0", "CC-BY-ND-4.0", "MIT"]) {
      const result = normalizeQuestionPackManifest({
        ...manifest,
        license: {
          ...manifest.license,
          identifier,
          rightsBasis: "open_license",
        },
      });
      expect(result.ok).toBe(false);
    }
  });

  it("does not accept a repository licence as question chain-of-title", () => {
    const result = normalizeQuestionPackManifest({
      ...manifest,
      license: { ...manifest.license, evidenceReference: "GitHub repository LICENSE file" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("repository licence alone");
  });

  it("rejects repository-only evidence regardless of word order", () => {
    const result = normalizeQuestionPackManifest({
      ...manifest,
      license: { ...manifest.license, evidenceReference: "LICENSE file in GitHub repository" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("question-pack item normalization", () => {
  it("normalizes a numeric item with grading metadata and two deterministic hashes", () => {
    const result = normalizeQuestionPackItem(numericItem);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      sourceRecordId: numericItem.sourceRecordId,
      questionFormat: "numeric",
      expectedAnswer: "12.5",
      answerMetadata: { kind: "numeric", value: "12.5", tolerance: 0.01, unit: "m/s" },
      topic: "Motion",
    });
    expect(result.value.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.value.sourceRecordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dedupes content independently of immutable source record identity", () => {
    const first = normalizeQuestionPackItem(numericItem);
    const second = normalizeQuestionPackItem({
      ...numericItem,
      sourceRecordId: "quant-science-v1:physics:motion:alias-000001",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.contentHash).toBe(first.value.contentHash);
    expect(second.value.sourceRecordHash).not.toBe(first.value.sourceRecordHash);
  });

  it("preserves valid assessment release evidence in answer metadata", () => {
    const item = {
      ...numericItem,
      metadata: {
        releaseEvidence: {
          syllabusVersion: "OCT-MATH-2026.1",
          objectiveCode: "MATH-ADD-01",
          answerValidation: {
            status: "verified",
            method: "independent_calculation",
            reference: "Recalculated independently: 2 + 2 = 4.",
          },
          distractorReview: {
            status: "verified",
            note: "Each distractor represents a distinct arithmetic error.",
          },
        },
      },
    };

    const normalized = normalizeQuestionPackItem(item);
    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.value.answerMetadata?.releaseEvidence).toEqual(item.metadata.releaseEvidence);
    }
  });

  it.each([
    [{ ...numericItem, format: "mcq_single" }, "requires a single_choice answer"],
    [{ ...numericItem, answer: { kind: "numeric", value: "not-a-number", tolerance: 0 } }, "must be finite"],
    [{ ...numericItem, negativeMarks: 3 }, "cannot exceed max points"],
  ])("rejects incompatible or unsafe answer configuration", (item, message) => {
    const result = normalizeQuestionPackItem(item);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain(message);
  });

  it("strictly validates choice bounds and duplicate options", () => {
    const item = {
      ...numericItem,
      format: "mcq_single",
      options: ["12.5 m/s", "12.5 m/s"],
      answer: { kind: "single_choice", correctOption: 4 },
    };
    const result = normalizeQuestionPackItem(item);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("options must be unique");
    expect(result.errors.join(" ")).toContain("outside the options array");
  });

  it("creates stable topic slugs", () => {
    expect(questionTopicSlug("  Laws of Motion  ")).toBe("laws-of-motion");
  });

  it("accepts bounded structured generator evidence", () => {
    const result = normalizeQuestionPackItem({
      ...numericItem,
      metadata: {
        generatorVersion: "1.0.0",
        assessmentSlugs: ["neet-ug-physics", "jee-main-physics"],
        proof: {
          operation: "divide",
          inputs: [125, 10],
          result: 12.5,
          precision: 1,
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provenance.sourceMetadata).toMatchObject({
      assessmentSlugs: ["neet-ug-physics", "jee-main-physics"],
      proof: { operation: "divide", inputs: [125, 10] },
    });
  });

  it("accepts the production first-party generator record without an adapter", () => {
    const result = normalizeQuestionPackItem(generateOriginalQuestion(99_999));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provenance.sourceMetadata).toHaveProperty("proof");
    expect(result.value.provenance.sourceMetadata).toHaveProperty("assessmentSlugs");
  });

  it.each([
    [{ proof: { level1: { level2: { level3: { level4: true } } } } }, "nesting is limited"],
    [{ assessmentSlugs: Array.from({ length: 51 }, (_, index) => `assessment-${index}`) }, "at most 50"],
    [{ safe: true, constructor: "pollute" }, "Unsafe metadata key"],
    [{ evidence: "x".repeat(8_193) }, "at most 500"],
  ])("rejects unsafe or unbounded structured metadata", (metadata, message) => {
    const result = normalizeQuestionPackItem({ ...numericItem, metadata });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain(message);
  });
});
