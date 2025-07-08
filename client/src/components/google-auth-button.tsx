import { Button } from '@/components/ui/button';
import { Chrome } from 'lucide-react';

interface GoogleAuthButtonProps {
  type: 'user' | 'seller';
  isLoading?: boolean;
  className?: string;
}

export function GoogleAuthButton({ type, isLoading = false, className = "" }: GoogleAuthButtonProps) {
  const handleGoogleAuth = () => {
    if (isLoading) return;
    
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
      disabled={isLoading}
      className={`w-full flex items-center justify-center gap-2 ${className}`}
    >
      <Chrome className="w-4 h-4" />
      {isLoading ? 'Connecting...' : 'Continue with Google'}
    </Button>
  );
}