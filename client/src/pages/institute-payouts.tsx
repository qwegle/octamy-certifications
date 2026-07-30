import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ArrowDownToLine, Banknote, Wallet } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PayoutData = {
  availableINR: number;
  lifetimePayoutsINR: number;
  requests: Array<{ id: number; amount: string; status: string; createdAt: string; upi: string | null }>;
  recentSplits: Array<{ id: number; amount: string; status: string; createdAt: string }>;
  policy: { ownerSharePercent: number; basis: string; settlement: string };
};
type FormValues = { amount: number; upi?: string; bankAccount?: string; ifsc?: string };

export default function InstitutePayouts() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  useEffect(() => {
    if (!authLoading && (!user || !token)) setLocation("/institute/login");
  }, [authLoading, user, token, setLocation]);

  const { data, isLoading } = useQuery<PayoutData>({
    queryKey: ["/api/institute/payouts"],
    enabled: Boolean(user && token),
    queryFn: async () => (await apiRequest("GET", "/api/institute/payouts")).json(),
  });

  const request = useMutation({
    mutationFn: async (values: FormValues) => (await apiRequest("POST", "/api/institute/payouts/request", values)).json(),
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["/api/institute/payouts"] });
      toast({ title: "Payout request recorded", description: "An institute admin can track its review status here." });
    },
    onError: (error: Error) => toast({ title: "Payout request was not created", description: error.message, variant: "destructive" }),
  });

  if (!user) return null;
  const available = data?.availableINR ?? 0;

  return (
    <DashboardLayout role="institute" title="Revenue & payouts" description="Track institute revenue-share entries and request a payout from settled funds." breadcrumbs={[{ label: "Institute", href: "/institute/dashboard" }, { label: "Payouts" }]}>
      <SEO title="Institute Payouts" description="Manage institute revenue-share payouts." path="/institute/payouts" noIndex />

      <div className="grid gap-4 md:grid-cols-3">
        <Metric title="Available" value={`₹${available.toLocaleString("en-IN")}`} icon={Wallet} />
        <Metric title="Lifetime payouts" value={`₹${(data?.lifetimePayoutsINR ?? 0).toLocaleString("en-IN")}`} icon={Banknote} />
        <Metric title="Pending requests" value={String(data?.requests.filter((item) => item.status === "pending").length ?? 0)} icon={ArrowDownToLine} />
      </div>

      <Card className="mt-6 border-slate-200 bg-slate-50/70">
        <CardContent className="p-5">
          <h2 className="font-bold text-slate-950">How the institute split works</h2>
          <p className="mt-1 text-sm leading-6 text-slate-900/75">
            The institute receives {data?.policy.ownerSharePercent ?? 80}% of each paid credential activation on institute-owned programs. Shipping is excluded. Affiliate commission comes from the remaining platform share.
          </p>
          <p className="mt-2 text-xs text-slate-900/60">{data?.policy.settlement}</p>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Request payout</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((values) => request.mutate(values))} className="space-y-4">
              <div><label className="text-sm font-semibold">Amount (₹)</label><Input type="number" min={500} max={available || undefined} {...register("amount", { required: true, valueAsNumber: true, min: 500, max: available })} />{errors.amount && <p className="mt-1 text-xs text-slate-700">Enter at least ₹500 and no more than the available balance.</p>}</div>
              <div><label className="text-sm font-semibold">UPI ID</label><Input placeholder="finance@bank" {...register("upi")} /></div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">or bank transfer</div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-semibold">Bank account</label><Input {...register("bankAccount")} /></div>
                <div><label className="text-sm font-semibold">IFSC</label><Input placeholder="HDFC0000123" {...register("ifsc")} /></div>
              </div>
              <Button type="submit" className="w-full bg-slate-950 text-white" disabled={request.isPending || available < 500}>{request.isPending ? "Submitting…" : "Request payout"}</Button>
              {available < 500 && <p className="text-xs leading-5 text-slate-500">At least ₹500 in settled institute-share entries is required.</p>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Request history</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {!isLoading && !data?.requests.length && <p className="text-sm text-slate-500">No payout requests yet.</p>}
            {data?.requests.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <div><p className="font-bold">₹{Number(item.amount).toLocaleString("en-IN")}</p><p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()} · {item.upi || "Bank"}</p></div>
                <Badge variant={item.status === "paid" ? "default" : item.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{item.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Metric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof Wallet }) {
  return <Card><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-black">{value}</p></div><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100"><Icon className="h-5 w-5" /></span></CardContent></Card>;
}
