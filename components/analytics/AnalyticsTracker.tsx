"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics/client";

/**
 * Counts pages, and starts a visit.
 *
 * Mounted once by the client runtime, on the storefront only — the back office
 * is staff doing their job, not traffic, and measuring it would put staff
 * activity into the marketing numbers.
 *
 * `usePathname()` and NOT `useSearchParams()`, deliberately. Reading search
 * params in a component that the root layout renders opts every route into
 * dynamic rendering, which would cost the whole site its static HTML to learn
 * something this does not need: the campaign parameters are read once, from
 * `window.location`, at the moment the visit begins, and then carried in
 * sessionStorage (see lib/analytics/client.ts). A filter changing `?size=XL` is
 * not a new page view.
 *
 * The ref guard makes the effect idempotent, so React's development-mode double
 * invocation does not count every page twice while somebody is working on it.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    const isFirstPage = lastPath.current === null;
    lastPath.current = pathname;
    // The tag snippets count the page they load on themselves.
    trackPageView(pathname, { pixels: !isFirstPage });
  }, [pathname]);

  return null;
}
