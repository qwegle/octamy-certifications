import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
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
import { GraduationCap, Sparkles, Building2, Briefcase, ArrowLeft } from 'lucide-react';

type Role = 'learner' | 'creator' | 'institute' | 'recruiter';

const ROLES: { id: Role; title: string; desc: string; plan: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'learner', title: 'Learner', desc: 'Take exams. Earn verified certificates.', plan: 'Free forever', icon: GraduationCap },
  { id: 'creator', title: 'Creator', desc: 'Sell your own courses on Octamy.', plan: 'Free + Pro from ₹499/mo', icon: Sparkles },
  { id: 'institute', title: 'Institute', desc: 'Skill-verify your students at scale.', plan: 'From ₹2,999/mo', icon: Building2 },
  { id: 'recruiter', title: 'Recruiter', desc: 'Hire candidates verified by skill.', plan: 'From ₹2,999/mo', icon: Briefcase },
];

function detectRoleFromPath(pathname: string): Role | null {
  if (pathname.startsWith('/creator/register')) return 'creator';
  if (pathname.startsWith('/institute/register')) return 'institute';
  if (pathname.startsWith('/recruiter/register')) return 'recruiter';
  if (pathname.startsWith('/partners/register')) return 'creator';
  return null;
}

export default function Register() {
  const [location, setLocation] = useLocation();
  const { register } = useAuth();
  const { toast } = useToast();
  useGoogleAuthHandler();

  const queryRole = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const r = new URLSearchParams(window.location.search).get('role');
    return (['learner', 'creator', 'institute', 'recruiter'] as const).includes(r as Role) ? (r as Role) : null;
  }, []);

  const initialRole = detectRoleFromPath(location) || queryRole;
  const [role, setRole] = useState<Role | null>(initialRole);

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
  }, [location]);

  const validate = (): string | null => {
    if (!name) return 'Please enter your name.';
    if (!email) return 'Please enter your email.';
    if (!password || password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirm) return 'Passwords do not match.';
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
      await register(email, password, name);

      // Stash role-specific signup intent (legacy callers may still read this)
      try {
        const intent: Record<string, unknown> = { role, phone };
        if (role === 'creator') Object.assign(intent, { displayName, creatorType, wantsCreator: true });
        if (role === 'institute') Object.assign(intent, { instituteName, instituteType, gstin, wantsInstitute: true });
        if (role === 'recruiter') Object.assign(intent, { companyName, companySize, wantsRecruiter: true });
        localStorage.setItem('octamy.signupIntent', JSON.stringify(intent));
      } catch {}

      // Provision role-specific server-side profile.
      let dest = '/dashboard';
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
            contactEmail: email,
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
        console.error('Onboarding provisioning failed:', provisionError);
        toast({
          title: 'Account created, finishing setup later',
          description:
            provisionError instanceof Error
              ? provisionError.message
              : 'You can complete your profile from the dashboard.',
        });
      }

      try {
        localStorage.removeItem('octamy.signupIntent');
      } catch {}

      toast({ title: 'Account created', description: 'Welcome to Octamy.' });
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
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO
        title="Create account"
        description="Create your Octamy account — choose Learner, Creator, Institute or Recruiter."
        path="/register"
      />
      <Header />
      <main className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {!role ? (
            <RolePicker onPick={setRole} />
          ) : (
            <div className="max-w-md mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setRole(null)}
                  className="text-sm text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Change role
                </button>
                <span className="text-xs uppercase tracking-wide text-slate-500">{role}</span>
              </div>

              <div className="text-center">
                <h1 className="text-3xl font-semibold text-slate-900">Create your account</h1>
                <p className="mt-2 text-sm text-slate-600">Signing up as {labelFor(role)}.</p>
              </div>

              <Card className="border-cream-deep shadow-sm">
                <CardContent className="pt-6 space-y-5">
                  <GoogleAuthButton type="user" isLoading={isLoading} />
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-cream-deep" /></div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wide">
                      <span className="bg-cream-soft px-2 text-slate-500">Or with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {role === 'institute' && (
                      <Field label="Institute name" value={instituteName} onChange={setInstituteName} placeholder="e.g. Acme Public School" />
                    )}
                    {role === 'institute' && (
                      <SelectField label="Institute type" value={instituteType} onChange={setInstituteType} options={[
                        { value: 'school', label: 'School' },
                        { value: 'college', label: 'College / University' },
                        { value: 'coaching', label: 'Coaching / Test prep' },
                        { value: 'company', label: 'Company / Corporate L&D' },
                      ]} />
                    )}
                    {role === 'recruiter' && (
                      <Field label="Company name" value={companyName} onChange={setCompanyName} placeholder="e.g. Acme Inc." />
                    )}
                    {role === 'recruiter' && (
                      <SelectField label="Company size" value={companySize} onChange={setCompanySize} options={[
                        { value: '1-10', label: '1–10' },
                        { value: '11-50', label: '11–50' },
                        { value: '51-200', label: '51–200' },
                        { value: '201-1000', label: '201–1,000' },
                        { value: '1000+', label: '1,000+' },
                      ]} />
                    )}

                    <Field label={role === 'institute' ? 'Admin contact name' : 'Full name'} value={name} onChange={setName} placeholder="Your name" />
                    <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" autoComplete="email" />
                    <Field label={role === 'learner' ? 'Phone (optional)' : 'Phone'} value={phone} onChange={setPhone} placeholder="+91…" />

                    {role === 'creator' && (
                      <>
                        <Field label="Creator display name" value={displayName} onChange={setDisplayName} placeholder="How learners see you" />
                        <SelectField label="What best describes you?" value={creatorType} onChange={setCreatorType} options={[
                          { value: 'educator', label: 'Educator' },
                          { value: 'coach', label: 'Coach' },
                          { value: 'freelancer', label: 'Freelancer' },
                          { value: 'influencer', label: 'Influencer' },
                          { value: 'other', label: 'Other' },
                        ]} />
                      </>
                    )}

                    {role === 'institute' && (
                      <Field label="GSTIN (optional)" value={gstin} onChange={setGstin} placeholder="22AAAAA0000A1Z5" />
                    )}

                    <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" autoComplete="new-password" />
                    <Field label="Confirm password" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" />

                    {role === 'creator' && (
                      <label className="flex items-start gap-2 text-sm text-slate-600">
                        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                        <span>I agree to the Octamy Creator Terms and revenue-share policy.</span>
                      </label>
                    )}

                    <Button type="submit" disabled={isLoading} className="w-full bg-slate-900 hover:bg-black text-white">
                      {isLoading ? 'Creating account…' : 'Create account'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-slate-600">
                Already have an account?{' '}
                <Link href="/login"><a className="text-slate-900 font-medium hover:underline">Sign in</a></Link>
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function labelFor(r: Role) {
  return ({ learner: 'a Learner', creator: 'a Creator', institute: 'an Institute', recruiter: 'a Recruiter' } as const)[r];
}

function RolePicker({ onPick }: { onPick: (r: Role) => void }) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">Create your Octamy account</h1>
        <p className="mt-2 text-slate-600">Pick what best describes you. You can always add another role later.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
              className="text-left rounded-2xl border border-cream-deep hover:border-slate-900 hover:shadow-md transition p-6 bg-cream-soft group"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center transition">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold text-slate-900">{r.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{r.desc}</div>
                  <div className="text-xs text-slate-500 mt-3">{r.plan}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login"><a className="text-slate-900 font-medium hover:underline">Sign in</a></Link>
      </p>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <div>
      <Label className="text-slate-700">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label className="text-slate-700">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-md border border-cream-deep bg-cream-soft px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}
