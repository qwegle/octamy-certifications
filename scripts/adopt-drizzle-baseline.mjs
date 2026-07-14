#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const appDir = process.env.APP_DIR || process.cwd();
const databaseUrl = process.env.DATABASE_URL;
const allowAdoption = process.env.ADOPT_EXISTING_SCHEMA === "1";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for migration preflight");
}

const journalPath = path.join(appDir, "migrations", "meta", "_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const baselineEntry = journal.entries.find((entry) => entry.tag === "0000_baseline");
if (!baselineEntry) throw new Error("Migration journal does not contain 0000_baseline");
const performanceEntry = journal.entries.find((entry) => entry.tag === "0001_perf_indexes");
if (!performanceEntry) throw new Error("Migration journal does not contain 0001_perf_indexes");

const baselinePath = path.join(appDir, "migrations", `${baselineEntry.tag}.sql`);
const baselineSql = readFileSync(baselinePath, "utf8");
const baselineHash = createHash("sha256").update(baselineSql).digest("hex");
const performancePath = path.join(appDir, "migrations", `${performanceEntry.tag}.sql`);
const performanceSql = readFileSync(performancePath, "utf8");
const performanceHash = createHash("sha256").update(performanceSql).digest("hex");
const performanceIndexes = Array.from(
  performanceSql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+"?([a-zA-Z0-9_]+)"?/gi),
  (match) => match[1],
);
const baselineTables = Array.from(
  baselineSql.matchAll(/CREATE TABLE\s+"([^"]+)"/g),
  (match) => match[1],
);

const requiredColumns = [
  ["users", "id"], ["users", "email"], ["users", "profile_visibility"],
  ["courses", "id"], ["courses", "category_id"], ["courses", "owner_type"],
  ["courses", "owner_id"], ["courses", "created_at"], ["courses", "slug"],
  ["exam_attempts", "id"], ["exam_attempts", "course_id"], ["exam_attempts", "session_id"],
  ["exam_instances", "id"], ["exam_instances", "owner_type"], ["exam_instances", "owner_id"],
  ["exam_instance_attempts", "id"], ["exam_instance_attempts", "instance_id"],
  ["institute_members", "id"], ["institute_members", "user_id"], ["institute_members", "institute_id"],
  ["question_banks", "id"], ["question_banks", "owner_type"], ["question_banks", "owner_id"],
  ["questions", "id"], ["questions", "course_id"], ["questions", "bank_id"],
  ["recruiters", "id"], ["recruiters", "credits_balance"], ["recruiters", "kyc_status"],
  ["payments", "id"], ["certificates", "id"], ["profile_access_logs", "id"],
];

// The first production installation recorded a hand-authored checkpoint after
// applying both 0000 and 0001. It is safe to normalise only this exact marker,
// and only after proving that the baseline schema and every 0001 index exist.
const recognizedLegacyMarker = {
  hash: "baseline",
  createdAt: "1778588006000",
};

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock($1::bigint)", ["5065497136023550"]);

  const publicCountResult = await client.query(
    "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'",
  );
  const publicTableCount = publicCountResult.rows[0].count;
  const journalExistsResult = await client.query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists",
  );
  const journalExists = journalExistsResult.rows[0].exists;
  const databaseHistory = journalExists
    ? (await client.query(
      "SELECT id, hash, created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY id",
    )).rows
    : [];
  const journalCount = databaseHistory.length;
  const hasRecognizedLegacyMarker = journalCount === 1
    && databaseHistory[0].hash === recognizedLegacyMarker.hash
    && databaseHistory[0].created_at === recognizedLegacyMarker.createdAt;

  if (publicTableCount === 0) {
    if (journalCount > 0) {
      throw new Error("Migration history exists but the public application schema is empty");
    }
    await client.query("COMMIT");
    console.log(
      `[migration-preflight] no legacy adoption needed (public tables=${publicTableCount}, journal rows=${journalCount})`,
    );
    process.exit(0);
  }

  if (journalCount > 0 && !hasRecognizedLegacyMarker) {
    await client.query("COMMIT");
    console.log(
      `[migration-preflight] existing migration history will be verified by the migration runner (journal rows=${journalCount})`,
    );
    process.exit(0);
  }

  if (!hasRecognizedLegacyMarker && !allowAdoption) {
    throw new Error(
      `Found ${publicTableCount} public tables but no Drizzle migration history. ` +
      "Refusing to guess. After validating a fresh backup and confirming this is the pre-journal Octamy schema, " +
      "rerun once with ADOPT_EXISTING_SCHEMA=1.",
    );
  }

  const tableCheck = await client.query(
    `SELECT requested.name
       FROM unnest($1::text[]) AS requested(name)
       LEFT JOIN pg_tables existing
         ON existing.schemaname = 'public' AND existing.tablename = requested.name
      WHERE existing.tablename IS NULL
      ORDER BY requested.name`,
    [baselineTables],
  );
  if (tableCheck.rowCount) {
    throw new Error(
      `Legacy schema is not compatible with the Octamy baseline; missing tables: ${tableCheck.rows.map((row) => row.name).join(", ")}`,
    );
  }

  const columnCheck = await client.query(
    `SELECT requested.table_name, requested.column_name
       FROM jsonb_to_recordset($1::jsonb)
         AS requested(table_name text, column_name text)
       LEFT JOIN information_schema.columns existing
         ON existing.table_schema = 'public'
        AND existing.table_name = requested.table_name
        AND existing.column_name = requested.column_name
      WHERE existing.column_name IS NULL
      ORDER BY requested.table_name, requested.column_name`,
    [JSON.stringify(requiredColumns.map(([table_name, column_name]) => ({ table_name, column_name })))],
  );
  if (columnCheck.rowCount) {
    throw new Error(
      `Legacy schema is not compatible with the Octamy baseline; missing columns: ${columnCheck.rows.map((row) => `${row.table_name}.${row.column_name}`).join(", ")}`,
    );
  }

  if (hasRecognizedLegacyMarker) {
    const indexCheck = await client.query(
      `SELECT requested.name
         FROM unnest($1::text[]) AS requested(name)
         LEFT JOIN pg_indexes existing
           ON existing.schemaname = 'public' AND existing.indexname = requested.name
        WHERE existing.indexname IS NULL
        ORDER BY requested.name`,
      [performanceIndexes],
    );
    if (indexCheck.rowCount) {
      throw new Error(
        `Recognized legacy migration marker is missing 0001 indexes: ${indexCheck.rows.map((row) => row.name).join(", ")}`,
      );
    }

    await client.query("DELETE FROM drizzle.__drizzle_migrations WHERE id = $1", [databaseHistory[0].id]);
    await client.query(
      "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2), ($3, $4)",
      [baselineHash, baselineEntry.when, performanceHash, performanceEntry.when],
    );
    await client.query("COMMIT");
    console.log(
      "[migration-preflight] normalized the verified legacy 0000/0001 migration checkpoint",
    );
    process.exit(0);
  }

  await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  await client.query(
    "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
    [baselineHash, baselineEntry.when],
  );
  await client.query("COMMIT");
  console.log(
    `[migration-preflight] adopted verified legacy schema at ${baselineEntry.tag}; later migrations remain pending`,
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`[migration-preflight] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
