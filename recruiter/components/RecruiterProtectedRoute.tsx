import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';

interface RecruiterProtectedRouteProps {
  children: React.ReactNode;
  requireKyc?: boolean;
}

export default function RecruiterProtectedRoute({ 
  children, 
  requireKyc = false 
}: RecruiterProtectedRouteProps) {
  const { recruiter, token, isLoading } = useRecruiterAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!recruiter || !token) {
        setLocation('/recruiter/auth');
        return;
      }

      if (recruiter.registrationStep < 4) {
        setLocation('/recruiter/onboarding');
        return;
      }

      if (requireKyc && recruiter.kycStatus !== 'approved') {
        setLocation('/recruiter/dashboard');
        return;
      }
    }
  }, [recruiter, token, isLoading, requireKyc, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <div className="animate-spin w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!recruiter || !token) {
    return null;
  }

  if (recruiter.registrationStep < 4) {
    return null;
  }

  if (requireKyc && recruiter.kycStatus !== 'approved') {
    return null;
  }

  return <>{children}</>;
}