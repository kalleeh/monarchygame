/**
 * Client error reporter.
 *
 * Captures uncaught errors, unhandled promise rejections, and React error-boundary
 * catches, and persists them to the ClientError model so we can proactively monitor
 * what users hit — instead of waiting for manual bug reports.
 *
 * Design constraints:
 *  - MUST NEVER throw (a reporter that crashes the app is worse than no reporter).
 *  - Deduplicates by fingerprint and rate-limits, so a render loop can't spam the table.
 *  - No-ops in demo mode (no authenticated backend) — logs to console only.
 */

import { getClient } from './amplifyClient';
import { isDemoMode } from './authMode';

const APP_VERSION = '0.0.1';

// In-memory dedup + rate-limit state (per page session).
const seenFingerprints = new Map<string, number>(); // fingerprint -> last-sent epoch ms
const DEDUP_WINDOW_MS = 60_000; // don't re-send the same error within 60s
const MAX_REPORTS_PER_SESSION = 50;
let reportsThisSession = 0;

export type ErrorSource = 'window.onerror' | 'unhandledrejection' | 'errorBoundary' | 'manual';

interface ReportInput {
  message: string;
  stack?: string;
  source: ErrorSource;
  /** Extra tag for manual reports, e.g. a feature name. */
  context?: string;
}

/** Cheap, stable-ish hash for grouping identical errors. */
function fingerprint(message: string, stack?: string): string {
  const topFrame = (stack ?? '').split('\n').slice(0, 2).join(' ');
  const basis = `${message}::${topFrame}`;
  let h = 0;
  for (let i = 0; i < basis.length; i++) {
    h = (Math.imul(31, h) + basis.charCodeAt(i)) | 0;
  }
  return `e${(h >>> 0).toString(36)}`;
}

function currentKingdomId(): string | undefined {
  try {
    // Pulled lazily to avoid an import cycle with the store.
    const path = window.location.pathname.match(/\/kingdom\/([^/]+)/);
    return path?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Report an error. Best-effort, never throws, returns nothing.
 * Always logs to console; persists to the backend when authenticated.
 */
export function reportClientError(input: ReportInput): void {
  try {
    const message = (input.message || 'Unknown error').slice(0, 1000);
    const stack = input.stack ? input.stack.slice(0, 4000) : undefined;
    const fp = fingerprint(message, stack);

    // Always surface in the console for local/devtools visibility.
    console.error(`[errorReporter:${input.source}]`, message, input.context ?? '');

    // Demo mode has no authenticated backend — console only.
    if (isDemoMode()) return;

    // Rate-limit + dedup.
    const now = Date.now();
    if (reportsThisSession >= MAX_REPORTS_PER_SESSION) return;
    const last = seenFingerprints.get(fp);
    if (last !== undefined && now - last < DEDUP_WINDOW_MS) return;
    seenFingerprints.set(fp, now);
    reportsThisSession++;

    const ttl = Math.floor(now / 1000) + 30 * 24 * 60 * 60; // 30-day retention

    // Fire-and-forget; swallow all failures (reporting must never cascade).
    void getClient()
      .models.ClientError.create({
        message,
        stack,
        source: input.context ? `${input.source}:${input.context}` : input.source,
        url: `${window.location.pathname}${window.location.search}`.slice(0, 500),
        kingdomId: currentKingdomId(),
        userAgent: navigator.userAgent?.slice(0, 300),
        appVersion: APP_VERSION,
        fingerprint: fp,
        occurredAt: new Date(now).toISOString(),
        ttl,
      })
      .catch(() => {
        /* never let reporting failure surface */
      });
  } catch {
    /* errorReporter must never throw */
  }
}

let installed = false;

/** Install global handlers once, at app startup. Safe to call multiple times. */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    // Browsers sometimes hand us a sanitized "Script error." with no `.error` object
    // (errors surfacing from SDK/async contexts). In that case the stack is empty, but
    // filename:line:col are still provided — capture them so the report stays actionable.
    const stack = event.error instanceof Error
      ? event.error.stack
      : (event.filename ? `at ${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}` : undefined);
    reportClientError({
      message: event.message || String(event.error ?? 'window error'),
      stack,
      source: 'window.onerror',
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportClientError({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: 'unhandledrejection',
    });
  });
}
