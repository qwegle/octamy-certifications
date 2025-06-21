import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  isAdmin?: boolean;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    enabled: !!token,
    queryFn: async () => {
      const response = await fetch('/api/user', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  const updateUser = (userData: Partial<User>) => {
    queryClient.setQueryData(['/api/user'], (prev: any) => 
      prev ? { ...prev, ...userData } : null
    );
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    queryClient.clear();
  };

  return {
    user: user as User | undefined,
    token,
    isLoading,
    isAuthenticated: !!user && !error && !!token,
    error,
    updateUser,
    logout
  };
}