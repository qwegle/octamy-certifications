import { describe, expect, it } from "@jest/globals";
import path from "node:path";
import {
  decideLessonContentAccess,
  inlineContentDisposition,
  isCourseAvailableForNewAccess,
  isDirectPublicMediaKind,
  parseSingleByteRange,
  resolveLocalMediaPath,
} from "../../server/lib/protected-media";

const baseFacts = {
  isManager: false,
  hasEntitlement: false,
  isPreview: false,
  courseIsActive: true,
  courseIsPublic: true,
  courseIsApproved: true,
};

describe("protected lesson media policy", () => {
  it("allows a public preview only on an active, approved public course", () => {
    expect(decideLessonContentAccess({ ...baseFacts, isPreview: true }, false)).toEqual({
      allowed: true,
      basis: "preview",
    });
    expect(decideLessonContentAccess({ ...baseFacts, isPreview: true, courseIsApproved: false }, false).allowed).toBe(false);
    expect(decideLessonContentAccess({ ...baseFacts, isPreview: true, courseIsPublic: false }, false).allowed).toBe(false);
  });

  it("allows current entitlements and managers, including non-public courses", () => {
    expect(decideLessonContentAccess({ ...baseFacts, hasEntitlement: true, courseIsPublic: false }, true)).toEqual({
      allowed: true,
      basis: "entitlement",
    });
    expect(decideLessonContentAccess({ ...baseFacts, isManager: true, courseIsActive: false }, true)).toEqual({
      allowed: true,
      basis: "manager",
    });
  });

  it("does not let an entitlement bypass moderation suspension", () => {
    expect(decideLessonContentAccess({ ...baseFacts, hasEntitlement: true, courseIsApproved: false }, true).allowed).toBe(false);
    expect(decideLessonContentAccess({ ...baseFacts, hasEntitlement: true, courseIsActive: false }, true).allowed).toBe(false);
    expect(decideLessonContentAccess({ ...baseFacts, isManager: true, courseIsApproved: false }, true).allowed).toBe(true);
  });

  it("offers new enrolment or checkout only for approved public courses", () => {
    expect(isCourseAvailableForNewAccess({ isActive: true, visibility: "public", reviewStatus: "approved" })).toBe(true);
    expect(isCourseAvailableForNewAccess({ isActive: true, visibility: "unlisted", reviewStatus: "approved" })).toBe(false);
    expect(isCourseAvailableForNewAccess({ isActive: true, visibility: "public", reviewStatus: "pending" })).toBe(false);
    expect(isCourseAvailableForNewAccess({ isActive: false, visibility: "public", reviewStatus: "approved" })).toBe(false);
  });

  it("distinguishes unauthenticated and authenticated denials", () => {
    expect(decideLessonContentAccess(baseFacts, false).basis).toBe("authentication_required");
    expect(decideLessonContentAccess(baseFacts, true).basis).toBe("access_denied");
  });
});

describe("protected media byte ranges", () => {
  it("parses bounded, open-ended, and suffix byte ranges", () => {
    expect(parseSingleByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19, length: 10 });
    expect(parseSingleByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99, length: 10 });
    expect(parseSingleByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99, length: 10 });
    expect(parseSingleByteRange("bytes=90-999", 100)).toEqual({ start: 90, end: 99, length: 10 });
  });

  it("rejects malformed, multipart, and unsatisfiable ranges", () => {
    expect(parseSingleByteRange("bytes=100-", 100)).toBe("invalid");
    expect(parseSingleByteRange("bytes=20-10", 100)).toBe("invalid");
    expect(parseSingleByteRange("bytes=0-1,4-5", 100)).toBe("invalid");
    expect(parseSingleByteRange(undefined, 100)).toBeNull();
  });
});

describe("local media safety", () => {
  it("keeps direct storage delivery image-only", () => {
    expect(isDirectPublicMediaKind("image")).toBe(true);
    expect(isDirectPublicMediaKind("video")).toBe(false);
    expect(isDirectPublicMediaKind("document")).toBe(false);
    expect(isDirectPublicMediaKind("unknown")).toBe(false);
  });

  it("accepts only generated direct-child media keys", () => {
    const root = path.join("/tmp", "octamy-media");
    expect(resolveLocalMediaPath(root, "media-42-550e8400-e29b-41d4-a716-446655440000.pdf"))
      .toBe(path.join(root, "media-42-550e8400-e29b-41d4-a716-446655440000.pdf"));
    expect(resolveLocalMediaPath(root, "../secret.pdf")).toBeNull();
    expect(resolveLocalMediaPath(root, "thumbnail.pdf")).toBeNull();
  });

  it("builds an inline disposition without header injection", () => {
    const value = inlineContentDisposition("course\r\nmalicious.pdf");
    expect(value).toContain("inline;");
    expect(value).not.toContain("\r");
    expect(value).not.toContain("\n");
  });
});
