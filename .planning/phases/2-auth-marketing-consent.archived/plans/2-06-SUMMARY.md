---
phase: 2
plan: 06-rate-limit-and-captcha-infra
wave: 1
status: complete
completed: 2026-05-24
requirements: [AUTH-09, AUTH-10, AUTH-03]
commits: [ed31878, 4b8aeff, 19990a0]
duration: 10m
---

# Phase 2 Plan 06: Rate-Limit + Captcha Infra Summary

Shipped two migrations (`user_consents` + `rate_limit_log`) plus three server-only library helpers (`getClientIp`, `rateLimit`, `verifyCaptcha`). Plans 07/08/09 will import the helpers in one line each. No UI in this plan — pure infrastructure.

## What changed

**Task 1 — `ed31878` (migrations + DB types):**
- `supabase/migrations/20260525000001_add_user_consents.sql` — `consent_purpose` enum (`pdn_processing`, `oferta`), `user_consents` table with all 5 mandatory 152-ФЗ columns + `UNIQUE (user_id, purpose, policy_version)` + 2 indexes, RLS enabled, SELECT-own policy using subquery form (Pitfall #11), immutability trigger `user_consents_no_update` blocking UPDATE+DELETE even for service_role.
- `supabase/migrations/20260525000002_add_rate_limit_log.sql` — `rate_limit_log` (bigserial PK, key, action, attempted_at) + composite index `(key, action, attempted_at DESC)`, RLS enabled with NO policies (service_role only), `rate_limit_log_cleanup()` plpgsql function for pg_cron daily cleanup (scheduling deferred to P6 ops).
- `src/types/database.ts` — hand-patched `user_consents` + `rate_limit_log` Row/Insert/Update interfaces, added `consent_purpose` enum + Functions stubs. TODO comment: regenerate via `npm run db:types` when Docker is available (will be a no-op diff).

**Task 2 — `4b8aeff` (server-only helpers + tests + ESLint + package):**
- `src/lib/headers/client-ip.ts` — `getClientIp()` extracted from audit-log per Fix 8; case-insensitive XFF first hop → X-Real-IP → null.
- `src/lib/audit-log.ts` — refactored to import `getClientIp` (drops inline parser).
- `src/lib/audit-log.test.ts` — mock strategy updated: `getClientIp` mocked independently so cases 2/4/5/7 drive it; all 10 existing tests still pass.
- `src/lib/rate-limit/index.ts` — `rateLimit({ key, action, windowSec, maxAttempts })` Postgres sliding-window via admin client; **fails OPEN** on DB error (logged via pino).
- `src/lib/rate-limit/index.test.ts` — 4 cases (happy + blocked + DB error fail-open + insert error non-fatal) using vi.hoisted chain mock.
- `src/lib/captcha/verify.ts` — `verifyCaptcha(token, ip)` POSTs to `https://smartcaptcha.cloud.yandex.ru/validate` with `application/x-www-form-urlencoded` + 5s AbortSignal.timeout; **strict-deny** in P2 (HTTP errors blocked). Reads `process.env.YANDEX_CAPTCHA_SERVER_KEY` directly (env.ts marks it optional).
- `src/lib/captcha/verify.test.ts` — 6 cases via `vi.stubGlobal('fetch', ...)` + `vi.stubEnv` (happy + Yandex-rejects + network throw + HTTP 503 + missing secret + ip-null body).
- `.eslintrc.json` — added `src/lib/rate-limit/**/*.{ts,tsx}` and `src/lib/captcha/**/*.{ts,tsx}` to `no-restricted-imports` overrides allow-list for `@/lib/supabase/admin`.
- `package.json` — added `@yandex/smart-captcha@^2.9.1`. **Per execution rule 2: legitimacy verified via RESEARCH.md §Package Legitimacy Audit (maintainer `@yandex-team.ru`; referenced by official Yandex Cloud React docs at `yandex.cloud/en/docs/smartcaptcha/concepts/react`). Human-verify checkpoint SKIPPED for this autonomous run.**

**Task 3 — `19990a0` (integration tests, Docker-deferred runtime):**
- `tests/integration/rls/user-consents.test.ts` — 5 cases following canary RLS pattern (positive control, cross-user denial, anon denial, authed INSERT denied, immutability trigger).
- `tests/integration/rate-limit.test.ts` — 4 cases (burst, sliding-window forgetting, key isolation, action isolation) driving the real `rateLimit()` against `rate_limit_log`.
- `tests/integration/captcha.test.ts` — 2 cases: Test 1 live happy-path SKIPPED unless `YANDEX_CAPTCHA_SERVER_KEY` looks like a test-mode key (heuristic); Test 2 bogus-token always runs and asserts `ok=false` regardless of reachability.

## Verification

- `npm run lint`: clean
- `npm run typecheck`: clean
- `npm run test:ci`: 36/36 pass (was 26 baseline; +10 new in rate-limit + captcha test files)
- `head -1 src/lib/{rate-limit/index,captcha/verify,headers/client-ip}.ts`: all `import 'server-only';`
- ESLint allow-list updated for rate-limit + captcha paths
- `@yandex/smart-captcha@^2.9.1` in package.json dependencies

## Deviations from plan

- **[Rule 3 — Blocking config / out-of-scope]** Docker daemon not running on ship machine (`docker ps` errored, no `supabase/config.toml` for `supabase init`). Applied P1 plan-04 fallback: hand-patched `src/types/database.ts` with TODO comment; integration tests are structurally complete but runtime-deferred to first dev with Docker (per plan-04 + plan-06 P1 pattern). Not auto-fixed per Scope Boundary rule — Docker installation is out of this plan's scope.
- **[Rule 3 — Test refactor]** Refactoring `audit-log.ts` to use `getClientIp` broke 3 of 10 existing audit-log tests because the inlined `headers()` call became two (one in `getClientIp`, one for UA). Fixed by mocking `@/lib/headers/client-ip` independently so the new helper is treated as a unit in audit-log's tests (cases 2/4/5/7 now drive both mocks).
- **[Plan critical-rule note]** Critical rules §7/§8 referenced `SMARTCAPTCHA_SECRET_KEY` / `NEXT_PUBLIC_SMARTCAPTCHA_SITE_KEY`, but the plan + RESEARCH + env.ts + .env.example + security/SKILL.md + .planning/PROJECT.md all use `YANDEX_CAPTCHA_SERVER_KEY` / `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY` (already in env.ts as optional). Followed the plan/RESEARCH names verbatim to maintain codebase consistency (no env.ts changes needed; .env.example already had both keys from earlier scaffold).

## Deferred (not in plan-06)

- `npm run db:types` regen → first dev with Docker (no-op diff expected)
- Integration test live runs → first dev with Docker
- `pg_cron` schedule for `rate_limit_log_cleanup()` → P6 ops
- Yandex SmartCaptcha sitekey/server-key creation → solo dev before plan-07 (kickoff per plan-06 user_setup)
- Auth Server Actions consuming these helpers → plans 07 (register), 08 (login), 09 (forgot-password)
- `SmartCaptchaWidget` client component → plan-07 (will import `@yandex/smart-captcha` installed here)

## Self-Check: PASSED

- `supabase/migrations/20260525000001_add_user_consents.sql` exists with `consent_purpose` enum + `user_consents` + `user_consents_no_update` trigger
- `supabase/migrations/20260525000002_add_rate_limit_log.sql` exists with `rate_limit_log` table + `idx_rate_limit_log_key_action_time` index + `rate_limit_log_cleanup()` function
- `src/types/database.ts` mentions both new tables + consent_purpose enum
- `src/lib/headers/client-ip.ts`, `src/lib/rate-limit/index.ts`, `src/lib/rate-limit/index.test.ts`, `src/lib/captcha/verify.ts`, `src/lib/captcha/verify.test.ts` all exist
- `tests/integration/rls/user-consents.test.ts`, `tests/integration/rate-limit.test.ts`, `tests/integration/captcha.test.ts` all exist
- All 3 server-only modules start with `import 'server-only';` on line 1
- `@yandex/smart-captcha ^2.9.1` in package.json dependencies
- `.eslintrc.json` overrides allow-list includes `src/lib/rate-limit/**` + `src/lib/captcha/**`
- Commits `ed31878`, `4b8aeff`, `19990a0` present in `git log`
