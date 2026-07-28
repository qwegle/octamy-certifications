import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth.tsx';
import { ApiError, apiRequest } from '@/lib/queryClient';
import {
  normalizePracticePassCycle,
  practiceAccountPath,
  practicePricingPath,
  PRACTICE_PASS_PLAN,
} from '@/lib/practice-purchase-intent';
import { safeInternalReturnTo } from '@/lib/navigation-safety';
import { useToast } from '@/hooks/use-toast';

type Cycle = 'monthly' | 'yearly';

function discounted(monthly: number, cycle: Cycle): string {
  if (cycle === 'monthly') return `₹${monthly.toLocaleString('en-IN')}/mo`;
  // 2 months free
  const yearly = Math.round(monthly * 10);
  return `₹${yearly.toLocaleString('en-IN')}/yr`;
}

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>(() => normalizePracticePassCycle(
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('cycle'),
  ));
  const [submitting, setSubmitting] = useState<string | null>(null);
  const { user, token } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const requestedNext = useMemo(() => {
    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    return safeInternalReturnTo(params.get('next')) || '/practice';
  }, [location]);

  const selected = useMemo(() => {
    const allowed: Record<'learner' | 'creator' | 'institute', string[]> = {
      learner: [PRACTICE_PASS_PLAN],
      creator: ['free', 'pro', 'premium'],
      institute: ['starter', 'growth'],
    };
    const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    const role = params.get('role');
    const plan = params.get('selected');
    if ((role === 'learner' || role === 'creator' || role === 'institute') && plan && allowed[role].includes(plan)) {
      return {
        role,
        plan,
        welcome: params.get('welcome') === '1',
        next: safeInternalReturnTo(params.get('next')) || '/practice',
      } as const;
    }

    try {
      const pending = JSON.parse(localStorage.getItem('octamy.pendingPlan') || 'null');
      const pendingRole = pending?.role as string | undefined;
      const pendingPlan = pending?.plan as string | undefined;
      if (
        (pendingRole === 'creator' || pendingRole === 'institute') &&
        !!pendingPlan &&
        allowed[pendingRole].includes(pendingPlan) &&
        Date.now() - Number(pending?.at || 0) < 24 * 60 * 60 * 1000
      ) {
        return { role: pendingRole, plan: pendingPlan, welcome: false } as const;
      }
    } catch {
      localStorage.removeItem('octamy.pendingPlan');
    }
    return null;
  }, [location]);

  async function subscribe(ownerType: 'learner' | 'creator' | 'institute', plan: string, registerRole: string) {
    if (!user || !token) {
      if (ownerType === 'learner' && plan === PRACTICE_PASS_PLAN) {
        setLocation(practicePricingPath({ cycle, next: selected?.next || requestedNext }));
      } else {
        setLocation(`/register?role=${registerRole}&plan=${encodeURIComponent(plan)}&cycle=${cycle}`);
      }
      return;
    }
    const requestKey = `${ownerType}:${plan}`;
    setSubmitting(requestKey);
    try {
      const res = await apiRequest('POST', '/api/subscriptions/checkout', { ownerType, plan, cycle });
      const data = await res.json();
      if (data.activated) {
        localStorage.removeItem('octamy.pendingPlan');
        toast({ title: 'Plan activated', description: `You're on ${plan.toUpperCase()} now.` });
        setLocation(ownerType === 'learner' ? '/dashboard' : `/${ownerType}/dashboard`);
        return;
      }
      if (data.orderId) {
        try {
          localStorage.setItem('octamy.pendingSubscriptionOrder', JSON.stringify({
            orderId: data.orderId,
            ownerType,
            plan,
            next: ownerType === 'learner' ? (selected?.next || requestedNext) : `/${ownerType}/dashboard`,
            createdAt: Date.now(),
          }));
        } catch {}
      }
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
        return;
      }
      if (data.paymentSessionId) {
        if (!(window as any).Cashfree) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-cashfree-sdk="true"]');
            if (existing) {
              existing.addEventListener('load', () => resolve(), { once: true });
              existing.addEventListener('error', () => reject(new Error('Failed to load Cashfree checkout')), { once: true });
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
            script.async = true;
            script.dataset.cashfreeSdk = 'true';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Cashfree checkout'));
            document.head.appendChild(script);
          });
        }
        const cashfree = (window as any).Cashfree({
          mode: (import.meta.env.VITE_CASHFREE_ENV || (import.meta.env.DEV ? 'sandbox' : 'production')).toLowerCase(),
        });
        await cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: '_self' });
        return;
      }
      toast({ title: 'Checkout started', description: 'Awaiting payment provider response.' });
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === 'PRACTICE_INVENTORY_UNAVAILABLE') {
        toast({
          title: 'Practice Pass is not on sale yet',
          description: 'No deeply reviewed Practice exam is currently release-ready. No order was created.',
          variant: 'destructive',
        });
        return;
      }
      if (e instanceof ApiError && e.code === 'SUBSCRIPTION_CHECKOUT_PENDING') {
        toast({
          title: 'Checkout already pending',
          description: 'Finish or allow the existing checkout to expire before starting another order.',
        });
        return;
      }
      if (e instanceof ApiError && e.code === 'SUBSCRIPTION_ALREADY_ACTIVE') {
        toast({ title: 'Practice Pass already active', description: 'Your account already has active Practice access.' });
        setLocation('/practice');
        return;
      }
      if (String(e instanceof Error ? e.message : '').toLowerCase().includes('profile')) {
        toast({ title: 'Complete your workspace first', description: `Add the required ${ownerType} details, then your plan selection will continue.` });
        setLocation(`/register?role=${ownerType}&plan=${plan}&mode=add`);
        return;
      }
      toast({
        title: 'Could not start checkout',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-screen bg-cream-soft flex flex-col">
      <SEO
        title="Pricing"
        description="Transparent pricing for learners, creators, institutes and recruiters on Octamy, including fixed-term Practice Pass access for reviewed practice exams."
        path="/pricing"
      />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="relative overflow-hidden px-4 py-12 text-center sm:py-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)]" />
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-sky-300/25 blur-3xl animate-blob" />
          <div className="relative max-w-3xl mx-auto">
            <p className="inline-flex items-center rounded-full border border-cream-deep bg-cream-soft/80 backdrop-blur px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              Pricing
            </p>
            <h1 className="mt-5 text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
              Simple, transparent <span className="bg-gradient-to-r from-sky-700 to-indigo-700 bg-clip-text text-transparent">pricing</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">One platform, four roles. Pick what fits.</p>
            <div className="mt-8 inline-flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm" aria-label="Billing cycle">
              <button
                type="button"
                aria-pressed={cycle === 'monthly'}
                className={`min-h-11 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${cycle === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setCycle('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                aria-pressed={cycle === 'yearly'}
                className={`min-h-11 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${cycle === 'yearly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setCycle('yearly')}
              >
                Yearly <span className="text-xs opacity-80">· 2 months free</span>
              </button>
            </div>
          </div>
        </section>

        {selected && (
          <section className="px-4 pb-4" aria-labelledby="selected-plan-title">
            <div className="mx-auto flex max-w-5xl flex-col gap-5 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">{selected.welcome ? 'Workspace created' : 'Saved plan selection'}</p>
                  <h2 id="selected-plan-title" className="mt-1 text-xl font-bold text-slate-950">
                    {selected.role === 'learner' ? 'Practice Pass' : selected.role === 'creator' ? 'Creator' : 'Institute'} {selected.role === 'learner' ? (cycle === 'yearly' ? '365-day access' : '30-day access') : selected.plan.charAt(0).toUpperCase() + selected.plan.slice(1)} is ready to review.
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">Confirm the billing cycle, then continue securely. You will see the amount before payment.</p>
                </div>
              </div>
              {!user && selected.role === 'learner'
                ? <div className="grid shrink-0 gap-2 sm:grid-cols-2">
                    <Button asChild><Link href={practiceAccountPath('register', { cycle, next: selected.next })}>Create learner account</Link></Button>
                    <Button asChild variant="outline"><Link href={practiceAccountPath('login', { cycle, next: selected.next })}>Sign in</Link></Button>
                  </div>
                : <Button
                    onClick={() => subscribe(selected.role, selected.plan, selected.role)}
                    disabled={submitting !== null}
                    className="shrink-0"
                  >
                    {submitting === `${selected.role}:${selected.plan}` ? <Loader2 className="animate-spin" /> : null}
                    Continue with {selected.role === 'learner' ? 'Practice Pass' : selected.plan.charAt(0).toUpperCase() + selected.plan.slice(1)}
                    <ArrowRight className="h-4 w-4" />
                  </Button>}
            </div>
          </section>
        )}

        <section className="py-12 px-4">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-4 gap-6">
            {/* LEARNER */}
            <Column title="Learner" subtitle="For individuals">
              <Tier
                name="Free forever"
                price="Free"
                features={[
                  'Take any free assessment',
                  'Buy verified certificates (₹199–₹999)',
                  'Performance-based badges',
                  'Status-aware credential record',
                ]}
                cta={{ label: 'Sign up free', href: '/register?role=learner' }}
              />
              <Tier
                name="Practice Pass"
                price={cycle === 'yearly' ? '₹2,990 / 365 days' : '₹299 / 30 days'}
                meta="Fixed-term access to reviewed Practice exams"
                highlight
                busy={submitting === 'learner:all_access'}
                features={[
                  'Unlimited practice-only exams',
                  'Government, recruitment, interview and coding practice stays separate from recruiter credentials',
                  'Review correct and incorrect answers after each attempt',
                  'Career certifications, creator products, and institute exams stay separately funded',
                ]}
                cta={{ label: 'Choose Practice Pass', onClick: () => subscribe('learner', 'all_access', 'learner') }}
              />
            </Column>

            {/* CREATOR */}
            <Column title="Creator" subtitle="Sell your courses">
              <Tier
                name="Starter"
                price="Free"
                meta="1 active course"
                features={['Basic analytics', 'Octamy-branded assessment pages']}
                selected={selected?.role === 'creator' && selected.plan === 'free'}
                busy={submitting === 'creator:free'}
                cta={{ label: 'Start free', onClick: () => subscribe('creator', 'free', 'creator') }}
              />
              <Tier
                name="Pro"
                price={discounted(499, cycle)}
                meta="10 active courses"
                highlight
                selected={selected?.role === 'creator' && selected.plan === 'pro'}
                busy={submitting === 'creator:pro'}
                features={['Curriculum builder', 'Attempt reporting', 'Question-bank workflow', 'Priority review']}
                cta={{ label: 'Choose Pro', onClick: () => subscribe('creator', 'pro', 'creator') }}
              />
              <Tier
                name="Premium"
                price={discounted(1999, cycle)}
                meta="Unlimited courses"
                selected={selected?.role === 'creator' && selected.plan === 'premium'}
                busy={submitting === 'creator:premium'}
                features={['Expanded catalog', 'Question-bank workflow', 'Reporting history', 'Priority support']}
                cta={{ label: 'Choose Premium', onClick: () => subscribe('creator', 'premium', 'creator') }}
              />
            </Column>

            {/* INSTITUTE */}
            <Column title="Institute" subtitle="Schools, colleges, L&D">
              <Tier
                name="Starter"
                price={discounted(2999, cycle)}
                meta="Core institute workspace"
                selected={selected?.role === 'institute' && selected.plan === 'starter'}
                busy={submitting === 'institute:starter'}
                features={['Bulk CSV enrolment', 'Private question banks', 'Results export', 'Team roles']}
                cta={{ label: 'Choose Starter', onClick: () => subscribe('institute', 'starter', 'institute') }}
              />
              <Tier
                name="Growth"
                price={discounted(9999, cycle)}
                meta="Expanded institute workspace"
                highlight
                selected={selected?.role === 'institute' && selected.plan === 'growth'}
                busy={submitting === 'institute:growth'}
                features={['Scheduled exam windows', 'Advanced reports', 'Team access', 'Priority support']}
                cta={{ label: 'Choose Growth', onClick: () => subscribe('institute', 'growth', 'institute') }}
              />
              <Tier
                name="Enterprise"
                price="Custom"
                meta="Unlimited"
                features={['Integration discovery', 'Dedicated success manager', 'Security review', 'Custom SLA']}
                cta={{ label: 'Talk to sales', href: '/contact' }}
              />
            </Column>

            {/* RECRUITER — credit packs, fulfilled from the recruiter wallet */}
            <Column title="Recruiter" subtitle="Pay only for protected access">
              <Tier
                name="Explore"
                price="₹1,000"
                meta="100 credits"
                features={['Candidate filters', 'Saved searches', 'Learner-granted credential evidence']}
                cta={{ label: 'Start recruiting', href: '/recruiter/register' }}
              />
              <Tier
                name="Hiring"
                price="₹4,500"
                meta="500 credits · save 10%"
                highlight
                features={['Protected profile access', 'CV downloads', 'Learner-selected evidence grants']}
                cta={{ label: 'Start recruiting', href: '/recruiter/register' }}
              />
              <Tier
                name="Scale"
                price="₹8,000"
                meta="1,000 credits · save 20%"
                features={['Full search workspace', 'Activity analytics', 'Transaction history']}
                cta={{ label: 'Start recruiting', href: '/recruiter/register' }}
              />
            </Column>
          </div>
        </section>

        <section className="py-12 px-4 text-center text-sm text-slate-500">
          <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Prices in INR. GST extra where applicable. Practice Pass covers practice exams only; recruiter-visible certifications, creator products, and private institute exams are outside the plan.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Column({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="text-center pb-2 border-b border-cream-deep">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Tier({
  name, price, meta, features, highlight, selected, busy, cta,
}: {
  name: string; price: string; meta?: string; features: string[]; highlight?: boolean; selected?: boolean; busy?: boolean;
  cta: { label: string; href?: string; onClick?: () => void };
}) {
  const button = (
    <Button
      onClick={cta.onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      className={`w-full mt-5 ${highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`}
      variant={highlight ? 'default' : 'outline'}
    >
      {busy && <Loader2 className="animate-spin" />}
      {selected ? `Continue with ${name}` : cta.label}
    </Button>
  );
  return (
    <Card className={`relative border ${selected ? 'border-emerald-600 ring-2 ring-emerald-600/15' : highlight ? 'border-slate-900 shadow-md' : 'border-slate-200'}`}>
      <CardContent className="pt-6">
        <div className="flex items-baseline justify-between">
          <div className="font-semibold text-slate-900">{name}</div>
          {selected
            ? <span className="text-[10px] uppercase tracking-wide bg-emerald-700 text-white px-2 py-1 rounded-full">Selected</span>
            : highlight && <span className="text-[10px] uppercase tracking-wide bg-slate-900 text-white px-2 py-1 rounded-full">Popular</span>}
        </div>
        <div className="text-2xl font-semibold text-slate-900 mt-2">{price}</div>
        {meta && <div className="text-xs text-slate-500 mt-1">{meta}</div>}
        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          {features.map((f) => (
            <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />{f}</li>
          ))}
        </ul>
        {cta.href ? (
          <Button asChild className={`w-full mt-5 ${highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`} variant={highlight ? 'default' : 'outline'}>
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        ) : button}
      </CardContent>
    </Card>
  );
}
