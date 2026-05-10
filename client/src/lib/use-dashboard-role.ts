import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth.tsx";
import { apiRequest } from "./queryClient";
import type { DashboardRole } from "@/components/dashboard-layout";

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
 * Reads from /api/me/institute and /api/me/creator (both already cached by
 * other dashboard pages, so usually no extra fetches).
 */
export function useDashboardRole(): DashboardRole {
  const { user, token } = useAuth();

  const { data: institute } = useQuery<{ id: number } | null>({
    queryKey: ["/api/me/institute"],
    enabled: !!user && !!token,
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/me/institute");
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
  });

  const { data: creator } = useQuery<{ id: number } | null>({
    queryKey: ["/api/me/creator"],
    enabled: !!user && !!token,
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/me/creator");
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
  });

  if (user?.isAdmin) return "admin";
  if (institute?.id) return "institute";
  if (creator?.id) return "creator";
  return "learner";
}
