import {
  evaluateAssessmentPublishReadiness,
  type AssessmentPurpose,
  type AssessmentPublishReadiness,
} from "./assessment-bank-readiness";
import { isIndependentQuestionReviewer } from "./question-review-policy";

export type AssessmentReleaseEvidence = {
  syllabusVersion: string;
  objectiveCode: string;
  answerValidation: {
    status: "verified";
    method: "authoritative_reference" | "primary_source" | "independent_calculation";
    reference: string;
  };
  distractorReview: {
    status: "verified";
    note: string;
  };
  reviewAttestation?: {
    status: "attested";
    note: string;
    contentHash: string;
    contentVersion: number;
    decisionVersion: number;
    reviewerId: number;
  };
};

export type AssessmentAcceptanceQuestion = {
  id: number | string;
  bankId: number;
  topicId: number | null;
  question: string;
  questionFormat: string;
  options: unknown;
  correctAnswer: number;
  difficulty: string;
  explanation: string | null;
  generationSource: string;
  reviewStatus: string;
  isActive: boolean;
  createdBy: number | null;
  reviewedBy: number | null;
  reviewedAt: Date | string | null;
  version?: number;
  contentHash?: string | null;
  answerMetadata?: unknown;
  releaseEvidence?: AssessmentReleaseEvidence | null;
};

export type AssessmentAcceptanceRule = {
  bankId: number;
  topicId: number | null;
  questionCount: number;
  difficulty: string;
  /** Optional release quota for a mixed-difficulty rule. */
  difficultyTargets?: Partial<Record<"easy" | "medium" | "hard", number>>;
};

export type AssessmentAcceptanceIssue = {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  questionId?: number | string;
  bankId?: number;
};

export type AssessmentAcceptanceReport = {
  assessmentSlug: string;
  releasable: boolean;
  questionCount: number;
  acceptedQuestionCount: number;
  readiness: AssessmentPublishReadiness;
  issues: AssessmentAcceptanceIssue[];
  evidence: {
    syllabusVersions: string[];
    objectiveCodes: string[];
    authorIds: number[];
    reviewerIds: number[];
  };
};

const PLACEHOLDER_PATTERNS = [
  /\b(?:placeholder|lorem ipsum|todo|tbd)\b/i,
  /\bq(?:uestion)?\s*\d+\b.*\b(?:level|difficulty)\b/i,
  /\b(?:primary purpose|best demonstrates|strongest signal) of [a-z]+ in modern applications\b/i,
  /\(\s*(?:novice|intermediate|advanced|expert)\s+level\s*[-–—]\s*q\d+\s*\)/i,
];

const ANSWER_VALIDATION_METHODS = new Set<AssessmentReleaseEvidence["answerValidation"]["method"]>([
  "authoritative_reference",
  "primary_source",
  "independent_calculation",
]);

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validTrimmedString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string"
    && value === value.trim()
    && value.length >= min
    && value.length <= max;
}

export function assessmentReleaseEvidenceFromMetadata(value: unknown): AssessmentReleaseEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).releaseEvidence;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, any>;
  const allowedTopLevelKeys = record.reviewAttestation
    ? ["syllabusVersion", "objectiveCode", "answerValidation", "distractorReview", "reviewAttestation"]
    : ["syllabusVersion", "objectiveCode", "answerValidation", "distractorReview"];
  if (!hasExactKeys(record, allowedTopLevelKeys)
    || !record.answerValidation || typeof record.answerValidation !== "object" || Array.isArray(record.answerValidation)
    || !hasExactKeys(record.answerValidation, ["status", "method", "reference"])
    || !record.distractorReview || typeof record.distractorReview !== "object" || Array.isArray(record.distractorReview)
    || !hasExactKeys(record.distractorReview, ["status", "note"])) return null;
  const method = record.answerValidation?.method;
  if (!validTrimmedString(record.syllabusVersion, 3, 160)
    || !validTrimmedString(record.objectiveCode, 2, 160)
    || record.answerValidation?.status !== "verified"
    || !ANSWER_VALIDATION_METHODS.has(method)
    || !validTrimmedString(record.answerValidation?.reference, 8, 2_000)
    || record.distractorReview?.status !== "verified"
    || !validTrimmedString(record.distractorReview?.note, 10, 2_000)) return null;
  if (record.reviewAttestation) {
    const attestation = record.reviewAttestation;
    if (typeof attestation !== "object" || Array.isArray(attestation)
      || !hasExactKeys(attestation, ["status", "note", "contentHash", "contentVersion", "decisionVersion", "reviewerId"])
      || attestation.status !== "attested"
      || !validTrimmedString(attestation.note, 20, 2_000)
      || typeof attestation.contentHash !== "string"
      || !/^[0-9a-f]{64}$/.test(attestation.contentHash)
      || !Number.isInteger(attestation.contentVersion) || attestation.contentVersion < 1
      || !Number.isInteger(attestation.decisionVersion) || attestation.decisionVersion !== attestation.contentVersion + 1
      || !Number.isInteger(attestation.reviewerId) || attestation.reviewerId < 1) return null;
  }
  return record as AssessmentReleaseEvidence;
}

export function assessmentReleaseEvidenceFromCsvRow(raw: Record<string, unknown>):
  | { ok: true; evidence: AssessmentReleaseEvidence | null }
  | { ok: false; error: string } {
  const fields = {
    syllabusVersion: String(raw.syllabusVersion ?? "").trim(),
    objectiveCode: String(raw.objectiveCode ?? "").trim(),
    answerValidationMethod: String(raw.answerValidationMethod ?? "").trim(),
    answerValidationReference: String(raw.answerValidationReference ?? "").trim(),
    distractorReviewNote: String(raw.distractorReviewNote ?? "").trim(),
  };
  if (Object.values(fields).every((value) => !value)) return { ok: true, evidence: null };
  if (fields.syllabusVersion.length < 3 || fields.syllabusVersion.length > 160) {
    return { ok: false, error: "syllabusVersion must be 3–160 characters" };
  }
  if (fields.objectiveCode.length < 2 || fields.objectiveCode.length > 160) {
    return { ok: false, error: "objectiveCode must be 2–160 characters" };
  }
  if (!ANSWER_VALIDATION_METHODS.has(fields.answerValidationMethod as AssessmentReleaseEvidence["answerValidation"]["method"])) {
    return { ok: false, error: "answerValidationMethod must be authoritative_reference, primary_source, or independent_calculation" };
  }
  if (fields.answerValidationReference.length < 8 || fields.answerValidationReference.length > 2_000) {
    return { ok: false, error: "answerValidationReference must be 8–2000 characters" };
  }
  if (fields.distractorReviewNote.length < 10 || fields.distractorReviewNote.length > 2_000) {
    return { ok: false, error: "distractorReviewNote must be 10–2000 characters" };
  }
  return {
    ok: true,
    evidence: {
      syllabusVersion: fields.syllabusVersion,
      objectiveCode: fields.objectiveCode,
      answerValidation: {
        status: "verified",
        method: fields.answerValidationMethod as AssessmentReleaseEvidence["answerValidation"]["method"],
        reference: fields.answerValidationReference,
      },
      distractorReview: {
        status: "verified",
        note: fields.distractorReviewNote,
      },
    },
  };
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

/** Detects mass numeric/name substitution while preserving exact-text checks separately. */
function semanticTemplateKey(value: string): string {
  return normalizedText(value)
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b\d+(?:[.,]\d+)?%?\b/g, "<n>")
    .replace(/[“”"'][^“”"']{1,80}[“”"']/g, "<value>");
}

function scopedByRule(question: AssessmentAcceptanceQuestion, rule: AssessmentAcceptanceRule): boolean {
  return question.bankId === rule.bankId
    && (rule.topicId == null || question.topicId === rule.topicId)
    && (rule.difficulty === "mixed" || question.difficulty === rule.difficulty);
}

function evidenceIssues(question: AssessmentAcceptanceQuestion): AssessmentAcceptanceIssue[] {
  const issues: AssessmentAcceptanceIssue[] = [];
  const add = (code: string, message: string) => issues.push({
    severity: "blocker",
    code,
    message,
    questionId: question.id,
    bankId: question.bankId,
  });
  const stem = question.question.trim();
  const options = Array.isArray(question.options)
    ? question.options.map((option) => String(option).trim())
    : [];
  const normalizedOptions = options.map(normalizedText);

  if (!question.topicId) add("TOPIC_REQUIRED", "Map the question to a syllabus competency topic.");
  if (stem.length < 20 || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(stem))) {
    add("PLACEHOLDER_OR_WEAK_STEM", "Replace the placeholder or incomplete stem with an assessment-specific question.");
  }
  if (!["mcq_single", "true_false"].includes(question.questionFormat)) {
    add("UNSUPPORTED_LIVE_FORMAT", "Only single-answer MCQ and true/false items are currently release-safe.");
  }
  const minimumOptions = question.questionFormat === "true_false" ? 2 : 3;
  if (options.length < minimumOptions || options.some((option) => !option)) {
    add("OPTIONS_INCOMPLETE", `Provide at least ${minimumOptions} complete answer options.`);
  }
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    add("DUPLICATE_OPTIONS", "Answer options must be meaningfully distinct.");
  }
  if (!Number.isInteger(question.correctAnswer)
    || question.correctAnswer < 0
    || question.correctAnswer >= options.length) {
    add("ANSWER_KEY_INVALID", "The answer key does not identify an available option.");
  }
  if (!question.explanation || question.explanation.trim().length < 30) {
    add("EXPLANATION_REQUIRED", "Provide a worked or reasoned explanation of at least 30 characters.");
  }
  if (!isIndependentQuestionReviewer(question.createdBy, question.reviewedBy)) {
    add("INDEPENDENT_REVIEW_REQUIRED", "Record distinct attributable author and reviewer identities.");
  }
  if (question.reviewStatus !== "approved" || !question.isActive || !question.reviewedAt) {
    add("APPROVAL_EVIDENCE_REQUIRED", "The latest version needs an active, timestamped approval.");
  }

  const evidence = question.releaseEvidence
    ?? assessmentReleaseEvidenceFromMetadata(question.answerMetadata);
  if (!evidence?.syllabusVersion.trim() || !evidence.objectiveCode.trim()) {
    add("SYLLABUS_EVIDENCE_REQUIRED", "Record the syllabus version and objective code for this item.");
  }
  if (evidence?.answerValidation.status !== "verified"
    || evidence.answerValidation.reference.trim().length < 8) {
    add("FACTUAL_ANSWER_VALIDATION_REQUIRED", "Record how the keyed answer was independently verified and cite the evidence.");
  }
  if (question.questionFormat === "mcq_single"
    && (evidence?.distractorReview.status !== "verified"
      || evidence.distractorReview.note.trim().length < 10)) {
    add("DISTRACTOR_REVIEW_REQUIRED", "Confirm that distractors are plausible, unambiguous, and not alternate correct answers.");
  }
  const attestation = evidence?.reviewAttestation;
  if (!attestation
    || attestation.reviewerId !== question.reviewedBy
    || attestation.contentHash !== question.contentHash
    || attestation.decisionVersion !== question.version) {
    add(
      "ITEM_REVIEW_ATTESTATION_REQUIRED",
      "Record an item-specific reviewer attestation tied to this exact content hash and version.",
    );
  }
  return issues;
}

export function evaluateAssessmentContentAcceptance(input: {
  assessmentSlug: string;
  purpose: AssessmentPurpose;
  syllabusVersion: string;
  useBlueprintEngine: boolean;
  rules: AssessmentAcceptanceRule[];
  questions: AssessmentAcceptanceQuestion[];
}): AssessmentAcceptanceReport {
  const issues: AssessmentAcceptanceIssue[] = [];
  if (input.syllabusVersion.trim().length < 3) {
    issues.push({
      severity: "blocker",
      code: "ASSESSMENT_SYLLABUS_VERSION_REQUIRED",
      message: "Assign one explicit syllabus version to every bank in this assessment blueprint.",
    });
  }
  const questionBlockers = new Set<number | string>();
  for (const question of input.questions) {
    const found = evidenceIssues(question);
    found.forEach((issue) => issues.push(issue));
    if (found.some((issue) => issue.severity === "blocker")) questionBlockers.add(question.id);
    const evidence = question.releaseEvidence
      ?? assessmentReleaseEvidenceFromMetadata(question.answerMetadata);
    if (evidence?.syllabusVersion !== input.syllabusVersion) {
      issues.push({
        severity: "blocker",
        code: "SYLLABUS_VERSION_MISMATCH",
        message: `Question evidence must match assessment syllabus ${input.syllabusVersion}.`,
        questionId: question.id,
        bankId: question.bankId,
      });
      questionBlockers.add(question.id);
    }
  }

  const exactGroups = new Map<string, AssessmentAcceptanceQuestion[]>();
  const templateGroups = new Map<string, AssessmentAcceptanceQuestion[]>();
  for (const question of input.questions) {
    const exact = normalizedText(question.question);
    exactGroups.set(exact, [...(exactGroups.get(exact) ?? []), question]);
    const template = semanticTemplateKey(question.question);
    templateGroups.set(template, [...(templateGroups.get(template) ?? []), question]);
  }
  for (const group of Array.from(exactGroups.values())) {
    if (group.length < 2) continue;
    issues.push({
      severity: "blocker",
      code: "DUPLICATE_QUESTION",
      message: `${group.length} questions have the same normalized stem. Keep one independently reviewed item.`,
      questionId: group[0].id,
      bankId: group[0].bankId,
    });
  }
  for (const group of Array.from(templateGroups.values())) {
    if (group.length < 5 || group.length / Math.max(1, input.questions.length) <= 0.1) continue;
    issues.push({
      severity: "blocker",
      code: "SEMANTIC_TEMPLATE_CONCENTRATION",
      message: `${group.length} questions share one substitution template (>10% of the assessment pool). Replace them with conceptually varied items.`,
      questionId: group[0].id,
      bankId: group[0].bankId,
    });
  }

  const keyedMcq = input.questions.filter((question) => question.questionFormat === "mcq_single"
    && Number.isInteger(question.correctAnswer));
  if (keyedMcq.length >= 20) {
    const positions = new Map<number, number>();
    keyedMcq.forEach((question) => positions.set(
      question.correctAnswer,
      (positions.get(question.correctAnswer) ?? 0) + 1,
    ));
    const largestPositionCount = Math.max(...Array.from(positions.values()));
    if (largestPositionCount / keyedMcq.length > 0.5) {
      issues.push({
        severity: "blocker",
        code: "ANSWER_POSITION_CONCENTRATION",
        message: `${largestPositionCount} of ${keyedMcq.length} MCQs use the same answer position (>50%), creating an exploitable response pattern.`,
      });
    }
  }

  const accepted = input.questions.filter((question) => !questionBlockers.has(question.id));
  const readiness = evaluateAssessmentPublishReadiness({
    purpose: input.purpose,
    useBlueprintEngine: input.useBlueprintEngine,
    approvedInventory: accepted.length,
    rules: input.rules.map((rule) => ({
      ...rule,
      approvedInventory: accepted.filter((question) => scopedByRule(question, rule)).length,
    })),
  });
  readiness.issues.forEach((issue) => issues.push({
    severity: "blocker",
    code: issue.code,
    message: issue.message,
    bankId: "bankId" in issue ? issue.bankId : undefined,
  }));

  for (const rule of input.rules) {
    if (!rule.difficultyTargets) continue;
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const required = Math.max(0, Math.trunc(rule.difficultyTargets[difficulty] ?? 0));
      const available = accepted.filter((question) => scopedByRule(question, rule)
        && question.difficulty === difficulty).length;
      if (available < required) {
        issues.push({
          severity: "blocker",
          code: "DIFFICULTY_QUOTA_INCOMPLETE",
          message: `Bank ${rule.bankId} needs ${required} accepted ${difficulty} questions; ${available} are ready.`,
          bankId: rule.bankId,
        });
      }
    }
  }

  const syllabusVersions = new Set<string>();
  const objectiveCodes = new Set<string>();
  const authorIds = new Set<number>();
  const reviewerIds = new Set<number>();
  accepted.forEach((question) => {
    const evidence = question.releaseEvidence
      ?? assessmentReleaseEvidenceFromMetadata(question.answerMetadata);
    if (evidence?.syllabusVersion) syllabusVersions.add(evidence.syllabusVersion);
    if (evidence?.objectiveCode) objectiveCodes.add(evidence.objectiveCode);
    if (question.createdBy != null) authorIds.add(question.createdBy);
    if (question.reviewedBy != null) reviewerIds.add(question.reviewedBy);
  });

  return {
    assessmentSlug: input.assessmentSlug,
    releasable: issues.every((issue) => issue.severity !== "blocker"),
    questionCount: input.questions.length,
    acceptedQuestionCount: accepted.length,
    readiness,
    issues,
    evidence: {
      syllabusVersions: Array.from(syllabusVersions).sort(),
      objectiveCodes: Array.from(objectiveCodes).sort(),
      authorIds: Array.from(authorIds).sort((a, b) => a - b),
      reviewerIds: Array.from(reviewerIds).sort((a, b) => a - b),
    },
  };
}
