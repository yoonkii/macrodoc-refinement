// ---------------------------------------------------------------------------
// Minimal, env-gated client-side error tracking.
//
// We deliberately use @sentry/browser (not @sentry/nextjs) to stay decoupled
// from Next.js version support: the framework wizard build has a narrow peer
// range, whereas @sentry/browser is a plain SDK we control entirely.
//
// Everything here is a NO-OP unless NEXT_PUBLIC_SENTRY_DSN is set at build time.
// User content (input/refined text) and API keys are NEVER forwarded — we only
// send a redacted, truncated error message plus a coarse context tag.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/browser';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

/** BYOM error strings can embed raw provider response bodies — cap hard. */
const MAX_MESSAGE_LENGTH = 200;

let initialized = false;

/** True only when a DSN is configured — the single gate for all Sentry work. */
export function isSentryEnabled(): boolean {
  return typeof SENTRY_DSN === 'string' && SENTRY_DSN.length > 0;
}

/** Initialize the SDK once, on the client, only when a DSN is present. */
export function initSentry(): void {
  if (!isSentryEnabled() || initialized) return;
  initialized = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    // Keep the footprint minimal: no tracing, no replay, no default PII.
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

/**
 * Redact common secret shapes from an error message before it leaves the
 * browser. Truncation (applied by the caller) is the primary defense against
 * leaking large embedded response bodies; this handles obvious key material.
 */
function scrubMessage(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted-key]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]+/gi, '$1[redacted]');
}

/**
 * Capture an error with aggressive scrubbing. Sends only a redacted, truncated
 * message string (never the Error object, its stack, or any user text) tagged
 * with a coarse `context` for triage.
 */
export function captureScrubbedError(error: unknown, context: string): void {
  if (!isSentryEnabled()) return;

  const raw = error instanceof Error ? error.message : String(error);
  const scrubbed = scrubMessage(raw).slice(0, MAX_MESSAGE_LENGTH);

  Sentry.captureMessage(scrubbed, {
    level: 'error',
    tags: { context },
  });
}
