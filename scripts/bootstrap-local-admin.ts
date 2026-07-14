#!/usr/bin/env node

import "dotenv/config";

import process from "node:process";
import bcrypt from "bcrypt";
import pg from "pg";

const { Client } = pg;
const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = String(process.env.ADMIN_EMAIL ?? "").trim().toLocaleLowerCase("en");
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const parsedUrl = new URL(databaseUrl);
  if (process.env.NODE_ENV === "production" || !LOCAL_DATABASE_HOSTS.has(parsedUrl.hostname)) {
    throw new Error("This bootstrap is local-only and refuses production or non-local databases");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("ADMIN_EMAIL must be a valid email address");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
  const rounds = Math.max(10, Math.min(14, Number(process.env.BCRYPT_ROUNDS) || 12));
  const passwordHash = await bcrypt.hash(password, rounds);
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ id: number; email: string; is_admin: boolean }>(
      `INSERT INTO users (email, password, name, is_admin)
       VALUES ($1, $2, 'Local Admin', true)
       ON CONFLICT (email) DO UPDATE SET
         password = EXCLUDED.password,
         is_admin = true,
         updated_at = NOW()
       RETURNING id, email, is_admin`,
      [email, passwordHash],
    );
    process.stdout.write(`${JSON.stringify({
      status: "local_admin_ready",
      id: result.rows[0]?.id,
      email: result.rows[0]?.email,
      loginUrl: `${String(process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "")}/admin/login`,
    }, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
