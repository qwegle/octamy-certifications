import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Loader2, Percent, ShieldCheck, Tag } from "lucide-react";
import DashboardLayout, { type DashboardRole } from "@/components/dashboard-layout";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type WorkspaceRole = Extract<DashboardRole, "creator" | "institute">;
type Product = { id: number; title: string; productType: "assessment" | "video_course" | "ebook" | "bundle"; price: string; contentPrice?: string | null };
type Coupon = { id: number; name: string; codeHint: string; status: string; courseTitle: string; productType: Product["productType"]; discountType: "percent" | "fixed"; discountValue: string; expiresAt: string; redemptionCount: number; maxRedemptions: number | null };

function defaultExpiry() {
  const value = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

const productLabel: Record<Product["productType"], string> = {
  assessment: "Assessment",
  video_course: "Video course",
  ebook: "eBook / PDF",
  bundle: "Bundle",
};

export default function WorkspaceCoupons({ role }: { role: WorkspaceRole }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ code: "", name: "", courseId: "", discountType: "percent", discountValue: "10", expiresAt: defaultExpiry(), maxRedemptions: "100", perUserLimit: "1" });
  const productsQuery = useQuery<Product[]>({ queryKey: [`/api/${role}/courses`], queryFn: async () => (await apiRequest("GET", `/api/${role}/courses`)).json() });
  const couponsQuery = useQuery<{ items: Coupon[] }>({ queryKey: [`/api/${role}/coupons`], queryFn: async () => (await apiRequest("GET", `/api/${role}/coupons`)).json() });
  const products = useMemo(() => productsQuery.data || [], [productsQuery.data]);

  const createCoupon = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/${role}/coupons`, {
      code: form.code, name: form.name, courseId: Number(form.courseId), discountType: form.discountType,
      discountValue: Number(form.discountValue), expiresAt: new Date(form.expiresAt).toISOString(),
      maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null, perUserLimit: Number(form.perUserLimit),
    })).json(),
    onSuccess: (result: { code: string }) => {
      toast({ title: "Coupon is ready", description: `${result.code} can now be used for the selected product.` });
      setForm((value) => ({ ...value, code: "", name: "" }));
      void queryClient.invalidateQueries({ queryKey: [`/api/${role}/coupons`] });
    },
    onError: (error) => toast({ title: "Coupon needs review", description: error instanceof Error ? error.message : "Check the campaign settings and try again." }),
  });

  async function changeStatus(id: number, status: "active" | "paused" | "revoked") {
    try {
      await apiRequest("PATCH", `/api/${role}/coupons/${id}/status`, { status });
      toast({ title: "Coupon updated", description: `Campaign status is now ${status}.` });
      void queryClient.invalidateQueries({ queryKey: [`/api/${role}/coupons`] });
    } catch (error) {
      toast({ title: "Update needs review", description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  return <DashboardLayout role={role} title="Coupons" description="Run controlled promotions for products owned by this workspace." breadcrumbs={[{ label: role === "creator" ? "Creator" : "Institute", href: `/${role}/dashboard` }, { label: "Coupons" }]}>
    <SEO title={`Coupons · ${role === "creator" ? "Creator" : "Institute"}`} description="Create and manage product-scoped coupon campaigns." path={`/${role}/coupons`} noIndex />
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card className="h-fit overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70"><CardTitle className="flex items-center gap-2 text-lg"><Percent className="h-5 w-5 text-slate-700" />Create coupon</CardTitle><p className="text-sm leading-6 text-slate-600">Coupons affect price only. Access and certificate rules still apply.</p></CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-1">
          <Field label="Product"><select className={selectClass} value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}><option value="">Select your product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.title} · {productLabel[product.productType]}</option>)}</select></Field>
          <Field label="Coupon code"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} placeholder="WELCOME10" className="font-mono uppercase" /></Field>
          <Field label="Campaign name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Launch offer" /></Field>
          <Field label="Discount"><div className="grid grid-cols-[120px_1fr] gap-2"><select className={selectClass} value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed INR</option></select><Input type="number" min={1} max={form.discountType === "percent" ? 100 : undefined} value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} /></div></Field>
          <Field label="Expiry"><Input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></Field>
          <Field label="Usage limits"><div className="grid grid-cols-2 gap-2"><Input type="number" min={1} value={form.maxRedemptions} onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })} aria-label="Maximum total uses" /><Input type="number" min={1} value={form.perUserLimit} onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })} aria-label="Uses per learner" /></div></Field>
          <Button onClick={() => createCoupon.mutate()} disabled={createCoupon.isPending || !form.courseId || form.code.length < 5 || form.name.trim().length < 3} className="rounded-xl">{createCoupon.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create coupon</Button>
        </CardContent>
      </Card>
      <section><h2 className="text-lg font-black text-slate-950">Campaigns</h2><p className="mt-1 text-sm text-slate-600">Pause or revoke a code instantly; the original code is never exposed again.</p>
        <div className="mt-4 grid gap-3">{couponsQuery.isLoading ? [0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-200" />) : !(couponsQuery.data?.items || []).length ? <Card className="border-dashed"><CardContent className="p-10 text-center"><Tag className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-4 font-black">No coupons yet</h3><p className="mt-2 text-sm text-slate-600">Create your first product-specific campaign from the form.</p></CardContent></Card> : (couponsQuery.data?.items || []).map((coupon) => <Card key={coupon.id}><CardContent className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{coupon.name}</h3><Badge variant="outline">{coupon.status}</Badge><Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{productLabel[coupon.productType]}</Badge></div><p className="mt-2 text-sm text-slate-600">{coupon.courseTitle}</p><p className="mt-1 font-mono text-xs text-slate-500">{coupon.codeHint} · {coupon.discountType === "percent" ? `${Number(coupon.discountValue)}%` : `₹${Number(coupon.discountValue)}`} off</p></div><div className="flex gap-2">{coupon.status === "active" ? <Button size="sm" variant="outline" onClick={() => void changeStatus(coupon.id, "paused")}>Pause</Button> : coupon.status === "paused" ? <Button size="sm" variant="outline" onClick={() => void changeStatus(coupon.id, "active")}>Activate</Button> : null}{coupon.status !== "revoked" && <Button size="sm" variant="ghost" onClick={() => void changeStatus(coupon.id, "revoked")}>Revoke</Button>}</div></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-slate-600" />{coupon.redemptionCount}{coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""} uses</span><span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Expires {new Date(coupon.expiresAt).toLocaleDateString("en-IN")}</span></div></CardContent></Card>)}</div>
      </section>
    </div>
  </DashboardLayout>;
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
function Field({ label, children }: { label: string; children: ReactNode }) { return <div><Label className="mb-1.5 block font-bold">{label}</Label>{children}</div>; }
