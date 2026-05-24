/**
 * Sentry Browser init (FOUND-06, plan-05).
 *
 * Auto-discovered by `withSentryConfig` (next.config.js) — no manual
 * import needed in instrumentation.ts or layout.tsx.
 *
 * IMPORTANT — reads `process.env.NEXT_PUBLIC_SENTRY_DSN` (NEXT_PUBLIC_*
 * prefix is required for the bundler to inline the value into the
 * client bundle). `enabled: !!...` is a graceful no-op when DSN is
 * absent.
 *
 * Session Replay DISABLED:
 *   - replaysOnErrorSampleRate: 0
 *   - replaysSessionSampleRate: 0
 *
 * Rationale:
 *   1. Replay payload size — kills dev DX with self-hosted GlitchTip/Bugsink.
 *   2. Pulls in additional Sentry deps that talk to SaaS replay endpoints
 *      not implemented by self-hosted backends.
 *   3. We're not allowed to ship session replay over Sanctions-affected
 *      Sentry SaaS (STACK.md).
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 4 lines 588–600.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Avoid noise + Sanctions-affected SaaS replay dependency — capture errors only.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
});
