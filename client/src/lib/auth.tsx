import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from './queryClient';

interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  // Treat local storage as a cache, not proof of authentication. A valid session
  // must also be accepted by the API so stale or fabricated browser data cannot
  // expose authenticated navigation.
  const checkAndSetAuth = async () => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const encodedPayload = storedToken.split('.')[1];
        if (!encodedPayload) throw new Error('Invalid token');
        const paddedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
        const payload = JSON.parse(atob(paddedPayload));
        const currentTime = Date.now() / 1000;

        if (!payload.exp || payload.exp < currentTime) throw new Error('Expired token');

        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Session rejected');

        const verifiedUser = (await response.json()) as User;
        if (!verifiedUser?.id || (payload.userId && payload.userId !== verifiedUser.id)) {
          throw new Error('Session user mismatch');
        }

        setToken(storedToken);
        setUser(verifiedUser);
        localStorage.setItem('user', JSON.stringify(verifiedUser));
      } catch {
        clearAuth();
      }
    } else {
      clearAuth();
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void checkAndSetAuth();
  }, []);

  // Listen for storage changes and custom auth events (for Google OAuth)
  useEffect(() => {
    const handleStorageChange = () => {
      void checkAndSetAuth();
    };
    
    const handleAuthUpdate = () => {
      void checkAndSetAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authTokenUpdated', handleAuthUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authTokenUpdated', handleAuthUpdate);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiRequest('POST', '/api/login', { email, password });
    const data = await response.json();
    
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await apiRequest('POST', '/api/register', { email, password, name });
    const data = await response.json();
    
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('adminToken'); // Also clear admin token if exists
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
