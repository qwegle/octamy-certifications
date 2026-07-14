import { createHash } from "node:crypto";
import { z } from "zod";

export const QUESTION_PACK_SCHEMA_VERSION = 1 as const;
export const MAX_QUESTION_PACK_ROWS = 100_000;
export const DEFAULT_QUESTION_PACK_BATCH_SIZE = 500;
export const MAX_QUESTION_PACK_BATCH_SIZE = 2_000;
export const MAX_QUESTION_PACK_BYTES = 1024 * 1024 * 1024;
export const MAX_QUESTION_PACK_LINE_BYTES = 256 * 1024;

const httpsUrlSchema = z.string().trim().max(2_048).url().refine(
  (value) => value.startsWith("https://"),
  "Use an HTTPS URL",
);

export type QuestionPackMetadataValue =
  | string
  | number
  | boolean
  | null
  | QuestionPackMetadataValue[]
  | { [key: string]: QuestionPackMetadataValue };

const metadataScalarSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const metadataValueSchema: z.ZodType<QuestionPackMetadataValue> = z.lazy(() => z.union([
  metadataScalarSchema,
  z.array(metadataValueSchema).max(50),
  z.record(metadataValueSchema),
]));

const forbiddenMetadataKeys = new Set(["__proto__", "constructor", "prototype"]);

const boundedMetadataSchema = z.record(metadataValueSchema).default({}).superRefine((value, ctx) => {
  let nodeCount = 0;
  let keyCount = 0;

  const inspect = (node: QuestionPackMetadataValue, depth: number, path: Array<string | number>) => {
    nodeCount += 1;
    if (nodeCount > 250) return;
    if (depth > 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "Metadata nesting is limited to four levels",
      });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, index) => inspect(child, depth + 1, [...path, index]));
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      keyCount += 1;
      if (!key || key.length > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, key],
          message: "Metadata keys must contain 1-80 characters",
        });
      }
      if (forbiddenMetadataKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, key],
          message: "Unsafe metadata key",
        });
      }
      inspect(child, depth + 1, [...path, key]);
    }
  };

  inspect(value, 0, []);
  if (Object.keys(value).length > 30) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Metadata is limited to 30 top-level fields" });
  }
  if (keyCount > 100 || nodeCount > 250) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Metadata is limited to 100 keys and 250 values" });
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 8_192) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Metadata is limited to 8 KiB" });
  }
});

const rightsBasisSchema = z.enum([
  "owned",
  "contract",
  "permission",
  "open_license",
  "public_domain",
]);

const approvedOpenContentLicenses = new Set([
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "PDM-1.0",
  "ODC-BY-1.0",
  "ODbL-1.0",
]);

export const questionPackManifestSchema = z.object({
  schemaVersion: z.literal(QUESTION_PACK_SCHEMA_VERSION),
  sourceKey: z.string().trim().min(3).max(160).regex(/^[a-z0-9][a-z0-9._:/-]+$/),
  name: z.string().trim().min(3).max(240),
  publisher: z.string().trim().min(2).max(240),
  datasetVersion: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2_000).optional(),
  sourceUrl: httpsUrlSchema,
  retrievedAt: z.string().datetime(),
  license: z.object({
    identifier: z.string().trim().min(3).max(120),
    name: z.string().trim().min(3).max(240),
    url: httpsUrlSchema,
    rightsBasis: rightsBasisSchema,
    commercialUseAllowed: z.literal(true),
    derivativesAllowed: z.literal(true),
    shareAlikeObligation: z.string().trim().min(1).max(1_000),
    attributionText: z.string().trim().min(3).max(2_000),
    evidenceReference: z.string().trim().min(8).max(1_000),
  }).strict(),
  provenance: z.object({
    acquisitionMethod: z.enum([
      "first_party",
      "licensed_delivery",
      "publisher_download",
      "partner_transfer",
    ]),
    originalFormat: z.string().trim().min(2).max(80),
    chainOfTitle: z.string().trim().min(40).max(4_000),
    notes: z.string().trim().max(2_000).optional(),
  }).strict(),
}).strict().superRefine((manifest, ctx) => {
  const identifier = manifest.license.identifier;
  if (/(?:^|[-_.])(?:NC|ND)(?:[-_.]|$)/i.test(identifier)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license", "identifier"],
      message: "Non-commercial and no-derivatives content is not eligible for ingestion",
    });
  }
  if (["open_license", "public_domain"].includes(manifest.license.rightsBasis)
    && !approvedOpenContentLicenses.has(identifier)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license", "identifier"],
      message: "Use an explicitly approved content/data licence identifier",
    });
  }
  if ((identifier === "CC-BY-SA-4.0" || identifier === "ODbL-1.0")
    && manifest.license.shareAlikeObligation.toLowerCase() === "none") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license", "shareAlikeObligation"],
      message: "Declare the applicable share-alike obligation",
    });
  }
  if (/(?:github|repository|repo).{0,30}licen[cs]e|licen[cs]e.{0,30}(?:github|repository|repo)/i
    .test(manifest.license.evidenceReference)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["license", "evidenceReference"],
      message: "A repository licence alone is not chain-of-title for assessment questions",
    });
  }
});

const answerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("single_choice"),
    correctOption: z.number().int().min(0).max(19),
  }).strict(),
  z.object({
    kind: z.literal("multiple_choice"),
    correctOptions: z.array(z.number().int().min(0).max(19)).min(1).max(20),
  }).strict(),
  z.object({
    kind: z.literal("boolean"),
    value: z.boolean(),
  }).strict(),
  z.object({
    kind: z.literal("exact_text"),
    accepted: z.array(z.string().trim().min(1).max(2_000)).min(1).max(20),
    caseSensitive: z.boolean().default(false),
  }).strict(),
  z.object({
    kind: z.literal("numeric"),
    value: z.union([z.number().finite(), z.string().trim().min(1).max(100)]),
    tolerance: z.number().finite().min(0).max(1_000_000).default(0),
    unit: z.string().trim().min(1).max(60).optional(),
  }).strict(),
]);

const questionFormatSchema = z.enum([
  "mcq_single",
  "mcq_multi",
  "true_false",
  "fill_blank",
  "short",
  "long",
  "code",
  "numeric",
]);

const questionOriginSchema = z.enum([
  "original",
  "licensed_verbatim",
  "licensed_adapted",
]);

export const questionPackItemSchema = z.object({
  schemaVersion: z.literal(QUESTION_PACK_SCHEMA_VERSION),
  sourceRecordId: z.string().trim().min(3).max(300).regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]+$/),
  language: z.string().trim().min(2).max(20).regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
  question: z.string().trim().min(5).max(10_000),
  format: questionFormatSchema,
  options: z.array(z.string().trim().min(1).max(2_000)).max(20).default([]),
  answer: answerSchema,
  explanation: z.string().trim().min(10).max(20_000),
  subject: z.string().trim().min(2).max(120),
  topic: z.string().trim().min(2).max(120),
  syllabus: z.string().trim().min(2).max(160).nullable().optional(),
  exam: z.string().trim().min(2).max(160).nullable().optional(),
  examYear: z.number().int().min(1900).max(2100).nullable().optional(),
  objective: z.string().trim().min(3).max(500),
  difficulty: z.enum(["easy", "medium", "hard"]),
  maxPoints: z.number().int().min(1).max(1_000).default(1),
  negativeMarks: z.number().int().min(0).max(1_000).default(0),
  timeLimitSec: z.number().int().min(5).max(86_400).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  provenance: z.object({
    sourceLocator: z.string().trim().min(3).max(1_000),
    questionOrigin: questionOriginSchema,
    answerEvidence: z.string().trim().min(10).max(4_000),
    explanationOrigin: questionOriginSchema,
  }).strict(),
  metadata: boundedMetadataSchema,
}).strict().superRefine((item, ctx) => {
  const expectedKind: Record<z.infer<typeof questionFormatSchema>, z.infer<typeof answerSchema>["kind"]> = {
    mcq_single: "single_choice",
    mcq_multi: "multiple_choice",
    true_false: "boolean",
    fill_blank: "exact_text",
    short: "exact_text",
    long: "exact_text",
    code: "exact_text",
    numeric: "numeric",
  };
  if (item.answer.kind !== expectedKind[item.format]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["answer", "kind"],
      message: `${item.format} requires a ${expectedKind[item.format]} answer`,
    });
  }
  if (item.negativeMarks > item.maxPoints) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["negativeMarks"],
      message: "Negative marks cannot exceed max points",
    });
  }

  const choiceFormat = item.format === "mcq_single" || item.format === "mcq_multi";
  if (choiceFormat && item.options.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Choice questions require at least two options" });
  }
  if (!choiceFormat && item.format !== "true_false" && item.options.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "This question format must not include options" });
  }
  if (item.format === "true_false" && item.options.length > 0) {
    const values = item.options.map((value) => value.toLocaleLowerCase("en"));
    if (values.length !== 2 || values[0] !== "false" || values[1] !== "true") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "True/false options must be False, True in that order" });
    }
  }

  const comparableOptions = item.options.map(normalizeComparableText);
  if (new Set(comparableOptions).size !== comparableOptions.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Answer options must be unique" });
  }
  if (item.answer.kind === "single_choice" && item.answer.correctOption >= item.options.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answer", "correctOption"], message: "Correct option is outside the options array" });
  }
  if (item.answer.kind === "multiple_choice") {
    const unique = new Set(item.answer.correctOptions);
    if (unique.size !== item.answer.correctOptions.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answer", "correctOptions"], message: "Correct options must be unique" });
    }
    if (item.answer.correctOptions.some((index) => index >= item.options.length)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answer", "correctOptions"], message: "A correct option is outside the options array" });
    }
  }
  if (item.answer.kind === "exact_text") {
    const accepted = item.answer.accepted.map(normalizeComparableText);
    if (new Set(accepted).size !== accepted.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answer", "accepted"], message: "Accepted answers must be unique" });
    }
  }
  if (item.answer.kind === "numeric") {
    const numeric = typeof item.answer.value === "number" ? item.answer.value : Number(item.answer.value);
    if (!Number.isFinite(numeric)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answer", "value"], message: "Numeric answer must be finite" });
    }
  }
});

export type QuestionPackManifest = z.infer<typeof questionPackManifestSchema>;
export type QuestionPackItemInput = z.infer<typeof questionPackItemSchema>;

export type NormalizedQuestionPackItem = {
  sourceRecordId: string;
  sourceRecordHash: string;
  contentHash: string;
  question: string;
  options: string[];
  correctAnswer: number;
  questionFormat: z.infer<typeof questionFormatSchema>;
  expectedAnswer: string | null;
  answerMetadata: Record<string, unknown> | null;
  maxPoints: number;
  negativeMarks: number;
  timeLimitSec: number | null;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  explanation: string;
  topic: string;
  provenance: {
    language: string;
    syllabus: string | null;
    examName: string | null;
    examYear: number | null;
    subject: string;
    sourceTopic: string;
    objective: string;
    sourceLocator: string;
    questionOrigin: "original" | "licensed_verbatim" | "licensed_adapted";
    answerEvidence: string;
    explanationOrigin: "original" | "licensed_verbatim" | "licensed_adapted";
    sourceMetadata: Record<string, unknown>;
  };
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function normalizeComparableText(value: string): string {
  return normalizeText(value).toLocaleLowerCase("en");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function zodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
}

export function normalizeQuestionPackManifest(input: unknown): ValidationResult<{
  manifest: QuestionPackManifest;
  manifestSha256: string;
}> {
  const parsed = questionPackManifestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  return {
    ok: true,
    value: {
      manifest: parsed.data,
      manifestSha256: sha256Canonical(parsed.data),
    },
  };
}

function normalizeAnswer(item: QuestionPackItemInput) {
  if (item.answer.kind === "single_choice") {
    return {
      correctAnswer: item.answer.correctOption,
      expectedAnswer: null,
      answerMetadata: { kind: "single_choice" },
      canonical: item.answer,
    };
  }
  if (item.answer.kind === "multiple_choice") {
    const correctOptions = [...item.answer.correctOptions].sort((a, b) => a - b);
    return {
      correctAnswer: correctOptions[0],
      expectedAnswer: correctOptions.join(","),
      answerMetadata: { kind: "multiple_choice", correctOptions },
      canonical: { kind: "multiple_choice", correctOptions },
    };
  }
  if (item.answer.kind === "boolean") {
    return {
      correctAnswer: item.answer.value ? 1 : 0,
      expectedAnswer: item.answer.value ? "true" : "false",
      answerMetadata: { kind: "boolean" },
      canonical: item.answer,
    };
  }
  if (item.answer.kind === "exact_text") {
    const accepted = item.answer.accepted.map(normalizeText);
    return {
      correctAnswer: 0,
      expectedAnswer: accepted[0],
      answerMetadata: {
        kind: "exact_text",
        accepted,
        caseSensitive: item.answer.caseSensitive,
      },
      canonical: {
        kind: "exact_text",
        accepted,
        caseSensitive: item.answer.caseSensitive,
      },
    };
  }
  const numericValue = Number(item.answer.value);
  const canonicalValue = String(numericValue);
  return {
    correctAnswer: 0,
    expectedAnswer: canonicalValue,
    answerMetadata: {
      kind: "numeric",
      value: canonicalValue,
      tolerance: item.answer.tolerance,
      ...(item.answer.unit ? { unit: normalizeText(item.answer.unit) } : {}),
    },
    canonical: {
      kind: "numeric",
      value: canonicalValue,
      tolerance: item.answer.tolerance,
      ...(item.answer.unit ? { unit: normalizeText(item.answer.unit) } : {}),
    },
  };
}

export function normalizeQuestionPackItem(input: unknown): ValidationResult<NormalizedQuestionPackItem> {
  const parsed = questionPackItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };

  const item = parsed.data;
  const options = item.format === "true_false"
    ? ["False", "True"]
    : item.options.map(normalizeText);
  const answer = normalizeAnswer(item);
  const tags = item.tags.map(normalizeText).filter((tag, index, all) => (
    all.findIndex((candidate) => normalizeComparableText(candidate) === normalizeComparableText(tag)) === index
  ));
  const question = normalizeText(item.question);
  const explanation = normalizeText(item.explanation);
  const topic = normalizeText(item.topic);
  const provenance = {
    language: item.language,
    syllabus: item.syllabus ? normalizeText(item.syllabus) : null,
    examName: item.exam ? normalizeText(item.exam) : null,
    examYear: item.examYear ?? null,
    subject: normalizeText(item.subject),
    sourceTopic: topic,
    objective: normalizeText(item.objective),
    sourceLocator: normalizeText(item.provenance.sourceLocator),
    questionOrigin: item.provenance.questionOrigin,
    answerEvidence: normalizeText(item.provenance.answerEvidence),
    explanationOrigin: item.provenance.explanationOrigin,
    sourceMetadata: item.metadata,
  };
  const contentIdentity = {
    schemaVersion: QUESTION_PACK_SCHEMA_VERSION,
    question,
    format: item.format,
    options,
    answer: answer.canonical,
    explanation,
  };
  const recordIdentity = {
    ...contentIdentity,
    sourceRecordId: item.sourceRecordId,
    topic,
    difficulty: item.difficulty,
    maxPoints: item.maxPoints,
    negativeMarks: item.negativeMarks,
    timeLimitSec: item.timeLimitSec ?? null,
    tags,
    provenance,
  };

  return {
    ok: true,
    value: {
      sourceRecordId: item.sourceRecordId,
      sourceRecordHash: sha256Canonical(recordIdentity),
      contentHash: sha256Canonical(contentIdentity),
      question,
      options,
      correctAnswer: answer.correctAnswer,
      questionFormat: item.format,
      expectedAnswer: answer.expectedAnswer,
      answerMetadata: answer.answerMetadata,
      maxPoints: item.maxPoints,
      negativeMarks: item.negativeMarks,
      timeLimitSec: item.timeLimitSec ?? null,
      difficulty: item.difficulty,
      tags,
      explanation,
      topic,
      provenance,
    },
  };
}

export function questionTopicSlug(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "topic";
}
