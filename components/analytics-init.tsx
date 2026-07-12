"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initAnalytics, trackPageview } from "@/lib/analytics";

/**
 * Mounts once in the root layout to bootstrap product analytics and drive
 * SPA pageview tracking. Renders nothing.
 *
 * PostHog's automatic pageview capture is disabled (SPA navigations don't
 * trigger a full document load), so we capture a $pageview here on the initial
 * mount and again whenever the App Router pathname changes. initAnalytics() is
 * idempotent and SSR-guarded, so the first effect run both initializes the SDK
 * and records the entry pageview.
 */
export function AnalyticsInit(): null {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
    // Fire on mount and on every subsequent pathname change. trackPageview is a
    // no-op until init completes, so ordering within this effect is safe.
    trackPageview(pathname);
  }, [pathname]);

  return null;
}
