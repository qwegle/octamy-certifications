import { afterEach, describe, expect, it } from "@jest/globals";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  QuestionPackFileError,
  readQuestionPackJsonl,
  sha256File,
} from "../../scripts/lib/question-pack-files";

const tempDirs: string[] = [];

async function tempFile(content: string) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "octamy-question-pack-"));
  tempDirs.push(directory);
  const filePath = path.join(directory, "pack.jsonl");
  await writeFile(filePath, content, "utf8");
  return filePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("bounded JSONL question-pack reader", () => {
  it("streams BOM, blanks, valid rows and parse failures with stable positions", async () => {
    const filePath = await tempFile('\uFEFF{"sourceRecordId":"one"}\n\nnot-json\n{"sourceRecordId":"two"}\n');
    const rows = [];
    for await (const row of readQuestionPackJsonl(filePath)) rows.push(row);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ lineNumber: 1, rowNumber: 1, value: { sourceRecordId: "one" } });
    expect(rows[1]).toMatchObject({ lineNumber: 3, rowNumber: 2 });
    expect(rows[1].parseError).toBeTruthy();
    expect(rows[2]).toMatchObject({ lineNumber: 4, rowNumber: 3, value: { sourceRecordId: "two" } });
  });

  it("enforces a caller-selected row ceiling", async () => {
    const filePath = await tempFile('{"id":1}\n{"id":2}\n');
    const consume = async () => {
      for await (const _row of readQuestionPackJsonl(filePath, 1)) { /* consume */ }
    };
    await expect(consume()).rejects.toMatchObject({ code: "ROW_LIMIT" });
  });

  it("rejects empty packs", async () => {
    const filePath = await tempFile("\n  \n");
    const consume = async () => {
      for await (const _row of readQuestionPackJsonl(filePath)) { /* consume */ }
    };
    await expect(consume()).rejects.toBeInstanceOf(QuestionPackFileError);
  });

  it("hashes the physical input for whole-pack idempotency", async () => {
    const first = await tempFile('{"id":1}\n');
    const second = await tempFile('{"id":1}\n');
    expect(await sha256File(first)).toBe(await sha256File(second));
    expect(await sha256File(first)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails closed instead of silently replacing invalid UTF-8", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "octamy-question-pack-"));
    tempDirs.push(directory);
    const filePath = path.join(directory, "invalid.jsonl");
    await writeFile(filePath, Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]));
    const consume = async () => {
      for await (const _row of readQuestionPackJsonl(filePath)) { /* consume */ }
    };
    await expect(consume()).rejects.toMatchObject({ code: "INVALID_UTF8" });
  });

  it("does not follow a symbolic link presented as an import pack", async () => {
    const target = await tempFile('{"id":1}\n');
    const linkPath = path.join(path.dirname(target), "pack-link.jsonl");
    await symlink(target, linkPath);
    await expect(sha256File(linkPath)).rejects.toThrow("regular file");
  });
});
