---
phase: 1-dev-foundations
plan: 03
req: FOUND-04
status: complete
completed: 2026-05-24
---

# Plan 03 — pino Structured Logger Singleton (FOUND-04) — Summary

## Commits (4 atomic)

| # | SHA | Message |
| - | --- | --- |
| 1 | `ca68fea` | chore(1-03): install pino + pino-pretty for structured logging (FOUND-04) |
| 2 | `e4a566f` | feat(1-03): add pino singleton logger with redact + dev/prod transport (FOUND-04) |
| 3 | `333ceb5` | test(1-03): cover pino structure + redact + singleton (FOUND-04) |
| 4 | `ea4b884` | fix(1-03): TS-strict assertion on chunks[0] in logger tests (FOUND-04) |

## Files
- **Created:** `src/lib/logger.ts`, `src/lib/logger.test.ts`
- **Modified:** `package.json` (+`pino@^10.3.1` dep, +`pino-pretty@^13.1.3` devDep), `package-lock.json`
- **`.env.example`** — no-op (Task 3): `LOG_LEVEL=info` already present from plan-01 (line 74).

## Verification (acceptance for FOUND-04)

| # | Check | Result |
| - | --- | --- |
| 1 | `npm run lint` | exit 0, no warnings |
| 2 | `npm run typecheck` (logger files only) | 0 errors in `logger.ts` / `logger.test.ts` (pre-existing errors in `supabase/{server,middleware,admin.lint.test}.ts` carry over from plan-01/02 deferred) |
| 3 | `npm run test:ci -- src/lib/logger.test.ts` | 3/3 PASS (structure, redact, singleton) |
| 4 | `npm run build` | **Not executed.** Pre-existing typecheck errors block `next build` (plan-01 deferred). `npm run prebuild` (env validation) confirmed exit 0 with stub env. |
| 5 | `head -1 src/lib/logger.ts` | `import 'server-only';` ✓ |
| 6 | Redact paths count | 12 entries (1 more than RESEARCH minimum of 11) ✓ |
| 7 | `LOGGER_OPTIONS` exported | line 48 ✓ |
| — | Full unit suite | 16/16 PASS (+3 new vs plan-02) |

## Deviations (Rule 3 — blocking, fixed in scope)

1. **`vi.mock('server-only', () => ({}))` at top of `logger.test.ts`.** The `server-only` sentinel throws at import time outside Next.js RSC bundling context. `vi.mock` is hoisted by vitest, so the no-op is in place before `import './logger'` evaluates the sentinel. The bundler-level guarantee is enforced by Next.js + ESLint (admin.lint.test.ts pattern from plan-02), not by this unit test.
2. **`pino(opts, stream)` instead of `pino.destination`.** Plan task 4 referenced `pino.destination({ sync: true, dest: stream })`, but `pino.destination` wraps via SonicBoom which only accepts file descriptors (`SonicBoom supports only file descriptors and files`). Pino's documented test-friendly API accepts a `Writable` as the second arg of `pino()` directly — used that pattern; result is identical (synchronous in-process write to our buffered stream).
3. **TS-strict `chunks[0]!` non-null assertion.** Initial commit triggered TS errors under `noUncheckedIndexedAccess` (`string | undefined` not assignable). Folded `toHaveLength(1)` assertion + local `const line = chunks[0]!` to keep the parse + redact assertions clean. Split out as commit `ea4b884` because base test commit (`333ceb5`) had already been finalized.

## FOUND-04 Acceptance — Met
- [x] `src/lib/logger.ts` is pino singleton (lazy, via `getLogger()` + `logger` Proxy)
- [x] Redacts 12 sensitive paths (covers `password`, `token`, auth headers, all 3 project secret env vars)
- [x] Dev = pino-pretty colorized; prod = raw JSON; test = silent
- [x] First-line `import 'server-only'` (Edge runtime guard, ESLint guard for pino-pretty from plan-02)
- [x] `LOGGER_OPTIONS` exported for unit-test reuse
- [x] Server Actions + Route Handlers can `import { logger } from '@/lib/logger'` (first real consumer is plan-04's `auditLog()` failure path)

## Self-Check: PASSED
- [x] `src/lib/logger.ts` exists (115 lines)
- [x] `src/lib/logger.test.ts` exists (139 lines)
- [x] All 4 commits exist on `main` (ca68fea, e4a566f, 333ceb5, ea4b884)
- [x] `npm run lint && npm run test:ci` both exit 0
- [x] Duration: 12m 27s
