/**
 * Sentry Edge-runtime init (FOUND-06, plan-05).
 *
 * Loaded by src/instrumentation.ts when NEXT_RUNTIME === 'edge' —
 * covers middleware.ts and any future Edge Route Handlers.
 *
 * Reads RAW `process.env.SENTRY_DSN` (same pattern as server config;
 * see sentry.server.config.ts comment for the rationale).
 *
 * Note: Edge runtime is workerd (V8 isolate, no Node APIs). Sentry's
 * `@sentry/nextjs` ships an Edge-compatible transport — DO NOT add
 * Node-only `beforeSend` logic that touches Buffer / fs / streams here.
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 4 lines 603–612.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
});
