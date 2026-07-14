#!/usr/bin/env node

import "dotenv/config";

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import { normalizeQuestionPackManifest } from "./lib/question-pack-contract";

const { Client } = pg;
const MAX_MANIFEST_BYTES = 256 * 1024;

export async function registerQuestionPackSource(options: {
  databaseUrl: string;
  manifestPath: string;
  operator: string;
  confirmRights: boolean;
}) {
  const operator = options.operator.trim();
  if (operator.length < 3 || operator.length > 200) {
    throw new Error("--operator must identify the rights reviewer in 3-200 characters");
  }
  if (!options.confirmRights) {
    throw new Error("--confirm-rights is required; source rights must be explicitly reviewed before registration");
  }

  const manifestPath = path.resolve(options.manifestPath);
  const manifestHandle = await open(manifestPath, constants.O_RDONLY | constants.O_NOFOLLOW).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new Error("Manifest path must not be a symbolic link");
    }
    throw error;
  });
  let manifestBytes: Buffer;
  try {
    const manifestStat = await manifestHandle.stat();
    if (!manifestStat.isFile() || manifestStat.size > MAX_MANIFEST_BYTES) {
      throw new Error(`Manifest must be a regular local JSON file no larger than ${MAX_MANIFEST_BYTES} bytes`);
    }
    manifestBytes = await manifestHandle.readFile();
    if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
      throw new Error(`Manifest must be no larger than ${MAX_MANIFEST_BYTES} bytes`);
    }
  } finally {
    await manifestHandle.close();
  }
  let manifestText: string;
  try {
    manifestText = new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes);
  } catch {
    throw new Error("Manifest must be valid UTF-8 JSON");
  }
  const rawManifest = JSON.parse(manifestText);
  const normalized = normalizeQuestionPackManifest(rawManifest);
  if (!normalized.ok) {
    throw new Error(`Rights manifest is not eligible:\n- ${normalized.errors.join("\n- ")}`);
  }
  const { manifest, manifestSha256 } = normalized.value;

  const client = new Client({ connectionString: options.databaseUrl });
  await client.connect();
  try {
    const inserted = await client.query<{ id: number }>(
      `
        INSERT INTO question_pack_sources (
          source_key, name, publisher, dataset_version, description,
          source_url, retrieved_at, manifest_sha256,
          license_identifier, license_name, license_url, rights_basis,
          commercial_use_allowed, derivatives_allowed, share_alike_obligation,
          attribution_text, evidence_reference, provenance,
          rights_review_status, rights_reviewed_at, rights_reviewed_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          true, true, $13,
          $14, $15, $16::jsonb,
          'verified', NOW(), $17
        )
        ON CONFLICT (source_key) DO NOTHING
        RETURNING id
      `,
      [
        manifest.sourceKey,
        manifest.name,
        manifest.publisher,
        manifest.datasetVersion,
        manifest.description ?? null,
        manifest.sourceUrl,
        new Date(manifest.retrievedAt),
        manifestSha256,
        manifest.license.identifier,
        manifest.license.name,
        manifest.license.url,
        manifest.license.rightsBasis,
        manifest.license.shareAlikeObligation,
        manifest.license.attributionText,
        manifest.license.evidenceReference,
        JSON.stringify({
          schemaVersion: manifest.schemaVersion,
          ...manifest.provenance,
        }),
        operator,
      ],
    );

    if (inserted.rows[0]) {
      return {
        status: "registered" as const,
        id: inserted.rows[0].id,
        sourceKey: manifest.sourceKey,
        manifestSha256,
        rightsReviewStatus: "verified" as const,
      };
    }

    const existing = await client.query<{
      id: number;
      manifest_sha256: string;
      rights_review_status: string;
    }>(
      `SELECT id, manifest_sha256, rights_review_status
         FROM question_pack_sources
        WHERE source_key = $1`,
      [manifest.sourceKey],
    );
    const row = existing.rows[0];
    if (!row) throw new Error("Source registration raced but no existing source could be loaded");
    if (row.manifest_sha256 !== manifestSha256) {
      throw new Error(
        "SOURCE_MANIFEST_IMMUTABLE: this sourceKey already has a different rights manifest; use a new versioned sourceKey",
      );
    }
    if (row.rights_review_status !== "verified") {
      throw new Error("Existing source rights are not verified; registration cannot silently override a review decision");
    }
    return {
      status: "already_registered" as const,
      id: row.id,
      sourceKey: manifest.sourceKey,
      manifestSha256,
      rightsReviewStatus: "verified" as const,
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string" },
      operator: { type: "string" },
      "confirm-rights": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!values.manifest) throw new Error("--manifest <local-manifest.json> is required");
  if (!values.operator) throw new Error("--operator <rights-reviewer> is required");

  const result = await registerQuestionPackSource({
    databaseUrl: process.env.DATABASE_URL,
    manifestPath: values.manifest,
    operator: values.operator,
    confirmRights: values["confirm-rights"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/register-question-pack-source\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
