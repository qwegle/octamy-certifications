#!/usr/bin/env node

import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import { parseArgs } from "node:util";
import {
  ORIGINAL_QUESTION_PACK_SOURCE_KEY,
  ORIGINAL_QUESTION_PACK_VERSION,
  generateOriginalQuestion,
  verifyOriginalQuestionRecord,
} from "../server/content/original-question-factory";
import { normalizeQuestionPackItem, sha256Canonical } from "./lib/question-pack-contract";

export type GeneratedQuestionPackSummary = {
  outputPath: string;
  count: number;
  sourceKey: string;
  version: string;
  uniquePrompts: number;
  uniqueSourceRecordIds: number;
  contentDigest: string;
  subjectCounts: Record<string, number>;
};

async function writeLine(stream: ReturnType<typeof createWriteStream>, line: string) {
  if (!stream.write(line)) await once(stream, "drain");
}

export async function generateOriginalQuestionPack(options: {
  outputPath: string;
  count: number;
  overwrite?: boolean;
}): Promise<GeneratedQuestionPackSummary> {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 100_000) {
    throw new Error("count must be an integer between 1 and 100000");
  }

  const outputPath = path.resolve(options.outputPath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const stream = createWriteStream(outputPath, {
    encoding: "utf8",
    flags: options.overwrite ? "w" : "wx",
    mode: 0o600,
  });
  const prompts = new Set<string>();
  const sourceRecordIds = new Set<string>();
  const subjectCounts: Record<string, number> = {};
  const contentHashes: string[] = [];

  try {
    for (let index = 0; index < options.count; index += 1) {
      const record = generateOriginalQuestion(index);
      if (!verifyOriginalQuestionRecord(record)) {
        throw new Error(`Deterministic verification failed at question ${index + 1}`);
      }
      const normalized = normalizeQuestionPackItem(record);
      if (!normalized.ok) {
        throw new Error(`Generated record ${record.sourceRecordId} failed the pack contract: ${normalized.errors.join("; ")}`);
      }
      if (prompts.has(record.question)) throw new Error(`Duplicate prompt generated: ${record.sourceRecordId}`);
      if (sourceRecordIds.has(record.sourceRecordId)) throw new Error(`Duplicate source record generated: ${record.sourceRecordId}`);
      prompts.add(record.question);
      sourceRecordIds.add(record.sourceRecordId);
      subjectCounts[record.subject] = (subjectCounts[record.subject] ?? 0) + 1;
      contentHashes.push(normalized.value.contentHash);
      await writeLine(stream, `${JSON.stringify(record)}\n`);
    }
  } catch (error) {
    stream.destroy();
    throw error;
  }
  stream.end();
  await finished(stream);

  return {
    outputPath,
    count: options.count,
    sourceKey: ORIGINAL_QUESTION_PACK_SOURCE_KEY,
    version: ORIGINAL_QUESTION_PACK_VERSION,
    uniquePrompts: prompts.size,
    uniqueSourceRecordIds: sourceRecordIds.size,
    contentDigest: sha256Canonical(contentHashes),
    subjectCounts,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      output: { type: "string" },
      count: { type: "string", default: "100000" },
      overwrite: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  if (!values.output) throw new Error("--output <local-file.jsonl> is required");
  const result = await generateOriginalQuestionPack({
    outputPath: values.output,
    count: Number(values.count),
    overwrite: values.overwrite,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (["generate-original-question-pack.ts", "generate-original-question-pack.js"].includes(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
