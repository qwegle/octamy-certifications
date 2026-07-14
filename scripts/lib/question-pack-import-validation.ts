import {
  MAX_QUESTION_PACK_ROWS,
  normalizeQuestionPackItem,
  questionTopicSlug,
  type NormalizedQuestionPackItem,
} from "./question-pack-contract";
import { assertQuestionPackFile, readQuestionPackJsonl, sha256File } from "./question-pack-files";

const MAX_REPORTED_VALIDATION_ERRORS = 50;
const CANONICAL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function resolvedQuestionPackTopicSlug(item: NormalizedQuestionPackItem): string {
  const declared = item.provenance.sourceMetadata.topicSlug;
  if (typeof declared === "string" && CANONICAL_SLUG.test(declared) && declared.length <= 100) {
    return declared;
  }
  return questionTopicSlug(item.topic);
}

export class QuestionPackValidationError extends Error {
  readonly code = "QUESTION_PACK_VALIDATION_FAILED";

  constructor(
    message: string,
    readonly validationErrors: Array<{ lineNumber: number; messages: string[] }>,
  ) {
    super(message);
  }
}

export type QuestionPackValidationSummary = {
  inputSha256: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateSourceRecordIds: number;
  duplicateContentRows: number;
  topics: Array<{ slug: string; name: string }>;
};

export async function validateQuestionPack(
  inputPath: string,
  maxRows = MAX_QUESTION_PACK_ROWS,
): Promise<QuestionPackValidationSummary> {
  await assertQuestionPackFile(inputPath);
  const inputSha256 = await sha256File(inputPath);
  const sourceRecordIds = new Set<string>();
  const contentHashes = new Set<string>();
  const topics = new Map<string, string>();
  const validationErrors: Array<{ lineNumber: number; messages: string[] }> = [];
  let totalRows = 0;
  let validRows = 0;
  let invalidRows = 0;
  let duplicateSourceRecordIds = 0;
  let duplicateContentRows = 0;

  for await (const record of readQuestionPackJsonl(inputPath, maxRows)) {
    totalRows += 1;
    const messages: string[] = [];
    if (record.parseError) {
      messages.push(`Invalid JSON: ${record.parseError}`);
    } else {
      const normalized = normalizeQuestionPackItem(record.value);
      if (!normalized.ok) {
        messages.push(...normalized.errors);
      } else {
        const item = normalized.value;
        if (sourceRecordIds.has(item.sourceRecordId)) {
          duplicateSourceRecordIds += 1;
          messages.push(`Duplicate sourceRecordId: ${item.sourceRecordId}`);
        } else {
          sourceRecordIds.add(item.sourceRecordId);
        }
        if (contentHashes.has(item.contentHash)) duplicateContentRows += 1;
        else contentHashes.add(item.contentHash);
        const slug = resolvedQuestionPackTopicSlug(item);
        const existingName = topics.get(slug);
        if (existingName && existingName !== item.topic) {
          messages.push(`Topic slug collision between “${existingName}” and “${item.topic}”`);
        } else {
          topics.set(slug, item.topic);
        }
      }
    }

    if (messages.length > 0) {
      invalidRows += 1;
      if (validationErrors.length < MAX_REPORTED_VALIDATION_ERRORS) {
        validationErrors.push({ lineNumber: record.lineNumber, messages });
      }
    } else {
      validRows += 1;
    }
  }

  if (invalidRows > 0) {
    throw new QuestionPackValidationError(
      `${invalidRows} of ${totalRows} question-pack rows are invalid; nothing was imported`,
      validationErrors,
    );
  }

  return {
    inputSha256,
    totalRows,
    validRows,
    invalidRows,
    duplicateSourceRecordIds,
    duplicateContentRows,
    topics: [...topics].map(([slug, name]) => ({ slug, name })),
  };
}
