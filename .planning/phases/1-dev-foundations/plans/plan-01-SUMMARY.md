---
phase: 1-dev-foundations
plan: 01
req: FOUND-02
status: complete
completed: 2026-05-24
---

# Plan 01 — Env Zod Parser (FOUND-02) — Summary

## Commits (6 atomic)

| # | SHA       | Message                                                                  |
| - | --------- | ------------------------------------------------------------------------ |
| 1 | `7520928` | chore(1-01): install @t3-oss/env-nextjs + tsx for env parser              |
| 2 | `63bd063` | feat(1-01): add Zod env parser src/env.ts (FOUND-02)                     |
| 3 | `256e497` | feat(1-01): wire env validation via instrumentation.ts (FOUND-02)        |
| 4 | `e3d6fcc` | docs(1-01): document new env vars in .env.example (plan-01)              |
| 5 | `efbb74b` | chore(1-01): add prebuild script for build-time env validation (FOUND-02) |
| 6 | `c10b124` | test(1-01): cover env Zod schema edge cases (FOUND-02)                   |

## Files
- **Created:** `src/env.ts`, `src/instrumentation.ts`, `src/env.test.ts`
- **Modified:** `.env.example` (+15 lines), `package.json` (+`prebuild` + 2 deps), `package-lock.json`
- **Untouched (per plan):** `next.config.js`

## Verification (commands run)

| Command | Result |
| --- | --- |
| `npm view @t3-oss/env-nextjs@0.13.11 maintainers` | OK (nexxel/juliusmarminge, t3-oss/t3-env) |
| `npm view tsx@4 maintainers` | OK (hirokiosame, privatenumber/tsx) |
| `npm run test:ci` | PASS — 11/11 (6 new in env.test.ts + 5 pre-existing) |
| `npm run lint` | exit 0 (pre-existing `@typescript-eslint/no-unused-vars` rule-missing warnings — pre-dates plan-01) |
| `npm run prebuild` (valid env) | exit 0 |
| `SUPABASE_SERVICE_ROLE_KEY= npm run prebuild` | exit 1, ZodError names `SUPABASE_SERVICE_ROLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY= npm run build` | exit 1 at `prebuild` step BEFORE `next build` starts ✓ |
| `npm run build` (valid env) | `prebuild` PASSES; `next build` then fails at typecheck on pre-existing `src/lib/supabase/{server,middleware}.ts` errors (out of plan-01 scope — see Deferred) |

## Gotchas / Deviations (Rule 3 — blocking, fixed in scope)

1. **`@vitest-environment node` pragma on `src/env.test.ts`.** Repo's `vitest.config.ts` is global `jsdom`; `@t3-oss/env-nextjs` checks `typeof window` and trips `onInvalidAccess` for server-only vars under jsdom. One-line per-file override; no global config touched.
2. **Tests assert on `console.error` spy, not on thrown message.** Library throws generic `Error('Invalid environment variables')` and emits ZodIssue list via `console.error`. Assertions like `.toThrow(/SUPABASE_SERVICE_ROLE_KEY/)` therefore fail; instead spy on `console.error` and assert `errorSpy.mock.calls` contains the variable name.

## Deferred (pre-existing, NOT plan-01 scope — confirmed via `git stash` round-trip)

1. **TS errors in `src/lib/supabase/middleware.ts` + `server.ts`** (`'cookiesToSet' implicitly has 'any'` etc.) block `next build` typecheck step. FOUND-02's `prebuild` env validation works; this is separate scaffold debt.
2. **ESLint config references `@typescript-eslint/no-unused-vars`** but the plugin is not installed. Lint exits 0; warnings only.

## FOUND-02 Acceptance — Met
- [x] Secrets validated via Zod at process boot (`src/instrumentation.ts` → `import('./env')`).
- [x] App fails on boot with invalid env (Zod throws → process exits).
- [x] App fails at build with invalid env (`prebuild` exits 1 before `next build`).
- [x] Typed `env` import available (`import { env } from '@/env'`; `env.SUPABASE_SERVICE_ROLE_KEY: string`).

## Self-Check: PASSED
- [x] All 4 created/modified files exist on disk
- [x] All 6 commits exist on `main` (verified via `git log --oneline -10`)
- [x] `next.config.js` UNTOUCHED (verified `git diff 02493ed..HEAD -- next.config.js` → empty)
