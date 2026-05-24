/**
 * Next.js boot hook (FOUND-02 + FOUND-06, plans 01 & 05).
 *
 * Next.js 14 auto-discovers `src/instrumentation.ts` (because tsconfig
 * uses `src/` paths) and calls `register()` ONCE per process boot —
 * before serving the first request in `next dev` / `next start`.
 *
 * Side effects (ordered):
 *   1. `./env`             — Zod schema evaluation; throws ZodError on
 *                            missing/invalid env, killing the process
 *                            before it serves a half-configured request.
 *   2. `../sentry.*.config`— Sentry SDK init, conditional on NEXT_RUNTIME.
 *                            Client config is auto-discovered by
 *                            withSentryConfig (not imported here).
 *
 * Build-time env validation is enforced separately by the `prebuild`
 * npm script (`tsx src/env.ts`) — instrumentation.ts does not run at
 * build, only at runtime boot.
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 1 + §Pattern 4.
 */

export async function register(): Promise<void> {
  // 1. Validate env (FOUND-02). Throws ZodError → process exits.
  await import('./env');

  // 2. Init Sentry per runtime (FOUND-06). Client init is auto-wired by
  //    withSentryConfig — do NOT import sentry.client.config here.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
