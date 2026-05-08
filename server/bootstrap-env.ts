// Loaded BEFORE any other module that reads process.env.
// ESM hoists imports; importing this module first guarantees dotenv runs
// before downstream constructors (e.g. payumoney.ts) that read env at module load.
import dotenv from "dotenv";
dotenv.config();

// Backwards-compat aliases: some code (server/payumoney.ts) reads PAYUMONEY_*,
// but the production .env uses the official PayU naming PAYU_*. Bridge both
// directions so either set works without code changes during rollout.
const aliases: Array<[string, string]> = [
  ["PAYUMONEY_MERCHANT_KEY", "PAYU_MERCHANT_KEY"],
  ["PAYUMONEY_SALT", "PAYU_MERCHANT_SALT"],
  ["PAYUMONEY_MERCHANT_ID", "PAYU_MERCHANT_ID"],
];
for (const [a, b] of aliases) {
  if (!process.env[a] && process.env[b]) process.env[a] = process.env[b];
  if (!process.env[b] && process.env[a]) process.env[b] = process.env[a];
}

// Fail fast on critical secrets in production
if (process.env.NODE_ENV === "production") {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your-secret-key") {
    missing.push("JWT_SECRET");
  }
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(
      `[bootstrap-env] FATAL: missing required production env vars: ${missing.join(", ")}`
    );
    process.exit(1);
  }
}
