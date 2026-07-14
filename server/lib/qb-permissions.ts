import { db } from "../db";
import { creators, instituteMembers, users } from "@shared/schema";
import type { QuestionBank, User } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface RequestUser {
  userId: number;
  email?: string;
  isAdmin?: boolean;
}

export interface UserContext {
  user: User;
  creatorId: number | null;
  instituteRoles: Map<number, string>; // instituteId -> role
}

export async function loadUserContext(userId: number): Promise<UserContext | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const [creatorRow] = await db.select().from(creators).where(eq(creators.userId, userId));
  const memberships = await db.select().from(instituteMembers).where(and(
    eq(instituteMembers.userId, userId),
    eq(instituteMembers.status, "active"),
  ));
  const map = new Map<number, string>();
  for (const m of memberships) map.set(m.instituteId, m.role);
  return {
    user,
    creatorId: creatorRow?.id ?? null,
    instituteRoles: map,
  };
}

export function canEditBank(ctx: UserContext, bank: QuestionBank): boolean {
  if (bank.ownerType === "admin") return !!ctx.user.isAdmin;
  if (bank.ownerType === "creator") {
    return !!ctx.user.isAdmin
      || (bank.ownerId != null && ctx.creatorId === bank.ownerId);
  }
  if (bank.ownerType === "institute") {
    if (ctx.user.isAdmin) return true;
    if (bank.ownerId == null) return false;
    const role = ctx.instituteRoles.get(bank.ownerId);
    return role === "owner" || role === "admin" || role === "teacher";
  }
  // Fail closed for legacy/corrupt owner types. A platform admin can repair the
  // row through an explicit administration workflow, not an authoring route.
  return false;
}

export function canViewBank(ctx: UserContext, bank: QuestionBank): boolean {
  // Question-bank contents include answer keys and explanations. Assessment
  // discovery is public; authoring banks are not. Visibility may later support
  // an explicit template-sharing workflow, but it must never expose live keys.
  return canEditBank(ctx, bank);
}

/** Listing is stricter than direct-link access: unlisted banks must not be
 * discoverable outside their owner workspace. */
export function canListBank(ctx: UserContext, bank: QuestionBank): boolean {
  return canEditBank(ctx, bank);
}

export function canCreateBankFor(ctx: UserContext, ownerType: string, ownerId: number | null): boolean {
  if (ownerType === "admin") return !!ctx.user.isAdmin;
  if (ownerType === "creator") return ownerId != null && ctx.creatorId === ownerId;
  if (ownerType === "institute") {
    if (ownerId == null) return false;
    const role = ctx.instituteRoles.get(ownerId);
    return !!role && role !== "staff";
  }
  return false;
}

// Plan limits
export interface BankLimits {
  maxBanks: number; // -1 = unlimited
  maxQuestionsPerBank: number;
}

export function getCreatorLimits(plan: string | null | undefined): BankLimits {
  switch (plan) {
    case "premium": return { maxBanks: -1, maxQuestionsPerBank: -1 };
    case "pro": return { maxBanks: 10, maxQuestionsPerBank: 1000 };
    default: return { maxBanks: 1, maxQuestionsPerBank: 50 };
  }
}
