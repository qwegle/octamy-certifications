#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply migrations");
}

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = path.join(appDir, "migrations");
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const lockClient = await pool.connect();
const lockId = "5065497136023550";

async function diskMigrations() {
  const journal = JSON.parse(
    await readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  );
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  const sqlTags = (await readdir(migrationsFolder))
    .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
    .sort()
    .map((fileName) => fileName.replace(/\.sql$/, ""));
  if (JSON.stringify(entries.map((entry) => entry.tag)) !== JSON.stringify(sqlTags)) {
    throw new Error("Migration SQL files and the Drizzle journal are not an exact ordered match");
  }
  for (const [position, entry] of entries.entries()) {
    const previous = entries[position - 1];
    if (entry.idx !== position) {
      throw new Error(`Migration ${entry.tag} has idx ${entry.idx}; expected ${position}`);
    }
    if (!Number.isSafeInteger(entry.when)
      || (previous && entry.when <= previous.when)
      || entry.when > Date.now() + 5 * 60 * 1000) {
      throw new Error(`Migration ${entry.tag} has an invalid, non-increasing, or future timestamp`);
    }
  }
  return Promise.all(entries.map(async (entry) => {
    const sql = await readFile(path.join(migrationsFolder, `${entry.tag}.sql`), "utf8");
    return {
      ...entry,
      hash: createHash("sha256").update(sql).digest("hex"),
    };
  }));
}

async function readDatabaseHistory() {
  const exists = await lockClient.query(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists",
  );
  if (!exists.rows[0]?.exists) return [];
  const result = await lockClient.query(
    "SELECT id, hash, created_at::text AS created_at FROM drizzle.__drizzle_migrations ORDER BY id",
  );
  return result.rows;
}

async function verifyAndNormalizeHistory(migrations, { requireComplete = false } = {}) {
  const history = await readDatabaseHistory();
  if (history.length > migrations.length) {
    throw new Error("Database migration history is longer than the migration journal on disk");
  }
  if (requireComplete && history.length !== migrations.length) {
    throw new Error(`Migration runner stopped with ${history.length}/${migrations.length} journal entries`);
  }

  for (const [position, row] of history.entries()) {
    const expected = migrations[position];
    if (!expected || row.hash !== expected.hash) {
      throw new Error(
        `Database migration history diverges at entry ${position}. Run the guarded legacy-adoption preflight; do not edit the journal manually.`,
      );
    }
  }

  const timestampChanges = history
    .map((row, position) => ({ row, expected: migrations[position] }))
    .filter(({ row, expected }) => Number(row.created_at) !== expected.when);
  if (timestampChanges.length > 0) {
    // Validate the entire hash prefix before mutating any history, then update
    // old hand-authored timestamps atomically. The hashes prove the exact SQL
    // already ran; this only repairs Drizzle's ordering boundary.
    await lockClient.query("BEGIN");
    try {
      for (const { row, expected } of timestampChanges) {
        await lockClient.query(
          "UPDATE drizzle.__drizzle_migrations SET created_at = $1 WHERE id = $2",
          [expected.when, row.id],
        );
      }
      await lockClient.query("COMMIT");
    } catch (error) {
      await lockClient.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  }
  return history.length;
}

try {
  // The lock is session-scoped because Drizzle runs its migration transaction
  // on a pool connection. Every Octamy deploy uses this runner, so two releases
  // cannot race the journal or execute the same DDL concurrently.
  const lock = await lockClient.query(
    "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
    [lockId],
  );
  if (!lock.rows[0]?.acquired) {
    throw new Error("Another Octamy migration process is already running");
  }

  const migrations = await diskMigrations();
  await verifyAndNormalizeHistory(migrations);
  await migrate(drizzle(pool), { migrationsFolder });
  await verifyAndNormalizeHistory(migrations, { requireComplete: true });
  console.log(`[migrate] database is current (${migrations.length} verified journal entries)`);
} finally {
  await lockClient.query("SELECT pg_advisory_unlock($1::bigint)", [lockId]).catch(() => undefined);
  lockClient.release();
  await pool.end();
}
