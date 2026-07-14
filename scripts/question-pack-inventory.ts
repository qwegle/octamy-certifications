#!/usr/bin/env node

import "dotenv/config";

import process from "node:process";
import { parseArgs } from "node:util";
import pg from "pg";

const { Client } = pg;

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      bank: { type: "string" },
    },
    allowPositionals: false,
  });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!values.source) throw new Error("--source <source-key> is required");
  if (!values.bank) throw new Error("--bank <bank-slug> is required");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(
      `WITH selected AS (
         SELECT s.id AS source_id, s.source_key, s.name AS source_name,
                s.rights_review_status, b.id AS bank_id, b.slug AS bank_slug,
                b.name AS bank_name, b.visibility, b.question_count
           FROM question_pack_sources s
           JOIN question_banks b
             ON b.slug = $2 AND b.owner_type = 'admin' AND b.owner_id IS NULL
          WHERE s.source_key = $1
       ), inventory AS (
         SELECT q.review_status, q.is_active, q.generation_source,
                count(*)::integer AS count
           FROM selected s
           JOIN questions q ON q.bank_id = s.bank_id
          GROUP BY q.review_status, q.is_active, q.generation_source
       ), provenance AS (
         SELECT count(*)::integer AS linked_records,
                count(DISTINCT p.question_id)::integer AS linked_questions
           FROM selected s
           LEFT JOIN question_provenance p ON p.source_id = s.source_id
       )
       SELECT jsonb_build_object(
         'source', (SELECT to_jsonb(selected) - 'source_id' - 'bank_id' FROM selected),
         'inventory', COALESCE((SELECT jsonb_agg(to_jsonb(inventory) ORDER BY review_status, is_active) FROM inventory), '[]'::jsonb),
         'provenance', (SELECT to_jsonb(provenance) FROM provenance),
         'importRuns', COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id', r.id, 'status', r.status, 'inputSha256', r.input_sha256,
             'totalRows', r.total_rows, 'processedRows', r.processed_rows,
             'insertedQuestions', r.inserted_questions,
             'linkedProvenance', r.linked_provenance,
             'startedAt', r.started_at, 'completedAt', r.completed_at
           ) ORDER BY r.id DESC)
             FROM question_pack_import_runs r
             JOIN selected s ON s.source_id = r.source_id AND s.bank_id = r.bank_id
         ), '[]'::jsonb)
       ) AS report`,
      [values.source, values.bank],
    );
    process.stdout.write(`${JSON.stringify(result.rows[0]?.report ?? null, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
