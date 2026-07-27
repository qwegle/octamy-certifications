import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";

describe("mobile release privacy invariants", () => {
  it("revokes the runtime token before fallible local cleanup", async () => {
    const source = await readFile(path.resolve("mobile/src/features/auth/SessionProvider.tsx"), "utf8");
    const invalidationStart = source.indexOf("const invalidateLocalSession");
    const refreshStart = source.indexOf("const refreshSession", invalidationStart);
    const invalidation = source.slice(invalidationStart, refreshStart);
    expect(invalidation.indexOf("activeToken = null")).toBeGreaterThan(-1);
    expect(invalidation.indexOf("activeToken = null")).toBeLessThan(invalidation.indexOf("Promise.allSettled"));

    const signOutStart = source.indexOf("const signOut");
    const valueStart = source.indexOf("const value", signOutStart);
    const signOut = source.slice(signOutStart, valueStart);
    expect(signOut).toContain("await invalidateLocalSession(userId)");
    expect(signOut).not.toContain("await purgeUserScopedLocalData");
    expect(signOut).not.toContain("await clearStoredSession");

    const unauthorizedBranches = [...source.matchAll(/status === 401\)[\s\S]{0,160}/g)];
    expect(unauthorizedBranches).toHaveLength(2);
    unauthorizedBranches.forEach(([branch]) => expect(branch).toContain("invalidateLocalSession("));
  });

  it("normalizes mobile exam evidence at the API boundary", async () => {
    const source = await readFile(path.resolve("mobile/src/features/certifications/api.ts"), "utf8");
    const submitStart = source.indexOf("export async function submitCertificationExam");
    const nextFunction = source.indexOf("export async function", submitStart + 1);
    const submit = source.slice(submitStart, nextFunction);
    expect(submit).toContain("tabSwitches: normalizeMobileExamExitCount(input.tabSwitches)");
  });

  it("stores private recordings in cache and disables Android app-data backup", async () => {
    const [recordings, appConfig] = await Promise.all([
      readFile(path.resolve("mobile/src/features/interview/recordings.ts"), "utf8"),
      readFile(path.resolve("mobile/app.json"), "utf8"),
    ]);
    expect(recordings).toContain("Paths.cache");
    expect(recordings).not.toContain("Paths.document");
    expect(JSON.parse(appConfig).expo.android.allowBackup).toBe(false);
  });
});
