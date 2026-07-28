import { Link, Redirect, useSearch } from 'wouter';
import { ArrowRight, Award, Building2, CheckCircle2, Dumbbell, ShieldCheck } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  PRACTICE_PASS_PLAN,
  practicePassPath,
} from '@/lib/practice-purchase-intent';

export default function Pricing() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const role = params.get('role');
  const selected = params.get('selected');

  // Registration and older links deliberately return through /pricing. Keep
  // that contract stable, then move the user onto the separated surface.
  if (role === 'learner' && selected === PRACTICE_PASS_PLAN) {
    return <Redirect to={practicePassPath({
      cycle: params.get('cycle'),
      next: params.get('next'),
      welcome: params.get('welcome') === '1',
      selected: true,
    })} replace />;
  }
  if ((role === 'creator' || role === 'institute') && selected) {
    return <Redirect to={`/pricing/workspaces${search ? `?${search}` : ''}`} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f5f0] text-slate-950">
      <SEO
        title="Octamy pricing: practice or certification"
        description="Choose Practice Pass for practice exams, or take a certification assessment free and pay separately only when activating a verified credential."
        path="/pricing"
      />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="relative overflow-hidden px-4 py-16 sm:py-24">
          <div aria-hidden className="absolute inset-0 bg-grid-slate opacity-50 [mask-image:radial-gradient(ellipse_at_top,black_35%,transparent_76%)]" />
          <div aria-hidden className="absolute -right-28 top-0 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
          <div className="relative mx-auto max-w-4xl text-center">
            <p className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm">Choose the right path</p>
            <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] sm:text-6xl">Practice access and certification credentials are separate.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">Practice Pass is a fixed-term subscription for practice exams. Certification attempts are free, with a separate one-off payment only if you choose to unlock the detailed review and verified credential.</p>
          </div>
        </section>

        <section className="px-4 pb-16" aria-label="Pricing choices">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
            <PricingChoice
              accent="violet"
              icon={<Dumbbell className="h-7 w-7" aria-hidden="true" />}
              eyebrow="Practise"
              title="Practice Pass"
              price="₹299 / 30 days or ₹2,990 / 365 days"
              description="Unlock the reviewed Practice catalogue for the selected access term. It never includes or issues a certification credential."
              points={['Practice exams and answer review', '30-day or 365-day fixed-term access', 'No certificate or recruiter-facing credential']}
              href="/pricing/practice-pass"
              cta="See Practice Pass"
            />
            <PricingChoice
              accent="emerald"
              icon={<Award className="h-7 w-7" aria-hidden="true" />}
              eyebrow="Get certified"
              title="Certification pricing"
              price="Free attempt · one-off credential fee"
              description="Take the assessment and see your score free. After passing, pay the price shown for that assessment only if you want the detailed review and verified credential."
              points={['No payment to attempt', 'Score remains free', 'Practice Pass does not cover credential activation']}
              href="/pricing/certification"
              cta="Understand certification pricing"
            />
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-12">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 rounded-[2rem] bg-slate-950 p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-sky-300"><Building2 className="h-4 w-4" />For organizations</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">Creator and institute workspace plans</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Publishing and institute workspace subscriptions have their own pricing. They do not turn Practice Pass into a credential.</p>
            </div>
            <Button asChild variant="secondary" className="min-h-11 shrink-0"><Link href="/pricing/workspaces">View workspace plans <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>

        <section className="px-4 py-10 text-center text-sm text-slate-600">
          <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-700" />Prices are in INR. GST is extra where applicable. No certification payment is taken automatically.</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function PricingChoice({ accent, icon, eyebrow, title, price, description, points, href, cta }: {
  accent: 'violet' | 'emerald';
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  price: string;
  description: string;
  points: string[];
  href: string;
  cta: string;
}) {
  const theme = accent === 'violet'
    ? 'border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 text-violet-800'
    : 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 text-emerald-800';
  return (
    <Card className={`overflow-hidden rounded-[2rem] border-2 shadow-[0_24px_70px_-45px_rgba(15,23,42,0.55)] ${theme}`}>
      <CardContent className="flex h-full flex-col p-7 sm:p-9">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">{icon}</span>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.16em]">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-3 text-lg font-black text-slate-900">{price}</p>
        <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
        <ul className="mt-6 space-y-3 text-sm font-semibold text-slate-800">
          {points.map((point) => <li key={point} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{point}</li>)}
        </ul>
        <Button asChild className="mt-8 min-h-12 w-full bg-slate-950 text-white hover:bg-black"><Link href={href}>{cta}<ArrowRight className="h-4 w-4" /></Link></Button>
      </CardContent>
    </Card>
  );
}
