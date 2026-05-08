// One-time backfill: assign every legacy `questions` row (no bankId) to a
// global admin "Legacy" question bank. Idempotent — safe to re-run.
import "dotenv/config";
import { db } from "../server/db";
import { questionBanks, questions } from "../shared/schema";
import { eq, isNull, sql } from "drizzle-orm";

async function main() {
  console.log("Starting legacy questions backfill…");

  // 1. Find or create the Legacy admin bank.
  let [legacy] = await db
    .select()
    .from(questionBanks)
    .where(sql`${questionBanks.ownerType} = 'admin' and ${questionBanks.ownerId} is null and ${questionBanks.slug} = 'legacy'`);

  if (!legacy) {
    [legacy] = await db
      .insert(questionBanks)
      .values({
        name: "Legacy",
        slug: "legacy",
        description: "Auto-created bank for pre-P1 questions tied directly to admin courses.",
        ownerType: "admin",
        ownerId: null,
        visibility: "private",
        language: "en",
        tags: ["legacy"],
      } as any)
      .returning();
    console.log(`Created Legacy bank id=${legacy.id}`);
  } else {
    console.log(`Legacy bank exists id=${legacy.id}`);
  }

  // 2. Assign all orphan questions (no bankId) to it.
  const result = await db
    .update(questions)
    .set({ bankId: legacy.id })
    .where(isNull(questions.bankId));
  // node-postgres returns rowCount on the underlying result
  const rowCount = (result as any).rowCount ?? "?";
  console.log(`Backfilled ${rowCount} orphan questions to Legacy bank.`);

  // 3. Refresh denormalized count.
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(questions)
    .where(eq(questions.bankId, legacy.id));
  await db.update(questionBanks).set({ questionCount: Number(c) }).where(eq(questionBanks.id, legacy.id));
  console.log(`Legacy bank questionCount = ${c}`);

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
