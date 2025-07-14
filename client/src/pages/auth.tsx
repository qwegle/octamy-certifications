import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth.tsx';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { useGoogleAuthHandler } from '@/utils/google-auth-handler';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

export default function Auth() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();
  
  // Handle Google OAuth callback
  useGoogleAuthHandler();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // Check URL params to determine mode
  useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'register') {
      setIsLogin(false);
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Email and password are required.",
        variant: "destructive",
      });
      return false;
    }

    if (!isLogin) {
      if (!formData.name) {
        toast({
          title: "Validation Error",
          description: "Name is required for registration.",
          variant: "destructive",
        });
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Validation Error",
          description: "Passwords do not match.",
          variant: "destructive",
        });
        return false;
      }

      if (formData.password.length < 6) {
        toast({
          title: "Validation Error",
          description: "Password must be at least 6 characters long.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting to dashboard...",
        });
        setTimeout(() => setLocation('/dashboard'), 1000);
      } else {
        await register(formData.email, formData.password, formData.name);
        toast({
          title: "Registration Successful",
          description: "Account created! Redirecting to dashboard...",
        });
        setTimeout(() => setLocation('/dashboard'), 1000);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Authentication failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ name: '', email: '', password: '', confirmPassword: '' });
    setShowPassword(false);
    
    // Update URL without page reload
    const newUrl = isLogin ? '/auth?mode=register' : '/auth';
    window.history.pushState({}, '', newUrl);
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-octamy-black">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-2 text-octamy-gray-600">
              {isLogin 
                ? 'Sign in to access your certificates and dashboard' 
                : 'Join Octamy to start earning professional certifications'
              }
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center text-octamy-black">
                {isLogin ? 'Sign In' : 'Sign Up'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                  <div>
                    <Label htmlFor="name" className="text-octamy-black">
                      Full Name
                    </Label>
                    <div className="mt-1 relative">
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        required={!isLogin}
                        value={formData.name}
                        onChange={handleInputChange}
                        className="pl-10 focus:ring-2 focus:ring-octamy-black focus:border-transparent"
                        placeholder="Enter your full name"
                      />
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-octamy-gray-400 w-4 h-4" />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="email" className="text-octamy-black">
                    Email Address
                  </Label>
                  <div className="mt-1 relative">
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="pl-10 focus:ring-2 focus:ring-octamy-black focus:border-transparent"
                      placeholder="Enter your email address"
                    />
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-octamy-gray-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="text-octamy-black">
                    Password
                  </Label>
                  <div className="mt-1 relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="pl-10 pr-10 focus:ring-2 focus:ring-octamy-black focus:border-transparent"
                      placeholder="Enter your password"
                    />
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-octamy-gray-400 w-4 h-4" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-octamy-gray-400 hover:text-octamy-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <div>
                    <Label htmlFor="confirmPassword" className="text-octamy-black">
                      Confirm Password
                    </Label>
                    <div className="mt-1 relative">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        required={!isLogin}
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="pl-10 focus:ring-2 focus:ring-octamy-black focus:border-transparent"
                        placeholder="Confirm your password"
                      />
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-octamy-gray-400 w-4 h-4" />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-octamy-black text-white hover:bg-octamy-gray-800 py-3"
                >
                  {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-octamy-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-octamy-gray-500">Or continue with</span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <GoogleAuthButton type="user" isLoading={isLoading} />
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-octamy-gray-600">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                  <button
                    onClick={toggleMode}
                    className="ml-2 text-octamy-black font-medium hover:underline"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>

              {isLogin && (
                <div className="mt-4 text-center">
                  <a href="#" className="text-sm text-octamy-gray-600 hover:text-octamy-black">
                    Forgot your password?
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center text-sm text-octamy-gray-600">
            By {isLogin ? 'signing in' : 'creating an account'}, you agree to our{' '}
            <a href="#" className="text-octamy-black hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-octamy-black hover:underline">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
