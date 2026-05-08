import { useEffect, useState } from "react";
import { Link } from "wouter";

const KEY = "octamy.cookieConsent.v1";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // localStorage may be unavailable; do nothing
    }
  }, []);

  function setChoice(value: "all" | "necessary") {
    try { localStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() })); } catch {}
    setShow(false);
  }

  if (!show) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[60] rounded-lg border border-gray-200 bg-white shadow-lg p-4 text-sm">
      <p className="text-gray-800">
        We use strictly-necessary cookies to run octamy.com and, with your consent, analytics cookies to improve the experience. See our{" "}
        <Link href="/cookie-policy" className="underline">Cookie Policy</Link>.
      </p>
      <div className="flex gap-2 mt-3 justify-end">
        <button
          onClick={() => setChoice("necessary")}
          className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          Necessary only
        </button>
        <button
          onClick={() => setChoice("all")}
          className="px-3 py-1.5 rounded bg-black text-white hover:bg-gray-800"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
