import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type Cycle = 'monthly' | 'yearly';

function discounted(monthly: number, cycle: Cycle): string {
  if (cycle === 'monthly') return `₹${monthly.toLocaleString('en-IN')}/mo`;
  // 2 months free
  const yearly = Math.round(monthly * 10);
  return `₹${yearly.toLocaleString('en-IN')}/yr`;
}

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  async function subscribe(ownerType: 'creator' | 'institute' | 'recruiter', plan: string, registerRole: string) {
    if (!user || !token) {
      setLocation(`/register?role=${registerRole}&plan=${plan}`);
      return;
    }
    try {
      const res = await apiRequest('POST', '/api/subscriptions/checkout', { ownerType, plan, cycle });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404 && data?.message?.toLowerCase?.().includes('profile')) {
          toast({ title: 'Set up your profile first', description: `Create your ${ownerType} profile to subscribe.` });
          setLocation(`/${ownerType}/register?plan=${plan}`);
          return;
        }
        throw new Error(data.message || 'Failed to start checkout');
      }
      if (data.activated) {
        toast({ title: 'Plan activated', description: `You're on ${plan.toUpperCase()} now.` });
        setLocation(`/${ownerType}/dashboard`);
        return;
      }
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
        return;
      }
      toast({ title: 'Checkout started', description: 'Awaiting payment provider response.' });
    } catch (e: any) {
      toast({ title: 'Could not start checkout', description: e.message, variant: 'destructive' });
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Pricing"
        description="Transparent pricing for learners, creators, institutes and recruiters on Octamy. Free for learners. Start from ₹499/mo."
        path="/pricing"
      />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden py-20 px-4 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-slate [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)]" />
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-sky-300/25 blur-3xl animate-blob" />
          <div className="relative max-w-3xl mx-auto">
            <p className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 backdrop-blur px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              Pricing
            </p>
            <h1 className="mt-5 text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
              Simple, transparent <span className="bg-gradient-to-r from-sky-700 to-indigo-700 bg-clip-text text-transparent">pricing</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600">One platform, four roles. Pick what fits.</p>
            <div className="mt-8 inline-flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm">
              <button
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${cycle === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${cycle === 'yearly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setCycle('yearly')}
              >
                Yearly <span className="text-xs opacity-80">· 2 months free</span>
              </button>
            </div>
          </div>
        </section>

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
                  'Lifetime certificate access',
                ]}
                cta={{ label: 'Sign up free', href: '/register?role=learner' }}
              />
            </Column>

            {/* CREATOR */}
            <Column title="Creator" subtitle="Sell your courses">
              <Tier
                name="Starter"
                price="Free"
                meta="1 active course · 30% platform fee"
                features={['Basic analytics', 'Octamy-branded checkout']}
                cta={{ label: 'Start free', onClick: () => subscribe('creator', 'free', 'creator') }}
              />
              <Tier
                name="Pro"
                price={discounted(499, cycle)}
                meta="10 active courses · 20% platform fee"
                highlight
                features={['Custom subdomain', 'Drip release', 'Coupon codes', 'Priority review']}
                cta={{ label: 'Choose Pro', onClick: () => subscribe('creator', 'pro', 'creator') }}
              />
              <Tier
                name="Premium"
                price={discounted(1999, cycle)}
                meta="Unlimited courses · 10% platform fee"
                features={['White-label', 'Video transcoding', 'Affiliate commissioning', 'API access']}
                cta={{ label: 'Choose Premium', onClick: () => subscribe('creator', 'premium', 'creator') }}
              />
            </Column>

            {/* INSTITUTE */}
            <Column title="Institute" subtitle="Schools, colleges, L&D">
              <Tier
                name="Starter"
                price={discounted(2999, cycle)}
                meta="500 students · 5 cohorts"
                features={['Bulk CSV enroll', 'Private question banks', 'Results export', 'Your logo on certs']}
                cta={{ label: 'Choose Starter', onClick: () => subscribe('institute', 'starter', 'institute') }}
              />
              <Tier
                name="Growth"
                price={discounted(9999, cycle)}
                meta="5,000 students · Unlimited cohorts"
                highlight
                features={['White-label certificates', 'Scheduled exam windows', 'API access', 'Priority support']}
                cta={{ label: 'Choose Growth', onClick: () => subscribe('institute', 'growth', 'institute') }}
              />
              <Tier
                name="Enterprise"
                price="Custom"
                meta="Unlimited"
                features={['SSO', 'Dedicated success manager', 'On-prem options', 'Custom SLA']}
                cta={{ label: 'Talk to sales', href: '/contact' }}
              />
            </Column>

            {/* RECRUITER */}
            <Column title="Recruiter" subtitle="Hire on verified skill">
              <Tier
                name="Starter"
                price={discounted(2999, cycle)}
                meta="50 profile views/mo · 10 saved searches"
                features={['Email candidate', 'Score filter', 'Badge filter']}
                cta={{ label: 'Choose Starter', onClick: () => subscribe('recruiter', 'starter', 'recruiter') }}
              />
              <Tier
                name="Growth"
                price={discounted(9999, cycle)}
                meta="200 profile views/mo · Unlimited saved searches"
                highlight
                features={['CSV export', 'ATS webhook', 'Team seats (3)']}
                cta={{ label: 'Choose Growth', onClick: () => subscribe('recruiter', 'growth', 'recruiter') }}
              />
              <Tier
                name="Enterprise"
                price="Custom"
                meta="Unlimited"
                features={['Bulk credit packs', 'Dedicated CSM', 'Custom integrations']}
                cta={{ label: 'Talk to sales', href: '/contact' }}
              />
            </Column>
          </div>
        </section>

        <section className="py-12 px-4 text-center text-sm text-slate-500">
          Prices in INR. GST extra where applicable. Yearly billing saves 2 months.
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Column({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="text-center pb-2 border-b border-slate-200">
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Tier({
  name, price, meta, features, highlight, cta,
}: {
  name: string; price: string; meta?: string; features: string[]; highlight?: boolean;
  cta: { label: string; href?: string; onClick?: () => void };
}) {
  const button = (
    <Button
      onClick={cta.onClick}
      className={`w-full mt-5 ${highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`}
      variant={highlight ? 'default' : 'outline'}
      size="sm"
    >
      {cta.label}
    </Button>
  );
  return (
    <Card className={`border ${highlight ? 'border-slate-900 shadow-md' : 'border-slate-200'}`}>
      <CardContent className="pt-6">
        <div className="flex items-baseline justify-between">
          <div className="font-semibold text-slate-900">{name}</div>
          {highlight && <span className="text-[10px] uppercase tracking-wide bg-slate-900 text-white px-2 py-0.5 rounded-full">Popular</span>}
        </div>
        <div className="text-2xl font-semibold text-slate-900 mt-2">{price}</div>
        {meta && <div className="text-xs text-slate-500 mt-1">{meta}</div>}
        <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
          {features.map((f) => (
            <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />{f}</li>
          ))}
        </ul>
        {cta.href ? <Link href={cta.href}>{button}</Link> : button}
      </CardContent>
    </Card>
  );
}
