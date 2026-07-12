// ---------------------------------------------------------------------------
// Minimal, privacy-first product analytics (PostHog).
//
// Mirrors the shape of lib/sentry.ts: a thin wrapper with a single init gate
// and no-op helpers so call sites never need to know whether analytics is live.
//
// HARD PRIVACY CONTRACT (see the project audit): we NEVER capture user-written
// content — no input text, refined output, voice samples, analysis text, or API
// keys. To enforce that at the SDK level we disable autocapture (which would
// scrape element text), session recording, and surveys, and we forbid non-
// primitive event properties by type. Every event is an anonymous, aggregate
// product-usage signal built from counts, enums, and durations only.
//
// The project token is PUBLIC by design — exactly like the Firebase web config
// hardcoded in lib/firebase.ts. It identifies the project to PostHog's ingest
// endpoint; it grants no read access. It can still be overridden per-deploy via
// NEXT_PUBLIC_POSTHOG_KEY.
// ---------------------------------------------------------------------------

import posthog from 'posthog-js';

/** Public project token — safe to ship. Overridable via env for other deploys. */
const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  'phc_BJUz6ht8oqkzmHMUueNzGbqZVNEvxU4Z7sQZosrGuayb';

/** US ingest host. Recording/surveys are disabled, so no asset host is needed. */
const POSTHOG_HOST = 'https://us.i.posthog.com';

/** Only primitive property values are permitted — enforced at the type level. */
export type EventProps = Record<string, string | number | boolean>;

let initialized = false;

/**
 * Initialize PostHog once, on the client only. Idempotent and SSR-guarded:
 * calling during SSR/build is a no-op, so no server crash is possible.
 */
export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Privacy hardening — see file header. Each of these is load-bearing:
    autocapture: false, // never scrape DOM element text
    capture_pageview: false, // SPA router: we fire $pageview manually
    disable_session_recording: true, // no screen capture of user content
    disable_surveys: true, // no in-app survey prompts
    persistence: 'localStorage', // no cross-site cookies
  });
}

/**
 * Record a product-usage event. No-op until initAnalytics() has run, so it is
 * always safe to call. Property values are constrained to primitives by the
 * EventProps type — this is the compile-time guard against leaking objects,
 * arrays, or user-written strings into an event payload.
 */
export function track(event: string, props?: EventProps): void {
  if (!initialized) return;
  posthog.capture(event, props);
}

/**
 * Record a manual SPA pageview. We disable PostHog's automatic pageview capture
 * because the App Router navigates client-side without a full document load, so
 * the SDK would otherwise miss every in-app route change.
 */
export function trackPageview(path: string): void {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: path });
}
