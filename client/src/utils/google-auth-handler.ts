import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

export function useGoogleAuthHandler() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (token && success === 'true') {
      // Store the token
      localStorage.setItem('auth-token', token);
      
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
      
      if (error === 'auth_failed') {
        errorMessage = "Google authentication failed. Please try again.";
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
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (token && success === 'true') {
      // Store the seller token
      localStorage.setItem('seller-auth-token', token);
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // Show success toast
      toast({
        title: "Authentication Successful",
        description: "Welcome! You've been signed in with Google as a partner.",
      });
      
      // Redirect to seller dashboard
      setTimeout(() => setLocation('/seller-dashboard'), 1000);
    } else if (error) {
      // Handle authentication error
      let errorMessage = "Google authentication failed. Please try again.";
      
      if (error === 'auth_failed') {
        errorMessage = "Google authentication failed. Please try again.";
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