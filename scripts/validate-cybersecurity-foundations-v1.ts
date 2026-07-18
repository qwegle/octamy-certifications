#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeQuestionPackItem,
  normalizeQuestionPackManifest,
} from "./lib/question-pack-contract";

const directory = path.resolve("content/career-question-banks/cybersecurity-foundations-v1");
const manifestPath = path.join(directory, "manifest.json");
const questionsPath = path.join(directory, "questions.jsonl");

const expectedTopics = new Map([
  ["Security principles and risk governance", { inventory: 12, draw: 3 }],
  ["Identity and access management", { inventory: 12, draw: 3 }],
  ["Threats and secure user behavior", { inventory: 12, draw: 3 }],
  ["Network and application security", { inventory: 8, draw: 2 }],
  ["Data protection and cryptography", { inventory: 8, draw: 2 }],
  ["Vulnerability and configuration management", { inventory: 8, draw: 2 }],
  ["Monitoring and incident response", { inventory: 12, draw: 3 }],
  ["Resilience and recovery", { inventory: 8, draw: 2 }],
]);

const exactSourceByObjective = new Map([
  ["CSF-DPC-01", "https://pages.nist.gov/800-63-4/sp800-63b.html"],
  ["CSF-NAS-02", "https://www.rfc-editor.org/rfc/rfc9525"],
  ["CSF-DPC-06", "https://doi.org/10.6028/NIST.SP.800-88r2"],
  ["CSF-VCM-02", "https://doi.org/10.6028/NIST.SP.800-70r5"],
  ["CSF-VCM-04", "https://doi.org/10.6028/NIST.SP.800-40r4"],
]);

const errors: string[] = [];
const manifestInput = JSON.parse(await readFile(manifestPath, "utf8"));
const manifest = normalizeQuestionPackManifest(manifestInput);
if (!manifest.ok) errors.push(...manifest.errors.map((error) => `manifest: ${error}`));

const lines = (await readFile(questionsPath, "utf8")).trim().split("\n");
if (lines.length !== 80) errors.push(`expected 80 rows, found ${lines.length}`);

const items: any[] = [];
const exact = new Set<string>();
const normalized = new Set<string>();
const ids = new Set<string>();
const objectives = new Set<string>();
const topicCounts = new Map<string, number>();
const topicAnswers = new Map<string, number[]>();
const answerCounts = [0, 0, 0, 0];
const difficultyCounts = new Map<string, number>();

const normalizeStem = (value: string) => value
  .toLocaleLowerCase("en")
  .replace(/`[^`]+`/g, "<code>")
  .replace(/\b\d+\b/g, "<n>")
  .replace(/[^a-z<>]+/g, " ")
  .trim();

lines.forEach((line, index) => {
  let input: any;
  try {
    input = JSON.parse(line);
  } catch (error) {
    errors.push(`line ${index + 1}: invalid JSON (${String(error)})`);
    return;
  }
  const result = normalizeQuestionPackItem(input);
  if (!result.ok) {
    errors.push(...result.errors.map((error) => `line ${index + 1}: ${error}`));
    return;
  }
  items.push(input);
  const questionKey = input.question.toLocaleLowerCase("en").trim();
  const stemKey = normalizeStem(input.question);
  if (exact.has(questionKey)) errors.push(`line ${index + 1}: exact duplicate stem`);
  if (normalized.has(stemKey)) errors.push(`line ${index + 1}: normalized duplicate stem`);
  if (ids.has(input.sourceRecordId)) errors.push(`line ${index + 1}: duplicate sourceRecordId`);
  if (objectives.has(input.metadata.objectiveCode)) errors.push(`line ${index + 1}: duplicate objectiveCode`);
  exact.add(questionKey);
  normalized.add(stemKey);
  ids.add(input.sourceRecordId);
  objectives.add(input.metadata.objectiveCode);

  topicCounts.set(input.topic, (topicCounts.get(input.topic) ?? 0) + 1);
  const correctOption = input.answer.correctOption;
  answerCounts[correctOption] += 1;
  const topicAnswerCounts = topicAnswers.get(input.topic) ?? [0, 0, 0, 0];
  topicAnswerCounts[correctOption] += 1;
  topicAnswers.set(input.topic, topicAnswerCounts);
  difficultyCounts.set(input.difficulty, (difficultyCounts.get(input.difficulty) ?? 0) + 1);

  if (input.metadata.syllabusVersion !== "OCT-CSF-2026.1") errors.push(`line ${index + 1}: wrong syllabus version`);
  if (input.metadata.reviewerStatus !== "pending") errors.push(`line ${index + 1}: reviewer must remain pending`);
  if (input.metadata.distractorReviewStatus !== "pending") errors.push(`line ${index + 1}: distractor review must remain pending`);
  if (input.metadata.authoringMethod !== "AI-assisted original draft") errors.push(`line ${index + 1}: authorship status is not explicit`);
  if (!input.metadata.answerVerificationMethod?.includes("independent item review required")) errors.push(`line ${index + 1}: missing verification gate`);
  if (!input.provenance.sourceLocator.startsWith("https://")) errors.push(`line ${index + 1}: source must use HTTPS`);
  const exactSource = exactSourceByObjective.get(input.metadata.objectiveCode);
  if (exactSource && input.provenance.sourceLocator !== exactSource) errors.push(`line ${index + 1}: source mismatch for ${input.metadata.objectiveCode}`);
  if (input.provenance.sourceLocator.includes("rfc8446") && !["CSF-NAS-01", "CSF-DPC-08"].includes(input.metadata.objectiveCode)) {
    errors.push(`line ${index + 1}: TLS 1.3 is not direct evidence for ${input.metadata.objectiveCode}`);
  }
  if (/placeholder|lorem ipsum|todo|sample question/i.test(input.question)) errors.push(`line ${index + 1}: placeholder language`);
  if (new Set(input.options.map((option: string) => option.toLocaleLowerCase("en").trim())).size !== 4) errors.push(`line ${index + 1}: options are not unique`);
});

let totalDraw = 0;
for (const [topic, expected] of expectedTopics) {
  const actual = topicCounts.get(topic) ?? 0;
  totalDraw += expected.draw;
  if (actual !== expected.inventory) errors.push(`${topic}: expected ${expected.inventory}, found ${actual}`);
  if (actual < expected.draw * 4) errors.push(`${topic}: ${actual} cannot support draw ${expected.draw} at 4x`);
  const counts = topicAnswers.get(topic) ?? [0, 0, 0, 0];
  const requiredPerPosition = expected.inventory / 4;
  if (counts.some((count) => count !== requiredPerPosition)) errors.push(`${topic}: answer positions are not balanced (${counts.join(",")})`);
}
for (const unexpected of topicCounts.keys()) {
  if (!expectedTopics.has(unexpected)) errors.push(`unexpected topic: ${unexpected}`);
}
if (totalDraw !== 20) errors.push(`expected total draw 20, found ${totalDraw}`);
if (items.length < totalDraw * 4) errors.push(`bank has ${items.length}; draw ${totalDraw} requires ${totalDraw * 4}`);
if (answerCounts.some((count) => count !== 20)) errors.push(`answer positions are not 20 each (${answerCounts.join(",")})`);
for (const difficulty of ["easy", "medium", "hard"]) {
  if ((difficultyCounts.get(difficulty) ?? 0) < 8) errors.push(`${difficulty}: insufficient coverage`);
}

if (errors.length) throw new Error(errors.join("\n"));

process.stdout.write(`${JSON.stringify({
  status: "passed",
  manifestSha256: manifest.ok ? manifest.value.manifestSha256 : null,
  questions: items.length,
  draw: totalDraw,
  rotationDepth: items.length / totalDraw,
  topics: Object.fromEntries(topicCounts),
  difficulties: Object.fromEntries(difficultyCounts),
  answerPositions: { A: answerCounts[0], B: answerCounts[1], C: answerCounts[2], D: answerCounts[3] },
  exactDuplicates: 0,
  normalizedDuplicates: 0,
  reviewerStatus: "pending",
}, null, 2)}\n`);
