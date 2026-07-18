#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";
import { INTERVIEW_STUDIO_CATALOG } from "../server/content/interview-studio-catalog";
import {
  canonicalizeInterviewStudioBlueprint,
  interviewStudioBlueprintSchema,
  type InterviewStudioBlueprint,
} from "../shared/interview-studio";

const { Client } = pg;
const CATALOG_LOCK_ID = "5065497136023552";
export const INTERVIEW_STUDIO_SYNC_CONFIRMATION = "INTERVIEW_STUDIO";

export type ExistingInterviewStudioTemplate = {
  id: number;
  templateKey: string;
  version: number;
  ownerType: string;
  ownerId: number | null;
  title: string;
  summary: string;
  state: string;
  isCurrent: boolean;
  supportedModes: unknown;
  rubricVersion: string;
  blueprint: unknown;
  blueprintHash: string;
  publishedAt: Date | string | null;
};

export type InterviewStudioCatalogPlanEntry = {
  templateKey: string;
  version: number;
  blueprintHash: string;
  action: "insert_and_activate" | "activate_existing" | "already_current";
  priorCurrentVersions: number[];
};

export type InterviewStudioCatalogPlan = {
  entries: InterviewStudioCatalogPlanEntry[];
  insertions: number;
  activations: number;
  alreadyCurrent: number;
};

export type InterviewStudioCatalogSyncResult = InterviewStudioCatalogPlan & {
  mode: "dry_run" | "applied";
};

/** Uses the identical canonical input and SHA-256 encoding as the runtime. */
export function interviewStudioBlueprintHash(input: unknown): string {
  return createHash("sha256")
    .update(canonicalizeInterviewStudioBlueprint(input), "utf8")
    .digest("hex");
}

function sortedModes(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((mode) => typeof mode !== "string")) {
    throw new Error(`INTERVIEW_TEMPLATE_CONFLICT: ${label} has invalid supported modes`);
  }
  return [...value].sort();
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertMatchingExistingVersion(
  blueprint: InterviewStudioBlueprint,
  expectedHash: string,
  row: ExistingInterviewStudioTemplate,
): void {
  const label = `${blueprint.templateKey}@${blueprint.version}`;
  let existingBlueprint: InterviewStudioBlueprint;
  try {
    existingBlueprint = interviewStudioBlueprintSchema.parse(row.blueprint);
  } catch {
    throw new Error(`INTERVIEW_TEMPLATE_CONFLICT: ${label} contains an invalid stored blueprint`);
  }
  const storedContentHash = interviewStudioBlueprintHash(existingBlueprint);
  if (row.blueprintHash !== storedContentHash) {
    throw new Error(`INTERVIEW_TEMPLATE_INTEGRITY_FAILED: ${label} stored hash does not match its blueprint`);
  }

  const immutableMetadataMatches = row.ownerType === "admin"
    && row.ownerId === null
    && row.title === blueprint.title
    && row.summary === blueprint.summary
    && row.rubricVersion === blueprint.rubricVersion
    && row.blueprintHash === expectedHash
    && sameStrings(
      sortedModes(row.supportedModes, label),
      [...blueprint.allowedModes].sort(),
    );
  if (!immutableMetadataMatches) {
    throw new Error(
      `INTERVIEW_TEMPLATE_CONFLICT: ${label} already exists with different immutable catalog content`,
    );
  }
  if (row.state === "retired") {
    throw new Error(`INTERVIEW_TEMPLATE_CONFLICT: ${label} is retired and cannot be silently republished`);
  }
  if (!["draft", "published"].includes(row.state)) {
    throw new Error(`INTERVIEW_TEMPLATE_CONFLICT: ${label} has unsupported state ${row.state}`);
  }
  if (row.state === "published" && row.publishedAt == null) {
    throw new Error(`INTERVIEW_TEMPLATE_INTEGRITY_FAILED: ${label} is published without publishedAt`);
  }
  if (row.isCurrent && row.state !== "published") {
    throw new Error(`INTERVIEW_TEMPLATE_INTEGRITY_FAILED: ${label} is current but not published`);
  }
}

export function planInterviewStudioCatalog(
  catalogInput: readonly unknown[],
  existingRows: readonly ExistingInterviewStudioTemplate[],
): InterviewStudioCatalogPlan {
  const catalog = catalogInput.map((blueprint) => interviewStudioBlueprintSchema.parse(blueprint));
  const catalogKeys = new Set<string>();
  const entries: InterviewStudioCatalogPlanEntry[] = [];

  for (const blueprint of catalog) {
    if (catalogKeys.has(blueprint.templateKey)) {
      throw new Error(
        `INTERVIEW_CATALOG_DUPLICATE_KEY: ${blueprint.templateKey} has more than one catalog version`,
      );
    }
    catalogKeys.add(blueprint.templateKey);

    const rows = existingRows.filter((row) => row.templateKey === blueprint.templateKey);
    const versions = new Set<number>();
    for (const row of rows) {
      if (versions.has(row.version)) {
        throw new Error(
          `INTERVIEW_TEMPLATE_INTEGRITY_FAILED: duplicate ${blueprint.templateKey}@${row.version} rows`,
        );
      }
      versions.add(row.version);
    }
    const currentRows = rows.filter((row) => row.isCurrent);
    if (currentRows.length > 1) {
      throw new Error(
        `INTERVIEW_TEMPLATE_INTEGRITY_FAILED: ${blueprint.templateKey} has multiple current versions`,
      );
    }
    const newer = rows.find((row) => row.version > blueprint.version);
    if (newer) {
      throw new Error(
        `INTERVIEW_CATALOG_VERSION_BEHIND: database has ${blueprint.templateKey}@${newer.version}, newer than catalog version ${blueprint.version}`,
      );
    }

    const expectedHash = interviewStudioBlueprintHash(blueprint);
    const target = rows.find((row) => row.version === blueprint.version);
    if (target) assertMatchingExistingVersion(blueprint, expectedHash, target);

    entries.push({
      templateKey: blueprint.templateKey,
      version: blueprint.version,
      blueprintHash: expectedHash,
      action: !target
        ? "insert_and_activate"
        : target.isCurrent
          ? "already_current"
          : "activate_existing",
      priorCurrentVersions: currentRows
        .filter((row) => row.version !== blueprint.version)
        .map((row) => row.version)
        .sort((left, right) => left - right),
    });
  }

  return {
    entries,
    insertions: entries.filter((entry) => entry.action === "insert_and_activate").length,
    activations: entries.filter((entry) => entry.action !== "already_current").length,
    alreadyCurrent: entries.filter((entry) => entry.action === "already_current").length,
  };
}

export async function syncInterviewStudioCatalog(options: {
  databaseUrl: string;
  apply: boolean;
  confirm?: string;
}): Promise<InterviewStudioCatalogSyncResult> {
  if (options.apply && options.confirm !== INTERVIEW_STUDIO_SYNC_CONFIRMATION) {
    throw new Error(
      `Writes require --apply --confirm ${INTERVIEW_STUDIO_SYNC_CONFIRMATION}`,
    );
  }

  const catalog = INTERVIEW_STUDIO_CATALOG.map((blueprint) =>
    interviewStudioBlueprintSchema.parse(blueprint));
  const templateKeys = catalog.map((blueprint) => blueprint.templateKey);
  const client = new Client({ connectionString: options.databaseUrl });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [CATALOG_LOCK_ID]);

    const schema = await client.query<{ templates_table: string | null }>(
      "SELECT to_regclass('interview_studio_templates')::text AS templates_table",
    );
    if (!schema.rows[0]?.templates_table) {
      throw new Error("Migration 0025_interview_studio must be applied before catalog synchronization");
    }

    const existingResult = await client.query<{
      id: number;
      template_key: string;
      version: number;
      owner_type: string;
      owner_id: number | null;
      title: string;
      summary: string;
      state: string;
      is_current: boolean;
      supported_modes: unknown;
      rubric_version: string;
      blueprint: unknown;
      blueprint_hash: string;
      published_at: Date | null;
    }>(
      `SELECT id, template_key, version, owner_type, owner_id, title, summary,
              state, is_current, supported_modes, rubric_version, blueprint,
              blueprint_hash, published_at
         FROM interview_studio_templates
        WHERE template_key = ANY($1::text[])
        ORDER BY template_key, version
        FOR UPDATE`,
      [templateKeys],
    );
    const existingRows: ExistingInterviewStudioTemplate[] = existingResult.rows.map((row) => ({
      id: row.id,
      templateKey: row.template_key,
      version: row.version,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      title: row.title,
      summary: row.summary,
      state: row.state,
      isCurrent: row.is_current,
      supportedModes: row.supported_modes,
      rubricVersion: row.rubric_version,
      blueprint: row.blueprint,
      blueprintHash: row.blueprint_hash,
      publishedAt: row.published_at,
    }));
    const plan = planInterviewStudioCatalog(catalog, existingRows);

    if (options.apply) {
      const blueprintByKey = new Map(catalog.map((blueprint) => [blueprint.templateKey, blueprint]));
      for (const entry of plan.entries) {
        const blueprint = blueprintByKey.get(entry.templateKey);
        if (!blueprint) throw new Error(`Catalog blueprint disappeared for ${entry.templateKey}`);

        if (entry.action === "insert_and_activate") {
          await client.query(
            `INSERT INTO interview_studio_templates (
               template_key, version, owner_type, owner_id, title, summary,
               state, is_current, supported_modes, rubric_version, blueprint,
               blueprint_hash, published_at, created_by, created_at, updated_at
             ) VALUES (
               $1, $2, 'admin', NULL, $3, $4,
               'published', false, $5::jsonb, $6, $7::jsonb,
               $8, now(), NULL, now(), now()
             )`,
            [
              blueprint.templateKey,
              blueprint.version,
              blueprint.title,
              blueprint.summary,
              JSON.stringify(blueprint.allowedModes),
              blueprint.rubricVersion,
              JSON.stringify(blueprint),
              entry.blueprintHash,
            ],
          );
        }

        if (entry.action !== "already_current") {
          // Only the lifecycle pointer changes on earlier published versions;
          // their immutable prompt, rubric, hash, and publication evidence stay
          // untouched for existing session snapshots.
          await client.query(
            `UPDATE interview_studio_templates
                SET is_current = false, updated_at = now()
              WHERE template_key = $1
                AND version <> $2
                AND is_current = true`,
            [blueprint.templateKey, blueprint.version],
          );
          const activated = await client.query<{ id: number }>(
            `UPDATE interview_studio_templates
                SET state = 'published',
                    is_current = true,
                    published_at = COALESCE(published_at, now()),
                    updated_at = now()
              WHERE template_key = $1
                AND version = $2
                AND state IN ('draft', 'published')
              RETURNING id`,
            [blueprint.templateKey, blueprint.version],
          );
          if (activated.rowCount !== 1) {
            throw new Error(
              `INTERVIEW_TEMPLATE_ACTIVATION_FAILED: expected one ${blueprint.templateKey}@${blueprint.version} row`,
            );
          }
        }
      }
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }

    return {
      mode: options.apply ? "applied" : "dry_run",
      ...plan,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      confirm: { type: "string" },
    },
    allowPositionals: false,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const result = await syncInterviewStudioCatalog({
    databaseUrl: process.env.DATABASE_URL,
    apply: values.apply ?? false,
    confirm: values.confirm,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (/sync-interview-studio-catalog\.(?:c?js|ts)$/.test(path.basename(process.argv[1] ?? ""))) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
