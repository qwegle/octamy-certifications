import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth.tsx";
import { apiRequest } from "./queryClient";
import type { DashboardRole } from "@/components/dashboard-layout";

export type DashboardRoleFlags = {
  isLearner: boolean;
  isCreator: boolean;
  isInstituteMember: boolean;
  isRecruiter: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  instituteRole: "owner" | "admin" | "teacher" | "staff" | null;
};

/**
 * Shared role query for workspace navigation. Keeping this query in one hook
 * means the shell, guards, and cross-workspace pages all reuse the same React
 * Query cache entry instead of issuing role probes independently.
 */
export function useDashboardRoles() {
  const { user, token } = useAuth();

  return useQuery<DashboardRoleFlags>({
    queryKey: ["/api/me/roles"],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest("GET", "/api/me/roles")).json(),
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * useDashboardRole — best-effort detection of the current workspace role for
 * pages that can be reached from multiple dashboards (e.g. /question-banks).
 *
 * Strategy:
 * 1. If user is admin → "admin"
 * 2. If user has an institute membership → "institute"
 * 3. Else if user has a creator profile → "creator"
 * 4. Else fall back to "learner"
 *
 * Reads one aggregate role endpoint. This avoids probing a workspace endpoint
 * that legitimately returns 404 for users who only hold the other role.
 */
export function useDashboardRole(): DashboardRole {
  const { user } = useAuth();
  const { data: roles } = useDashboardRoles();

  if (user?.isAdmin || roles?.isAdmin) return "admin";
  if (roles?.isInstituteMember) return "institute";
  if (roles?.isCreator) return "creator";
  return "learner";
}
