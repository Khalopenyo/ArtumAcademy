/**
 * Next.js boot hook (FOUND-02, plan-01).
 *
 * Next.js 14 auto-discovers `src/instrumentation.ts` (because tsconfig
 * uses `src/` paths) and calls `register()` ONCE per process boot —
 * before serving the first request in `next dev` / `next start`.
 *
 * We force `import('./env')` to make the Zod schema evaluate at boot.
 * If any required env is missing or invalid, `createEnv()` throws a
 * ZodError and Next.js exits with non-zero status — production runtime
 * never starts in a half-configured state.
 *
 * Build-time validation is enforced separately by the `prebuild` npm
 * script (`tsx src/env.ts`) — instrumentation.ts does not run at build.
 *
 * NOTE: This file is env-only in P1. plan-05 (Sentry) will add
 *   await import('../sentry.server.config') / sentry.edge.config
 * conditional on NEXT_RUNTIME. Keep this file additive-friendly.
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 1.
 */

export async function register(): Promise<void> {
  // Triggers the Zod schema evaluation at the first boot of the process.
  // Throws ZodError → Next.js process exits.
  await import('./env');
}
