import { describe, expect, it } from "@jest/globals";
import type { QuestionBank, User } from "@shared/schema";
import {
  canEditBank,
  canListBank,
  canViewBank,
  type UserContext,
} from "../../server/lib/qb-permissions";

function context(overrides: Partial<UserContext> = {}): UserContext {
  return {
    user: { id: 1, isAdmin: false } as User,
    creatorId: null,
    instituteRoles: new Map(),
    ...overrides,
  };
}

function bank(overrides: Partial<QuestionBank> = {}): QuestionBank {
  return {
    id: 9,
    ownerType: "admin",
    ownerId: null,
    visibility: "private",
    ...overrides,
  } as QuestionBank;
}

describe("question-bank answer-key permissions", () => {
  it.each(["public", "unlisted", "private"])(
    "does not expose a %s bank to an unrelated authenticated user",
    (visibility) => {
      const unrelated = context();
      const proprietary = bank({ visibility });

      expect(canViewBank(unrelated, proprietary)).toBe(false);
      expect(canListBank(unrelated, proprietary)).toBe(false);
      expect(canEditBank(unrelated, proprietary)).toBe(false);
    },
  );

  it("allows creator owners and platform admins to access authoring keys", () => {
    const creatorBank = bank({ ownerType: "creator", ownerId: 77, visibility: "public" });
    const creatorOwner = context({ creatorId: 77 });
    const admin = context({ user: { id: 2, isAdmin: true } as User });

    expect(canViewBank(creatorOwner, creatorBank)).toBe(true);
    expect(canListBank(creatorOwner, creatorBank)).toBe(true);
    expect(canViewBank(admin, creatorBank)).toBe(true);
  });

  it("permits institute teachers but not staff to read answer keys", () => {
    const instituteBank = bank({ ownerType: "institute", ownerId: 42 });
    const teacher = context({ instituteRoles: new Map([[42, "teacher"]]) });
    const staff = context({ instituteRoles: new Map([[42, "staff"]]) });

    expect(canViewBank(teacher, instituteBank)).toBe(true);
    expect(canViewBank(staff, instituteBank)).toBe(false);
    expect(canListBank(staff, instituteBank)).toBe(false);
  });

  it("fails closed for unknown institute roles and malformed owner types", () => {
    const instituteBank = bank({ ownerType: "institute", ownerId: 42 });
    const unknownRole = context({ instituteRoles: new Map([[42, "student"]]) });
    const admin = context({ user: { id: 2, isAdmin: true } as User });
    const malformed = bank({ ownerType: "legacy-unknown" });

    expect(canEditBank(unknownRole, instituteBank)).toBe(false);
    expect(canViewBank(admin, malformed)).toBe(false);
  });
});
