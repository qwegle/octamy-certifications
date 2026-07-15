import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarClock, CheckCircle2, Loader2, Mail, ShieldCheck, TicketCheck, Users } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type VoucherBatch = {
  id: number;
  name: string;
  status: "active" | "paused" | "exhausted" | "revoked";
  quantity: number;
  expiresAt: string;
  courseTitle: string | null;
  available: number;
  assigned: number;
  redeemed: number;
};

export default function InstituteVouchers() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const { data, isLoading, error, refetch } = useQuery<{ items: VoucherBatch[] }>({
    queryKey: ["/api/institute/certification-vouchers"],
    queryFn: async () => (await apiRequest("GET", "/api/institute/certification-vouchers")).json(),
  });
  const assignMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/institute/certification-vouchers/assign", { code, email })).json(),
    onSuccess: () => {
      toast({ title: "Voucher assigned", description: `The voucher is now reserved for ${email.trim().toLowerCase()}.` });
      setCode("");
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["/api/institute/certification-vouchers"] });
    },
    onError: (mutationError) => toast({ title: "Voucher not assigned", description: mutationError instanceof Error ? mutationError.message : "Review the code and learner email." }),
  });

  const batches = data?.items || [];
  const totals = batches.reduce((result, batch) => ({
    issued: result.issued + batch.quantity,
    available: result.available + batch.available,
    redeemed: result.redeemed + batch.redeemed,
  }), { issued: 0, available: 0, redeemed: 0 });

  return (
    <DashboardLayout
      role="institute"
      title="Certification vouchers"
      description="Sponsor Octamy in-house credentials for selected learners without student checkout."
      breadcrumbs={[{ label: "Institute", href: "/institute/dashboard" }, { label: "Certification vouchers" }]}
      actions={<Button asChild variant="outline" className="w-full sm:w-auto"><Link href="/contact?subject=certification-vouchers">Request an allocation</Link></Button>}
    >
      <SEO title="Certification vouchers · Institute" description="Assign and track institute-sponsored Octamy certification vouchers." path="/institute/vouchers" noIndex />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Voucher allocation summary">
        <SummaryCard icon={TicketCheck} label="Allocated" value={totals.issued} loading={isLoading} />
        <SummaryCard icon={Users} label="Available to assign" value={totals.available} loading={isLoading} />
        <SummaryCard icon={CheckCircle2} label="Credentials sponsored" value={totals.redeemed} loading={isLoading} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit border-violet-200 shadow-sm">
          <CardHeader className="border-b border-violet-100 bg-violet-50/70">
            <CardTitle className="flex items-center gap-2 text-lg"><Mail className="h-5 w-5 text-violet-700" />Assign to a learner</CardTitle>
            <p className="text-sm leading-6 text-slate-600">Reserve one code for the exact email the learner will use during the exam.</p>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div><Label htmlFor="voucher-code" className="font-bold">Voucher code</Label><Input id="voucher-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="mt-1.5 font-mono uppercase" placeholder="OCT-XXXXXXXXXX-XXXXXX" autoComplete="off" /></div>
            <div><Label htmlFor="voucher-email" className="font-bold">Learner email</Label><Input id="voucher-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5" placeholder="learner@example.com" autoComplete="email" /></div>
            <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending || code.trim().length < 16 || !email.includes("@")} className="w-full rounded-xl">
              {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Assign voucher
            </Button>
            <p className="flex gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Codes are not stored in readable form. Keep the original allocation file in your approved secure workspace.</p>
          </CardContent>
        </Card>

        <section aria-labelledby="voucher-batches-heading">
          <div className="mb-3"><h2 id="voucher-batches-heading" className="text-lg font-black text-slate-950">Your allocations</h2><p className="mt-1 text-sm text-slate-600">Usage is recorded only when a learner passes and activates the credential.</p></div>
          {error ? <Card><CardContent className="p-8 text-center"><p className="font-bold">Voucher allocations are temporarily unavailable.</p><Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button></CardContent></Card> : isLoading ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl bg-slate-200" />)}</div> : batches.length === 0 ? <Card className="border-dashed"><CardContent className="p-10 text-center"><TicketCheck className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-4 font-black">No voucher allocation yet</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Octamy issues governed batches to verified institutes. Request the certification, quantity, learner purpose, and expiry window your cohort needs.</p><Button asChild className="mt-5"><Link href="/contact?subject=certification-vouchers">Request vouchers</Link></Button></CardContent></Card> : <div className="grid gap-3 sm:grid-cols-2">{batches.map((batch) => <VoucherBatchCard key={batch.id} batch={batch} />)}</div>}
        </section>
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, loading }: { icon: typeof TicketCheck; label: string; value: number; loading: boolean }) {
  return <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Icon className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-slate-950">{loading ? "—" : value}</p></div></CardContent></Card>;
}

function VoucherBatchCard({ batch }: { batch: VoucherBatch }) {
  const active = batch.status === "active" && new Date(batch.expiresAt).getTime() > Date.now();
  const usedPercent = batch.quantity ? Math.round((batch.redeemed / batch.quantity) * 100) : 0;
  return <Card className="overflow-hidden"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-700">{batch.courseTitle || "Any eligible in-house certification"}</p><h3 className="mt-2 font-black text-slate-950">{batch.name}</h3></div><Badge variant="outline" className={active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}>{active ? "Active" : batch.status}</Badge></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${usedPercent}%` }} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-lg font-black">{batch.available}</p><p className="text-[11px] text-slate-500">Available</p></div><div><p className="text-lg font-black">{batch.assigned}</p><p className="text-[11px] text-slate-500">Assigned</p></div><div><p className="text-lg font-black">{batch.redeemed}</p><p className="text-[11px] text-slate-500">Redeemed</p></div></div><p className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />Expires {new Date(batch.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></CardContent></Card>;
}
