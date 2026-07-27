#!/usr/bin/env node

import "dotenv/config";

import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { generateOriginalQuestionPack } from "./generate-original-question-pack";
import { importQuestionPack } from "./import-question-pack";
import { registerQuestionPackSource } from "./register-question-pack-source";
import { syncInhouseAssessmentCatalog } from "./sync-inhouse-assessment-catalog";

const { Client } = pg;
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function scopedDatabaseUrl(source: string, schema: string): string {
  const url = new URL(source);
  url.searchParams.set("options", `-c search_path=${schema},pg_catalog`);
  return url.toString();
}

async function main() {
  const sourceUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!sourceUrl) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");
  const parsed = new URL(sourceUrl);
  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname)) {
    throw new Error("Question-pack integration verification is restricted to local PostgreSQL");
  }

  const schema = `octamy_pack_check_${process.pid}_${Date.now()}`;
  const quotedSchema = `"${schema.replaceAll('"', '""')}"`;
  const databaseUrl = scopedDatabaseUrl(sourceUrl, schema);
  const control = new Client({ connectionString: sourceUrl });
  const packDirectory = await import("node:fs/promises").then(({ mkdtemp }) => (
    mkdtemp(path.join(os.tmpdir(), "octamy-pack-integration-"))
  ));
  const packPath = path.join(packDirectory, "questions.jsonl");
  const rightsEvidencePath = path.join(packDirectory, "synthetic-rights-evidence.txt");
  await writeFile(
    rightsEvidencePath,
    "Synthetic integration-test evidence only; not valid for production rights registration.\n",
    "utf8",
  );

  await control.connect();
  try {
    await control.query(`CREATE SCHEMA ${quotedSchema}`);
    await control.query(`SET search_path TO ${quotedSchema}, pg_catalog`);
    const migrationFiles = (await readdir(path.resolve("migrations")))
      .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
      .sort();
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(path.join("migrations", migrationFile), "utf8");
      await control.query(sql.replaceAll('"public".', `${quotedSchema}.`));
    }

    const generated = await generateOriginalQuestionPack({
      outputPath: packPath,
      count: 500,
    });
    const catalog = await syncInhouseAssessmentCatalog({
      databaseUrl,
      operator: "Octamy integration verifier",
      apply: true,
      confirmDraftOnly: true,
    });
    await registerQuestionPackSource({
      databaseUrl,
      manifestPath: path.resolve("content/question-packs/octamy-original-quant-science-v1.manifest.json"),
      evidencePath: rightsEvidencePath,
      acquiringEntity: "Octamy integration test fixture",
      operator: "Octamy integration verifier",
      confirmRights: true,
    });
    const imported = await importQuestionPack({
      databaseUrl,
      inputPath: packPath,
      sourceKey: "octamy-original:quant-science:v1",
      bankSlug: "octamy-original-quantitative-and-numerical-v1",
      operator: "Octamy integration verifier",
      batchSize: 100,
      maxRows: 500,
      commit: true,
    });
    const repeated = await importQuestionPack({
      databaseUrl,
      inputPath: packPath,
      sourceKey: "octamy-original:quant-science:v1",
      bankSlug: "octamy-original-quantitative-and-numerical-v1",
      operator: "Octamy integration verifier",
      batchSize: 100,
      maxRows: 500,
      commit: true,
    });

    const verificationClient = new Client({ connectionString: databaseUrl });
    await verificationClient.connect();
    try {
      const inventory = await verificationClient.query<{
        questions: number;
        pending_questions: number;
        active_questions: number;
        provenance: number;
        assessment_shells: number;
        public_or_active_shells: number;
      }>(`
        SELECT
          (SELECT count(*)::integer FROM questions) AS questions,
          (SELECT count(*)::integer FROM questions WHERE review_status = 'pending') AS pending_questions,
          (SELECT count(*)::integer FROM questions WHERE is_active = true) AS active_questions,
          (SELECT count(*)::integer FROM question_provenance) AS provenance,
          (SELECT count(*)::integer FROM courses WHERE owner_type = 'admin' AND product_type = 'assessment') AS assessment_shells,
          (SELECT count(*)::integer FROM courses
            WHERE owner_type = 'admin' AND product_type = 'assessment'
              AND (visibility <> 'private' OR is_active = true OR review_status <> 'pending')) AS public_or_active_shells
      `);
      const row = inventory.rows[0];
      if (!row
        || row.questions !== 500
        || row.pending_questions !== 500
        || row.active_questions !== 0
        || row.provenance !== 500
        || row.assessment_shells !== 25
        || row.public_or_active_shells !== 0
        || repeated.status !== "already_completed") {
        throw new Error(`Integration inventory mismatch: ${JSON.stringify({ row, repeated })}`);
      }
      process.stdout.write(`${JSON.stringify({
        status: "passed",
        generated,
        catalog,
        imported,
        repeated,
        inventory: row,
      }, null, 2)}\n`);
    } finally {
      await verificationClient.end();
    }
  } finally {
    await control.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`).catch(() => undefined);
    await control.end().catch(() => undefined);
    await rm(packDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
