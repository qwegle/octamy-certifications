import "./bootstrap-env";
import { createComprehensiveSeed } from "./comprehensive-seed";
import { seedAdminCredentials } from "./seed-admin-credentials";
import { pool } from "./db";
import { assertDestructiveSeedAllowed } from "./lib/destructive-seed-guard";

async function main() {
  assertDestructiveSeedAllowed();
  // Reset partial seed state from broken basic seed. This is intentionally
  // reachable only after the explicit destructive-operation opt-in above.
  await pool.query("TRUNCATE TABLE questions, courses, categories RESTART IDENTITY CASCADE");
  console.log("→ createComprehensiveSeed");
  await createComprehensiveSeed();
  console.log("→ seedAdminCredentials");
  await seedAdminCredentials();
  await pool.end();
  console.log("✓ all seeds done");
}

main().catch((e) => { console.error(e); process.exit(1); });
