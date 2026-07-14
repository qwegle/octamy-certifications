import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth.tsx';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { useGoogleAuthHandler } from '@/utils/google-auth-handler';
import { SEO } from '@/components/seo';
import { apiRequest } from '@/lib/queryClient';
import { AuthShell } from '@/components/auth-shell';
import { ArrowRight, Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';
import { safeInternalReturnTo } from '@/lib/navigation-safety';

type Variant = 'default' | 'partners' | 'recruiter' | 'creator' | 'institute';

const variants: Record<Variant, { heading: string; sub: string; account: string }> = {
  default: { heading: 'Welcome back', sub: 'Continue to your learning and credential workspace.', account: 'Octamy account' },
  partners: { heading: 'Partner sign in', sub: 'Access your seller and affiliate workspace.', account: 'partner account' },
  recruiter: { heading: 'Recruiter sign in', sub: 'Continue sourcing candidates with verified skill evidence.', account: 'recruiter account' },
  creator: { heading: 'Creator sign in', sub: 'Manage your catalog, learners and earnings.', account: 'creator account' },
  institute: { heading: 'Institute sign in', sub: 'Manage cohorts, assessments and outcomes.', account: 'institute account' },
};

function detectVariant(pathname: string): Variant {
  if (pathname.startsWith('/partners')) return 'partners';
  if (pathname.startsWith('/recruiter')) return 'recruiter';
  if (pathname.startsWith('/creator')) return 'creator';
  if (pathname.startsWith('/institute')) return 'institute';
  return 'default';
}

export default function Login() {
  const [location, setLocation] = useLocation();
  const locationSearch = useSearch();
  const { login } = useAuth();
  const { toast } = useToast();
  useGoogleAuthHandler();

  const variant = useMemo(() => detectVariant(location), [location]);
  const v = variants[variant];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const next = useMemo(() => {
    return safeInternalReturnTo(new URLSearchParams(locationSearch).get('next'));
  }, [locationSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Missing details', description: 'Email and password are required.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      toast({ title: 'Welcome back', description: 'Redirecting…' });

      let dest = next || '/dashboard';
      if (!next) {
        try {
          const stored = JSON.parse(localStorage.getItem('user') || 'null');
          if (stored?.isAdmin) {
            dest = '/qwegle/dashboard';
          } else {
            // Smart route based on aggregated roles.
            try {
              const rolesRes = await apiRequest('GET', '/api/me/roles');
              const roles = (await rolesRes.json()) as {
                isCreator: boolean;
                isInstituteMember: boolean;
                isRecruiter: boolean;
                isSeller: boolean;
                isAdmin: boolean;
              };

              const variantPref: Record<Exclude<Variant, 'default'>, { has: boolean; path: string }> = {
                creator: { has: roles.isCreator, path: '/creator/dashboard' },
                institute: { has: roles.isInstituteMember, path: '/institute/dashboard' },
                recruiter: { has: roles.isRecruiter, path: '/recruiter/dashboard' },
                partners: { has: roles.isSeller, path: '/partner-dashboard' },
              };

              if (variant !== 'default' && variantPref[variant].has) {
                dest = variantPref[variant].path;
              } else {
                if (roles.isAdmin) dest = '/qwegle/dashboard';
                else {
                  const nonLearner = [
                    roles.isCreator && '/creator/dashboard',
                    roles.isInstituteMember && '/institute/dashboard',
                    roles.isRecruiter && '/recruiter/dashboard',
                    roles.isSeller && '/partner-dashboard',
                  ].filter(Boolean) as string[];
                  if (nonLearner.length === 1) dest = nonLearner[0];
                  else dest = '/dashboard';
                }
                if (variant !== 'default') {
                  toast({
                    title: 'Signed in',
                    description: `You don't have a ${variant} profile yet — opening your dashboard.`,
                  });
                }
              }
            } catch {
              if (variant === 'recruiter') dest = '/recruiter/dashboard';
              else if (variant === 'partners') dest = '/partner-dashboard';
              else if (variant === 'creator') dest = '/creator/dashboard';
              else if (variant === 'institute') dest = '/institute/dashboard';
            }
          }
        } catch {}
      }
      setTimeout(() => setLocation(dest), 600);
    } catch (err) {
      toast({
        title: 'Sign in failed',
        description: err instanceof Error ? err.message : 'Please check your credentials.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const registerHref =
    variant === 'partners'
      ? '/seller-auth'
      : variant === 'recruiter'
        ? '/recruiter/register'
        : variant === 'default'
          ? '/register'
          : `/register?role=${variant}`;

  return (
    <>
      <SEO
        title="Login"
        description="Sign in to your Octamy account — one login for learners, creators, institutes, recruiters and partners."
        path="/login"
      />
      <AuthShell
        eyebrow="Skill evidence passport"
        title="One identity for learning, proof and opportunity."
        description="Your Octamy account connects assessment performance, portable credentials and role-aware workspaces without fragmenting your history."
        highlights={[
          'Verified assessment and credential history',
          'Dedicated learner, creator and institute workspaces',
          'Shareable evidence recruiters can verify',
        ]}
      >
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-700">Secure access</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-5xl">{v.heading}</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">{v.sub}</p>
        </div>

        <section className="rounded-[1.5rem] border border-slate-300 bg-white p-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)] sm:p-7" aria-label="Sign in form">
          <GoogleAuthButton
            type="user"
            isLoading={isLoading}
            hideWhenUnavailable
            className="mb-5"
            intent={{
              mode: 'login',
              role: variant === 'creator' || variant === 'institute' ? variant : 'learner',
              returnTo: next,
            }}
          />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-semibold text-slate-800">Work or personal email</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-slate-300 bg-slate-50 pl-10 focus:bg-white"
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-800">Password</Label>
                <Link href="/forgot-password" className="text-xs font-semibold text-fuchsia-700 hover:text-fuchsia-900 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative mt-2">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-slate-300 bg-slate-50 pl-10 pr-11 focus:bg-white"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-black">
              {isLoading ? 'Signing in…' : <>Sign in securely <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4" /> Your credentials stay private until you share them.
          </div>
        </section>

        <p className="mt-7 text-center text-sm text-slate-600">
          New to Octamy?{' '}
          <Link href={registerHref} className="inline-flex items-center gap-1 font-bold text-slate-950 hover:underline">
            Create your {v.account} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
        {variant === 'default' && (
          <p className="mt-3 text-center text-xs text-slate-500">
            Hiring? <Link href="/recruiter/login" className="font-semibold text-slate-700 hover:underline">Use your verified company workspace</Link>
          </p>
        )}
      </AuthShell>
    </>
  );
}
