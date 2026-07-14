import "dotenv/config";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!sourceUrl) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");
}

const parsedUrl = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

if (!localHosts.has(parsedUrl.hostname)) {
  throw new Error(
    "Migration validation is restricted to local PostgreSQL hosts because it creates a temporary schema.",
  );
}

const schemaName = `octamy_migration_check_${process.pid}_${Date.now()}`;
const quotedSchemaName = `"${schemaName.replaceAll('"', '""')}"`;
const client = new Client({ connectionString: parsedUrl.toString() });
let transactionOpen = false;

try {
  const migrationFiles = (await readdir(path.join(appDir, "migrations")))
    .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error("No SQL migrations were found");
  }

  const journal = JSON.parse(
    await readFile(path.join(appDir, "migrations", "meta", "_journal.json"), "utf8"),
  );
  const journalEntries = Array.isArray(journal.entries) ? journal.entries : [];
  const migrationTags = migrationFiles.map((fileName) => fileName.replace(/\.sql$/, ""));
  const journalTags = journalEntries.map((entry) => entry.tag);

  if (JSON.stringify(journalTags) !== JSON.stringify(migrationTags)) {
    throw new Error(
      `Migration journal mismatch. SQL: ${migrationTags.join(", ")}; journal: ${journalTags.join(", ")}`,
    );
  }

  for (const [position, entry] of journalEntries.entries()) {
    const previous = journalEntries[position - 1];
    if (entry.idx !== position) {
      throw new Error(`Migration journal entry ${entry.tag} has idx ${entry.idx}; expected ${position}`);
    }
    if (previous && entry.when <= previous.when) {
      throw new Error(`Migration journal timestamp for ${entry.tag} is not strictly increasing`);
    }
    // Drizzle treats the greatest recorded timestamp as the applied boundary.
    // A future-dated entry can therefore make later, correctly dated migrations
    // look older and silently skip them.
    if (!Number.isSafeInteger(entry.when) || entry.when > Date.now() + 5 * 60 * 1000) {
      throw new Error(`Migration journal timestamp for ${entry.tag} is invalid or future-dated`);
    }
  }

  await client.connect();
  await client.query("BEGIN");
  transactionOpen = true;
  await client.query(`CREATE SCHEMA ${quotedSchemaName}`);
  await client.query(`SET LOCAL search_path TO ${quotedSchemaName}, pg_catalog`);

  for (const migrationFile of migrationFiles) {
    const migrationSql = await readFile(path.join(appDir, "migrations", migrationFile), "utf8");
    const isolatedSql = migrationSql.replaceAll('"public".', `${quotedSchemaName}.`);
    try {
      await client.query(isolatedSql);
    } catch (error) {
      throw new Error(
        `Migration ${migrationFile} failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  const verification = await client.query(
    `
      SELECT
        to_regclass($1) IS NOT NULL AS audience_bands,
        to_regclass($2) IS NOT NULL AS course_audience_bands,
        to_regclass($3) IS NOT NULL AS attempt_items,
        to_regclass($4) IS NOT NULL AS benefit_usages,
        to_regclass($5) IS NOT NULL AS institute_exam_invitations,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = $6
            AND table_name = 'courses'
            AND column_name = 'review_status'
        ) AS course_review_status,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = $6
            AND table_name = 'certificates'
            AND column_name = 'scheduled_attempt_id'
        ) AS scheduled_certificate_link,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = $6
            AND table_name = 'exam_instance_attempts'
            AND column_name = 'invitation_id'
        ) AS invitation_attempt_link
    `,
    [
      `${schemaName}.audience_bands`,
      `${schemaName}.course_audience_bands`,
      `${schemaName}.exam_instance_attempt_items`,
      `${schemaName}.subscription_benefit_usages`,
      `${schemaName}.exam_instance_invitations`,
      schemaName,
    ],
  );

  const missingChecks = Object.entries(verification.rows[0])
    .filter(([, exists]) => !exists)
    .map(([checkName]) => checkName);

  if (missingChecks.length > 0) {
    throw new Error(`Migration verification failed: ${missingChecks.join(", ")}`);
  }

  console.log(`Validated ${migrationFiles.length} migrations in an isolated local schema.`);
} finally {
  if (transactionOpen) {
    await client.query("ROLLBACK").catch(() => undefined);
  }
  await client.end().catch(() => undefined);
}
