import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth.tsx';
import { SEO } from '@/components/seo';

type OwnerType = 'learner' | 'creator' | 'institute' | 'recruiter';

export default function BillingReturn() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading } = useAuth();
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const ownerType = query.get('ownerType') as OwnerType | null;
  const expectedPlan = query.get('plan');
  const [state, setState] = useState<'checking' | 'active' | 'pending' | 'error'>('checking');

  const dashboard = ownerType === 'learner'
    ? '/dashboard'
    : ownerType === 'creator'
    ? '/creator/dashboard'
    : ownerType === 'institute'
      ? '/institute/dashboard'
      : '/recruiter/dashboard';

  useEffect(() => {
    if (!isLoading && (!user || !token)) {
      setLocation(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [isLoading, setLocation, token, user]);

  useEffect(() => {
    if (!user || !token || !ownerType || !expectedPlan) {
      if (!isLoading && (!ownerType || !expectedPlan)) setState('error');
      return;
    }

    let stopped = false;
    let attempt = 0;
    const check = async () => {
      try {
        const response = await apiRequest('GET', '/api/me/subscription');
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message || 'Unable to verify the subscription');
        if (data?.[ownerType]?.plan === expectedPlan) {
          if (!stopped) setState('active');
          return;
        }
        attempt += 1;
        if (attempt >= 6) {
          if (!stopped) setState('pending');
          return;
        }
        window.setTimeout(check, 2000);
      } catch {
        if (!stopped) setState('error');
      }
    };
    check();
    return () => { stopped = true; };
  }, [expectedPlan, isLoading, ownerType, token, user]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16 grid place-items-center">
      <SEO title="Subscription status" description="Confirming your Octamy subscription." path="/billing/return" />
      <Card className="w-full max-w-lg border-2 border-slate-900 shadow-[6px_6px_0_0_rgba(15,23,42,0.9)]">
        <CardContent className="p-8 text-center">
          {state === 'checking' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-sky-600" />}
          {state === 'active' && <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />}
          {state === 'pending' && <Clock3 className="mx-auto h-12 w-12 text-amber-600" />}
          {state === 'error' && <XCircle className="mx-auto h-12 w-12 text-rose-600" />}
          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            {state === 'checking' && 'Confirming your payment'}
            {state === 'active' && 'Plan activated'}
            {state === 'pending' && 'Payment is being confirmed'}
            {state === 'error' && 'We could not verify the plan'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {state === 'checking' && 'This usually takes only a few seconds. Keep this page open.'}
            {state === 'active' && `Your ${expectedPlan} plan is ready to use.`}
            {state === 'pending' && 'Your payment may still be processing. Your dashboard will update as soon as the provider confirms it.'}
            {state === 'error' && 'No additional payment is required. Check your dashboard or contact support with your payment reference.'}
          </p>
          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="outline"><Link href="/contact">Contact support</Link></Button>
            <Button asChild className="bg-slate-950 text-white"><Link href={dashboard}>Go to dashboard</Link></Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
