"use client";

import { useEffect } from "react";
import { initSentry } from "@/lib/sentry";

/**
 * Mounts once in the root layout to initialize client-side error tracking.
 * A complete no-op unless NEXT_PUBLIC_SENTRY_DSN is configured. Renders nothing.
 */
export function SentryInit(): null {
  useEffect(() => {
    initSentry();
  }, []);

  return null;
}
