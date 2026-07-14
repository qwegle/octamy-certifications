import type { UserContext } from "./qb-permissions";

const INSTITUTE_AUTHOR_ROLES = new Set(["owner", "admin", "teacher"]);

/**
 * The reusable media library is an author-workspace capability. Learners may
 * consume entitled lesson media through protected content routes, but they do
 * not receive a private upload vault merely by having an account.
 */
export function canManageMediaLibrary(context: UserContext): boolean {
  if (context.user.isAdmin) return true;
  if (context.creatorId != null) return true;

  return Array.from(context.instituteRoles.values()).some((role) =>
    INSTITUTE_AUTHOR_ROLES.has(role),
  );
}
