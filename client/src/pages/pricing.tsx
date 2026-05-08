import { useState } from 'react';
import { Link } from 'wouter';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

type Cycle = 'monthly' | 'yearly';

function discounted(monthly: number, cycle: Cycle): string {
  if (cycle === 'monthly') return `₹${monthly.toLocaleString('en-IN')}/mo`;
  // 2 months free
  const yearly = Math.round(monthly * 10);
  return `₹${yearly.toLocaleString('en-IN')}/yr`;
}

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('monthly');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SEO
        title="Pricing"
        description="Transparent pricing for learners, creators, institutes and recruiters on Octamy. Free for learners. Start from ₹499/mo."
        path="/pricing"
      />
      <Header />
      <main className="flex-1">
        <section className="py-16 px-4 text-center bg-gradient-to-b from-slate-50 to-white">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-semibold text-slate-900 tracking-tight">Simple, transparent pricing</h1>
            <p className="mt-4 text-lg text-slate-600">One platform, four roles. Pick what fits.</p>
            <div className="mt-8 inline-flex items-center bg-white border border-slate-200 rounded-full p-1">
              <button
                className={`px-4 py-1.5 rounded-full text-sm ${cycle === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
                onClick={() => setCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`px-4 py-1.5 rounded-full text-sm ${cycle === 'yearly' ? 'bg-slate-900 text-white' : 'text-slate-700'}`}
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
                cta={{ label: 'Start free', href: '/register?role=creator&plan=starter' }}
              />
              <Tier
                name="Pro"
                price={discounted(499, cycle)}
                meta="10 active courses · 20% platform fee"
                highlight
                features={['Custom subdomain', 'Drip release', 'Coupon codes', 'Priority review']}
                cta={{ label: 'Choose Pro', href: '/register?role=creator&plan=pro' }}
              />
              <Tier
                name="Premium"
                price={discounted(1999, cycle)}
                meta="Unlimited courses · 10% platform fee"
                features={['White-label', 'Video transcoding', 'Affiliate commissioning', 'API access']}
                cta={{ label: 'Choose Premium', href: '/register?role=creator&plan=premium' }}
              />
            </Column>

            {/* INSTITUTE */}
            <Column title="Institute" subtitle="Schools, colleges, L&D">
              <Tier
                name="Starter"
                price={discounted(2999, cycle)}
                meta="500 students · 5 cohorts"
                features={['Bulk CSV enroll', 'Private question banks', 'Results export', 'Your logo on certs']}
                cta={{ label: 'Choose Starter', href: '/register?role=institute&plan=starter' }}
              />
              <Tier
                name="Growth"
                price={discounted(9999, cycle)}
                meta="5,000 students · Unlimited cohorts"
                highlight
                features={['White-label certificates', 'Scheduled exam windows', 'API access', 'Priority support']}
                cta={{ label: 'Choose Growth', href: '/register?role=institute&plan=growth' }}
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
                cta={{ label: 'Choose Starter', href: '/register?role=recruiter&plan=starter' }}
              />
              <Tier
                name="Growth"
                price={discounted(9999, cycle)}
                meta="200 profile views/mo · Unlimited saved searches"
                highlight
                features={['CSV export', 'ATS webhook', 'Team seats (3)']}
                cta={{ label: 'Choose Growth', href: '/register?role=recruiter&plan=growth' }}
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
  cta: { label: string; href: string };
}) {
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
        <Link href={cta.href}>
          <Button className={`w-full mt-5 ${highlight ? 'bg-slate-900 hover:bg-black text-white' : ''}`} variant={highlight ? 'default' : 'outline'} size="sm">
            {cta.label}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
