import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth.tsx';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/seo';
import { Wallet, Banknote, ArrowDownToLine } from 'lucide-react';

type PayoutsData = {
  availableINR: number;
  lifetimePayoutsINR: number;
  requests: Array<{ id: number; amount: string; status: string; createdAt: string; upi: string | null }>;
  recentSplits: Array<{ id: number; amount: string; status: string; createdAt: string }>;
  policy: { ownerSharePercent: number; basis: string; settlement: string };
};

type FormVals = { amount: number; upi?: string; bankAccount?: string; ifsc?: string };

export default function CreatorPayouts() {
  const [, setLocation] = useLocation();
  const { user, token, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormVals>();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation('/login');
  }, [authLoading, user, token, setLocation]);

  const { data, isLoading } = useQuery<PayoutsData>({
    queryKey: ['/api/creator/payouts'],
    enabled: !!user && !!token,
    queryFn: async () => (await apiRequest('GET', '/api/creator/payouts')).json(),
  });

  const requestPayout = useMutation({
    mutationFn: async (vals: FormVals) => (await apiRequest('POST', '/api/creator/payouts/request', vals)).json(),
    onSuccess: () => {
      toast({ title: 'Payout requested', description: 'The request is now pending manual review.' });
      reset();
      queryClient.invalidateQueries({ queryKey: ['/api/creator/payouts'] });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message ?? 'Try again', variant: 'destructive' }),
  });

  return (
    <DashboardLayout role="creator" title="Earnings & Payouts" breadcrumbs={[{ label: 'Creator', href: '/creator/dashboard' }, { label: 'Earnings & Payouts' }]}>
      <SEO title="Creator Payouts — Octamy" description="Request earnings payouts" />
              <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Earnings & Payouts</h1>
            <p className="text-zinc-500 mt-1">Request withdrawal from settled creator-share entries. Gross course sales are not a payout balance.</p>
          </div>
          <Link href="/creator/dashboard"><Button variant="outline">Back to dashboard</Button></Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-2"><Wallet className="w-4 h-4" />Available</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">₹{(data?.availableINR ?? 0).toLocaleString('en-IN')}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-2"><Banknote className="w-4 h-4" />Lifetime payouts</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">₹{(data?.lifetimePayoutsINR ?? 0).toLocaleString('en-IN')}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-zinc-500 flex items-center gap-2"><ArrowDownToLine className="w-4 h-4" />Pending requests</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{data?.requests.filter(r => r.status === 'pending').length ?? 0}</div></CardContent>
          </Card>
        </div>

        <Card className="mb-8 border-violet-200 bg-violet-50/70">
          <CardContent className="p-5">
            <p className="font-semibold text-violet-950">How the split works</p>
            <p className="mt-1 text-sm leading-6 text-violet-900/75">
              Your current creator share is {data?.policy.ownerSharePercent ?? 80}% of the certificate activation fee. Shipping is excluded. An affiliate commission, when present, comes from the remaining platform share—not from your creator share.
            </p>
            <p className="mt-2 text-xs text-violet-900/60">{data?.policy.settlement || 'Confirmed payments create an auditable split entry before funds become withdrawable.'}</p>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Request payout</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((v) => requestPayout.mutate(v))} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Amount (₹)</label>
                  <Input type="number" min={500} max={data?.availableINR || undefined} step={1} {...register('amount', { required: true, valueAsNumber: true, min: 500, max: data?.availableINR })} />
                  {errors.amount && <p className="text-xs text-red-500 mt-1">Min ₹500</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">UPI ID (preferred)</label>
                  <Input placeholder="name@oksbi" {...register('upi')} />
                </div>
                <div className="text-xs text-zinc-400">— or —</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Bank account</label>
                    <Input {...register('bankAccount')} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">IFSC</label>
                    <Input placeholder="HDFC0000123" {...register('ifsc')} />
                  </div>
                </div>
                <Button type="submit" disabled={requestPayout.isPending || (data?.availableINR ?? 0) < 500} className="w-full">
                  {requestPayout.isPending ? 'Submitting…' : 'Request payout'}
                </Button>
                {(data?.availableINR ?? 0) < 500 && (
                  <p className="text-xs leading-5 text-zinc-500">No request can be made until at least ₹500 appears as a settled creator-share entry.</p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Request history</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <p className="text-sm text-zinc-500">Loading…</p> : (
                <div className="space-y-2">
                  {(data?.requests ?? []).length === 0 && <p className="text-sm text-zinc-500">No payout requests yet.</p>}
                  {(data?.requests ?? []).map((r) => (
                    <div key={r.id} className="flex justify-between items-center border rounded-lg p-3">
                      <div>
                        <div className="font-medium">₹{Number(r.amount).toLocaleString('en-IN')}</div>
                        <div className="text-xs text-zinc-500">{new Date(r.createdAt).toLocaleDateString()} · {r.upi ?? 'Bank'}</div>
                      </div>
                      <Badge variant={r.status === 'paid' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
  );
}
