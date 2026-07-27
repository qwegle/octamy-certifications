import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { safeInternalReturnTo } from '@/lib/navigation-safety';
import { getOAuthParams } from './google-oauth-params';

function decodeJwtPayload(token: string) {
  const encoded = token.split('.')[1];
  if (!encoded) throw new Error('Invalid token');
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  return JSON.parse(atob(base64));
}

type OAuthIntent = {
  mode?: 'login' | 'register';
  role?: 'learner' | 'creator' | 'institute';
  plan?: string | null;
  returnTo?: string;
  createdAt?: number;
};

function readOAuthIntent(): OAuthIntent | null {
  try {
    const value = JSON.parse(localStorage.getItem('octamy.oauthIntent') || 'null') as OAuthIntent | null;
    if (!value || !value.createdAt || Date.now() - value.createdAt > 30 * 60 * 1000) {
      localStorage.removeItem('octamy.oauthIntent');
      return null;
    }
    return {
      ...value,
      returnTo: safeInternalReturnTo(value.returnTo) || undefined,
    };
  } catch {
    return null;
  }
}

async function destinationForGoogleUser(token: string, intent: OAuthIntent | null) {
  let roles: {
    isCreator?: boolean;
    isInstituteMember?: boolean;
    isRecruiter?: boolean;
    isSeller?: boolean;
    isAdmin?: boolean;
  } = {};

  try {
    const response = await fetch('/api/me/roles', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (response.ok) roles = await response.json();
  } catch {
    // The authenticated learner dashboard remains available if role discovery
    // is temporarily offline.
  }

  if (intent?.role === 'creator') {
    if (!roles.isCreator && intent.mode === 'register') {
      const plan = intent.plan ? `&plan=${encodeURIComponent(intent.plan)}` : '';
      return `/register?role=creator&mode=complete-google${plan}`;
    }
  }

  if (intent?.role === 'institute') {
    if (!roles.isInstituteMember && intent.mode === 'register') {
      const plan = intent.plan ? `&plan=${encodeURIComponent(intent.plan)}` : '';
      return `/register?role=institute&mode=complete-google${plan}`;
    }
  }

  const returnTo = safeInternalReturnTo(intent?.returnTo);
  if (returnTo) return returnTo;

  if (intent?.role === 'creator' && roles.isCreator) return '/creator/dashboard';
  if (intent?.role === 'institute' && roles.isInstituteMember) return '/institute/dashboard';
  if (roles.isAdmin) return '/qwegle/dashboard';
  const nonLearner = [
    roles.isCreator && '/creator/dashboard',
    roles.isInstituteMember && '/institute/dashboard',
    roles.isRecruiter && '/recruiter/dashboard',
    roles.isSeller && '/partner-dashboard',
  ].filter(Boolean) as string[];
  return nonLearner.length === 1 ? nonLearner[0] : '/dashboard';
}

export function useGoogleAuthHandler() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = getOAuthParams(window.location.search, window.location.hash);
    const token = urlParams.get('token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (token && success === 'true') {
      const completeGoogleAuth = async () => {
        const intent = readOAuthIntent();
        // Store the token using the same key as regular auth
        localStorage.setItem('token', token);

        // Decode token to get user info
        try {
          const payload = decodeJwtPayload(token);
          const userData = {
            id: payload.userId,
            email: payload.email,
            name: payload.name || payload.email,
          };
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
          console.error('Error decoding token:', error);
        }

        // Trigger a custom event to notify auth context
        window.dispatchEvent(new CustomEvent('authTokenUpdated'));

        // Clean up URL before loading any authenticated destination.
        window.history.replaceState({}, '', window.location.pathname);

        toast({
          title: "Signed in with Google",
          description: intent?.mode === 'register' && intent.role !== 'learner'
            ? "Your identity is ready. Complete your workspace details next."
            : "Welcome back to Octamy.",
        });

        const destination = await destinationForGoogleUser(token, intent);
        localStorage.removeItem('octamy.oauthIntent');
        setTimeout(() => {
          if (destination === '/interview-studio' || destination.startsWith('/interview-studio/')) {
            window.location.assign(destination);
          } else {
            setLocation(destination);
          }
        }, 450);
      };
      void completeGoogleAuth();
    } else if (error) {
      // Handle authentication error
      let errorMessage = "Google authentication failed. Please try again.";

      if (error === 'google_link_required') {
        errorMessage = "An account with this email already exists. Please sign in with your password and link Google from your profile settings.";
      } else if (error === 'google_not_configured') {
        errorMessage = "Google sign-in is temporarily unavailable. Please continue with email or contact support.";
      } else if (error === 'invalid_oauth_state') {
        errorMessage = "Your Google sign-in session expired or could not be verified. Please try again.";
      }
      
      toast({
        title: "Authentication Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setLocation, toast]);
}

// Function to handle seller Google auth
export function useSellerGoogleAuthHandler() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = getOAuthParams(window.location.search, window.location.hash);
    const token = urlParams.get('token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (token && success === 'true') {
      // Store the seller token using the same key as regular seller auth
      localStorage.setItem('sellerToken', token);
      window.history.replaceState({}, '', window.location.pathname);
      toast({
        title: "Welcome, Partner!",
        description: "You've been signed in with Google.",
      });
      // CRITICAL: route registered in App.tsx is /partner-dashboard, not /seller-dashboard
      setTimeout(() => setLocation('/partner-dashboard'), 800);
    } else if (error) {
      let errorMessage = "Google sign-in failed. Please try again.";
      if (error === 'google_link_required') {
        errorMessage = "A partner account with this email already exists. Sign in with your password and link Google from the dashboard.";
      } else if (error === 'google_not_configured') {
        errorMessage = "Google sign-in is temporarily unavailable. Please continue with email or contact support.";
      } else if (error === 'invalid_oauth_state') {
        errorMessage = "Your Google sign-in session expired or could not be verified. Please try again.";
      }
      toast({
        title: "Sign-in Error",
        description: errorMessage,
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setLocation, toast]);
}
