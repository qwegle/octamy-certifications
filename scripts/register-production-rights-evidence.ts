#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";

const { Client } = pg;
const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;
const SOURCE_PREFIX = "octamy-original:";

type SourceRow = {
  id: number;
  source_key: string;
  publisher: string;
  rights_basis: string;
  rights_review_status: string;
  evidence_reference: string;
  provenance: Record<string, unknown>;
};

type Evidence = {
  fileName: string;
  byteLength: number;
  sha256: string;
};

async function readEvidence(value: string): Promise<Evidence> {
  const evidencePath = path.resolve(value);
  const handle = await open(evidencePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error("Rights evidence path must not be a symbolic link");
    }
    throw error;
  });
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_EVIDENCE_BYTES) {
      throw new Error(`Rights evidence must be a non-empty regular file no larger than ${MAX_EVIDENCE_BYTES} bytes`);
    }
    const bytes = await handle.readFile();
    return {
      fileName: path.basename(evidencePath),
      byteLength: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } finally {
    await handle.close();
  }
}

function requiredIdentity(flag: string, value: string, max: number): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > max) {
    throw new Error(`${flag} must contain 3-${max} characters`);
  }
  return normalized;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function assertUnambiguouslyOctamyOriginal(row: SourceRow): void {
  const acquisitionMethod = row.provenance.acquisitionMethod;
  const chainOfTitle = row.provenance.chainOfTitle;
  if (!row.source_key.startsWith(SOURCE_PREFIX)
      || row.publisher.trim().toLowerCase() !== "octamy"
      || row.rights_basis !== "owned"
      || acquisitionMethod !== "first_party"
      || typeof chainOfTitle !== "string"
      || !/original first-party Octamy content/i.test(chainOfTitle)) {
    throw new Error(
      `THIRD_PARTY_OR_AMBIGUOUS_SOURCE_REFUSED: ${row.source_key} is not an unambiguous Octamy-original, owned, first-party source`,
    );
  }
  if (row.rights_review_status !== "verified") {
    throw new Error(
      `RIGHTS_REVIEW_STATUS_CONFLICT: ${row.source_key} is ${row.rights_review_status}, not verified; this command will not change a rights decision`,
    );
  }
  if (row.evidence_reference.trim().length < 8) {
    throw new Error(`RIGHTS_REFERENCE_REQUIRED: ${row.source_key} needs legal review to establish an evidence reference`);
  }
}

export async function registerProductionRightsEvidence(options: {
  databaseUrl: string;
  sourceKeys: string[];
  operator: string;
  acquiringEntity: string;
  evidenceFile: string;
  apply: boolean;
  confirmed: boolean;
}) {
  const operator = requiredIdentity("--operator", options.operator, 200);
  const acquiringEntity = requiredIdentity("--acquiring-entity", options.acquiringEntity, 240);
  const sourceKeys = [...new Set(options.sourceKeys.map((key) => key.trim()))];
  if (sourceKeys.length === 0 || sourceKeys.some((key) => !key)) {
    throw new Error("At least one --source <source-key> is required");
  }
  if (options.apply && !options.confirmed) {
    throw new Error("--apply requires --confirm-octamy-original-ownership");
  }
  const evidence = await readEvidence(options.evidenceFile);
  const client = new Client({
    connectionString: options.databaseUrl,
    application_name: "octamy-production-rights-evidence",
  });
  await client.connect();
  let transactionOpen = false;
  try {
    await client.query(options.apply ? "BEGIN" : "BEGIN READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '30s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const selected = await client.query<SourceRow>(
      `SELECT id, source_key, publisher, rights_basis, rights_review_status,
              evidence_reference, provenance
         FROM question_pack_sources
        WHERE source_key = ANY($1::text[])
        ORDER BY source_key${options.apply ? " FOR UPDATE" : ""}`,
      [sourceKeys],
    );
    const found = new Set(selected.rows.map((row) => row.source_key));
    const missing = sourceKeys.filter((key) => !found.has(key));
    if (missing.length) throw new Error(`SOURCE_NOT_FOUND: ${missing.join(", ")}`);

    const results: Array<Record<string, unknown>> = [];
    for (const row of selected.rows) {
      assertUnambiguouslyOctamyOriginal(row);
      const currentReview = asObject(row.provenance.rightsReview);
      const currentEntity = currentReview?.acquiringEntity;
      const currentHash = currentReview?.evidenceSha256;
      if (typeof currentEntity === "string" && currentEntity.trim() && currentEntity !== acquiringEntity) {
        throw new Error(`SOURCE_RIGHTS_EVIDENCE_IMMUTABLE: ${row.source_key} has a different acquiring entity`);
      }
      if (typeof currentHash === "string" && currentHash.trim() && currentHash !== evidence.sha256) {
        throw new Error(`SOURCE_RIGHTS_EVIDENCE_IMMUTABLE: ${row.source_key} has a different evidence SHA-256`);
      }

      const alreadyRecorded = currentEntity === acquiringEntity && currentHash === evidence.sha256;
      if (options.apply && !alreadyRecorded) {
        const rightsReview = {
          ...(currentReview ?? {}),
          acquiringEntity,
          evidenceFileName: evidence.fileName,
          evidenceByteLength: evidence.byteLength,
          evidenceSha256: evidence.sha256,
          evidenceRecordedBy: operator,
          evidenceRecordedAt: new Date().toISOString(),
        };
        const provenance = { ...row.provenance, rightsReview };
        const updated = await client.query(
          `UPDATE question_pack_sources
              SET provenance = $1::jsonb, updated_at = NOW()
            WHERE id = $2 AND rights_review_status = 'verified'
          RETURNING id`,
          [JSON.stringify(provenance), row.id],
        );
        if (updated.rowCount !== 1) throw new Error(`CONCURRENT_SOURCE_CHANGE: ${row.source_key}`);
      }
      results.push({
        sourceKey: row.source_key,
        action: alreadyRecorded ? "already_recorded" : options.apply ? "recorded" : "would_record",
        acquiringEntity,
        evidenceReference: row.evidence_reference,
        evidenceSha256: evidence.sha256,
      });
    }
    await client.query(options.apply ? "COMMIT" : "ROLLBACK");
    transactionOpen = false;
    return { mode: options.apply ? "apply" : "dry-run", operator, evidence, sources: results };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string", multiple: true },
      operator: { type: "string" },
      "acquiring-entity": { type: "string" },
      "evidence-file": { type: "string" },
      apply: { type: "boolean", default: false },
      "confirm-octamy-original-ownership": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!values.operator) throw new Error("--operator <identity> is required");
  if (!values["acquiring-entity"]) throw new Error("--acquiring-entity <legal-entity> is required");
  if (!values["evidence-file"]) throw new Error("--evidence-file <local-file> is required");

  const result = await registerProductionRightsEvidence({
    databaseUrl: process.env.DATABASE_URL,
    sourceKeys: values.source ?? [],
    operator: values.operator,
    acquiringEntity: values["acquiring-entity"],
    evidenceFile: values["evidence-file"],
    apply: values.apply === true,
    confirmed: values["confirm-octamy-original-ownership"] === true,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/register-production-rights-evidence\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
