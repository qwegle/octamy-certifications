import { useState, useEffect } from 'react';
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
import { Eye, EyeOff, Mail, Lock, User, Award, TrendingUp, Shield, Clock, CheckCircle, Users, BookOpen } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function Auth() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const { toast } = useToast();
  
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'register') {
      setIsLogin(false);
    }
  }, []);

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
    
    const newUrl = isLogin ? '/auth?mode=register' : '/auth';
    window.history.pushState({}, '', newUrl);
  };

  return (
    <>
      <Helmet>
        <title>{isLogin ? 'Sign In - Octamy Certifications' : 'Sign Up - Octamy Certifications'}</title>
        <meta 
          name="description" 
          content={isLogin 
            ? 'Sign in to Octamy to access your professional certifications, track your learning progress, and manage your credentials.'
            : 'Join Octamy and earn industry-recognized certifications in technology, data science, web development, and public sector exams like UPSC, SSC, and Railway.'
          } 
        />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <div className="container mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-2 gap-12 items-start max-w-7xl mx-auto">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                  {isLogin ? 'Welcome Back to Octamy' : 'Start Your Certification Journey'}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {isLogin 
                    ? 'Sign in to access your professional certificates, track progress, and continue your learning journey.'
                    : 'Join thousands of professionals advancing their careers with industry-recognized certifications.'
                  }
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2" data-testid="feature-certificates">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">Industry-Recognized Certificates</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Earn verified certificates accepted by leading employers worldwide
                  </p>
                </div>

                <div className="space-y-2" data-testid="feature-skills">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">Skill Validation</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Prove your expertise with comprehensive assessments and practical tests
                  </p>
                </div>

                <div className="space-y-2" data-testid="feature-instant">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">Instant Results</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get immediate feedback and certificates upon successful completion
                  </p>
                </div>

                <div className="space-y-2" data-testid="feature-secure">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">Secure & Verified</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All certificates are blockchain-verified and tamper-proof
                  </p>
                </div>
              </div>

              {!isLogin && (
                <div className="bg-card border rounded-md p-6 space-y-4">
                  <h3 className="font-semibold text-lg text-foreground">What You'll Get:</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Access to 100+ Certifications</p>
                        <p className="text-sm text-muted-foreground">Technology, Public Sector, Business & More</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Personal Dashboard</p>
                        <p className="text-sm text-muted-foreground">Track your progress and achievements</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Lifetime Certificate Access</p>
                        <p className="text-sm text-muted-foreground">Download and share anytime</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Professional Credibility</p>
                        <p className="text-sm text-muted-foreground">Stand out to employers and clients</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>10,000+ Certified Professionals</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span>100+ Courses</span>
                </div>
              </div>
            </div>

            <div className="lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center text-2xl">
                    {isLogin ? 'Sign In to Your Account' : 'Create Your Free Account'}
                  </CardTitle>
                  <p className="text-center text-sm text-muted-foreground mt-2">
                    {isLogin 
                      ? 'Access your certificates and continue learning' 
                      : 'Start earning professional certifications today'
                    }
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="name">
                          Full Name
                        </Label>
                        <div className="relative">
                          <Input
                            id="name"
                            name="name"
                            type="text"
                            required={!isLogin}
                            value={formData.name}
                            onChange={handleInputChange}
                            className="pl-10"
                            placeholder="Enter your full name"
                            data-testid="input-name"
                          />
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email Address
                      </Label>
                      <div className="relative">
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="pl-10"
                          placeholder="Enter your email address"
                          data-testid="input-email"
                        />
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={formData.password}
                          onChange={handleInputChange}
                          className="pl-10 pr-10"
                          placeholder="Enter your password"
                          data-testid="input-password"
                        />
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">
                          Confirm Password
                        </Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showPassword ? 'text' : 'password'}
                            required={!isLogin}
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            className="pl-10"
                            placeholder="Confirm your password"
                            data-testid="input-confirm-password"
                          />
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                      size="lg"
                      data-testid="button-submit"
                    >
                      {isLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </Button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  
                  <GoogleAuthButton type="user" isLoading={isLoading} />

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      {isLogin ? "Don't have an account?" : "Already have an account?"}
                      <button
                        onClick={toggleMode}
                        className="ml-2 text-primary font-medium hover:underline"
                        data-testid="button-toggle-mode"
                      >
                        {isLogin ? 'Sign up' : 'Sign in'}
                      </button>
                    </p>
                  </div>

                  {isLogin && (
                    <div className="text-center">
                      <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                        Forgot your password?
                      </a>
                    </div>
                  )}

                  <div className="text-center text-xs text-muted-foreground">
                    By {isLogin ? 'signing in' : 'creating an account'}, you agree to our{' '}
                    <a href="/terms-of-service" className="text-primary hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy-policy" className="text-primary hover:underline">
                      Privacy Policy
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        <Footer />
      </div>
    </>
  );
}
