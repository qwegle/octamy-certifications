import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Loader2, Mail, Send, ShieldCheck, TicketCheck, Users } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
type VoucherRequest = { id: number; courseTitle: string | null; quantity: number; purpose: string; status: "pending" | "approved" | "rejected" | "cancelled"; reviewNote: string | null; createdAt: string };
type Certification = { id: number; title: string };

export default function InstituteVouchers({ role = "institute" }: { role?: "institute" | "creator" }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [requestForm, setRequestForm] = useState({ courseId: "any", quantity: "25", purpose: "" });
  const vouchersPath = `/api/${role}/certification-vouchers`;
  const requestsPath = `/api/${role}/voucher-requests`;
  const { data, isLoading, error, refetch } = useQuery<{ items: VoucherBatch[] }>({
    queryKey: [vouchersPath],
    queryFn: async () => (await apiRequest("GET", vouchersPath)).json(),
  });
  const requestsQuery = useQuery<{ items: VoucherRequest[] }>({ queryKey: [requestsPath], queryFn: async () => (await apiRequest("GET", requestsPath)).json() });
  const certificationsQuery = useQuery<{ items: Certification[] }>({ queryKey: ["/api/assessments", "voucher-options"], queryFn: async () => (await apiRequest("GET", "/api/assessments?source=inhouse&pageSize=100")).json() });
  const assignMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `${vouchersPath}/assign`, { code, email })).json(),
    onSuccess: () => {
      toast({ title: "Voucher assigned", description: `The voucher is now reserved for ${email.trim().toLowerCase()}.` });
      setCode("");
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: [vouchersPath] });
    },
    onError: (mutationError) => toast({ title: "Voucher not assigned", description: mutationError instanceof Error ? mutationError.message : "Review the code and learner email." }),
  });
  const requestMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", requestsPath, { courseId: requestForm.courseId === "any" ? null : Number(requestForm.courseId), quantity: Number(requestForm.quantity), purpose: requestForm.purpose })).json(),
    onSuccess: () => {
      toast({ title: "Voucher request submitted", description: "Octamy operations can now review and allocate the governed codes." });
      setRequestForm((value) => ({ ...value, purpose: "" }));
      void queryClient.invalidateQueries({ queryKey: [requestsPath] });
    },
    onError: (mutationError) => toast({ title: "Request needs review", description: mutationError instanceof Error ? mutationError.message : "Check the request and try again." }),
  });

  const batches = data?.items || [];
  const totals = batches.reduce((result, batch) => ({
    issued: result.issued + batch.quantity,
    available: result.available + batch.available,
    redeemed: result.redeemed + batch.redeemed,
  }), { issued: 0, available: 0, redeemed: 0 });

  return (
    <DashboardLayout
      role={role}
      title="Certification vouchers"
      description="Sponsor Octamy in-house credentials for selected learners without student checkout."
      breadcrumbs={[{ label: role === "creator" ? "Creator" : "Institute", href: `/${role}/dashboard` }, { label: "Certification vouchers" }]}
    >
      <SEO title={`Certification vouchers · ${role === "creator" ? "Creator" : "Institute"}`} description="Request, assign, and track sponsored Octamy certification vouchers." path={`/${role}/vouchers`} noIndex />

      <Card className="mb-6 overflow-hidden border-violet-200 shadow-sm"><CardHeader className="border-b border-violet-100 bg-violet-50/70"><CardTitle className="flex items-center gap-2 text-lg"><Send className="h-5 w-5 text-violet-700" />Request voucher allocation</CardTitle><p className="text-sm leading-6 text-slate-600">Choose an Octamy in-house certification or request a flexible allocation. Octamy reviews and issues the actual codes.</p></CardHeader><CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_130px_1.5fr_auto] md:items-end"><div><Label className="font-bold">Certification</Label><select value={requestForm.courseId} onChange={(event) => setRequestForm({ ...requestForm, courseId: event.target.value })} className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="any">Any eligible in-house certification</option>{(certificationsQuery.data?.items || []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div><div><Label className="font-bold">Quantity</Label><Input className="mt-1.5" type="number" min={1} max={500} value={requestForm.quantity} onChange={(event) => setRequestForm({ ...requestForm, quantity: event.target.value })} /></div><div><Label className="font-bold">Purpose</Label><Textarea className="mt-1.5 min-h-10" rows={1} value={requestForm.purpose} onChange={(event) => setRequestForm({ ...requestForm, purpose: event.target.value })} placeholder="Cohort, campaign, or learner outcome" /></div><Button onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || requestForm.purpose.trim().length < 10}>{requestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit request</Button></CardContent>{Boolean(requestsQuery.data?.items?.length) && <div className="border-t border-slate-100 px-5 py-4"><p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-500">Recent requests</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(requestsQuery.data?.items || []).slice(0, 6).map((request) => <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold">{request.courseTitle || "Flexible allocation"}</p><Badge variant="outline">{request.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{request.quantity} vouchers · {new Date(request.createdAt).toLocaleDateString("en-IN")}</p>{request.reviewNote && <p className="mt-2 text-xs text-slate-600">{request.reviewNote}</p>}</div>)}</div></div>}</Card>

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
          {error ? <Card><CardContent className="p-8 text-center"><p className="font-bold">Voucher allocations are temporarily unavailable.</p><Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button></CardContent></Card> : isLoading ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl bg-slate-200" />)}</div> : batches.length === 0 ? <Card className="border-dashed"><CardContent className="p-10 text-center"><TicketCheck className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-4 font-black">No voucher allocation yet</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Submit the request above. Octamy operations approves the sponsorship and issues securely governed codes to this workspace.</p></CardContent></Card> : <div className="grid gap-3 sm:grid-cols-2">{batches.map((batch) => <VoucherBatchCard key={batch.id} batch={batch} />)}</div>}
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
