---
phase: 2
plan: 00-typecheck-baseline
wave: 0
status: complete
completed: 2026-05-24
requirements: []
commits: [08845d5]
---

# Phase 2 Plan 00: Typecheck Baseline Summary

Zeroed 13 pre-existing TS errors so every Wave-1+ `npm run typecheck` verify gate is meaningful (not pre-poisoned by Phase 1 scaffold debt).

## What changed
- `src/lib/supabase/server.ts` + `middleware.ts` — added `type CookieOptions` import + annotated `setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[])` (resolves 10 implicit-any errors)
- `package.json` + `package-lock.json` — added `@types/eslint@^8.56.12` to devDependencies (resolves 3 missing-types errors in admin.lint.test.ts)
- `src/lib/supabase/admin.lint.test.ts` — **UNCHANGED** (types auto-resolve via new devDep)

## Baseline: 13 TS errors → 0 (verified via `npm run typecheck && npm run lint && npm run test:ci`, 26/26 tests pass)

## Deviations from plan
- **[Rule 3 — Blocking config]** Plan said unpinned `npm install -D @types/eslint`. npm resolved `^9.6.1` (ESLint v9 typings — removed `useEslintrc`) → new TS2353 in admin.lint.test.ts. Repinned to `^8.56.12` to match the locked eslint v8.57.1 runtime. Same package, version pinned to runtime peer — NOT a substitution.

## Pattern for future plans
`@supabase/ssr` exports `CookieOptions` — use the typed import, never `any`. Canonical: `setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[])`.

## Self-Check: PASSED
- Both supabase files contain `CookieOptions` import + annotation; `@types/eslint@^8.56.12` in devDependencies; `admin.lint.test.ts` byte-identical (not in commit diff); commit `08845d5` present in `git log`.
