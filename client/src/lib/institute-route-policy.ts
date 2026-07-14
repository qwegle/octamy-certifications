export type InstituteMemberRole = "owner" | "admin" | "teacher" | "staff";

export const INSTITUTE_ROLE_RANK: Record<InstituteMemberRole, number> = {
  staff: 1,
  teacher: 2,
  admin: 3,
  owner: 4,
};

export function requiredInstituteRole(path: string): InstituteMemberRole | null {
  const normalized = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (!normalized.startsWith("/institute/")) return null;
  // Every active member, including operational staff, may open the overview.
  // Its page and sidebar then expose only actions permitted to that role.
  if (normalized === "/institute/dashboard") return null;
  if (
    normalized === "/institute/settings" || normalized.startsWith("/institute/settings/") ||
    normalized === "/institute/payouts" || normalized.startsWith("/institute/payouts/")
  ) return "admin";
  return "teacher";
}
