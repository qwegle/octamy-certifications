const AUTH_ENTRY_PATHS = new Set([
  "/auth",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/creator/login",
  "/creator/register",
  "/institute/login",
  "/institute/register",
  "/recruiter/login",
  "/recruiter/register",
  "/partners/login",
  "/partners/register",
]);

/**
 * Accept only an application-relative destination. This protects login and
 * OAuth redirects from protocol-relative URLs, encoded backslashes, control
 * characters, and auth-entry loops.
 */
export function safeInternalReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) return null;

  try {
    const base = new URL("https://octamy.invalid");
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin) return null;

    const pathname = parsed.pathname.replace(/\/{2,}/g, "/");
    if (AUTH_ENTRY_PATHS.has(pathname) || pathname.startsWith("/api/auth/")) return null;
    return `${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
