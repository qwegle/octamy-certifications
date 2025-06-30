import { useQuery } from "@tanstack/react-query";

interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  isAdmin?: boolean;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
  });

  return {
    user: user as User | undefined,
    isLoading,
    isAuthenticated: !!user && !error,
    error
  };
}