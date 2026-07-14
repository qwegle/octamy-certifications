import { afterEach, describe, expect, it } from "@jest/globals";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateOriginalQuestion } from "../../server/content/original-question-factory";
import {
  QuestionPackValidationError,
  validateQuestionPack,
} from "../../scripts/lib/question-pack-import-validation";

const tempDirectories: string[] = [];

async function jsonlFile(records: unknown[]) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "octamy-pack-test-"));
  tempDirectories.push(directory);
  const filePath = path.join(directory, "questions.jsonl");
  await writeFile(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  return filePath;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("question-pack import preflight", () => {
  it("validates generated rows and preserves the declared canonical topic slug", async () => {
    const records = Array.from({ length: 100 }, (_, index) => generateOriginalQuestion(index));
    const summary = await validateQuestionPack(await jsonlFile(records));
    expect(summary).toMatchObject({
      totalRows: 100,
      validRows: 100,
      invalidRows: 0,
      duplicateSourceRecordIds: 0,
      duplicateContentRows: 0,
    });
    expect(summary.topics).toContainEqual({
      slug: "speed-distance-time",
      name: "Speed, distance and time",
    });
  });

  it("fails the entire pack before import when a source record id is repeated", async () => {
    const record = generateOriginalQuestion(0);
    try {
      await validateQuestionPack(await jsonlFile([record, record]));
      throw new Error("Expected duplicate source record validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(QuestionPackValidationError);
      const validationError = error as QuestionPackValidationError;
      expect(validationError.code).toBe("QUESTION_PACK_VALIDATION_FAILED");
      expect(validationError.validationErrors.flatMap((entry) => entry.messages).join(" "))
        .toContain("Duplicate sourceRecordId");
    }
  });
});
