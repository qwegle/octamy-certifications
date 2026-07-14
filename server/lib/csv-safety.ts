/**
 * Spreadsheet applications may execute CSV cells beginning with formula
 * markers, even when the CSV field is correctly quoted. Prefix attacker-
 * controlled formula-like strings with an apostrophe so they remain text.
 */
export function neutralizeSpreadsheetCell(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

/** RFC-4180-style quoted cell plus spreadsheet-formula neutralisation. */
export function safeCsvCell(value: unknown): string {
  const safe = String(neutralizeSpreadsheetCell(value) ?? "");
  return `"${safe.replace(/"/g, '""')}"`;
}
