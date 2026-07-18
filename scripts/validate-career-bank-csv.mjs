#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import Papa from 'papaparse';

const file = process.argv[2];
const drawCount = Number(process.argv[3] ?? 20);
if (!file || !Number.isInteger(drawCount) || drawCount < 1) throw new Error('Usage: node scripts/validate-career-bank-csv.mjs <questions.csv> [draw-count]');

function normalized(value) {
  return value.toLowerCase().replace(/`[^`]+`/g, '<code>').replace(/\b\d+\b/g, '<n>').replace(/[^a-z<>]+/g, ' ').trim();
}

const expectedHeader = [
  'topic', 'question', 'format', 'optionA', 'optionB', 'optionC', 'optionD',
  'correctAnswer', 'marks', 'negativeMarks', 'timeLimitSec', 'difficulty', 'tags',
  'explanation', 'syllabusVersion', 'objectiveCode', 'answerValidationMethod',
  'answerValidationReference', 'distractorReviewNote',
];
const parsed = Papa.parse(await readFile(file, 'utf8'), {
  header: true,
  skipEmptyLines: 'greedy',
  transformHeader: (value) => value.trim(),
});
if (parsed.errors.length) {
  throw new Error(parsed.errors.map((error) => `CSV row ${(error.row ?? 0) + 2}: ${error.message}`).join('\n'));
}
if (JSON.stringify(parsed.meta.fields) !== JSON.stringify(expectedHeader)) throw new Error('Unexpected CSV header');
const rows = parsed.data;
if (rows.length < 80) throw new Error(`Bank has ${rows.length} questions; certification minimum is 80`);
if (rows.length < drawCount * 4) throw new Error(`Bank has ${rows.length} questions; draw ${drawCount} requires ${drawCount * 4} for four-times rotation`);

const topicCounts = new Map();
const exact = new Set();
const stems = new Set();
const answerCounts = new Map();
const objectiveCounts = new Map();
const evidenceHosts = new Map();
const errors = [];
rows.forEach((row, offset) => {
  const line = offset + 2;
  const {
    topic, question, format, optionA, optionB, optionC, optionD,
    correctAnswer: answer, marks, negativeMarks, timeLimitSec, difficulty, tags,
    explanation, syllabusVersion, objectiveCode, answerValidationMethod,
    answerValidationReference, distractorReviewNote,
  } = row;
  topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  answerCounts.set(answer, (answerCounts.get(answer) ?? 0) + 1);
  objectiveCounts.set(objectiveCode, (objectiveCounts.get(objectiveCode) ?? 0) + 1);
  if (format !== 'mcq_single') errors.push(`line ${line}: unsupported format ${format}`);
  if (![optionA, optionB, optionC, optionD].every((value) => value?.trim())) errors.push(`line ${line}: four options are required`);
  if (!['A', 'B', 'C', 'D'].includes(answer)) errors.push(`line ${line}: invalid answer ${answer}`);
  if (!['easy', 'medium', 'hard'].includes(difficulty)) errors.push(`line ${line}: invalid difficulty ${difficulty}`);
  if (!question?.trim() || !explanation?.trim() || !tags?.trim()) errors.push(`line ${line}: question, explanation and tags are required`);
  if (marks !== '1' || negativeMarks !== '0' || Number(timeLimitSec) < 30) errors.push(`line ${line}: invalid scoring or time limit`);
  const questionKey = question.toLowerCase().trim();
  if (exact.has(questionKey)) errors.push(`line ${line}: exact duplicate question`);
  exact.add(questionKey);
  const stem = normalized(question);
  if (stems.has(stem)) errors.push(`line ${line}: normalized duplicate question`);
  stems.add(stem);
  if (new Set([optionA, optionB, optionC, optionD].map((value) => value.toLowerCase().trim())).size !== 4) errors.push(`line ${line}: duplicate options`);
  if (syllabusVersion !== 'OCT-GLDW-2026.1') errors.push(`line ${line}: syllabusVersion must be OCT-GLDW-2026.1`);
  const topicPrefix = {
    'Git snapshots and inspection': 'GLDW-GSI',
    'Git branches and integration': 'GLDW-GBI',
    'Git collaboration and recovery': 'GLDW-GCR',
    'Shell execution and redirection': 'GLDW-SER',
    'Files and permissions': 'GLDW-FPR',
    'Processes and services': 'GLDW-PSV',
    'Text, search and pipelines': 'GLDW-TSP',
    'Operational troubleshooting': 'GLDW-OTR',
  }[topic];
  const expectedObjective = topicPrefix
    ? `${topicPrefix}-${String(topicCounts.get(topic)).padStart(2, '0')}`
    : null;
  if (!expectedObjective || objectiveCode !== expectedObjective) {
    errors.push(`line ${line}: objectiveCode must be ${expectedObjective ?? 'mapped to a known topic'}`);
  }
  if (answerValidationMethod !== 'primary_source') errors.push(`line ${line}: answerValidationMethod must be primary_source`);
  try {
    const reference = new URL(answerValidationReference);
    const allowedHosts = new Set(['git-scm.com', 'www.gnu.org', 'man7.org', 'www.freedesktop.org']);
    if (reference.protocol !== 'https:' || !allowedHosts.has(reference.hostname) || reference.pathname === '/' || reference.pathname.length < 10) {
      errors.push(`line ${line}: answerValidationReference must be a specific primary Git, GNU, Linux, or systemd HTTPS document`);
    }
    evidenceHosts.set(reference.hostname, (evidenceHosts.get(reference.hostname) ?? 0) + 1);
  } catch {
    errors.push(`line ${line}: answerValidationReference must be a valid URL`);
  }
  if (distractorReviewNote.length < 80
    || !distractorReviewNote.includes(objectiveCode)
    || !distractorReviewNote.includes('not an alternate correct answer')
    || /\b(?:todo|tbd|placeholder)\b/i.test(distractorReviewNote)) {
    errors.push(`line ${line}: distractorReviewNote must record an objective-specific author check without placeholders`);
  }
});

if (topicCounts.size < 4) errors.push(`expected at least 4 syllabus topics, found ${topicCounts.size}`);
for (const [topic, count] of topicCounts) {
  if (count !== 10) errors.push(`${topic}: expected 10 questions, found ${count}`);
}
for (const [objectiveCode, count] of objectiveCounts) {
  if (count !== 1) errors.push(`${objectiveCode}: objective code occurs ${count} times`);
}
for (const letter of ['A', 'B', 'C', 'D']) {
  const count = answerCounts.get(letter) ?? 0;
  if (count < Math.floor(rows.length * 0.15)) errors.push(`answer ${letter}: only ${count} occurrences creates answer-position leakage`);
}
if (errors.length) throw new Error(errors.join('\n'));

console.log(JSON.stringify({
  file,
  questions: rows.length,
  drawCount,
  rotationDepth: rows.length / drawCount,
  topics: Object.fromEntries(topicCounts),
  answerPositions: Object.fromEntries(answerCounts),
  evidence: {
    syllabusVersion: 'OCT-GLDW-2026.1',
    objectiveCodes: objectiveCounts.size,
    validationMethod: 'primary_source',
    sourceHosts: Object.fromEntries(evidenceHosts),
    distractorNotes: rows.length,
  },
  exactDuplicates: 0,
  normalizedDuplicates: 0,
}, null, 2));
