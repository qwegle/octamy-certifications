import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
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
import { SEO } from '@/components/seo';
import { apiRequest } from '@/lib/queryClient';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

type Variant = 'default' | 'partners' | 'recruiter' | 'creator' | 'institute';

const variants: Record<Variant, { heading: string; sub: string }> = {
  default: { heading: 'Welcome back', sub: 'Sign in to your Octamy account.' },
  partners: { heading: 'Partner login', sub: 'Sign in to your seller / affiliate account.' },
  recruiter: { heading: 'Recruiter login', sub: 'Sign in to source verified candidates.' },
  creator: { heading: 'Creator login', sub: 'Sign in to manage your courses.' },
  institute: { heading: 'Institute login', sub: 'Sign in to manage your cohorts.' },
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
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('next');
  }, []);

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
            dest = '/admin/dashboard';
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
                if (roles.isAdmin) dest = '/admin/dashboard';
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
    variant === 'default' ? '/register' : `/register?role=${variant === 'partners' ? 'creator' : variant}`;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Login"
        description="Sign in to your Octamy account — one login for learners, creators, institutes, recruiters and partners."
        path="/login"
      />
      <Header />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-slate-900">{v.heading}</h1>
            <p className="mt-2 text-sm text-slate-600">{v.sub}</p>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-center text-slate-900 text-lg font-medium">Sign in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <GoogleAuthButton type="user" isLoading={isLoading} />
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide">
                  <span className="bg-white px-2 text-slate-500">Or with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-slate-700">Email</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password" className="text-slate-700">Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-slate-900 hover:bg-black text-white"
                >
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-slate-600 space-y-2">
            <p>
              Don't have an account?{' '}
              <Link href={registerHref}>
                <a className="text-slate-900 font-medium hover:underline">Create one</a>
              </Link>
            </p>
            <p>
              <Link href="/forgot-password">
                <a className="text-slate-500 hover:text-slate-900">Forgot password?</a>
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
