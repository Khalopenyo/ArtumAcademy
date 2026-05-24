---
phase: 1-dev-foundations
phase_number: 1
mode: mvp
created: 2026-05-24
revised: 2026-05-24
requirements: [FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-10]
plans_count: 6
ui_hint: no
---

# Phase 1: Dev Foundations — PLAN

> **Master plan**. Per-plan details live in `plans/plan-NN-<slug>.md`. Each plan file is atomic (one focused PR) and references `RESEARCH.md` section/line ranges for copy-paste-ready snippets so executors do NOT re-derive solutions.

---

## Phase Overview

### Goal (re-stated from ROADMAP.md §Phase 1)

Минимально-достаточная локальная инфраструктура: env-парсер падает на старте при невалидных секретах, service_role физически нельзя втянуть в client-bundle, есть структурный лог и audit-таблица, Sentry SDK работает против dev-DSN, RLS test harness готов. Это база, на которой можно безопасно строить P2–P6 без production-grade gates.

### Mode

**mvp** — every Phase 1 plan is a thin, atomic, end-to-end-buildable slice. Per the planner's MVP-mode nuance for this phase: **vertical-slicing principle does NOT apply** (Phase 1 is explicitly infra-only, no user-facing UI), and **Walking Skeleton does NOT apply** (no user slice to skeleton). Plans are **atomic per requirement** — one plan == one well-scoped REQ-ID. Parallelizable wherever no file conflicts exist.

### Scope

**In scope (6 requirements):**

| REQ-ID | Description | Plan |
|---|---|---|
| FOUND-02 | env Zod parser at app boot (`@t3-oss/env-nextjs`) | `plan-01-env-parser.md` |
| FOUND-03 | `import 'server-only'` on `src/lib/supabase/admin.ts` + ESLint `no-restricted-imports` | `plan-02-server-only-boundary.md` |
| FOUND-04 | pino logger singleton (redact + dev pretty / prod JSON) | `plan-03-pino-logger.md` |
| FOUND-05 | `audit_log` Postgres table + `auditLog()` helper (IP+UA capture) | `plan-04-audit-log-migration-and-helper.md` |
| FOUND-06 | `@sentry/nextjs` ^8 wired (3 config files + `withSentryConfig`) + dev DSN | `plan-05-sentry-dev-dsn.md` |
| FOUND-10 | RLS test harness — `supabase start` + Vitest globalSetup + canary cross-user denial test | `plan-06-rls-test-harness.md` |

**Out of scope (deferred to other phases — DO NOT introduce):**

- Production deploy / Vercel `fra1` / custom domain / DNS — Phase 7 (FOUND-07, FOUND-08)
- Supabase Pro tier + PITR — Phase 7 (FOUND-01, OPS-06)
- 152-ФЗ юрист sign-off — Phase 7 (FOUND-09, COMP-02)
- Sentry source-map upload (`SENTRY_AUTH_TOKEN`) — Phase 7 (requires prod build)
- Any UI component, page, route handler, Server Action for user-facing features — P2+
- Auth pages, registration, login, marketing pages — Phase 2
- Production Sentry DSN switch — Phase 6 (verify) + Phase 7 (cutover)
- ЮKassa client, payment flow, webhook handler — Phase 3, 4
- Kinescope JWT signing, video player — Phase 5

### Dependencies on Existing Scaffold (treated as immutable foundation)

These exist and are NOT modified in Phase 1:

- `src/lib/supabase/client.ts` — browser-side Supabase client
- `src/lib/supabase/server.ts` — server-side anon-key client (RLS-bound)
- `src/lib/supabase/middleware.ts` — middleware cookie refresh
- `src/lib/auth/require.ts` — `requireUser`, `requireRole` helpers
- `supabase/migrations/20260522000001_init_base_tables.sql` — base schema (`profiles`, `user_roles`, `courses`, `modules`, `lessons`) with RLS
- `next.config.js` — security headers (DENY X-Frame, nosniff, strict-origin, HSTS). **Modified** in plan-05 only to wrap with `withSentryConfig`. (Fix 1: plan-01 NO LONGER modifies `next.config.js` — build-time env validation now lives in a `prebuild` npm script.)
- `.eslintrc.json` — existing rules. **Modified** in plan-02 only to add `no-restricted-imports` + overrides (with `.tsx` globs and `pino-pretty` block per Fixes 3 + 10).
- `vitest.config.ts` — existing unit/component test config. **NOT modified**; plan-06 adds a SEPARATE `vitest.integration.config.ts`.
- `package.json` — existing `test:integration` script already declared. **Modified** by plans for `dependencies` + `devDependencies` + plan-01 ALSO adds `prebuild` script and `tsx` devDep (Fix 1).

### Success Criteria (from ROADMAP.md — must be TRUE at phase end)

1. App crashes on boot OR at build (via `prebuild` script) if any required secret missing or invalid per Zod → delivered by **plan-01**
2. `grep -ri "service_role" src/components/ src/app/(marketing) src/app/(app)` empty AND import of `@/lib/supabase/admin` from client fails build/lint → delivered by **plan-02** (with reproducible ESLint API unit test per Fix 4)
3. Test exception in Server Action visible in dev Sentry/GlitchTip dashboard within 30s of running `npx tsx scripts/sentry-test.ts` → delivered by **plan-05** (Fix 8 — concrete invocation script)
4. RLS harness logs in as 2 users, proves cross-user denial on a shape table (with admin-readback verification — Fix 12) → delivered by **plan-06**
5. pino logs JSON lines on every Server Action; `audit_log` table ready + `auditLog()` helper unit-tested → delivered by **plan-03** (pino) + **plan-04** (audit_log table+helper with skill-aligned column names — Fix 13)

### Pitfalls Prevented (per ROADMAP.md §Phase 1)

- **#10** — RLS USING/WITH CHECK conventions → enforced by **plan-06** harness (template forces correct policy review on every future migration)
- **#12** — `service_role` leak (baseline) → **plan-02** server-only + ESLint + grep
- **#21** — server-only discipline → **plan-02**
- **#22** — middleware budget → addressed implicitly: pino NOT introduced into middleware (Edge runtime caveat documented in plan-03)

---

## Plan Inventory (atomic per REQ-ID)

| Plan | REQ | Title | Files (created/modified) | Depends on | Wave |
|---|---|---|---|---|---|
| 01 | FOUND-02 | Env Zod parser via `@t3-oss/env-nextjs` | `src/env.ts` (new), `src/instrumentation.ts` (new), `src/env.test.ts` (new), `.env.example` (modified), `package.json` (deps add + `prebuild` script + `tsx` devDep — Fix 1) | nothing | 1 |
| 02 | FOUND-03 | `server-only` boundary + ESLint rule | `src/lib/supabase/admin.ts` (new — reads `process.env.*` directly per Fix 11), `src/lib/supabase/admin.lint.test.ts` (new — reproducible ESLint API test per Fix 4), `.eslintrc.json` (modified — `.tsx` globs per Fix 3, `pino-pretty` block per Fix 10), `package.json` (deps add `server-only`) | nothing (truly parallel — Fix 11) | 1 |
| 03 | FOUND-04 | pino structured logger singleton | `src/lib/logger.ts` (new — exports `LOGGER_OPTIONS` for test reuse per Fix 5), `src/lib/logger.test.ts` (new — single memory-buffer strategy per Fix 5), `.env.example` (modified — `LOG_LEVEL`), `package.json` (deps add `pino` + dev `pino-pretty`) | plan-01 (uses `env.NODE_ENV`, `env.LOG_LEVEL`) | 2 |
| 04 | FOUND-05 | `audit_log` migration + `auditLog()` helper | `supabase/migrations/20260524000001_add_audit_log.sql` (new — column names per skill §6 per Fix 13), `src/lib/audit-log.ts` (new — with sync-`headers()` comment per Fix 7), `src/lib/audit-log.test.ts` (new — `new Headers(...)` mock + case-insensitive test per Fix 6) | plan-01 (env), plan-02 (admin client), plan-03 (logger) | 3 |
| 05 | FOUND-06 | `@sentry/nextjs` ^8 wired + dev DSN | `sentry.server.config.ts` (new), `sentry.client.config.ts` (new), `sentry.edge.config.ts` (new), `next.config.js` (modified — wrap with `withSentryConfig`; FIRST P1 edit of this file per Fix 1), `src/instrumentation.ts` (modified — add Sentry imports), `src/server/actions/_sentry-test.ts` (TEMPORARY, deleted before phase close), `scripts/sentry-test.ts` (TEMPORARY per Fix 8 — concrete invocation script, deleted before phase close), `.env.example` (modified — `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`), `docs/runbooks/sentry-dev-setup.md` (new), `package.json` (deps add `@sentry/nextjs@^8`) | plan-01 (env, instrumentation.ts) | 2 |
| 06 | FOUND-10 | RLS test harness (Vitest + Supabase local) | `vitest.integration.config.ts` (new), `tests/integration/globalSetup.ts` (new — key-casing matrix per Fix 2), `tests/integration/setup.ts` (new), `tests/integration/helpers/test-clients.ts` (new), `tests/integration/helpers/test-users.ts` (new), `tests/integration/rls/profiles.test.ts` (new — admin-readback UPDATE-deny per Fix 12), `package.json` (no script change — `test:integration` exists) | nothing (uses scaffold's existing `profiles` table) | 1 |

**Total files created:** ~24 new files (was ~22 — added `admin.lint.test.ts` per Fix 4 and `scripts/sentry-test.ts` per Fix 8), 4 modified existing files (`.env.example`, `.eslintrc.json`, `src/instrumentation.ts` — created in plan-01 then modified in plan-05, `package.json` — additive deps + scripts). `next.config.js` is touched by plan-05 ONLY (Fix 1 removed plan-01's claim on it).

---

## Parallelization Graph

```
Wave 1 (no deps — start truly in parallel — Fix 11 removed plan-02's soft-dep on plan-01):
  plan-01 (env parser)             ──┐
  plan-02 (server-only + ESLint)   ──┤   independent — admin.ts reads process.env.* directly,
  plan-06 (RLS test harness)       ──┘   runtime guarantee from plan-01's prebuild + instrumentation

Wave 2 (depends on Wave 1):
  plan-03 (pino logger)            ←── plan-01 (needs env.NODE_ENV, env.LOG_LEVEL)
  plan-05 (Sentry SDK)             ←── plan-01 (needs env.SENTRY_DSN, modifies instrumentation.ts;
                                                  next.config.js is plan-05-exclusive per Fix 1)

Wave 3 (depends on Wave 2):
  plan-04 (audit_log migration + helper) ←── plan-01 (env), plan-02 (admin client), plan-03 (logger)
```

**Conflict notes (why some plans are sequential, not parallel):**

- `src/instrumentation.ts` — **created in plan-01**, then **modified in plan-05** (add `await import('../sentry.server.config')` inside `register()`). Sequential.
- `next.config.js` — **NOT modified by plan-01** (Fix 1 — build-time env validation moved to `prebuild` npm script). **Modified in plan-05 only** (wrap with `withSentryConfig`). plan-05 is the sole P1 editor of this file. No conflict.
- `package.json` `dependencies` + `devDependencies` + `scripts` — multiple plans add packages and plan-01 adds `prebuild` script + `tsx` devDep; merge conflict trivial (additive). Acceptable.
- `.env.example` — modified by plan-01 (most additions), plan-03 (`LOG_LEVEL`), plan-05 (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`). Plan-01 lands first; plan-03 + plan-05 append non-overlapping lines.
- `src/lib/supabase/admin.ts` — created in plan-02 (with `process.env.*` direct read per Fix 11; truly independent of plan-01 at code level), **imported** (not modified) by plan-04. No conflict.
- `src/lib/logger.ts` — created in plan-03, **imported** (not modified) by plan-04. No conflict.

**Solo-dev practical sequencing recommendation** (if not parallelizing with multiple agents): linear order **01 → 02 → 06 → 03 → 05 → 04**. 06 fits in Wave 1 since it's self-contained and the RLS harness can be exercised against the existing `profiles` table immediately. Plans 01, 02, 06 can also be done in any internal order (all truly independent post-Fix 11).

---

## Coverage / Acceptance Matrix

> Each Phase 1 success criterion → which plan(s) deliver it. **Every criterion is covered by ≥ 1 plan.**

| ROADMAP §Phase 1 Success Criterion | Delivered by | Verification command (post-merge) |
|---|---|---|
| 1. App crashes on boot OR at build if any required secret missing/invalid per Zod | **plan-01** | `SUPABASE_SERVICE_ROLE_KEY= npm run prebuild` → fails with ZodError; `npm run test:ci -- src/env.test.ts` passes |
| 2. `grep -ri "service_role" src/components/ src/app/(marketing) src/app/(app)` empty AND client import of `@/lib/supabase/admin` fails build/lint | **plan-02** | `grep -ri "service_role" src/components/ src/app/\(marketing\)/ src/app/\(app\)/` returns empty; `npm run test:ci -- src/lib/supabase/admin.lint.test.ts` proves rule fires on client component (Fix 4 — reproducible, no plant-and-remove) |
| 3. Test exception in Server Action visible in dev Sentry/GlitchTip dashboard within 30s of running concrete invocation | **plan-05** | Manual: `npx tsx scripts/sentry-test.ts` (Fix 8 — concrete script, no ambiguous "navigate to a way to invoke"), observe event in GlitchTip/Bugsink UI within 30s; documented in `docs/runbooks/sentry-dev-setup.md` |
| 4. RLS harness logs in as 2 users, proves cross-user denial on a shape table with admin-readback | **plan-06** | `npm run test:integration -- tests/integration/rls/profiles.test.ts` passes against `supabase start`-warmed local stack (UPDATE-deny uses `expect(data ?? []).toEqual([])` + admin-client read-back per Fix 12) |
| 5. pino logs JSON lines on every Server Action; `audit_log` table ready + `auditLog()` helper unit-tested | **plan-03** (pino) + **plan-04** (audit_log+helper with skill-aligned columns) | `npm run test:ci -- src/lib/logger.test.ts src/lib/audit-log.test.ts` passes (audit-log test uses `new Headers(...)` mock per Fix 6, asserts on `ip_address`/`meta`/`entity_type` columns per Fix 13); `supabase db reset` then `psql … -c "\d audit_log"` shows table+indexes |

**Coverage**: 6/6 requirements mapped (FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-10). 5/5 success criteria covered.

---

## Risks + Mitigations

| Risk | Plan affected | Likelihood | Mitigation |
|---|---|---|---|
| **R1**: ESLint `no-restricted-imports` rule too broad — accidentally blocks legitimate imports in `src/server/**` / `src/app/api/**` | plan-02 | Medium | Use the `overrides` block per Fix 3 (covers `.tsx` too) — explicitly allow admin/audit/server/api/instrumentation/sentry-config files. `src/middleware.ts` explicitly EXCLUDED (must never import admin). Run `npm run lint` on the whole repo before commit; if any unexpected violation surfaces, ADD the offending file to the override list, do NOT relax the rule. |
| **R2**: `pino-pretty@13.x` accidentally pulled into client bundle (~50KB regression) | plan-03 | Low | RESEARCH.md §Pitfall 4 lines 1139–1144 explicit: NEVER `import pinoPretty`; use `transport: { target: 'pino-pretty' }` string form. Logger file has `import 'server-only'` first line — second line of defense. **Plus** Fix 10 — plan-02 adds `pino-pretty` to ESLint `no-restricted-imports.patterns` to block direct import from any file except `src/lib/logger.ts`. |
| **R3**: `@sentry/nextjs@^8` requires Next.js features incompatible with `14.2.15` | plan-05 | Low | RESEARCH.md §Standard Stack lines 86 + §A3 (line 1356) confirms 8.55.2 compatible with Next 14.2.x. Mitigation if build fails: `enabled: !!process.env.SENTRY_DSN` graceful no-op pattern (RESEARCH.md §Pattern 4 line 575) allows install + config to proceed without DSN-attached errors. |
| **R4**: pino in Edge runtime (e.g., `src/middleware.ts`) crashes | plan-03 | Low | RESEARCH.md §Pattern 3 line 541 explicit: pino requires Node runtime. Plan-03 forbids importing logger from middleware; uses `import 'server-only'` first line to make build-time error visible if anyone does. Server Actions / Route Handlers default to Node runtime — pino works. |
| **R5**: `instrumentation.ts` doesn't run at `next build` — broken envs ship | plan-01 | Medium | RESEARCH.md §Pitfall 2 lines 1122–1131 mitigation: **Fix 1** — `prebuild` npm script `"prebuild": "tsx src/env.ts"` runs before `next build` automatically (npm lifecycle), validates env, crashes build on failure. Plan-01 task 5 ships this; the earlier `require('./src/env')` from `next.config.js` proposal is REJECTED (CommonJS can't load TS). |
| **R6**: `supabase start` requires Docker, blocking developer machines without it | plan-06 | Medium | RESEARCH.md §Environment Availability lines 1235–1240: documented as a "missing dependency with fallback" — RLS tests can be deferred to CI-only check if local Docker absent. Plan-06 includes a README note + clear failure message. |
| **R7**: GlitchTip/Bugsink dev instance not provisioned → success criterion #3 cannot be verified | plan-05 | High | RESEARCH.md §A8 line 1361 mitigation: `enabled: !!process.env.SENTRY_DSN` graceful no-op. Plan-05 ships SDK install + config files even if no DSN; `docs/runbooks/sentry-dev-setup.md` (new in this plan) tells developer how to spin up Bugsink locally (`docker run -p 8000:8000 bugsink/bugsink`). Success criterion #3 verified via `npx tsx scripts/sentry-test.ts` (Fix 8) once developer runs the runbook. **If Bugsink/GlitchTip cannot be provisioned in P1 window**, success criterion #3 is the only one that defers; all other 4 criteria still pass. |
| **R8**: Migration timestamp collision with future migrations | plan-04 | Low | **Fix 9**: Migration filename `20260524000001_add_audit_log.sql` uses `YYYYMMDD000001` form (date + 6-digit pseudo-sequence), NOT the skill's full `YYYYMMDDHHMMSS` convention. Deliberate one-time exception to keep Phase 1 grouped with `20260522000001_init_base_tables.sql`. **All P2+ migrations MUST use full `date -u +%Y%m%d%H%M%S`** to avoid same-day collisions. Recorded in plan-04 Task 1. |
| **R9**: New plans modify `next.config.js` in ways that conflict with existing scaffold | plan-05 | Low | **Fix 1 simplification**: plan-01 NO LONGER modifies `next.config.js`. Only plan-05 touches it (wraps with `withSentryConfig`, preserves all existing fields). Zero conflict risk. |
| **R10**: ESLint rule for `no-restricted-imports` doesn't catch `require()` / dynamic `import()` | plan-02 | Low | RESEARCH.md §Pitfall 7 lines 1158–1167 documents this is an accepted limitation. Plan-02 relies on second-layer defense: `import 'server-only'` runtime guard in `admin.ts` itself catches any path of inclusion. Optional `no-restricted-syntax` rule mentioned but not made mandatory in P1 (low risk + adds ESLint surface area). |
| **R11**: Supabase CLI JSON key-casing varies across versions (`API_URL` vs `api_url`) | plan-06 | Low-Medium | **Fix 2**: plan-06 Task 1a probes `supabase status --output json` casing before encoding, documents the matrix in `globalSetup.ts`, adds a defensive throw if `process.env.NEXT_PUBLIC_SUPABASE_URL` ends up empty, and includes a regex-over-text-output fallback if JSON breaks entirely. |
| **R12**: Plant-and-remove ESLint smoke leaves repo broken mid-task | plan-02 | Medium | **Fix 4**: replaced with `admin.lint.test.ts` — a Vitest unit test that uses Node's ESLint API to lint a synthetic-code string. No files planted, no manual cleanup, reproducible in CI forever. |
| **R13**: `Map`-based mock of `headers()` silently misses uppercase header names | plan-04 | Medium | **Fix 6**: plan-04 Task 4 uses `new Headers(...)` (case-insensitive, web-standard) — matches the real `ReadonlyHeaders` return type of Next.js `headers()`. Test suite includes an explicit uppercase-key case to prove case-insensitivity. |
| **R14**: `headers()` becomes async in Next.js 15+ — silent IP/UA null after major upgrade | plan-04 | Medium | **Fix 7** + RESEARCH.md Pitfall 9: plan-04 Task 3 ships a `// NOTE: headers() is SYNC in Next.js 14.2.x` comment in `src/lib/audit-log.ts`. Future major-version upgrade catches the change-point. CLAUDE.md locks Next 14.2.x for M1. |
| **R15**: Dead-code RLS UPDATE assertion always passes | plan-06 | High | **Fix 12**: plan-06 Task 7 deletes the meaningless `expect((error?.code ?? data?.length) ?? 0).not.toBe(undefined)` line and replaces with standard Supabase RLS-deny pattern (`expect(data ?? []).toEqual([])`) + admin-client read-back as authoritative proof of no-mutation. |
| **R16**: `audit_log` column-name drift from `.claude/skills/security/SKILL.md` §6 | plan-04 | High | **Fix 13** option (a): plan-04 aligns column names verbatim with skill §6 (`entity_type, entity_id, meta, ip_address`). The earlier draft's `entity/payload/ip` would have caused future-feature drift since audit_log is referenced by many features. `user_agent` and text `entity_id` are documented divergences requiring a non-blocking P2 skill-doc update. |

---

## Working Order Checklist (single-developer mental model)

> If working linearly (not parallelizing), prefer this order — each step leaves the repo in a buildable/lintable/testable state.

- [ ] **plan-01** (env parser): packages install (`@t3-oss/env-nextjs`, `tsx`) → `src/env.ts` → `src/instrumentation.ts` (env-only) → `.env.example` updates → `package.json` add `prebuild` script (Fix 1 — NOT `next.config.js`) → unit test → `npm run prebuild && npm run build && npm run test:ci` green
- [ ] **plan-02** (server-only): packages install → `src/lib/supabase/admin.ts` (with `import 'server-only'` line 1 + `process.env.*` direct read per Fix 11) → `.eslintrc.json` `no-restricted-imports` + overrides (with `.tsx` globs per Fix 3, `pino-pretty` block per Fix 10) → `src/lib/supabase/admin.lint.test.ts` (Fix 4 — reproducible ESLint API test) → `npm run lint && npm run build && npm run test:ci -- admin.lint.test.ts` green
- [ ] **plan-06** (RLS harness): `vitest.integration.config.ts` → Task 1a probe of `supabase status --output json` key casing (Fix 2) → `tests/integration/{globalSetup,setup}.ts` (with key-casing matrix) → `tests/integration/helpers/test-{clients,users}.ts` → `tests/integration/rls/profiles.test.ts` canary (with admin-readback UPDATE-deny per Fix 12) → `npm run test:integration` green against `supabase start`
- [ ] **plan-03** (pino logger): packages install → `src/lib/logger.ts` (with `import 'server-only'` + `from '@/env'` + exported `LOGGER_OPTIONS` per Fix 5) → `.env.example` `LOG_LEVEL` → unit test (memory-buffer strategy per Fix 5 — 3 cases: structure, redact, singleton) → `npm run test:ci` green
- [ ] **plan-05** (Sentry): packages install → `sentry.{server,client,edge}.config.ts` → `next.config.js` wrap with `withSentryConfig` (Fix 1 — clean edit, plan-01 didn't modify) → `src/instrumentation.ts` add Sentry imports (preserve plan-01's env import) → `.env.example` add `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` → `docs/runbooks/sentry-dev-setup.md` → temp `_sentry-test.ts` action + `scripts/sentry-test.ts` invocation script (Fix 8) → `npm run build` green (without DSN) → manual verify via `npx tsx scripts/sentry-test.ts` with Bugsink local
- [ ] **plan-04** (audit_log + helper): migration `20260524000001_add_audit_log.sql` (with skill-aligned column names per Fix 13) → `npm run db:reset` → `npm run db:types` → `src/lib/audit-log.ts` (with sync-`headers()` comment per Fix 7) → unit test (`new Headers(...)` mock + uppercase case per Fix 6, no-throw on insert fail) → `npm run test:ci` green
- [ ] **Phase close**: delete temporary `src/server/actions/_sentry-test.ts` AND `scripts/sentry-test.ts` from plan-05 → final `npm run lint && npm run typecheck && npm run test:ci && npm run test:integration && npm run build` all green → commit phase summary

---

## Revision Log

| Date | Plans affected | Summary |
|---|---|---|
| 2026-05-24 | All 6 plans + RESEARCH.md | Initial plan checkpoint failed; 13 surgical fixes applied (Fix 1 prebuild script vs next.config.js require, Fix 2 supabase CLI key-casing matrix, Fix 3 ESLint `.tsx` globs + middleware exclude, Fix 4 reproducible ESLint API unit test, Fix 5 single memory-buffer test strategy, Fix 6 `new Headers(...)` mock, Fix 7 sync-`headers()` upgrade comment, Fix 8 concrete `npx tsx scripts/sentry-test.ts` invocation, Fix 9 migration filename rationale, Fix 10 `pino-pretty` ESLint block, Fix 11 plan-02 truly parallel via `process.env.*` direct read, Fix 12 admin-readback RLS UPDATE-deny, Fix 13 audit_log columns match skill §6 verbatim). RESEARCH.md updated with inline plan-revision NOTEs at each superseded snippet; no full regeneration. |

---

## References

- ROADMAP §Phase 1: `.planning/ROADMAP.md` lines 46–58
- Requirements: `.planning/REQUIREMENTS.md` §Phase 1 lines 215–227 (FOUND-02, 03, 04, 05, 06, 10)
- Research (primary reference): `.planning/phases/1-dev-foundations/RESEARCH.md` — copy-paste-ready snippets, version-pinned packages, 9 documented pitfalls (added Pitfall 9 for `headers()` 14→15 async transition)
  - §Standard Stack (lines 76–120) — exact version pins
  - §Pattern 1 (lines 230–328) — env-parser
  - §Pattern 2 (lines 330–436) — server-only boundary
  - §Pattern 3 (lines 438–555) — pino logger
  - §Pattern 4 (lines 557–667) — Sentry self-hosted
  - §Pattern 5 (lines 669–856) — audit_log + helper (with plan-revision NOTEs for Fix 13 column names + Fix 6 mock)
  - §Pattern 6 (lines 859–1085) — RLS test harness (with plan-revision NOTEs for Fix 2 globalSetup casing + Fix 12 canary UPDATE-deny)
  - §Common Pitfalls (lines 1114–1175 + Pitfall 9) — 9 documented gotchas
  - §Validation Architecture (lines 1247–1300) — test-map per REQ (updated for Fix 4 + Fix 8)
- Skills: `.claude/skills/{api-conventions,database,security,testing,workflow}/SKILL.md` (security §6 is the source of truth for audit_log columns per Fix 13)
- Project rules: `/CLAUDE.md`

---

*Plan created 2026-05-24. Each plan file under `plans/` is the executable unit; this file is the orchestration layer. Revised 2026-05-24 with 13 surgical fixes from plan-checker; all internal to planner authority.*
