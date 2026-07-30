import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Home, Loader2, ShieldCheck, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type ConfirmationState = "verifying" | "completed" | "failed" | "unverified";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<ConfirmationState>("verifying");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id") || params.get("txnid") || "";
    const statusToken = params.get("status_token") || "";
    const tempExamId = params.get("tempExamId") || "";

    if (!orderId || !statusToken) {
      setState("unverified");
      return;
    }

    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;
    const poll = async () => {
      try {
        const cashfree = params.has("order_id");
        const path = cashfree
          ? `/api/payments/cashfree/${encodeURIComponent(orderId)}/status?token=${encodeURIComponent(statusToken)}`
          : `/api/payment/status/${encodeURIComponent(orderId)}?token=${encodeURIComponent(statusToken)}`;
        const response = await apiRequest("GET", path);
        const data = await response.json();
        if (cancelled) return;
        const localStatus = data.localStatus || data.status;
        if (localStatus === "completed") {
          if (tempExamId) {
            setLocation(`/exam-results-temp/${encodeURIComponent(tempExamId)}`);
            return;
          }
          setState("completed");
          return;
        }
        if (localStatus === "failed") {
          setState("failed");
          return;
        }
        attempts += 1;
        if (attempts >= 20) {
          setState("unverified");
          return;
        }
        timer = window.setTimeout(() => void poll(), 1500);
      } catch {
        if (!cancelled) setState("unverified");
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [setLocation]);

  const completed = state === "completed";
  const failed = state === "failed";
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-lg" aria-live="polite">
        <CardHeader className="text-center">
          <span className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl ${completed ? "bg-slate-50 text-slate-900" : failed ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
            {completed ? <CheckCircle className="h-8 w-8" aria-hidden="true" /> : failed ? <AlertCircle className="h-8 w-8" aria-hidden="true" /> : state === "verifying" ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-8 w-8" aria-hidden="true" />}
          </span>
          <CardTitle className="mt-3 text-2xl text-slate-950">
            {completed ? "Payment confirmed" : failed ? "Payment was not completed" : state === "verifying" ? "Confirming payment" : "Payment confirmation pending"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm leading-6 text-slate-600">
            {completed
              ? "Octamy has confirmed the payment on the server. Your credential is available in your learner account."
              : failed
                ? "No credential was unlocked. Return to your result or dashboard if you want to try again."
                : state === "verifying"
                  ? "Please wait while Octamy verifies the provider callback. This page cannot mark an order paid."
                  : "We could not confirm this payment yet. Your credential remains locked unless Octamy receives and verifies the provider callback."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => setLocation("/dashboard")}><User className="mr-2 h-4 w-4" />Open learner dashboard</Button>
            <Button variant="outline" onClick={() => setLocation("/")}><Home className="mr-2 h-4 w-4" />Back to home</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
