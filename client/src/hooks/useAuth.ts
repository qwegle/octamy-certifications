import { useAuth as useAuthContext } from "@/lib/auth";

export function useAuth() {
  // Compatibility wrapper for older pages. Authentication is owned by the
  // central provider, which validates a stored bearer token only when one is
  // present. Public pages therefore no longer issue a noisy, expected 401.
  const { user, isLoading } = useAuthContext();

  return {
    user: user ?? undefined,
    isLoading,
    isAuthenticated: Boolean(user),
    error: null,
  };
}
