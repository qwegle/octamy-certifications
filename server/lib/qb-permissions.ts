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
  const memberships = await db.select().from(instituteMembers).where(eq(instituteMembers.userId, userId));
  const map = new Map<number, string>();
  for (const m of memberships) map.set(m.instituteId, m.role);
  return {
    user,
    creatorId: creatorRow?.id ?? null,
    instituteRoles: map,
  };
}

export function canEditBank(ctx: UserContext, bank: QuestionBank): boolean {
  if (ctx.user.isAdmin) return true;
  if (bank.ownerType === "creator" && bank.ownerId != null && ctx.creatorId === bank.ownerId) return true;
  if (bank.ownerType === "institute" && bank.ownerId != null) {
    const role = ctx.instituteRoles.get(bank.ownerId);
    if (role && role !== "staff") return true;
  }
  return false;
}

export function canViewBank(ctx: UserContext, bank: QuestionBank): boolean {
  if (bank.visibility === "public") return true;
  if (canEditBank(ctx, bank)) return true;
  // unlisted: callers must have a direct id reference (route uses :id) — allow
  if (bank.visibility === "unlisted") return true;
  return false;
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
