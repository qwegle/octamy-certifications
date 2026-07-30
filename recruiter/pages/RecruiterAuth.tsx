import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Building2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SEO } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import { useRecruiterAuth } from '../auth/RecruiterAuthProvider';

export default function RecruiterAuth() {
  const [location, setLocation] = useLocation();
  const { login, register } = useRecruiterAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(location !== '/recruiter/register');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      toast({ title: 'Check the form', description: 'Business email and password are required.', variant: 'destructive' });
      return false;
    }
    if (!isLogin && formData.password !== formData.confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Enter the same password in both fields.', variant: 'destructive' });
      return false;
    }
    if (!isLogin && (formData.password.length < 8 || !/[A-Za-z]/.test(formData.password) || !/[\d\W_]/.test(formData.password))) {
      toast({ title: 'Use a stronger password', description: 'Use at least 8 characters with letters and a number or symbol.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast({ title: 'Welcome back', description: 'Opening your recruiter workspace…' });
        setLocation('/recruiter/dashboard');
      } else {
        await register(formData.email, formData.password);
        toast({
          title: 'Recruiter identity created',
          description: 'Complete company verification to begin protected candidate discovery.',
        });
        setLocation('/recruiter/onboarding');
      }
    } catch (error) {
      toast({
        title: isLogin ? 'Sign in failed' : 'Could not create the account',
        description: error instanceof Error ? error.message : 'Authentication failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    const nextIsLogin = !isLogin;
    setIsLogin(nextIsLogin);
    setFormData({ email: '', password: '', confirmPassword: '' });
    setLocation(nextIsLogin ? '/recruiter/login' : '/recruiter/register');
  };

  return (
    <>
      <SEO
        title={isLogin ? 'Recruiter sign in' : 'Create recruiter workspace'}
        description="Access Octamy's verified, consent-aware candidate evidence workspace."
        path={isLogin ? '/recruiter/login' : '/recruiter/register'}
      />
      <AuthShell
        eyebrow="Evidence-led hiring"
        title="Move from candidate claims to inspectable skill evidence."
        description="Search opted-in candidates, unlock protected profile data, and inspect only the evidence a learner explicitly grants to your company."
        highlights={[
          'Consent-aware candidate discovery',
          'Expiring learner-selected evidence grants',
          'Company verification before protected access',
        ]}
      >
        <div className="mb-7">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
            <Building2 className="h-4 w-4" /> Recruiter workspace
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            {isLogin ? 'Welcome back' : 'Create your company access'}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            {isLogin
              ? 'Continue to candidate discovery, saved searches and your credit wallet.'
              : 'Start with your business email. Company details and verification follow next.'}
          </p>
        </div>

        <section
          className="rounded-[1.5rem] border border-slate-300 bg-white p-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)] sm:p-7"
          aria-label={isLogin ? 'Recruiter sign in form' : 'Recruiter registration form'}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="recruiter-email" className="text-sm font-semibold text-slate-800">Business email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id="recruiter-email"
                  type="email"
                  placeholder="recruiter@company.com"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  className="h-12 rounded-xl border-slate-300 bg-slate-50 pl-10 focus:bg-white"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recruiter-password" className="text-sm font-semibold text-slate-800">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input
                  id="recruiter-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? 'Enter your password' : '8+ characters, letters and a number'}
                  value={formData.password}
                  onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                  className="h-12 rounded-xl border-slate-300 bg-slate-50 pl-10 pr-12 focus:bg-white"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="recruiter-confirm-password" className="text-sm font-semibold text-slate-800">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Input
                    id="recruiter-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                    className="h-12 rounded-xl border-slate-300 bg-slate-50 pl-10 focus:bg-white"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="h-12 w-full rounded-xl bg-slate-950 text-base text-white hover:bg-black" disabled={isLoading}>
              {isLoading && <Loader2 className="animate-spin" />}
              {isLoading ? (isLogin ? 'Signing in…' : 'Creating account…') : (isLogin ? 'Sign in to dashboard' : 'Continue to company setup')}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </Button>

            {!isLogin && (
              <p className="text-center text-xs leading-5 text-slate-500">
                By creating an account, you agree to our <Link className="font-semibold underline" href="/terms-of-service">Terms of Service</Link> and <Link className="font-semibold underline" href="/privacy-policy">Privacy Policy</Link>.
              </p>
            )}
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-xs font-medium text-slate-800">
            <ShieldCheck className="h-4 w-4 shrink-0" /> Candidate contact details remain protected until eligibility and credit checks pass.
          </div>
        </section>

        <div className="mt-7 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="min-h-11 rounded-xl px-3 text-sm font-bold text-slate-800 hover:bg-white hover:text-slate-950"
          >
            {isLogin ? 'New to Octamy? Create a recruiter workspace' : 'Already have an account? Sign in'}
          </button>
        </div>
      </AuthShell>
    </>
  );
}
