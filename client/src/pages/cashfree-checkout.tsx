import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

declare global {
  interface Window {
    Cashfree?: (options: { mode: "production" | "sandbox" }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: "_self" }) => Promise<{ error?: { message?: string }; redirect?: boolean }>;
    };
  }
}

const SDK_ID = "octamy-cashfree-sdk";
const SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";
const SDK_LOAD_TIMEOUT_MS = 15_000;

function checkoutInput() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const paymentSessionId = fragment.get("payment_session_id") || "";
  const mode = fragment.get("mode") === "sandbox" ? "sandbox" : "production";
  if (!/^session_[A-Za-z0-9_-]{20,800}$/.test(paymentSessionId)) return null;
  return { mode, paymentSessionId } as const;
}

export default function CashfreeCheckout() {
  const [message, setMessage] = useState("Opening Cashfree secure checkout…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const input = checkoutInput();
    if (!input) {
      setFailed(true);
      setMessage("This checkout session is invalid or incomplete. Return to Octamy and start payment again.");
      return;
    }

    let cancelled = false;
    let loadTimeout: number | undefined;
    let sdkScript: HTMLScriptElement | null = null;

    const fail = (message: string) => {
      if (cancelled) return;
      setFailed(true);
      setMessage(message);
    };
    const launch = async () => {
      if (cancelled) return;
      if (!window.Cashfree) {
        fail("Cashfree checkout could not be loaded. Check your connection and try again from Octamy.");
        return;
      }
      try {
        const result = await window.Cashfree({ mode: input.mode }).checkout({
          paymentSessionId: input.paymentSessionId,
          redirectTarget: "_self",
        });
        if (result?.error || result?.redirect === false) {
          fail("Cashfree could not open this checkout session. Return to Octamy and try again.");
        }
      } catch {
        fail("Cashfree checkout could not be opened. Return to Octamy and try again.");
      }
    };
    const onLoad = () => {
      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      void launch();
    };
    const onError = () => {
      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      fail("Cashfree checkout could not be loaded. Check your connection and try again from Octamy.");
    };

    if (window.Cashfree) {
      void launch();
    } else {
      let shouldAppend = false;
      sdkScript = document.getElementById(SDK_ID) as HTMLScriptElement | null;
      if (!sdkScript) {
        sdkScript = document.createElement("script");
        sdkScript.id = SDK_ID;
        sdkScript.src = SDK_URL;
        sdkScript.async = true;
        sdkScript.referrerPolicy = "strict-origin-when-cross-origin";
        shouldAppend = true;
      }
      sdkScript.addEventListener("load", onLoad, { once: true });
      sdkScript.addEventListener("error", onError, { once: true });
      loadTimeout = window.setTimeout(() => {
        fail("Cashfree checkout timed out while loading. Return to Octamy and try again.");
      }, SDK_LOAD_TIMEOUT_MS);
      if (shouldAppend) document.head.appendChild(sdkScript);
    }

    return () => {
      cancelled = true;
      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      sdkScript?.removeEventListener("load", onLoad);
      sdkScript?.removeEventListener("error", onError);
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-lg">
        <CardContent className="space-y-5 p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            {failed ? <ShieldCheck className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin" />}
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-950">Secure payment</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          </div>
          <p className="text-xs leading-5 text-slate-500">Payment is confirmed only by Octamy’s server after Cashfree verification. Closing this page never marks an order paid.</p>
        </CardContent>
      </Card>
    </main>
  );
}
