import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface Recruiter {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  kycStatus: 'pending' | 'under_review' | 'approved' | 'rejected';
  creditsBalance: string;
  registrationStep: number;
}

interface RecruiterAuthContextType {
  recruiter: Recruiter | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateRegistrationStep: (step: number) => void;
  isLoading: boolean;
}

const RecruiterAuthContext = createContext<RecruiterAuthContextType | undefined>(undefined);

export function RecruiterAuthProvider({ children }: { children: ReactNode }) {
  const [recruiter, setRecruiter] = useState<Recruiter | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('recruiterToken');
    const storedRecruiter = localStorage.getItem('recruiterData');
    
    if (storedToken && storedRecruiter) {
      // Check if token is expired before setting
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (payload.exp < currentTime) {
          // Token expired, clear storage
          localStorage.removeItem('recruiterToken');
          localStorage.removeItem('recruiterData');
        } else {
          setToken(storedToken);
          setRecruiter(JSON.parse(storedRecruiter));
        }
      } catch (error) {
        // Invalid token format, clear storage
        localStorage.removeItem('recruiterToken');
        localStorage.removeItem('recruiterData');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiRequest('POST', '/api/recruiter/login', { email, password });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    setToken(data.token);
    setRecruiter(data.recruiter);
    localStorage.setItem('recruiterToken', data.token);
    localStorage.setItem('recruiterData', JSON.stringify(data.recruiter));
  };

  const register = async (email: string, password: string) => {
    const response = await apiRequest('POST', '/api/recruiter/register', { email, password });
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    
    setToken(data.token);
    setRecruiter(data.recruiter);
    localStorage.setItem('recruiterToken', data.token);
    localStorage.setItem('recruiterData', JSON.stringify(data.recruiter));
  };

  const logout = () => {
    setToken(null);
    setRecruiter(null);
    localStorage.removeItem('recruiterToken');
    localStorage.removeItem('recruiterData');
  };

  const updateRegistrationStep = (step: number) => {
    if (recruiter) {
      const updatedRecruiter = { ...recruiter, registrationStep: step };
      setRecruiter(updatedRecruiter);
      localStorage.setItem('recruiterData', JSON.stringify(updatedRecruiter));
    }
  };

  return (
    <RecruiterAuthContext.Provider value={{ 
      recruiter, 
      token, 
      login, 
      register, 
      logout, 
      updateRegistrationStep,
      isLoading 
    }}>
      {children}
    </RecruiterAuthContext.Provider>
  );
}

export function useRecruiterAuth() {
  const context = useContext(RecruiterAuthContext);
  if (context === undefined) {
    throw new Error('useRecruiterAuth must be used within a RecruiterAuthProvider');
  }
  return context;
}