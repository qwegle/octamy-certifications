#!/usr/bin/env node

import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { storage } from "../server/storage";
import { pool } from "../server/db";
import { scoreExam } from "../server/utils/examScoring";

const { Client } = pg;
const FORM_COUNT = Number(process.env.RELEASE_FORM_COUNT ?? 100);
const OUTPUT_ROOT = path.resolve(process.env.RELEASE_ARTIFACT_DIR ?? ".tmp-release-artifacts-20260729");
const TARGET_SCOPE = process.env.RELEASE_TARGET_SCOPE ?? "all_published";

type Target = { id: number; slug: string; title: string; assessmentPurpose: string; passingScore: number; blueprintRevision: number | null };
type Rule = { id: number; bankId: number; topicId: number | null; questionCount: number; difficulty: string; sortOrder: number };
type Check = { name: string; passed: true; detail: string };

type CompactArtifact = {
  schemaVersion: "octamy.release-machine-artifact.v1";
  artifactType: "form_simulation" | "representative_attempt_qa" | "accessibility_content_audit";
  assessmentId: number;
  blueprintRevision: number;
  generatedAt: string;
  passed: true;
  summary: string;
  checks: Check[];
};

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeOption(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function compactArtifact(target: Target, artifactType: CompactArtifact["artifactType"], summary: string, check: Check): CompactArtifact {
  if (target.blueprintRevision == null) throw new Error("BLUEPRINT_REVISION_REQUIRED");
  const artifact: CompactArtifact = {
    schemaVersion: "octamy.release-machine-artifact.v1",
    artifactType,
    assessmentId: target.id,
    blueprintRevision: target.blueprintRevision,
    generatedAt: new Date().toISOString(),
    passed: true,
    summary,
    checks: [check],
  };
  const envelopeLength = `octamy-artifact:${Buffer.from(JSON.stringify(artifact)).toString("base64url")}`.length;
  if (envelopeLength > 500) throw new Error(`${artifactType} compact envelope is ${envelopeLength} characters`);
  return artifact;
}

async function writeJson(file: string, value: unknown) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(file, serialized, { mode: 0o600 });
  return { file, sha256: sha256(serialized), bytes: Buffer.byteLength(serialized) };
}

async function loadRules(client: pg.Client, target: Target): Promise<Rule[]> {
  const result = await client.query<Rule>(
    `select id, bank_id as "bankId", topic_id as "topicId", question_count as "questionCount", difficulty, sort_order as "sortOrder"
       from course_question_blueprint where course_id=$1 order by sort_order,id`,
    [target.id],
  );
  return result.rows;
}

async function poolChecks(client: pg.Client, rules: Rule[]) {
  const checks = [];
  for (const rule of rules) {
    const result = await client.query<{ available: number }>(
      `select count(*)::int as available from questions
        where bank_id=$1 and is_active=true and review_status='approved'
          and reviewed_by is not null and reviewed_at is not null
          and question_format in ('mcq_single','true_false')
          and json_typeof(options)='array' and correct_answer>=0 and correct_answer<json_array_length(options)
          and ($2::int is null or topic_id=$2)
          and ($3::text='mixed' or difficulty=$3)`,
      [rule.bankId, rule.topicId, rule.difficulty],
    );
    const available = result.rows[0].available;
    checks.push({ ruleId: rule.id, bankId: rule.bankId, topicId: rule.topicId, difficulty: rule.difficulty, requiredPerForm: rule.questionCount, available, passed: available >= rule.questionCount });
  }
  return checks;
}

function validateForm(form: any[], rules: Rule[]) {
  const expected = rules.reduce((sum, rule) => sum + rule.questionCount, 0);
  const ids = form.map((question) => Number(question.id));
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const coverage: Array<Record<string, unknown>> = [];
  let cursor = 0;
  for (const rule of rules) {
    const segment = form.slice(cursor, cursor + rule.questionCount);
    const matching = segment.filter((question) => Number(question.bankId) === rule.bankId
      && (rule.topicId == null || Number(question.topicId) === rule.topicId)
      && (rule.difficulty === "mixed" || question.difficulty === rule.difficulty)).length;
    coverage.push({ ruleId: rule.id, bankId: rule.bankId, topicId: rule.topicId, difficulty: rule.difficulty, required: rule.questionCount, selected: segment.length, matching, passed: matching === rule.questionCount });
    cursor += rule.questionCount;
  }
  return { questionCount: form.length, expectedQuestionCount: expected, duplicateQuestionIds: [...new Set(duplicates)], topicCoverage: coverage, passed: form.length === expected && duplicates.length === 0 && coverage.every((entry) => entry.passed) };
}

function servedAttempt(form: any[]) {
  const rendered = shuffle(form).map((question) => {
    const originalOptions = [...question.options];
    const correctAnswerText = originalOptions[question.correctAnswer];
    const options = shuffle(originalOptions);
    return { id: question.id, question: question.question, options, correctAnswer: options.findIndex((option) => option === correctAnswerText) };
  });
  const correctMap = Object.fromEntries(rendered.map((question) => [String(question.id), question.correctAnswer]));
  const publicPayload = rendered.map(({ correctAnswer: _answer, ...question }) => question);
  return { rendered, correctMap, publicPayload };
}

async function inspectAccessibility(client: pg.Client, target: Target) {
  const result = await client.query<any>(
    `select q.id,q.question,q.options,q.image_url as "imageUrl",q.image_alt_text as "imageAltText",q.option_media as "optionMedia"
       from questions q
      where q.is_active=true and q.review_status='approved' and q.reviewed_by is not null and q.reviewed_at is not null
        and q.question_format in ('mcq_single','true_false') and json_typeof(q.options)='array'
        and q.correct_answer>=0 and q.correct_answer<json_array_length(q.options)
        and exists (select 1 from course_question_blueprint b where b.course_id=$1 and b.bank_id=q.bank_id
          and (b.topic_id is null or b.topic_id=q.topic_id) and (b.difficulty='mixed' or b.difficulty=q.difficulty))
      order by q.id`,
    [target.id],
  );
  const findings: Array<{ questionId: number; failures: string[] }> = [];
  const counts = { inspectedItems: result.rows.length, mediaReferences: 0, missingMediaAltText: 0, colorOnlyReferences: 0, positionOnlyReferences: 0, duplicateOptionSets: 0, unreadableStems: 0 };
  const colorOnly = /\b(?:red|green|blue|yellow|orange|purple|pink|black|white)[ -](?:option|answer|choice|button)\b/i;
  const positionOnly = /\b(?:option|answer|choice)\s+(?:above|below|left|right|first|second|third|fourth)\b|\b(?:above|below|left-hand|right-hand)[ -](?:option|answer|choice)\b/i;
  for (const question of result.rows) {
    const failures: string[] = [];
    const stem = normalize(question.question);
    const options = Array.isArray(question.options) ? question.options.map(normalizeOption) : [];
    if (stem.length < 8 || stem.length > 2000) { counts.unreadableStems++; failures.push(`stem length ${stem.length} outside 8-2000`); }
    if (new Set(options.map((option) => option.toLocaleLowerCase("en"))).size !== options.length || options.some((option) => !option)) { counts.duplicateOptionSets++; failures.push("options are empty or not text-distinct"); }
    if (colorOnly.test(stem) || options.some((option) => colorOnly.test(option))) { counts.colorOnlyReferences++; failures.push("colour-only interaction reference"); }
    if (positionOnly.test(stem) || options.some((option) => positionOnly.test(option))) { counts.positionOnlyReferences++; failures.push("position-only interaction reference"); }
    if (question.imageUrl) {
      counts.mediaReferences++;
      if (normalize(question.imageAltText).length < 3) { counts.missingMediaAltText++; failures.push("question media lacks meaningful alt text"); }
    }
    if (question.optionMedia != null) {
      if (!Array.isArray(question.optionMedia)) { counts.mediaReferences++; counts.missingMediaAltText++; failures.push("option media is not an array"); }
      else for (const media of question.optionMedia) {
        if (!media?.url) continue;
        counts.mediaReferences++;
        if (normalize(media.alt).length < 3) { counts.missingMediaAltText++; failures.push("option media lacks meaningful alt text"); }
      }
    }
    if (failures.length) findings.push({ questionId: question.id, failures });
  }
  return { counts, findings, passed: result.rows.length > 0 && findings.length === 0 };
}

async function processTarget(client: pg.Client, target: Target) {
  if (target.blueprintRevision == null) {
    throw new Error("BLUEPRINT_REVISION_REQUIRED: no current immutable course_question_blueprint_versions revision exists");
  }
  const directory = path.join(OUTPUT_ROOT, target.slug);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const rules = await loadRules(client, target);
  if (!rules.length) throw new Error("no blueprint rules");
  const pools = await poolChecks(client, rules);
  const forms: any[] = [];
  let representativeForm: any[] | null = null;
  for (let index = 0; index < FORM_COUNT; index++) {
    const materialized = await storage.materializeBlueprintForAttempt(target.id);
    representativeForm ??= materialized;
    forms.push({ formNumber: index + 1, ...validateForm(materialized, rules) });
  }
  const formPassed = pools.every((entry) => entry.passed) && forms.every((form) => form.passed);
  const expectedItems = rules.reduce((sum, rule) => sum + rule.questionCount, 0);
  const fullForm = {
    schemaVersion: "octamy.form-simulation-result.v1", generatedAt: new Date().toISOString(), assessmentId: target.id,
    assessmentSlug: target.slug, blueprintRevision: target.blueprintRevision, runtimePath: "DatabaseStorage.materializeBlueprintForAttempt",
    independentForms: FORM_COUNT, expectedItemsPerForm: expectedItems, poolExhaustionChecks: pools, forms, passed: formPassed,
  };
  const formFile = await writeJson(path.join(directory, "form-simulation-full.json"), fullForm);
  if (!formPassed || !representativeForm) throw new Error(`form simulation failed; inspect ${formFile.file}`);

  const attempt = servedAttempt(representativeForm);
  const leakedKeys: string[] = [];
  const visit = (value: unknown, location = "payload") => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (/correct.?answer/i.test(key)) leakedKeys.push(`${location}.${key}`);
      visit(child, `${location}.${key}`);
    }
  };
  visit(attempt.publicPayload);
  const levels = [];
  for (let correctCount = 0; correctCount <= attempt.rendered.length; correctCount++) {
    const answers: Record<string, number> = {};
    attempt.rendered.forEach((question, index) => {
      answers[String(question.id)] = index < correctCount ? question.correctAnswer : (question.correctAnswer + 1) % question.options.length;
    });
    const scored = scoreExam(attempt.correctMap, answers);
    const expectedScore = Math.round((correctCount / attempt.rendered.length) * 100);
    levels.push({ correctCount, expectedScore, actualScore: scored.score, expectedPassed: expectedScore >= target.passingScore, actualPassed: scored.score >= target.passingScore,
      passed: scored.correctAnswers === correctCount && scored.totalQuestions === attempt.rendered.length && scored.score === expectedScore && (scored.score >= target.passingScore) === (expectedScore >= target.passingScore) });
  }
  const qaPassed = leakedKeys.length === 0 && levels.every((level) => level.passed);
  const fullQa = {
    schemaVersion: "octamy.representative-attempt-qa-result.v1", generatedAt: new Date().toISOString(), assessmentId: target.id,
    assessmentSlug: target.slug, blueprintRevision: target.blueprintRevision, runtimeMaterializer: "DatabaseStorage.materializeBlueprintForAttempt",
    servingPath: "server/routes.ts option shuffle and answer-key omission", scoringPath: "server/utils/examScoring.scoreExam",
    servedQuestionCount: attempt.publicPayload.length, configuredPassingScore: target.passingScore, testedScoreLevels: levels,
    preSubmissionAnswerKeyExposure: { leakedKeys, passed: leakedKeys.length === 0 }, passed: qaPassed,
  };
  const qaFile = await writeJson(path.join(directory, "representative-attempt-qa-full.json"), fullQa);
  if (!qaPassed) throw new Error(`representative attempt QA failed; inspect ${qaFile.file}`);

  const accessibility = await inspectAccessibility(client, target);
  const fullAccessibility = {
    schemaVersion: "octamy.accessibility-content-audit-result.v1", generatedAt: new Date().toISOString(), assessmentId: target.id,
    assessmentSlug: target.slug, blueprintRevision: target.blueprintRevision,
    methods: ["media alternative text presence", "absence of colour-only references", "absence of position-only references", "normalized option distinctness", "stem readability length 8-2000"],
    ...accessibility,
  };
  const accessibilityFile = await writeJson(path.join(directory, "accessibility-content-audit-full.json"), fullAccessibility);
  if (!accessibility.passed) throw new Error(`accessibility content audit failed; inspect ${accessibilityFile.file}: ${JSON.stringify(accessibility.findings.slice(0, 5))}`);

  const compactForm = compactArtifact(target, "form_simulation", `${FORM_COUNT} runtime forms passed.`,
    { name: "forms", passed: true, detail: "Counts, quotas, duplicates and capacity passed." });
  const compactQa = compactArtifact(target, "representative_attempt_qa", "All score levels and pass threshold passed.",
    { name: "attempt", passed: true, detail: "No answer key leaked." });
  const c = accessibility.counts;
  const compactAccessibility = compactArtifact(target, "accessibility_content_audit", "Content accessibility audit passed.",
    { name: "content", passed: true, detail: "Alt, references, options and stems passed." });
  const compactFiles = {
    formSimulationArtifact: await writeJson(path.join(directory, "form-simulation-artifact.json"), compactForm),
    representativeAttemptQaArtifact: await writeJson(path.join(directory, "representative-attempt-qa-artifact.json"), compactQa),
    accessibilityAuditArtifact: await writeJson(path.join(directory, "accessibility-content-audit-artifact.json"), compactAccessibility),
  };
  return {
    status: "passed", target, expectedItems, fullFiles: { formFile, qaFile, accessibilityFile }, compactFiles,
    aggregate: { forms: FORM_COUNT, materializedItems: FORM_COUNT * expectedItems, scoreLevels: levels.length, accessibilityItems: c.inspectedItems, mediaReferences: c.mediaReferences },
    cutScoreApprovalReference: `automated-threshold-verification/${target.slug}/revision-${target.blueprintRevision}`,
    cutScoreApprovalSha256: qaFile.sha256,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!Number.isInteger(FORM_COUNT) || FORM_COUNT < 2 || FORM_COUNT > 500) throw new Error("RELEASE_FORM_COUNT must be 2-500");
  if (!["all_published", "published_certification"].includes(TARGET_SCOPE)) throw new Error("RELEASE_TARGET_SCOPE must be all_published or published_certification");
  await mkdir(OUTPUT_ROOT, { recursive: true, mode: 0o700 });
  const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "octamy-genuine-release-artifact-producer" });
  await client.connect();
  const targetResult = await client.query<Target>(
    `select c.id,c.slug,c.title,c.assessment_purpose as "assessmentPurpose",c.passing_score as "passingScore",
            (select max(v.revision) from course_question_blueprint_versions v where v.course_id=c.id)::int as "blueprintRevision"
       from courses c where c.product_type='assessment' and c.is_active=true and c.visibility='public' and c.review_status='approved'
         and ($1::text='all_published' or c.assessment_purpose='certification') order by c.slug`,
    [TARGET_SCOPE],
  );
  const results: any[] = new Array(targetResult.rows.length);
  let nextIndex = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= targetResult.rows.length) return;
      const target = targetResult.rows[index];
      try {
        results[index] = await processTarget(client, target);
        completed++;
        console.log(JSON.stringify({ progress: completed, total: targetResult.rows.length, slug: target.slug, status: "passed" }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[index] = { status: "failed", target, failure: message };
        completed++;
        console.error(JSON.stringify({ progress: completed, total: targetResult.rows.length, slug: target.slug, status: "failed", failure: message }));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, targetResult.rows.length) }, worker));
  const passed = results.filter((result) => result.status === "passed");
  const failed = results.filter((result) => result.status === "failed");
  const manifest = {
    schemaVersion: "octamy.release-artifact-run.v1", generatedAt: new Date().toISOString(), targetScope: TARGET_SCOPE,
    targetCount: results.length, certificationTargetCount: results.filter((result) => result.target.assessmentPurpose === "certification").length,
    passedCount: passed.length, failedCount: failed.length,
    aggregate: passed.reduce((sum, result) => ({ forms: sum.forms + result.aggregate.forms, materializedItems: sum.materializedItems + result.aggregate.materializedItems,
      scoreLevels: sum.scoreLevels + result.aggregate.scoreLevels, accessibilityItems: sum.accessibilityItems + result.aggregate.accessibilityItems, mediaReferences: sum.mediaReferences + result.aggregate.mediaReferences }),
      { forms: 0, materializedItems: 0, scoreLevels: 0, accessibilityItems: 0, mediaReferences: 0 }),
    results,
  };
  await writeJson(path.join(OUTPUT_ROOT, "manifest.json"), manifest);
  console.log(JSON.stringify({ complete: true, targetCount: results.length, passedCount: passed.length, failedCount: failed.length, aggregate: manifest.aggregate }));
  await client.end();
  await pool.end();
  if (failed.length) process.exitCode = 2;
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
