import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

interface GoogleAuthButtonProps {
  type: 'user' | 'seller';
  isLoading?: boolean;
  className?: string;
  hideWhenUnavailable?: boolean;
}

export function GoogleAuthButton({ type, isLoading = false, className = "", hideWhenUnavailable = false }: GoogleAuthButtonProps) {
  const { data, isLoading: isChecking } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/auth/google/status'],
    staleTime: 5 * 60 * 1000,
  });
  const enabled = data?.enabled === true;

  if (hideWhenUnavailable && (isChecking || !enabled)) return null;

  const handleGoogleAuth = () => {
    if (isLoading || !enabled) return;
    
    const authUrl = type === 'user' 
      ? '/api/auth/google/user'
      : '/api/auth/google/seller';
    
    window.location.href = authUrl;
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGoogleAuth}
      disabled={isLoading || isChecking || !enabled}
      title={!isChecking && !enabled ? 'Google sign-in is not configured' : undefined}
      className={`w-full flex items-center justify-center gap-3 h-11 rounded-xl bg-white text-slate-800 border-slate-300 hover:bg-slate-50 disabled:opacity-60 ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.43l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.39 13.86A6.02 6.02 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" />
        <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
      </svg>
      {isLoading ? 'Connecting…' : isChecking ? 'Checking Google…' : enabled ? 'Continue with Google' : 'Google sign-in unavailable'}
    </Button>
  );
}
