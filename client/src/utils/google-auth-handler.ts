import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

function getOAuthParams() {
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return fragment.has('token') ? fragment : query;
}

function decodeJwtPayload(token: string) {
  const encoded = token.split('.')[1];
  if (!encoded) throw new Error('Invalid token');
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  return JSON.parse(atob(base64));
}

export function useGoogleAuthHandler() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = getOAuthParams();
    const token = urlParams.get('token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (token && success === 'true') {
      // Store the token using the same key as regular auth
      localStorage.setItem('token', token);
      
      // Decode token to get user info
      try {
        const payload = decodeJwtPayload(token);
        const userData = {
          id: payload.userId,
          email: payload.email,
          name: payload.name || payload.email
        };
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (error) {
        console.error('Error decoding token:', error);
      }
      
      // Trigger a custom event to notify auth context
      window.dispatchEvent(new CustomEvent('authTokenUpdated'));
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Show success toast
      toast({
        title: "Authentication Successful",
        description: "Welcome! You've been signed in with Google.",
      });
      
      // Redirect to dashboard
      setTimeout(() => setLocation('/dashboard'), 1000);
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
    const urlParams = getOAuthParams();
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
