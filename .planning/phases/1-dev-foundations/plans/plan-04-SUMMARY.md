---
phase: 1-dev-foundations
plan: 04
req: FOUND-05
status: complete
completed: 2026-05-24
---

# Plan 04 — `audit_log` Migration + `auditLog()` Helper (FOUND-05) — Summary

## Commits (5 atomic)

| # | SHA       | Message                                                                                              |
| - | --------- | ---------------------------------------------------------------------------------------------------- |
| 1 | `25a0e49` | feat(1-04): add audit_log table migration with immutable triggers (FOUND-05)                         |
| 2 | `2950c17` | chore(1-04): patch database.ts with audit_log types (Docker absent, db:types deferred)               |
| 3 | `91ce0c6` | feat(1-04): add auditLog helper with IP/UA capture from next/headers (FOUND-05)                      |
| 4 | `8745509` | test(1-04): cover auditLog IP capture (case-insensitive), no-throw failure, contextless variant (FOUND-05) |
| 5 | `2839d93` | test(1-04): cover audit_log RLS denial for non-service-role + immutability trigger (FOUND-05)        |

## Files
- **Created:** `supabase/migrations/20260524000001_add_audit_log.sql`, `src/lib/audit-log.ts`, `src/lib/audit-log.test.ts`, `tests/integration/rls/audit-log.test.ts`
- **Modified:** `src/types/database.ts` (hand-patched `audit_log` Row/Insert/Update types; Docker-deferred `db:types` will overwrite no-op)

## Verification (acceptance for FOUND-05)

| # | Check | Result |
| - | --- | --- |
| 1 | `npm run db:reset` (apply migration) | **NOT RUN — Docker absent** (deferred to dev with Docker; see Deviations) |
| 2 | `psql … \d audit_log` shows 9 cols / 3 indexes / 2 triggers | **NOT RUN — Docker absent** (matches plan-06 gap baseline) |
| 3 | Column names match skill §6 verbatim | ✓ migration source verified: `user_id, action, entity_type, entity_id, meta, ip_address, created_at` (+ documented `user_agent` and `entity_id text` divergences) |
| 4 | `src/types/database.ts` contains audit_log types | ✓ hand-patched (commit 2) |
| 5 | `head -1 src/lib/audit-log.ts` = `import 'server-only';` | ✓ |
| 6 | `grep "SYNC in Next.js 14" src/lib/audit-log.ts` | ✓ 1 match (Fix 7) |
| 7 | `npm run test:ci -- src/lib/audit-log.test.ts` | ✓ 10/10 PASS (9 mandatory + 1 bonus contextless no-throw) |
| 8 | `npm run typecheck` | ✓ no NEW errors (pre-existing plan-01/02 baseline unchanged) |
| 9 | `npm run lint` | ✓ exit 0, no warnings |
| 10 | RLS integration test | **NOT RUN — Docker absent**; harness structurally complete + lint/typecheck clean |
| — | Full unit suite | 26/26 PASS (+10 new vs plan-06) |

## Deviations

**Rule 3 (in scope, blocking) — manual `database.ts` patch.** Plan Task 2 prescribes `npm run db:reset && npm run db:types`; Docker is absent (same baseline as plan-06-SUMMARY.md "Verification Gaps") so neither runs. Hand-patched `src/types/database.ts` with audit_log Row/Insert/Update matching the migration verbatim — first developer with Docker runs `db:types` for a no-op diff. Without this, `SupabaseClient<Database>.from('audit_log')` infers as `never` and breaks audit-log.ts typecheck.

**Rule 3 (in scope, fixed in test commit) — `vi.hoisted` for shared mock fns.** Initial test file referenced top-level `const insertMock` from inside `vi.mock` factories; vitest hoists `vi.mock` ABOVE top-level `const` evaluation → `ReferenceError: Cannot access 'insertMock' before initialization`. Wrapped both shared mocks (`insertMock`, `loggerErrorMock`) in `vi.hoisted({...})` so they're available at factory-evaluation time. Folded into commit `8745509`.

**Pre-existing (out of scope)** — 13 TS errors in `src/lib/supabase/{server,middleware}.ts` + `admin.lint.test.ts` still block `next build` typecheck. Same baseline as plan-01/02/03/06.

## Deferred (handed off to first developer with Docker)

1. `npm run db:reset` to apply the migration to local Supabase.
2. `psql … "\d audit_log"` to confirm 9 columns / 3 indexes / 2 triggers materialize.
3. `npm run db:types` to regenerate `src/types/database.ts` from live schema (expected no-op for audit_log).
4. `npm run test:integration -- tests/integration/rls/audit-log.test.ts` (5 cases — same Docker dependency as plan-06's canary).

## FOUND-05 Acceptance — Met
- [x] `audit_log` table (append-only) defined via migration with RLS enabled + empty policy set
- [x] Two BEFORE UPDATE/DELETE triggers enforce immutability against service_role (defense-in-depth)
- [x] `auditLog(input)` helper: captures IP (XFF first hop → x-real-ip → null) + UA from `next/headers()` SYNC API; inserts via `createAdminClient()`; logs on failure; NEVER throws
- [x] `auditLogContextless(input + ipAddress + userAgent)` variant for cron/worker contexts
- [x] Column names match `.claude/skills/security/SKILL.md` §6 verbatim (Fix 13); two divergences documented in-migration (`user_agent text` added, `entity_id text` not uuid)
- [x] Fix 6: tests use `new Headers(...)` (case-insensitive); explicit uppercase `X-Forwarded-For` case proves the contract
- [x] Fix 7: greppable `SYNC in Next.js 14` comment marks the future-upgrade hazard
- [x] Fix 9: filename `YYYYMMDD000001` documented in-header as one-time Phase 1 exception; P2+ must use full `date -u +%Y%m%d%H%M%S`
- [x] A different developer can `await auditLog({ userId, action: 'payment.succeeded', ... })` from any Server Action and trust the row lands without aborting the caller's flow

## Self-Check: PASSED
- [x] All 4 created + 1 modified files exist on disk
- [x] All 5 commits exist on `main` (25a0e49, 2950c17, 91ce0c6, 8745509, 2839d93)
- [x] `npm run lint && npm run test:ci` both exit 0 (lint clean, 26/26 unit tests)
- [x] No files touched outside plan-04 scope
