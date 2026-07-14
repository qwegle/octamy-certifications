import path from "node:path";

export type LessonContentAccessFacts = {
  isManager: boolean;
  hasEntitlement: boolean;
  isPreview: boolean;
  courseIsActive: boolean;
  courseIsPublic: boolean;
  courseIsApproved: boolean;
};

export type LessonContentAccessDecision =
  | { allowed: true; basis: "manager" | "entitlement" | "preview" }
  | { allowed: false; basis: "authentication_required" | "access_denied" };

/**
 * Pure policy used by curriculum and streaming routes. Assessment products do
 * not bypass this policy: lesson media is unlocked only by an explicit preview,
 * a current entitlement, or current workspace-management rights.
 */
export function decideLessonContentAccess(
  facts: LessonContentAccessFacts,
  hasAuthenticatedIdentity: boolean,
): LessonContentAccessDecision {
  if (facts.isManager) return { allowed: true, basis: "manager" };
  // A purchase is not a moderation bypass. Managers retain repair access, but
  // ordinary learners must lose delivery when content is suspended, rejected,
  // or otherwise deactivated.
  if (facts.hasEntitlement && facts.courseIsActive && facts.courseIsApproved) {
    return { allowed: true, basis: "entitlement" };
  }
  if (
    facts.isPreview &&
    facts.courseIsActive &&
    facts.courseIsPublic &&
    facts.courseIsApproved
  ) {
    return { allowed: true, basis: "preview" };
  }
  return {
    allowed: false,
    basis: hasAuthenticatedIdentity ? "access_denied" : "authentication_required",
  };
}

export function isCourseAvailableForNewAccess(facts: {
  isActive: boolean;
  visibility: string;
  reviewStatus: string;
}): boolean {
  return facts.isActive
    && facts.visibility === "public"
    && facts.reviewStatus === "approved";
}

/** Direct storage URLs are reserved for catalog-safe image assets. */
export function isDirectPublicMediaKind(kind: string): boolean {
  return kind === "image";
}

export type ByteRange = { start: number; end: number; length: number };

/** Parses one RFC 7233 byte range. Multipart ranges deliberately fail closed. */
export function parseSingleByteRange(value: string | undefined, size: number): ByteRange | null | "invalid" {
  if (!value) return null;
  if (!Number.isSafeInteger(size) || size <= 0) return "invalid";
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return "invalid";
    if (start >= size || end < start) return "invalid";
    end = Math.min(end, size - 1);
  }

  return { start, end, length: end - start + 1 };
}

/** Resolves only a direct child of the configured media directory. */
export function resolveLocalMediaPath(mediaDirectory: string, storageKey: string): string | null {
  if (!storageKey || path.basename(storageKey) !== storageKey) return null;
  if (!/^media-\d+-[0-9a-f-]+\.[a-z0-9]+$/i.test(storageKey)) return null;
  const root = path.resolve(mediaDirectory);
  const resolved = path.resolve(root, storageKey);
  return path.dirname(resolved) === root ? resolved : null;
}

export function inlineContentDisposition(originalName: string): string {
  const safeBase = path.basename(originalName || "lesson-content")
    .replace(/[\r\n"]/g, "_")
    .slice(0, 180) || "lesson-content";
  const ascii = safeBase.replace(/[^\x20-\x7e]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safeBase)}`;
}
