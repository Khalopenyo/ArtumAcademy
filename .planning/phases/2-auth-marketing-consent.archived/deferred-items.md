# Phase 2 — Deferred Items

Out-of-scope discoveries found during phase execution. Surface to verifier; address in scoped plan or P7 polish.

---

## 1. `npm run build` pre-rendering errors (pre-existing from P1)

**Discovered:** plan-01 Task 3 verify (2026-05-24)
**Caused by:** `withSentryConfig` wrapping `next.config.js` in P1 commit `d8d46be` (FOUND-06)
**Reproduced:** Yes — fresh clone at commit `4368987` (before plan-01) fails the same way

**Errors:**
- `Error: <Html> should not be imported outside of pages/_document` on `/404` + `/500` (Sentry injects Pages-Router error pages)
- `TypeError: Cannot read properties of null (reading 'useContext')` on `/` + `/_not-found` (during static page generation)
- Final output: `Export encountered errors on following paths: /_error: /404, /_error: /500, /_not-found/page: /_not-found, /page: /`

**Why pre-existing:**
- Plan-00 SUMMARY only ran `typecheck && lint && test:ci` — never `npm run build`
- Phase 1 plan-05 SUMMARY likely never executed `npm run build` after the Sentry wrap commit
- This is a known `@sentry/nextjs` v8 issue with App Router + static page generation when `SENTRY_DSN` is set but no auth token / org config is present

**Out-of-scope for plan-01:** Plan-01 owns shadcn primitives + brand components + route-group layouts. Sentry/next.config build issue is orthogonal.

**Suggested fix (separate plan):**
- Add `instrumentation.ts` or `global-error.tsx` per Sentry's App Router migration guide
- OR conditionally disable Sentry's source-map upload via `silent: !process.env.SENTRY_DSN && process.env.NODE_ENV !== 'production'`
- OR set `NEXT_PUBLIC_SENTRY_DSN=` (empty) in dev `.env.local` (currently `silent` only checks `SENTRY_DSN`)

**Verified plan-01 changes are clean:**
- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run test:ci` (26/26) ✓
- All three new layouts and brand components compile + typecheck

**Reference:**
- Sentry guidance: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/#react-render-errors-in-app-router
- Warning text from build output: `It seems like you don't have a global error handler set up. It is recommended that you add a global-error.js file with Sentry instrumentation`
