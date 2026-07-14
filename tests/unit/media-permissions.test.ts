import { describe, expect, it } from "@jest/globals";
import type { UserContext } from "../../server/lib/qb-permissions";
import { canManageMediaLibrary } from "../../server/lib/media-permissions";

function context(overrides: Partial<UserContext> = {}): UserContext {
  return {
    user: { isAdmin: false } as UserContext["user"],
    creatorId: null,
    instituteRoles: new Map(),
    ...overrides,
  };
}

describe("media library author-workspace policy", () => {
  it("allows platform administrators and creator workspaces", () => {
    expect(canManageMediaLibrary(context({
      user: { isAdmin: true } as UserContext["user"],
    }))).toBe(true);
    expect(canManageMediaLibrary(context({ creatorId: 44 }))).toBe(true);
  });

  it.each(["owner", "admin", "teacher"])(
    "allows an active institute %s",
    (role) => {
      expect(canManageMediaLibrary(context({
        instituteRoles: new Map([[9, role]]),
      }))).toBe(true);
    },
  );

  it("denies learners and institute staff", () => {
    expect(canManageMediaLibrary(context())).toBe(false);
    expect(canManageMediaLibrary(context({
      instituteRoles: new Map([[9, "staff"]]),
    }))).toBe(false);
  });

  it("fails closed for unknown institute roles", () => {
    expect(canManageMediaLibrary(context({
      instituteRoles: new Map([[9, "legacy-supervisor"]]),
    }))).toBe(false);
  });
});
