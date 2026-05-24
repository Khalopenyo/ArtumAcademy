---
phase: 1-dev-foundations
plan: 02
req: FOUND-03
status: complete
completed: 2026-05-24
---

# Plan 02 — server-only Boundary + ESLint no-restricted-imports (FOUND-03) — Summary

## Commits (4 atomic)

| # | SHA | Message |
| - | --- | --- |
| 1 | `8a1f5ed` | chore(1-02): install server-only sentinel |
| 2 | `e6d9836` | feat(1-02): add service_role admin Supabase client with server-only sentinel |
| 3 | `51fb8dd` | chore(1-02): add ESLint no-restricted-imports rule for admin client + pino-pretty |
| 4 | `3490081` | test(1-02): reproducible ESLint test for admin-client boundary |

## Files
- **Created:** `src/lib/supabase/admin.ts`, `src/lib/supabase/admin.lint.test.ts`
- **Modified:** `.eslintrc.json` (+rule, 3 overrides, `@typescript-eslint` plugin registration), `package.json` (+`server-only@^0.0.1`), `package-lock.json`

## Verification

| Check | Result |
| --- | --- |
| 1. `head -1 src/lib/supabase/admin.ts` | `import 'server-only';` ✓ |
| 2. `npm run test:ci -- src/lib/supabase/admin.lint.test.ts` | 2/2 PASS |
| 3. `npm run lint` (whole repo) | exit 0, no warnings/errors |
| 5. `grep service_role` on `src/components/`, `(marketing)`, `(app)` | empty (baseline clean) |
| 6. `grep "from '@/env'" admin.ts` | empty — Fix 11 honored (process.env directly) |
| 7. audit-log.ts as allowed caller | PASS (admin.lint.test.ts case 2) |
| 8. pino-pretty in client/server vs logger.ts | 1, 1, 0 errors — verified via ESLint API |
| Full unit suite `npm run test:ci` | 13/13 PASS (+2 new vs plan-01) |

**Check 4 (`npm run build`) NOT run** — pre-existing TS errors in `src/lib/supabase/{server,middleware}.ts` (plan-01 deferred) still block `next build` typecheck. Out of scope per critical rule 7. admin.ts itself typechecks clean.

## Deviations

**Rule 3 (in scope)** — Registered `@typescript-eslint` plugin in `.eslintrc.json`. plan-01 noted lint "warnings only"; this machine surfaced 13 hard errors blocking plan-02 Check 3. Parser + plugin already installed transitively via `eslint-config-next` but plugin name was never registered. Per critical rule #6, added `"plugins": ["@typescript-eslint"]` — folded into commit `51fb8dd`.

**Pre-existing (out of scope)** — 13 TS errors in `src/lib/supabase/{server,middleware}.ts` left untouched (predate Phase 1, same baseline as plan-01).

## FOUND-03 Acceptance — Met
- [x] admin.ts first line `import 'server-only';` (bundler defense layer)
- [x] ESLint blocks client imports of admin client (lint defense layer)
- [x] Override allow-list scoped to legitimate callers; `src/middleware.ts` excluded (Fix 3)
- [x] `pino-pretty` blocked everywhere except `src/lib/logger.ts` (Fix 10)
- [x] Globs `*.{ts,tsx}` (Fix 3); lint test reproducible via ESLint API (Fix 4); admin.ts reads `process.env.*` directly (Fix 11)

## Self-Check: PASSED
- [x] All 2 created + 2 modified files exist on disk
- [x] All 4 commits exist on `main` (8a1f5ed, e6d9836, 51fb8dd, 3490081)
- [x] `npm run lint && npm run test:ci` both exit 0
