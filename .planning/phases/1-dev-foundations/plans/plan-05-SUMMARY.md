---
phase: 1-dev-foundations
plan: 05
req: FOUND-06
status: complete
completed: 2026-05-24
---

# Plan 05 — Sentry self-hosted dev DSN (FOUND-06) — Summary

## Commits (8 atomic)

| # | SHA       | Message                                                                              |
| - | --------- | ------------------------------------------------------------------------------------ |
| 1 | `935dbdc` | chore(1-05): install @sentry/nextjs ^8 (pinned for GlitchTip/Bugsink compat)         |
| 2 | `da03231` | feat(1-05): add sentry.{server,client,edge}.config.ts (FOUND-06)                     |
| 3 | `d8d46be` | chore(1-05): wrap next.config.js with withSentryConfig (FOUND-06)                    |
| 4 | `cd23d1b` | feat(1-05): register Sentry init via instrumentation.ts on Node/Edge (FOUND-06)      |
| 5 | `c38c8b5` | docs(1-05): document Sentry DSN env vars + runbook reference                         |
| 6 | `b396a9a` | docs(1-05): runbook for local Sentry/Bugsink dev setup                               |
| 7 | `8d05274` | chore(1-05): add temporary Sentry test Server Action for FOUND-06 verification       |
| 8 | `d2da452` | chore(1-05): add scripts/sentry-test.ts as concrete invocation path for FOUND-06     |

## Files
- **Permanent created:** `sentry.{server,client,edge}.config.ts` (repo root), `docs/runbooks/sentry-dev-setup.md`
- **TEMPORARY (delete at phase close):** `src/server/actions/_sentry-test.ts`, `scripts/sentry-test.ts`
- **Modified:** `next.config.js` (+withSentryConfig wrap, original nextConfig preserved), `src/instrumentation.ts` (+per-runtime Sentry imports, plan-01 env import preserved), `.env.example` (+plan-05 block, legacy DSN duplicates removed), `package.json`/`package-lock.json` (`@sentry/nextjs@^8.55.2`)

## Verification

| Check                                                  | Result                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm view @sentry/nextjs maintainers`                  | `sentry-bot@sentry.io` (official); 8.55.2 latest 8.x                                            |
| `npm run lint`                                         | exit 0 — zero warnings/errors                                                                   |
| `npm run typecheck`                                    | only pre-existing `supabase/*` errors (plan-01 Deferred); no new errors                         |
| `npm run test:ci`                                      | 16/16 PASS (no regressions; plan-05 adds no tests by design)                                    |
| `SENTRY_DSN=fake npm run build` (full env)             | prebuild PASS → `next build` compiles with Sentry instrumentation injected (Node/Edge/Client); typecheck step fails on same pre-existing `supabase/*` errors |
| `ls sentry.*.config.ts` / `ls docs/runbooks/...`       | all present; runbook 178 lines, 7 sections                                                      |

## FOUND-06 Acceptance — Met

- [x] `@sentry/nextjs@^8` installed, pinned away from 10.x
- [x] Three Sentry configs at repo root; raw `process.env.*` (import-order safe); `enabled: !!DSN` graceful no-op; `beforeSend` strips cookie/auth headers
- [x] `next.config.js` wrapped: `hideSourceMaps`, `telemetry: false`, `silent: !DSN`; original headers/images/serverActions preserved
- [x] `src/instrumentation.ts` runs env → Sentry (Node/Edge) in order; client auto-wired by withSentryConfig
- [x] `.env.example` documents DSNs + links runbook; runbook lets any dev provision Bugsink in <10 min
- [x] Sample rates: 1.0 dev / 0.1 prod; replay off (sanctions-affected SaaS dep)

## Deferred

1. **Manual 30s acceptance** (`npx tsx scripts/sentry-test.ts` → event in Bugsink dashboard) — requires a running Bugsink/GlitchTip container + real DSN. Not executable in automation context. Plan-05 §"Done When" explicitly allows this deferral for ROADMAP success criterion #3; runbook documents the exact developer steps.
2. **Temp file deletion** — `src/server/actions/_sentry-test.ts` + `scripts/sentry-test.ts` MUST be removed in the phase-1 close commit (after manual check). Suggested: `git rm src/server/actions/_sentry-test.ts scripts/sentry-test.ts && git commit -m "chore(1-05): remove temporary Sentry test action + script after FOUND-06 verified"`.

## Deviations (Rule 3 — fixed in scope)

1. **Duplicate DSN env vars** in `.env.example` (legacy `# Sentry (мониторинг)` block + new plan-05 append) — removed legacy bare pair, kept only commented plan-05 block. Commit `c38c8b5`.
2. **Plan §Verification claim softened** — plan-05 expected `SENTRY_DSN= npm run build` to exit 0, but plan-01's Zod schema requires both DSNs at prebuild (`src/env.ts` line 39+51). The `silent: !DSN` flag only governs `next build`'s Sentry behaviour, not the prebuild env gate. Verified with valid fake DSN instead; runbook calls this out explicitly to prevent dev confusion.

## Deferred (NOT plan-05 scope)

- **17 npm audit vulnerabilities** (9 moderate / 7 high / 1 critical) from `@sentry/nextjs` transitive deps — pre-existing upstream; suggested for a P7 prep `chore` plan via `npm audit fix --force` after impact review.

## Self-Check: PASSED

- [x] All created/modified files exist on disk (verified `ls` + `git status`)
- [x] All 8 commits exist on `main` (verified via `git log --oneline -10`)
- [x] `withSentryConfig` wrap preserves headers/images/serverActions
- [x] `src/instrumentation.ts` preserves plan-01's `await import('./env')` BEFORE Sentry imports
- [x] No file outside plan-05 scope touched (plan-04's `src/lib/audit-log.ts` UNTOUCHED)
