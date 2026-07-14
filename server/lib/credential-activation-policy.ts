export function normalizeCredentialEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

/**
 * A persisted owner id is authoritative. Exact email matching is only a
 * compatibility path for historical rows that were never assigned an owner.
 */
export function isCredentialOwnedBy(
  certificate: { userId: number | null; userEmail: string },
  user: { id: number; email: string },
) {
  if (certificate.userId != null) return certificate.userId === user.id;
  return Boolean(
    normalizeCredentialEmail(certificate.userEmail) &&
      normalizeCredentialEmail(certificate.userEmail) ===
        normalizeCredentialEmail(user.email),
  );
}

export function amountsMatch(expected: string | number, actual: unknown) {
  const expectedAmount = Number(expected);
  const actualAmount = Number(actual);
  if (!Number.isFinite(expectedAmount) || !Number.isFinite(actualAmount)) return false;
  return Math.round(expectedAmount * 100) === Math.round(actualAmount * 100);
}
