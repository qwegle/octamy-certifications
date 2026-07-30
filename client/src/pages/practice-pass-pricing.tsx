import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowRight, Check, CheckCircle2, Dumbbell, Loader2, ShieldX } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { SEO } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth.tsx';
import { ApiError, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { safeInternalReturnTo } from '@/lib/navigation-safety';
import {
  normalizePracticePassCycle,
  practiceAccountPath,
  type PracticePassCycle,
  PRACTICE_PASS_PLAN,
  PRACTICE_PASS_PRICES,
} from '@/lib/practice-purchase-intent';

export default function PracticePassPricing() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [cycle, setCycle] = useState<PracticePassCycle>(() => normalizePracticePassCycle(params.get('cycle')));
  const [submitting, setSubmitting] = useState(false);
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const next = safeInternalReturnTo(params.get('next')) || '/practice';
  const selected = params.get('selected') === PRACTICE_PASS_PLAN;
  const welcome = params.get('welcome') === '1';
  const price = cycle === 'yearly' ? PRACTICE_PASS_PRICES.yearly : PRACTICE_PASS_PRICES.monthly;
  const days = cycle === 'yearly' ? 365 : 30;

  async function subscribe() {
    if (!user || !token) {
      setLocation(practiceAccountPath('register', { cycle, next }));
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiRequest('POST', '/api/subscriptions/checkout', {
        ownerType: 'learner',
        plan: PRACTICE_PASS_PLAN,
        cycle,
      });
      const data = await response.json();
      if (data.activated) {
        toast({ title: 'Practice Pass activated', description: 'Your practice access is ready.' });
        setLocation(next);
        return;
      }
      if (data.orderId) {
        try {
          localStorage.setItem('octamy.pendingSubscriptionOrder', JSON.stringify({
            orderId: data.orderId,
            ownerType: 'learner',
            plan: PRACTICE_PASS_PLAN,
            next,
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
      toast({ title: 'Checkout started', description: 'Awaiting the payment provider response.' });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'PRACTICE_INVENTORY_UNAVAILABLE') {
        toast({ title: 'Practice Pass is not on sale yet', description: 'No deeply reviewed Practice exam is currently release-ready. No order was created.', variant: 'destructive' });
      } else if (error instanceof ApiError && error.code === 'SUBSCRIPTION_CHECKOUT_PENDING') {
        toast({ title: 'Checkout already pending', description: 'Finish or allow the existing checkout to expire before starting another order.' });
      } else if (error instanceof ApiError && error.code === 'SUBSCRIPTION_ALREADY_ACTIVE') {
        toast({ title: 'Practice Pass already active', description: 'Your account already has active Practice access.' });
        setLocation(next);
      } else {
        toast({ title: 'Could not start checkout', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fafafa] text-slate-950">
      <SEO title="Practice Pass pricing" description="Practice Pass unlocks reviewed practice exams for 30 or 365 days. It does not include or issue a certification credential." path="/pricing/practice-pass" />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="relative overflow-hidden px-4 py-14 sm:py-20">
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-slate-100/80 via-transparent to-slate-100/70" />
          <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-800"><Dumbbell className="h-4 w-4" />Practice subscription</p>
              <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] sm:text-6xl">Practise deeply. Certify separately.</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">Practice Pass unlocks reviewed Practice exams and answer review for one fixed access term. It never grants a certificate, verified credential, or recruiter-facing evidence.</p>
              <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="flex items-center gap-2 font-black text-slate-950"><ShieldX className="h-5 w-5" />No certification credential is included</p>
                <p className="mt-1 text-sm leading-6 text-slate-800">Certification is a different product: attempt free, then pay its separate one-off credential price only after passing if you choose to activate it.</p>
              </div>
            </div>

            <Card className="rounded-[2rem] border-2 border-slate-400 bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
              <CardContent className="p-7 sm:p-9">
                {(selected || welcome) && <div className="mb-5 flex gap-3 rounded-2xl bg-slate-50 p-4 text-slate-950"><CheckCircle2 className="h-5 w-5 shrink-0" /><div><p className="font-black">{welcome ? 'Account ready' : 'Practice Pass selected'}</p><p className="mt-1 text-xs">Review the term and price before continuing. Nothing is charged automatically.</p></div></div>}
                <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1" aria-label="Access term">
                  <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')} className={`min-h-11 rounded-xl px-3 text-sm font-black ${cycle === 'monthly' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>30 days</button>
                  <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')} className={`min-h-11 rounded-xl px-3 text-sm font-black ${cycle === 'yearly' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>365 days</button>
                </div>
                <p className="mt-7 text-sm font-bold text-slate-500">Practice Pass · {days}-day access</p>
                <p className="mt-1 text-4xl font-black tracking-tight">₹{price.toLocaleString('en-IN')}</p>
                <p className="mt-1 text-xs text-slate-500">Fixed term · GST extra where applicable</p>
                <ul className="mt-7 space-y-3 text-sm font-semibold text-slate-700">
                  {['Unlimited attempts on eligible reviewed Practice exams', 'Correct-and-incorrect answer review after practice attempts', 'Return to the practice assessment you started from'].map((item) => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />{item}</li>)}
                </ul>
                {user ? (
                  <Button className="mt-8 min-h-12 w-full bg-slate-700 text-white hover:bg-slate-800" disabled={submitting} onClick={() => void subscribe()}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Continue to secure checkout<ArrowRight className="h-4 w-4" /></Button>
                ) : (
                  <div className="mt-8 grid gap-2 sm:grid-cols-2">
                    <Button asChild className="min-h-12 bg-slate-700 text-white hover:bg-slate-800"><Link href={practiceAccountPath('register', { cycle, next })}>Create account</Link></Button>
                    <Button asChild variant="outline" className="min-h-12"><Link href={practiceAccountPath('login', { cycle, next })}>Sign in</Link></Button>
                  </div>
                )}
                <p className="mt-4 text-center text-xs leading-5 text-slate-500">You will see the final amount before payment. Your originating assessment is preserved.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-12">
          <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">Looking for a credential?</p><h2 className="mt-2 text-2xl font-black">Certification attempts are free; credential activation is separate.</h2></div>
            <Button asChild variant="outline" className="min-h-11 shrink-0"><Link href="/pricing/certification">See certification pricing <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
