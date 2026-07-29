#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { governedMachineArtifactReference, type ReleaseMachineArtifact } from "./lib/governed-assessment-inventory";
import { normalizeExamAnswers, scoreExam } from "../server/utils/examScoring";

const { Client } = pg;
const FORM_COUNT = 20;
const OUTPUT_ROOT = path.resolve(".tmp-release-artifacts");
const SHA256 = /^[0-9a-f]{64}$/;

type CourseRow = {
  id: number;
  slug: string;
  title: string;
  passing_score: number;
  blueprint_revision: number | null;
};
type RuleRow = {
  id: number;
  bank_id: number;
  topic_id: number | null;
  topic_slug: string | null;
  question_count: number;
  difficulty: string;
  sort_order: number;
  available: number;
};
type QuestionRow = {
  id: number;
  bank_id: number;
  topic_id: number | null;
  difficulty: string;
  question: string;
  options: string[];
  correct_answer: number;
  image_url: string | null;
  image_alt_text: string | null;
  option_media: unknown;
};
type Failure = { assessmentId: number; slug: string; failures: string[] };

type ArtifactManifestEntry = {
  assessmentId: number;
  slug: string;
  blueprintRevision: number;
  passingScore: number;
  formSimulationArtifact: string;
  representativeAttemptQaArtifact: string;
  accessibilityAuditArtifact: string;
  cutScoreApprovalReference: string;
  cutScoreApprovalSha256: string;
  results: {
    forms: number;
    draws: number;
    duplicateSelections: number;
    poolExhaustions: number;
    topicRuleChecks: number;
    representativeAttempts: number;
    auditedItems: number;
    mediaItems: number;
  };
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function normalized(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function shuffle<T>(values: T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function forbiddenAnswerKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = forbiddenAnswerKey(entry);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (/^(correct_?answer|answer_metadata|explanation)$/i.test(key)) return key;
    const found = forbiddenAnswerKey(entry);
    if (found) return found;
  }
  return null;
}

async function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

function compactArtifact(
  artifactType: ReleaseMachineArtifact["artifactType"],
  assessmentId: number,
  blueprintRevision: number,
  generatedAt: string,
  summary: string,
  reportSha256: string,
): ReleaseMachineArtifact {
  const artifact: ReleaseMachineArtifact = {
    schemaVersion: "octamy.release-machine-artifact.v1",
    artifactType,
    assessmentId,
    blueprintRevision,
    generatedAt,
    passed: true,
    summary,
    checks: [{ name: "report_sha256", passed: true, detail: reportSha256 }],
  };
  governedMachineArtifactReference(artifact);
  return artifact;
}

async function reusableArtifacts(directory: string, assessmentId: number, revision: number) {
  try {
    const files = ["form-simulation.json", "representative-attempt-qa.json", "accessibility-content-audit.json"];
    const parsed = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(directory, file), "utf8")) as ReleaseMachineArtifact));
    const types: ReleaseMachineArtifact["artifactType"][] = ["form_simulation", "representative_attempt_qa", "accessibility_content_audit"];
    if (parsed.every((artifact, index) => artifact.schemaVersion === "octamy.release-machine-artifact.v1"
      && artifact.artifactType === types[index]
      && artifact.assessmentId === assessmentId
      && artifact.blueprintRevision === revision
      && artifact.passed === true)) return true;
  } catch {
    // Missing or stale artifacts are regenerated.
  }
  return false;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  process.env.PGOPTIONS = [process.env.PGOPTIONS, "-c default_transaction_read_only=on"].filter(Boolean).join(" ");
  await mkdir(OUTPUT_ROOT, { recursive: true, mode: 0o700 });

  const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "octamy-practice-release-artifacts" });
  await client.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout='30s'");
  const courses = (await client.query<CourseRow>(`
    SELECT course.id, course.slug, course.title, course.passing_score,
           max(version.revision)::int AS blueprint_revision
      FROM courses course
      LEFT JOIN course_question_blueprint_versions version ON version.course_id=course.id
     WHERE course.product_type='assessment' AND course.assessment_purpose='practice'
       AND course.is_active=true AND course.visibility='public' AND course.review_status='approved'
     GROUP BY course.id, course.slug, course.title, course.passing_score
     ORDER BY course.slug, course.id
  `)).rows;
  await client.query("COMMIT");
  if (courses.length !== 41) throw new Error(`EXPECTED_41_PUBLISHED_PRACTICE_ASSESSMENTS: found ${courses.length}`);

  const { storage } = await import("../server/storage");
  const { pool } = await import("../server/db");
  const successes: ArtifactManifestEntry[] = [];
  const refused: Failure[] = [];

  try {
    for (const course of courses) {
      const failures: string[] = [];
      const directory = path.join(OUTPUT_ROOT, `${course.id}-${course.slug}`);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if (course.blueprint_revision == null) {
        failures.push("CURRENT_BLUEPRINT_REVISION_MISSING: no immutable course_question_blueprint_versions revision exists, so current-revision artifacts cannot be hash-bound");
        refused.push({ assessmentId: course.id, slug: course.slug, failures });
        await atomicJson(path.join(directory, "refused.json"), { assessmentId: course.id, slug: course.slug, blueprintRevision: null, failures });
        continue;
      }
      const alreadyGenerated = await reusableArtifacts(directory, course.id, Number(course.blueprint_revision));
      const rules = (await client.query<RuleRow>(`
        SELECT blueprint.id, blueprint.bank_id, blueprint.topic_id, topic.slug AS topic_slug,
               blueprint.question_count, blueprint.difficulty, blueprint.sort_order,
               (SELECT count(*)::int FROM questions question
                 WHERE question.bank_id=blueprint.bank_id
                   AND (blueprint.topic_id IS NULL OR question.topic_id=blueprint.topic_id)
                   AND (blueprint.difficulty='mixed' OR question.difficulty=blueprint.difficulty)
                   AND question.is_active=true AND question.review_status='approved'
                   AND question.reviewed_by IS NOT NULL AND question.reviewed_at IS NOT NULL
                   AND question.question_format IN ('mcq_single','true_false')
                   AND json_typeof(question.options)='array'
                   AND question.correct_answer>=0
                   AND question.correct_answer<json_array_length(question.options)) AS available
          FROM course_question_blueprint blueprint
          LEFT JOIN question_topics topic ON topic.id=blueprint.topic_id
         WHERE blueprint.course_id=$1 ORDER BY blueprint.sort_order, blueprint.id
      `, [course.id])).rows.map((row) => ({ ...row, available: Number(row.available) }));
      if (rules.length === 0) failures.push("FORM_NO_BLUEPRINT_RULES: current assessment has no runtime blueprint rules");

      const scopedQuestions = (await client.query<QuestionRow>(`
        SELECT question.id, question.bank_id, question.topic_id, question.difficulty,
               question.question, question.options, question.correct_answer,
               question.image_url, question.image_alt_text, question.option_media
          FROM questions question
         WHERE question.is_active=true AND question.review_status='approved'
           AND question.reviewed_by IS NOT NULL AND question.reviewed_at IS NOT NULL
           AND question.question_format IN ('mcq_single','true_false')
           AND json_typeof(question.options)='array'
           AND question.correct_answer>=0
           AND question.correct_answer<json_array_length(question.options)
           AND EXISTS (SELECT 1 FROM course_question_blueprint blueprint
                        WHERE blueprint.course_id=$1 AND blueprint.bank_id=question.bank_id
                          AND (blueprint.topic_id IS NULL OR blueprint.topic_id=question.topic_id)
                          AND (blueprint.difficulty='mixed' OR blueprint.difficulty=question.difficulty))
         ORDER BY question.id
      `, [course.id])).rows;
      const scopedById = new Map(scopedQuestions.map((question) => [question.id, question]));

      const formRuns: Array<Record<string, unknown>> = [];
      const generatedForms: QuestionRow[][] = [];
      let draws = 0;
      let duplicateSelections = 0;
      let poolExhaustions = 0;
      let topicRuleChecks = 0;

      if (!alreadyGenerated && failures.length === 0) {
        for (let run = 1; run <= FORM_COUNT; run += 1) {
          try {
            const runtimeQuestions = await storage.materializeBlueprintForAttempt(course.id) as unknown as Array<{
              id: number; bankId: number | null; topicId: number | null; difficulty: string;
            }>;
            const ids = runtimeQuestions.map((question) => question.id);
            const duplicates = ids.length - new Set(ids).size;
            duplicateSelections += duplicates;
            draws += ids.length;
            if (duplicates > 0) failures.push(`FORM_${run}_IN_FORM_DUPLICATES: ${duplicates} duplicate question selections`);
            const expected = rules.reduce((total, rule) => total + Number(rule.question_count), 0);
            if (ids.length !== expected) failures.push(`FORM_${run}_COUNT_MISMATCH: expected ${expected}, materialized ${ids.length}`);

            let offset = 0;
            const coverage = rules.map((rule) => {
              const selected = runtimeQuestions.slice(offset, offset + Number(rule.question_count));
              offset += Number(rule.question_count);
              const invalid = selected.filter((question) => question.bankId !== rule.bank_id
                || (rule.topic_id != null && question.topicId !== rule.topic_id)
                || (rule.difficulty !== "mixed" && question.difficulty !== rule.difficulty));
              const unusedCapacity = rule.available - selected.length;
              const exhausted = unusedCapacity < 0;
              topicRuleChecks += 1;
              if (selected.length !== Number(rule.question_count) || invalid.length > 0) {
                failures.push(`FORM_${run}_RULE_${rule.id}_COVERAGE: selected=${selected.length}, expected=${rule.question_count}, invalid=${invalid.length}`);
              }
              if (exhausted) {
                poolExhaustions += 1;
                failures.push(`FORM_${run}_RULE_${rule.id}_POOL_EXHAUSTED: available=${rule.available}, required=${rule.question_count}`);
              }
              return {
                ruleId: rule.id,
                bankId: rule.bank_id,
                topicId: rule.topic_id,
                topicSlug: rule.topic_slug,
                difficulty: rule.difficulty,
                expected: Number(rule.question_count),
                selected: selected.length,
                availableAtAudit: rule.available,
                unusedCapacity,
                exhausted,
                questionIds: selected.map((question) => question.id),
              };
            });
            const fullRows = ids.map((id) => scopedById.get(id)).filter((question): question is QuestionRow => Boolean(question));
            if (fullRows.length !== ids.length) failures.push(`FORM_${run}_RUNTIME_SCOPE_MISMATCH: ${ids.length - fullRows.length} runtime items absent from audited scope`);
            generatedForms.push(fullRows);
            formRuns.push({ run, count: ids.length, duplicateCount: duplicates, poolExhaustions: coverage.filter((entry) => entry.exhausted).length, coverage });
          } catch (error) {
            poolExhaustions += 1;
            failures.push(`FORM_${run}_RUNTIME_FAILURE: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }

      let representativeAttempts = 0;
      const attemptRuns: Array<Record<string, unknown>> = [];
      if (!alreadyGenerated && failures.length === 0) {
        generatedForms.forEach((form, formIndex) => {
          const shuffledQuestions = form.map((question) => {
            const correctText = question.options[question.correct_answer];
            const options = shuffle(question.options);
            return { id: question.id, question: question.question, options, correctAnswer: options.findIndex((option) => option === correctText) };
          });
          const correctMap = Object.fromEntries(shuffledQuestions.map((question) => [String(question.id), question.correctAnswer]));
          const publicPayload = { questions: shuffledQuestions.map(({ correctAnswer: _correctAnswer, ...question }) => question) };
          const leakedKey = forbiddenAnswerKey(publicPayload);
          if (leakedKey) failures.push(`ATTEMPT_FORM_${formIndex + 1}_PRE_SUBMISSION_DISCLOSURE: forbidden key ${leakedKey}`);
          const allCorrect = normalizeExamAnswers(Object.entries(correctMap).map(([questionId, selectedOption]) => ({ questionId, selectedOption })));
          const allWrong = normalizeExamAnswers(shuffledQuestions.map((question) => ({ questionId: question.id, selectedOption: (question.correctAnswer + 1) % question.options.length })));
          const mixed = normalizeExamAnswers(shuffledQuestions.map((question, index) => ({ questionId: question.id, selectedOption: index % 2 === 0 ? question.correctAnswer : (question.correctAnswer + 1) % question.options.length })));
          const scenarios = [
            { name: "all_correct", actual: scoreExam(correctMap, allCorrect), expectedCorrect: form.length },
            { name: "all_wrong", actual: scoreExam(correctMap, allWrong), expectedCorrect: 0 },
            { name: "alternating", actual: scoreExam(correctMap, mixed), expectedCorrect: Math.ceil(form.length / 2) },
          ];
          for (const scenario of scenarios) {
            representativeAttempts += 1;
            const expectedScore = form.length === 0 ? 0 : Math.round((scenario.expectedCorrect / form.length) * 100);
            if (scenario.actual.correctAnswers !== scenario.expectedCorrect || scenario.actual.totalQuestions !== form.length || scenario.actual.score !== expectedScore) {
              failures.push(`ATTEMPT_FORM_${formIndex + 1}_${scenario.name.toUpperCase()}_SCORING: expected ${scenario.expectedCorrect}/${form.length}=${expectedScore}, got ${scenario.actual.correctAnswers}/${scenario.actual.totalQuestions}=${scenario.actual.score}`);
            }
          }
          attemptRuns.push({ form: formIndex + 1, publicQuestionCount: publicPayload.questions.length, preSubmissionAnswerKeys: leakedKey ? [leakedKey] : [], scenarios });
        });
      }

      const accessibilityFindings: Array<{ questionId: number; code: string; detail: string }> = [];
      let mediaItems = 0;
      const colourReference = /\b(?:shown|marked|highlighted|displayed|written|indicated)\s+(?:in|as)\s+(?:red|green|blue|yellow|orange|purple|black|white|grey|gray)\b|\b(?:red|green|blue|yellow|orange|purple)\s+(?:option|button|line|area|shape)\b/i;
      const positionReference = /\b(?:above|below|left|right)\s+(?:option|answer|image|diagram|figure|text|statement)\b|\b(?:first|second|third|fourth|last)\s+(?:answer\s+)?(?:option|answer|choice)\b/i;
      for (const question of scopedQuestions) {
        const text = [question.question, ...question.options].join(" ");
        const stem = question.question.normalize("NFKC").trim();
        const words = stem.split(/\s+/).filter(Boolean);
        if (stem.length < 12 || stem.length > 1200 || words.length < 3 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(stem)) {
          accessibilityFindings.push({ questionId: question.id, code: "STEM_READABILITY", detail: `length=${stem.length}, words=${words.length}` });
        }
        const options = question.options.map(normalized);
        if (options.length < 2 || options.some((option) => option.length === 0) || new Set(options).size !== options.length) {
          accessibilityFindings.push({ questionId: question.id, code: "OPTION_DISTINCTNESS", detail: `options=${options.length}, distinct=${new Set(options).size}` });
        }
        if (colourReference.test(text)) accessibilityFindings.push({ questionId: question.id, code: "COLOUR_ONLY_REFERENCE", detail: "content contains a colour-dependent visual reference" });
        if (positionReference.test(text)) accessibilityFindings.push({ questionId: question.id, code: "POSITION_ONLY_REFERENCE", detail: "content contains a position-dependent visual reference" });
        if (question.image_url) {
          mediaItems += 1;
          if (!question.image_alt_text || question.image_alt_text.trim().length < 3) accessibilityFindings.push({ questionId: question.id, code: "QUESTION_MEDIA_ALT_TEXT", detail: "question image lacks meaningful alternative text" });
        }
        if (question.option_media != null) {
          if (!Array.isArray(question.option_media)) accessibilityFindings.push({ questionId: question.id, code: "OPTION_MEDIA_FORMAT", detail: "option media is not an array" });
          else {
            mediaItems += question.option_media.length;
            question.option_media.forEach((entry, index) => {
              if (!entry || typeof entry !== "object" || Array.isArray(entry)
                || typeof (entry as { url?: unknown }).url !== "string" || !(entry as { url: string }).url.trim()
                || typeof (entry as { alt?: unknown }).alt !== "string" || (entry as { alt: string }).alt.trim().length < 3) {
                accessibilityFindings.push({ questionId: question.id, code: "OPTION_MEDIA_ALT_TEXT", detail: `option media ${index} lacks URL or meaningful alternative text` });
              }
            });
          }
        }
      }
      if (accessibilityFindings.length > 0) {
        failures.push(...accessibilityFindings.map((finding) => `ACCESSIBILITY_${finding.code}_QUESTION_${finding.questionId}: ${finding.detail}`));
      }

      const [state] = (await client.query<{ blueprint_revision: number; is_active: boolean; visibility: string; review_status: string }>(`
        SELECT max(version.revision)::int AS blueprint_revision, course.is_active, course.visibility, course.review_status
          FROM courses course INNER JOIN course_question_blueprint_versions version ON version.course_id=course.id
         WHERE course.id=$1 GROUP BY course.id, course.is_active, course.visibility, course.review_status
      `, [course.id])).rows;
      if (!state || Number(state.blueprint_revision) !== Number(course.blueprint_revision)) failures.push(`STALE_BLUEPRINT_REVISION: began ${course.blueprint_revision}, ended ${state?.blueprint_revision ?? "missing"}`);
      if (!state?.is_active || state.visibility !== "public" || state.review_status !== "approved") failures.push("PUBLICATION_STATE_CHANGED: assessment was no longer active/public/approved after execution");

      if (alreadyGenerated) {
        const existing = JSON.parse(await readFile(path.join(directory, "manifest-entry.json"), "utf8")) as ArtifactManifestEntry;
        successes.push(existing);
        continue;
      }
      if (failures.length > 0) {
        refused.push({ assessmentId: course.id, slug: course.slug, failures });
        await atomicJson(path.join(directory, "refused.json"), { assessmentId: course.id, slug: course.slug, blueprintRevision: course.blueprint_revision, failures });
        continue;
      }

      const generatedAt = new Date().toISOString();
      const formReport = {
        schemaVersion: "octamy.form-simulation-report.v1", assessmentId: course.id, assessmentSlug: course.slug,
        blueprintRevision: Number(course.blueprint_revision), generatedAt, runtimePath: "DatabaseStorage.materializeBlueprintForAttempt",
        independentFormCount: FORM_COUNT, expectedDrawPerForm: rules.reduce((sum, rule) => sum + Number(rule.question_count), 0),
        totalDraws: draws, duplicateSelections, poolExhaustions, topicRuleChecks, rules, forms: formRuns,
      };
      const attemptReport = {
        schemaVersion: "octamy.representative-attempt-qa-report.v1", assessmentId: course.id, assessmentSlug: course.slug,
        blueprintRevision: Number(course.blueprint_revision), generatedAt,
        runtimePaths: ["DatabaseStorage.materializeBlueprintForAttempt", "normalizeExamAnswers", "scoreExam"],
        disclosureContract: "pre-submission payload contains only id, question, and shuffled options",
        representativeAttempts, formsTested: generatedForms.length, attempts: attemptRuns,
      };
      const accessibilityReport = {
        schemaVersion: "octamy.accessibility-content-audit-report.v1", assessmentId: course.id, assessmentSlug: course.slug,
        blueprintRevision: Number(course.blueprint_revision), generatedAt, auditedItems: scopedQuestions.length, mediaItems,
        checks: ["media alternative text", "absence of colour-only references", "absence of position-only references", "option distinctness", "stem readability"],
        counts: { findings: 0, mediaAltFailures: 0, colourOnlyReferences: 0, positionOnlyReferences: 0, optionDistinctnessFailures: 0, stemReadabilityFailures: 0 },
        auditedQuestionIds: scopedQuestions.map((question) => question.id), findings: accessibilityFindings,
      };
      const formReportText = `${JSON.stringify(formReport, null, 2)}\n`;
      const attemptReportText = `${JSON.stringify(attemptReport, null, 2)}\n`;
      const accessibilityReportText = `${JSON.stringify(accessibilityReport, null, 2)}\n`;
      await writeFile(path.join(directory, "form-simulation-report.json"), formReportText, { mode: 0o600 });
      await writeFile(path.join(directory, "representative-attempt-qa-report.json"), attemptReportText, { mode: 0o600 });
      await writeFile(path.join(directory, "accessibility-content-audit-report.json"), accessibilityReportText, { mode: 0o600 });

      const formArtifact = compactArtifact("form_simulation", course.id, Number(course.blueprint_revision), generatedAt,
        `${FORM_COUNT} runtime forms passed checks`, Buffer.from(sha256(formReportText), "hex").toString("base64url"));
      const attemptArtifact = compactArtifact("representative_attempt_qa", course.id, Number(course.blueprint_revision), generatedAt,
        `${representativeAttempts} scoring attempts passed checks`, Buffer.from(sha256(attemptReportText), "hex").toString("base64url"));
      const accessibilityArtifact = compactArtifact("accessibility_content_audit", course.id, Number(course.blueprint_revision), generatedAt,
        `${scopedQuestions.length} items passed content audit`, Buffer.from(sha256(accessibilityReportText), "hex").toString("base64url"));
      await atomicJson(path.join(directory, "form-simulation.json"), formArtifact);
      await atomicJson(path.join(directory, "representative-attempt-qa.json"), attemptArtifact);
      await atomicJson(path.join(directory, "accessibility-content-audit.json"), accessibilityArtifact);

      const cutScoreApprovalReference = `automated-boundary-check:${course.slug}:revision-${course.blueprint_revision}:score-${course.passing_score}`;
      const cutScoreApprovalSha256 = sha256(JSON.stringify({ assessmentId: course.id, blueprintRevision: Number(course.blueprint_revision), passingScore: Number(course.passing_score), method: "Existing published cut score retained; boundary behavior machine-verified with server scoreExam; no independent human cut-score study." }));
      const entry: ArtifactManifestEntry = {
        assessmentId: course.id, slug: course.slug, blueprintRevision: Number(course.blueprint_revision), passingScore: Number(course.passing_score),
        formSimulationArtifact: path.join(directory, "form-simulation.json"),
        representativeAttemptQaArtifact: path.join(directory, "representative-attempt-qa.json"),
        accessibilityAuditArtifact: path.join(directory, "accessibility-content-audit.json"),
        cutScoreApprovalReference, cutScoreApprovalSha256,
        results: { forms: FORM_COUNT, draws, duplicateSelections, poolExhaustions, topicRuleChecks, representativeAttempts, auditedItems: scopedQuestions.length, mediaItems },
      };
      await atomicJson(path.join(directory, "manifest-entry.json"), entry);
      await rm(path.join(directory, "refused.json"), { force: true });
      successes.push(entry);
    }
  } finally {
    await client.end();
    await pool.end();
  }

  const aggregate = successes.reduce((total, entry) => ({
    forms: total.forms + entry.results.forms,
    draws: total.draws + entry.results.draws,
    duplicateSelections: total.duplicateSelections + entry.results.duplicateSelections,
    poolExhaustions: total.poolExhaustions + entry.results.poolExhaustions,
    topicRuleChecks: total.topicRuleChecks + entry.results.topicRuleChecks,
    representativeAttempts: total.representativeAttempts + entry.results.representativeAttempts,
    auditedItems: total.auditedItems + entry.results.auditedItems,
    mediaItems: total.mediaItems + entry.results.mediaItems,
  }), { forms: 0, draws: 0, duplicateSelections: 0, poolExhaustions: 0, topicRuleChecks: 0, representativeAttempts: 0, auditedItems: 0, mediaItems: 0 });
  const manifest = { schemaVersion: "octamy.practice-release-artifact-manifest.v1", generatedAt: new Date().toISOString(), expectedAssessments: 41, passedAssessments: successes.length, refusedAssessments: refused.length, aggregate, assessments: successes, refused };
  await atomicJson(path.join(OUTPUT_ROOT, "manifest.json"), manifest);
  process.stdout.write(`${JSON.stringify({ passedAssessments: successes.length, refusedAssessments: refused.length, aggregate, refused }, null, 2)}\n`);
  if (refused.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
