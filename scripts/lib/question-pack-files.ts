import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import {
  MAX_QUESTION_PACK_BYTES,
  MAX_QUESTION_PACK_LINE_BYTES,
  MAX_QUESTION_PACK_ROWS,
} from "./question-pack-contract";

export class QuestionPackFileError extends Error {
  constructor(
    readonly code: "FILE_TOO_LARGE" | "LINE_TOO_LARGE" | "ROW_LIMIT" | "EMPTY_PACK" | "INVALID_UTF8",
    message: string,
  ) {
    super(message);
  }
}

export type JsonlRecord = {
  lineNumber: number;
  rowNumber: number;
  value?: unknown;
  parseError?: string;
};

export async function assertQuestionPackFile(filePath: string) {
  const file = await lstat(filePath);
  if (!file.isFile()) throw new Error("Question pack path is not a regular file");
  if (file.size > MAX_QUESTION_PACK_BYTES) {
    throw new QuestionPackFileError(
      "FILE_TOO_LARGE",
      `Question pack exceeds the ${MAX_QUESTION_PACK_BYTES} byte safety limit`,
    );
  }
  return file;
}

export async function sha256File(filePath: string): Promise<string> {
  await assertQuestionPackFile(filePath);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function* boundedLines(filePath: string): AsyncGenerator<{ line: string; lineNumber: number }> {
  await assertQuestionPackFile(filePath);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  let lineNumber = 0;

  const emitLine = function* (rawLine: string) {
    lineNumber += 1;
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (Buffer.byteLength(line, "utf8") > MAX_QUESTION_PACK_LINE_BYTES) {
      throw new QuestionPackFileError(
        "LINE_TOO_LARGE",
        `Line ${lineNumber} exceeds the ${MAX_QUESTION_PACK_LINE_BYTES} byte safety limit`,
      );
    }
    yield { line, lineNumber };
  };

  for await (const chunk of createReadStream(filePath)) {
    try {
      buffer += decoder.decode(chunk as Buffer, { stream: true });
    } catch {
      throw new QuestionPackFileError(
        "INVALID_UTF8",
        `Question pack contains invalid UTF-8 near line ${lineNumber + 1}`,
      );
    }
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const rawLine = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      yield* emitLine(rawLine);
      newline = buffer.indexOf("\n");
    }
    if (Buffer.byteLength(buffer, "utf8") > MAX_QUESTION_PACK_LINE_BYTES) {
      throw new QuestionPackFileError(
        "LINE_TOO_LARGE",
        `Line ${lineNumber + 1} exceeds the ${MAX_QUESTION_PACK_LINE_BYTES} byte safety limit`,
      );
    }
  }
  try {
    buffer += decoder.decode();
  } catch {
    throw new QuestionPackFileError(
      "INVALID_UTF8",
      `Question pack contains invalid UTF-8 near line ${lineNumber + 1}`,
    );
  }
  if (buffer.length > 0) yield* emitLine(buffer);
}

export async function* readQuestionPackJsonl(
  filePath: string,
  maxRows = MAX_QUESTION_PACK_ROWS,
): AsyncGenerator<JsonlRecord> {
  if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > MAX_QUESTION_PACK_ROWS) {
    throw new Error(`maxRows must be between 1 and ${MAX_QUESTION_PACK_ROWS}`);
  }
  let rowNumber = 0;
  for await (const { line: originalLine, lineNumber } of boundedLines(filePath)) {
    const line = lineNumber === 1 ? originalLine.replace(/^\uFEFF/, "") : originalLine;
    if (!line.trim()) continue;
    rowNumber += 1;
    if (rowNumber > maxRows) {
      throw new QuestionPackFileError(
        "ROW_LIMIT",
        `Question pack exceeds the ${maxRows} row limit`,
      );
    }
    try {
      yield { lineNumber, rowNumber, value: JSON.parse(line) };
    } catch (error) {
      yield {
        lineNumber,
        rowNumber,
        parseError: error instanceof Error ? error.message : "Invalid JSON",
      };
    }
  }
  if (rowNumber === 0) {
    throw new QuestionPackFileError("EMPTY_PACK", "Question pack has no JSONL records");
  }
}
