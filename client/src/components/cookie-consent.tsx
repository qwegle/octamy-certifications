import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

const KEY = "octamy.cookieConsent.v1";

export function CookieConsent() {
  const [location] = useLocation();
  const [show, setShow] = useState(false);
  const isFocusedWorkspace = /^\/(?:login|register|forgot-password|reset-password|interview-studio(?:\/|$)|creator\/|institute\/|recruiter\/)/.test(location);
  const isExamRoute = /^\/(?:x\/[^/]+|get-certified\/[^/]+|practice\/[^/]+)\/?$/.test(location);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // localStorage may be unavailable; do nothing
    }
  }, []);

  useEffect(() => {
    if (!show || isFocusedWorkspace || isExamRoute) return;
    document.body.classList.add("cookie-banner-visible");
    return () => document.body.classList.remove("cookie-banner-visible");
  }, [isExamRoute, isFocusedWorkspace, show]);

  function setChoice(value: "all" | "necessary") {
    try { localStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() })); } catch {}
    document.body.classList.remove("cookie-banner-visible");
    setShow(false);
  }

  if (!show || isExamRoute) return null;
  return (
    <aside
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className={isFocusedWorkspace
        ? "relative z-10 mx-3 mb-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-lg shadow-slate-950/10 sm:mx-auto sm:mb-5 sm:max-w-xl"
        : "fixed bottom-2 left-2 right-2 z-[60] rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-2xl shadow-slate-950/15 md:bottom-6 md:left-auto md:right-6 md:max-w-md"}
    >
      <p id="cookie-consent-title" className="font-bold text-slate-950">Your cookie choice</p>
      <p id="cookie-consent-description" className="mt-1 text-xs leading-4 text-slate-600">
        Necessary cookies secure Octamy. Optional analytics helps us improve. <Link href="/cookie-policy" className="font-medium underline">Cookie policy</Link>.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => setChoice("necessary")}
          className="min-h-11 rounded-xl border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
        >
          Necessary only
        </button>
        <button
          onClick={() => setChoice("all")}
          className="min-h-11 rounded-xl bg-slate-950 px-3 font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
        >
          Accept all
        </button>
      </div>
    </aside>
  );
}
