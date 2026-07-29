#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(appDir, "migrations");

// This manifest is the append-only review boundary. Existing hashes must never
// be changed to make a modified migration pass; add a new migration instead.
const immutableMigrationHashes = Object.freeze({
  "0000_baseline": "20141d692e5491da8625e30fed48aa9a609dd22e20c6f4c866e5110ea314b8ad",
  "0001_perf_indexes": "ceacfc69811268348c65231f37c3778eb570c457c11a88d3e1338a0d32845481",
  "0002_evidence_passport_privacy": "f22d36ed48f39386fa389e481f695fc76a4cce08439d4638be5561c00c4b2f91",
  "0003_truthful_catalog_copy": "e4fc34e21724b9a17c261a8b121739841b3f483cd56185967e3d7ded68d466de",
  "0004_recruiter_discovery_wallet_safety": "9326431482e8cd87e0e6e2113cdd85b48cc7b90b57924beaa44de05b0353d158",
  "0005_institute_assessment_workspaces": "8c718557d051aba34d2b1fa24b192825d09617e6d9e902606b0c4d0ab068c3ee",
  "0006_proctoring_evidence": "d5317bc110b47a1deb7af20c29be4654a4365b192d7a1ace2db4c615a26f9396",
  "0007_media_library": "a7463f5c368f5cc77b5b849f4a6a9163df30f40f5f0dd50154f915ce8e0ea416",
  "0008_course_content_commerce": "67ff20f335f48250e9be1b7df5722241821dee6145d37eb4d86fbccd8ae3f43b",
  "0009_exam_attempt_session_integrity": "8dab949a4805eef3d889fd4c35ca0bae04bb0d4f63f2a5bd62fd5f0a50261499",
  "0010_ai_curriculum_imports": "0362cb22e7c45d2761c3b72f0bbf2060d84e35f7bcbdb9ae4e5f188224962575",
  "0011_assessment_attempt_integrity": "42f16f06163a16642f9bc919f9b0805be903d4201ab667153ee14584e2a94820",
  "0012_assessment_governance": "698b4711faec7ac3212a07559d6e94e4094a635222dbc50f862516a706582f3f",
  "0013_institute_exam_delivery": "7a7bed2548b34c59043095565682ab5e0ee2bbd416b3054f2abdf9a301f968f9",
  "0014_question_pack_ingestion": "e490dcb3473c693008b4d508de428765cc60bc64394504ea8075ed3b9c52802a",
  "0015_inhouse_assessment_catalog": "be85ee873a14b49b597b650ef69ccf9a62078177e85600d2e6bfff6d4681c5b7",
  "0016_enterprise_question_pools": "e1c67db667e729cf4f3bba0cecc20bd36c4ff6c294b45bb020fdec44832ae693",
  "0017_exam_recovery_and_inhouse_pricing": "d5a68cd2fbf3ac20e5dbd04d06cf497717a5211ac8b53b6f8682200c61a0966f",
  "0018_certification_vouchers_and_coupons": "de6b551062b2aa375372d6d63d14f1bbb3613e321222dec7e2bed4ea25a0d60c",
  "0019_voucher_redemption_idempotency": "8e821d3d9daef25fff0ddce882431ec24f2330729a6cf014020103b846a70cb2",
  "0020_workspace_benefit_ownership": "eb47cfde7e16c313e402c4006524a35155f3038a24dd02d037291775749ea998",
  "0021_voucher_funding_sources": "cd1c9753e5ab0ae8c19296d22e5f2a5059aaf32cf190d07a9f670a373cc8176d",
  "0022_assessment_purpose_split": "6ff54fe6ee90e6c19ab3b8468dfc292642073d3bfbdcc3555366cafdfd5af7d1",
  "0023_public_exam_evidence_consent": "00c1838a3a64f4759fafcc29b2280f7c2996ad4e7809dbdfd0d2c5be09537853",
  "0024_exam_session_owner": "90ef59369394ec767fdb6fe3440a910d3c896bd91b196d1594ac85f428d2a8bb",
  "0025_interview_studio": "9125a870e23a3657940822fa4bafdb05d5f69c97536939c4e8bcc8857f85691f",
  "0026_interview_studio_hardening": "56be44f7f7aaca912d5ba9051f6719361bbfb9941dfef9837b335d86bed2379a",
  "0027_interview_studio_evaluation_queue": "27a959ec058e679ce8622bdb90b8854e58bfe3587bd620409f1ad3fc279040db",
  "0028_assessment_content_safety": "304ad670f0f24473a163ef5ad833b8ac03b8737d442a29f8e4182f1254d5debd",
  "0029_retire_rejected_assessment_content": "c63b6104f0a60a210e56c8481bb7903945ea42d7943be620d5fc21fd5b0f8914",
  "0030_restore_original_practice_catalog": "3c2b68727fcd07a4a47d5aee1c23ea5fdbd0dc517bfd72352c367779e2076387",
  "0031_quarantine_unreviewed_practice_restore": "250a3060031002da19aa042f1b6a78f99dd79719a226c9cd0cd4cb74e752be9d",
  "0032_recruiter_evidence_grants": "85712f4439527c15555046dddae0dd0aa8d5596e82272a30249bcecb28472a9a",
  "0033_unpublish_audited_blocked_assessments": "979f7003c0869626cd8da25a6c883477488e1782c6ba12a358b75a703927a05c",
  "0034_database_managed_sale_state": "ec6fc71699725f588694df2f044c0d563447bb9ab178c0c52f09a68205bed35b",
  "0035_governed_assessment_release_evidence": "34470923b08347a592189197916a86dc6f77a07ca83e356154991dc69cbef14a",
  "0036_void_fabricated_release_evidence": "c4ab69809b5a884da9185aa166af89d0bd160080c2f1d1eadf45ce402707f7a4",
  "0037_release_evidence_rls_breaks_backups": "f0314ed982c804ce4eb8b3cc0e1ec8d0981217810f8bacc8a5ca46b9730f5097",
  "0038_archive_audited_certification_shells": "52aca66a2b735cc95588c1fb696d22c45a424d73d9583a36c51dc29bf8640a83",
});

// Exact-hash review records for migrations containing data mutation,
// constraint removal/tightening, or function replacement. Unreviewed matches
// fail closed; this is not a wildcard exemption for future files.
const destructiveMigrationReviews = Object.freeze({
  "0003_truthful_catalog_copy": "bounded catalog copy correction",
  "0004_recruiter_discovery_wallet_safety": "bounded recruiter safety backfill",
  "0005_institute_assessment_workspaces": "aggregate question-count reconciliation",
  "0009_exam_attempt_session_integrity": "session ownership backfill with relational predicate",
  "0011_assessment_attempt_integrity": "attempt snapshot and integrity backfills",
  "0012_assessment_governance": "governance backfills scoped by legacy state",
  "0013_institute_exam_delivery": "delivery-state backfills before constraints",
  "0015_inhouse_assessment_catalog": "catalog upserts and orphan-only topic cleanup",
  "0016_enterprise_question_pools": "pool backfill before bank_id NOT NULL",
  "0017_exam_recovery_and_inhouse_pricing": "bounded in-house pricing correction",
  "0021_voucher_funding_sources": "constraint replacement uses IF EXISTS",
  "0022_assessment_purpose_split": "purpose-specific catalog and ownership backfill",
  "0025_interview_studio": "new policy functions created on new tables",
  "0026_interview_studio_hardening": "constraints replaced in-place and policy functions tightened",
  "0027_interview_studio_evaluation_queue": "response policy function tightened",
  "0028_assessment_content_safety": "state-predicate quarantine and count reconciliation",
  "0029_retire_rejected_assessment_content": "signed-source and exact-state retirement",
  "0030_restore_original_practice_catalog": "exact-source incident restore superseded by 0031 quarantine",
  "0031_quarantine_unreviewed_practice_restore": "exact-source/state quarantine with touched-bank temp set",
  "0032_recruiter_evidence_grants": "new immutable grant policy functions on new tables",
  "0033_unpublish_audited_blocked_assessments": "exact-slug/state unpublish of audited blocked practice shells; preserves questions, attempts, payments",
  "0034_database_managed_sale_state": "database-triggered sale-state normalization and constraint tightening after bounded reconciliation",
  "0035_governed_assessment_release_evidence": "new cross-role and append-only policy functions on additive release-evidence tables",
  "0036_void_fabricated_release_evidence": "new append-only void and release-role authorization policy function with forced unvoided evidence visibility",
  "0038_archive_audited_certification_shells": "additive review-state extension and exact-ID/state/history guarded archival of 14 audited empty certification shells",
});

const mutatingPatterns = Object.freeze([
  ["UPDATE", /\bUPDATE\s+(?:"[^"]+"|[a-z_][\w.]*)(?:\s+(?:AS\s+)?[a-z_]\w*)?\s+SET\b/gi],
  ["DELETE FROM", /\bDELETE\s+FROM\b/gi],
  ["TRUNCATE", /\bTRUNCATE(?:\s+TABLE)?\b/gi],
  ["DROP object", /\bDROP\s+(?:TABLE|SCHEMA|DATABASE|TYPE|INDEX)\b/gi],
  ["DROP column/constraint", /\bALTER\s+TABLE\b[^;]*?\bDROP\s+(?:COLUMN|CONSTRAINT)\b/gi],
  ["SET NOT NULL", /\bALTER\s+TABLE\b[^;]*?\bSET\s+NOT\s+NULL\b/gi],
  ["ALTER TYPE", /\bALTER\s+TABLE\b[^;]*?\bALTER\s+COLUMN\b[^;]*?\bTYPE\b/gi],
  ["CREATE OR REPLACE", /\bCREATE\s+OR\s+REPLACE\s+(?:FUNCTION|PROCEDURE|VIEW)\b/gi],
  ["upsert UPDATE", /\bON\s+CONFLICT\b[^;]*?\bDO\s+UPDATE\s+SET\b/gi],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArguments(argv) {
  let staticOnly = false;
  let baseRef;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--static-only") staticOnly = true;
    else if (argument === "--base-ref") {
      baseRef = argv[index + 1];
      index += 1;
      if (!baseRef) throw new Error("--base-ref requires a Git commit or ref");
    } else if (argument.startsWith("--base-ref=")) {
      baseRef = argument.slice("--base-ref=".length);
      if (!baseRef) throw new Error("--base-ref requires a Git commit or ref");
    } else {
      throw new Error(`Unknown migration validation argument: ${argument}`);
    }
  }
  return { staticOnly, baseRef };
}

function gitFile(ref, relativePath) {
  return execFileSync("git", ["show", `${ref}:${relativePath}`], {
    cwd: appDir,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

async function runStaticValidation(baseRef) {
  const migrationFiles = (await readdir(migrationsDir))
    .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
    .sort();
  if (migrationFiles.length === 0) throw new Error("No SQL migrations were found");

  const journal = JSON.parse(
    await readFile(path.join(migrationsDir, "meta", "_journal.json"), "utf8"),
  );
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  const tags = migrationFiles.map((fileName) => fileName.replace(/\.sql$/, ""));
  if (JSON.stringify(entries.map((entry) => entry.tag)) !== JSON.stringify(tags)) {
    throw new Error(`Migration journal/files are not an exact ordered match. SQL: ${tags.join(", ")}`);
  }

  for (const [position, entry] of entries.entries()) {
    const previous = entries[position - 1];
    if (entry.idx !== position) {
      throw new Error(`Migration journal entry ${entry.tag} has idx ${entry.idx}; expected ${position}`);
    }
    if (entry.version !== "7" || entry.breakpoints !== true) {
      throw new Error(`Migration journal entry ${entry.tag} has unsupported Drizzle metadata`);
    }
    if (!Number.isSafeInteger(entry.when)
      || (previous && entry.when <= previous.when)
      || entry.when > Date.now() + 5 * 60 * 1000) {
      throw new Error(`Migration journal timestamp for ${entry.tag} is invalid, non-increasing, or future-dated`);
    }
  }

  const manifestTags = Object.keys(immutableMigrationHashes);
  if (JSON.stringify(manifestTags) !== JSON.stringify(tags)) {
    throw new Error("Immutable migration hash manifest must exactly match journal order; append the reviewed tip only");
  }

  const mutationSummary = [];
  for (const migrationFile of migrationFiles) {
    const tag = migrationFile.replace(/\.sql$/, "");
    const sql = await readFile(path.join(migrationsDir, migrationFile), "utf8");
    const actualHash = sha256(sql);
    if (actualHash !== immutableMigrationHashes[tag]) {
      throw new Error(`Append-only violation: ${migrationFile} SHA-256 is ${actualHash}, expected ${immutableMigrationHashes[tag]}`);
    }

    const withoutComments = sql
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*--.*$/gm, " ");
    const matches = mutatingPatterns
      .map(([label, pattern]) => [label, Array.from(withoutComments.matchAll(pattern)).length])
      .filter(([, count]) => count > 0);
    if (matches.length > 0) {
      if (!destructiveMigrationReviews[tag]) {
        throw new Error(`Migration ${migrationFile} contains unreviewed mutating SQL: ${matches.map(([label, count]) => `${label}=${count}`).join(", ")}`);
      }
      mutationSummary.push(`${tag}[${matches.map(([label, count]) => `${label}:${count}`).join(",")}]`);
    } else if (destructiveMigrationReviews[tag]) {
      throw new Error(`Stale destructive-migration review record for ${tag}; detector found no mutating SQL`);
    }
  }

  let baseMessage = "base comparison not requested";
  if (baseRef) {
    execFileSync("git", ["rev-parse", "--verify", `${baseRef}^{commit}`], {
      cwd: appDir,
      stdio: "ignore",
    });
    const baseJournal = JSON.parse(gitFile(baseRef, "migrations/meta/_journal.json"));
    const baseEntries = Array.isArray(baseJournal.entries) ? baseJournal.entries : [];
    if (baseEntries.length > entries.length
      || JSON.stringify(entries.slice(0, baseEntries.length)) !== JSON.stringify(baseEntries)) {
      throw new Error(`Append-only violation: journal is not an exact extension of ${baseRef}`);
    }
    for (const entry of baseEntries) {
      const oldSql = gitFile(baseRef, `migrations/${entry.tag}.sql`);
      const currentSql = await readFile(path.join(migrationsDir, `${entry.tag}.sql`), "utf8");
      if (sha256(oldSql) !== sha256(currentSql)) {
        throw new Error(`Append-only violation: ${entry.tag}.sql differs from ${baseRef}`);
      }
    }
    baseMessage = `${baseEntries.length} immutable base entries + ${entries.length - baseEntries.length} appended`;
  }

  console.log(`[static-migrations] journal/files: ${entries.length} exact ordered entries`);
  console.log(`[static-migrations] immutable SHA-256 manifest: ${entries.length}/${entries.length} exact matches`);
  console.log(`[static-migrations] append-only: ${baseMessage}`);
  console.log(`[static-migrations] reviewed mutating migrations: ${mutationSummary.length} (${mutationSummary.join(" ")})`);
  console.log(`[static-migrations] tip: idx=${entries.at(-1).idx} tag=${entries.at(-1).tag}`);
  console.log("[static-migrations] PASS");

  return migrationFiles;
}

const { staticOnly, baseRef } = parseArguments(process.argv.slice(2));
const migrationFiles = await runStaticValidation(baseRef);
if (staticOnly) process.exit(0);

const sourceUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");

const parsedUrl = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(parsedUrl.hostname)) {
  throw new Error("Migration execution validation is restricted to local PostgreSQL hosts");
}

const schemaName = `octamy_migration_check_${process.pid}_${Date.now()}`;
const quotedSchemaName = `"${schemaName.replaceAll('"', '""')}"`;
const client = new Client({ connectionString: parsedUrl.toString() });
let transactionOpen = false;

try {
  await client.connect();
  await client.query("BEGIN");
  transactionOpen = true;
  await client.query(`CREATE SCHEMA ${quotedSchemaName}`);
  await client.query(`SET LOCAL search_path TO ${quotedSchemaName}, pg_catalog`);

  for (const migrationFile of migrationFiles) {
    const migrationSql = await readFile(path.join(migrationsDir, migrationFile), "utf8");
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
        to_regclass($6) IS NOT NULL AS candidate_evidence_grants,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = $7 AND table_name = 'courses' AND column_name = 'review_status'
        ) AS course_review_status,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = $7 AND table_name = 'certificates' AND column_name = 'scheduled_attempt_id'
        ) AS scheduled_certificate_link,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = $7 AND table_name = 'exam_instance_attempts' AND column_name = 'invitation_id'
        ) AS invitation_attempt_link
    `,
    [
      `${schemaName}.audience_bands`,
      `${schemaName}.course_audience_bands`,
      `${schemaName}.exam_instance_attempt_items`,
      `${schemaName}.subscription_benefit_usages`,
      `${schemaName}.exam_instance_invitations`,
      `${schemaName}.candidate_evidence_grants`,
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
  if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
  await client.end().catch(() => undefined);
}
