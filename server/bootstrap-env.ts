// Loaded BEFORE any other module that reads process.env.
// ESM hoists imports; importing this module first guarantees dotenv runs
// before downstream constructors (e.g. payumoney.ts) that read env at module load.
import dotenv from "dotenv";
import crypto from "node:crypto";
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

const isProd = process.env.NODE_ENV === "production";

// Fail fast on critical secrets in production
if (isProd) {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your-secret-key" || process.env.JWT_SECRET.length < 24) {
    missing.push("JWT_SECRET (must be set, not the default placeholder, and >= 24 chars)");
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 24) {
    missing.push("SESSION_SECRET (must be set and >= 24 chars)");
  }
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.error(
      `[bootstrap-env] FATAL: missing/insecure required production env vars:\n  - ${missing.join("\n  - ")}`
    );
    process.exit(1);
  }
} else {
  // Dev/test convenience: if secrets aren't set locally, generate a per-boot
  // random value so existing `process.env.JWT_SECRET!` reads work. Tokens are
  // invalidated on restart in dev, which is the desired behaviour.
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "your-secret-key") {
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  }
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = crypto.randomBytes(48).toString("hex");
  }
}

