import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth.tsx';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { useGoogleAuthHandler } from '@/utils/google-auth-handler';
import { SEO } from '@/components/seo';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { AuthShell } from '@/components/auth-shell';
import { ArrowRight, Building2, Briefcase, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import { safeInternalReturnTo } from '@/lib/navigation-safety';
import {
  normalizePracticePassCycle,
  practicePricingPath,
  PRACTICE_PASS_PLAN,
} from '@/lib/practice-purchase-intent';

type Role = 'learner' | 'creator' | 'institute' | 'recruiter';

const ROLES: { id: Role; title: string; desc: string; plan: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'learner', title: 'Learner', desc: 'Take exams. Activate assessment credentials.', plan: 'Free forever', icon: GraduationCap },
  { id: 'creator', title: 'Creator', desc: 'Publish learning and assessments.', plan: 'Start free', icon: Sparkles },
  { id: 'institute', title: 'Institute', desc: 'Verify student skills at scale.', plan: 'Team workspace', icon: Building2 },
  { id: 'recruiter', title: 'Recruiter', desc: 'Hire candidates verified by skill.', plan: 'Verified company signup', icon: Briefcase },
];

function detectRoleFromPath(pathname: string): Role | null {
  if (pathname.startsWith('/creator/register')) return 'creator';
  if (pathname.startsWith('/institute/register')) return 'institute';
  if (pathname.startsWith('/recruiter/register')) return 'recruiter';
  if (pathname.startsWith('/partners/register')) return 'creator';
  return null;
}

function isSelectedPracticePricingPath(value: string | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value, 'https://octamy.invalid');
    return parsed.origin === 'https://octamy.invalid'
      && parsed.pathname === '/pricing'
      && parsed.searchParams.get('role') === 'learner'
      && parsed.searchParams.get('selected') === PRACTICE_PASS_PLAN;
  } catch {
    return false;
  }
}

export default function Register() {
  const [location, setLocation] = useLocation();
  const { register, user, token } = useAuth();
  const { toast } = useToast();
  useGoogleAuthHandler();

  const query = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search);
  }, [location]);
  const queryRole = useMemo(() => {
    const r = query?.get('role');
    return (['learner', 'creator', 'institute', 'recruiter'] as const).includes(r as Role) ? (r as Role) : null;
  }, [query]);
  const selectedPlan = useMemo(() => {
    const plan = query?.get('plan')?.trim().toLowerCase();
    return plan && /^[a-z0-9_-]{2,24}$/.test(plan) ? plan : null;
  }, [query]);
  const selectedCycle = useMemo(
    () => normalizePracticePassCycle(query?.get('cycle')),
    [query],
  );
  const next = useMemo(() => safeInternalReturnTo(query?.get('next')), [query]);
  const practicePlanDestination = useMemo(
    () => isSelectedPracticePricingPath(next)
      ? next
      : practicePricingPath({ cycle: selectedCycle, next: next || '/practice', welcome: true }),
    [next, selectedCycle],
  );
  const emailHint = useMemo(() => {
    const value = query?.get('email')?.trim().toLowerCase() || '';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : '';
  }, [query]);
  const setupMode = query?.get('mode');

  // Default unspecified registrations to learner — most users coming to /register want to take an exam.
  // For business roles we use /register?role=creator|institute|recruiter or /creators, /institutes, /recruiters/register.
  const initialRole: Role = (detectRoleFromPath(location) || queryRole || 'learner') as Role;
  const [role, setRole] = useState<Role>(initialRole);
  const isWorkspaceSetup = !!user && !!token && (setupMode === 'add' || setupMode === 'complete-google') && role !== 'learner';

  // Generic
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Creator
  const [displayName, setDisplayName] = useState('');
  const [creatorType, setCreatorType] = useState('educator');
  const [agreed, setAgreed] = useState(false);

  // Institute
  const [instituteName, setInstituteName] = useState('');
  const [instituteType, setInstituteType] = useState('school');
  const [gstin, setGstin] = useState('');

  // Recruiter
  const [companyName, setCompanyName] = useState('');
  const [companySize, setCompanySize] = useState('1-10');

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fromPath = detectRoleFromPath(location);
    if (fromPath) setRole(fromPath);
    else if (queryRole) setRole(queryRole);
  }, [location, queryRole]);

  useEffect(() => {
    if (!isWorkspaceSetup || !user) return;
    if (!name) setName(user.name || '');
    if (role === 'creator' && !displayName) setDisplayName(user.name || '');
  }, [displayName, isWorkspaceSetup, name, role, user]);

  useEffect(() => {
    if (role === 'recruiter' && location !== '/recruiter/register') {
      setLocation('/recruiter/register');
    }
  }, [location, role, setLocation]);

  useEffect(() => {
    if (!email && emailHint) setEmail(emailHint);
  }, [email, emailHint]);

  const validate = (): string | null => {
    if (!isWorkspaceSetup) {
      if (!name) return 'Please enter your name.';
      if (!email) return 'Please enter your email.';
      if (!password || password.length < 8 || !/[A-Za-z]/.test(password) || !/[\d\W_]/.test(password)) return 'Use at least 8 characters with letters and a number or symbol.';
      if (password !== confirm) return 'Passwords do not match.';
    }
    if (role === 'creator' && !agreed) return 'Please accept the creator terms.';
    if (role === 'creator' && !displayName) return 'Please enter your creator display name.';
    if (role === 'institute' && !instituteName) return 'Please enter the institute name.';
    if (role === 'recruiter' && !companyName) return 'Please enter the company name.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: 'Check the form', description: err, variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      if (!isWorkspaceSetup) await register(email, password, name);

      // Stash role-specific signup intent (legacy callers may still read this)
      try {
        const intent: Record<string, unknown> = { role, phone, plan: selectedPlan };
        if (role === 'creator') Object.assign(intent, { displayName, creatorType, wantsCreator: true });
        if (role === 'institute') Object.assign(intent, { instituteName, instituteType, gstin, wantsInstitute: true });
        if (role === 'recruiter') Object.assign(intent, { companyName, companySize, wantsRecruiter: true });
        localStorage.setItem('octamy.signupIntent', JSON.stringify(intent));
      } catch {}

      // Provision the role-specific server-side workspace before we advertise
      // success or send a paid-plan selection to checkout.
      let dest = role === 'learner' && next ? next : '/dashboard';
      let workspaceProvisioned = true;
      try {
        if (role === 'creator') {
          await apiRequest('POST', '/api/onboarding/creator', {
            displayName,
            bio: '',
          });
          dest = '/creator/dashboard';
        } else if (role === 'institute') {
          await apiRequest('POST', '/api/onboarding/institute', {
            name: instituteName,
            contactEmail: user?.email || email,
            contactPhone: phone || undefined,
            sizeRange: ['1-10', '11-50', '51-200', '201-1000', '1000+'].includes(instituteType)
              ? instituteType
              : '11-50',
            industry: instituteType,
            gstin: gstin || undefined,
          });
          dest = '/institute/dashboard';
        } else if (role === 'recruiter') {
          await apiRequest('POST', '/api/onboarding/recruiter', {
            companyName,
            companySize,
          });
          dest = '/recruiter/onboarding';
        }
      } catch (provisionError) {
        workspaceProvisioned = false;
        console.error('Onboarding provisioning failed:', provisionError);
        toast({
          title: isWorkspaceSetup ? 'Workspace setup needs attention' : 'Your account is secure — finish workspace setup',
          description:
            provisionError instanceof Error
              ? provisionError.message
              : 'Please retry the workspace details. Your Octamy identity has already been saved.',
        });
      }

      if (!workspaceProvisioned) {
        await queryClient.invalidateQueries({ queryKey: ['/api/me/roles'] });
        if (!isWorkspaceSetup) {
          const plan = selectedPlan ? `&plan=${encodeURIComponent(selectedPlan)}` : '';
          setLocation(`/register?role=${role}&mode=add${plan}`);
        }
        return;
      }

      try {
        localStorage.removeItem('octamy.signupIntent');
      } catch {}

      const hasPaidPlan =
        (role === 'learner' && selectedPlan === PRACTICE_PASS_PLAN) ||
        (role === 'creator' && ['pro', 'premium'].includes(selectedPlan || '')) ||
        (role === 'institute' && ['starter', 'growth'].includes(selectedPlan || ''));
      if (hasPaidPlan && selectedPlan) {
        try {
          localStorage.setItem('octamy.pendingPlan', JSON.stringify({ role, plan: selectedPlan, cycle: selectedCycle, at: Date.now() }));
        } catch {}
        dest = role === 'learner'
          ? practicePlanDestination
          : `/pricing?role=${role}&selected=${encodeURIComponent(selectedPlan)}&cycle=${selectedCycle}&welcome=1`;
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/me/roles'] });
      toast({
        title: isWorkspaceSetup ? 'Workspace ready' : 'Account created',
        description: hasPaidPlan ? 'Review and continue with your selected plan.' : 'Welcome to Octamy.',
      });
      setTimeout(() => setLocation(dest), 600);
    } catch (e2) {
      toast({
        title: 'Could not create account',
        description: e2 instanceof Error ? e2.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title={isWorkspaceSetup ? `Set up ${role} workspace` : 'Create account'}
        description="Create your Octamy account — choose Learner, Creator, Institute or Recruiter."
        path="/register"
      />
      <AuthShell
        wide
        eyebrow={isWorkspaceSetup ? 'One identity, another workspace' : 'Create your Octamy identity'}
        title={isWorkspaceSetup ? `Finish your ${role} workspace.` : 'Build a skill record that compounds with every achievement.'}
        description={isWorkspaceSetup ? 'Keep your existing Octamy identity and add only the business details this workspace needs.' : 'Start in the workspace that fits today. Your credentials, assessment evidence and opportunities remain connected as you grow.'}
        highlights={[
          'Start without a credit card',
          'Add another role later without a second account',
          'Credentials designed for instant verification',
        ]}
      >
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-700">{isWorkspaceSetup ? 'Complete setup' : 'Get started — free'}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-slate-950 sm:text-5xl">{isWorkspaceSetup ? `Add your ${role} workspace` : 'Create your account'}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{isWorkspaceSetup ? `Signed in as ${user?.email}. Your learning history stays connected.` : 'Start as a learner, creator or institute. Recruiters use a verified company workspace.'}</p>
        </div>

        {!isWorkspaceSetup && <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Choose account type">
          {ROLES.filter((item) => item.id !== 'recruiter').map((item) => {
            const Icon = item.icon;
            const selected = role === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRole(item.id);
                  const params = new URLSearchParams(window.location.search);
                  params.set('role', item.id);
                  params.delete('plan');
                  setLocation(`/register?${params.toString()}`);
                }}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-2 text-xs font-bold transition sm:text-sm ${selected ? 'bg-slate-950 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
                aria-pressed={selected}
              >
                <Icon className="h-4 w-4 shrink-0" /> {item.title}
              </button>
            );
          })}
        </div>}

        <section className="rounded-[1.5rem] border border-slate-300 bg-white p-5 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)] sm:p-7" aria-label={isWorkspaceSetup ? 'Workspace setup form' : 'Create account form'}>
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="font-bold text-slate-950">Signing up as {labelFor(role)}</p>
              <p className="mt-0.5 text-xs text-slate-500">{ROLES.find((item) => item.id === role)?.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{selectedPlan ? `${selectedPlan} selected` : ROLES.find((item) => item.id === role)?.plan}</span>
          </div>

          {!isWorkspaceSetup && <GoogleAuthButton type="user" isLoading={isLoading} hideWhenUnavailable className="mb-5" intent={{
            mode: 'register',
            role: role === 'recruiter' ? 'learner' : role,
            plan: selectedPlan,
            returnTo: role === 'learner' && selectedPlan === PRACTICE_PASS_PLAN
              ? practicePlanDestination
              : next,
          }} />}

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            {role === 'institute' && (
              <Field id="institute-name" label="Institute name" value={instituteName} onChange={setInstituteName} placeholder="e.g. Acme Public School" required />
            )}
            {role === 'institute' && (
              <SelectField id="institute-type" label="Institute type" value={instituteType} onChange={setInstituteType} options={[
                { value: 'school', label: 'School' },
                { value: 'college', label: 'College / University' },
                { value: 'coaching', label: 'Coaching / Test prep' },
                { value: 'company', label: 'Company / Corporate L&D' },
              ]} />
            )}

            {!isWorkspaceSetup && <Field id="full-name" label={role === 'institute' ? 'Admin contact name' : 'Full name'} value={name} onChange={setName} placeholder="Your name" autoComplete="name" required />}
            {!isWorkspaceSetup && <Field id="email" label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" autoComplete="email" required />}
            <Field id="phone" label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+91…" autoComplete="tel" />

            {role === 'creator' && (
              <>
                <Field id="creator-display-name" label="Creator display name" value={displayName} onChange={setDisplayName} placeholder="How learners see you" required />
                <SelectField id="creator-type" label="What best describes you?" value={creatorType} onChange={setCreatorType} options={[
                  { value: 'educator', label: 'Educator' },
                  { value: 'coach', label: 'Coach' },
                  { value: 'freelancer', label: 'Freelancer' },
                  { value: 'influencer', label: 'Influencer' },
                  { value: 'other', label: 'Other' },
                ]} />
              </>
            )}

            {role === 'institute' && (
              <Field id="gstin" label="GSTIN (optional)" value={gstin} onChange={setGstin} placeholder="22AAAAA0000A1Z5" />
            )}

            {!isWorkspaceSetup && <Field id="password" label="Password" value={password} onChange={setPassword} type="password" placeholder="8+ characters, letters and a number" autoComplete="new-password" required />}
            {!isWorkspaceSetup && <Field id="confirm-password" label="Confirm password" value={confirm} onChange={setConfirm} type="password" placeholder="Repeat your password" autoComplete="new-password" required />}

            {role === 'creator' && (
              <label className="flex items-start gap-2 text-xs leading-5 text-slate-600 sm:col-span-2">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 rounded border-slate-300" />
                <span>I agree to the Octamy Creator Terms and revenue-share policy.</span>
              </label>
            )}

            <Button type="submit" disabled={isLoading} className="h-12 rounded-xl bg-slate-950 text-white hover:bg-black sm:col-span-2">
              {isLoading ? 'Saving…' : <>{isWorkspaceSetup ? `Create ${role} workspace` : 'Create my account'} <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" /> Secure signup. No card required.
          </div>
        </section>

        {!isWorkspaceSetup && <div className="mt-7 space-y-3 text-center text-sm text-slate-600">
          <p>
            Already on Octamy? <Link href="/login" className="font-bold text-slate-950 hover:underline">Sign in</Link>
          </p>
          <p className="text-xs text-slate-500">
            Recruiting? <Link href="/recruiter/register" className="font-semibold text-slate-700 hover:underline">Create a verified company workspace</Link>
          </p>
        </div>}
      </AuthShell>
    </>
  );
}

function labelFor(r: Role) {
  return ({ learner: 'a Learner', creator: 'a Creator', institute: 'an Institute', recruiter: 'a Recruiter' } as const)[r];
}

function Field({
  id, label, value, onChange, type = 'text', placeholder, autoComplete, required = false,
}: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string; required?: boolean }) {
  return (
    <div>
      <Label htmlFor={id} className="text-slate-700">{label}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        aria-required={required || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1.5 h-11 rounded-xl border-slate-300 bg-slate-50 focus:bg-white"
      />
    </div>
  );
}

function SelectField({
  id, label, value, onChange, options,
}: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label htmlFor={id} className="text-slate-700">{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}
