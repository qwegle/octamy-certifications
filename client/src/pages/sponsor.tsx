import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { SEO } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { ArrowRight, HeartHandshake, ShieldCheck } from "lucide-react";

type SponsorResponse = {
  success: boolean;
  payment?: { action: string; fields: Record<string, string> };
};

export default function SponsorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const returned = useMemo(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null, []);

  const sponsorship = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sponsors", {
        name: name.trim(),
        email: email.trim(),
        amount: Number(amount),
        message: message.trim() || undefined,
        isAnonymous: anonymous,
      });
      return response.json() as Promise<SponsorResponse>;
    },
    onSuccess: (data) => {
      if (!data.success || !data.payment?.action || !data.payment.fields) {
        toast({ title: "Checkout unavailable", description: "The payment provider did not return a usable checkout. No sponsorship was completed.", variant: "destructive" });
        return;
      }
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.payment.action;
      Object.entries(data.payment.fields).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    },
    onError: (error) => toast({ title: "Checkout not started", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }),
  });

  const numericAmount = Number(amount);
  const canSubmit = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && Number.isInteger(numericAmount) && numericAmount > 0 && numericAmount <= 1_000_000;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <SEO title="Sponsor learner access" description="Support Octamy learner access through a securely initiated, server-recorded sponsorship payment." path="/sponsor" />
      <Header />
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <section className="rounded-3xl bg-slate-950 p-7 text-white sm:p-10" aria-labelledby="sponsor-title">
          <HeartHandshake className="h-9 w-9 text-slate-300" aria-hidden="true" />
          <h1 id="sponsor-title" className="mt-5 text-3xl font-black sm:text-5xl">Sponsor access without invented impact claims.</h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-300">Choose your own amount. Octamy records the sponsorship request and sends you to the configured payment provider. This page does not promise a particular learner allocation, tax treatment, or outcome; contact support first if you need a restricted or documented program.</p>
        </section>

        {returned?.has("success") && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-950" role="status">A payment return was received. Fulfilment depends on the server-verified gateway callback; retain your provider receipt and contact support if confirmation is delayed.</div>
        )}
        {returned?.has("error") && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-950" role="alert">The provider did not confirm this sponsorship. Do not retry while your bank shows a pending debit; contact support with the provider reference.</div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle>Start a sponsorship payment</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (canSubmit) sponsorship.mutate(); }}>
                <div><Label htmlFor="sponsor-name">Name</Label><Input id="sponsor-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} required /></div>
                <div><Label htmlFor="sponsor-email">Email</Label><Input id="sponsor-email" className="mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required /></div>
                <div><Label htmlFor="sponsor-amount">Amount in INR</Label><Input id="sponsor-amount" className="mt-2" type="number" inputMode="numeric" min={1} max={1_000_000} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} aria-describedby="sponsor-amount-help" required /><p id="sponsor-amount-help" className="mt-1 text-xs text-slate-500">Whole rupees, from ₹1 to ₹10,00,000. The provider shows the final amount before authorization.</p></div>
                <div><Label htmlFor="sponsor-message">Message (optional)</Label><Textarea id="sponsor-message" className="mt-2" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} rows={4} /></div>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /><span><strong className="block text-slate-900">Keep my name out of public acknowledgements</strong><span className="text-slate-600">Octamy and the payment provider still receive the details required to process and support the transaction.</span></span></label>
                <Button type="submit" className="min-h-11 w-full" disabled={!canSubmit || sponsorship.isPending} aria-busy={sponsorship.isPending || undefined}>{sponsorship.isPending ? "Opening secure checkout…" : "Continue to payment"}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
              </form>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card className="border-slate-200"><CardContent className="p-6"><ShieldCheck className="h-6 w-6 text-slate-700" aria-hidden="true" /><h2 className="mt-4 font-bold">Payment boundary</h2><p className="mt-2 text-sm leading-6 text-slate-600">A request is not a successful payment. Octamy marks it paid only after validating the provider callback.</p></CardContent></Card>
            <Card className="border-slate-200"><CardContent className="p-6"><h2 className="font-bold">Need an institute allocation?</h2><p className="mt-2 text-sm leading-6 text-slate-600">For named cohorts, vouchers, invoices, or procurement requirements, use the institute workflow instead of an unrestricted sponsorship.</p><Button asChild variant="outline" className="mt-4 w-full"><Link href="/institutes">Institute solutions</Link></Button><Button asChild variant="ghost" className="mt-2 w-full"><Link href="/contact">Contact support</Link></Button></CardContent></Card>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
