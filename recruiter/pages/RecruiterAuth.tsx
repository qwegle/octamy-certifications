import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';
import { Eye, EyeOff, Mail, Lock, Building2, BadgeCheck, Target, Zap, Shield, FileCheck2, UserCheck } from 'lucide-react';

export default function RecruiterAuth() {
  const [location, setLocation] = useLocation();
  const { login, register } = useRecruiterAuth();
  const { toast } = useToast();
  
  const [isLogin, setIsLogin] = useState(location !== '/recruiter/register');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

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
      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Validation Error",
          description: "Passwords do not match.",
          variant: "destructive",
        });
        return false;
      }

      if (formData.password.length < 8 || !/[A-Za-z]/.test(formData.password) || !/[\d\W_]/.test(formData.password)) {
        toast({
          title: "Validation Error",
          description: "Use at least 8 characters with letters and a number or symbol.",
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
          description: "Welcome to Octamy Recruiter Portal!",
        });
        setLocation('/recruiter/dashboard');
      } else {
        await register(formData.email, formData.password);
        toast({
          title: "Registration Successful",
          description: "Account created! Please complete your profile.",
        });
        setLocation('/recruiter/onboarding');
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
    setFormData({ email: '', password: '', confirmPassword: '' });
  };

  return (
    <div className="min-h-screen bg-black text-white flex" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Left Side - Quote/Image Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-40" />
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-center">
          <div className="mb-8">
            <Building2 className="h-16 w-16 text-white mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-2">Octamy Recruiter</h1>
            <p className="text-xl text-gray-300">Evidence-led talent discovery</p>
          </div>
          
          <div className="max-w-md space-y-8">
            <blockquote className="text-2xl font-light italic text-gray-200">
              “Hire from verified evidence, not profile claims.”
            </blockquote>
            
            <div className="grid grid-cols-2 gap-6 text-center">
              <div className="space-y-2">
                <BadgeCheck className="h-8 w-8 text-white mx-auto" />
                <p className="text-sm text-gray-300">Verified credentials</p>
              </div>
              <div className="space-y-2">
                <Target className="h-8 w-8 text-white mx-auto" />
                <p className="text-sm text-gray-300">Evidence filters</p>
              </div>
              <div className="space-y-2">
                <Zap className="h-8 w-8 text-white mx-auto" />
                <p className="text-sm text-gray-300">Saved searches</p>
              </div>
              <div className="space-y-2">
                <Shield className="h-8 w-8 text-white mx-auto" />
                <p className="text-sm text-gray-300">Consent-based access</p>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-6">
              <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <FileCheck2 className="h-4 w-4" />
                  <span>Assessment evidence</span>
                </div>
                <div className="flex items-center space-x-2">
                  <UserCheck className="h-4 w-4" />
                  <span>Privacy-aware profiles</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cream-soft bg-opacity-5 rounded-full transform translate-x-16 -translate-y-16" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cream-soft bg-opacity-3 rounded-full transform -translate-x-24 translate-y-24" />
      </div>

      {/* Right Side - Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-cream-soft text-black">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center lg:hidden mb-6">
              <Building2 className="h-8 w-8 text-black mr-2" />
              <span className="text-xl font-bold">Octamy Recruiter</span>
            </div>
            <h2 className="text-3xl font-bold text-black mb-2">
              {isLogin ? 'Welcome back' : 'Create a recruiter workspace'}
            </h2>
            <p className="text-gray-600">
              {isLogin 
                ? 'Access your hiring workspace and saved searches'
                : 'Search verified learning and assessment evidence'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-900">
                Business Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="recruiter@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-12 border-gray-300 focus:border-black focus:ring-black"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-900">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a secure password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 h-12 border-gray-300 focus:border-black focus:ring-black"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-900">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-10 h-12 border-gray-300 focus:border-black focus:ring-black"
                    required
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-white h-12 text-base font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>{isLogin ? 'Signing In...' : 'Creating Account...'}</span>
                </div>
              ) : (
                isLogin ? 'Sign in to dashboard' : 'Create recruiter account'
              )}
            </Button>

            {!isLogin && (
              <p className="text-xs text-gray-500 text-center">
                By creating an account, you agree to our <a className="underline" href="/terms-of-service">Terms of Service</a> and <a className="underline" href="/privacy-policy">Privacy Policy</a>.
              </p>
            )}
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={toggleMode}
              className="text-black hover:text-gray-700 font-medium"
            >
              {isLogin
                ? "New to Octamy? Create your account"
                : "Already have an account? Sign in"
              }
            </button>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center space-x-1"
            >
              <span>← Back to Octamy Platform</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
