/**
 * Sentry Node-runtime init (FOUND-06, plan-05).
 *
 * Loaded by src/instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
 *
 * IMPORTANT — reads RAW `process.env.SENTRY_DSN`, NOT the typed `@/env`
 * import. Reason: instrumentation may invoke this before env.ts side
 * effects complete; using raw process.env keeps Sentry init resilient
 * to import order. `enabled: !!process.env.SENTRY_DSN` is a graceful
 * no-op when DSN is absent (dev convenience — see runbook).
 *
 * Self-hosted GlitchTip/Bugsink compatibility:
 *   - tunnelRoute NOT supported (Sentry SaaS only) — omitted.
 *   - sentryUrl/org/project configured in next.config.js (commented in P1,
 *     enabled in P7 with prod self-hosted instance).
 *
 * Defense in depth: beforeSend strips cookie/auth headers before send.
 * pino logger ALREADY redacts these (FOUND-04), but Sentry breadcrumbs
 * collect HTTP request data separately — this is a second-layer scrub.
 * NEVER add KINESCOPE_API_TOKEN / YOOKASSA_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY
 * leakage paths here.
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 4 lines 566–585.
 * See: docs/runbooks/sentry-dev-setup.md for local Bugsink setup.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
  beforeSend(event) {
    // Strip cookies/auth from breadcrumbs (defense in depth — pino already redacts).
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }
    return event;
  },
});
