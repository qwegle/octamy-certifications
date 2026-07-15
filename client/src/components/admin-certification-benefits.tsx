import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Download, Loader2, Percent, ShieldCheck, TicketCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type InstituteOption = { id: number; name: string; status: string };
type CreatorOption = { id: number; display_name: string; status: string };
type CourseOption = { id: number; title: string; ownerType: string; productType: string; certificationMode: string; reviewStatus: string };
type VoucherBatch = { id: number; name: string; status: string; quantity: number; expiresAt: string; recipientType: "creator" | "institute"; recipientName: string; courseTitle: string | null; available: number; redeemed: number };
type VoucherRequest = { id: number; requesterType: "creator" | "institute"; requesterId: number; requesterName: string; courseTitle: string | null; quantity: number; purpose: string; status: string; createdAt: string };
type Coupon = { id: number; name: string; codeHint: string; status: string; ownerType: string; courseTitle: string | null; productType?: string; discountType: string; discountValue: string; expiresAt: string; redemptionCount: number; maxRedemptions: number | null };

const yearFromNow = () => {
  const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export function AdminCertificationBenefits() {
  const { toast } = useToast();
  const [voucherForm, setVoucherForm] = useState({ recipientType: "institute", recipientId: "", courseId: "any", name: "", quantity: "25", expiresAt: yearFromNow() });
  const [couponForm, setCouponForm] = useState({ code: "", name: "", courseId: "any", discountType: "percent", discountValue: "10", expiresAt: yearFromNow(), maxRedemptions: "100", perUserLimit: "1" });
  const institutesQuery = useQuery<InstituteOption[]>({ queryKey: ["/api/admin/institutes"], queryFn: async () => (await apiRequest("GET", "/api/admin/institutes")).json() });
  const creatorsQuery = useQuery<CreatorOption[]>({ queryKey: ["/api/admin/creators"], queryFn: async () => (await apiRequest("GET", "/api/admin/creators")).json() });
  const coursesQuery = useQuery<CourseOption[]>({ queryKey: ["/api/admin/courses"], queryFn: async () => (await apiRequest("GET", "/api/admin/courses")).json() });
  const batchesQuery = useQuery<{ items: VoucherBatch[] }>({ queryKey: ["/api/admin/certification-voucher-batches"], queryFn: async () => (await apiRequest("GET", "/api/admin/certification-voucher-batches?pageSize=100")).json() });
  const couponsQuery = useQuery<{ items: Coupon[] }>({ queryKey: ["/api/admin/coupons"], queryFn: async () => (await apiRequest("GET", "/api/admin/coupons")).json() });
  const requestsQuery = useQuery<{ items: VoucherRequest[] }>({ queryKey: ["/api/admin/voucher-requests"], queryFn: async () => (await apiRequest("GET", "/api/admin/voucher-requests")).json() });

  const verifiedInstitutes = (institutesQuery.data || []).filter((institute) => institute.status === "verified");
  const approvedCreators = (creatorsQuery.data || []).filter((creator) => creator.status === "approved");
  const recipients = voucherForm.recipientType === "institute" ? verifiedInstitutes.map((item) => ({ id: item.id, name: item.name })) : approvedCreators.map((item) => ({ id: item.id, name: item.display_name }));
  const inhouseCertifications = useMemo(() => (coursesQuery.data || []).filter((course) => course.ownerType === "admin" && course.productType === "assessment" && course.certificationMode === "octamy" && course.reviewStatus === "approved"), [coursesQuery.data]);
  const inhouseProducts = useMemo(() => (coursesQuery.data || []).filter((course) => course.ownerType === "admin" && course.reviewStatus === "approved"), [coursesQuery.data]);

  const createBatch = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/certification-voucher-batches", {
      recipientType: voucherForm.recipientType,
      recipientId: Number(voucherForm.recipientId),
      courseId: voucherForm.courseId === "any" ? null : Number(voucherForm.courseId),
      name: voucherForm.name,
      quantity: Number(voucherForm.quantity),
      expiresAt: new Date(voucherForm.expiresAt).toISOString(),
    })).json(),
    onSuccess: (result: { batch: VoucherBatch; codes: string[]; recipient: { name: string } }) => {
      const csv = ["voucher_code", ...result.codes].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `octamy-vouchers-${result.batch.id}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Voucher batch issued", description: `${result.codes.length} one-time codes were generated for ${result.recipient.name}; the secure CSV has been prepared.` });
      setVoucherForm((value) => ({ ...value, name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/certification-voucher-batches"] });
    },
    onError: (error) => toast({ title: "Voucher batch not issued", description: error instanceof Error ? error.message : "Review the allocation." }),
  });

  const createCoupon = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/coupons", {
      code: couponForm.code,
      name: couponForm.name,
      courseId: couponForm.courseId === "any" ? null : Number(couponForm.courseId),
      discountType: couponForm.discountType,
      discountValue: Number(couponForm.discountValue),
      expiresAt: new Date(couponForm.expiresAt).toISOString(),
      maxRedemptions: couponForm.maxRedemptions ? Number(couponForm.maxRedemptions) : null,
      perUserLimit: Number(couponForm.perUserLimit),
    })).json(),
    onSuccess: (result: { code: string }) => {
      toast({ title: "Coupon created", description: `${result.code} is active. Store the original code in the approved campaign record.` });
      setCouponForm((value) => ({ ...value, code: "", name: "" }));
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
    },
    onError: (error) => toast({ title: "Coupon not created", description: error instanceof Error ? error.message : "Review the coupon policy." }),
  });

  const setBatchStatus = async (id: number, status: "active" | "paused" | "revoked") => {
    try {
      await apiRequest("PATCH", `/api/admin/certification-voucher-batches/${id}/status`, { status });
      toast({ title: "Voucher batch updated", description: `Batch status is now ${status}.` });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/certification-voucher-batches"] });
    } catch (error) {
      toast({ title: "Batch not updated", description: error instanceof Error ? error.message : "Try again." });
    }
  };

  const reviewRequest = async (id: number, status: "approved" | "rejected") => {
    try {
      await apiRequest("PATCH", `/api/admin/voucher-requests/${id}`, { status });
      toast({ title: `Request ${status}`, description: status === "approved" ? "You can now issue the allocation from the form above." : "The workspace can see the decision immediately." });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/voucher-requests"] });
    } catch (error) {
      toast({ title: "Decision needs review", description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const setCouponStatus = async (id: number, status: "active" | "paused" | "revoked") => {
    try {
      await apiRequest("PATCH", `/api/admin/coupons/${id}/status`, { status });
      toast({ title: "Coupon updated", description: `Coupon status is now ${status}.` });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
    } catch (error) {
      toast({ title: "Coupon not updated", description: error instanceof Error ? error.message : "Try again." });
    }
  };

  return <Tabs defaultValue="vouchers" className="space-y-5">
    <TabsList className="grid h-auto max-w-md grid-cols-2 rounded-xl bg-slate-100 p-1"><TabsTrigger value="vouchers">Certification vouchers</TabsTrigger><TabsTrigger value="coupons">Coupons</TabsTrigger></TabsList>
    <TabsContent value="vouchers" className="space-y-5">
      <Card className="border-violet-200"><CardHeader className="border-b border-violet-100 bg-violet-50/60"><CardTitle className="flex items-center gap-2 text-lg"><TicketCheck className="h-5 w-5 text-violet-700" />Issue voucher allocation</CardTitle><p className="text-sm leading-6 text-slate-600">Codes are revealed once and downloaded immediately. Every redemption is course-scoped, expiry-controlled, and audited.</p></CardHeader><CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Recipient type"><select value={voucherForm.recipientType} onChange={(event) => setVoucherForm({ ...voucherForm, recipientType: event.target.value, recipientId: "" })} className={selectClass}><option value="institute">Verified institute</option><option value="creator">Approved creator</option></select></Field>
        <Field label={voucherForm.recipientType === "institute" ? "Verified institute" : "Approved creator"}><select value={voucherForm.recipientId} onChange={(event) => setVoucherForm({ ...voucherForm, recipientId: event.target.value })} className={selectClass}><option value="">Select workspace</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}</select></Field>
        <Field label="Certification scope"><select value={voucherForm.courseId} onChange={(event) => setVoucherForm({ ...voucherForm, courseId: event.target.value })} className={selectClass}><option value="any">Any eligible in-house certification</option>{inhouseCertifications.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></Field>
        <Field label="Allocation name"><Input value={voucherForm.name} onChange={(event) => setVoucherForm({ ...voucherForm, name: event.target.value })} placeholder="August placement cohort" /></Field>
        <Field label="Quantity"><Input type="number" min={1} max={500} value={voucherForm.quantity} onChange={(event) => setVoucherForm({ ...voucherForm, quantity: event.target.value })} /></Field>
        <Field label="Expiry"><Input type="datetime-local" value={voucherForm.expiresAt} onChange={(event) => setVoucherForm({ ...voucherForm, expiresAt: event.target.value })} /></Field>
        <div className="flex items-end"><Button onClick={() => createBatch.mutate()} disabled={createBatch.isPending || !voucherForm.recipientId || voucherForm.name.trim().length < 3} className="h-10 w-full">{createBatch.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Issue and export codes</Button></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-lg">Voucher requests</CardTitle><p className="text-sm text-slate-600">Approve sponsorship intent here, then issue the controlled allocation above.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{!(requestsQuery.data?.items || []).length ? <p className="text-sm text-slate-500">No voucher requests.</p> : (requestsQuery.data?.items || []).map((request) => <div key={request.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black uppercase text-violet-700">{request.requesterType}</p><p className="font-black">{request.requesterName}</p></div><Badge variant="outline">{request.status}</Badge></div><p className="mt-2 text-sm text-slate-600">{request.quantity} · {request.courseTitle || "Flexible in-house allocation"}</p><p className="mt-2 line-clamp-2 text-xs text-slate-500">{request.purpose}</p>{request.status === "pending" && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void reviewRequest(request.id, "approved")}>Approve</Button><Button size="sm" variant="outline" onClick={() => void reviewRequest(request.id, "rejected")}>Decline</Button></div>}</div>)}</CardContent></Card>
      <div className="grid gap-3 xl:grid-cols-2">{batchesQuery.isLoading ? [0, 1].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl bg-slate-200" />) : (batchesQuery.data?.items || []).map((batch) => <Card key={batch.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-violet-700">{batch.recipientName} · {batch.recipientType}</p><h3 className="mt-1 font-black">{batch.name}</h3><p className="mt-1 text-sm text-slate-500">{batch.courseTitle || "Any eligible in-house certification"}</p></div><Badge variant="outline">{batch.status}</Badge></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Metric label="Issued" value={batch.quantity} /><Metric label="Available" value={batch.available} /><Metric label="Redeemed" value={batch.redeemed} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock className="h-3.5 w-3.5" />{new Date(batch.expiresAt).toLocaleDateString("en-IN")}</span><div className="flex gap-2">{batch.status === "active" ? <Button size="sm" variant="outline" onClick={() => void setBatchStatus(batch.id, "paused")}>Pause</Button> : batch.status === "paused" ? <Button size="sm" variant="outline" onClick={() => void setBatchStatus(batch.id, "active")}>Activate</Button> : null}{batch.status !== "revoked" && batch.status !== "exhausted" && <Button size="sm" variant="ghost" onClick={() => void setBatchStatus(batch.id, "revoked")}>Revoke</Button>}</div></div></CardContent></Card>)}</div>
    </TabsContent>
    <TabsContent value="coupons" className="space-y-5">
      <Card><CardHeader className="border-b border-slate-100"><CardTitle className="flex items-center gap-2 text-lg"><Percent className="h-5 w-5 text-emerald-700" />Create governed coupon</CardTitle><p className="text-sm leading-6 text-slate-600">Coupons change a payable price. They never bypass a result, passing rule, or credential evidence policy.</p></CardHeader><CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Coupon code"><Input value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} placeholder="LEARN10" className="font-mono uppercase" /></Field>
        <Field label="Campaign name"><Input value={couponForm.name} onChange={(event) => setCouponForm({ ...couponForm, name: event.target.value })} placeholder="Learner launch offer" /></Field>
        <Field label="In-house product scope"><select value={couponForm.courseId} onChange={(event) => setCouponForm({ ...couponForm, courseId: event.target.value })} className={selectClass}><option value="any">All Octamy in-house products</option>{inhouseProducts.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></Field>
        <Field label="Discount"><div className="grid grid-cols-[120px_1fr] gap-2"><select value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value })} className={selectClass}><option value="percent">Percent</option><option value="fixed">Fixed INR</option></select><Input type="number" min={1} value={couponForm.discountValue} onChange={(event) => setCouponForm({ ...couponForm, discountValue: event.target.value })} /></div></Field>
        <Field label="Expiry"><Input type="datetime-local" value={couponForm.expiresAt} onChange={(event) => setCouponForm({ ...couponForm, expiresAt: event.target.value })} /></Field>
        <Field label="Redemption limits"><div className="grid grid-cols-2 gap-2"><Input type="number" min={1} placeholder="Total" value={couponForm.maxRedemptions} onChange={(event) => setCouponForm({ ...couponForm, maxRedemptions: event.target.value })} /><Input type="number" min={1} placeholder="Per user" value={couponForm.perUserLimit} onChange={(event) => setCouponForm({ ...couponForm, perUserLimit: event.target.value })} /></div></Field>
        <div className="md:col-span-2 xl:col-span-3"><Button onClick={() => createCoupon.mutate()} disabled={createCoupon.isPending || couponForm.code.length < 5 || couponForm.name.length < 3}>{createCoupon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create coupon</Button></div>
      </CardContent></Card>
      <Card><CardContent className="p-0"><div className="divide-y divide-slate-100">{couponsQuery.isLoading ? <div className="p-8 text-center text-sm text-slate-500">Loading coupons…</div> : !(couponsQuery.data?.items || []).length ? <div className="p-10 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-3 font-bold">No coupons created</p></div> : (couponsQuery.data?.items || []).map((coupon) => <div key={coupon.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-black">{coupon.name}</p><Badge variant="outline">{coupon.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{coupon.codeHint} · {coupon.discountType === "percent" ? `${Number(coupon.discountValue)}%` : `₹${Number(coupon.discountValue)}`} off · {coupon.courseTitle || "All Octamy in-house products"}</p><p className="mt-1 text-xs text-slate-400">{coupon.redemptionCount}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""} redeemed · Expires {new Date(coupon.expiresAt).toLocaleDateString("en-IN")}</p></div><div className="flex gap-2">{coupon.status === "active" ? <Button size="sm" variant="outline" onClick={() => void setCouponStatus(coupon.id, "paused")}>Pause</Button> : coupon.status === "paused" ? <Button size="sm" variant="outline" onClick={() => void setCouponStatus(coupon.id, "active")}>Activate</Button> : null}{coupon.status !== "revoked" && <Button size="sm" variant="ghost" onClick={() => void setCouponStatus(coupon.id, "revoked")}>Revoke</Button>}</div></div>)}</div></CardContent></Card>
    </TabsContent>
  </Tabs>;
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
function Field({ label, children }: { label: string; children: ReactNode }) { return <div><Label className="mb-1.5 block font-bold">{label}</Label>{children}</div>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-lg font-black">{value}</p><p className="text-[11px] text-slate-500">{label}</p></div>; }
