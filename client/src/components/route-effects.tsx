import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

function isPublicPresentationRoute(location: string): boolean {
  // Assessment detail and active examination screens have their own focused
  // display system. Every other customer-facing workspace uses the same
  // monochrome Octamy presentation layer.
  if (
    /^\/get-certified\/(?!categories\/)[^/]+/.test(location)
    || /^\/practice\/(?!categories\/)[^/]+/.test(location)
    || /^\/exam(?:\/|$)/.test(location)
  ) {
    return false;
  }

  return true;
}

/**
 * Restores predictable SPA navigation semantics for sighted and assistive-
 * technology users. Wouter intentionally leaves scroll/focus management to the
 * application; without this, a new page can open halfway down the document.
 */
export function RouteEffects() {
  const [location] = useLocation();
  const previousLocation = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    document.body.classList.toggle("octamy-public", isPublicPresentationRoute(location));

    const isNavigation = previousLocation.current !== null;
    previousLocation.current = location;

    const frame = window.requestAnimationFrame(() => {
      const hash = window.location.hash.replace(/^#/, "");
      const hashTarget = hash ? document.getElementById(decodeURIComponent(hash)) : null;

      if (hashTarget) {
        hashTarget.scrollIntoView({ block: "start" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }

      const main = document.getElementById("main-content") || document.querySelector("main");
      if (main instanceof HTMLElement) {
        if (!main.id) main.id = "main-content";
        if (isNavigation) {
          if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
          main.focus({ preventScroll: true });
        }
      }

      // Helmet may update the title on the following microtask.
      window.setTimeout(() => setAnnouncement(document.title || "Octamy page loaded"), 0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location]);

  useEffect(() => () => document.body.classList.remove("octamy-public"), []);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}
