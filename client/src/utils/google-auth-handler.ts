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

    console.log('Google Auth Handler - URL params:', { token: !!token, success, error });

    if (token && success === 'true') {
      console.log('Google Auth Handler - Processing successful authentication');
      
      // Store the token using the same key as regular auth
      localStorage.setItem('token', token);
      
      // Decode token to get user info
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
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
      console.log('Google Auth Handler - Processing authentication error:', error);
      
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

    console.log('Seller Google Auth Handler - URL params:', { token: !!token, success, error });

    if (token && success === 'true') {
      console.log('Seller Google Auth Handler - Processing successful authentication');
      
      // Store the seller token using the same key as regular seller auth
      localStorage.setItem('sellerToken', token);
      
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
      console.log('Seller Google Auth Handler - Processing authentication error:', error);
      
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