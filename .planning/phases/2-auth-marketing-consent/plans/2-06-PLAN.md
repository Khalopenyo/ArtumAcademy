---
plan: 06-rate-limit-and-captcha-infra
phase: 2
wave: 1
type: execute
maps_to: [AUTH-09, AUTH-10, AUTH-03]
depends_on: []
autonomous: false
mode: mvp
estimated_tasks: 3
files_modified:
  - supabase/migrations/20260525000001_add_user_consents.sql
  - supabase/migrations/20260525000002_add_rate_limit_log.sql
  - src/types/database.ts
  - src/lib/rate-limit/index.ts
  - src/lib/rate-limit/index.test.ts
  - src/lib/captcha/verify.ts
  - src/lib/captcha/verify.test.ts
  - src/lib/headers/client-ip.ts
  - src/lib/audit-log.ts
  - src/lib/audit-log.test.ts
  - tests/integration/rls/user-consents.test.ts
  - tests/integration/rate-limit.test.ts
  - tests/integration/captcha.test.ts
  - package.json
user_setup:
  - service: yandex-smartcaptcha
    why: "AUTH-09 captcha widget on /register + /forgot-password forms"
    env_vars:
      - name: YANDEX_CAPTCHA_SERVER_KEY
        source: "Yandex Cloud console → SmartCaptcha → создать капчу → серверный ключ (Server Key)"
      - name: NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY
        source: "Yandex Cloud console → SmartCaptcha → создать капчу → клиентский ключ (Site Key)"
    dashboard_config:
      - task: "Create a SmartCaptcha resource with type=visible, allow domain localhost (dev) and your-dev-domain.vercel.app (preview)"
        location: "https://console.cloud.yandex.ru/folders/<folder>/smartcaptcha"
requirements: [AUTH-09, AUTH-10, AUTH-03]
must_haves:
  truths:
    - "user_consents table exists with (user_id, purpose, policy_version, ip, user_agent, accepted_at) + UNIQUE (user_id, purpose, policy_version) + immutability trigger blocks UPDATE/DELETE"
    - "rate_limit_log table exists with (key, action, attempted_at) + composite index (key, action, attempted_at DESC)"
    - "rateLimit({ key, action, windowSec, maxAttempts }) returns { ok, remaining, retryAfterSec? } and writes attempt log via admin client"
    - "verifyCaptcha(token, ip) returns { ok, reason? } and posts to https://smartcaptcha.cloud.yandex.ru/validate"
    - "Both helpers respect import 'server-only'; first line"
    - "Unit tests cover happy path + Yandex 'failed' status + network error + missing secret"
    - "Integration test for user_consents RLS: anon cannot read, user A reads own, user B cannot read user A's"
    - "Integration test for rateLimit sliding window: 5 attempts → 6th blocked → wait → unblocked"
  artifacts:
    - path: supabase/migrations/20260525000001_add_user_consents.sql
      provides: "user_consents table + consent_purpose enum + RLS (SELECT own) + immutability trigger"
    - path: supabase/migrations/20260525000002_add_rate_limit_log.sql
      provides: "rate_limit_log table + composite index + RLS (no policies — service_role only) + cleanup function"
    - path: src/lib/rate-limit/index.ts
      provides: "rateLimit({ key, action, windowSec, maxAttempts }) wrapper used by plans 07/08/09"
    - path: src/lib/captcha/verify.ts
      provides: "verifyCaptcha(token, ip) wrapper used by plans 07/09"
    - path: src/lib/headers/client-ip.ts
      provides: "getClientIp() helper extracted from next/headers — reused by rate-limit + plan-07 consent capture"
  key_links:
    - from: src/lib/rate-limit/index.ts
      to: src/lib/supabase/admin.ts
      via: createAdminClient (allowed by ESLint per P1 allowlist)
      pattern: "createAdminClient"
    - from: src/lib/captcha/verify.ts
      to: https://smartcaptcha.cloud.yandex.ru/validate
      via: fetch POST x-www-form-urlencoded
      pattern: "smartcaptcha.cloud.yandex.ru/validate"
    - from: src/lib/rate-limit/index.ts
      to: rate_limit_log table
      via: admin client insert + select count
      pattern: "rate_limit_log"
---

<objective>
Ship the two database migrations and two server-only helper modules that the auth Server Actions in plans 07/08/09 depend on. NO UI in this plan — it's pure infrastructure.

Purpose: Centralize Yandex SmartCaptcha verification and Postgres-backed rate limiting so that every auth Server Action invokes them with one line. Same plan because they share the migration concern (both create new tables + are imported together in `registerAction`), share the integration-test setup (RLS test harness), and have parallel structure (server-only helper + unit + integration test).

Output:
- 2 SQL migrations applied to local Supabase
- 2 helper modules (`src/lib/rate-limit/index.ts`, `src/lib/captcha/verify.ts`) + 1 IP helper (`src/lib/headers/client-ip.ts`)
- Unit tests for both helpers (mocked admin client, mocked fetch)
- Integration tests (RLS on `user_consents`, sliding-window correctness on `rate_limit_log`)
- ESLint allow-list updated if needed (rate-limit + captcha live in `src/lib/` — already permitted to import admin per P1 if listed in `no-restricted-imports.allow`)
- `@yandex/smart-captcha@^2.9.1` installed AFTER human-verify checkpoint
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/2-auth-marketing-consent/PLAN.md
@.planning/phases/2-auth-marketing-consent/RESEARCH.md
@.planning/REQUIREMENTS.md
@.planning/phases/1-dev-foundations/VERIFICATION.md
@.claude/skills/database/SKILL.md
@.claude/skills/security/SKILL.md
@.claude/skills/testing/SKILL.md
@src/lib/audit-log.ts
@src/lib/logger.ts
@src/env.ts
@.eslintrc.json
</context>

<interfaces>
<!-- From P1 (already shipped — DO NOT recreate; reuse). -->

From src/lib/supabase/admin.ts (P1 — first line is `import 'server-only';`):
```typescript
// Located at src/lib/supabase/admin.ts (process.env directly, NOT via env.ts to avoid circular)
export function createAdminClient(): SupabaseClient;
// Returns a service_role client. Bypasses RLS. ESLint blocks import from client paths.
// Allow-list (.eslintrc.json overrides for no-restricted-imports):
//   - src/lib/audit-log.ts
//   - src/server/**/*.{ts,tsx}
//   - src/app/api/**/*.{ts,tsx}
//   - src/instrumentation.ts
//   - sentry.*.config.{ts,tsx}
```

From src/lib/audit-log.ts (P1 — reference pattern for `next/headers` IP capture + admin client write):
```typescript
// Already extracts IP from X-Forwarded-For (case-insensitive) + falls back to X-Real-IP + null
// Inserts via createAdminClient
// Try/catches inserts and NEVER throws (logs via pino on failure)
// `getClientIp()` is INTERNAL to audit-log.ts — plan-06 extracts it to src/lib/headers/client-ip.ts so rate-limit + plan-07 can reuse
```

From src/lib/logger.ts (P1):
```typescript
export const logger: Logger; // pino singleton with redact paths for sensitive fields
```

From src/env.ts (P1 — YANDEX_CAPTCHA_* slots already declared optional):
```typescript
// server.YANDEX_CAPTCHA_SERVER_KEY: z.string().min(1).optional()
// client.NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY: z.string().min(1).optional()
// In plan-06: keep these OPTIONAL (so dev without captcha keys can boot the app);
// only plan-07's registerAction throws at runtime if YANDEX_CAPTCHA_SERVER_KEY is missing.
```

From P1 .eslintrc.json `no-restricted-imports` overrides:
```
// `src/lib/**/*.ts` is NOT in the allow-list by default.
// rate-limit + captcha need to import admin.ts; either:
//   a) add `src/lib/rate-limit/**` and `src/lib/captcha/**` to overrides allow-list, OR
//   b) put rate-limit + captcha wrappers under `src/server/**`
// PLANNER DECISION: option (a) — add allow-list entries. They are server-only library code that the security skill explicitly places in `src/lib/`.
```

From RLS test harness (P1):
```
tests/integration/globalSetup.ts — starts Supabase if not running + db reset
tests/integration/helpers/test-clients.ts — makeAdminClient() + makeUserClient(token)
tests/integration/helpers/test-users.ts — createTestUser(suffix) + deleteTestUser(userId)
vitest.integration.config.ts — environment: 'node', singleThread, generous timeouts
```
</interfaces>

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <what-built>
About to install `@yandex/smart-captcha@^2.9.1` via npm. Per RESEARCH §Package Legitimacy Audit, this package is tagged [ASSUMED] — slopcheck was unavailable in research and so the planner inserts this blocking checkpoint per the package-legitimacy protocol.

Reference cross-checks (recorded by researcher):
- npm registry: 22 versions, latest 2 months ago
- Maintainers: `yandex-bot@yandex-team.ru`, `yandex-metrica-watch@yandex-team.ru` (official Yandex npm scope)
- Yandex Cloud's own React docs page references this exact package: `https://yandex.cloud/en/docs/smartcaptcha/concepts/react` with documented install command `npm i -PE @yandex/smart-captcha`

This checkpoint covers ONLY `@yandex/smart-captcha@^2.9.1`. The shadcn primitive Radix packages (`@radix-ui/react-accordion`, `@radix-ui/react-checkbox`) are plan-01's exclusive concern (installed via `npx shadcn@latest add accordion checkbox` in plan-01 Task 1) and DO NOT require a slopcheck — they are direct extensions of the already-installed Radix family from P1 (`@radix-ui/react-dialog`, `@radix-ui/react-label`, etc.), all under the official Radix maintainer scope. No need to re-verify them here.
  </what-built>
  <how-to-verify>
1. Open https://www.npmjs.com/package/@yandex/smart-captcha in a browser
2. Confirm: latest published 2-3 months ago, maintainer list contains `yandex-bot@yandex-team.ru`
3. Confirm: link to official Yandex docs in README points to `yandex.cloud/.../smartcaptcha`
4. (Optional) Open https://yandex.cloud/en/docs/smartcaptcha/concepts/react and confirm the page references `@yandex/smart-captcha`

Type «approved» to proceed with `npm install @yandex/smart-captcha@^2.9.1`, or describe concerns to halt.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

<task type="auto">
  <name>Task 1: SQL migrations for user_consents + rate_limit_log + hand-patch database types</name>
  <files>supabase/migrations/20260525000001_add_user_consents.sql, supabase/migrations/20260525000002_add_rate_limit_log.sql, src/types/database.ts</files>
  <action>
1. Create `supabase/migrations/20260525000001_add_user_consents.sql` — use the EXACT SQL from RESEARCH §Migrations §user_consents (lines 904-947) verbatim. Summary of what it creates:
- `consent_purpose` enum: `'pdn_processing'`, `'oferta'`
- `user_consents` table with all 5 mandatory columns + id + UNIQUE (user_id, purpose, policy_version)
- 2 indexes (user+purpose, purpose+version)
- RLS enabled
- SELECT policy: «Users read own consents» — `(select auth.uid()) = user_id` (per Pitfall #11 — use subquery form for scale)
- NO INSERT/UPDATE/DELETE policies — only service_role writes (anon/authenticated denied by default)
- Immutability trigger `user_consents_no_update` blocking UPDATE OR DELETE even from service_role (raises `'user_consents is append-only'`)

2. Create `supabase/migrations/20260525000002_add_rate_limit_log.sql` — use EXACT SQL from RESEARCH §Migrations §rate_limit_log (lines 952-979). Summary:
- `rate_limit_log` table: id bigserial PRIMARY KEY, key text, action text, attempted_at timestamptz DEFAULT now()
- Composite index `idx_rate_limit_log_key_action_time` on `(key, action, attempted_at DESC)` — partial-index for hot-path query
- RLS enabled, NO policies (service_role only)
- `rate_limit_log_cleanup()` plpgsql function for pg_cron daily cleanup (NOT scheduled in P2 — that's P6 OPS)
- COMMENT ON TABLE documenting cleanup expectation

3. Apply both migrations to local Supabase (Docker required — if absent, skip and document per P1 pattern):
```bash
npm run db:migrate
```

4. Regenerate database types:
```bash
npm run db:types
```
This populates `src/types/database.ts` with `Database['public']['Tables']['user_consents']` and `Database['public']['Tables']['rate_limit_log']` types.

5. **Docker fallback (per P1 plan-04 SUMMARY pattern):** if Docker is absent on the ship machine, manually patch `src/types/database.ts` to add the two new tables under `Database.public.Tables` with `Row`, `Insert`, `Update` interfaces matching the migration columns. The diff vs `npm run db:types` output will be empty when next developer with Docker regenerates. Document this fallback in the plan SUMMARY.

6. Verify migration files include all expected DDL with `grep`:
```bash
grep -c "CREATE TABLE.*user_consents\|CREATE TYPE consent_purpose\|user_consents_no_update" supabase/migrations/20260525000001_add_user_consents.sql
grep -c "CREATE TABLE.*rate_limit_log\|rate_limit_log_cleanup\|idx_rate_limit_log_key_action_time" supabase/migrations/20260525000002_add_rate_limit_log.sql
```
  </action>
  <verify>
    <automated>ls supabase/migrations/20260525000001_add_user_consents.sql supabase/migrations/20260525000002_add_rate_limit_log.sql && grep -q "consent_purpose" supabase/migrations/20260525000001_add_user_consents.sql && grep -q "user_consents_no_update" supabase/migrations/20260525000001_add_user_consents.sql && grep -q "rate_limit_log_cleanup" supabase/migrations/20260525000002_add_rate_limit_log.sql && grep -q "user_consents" src/types/database.ts && grep -q "rate_limit_log" src/types/database.ts</automated>
  </verify>
  <done>Both migrations exist and contain the documented DDL; src/types/database.ts mentions both new tables (either regenerated or hand-patched per fallback); npm run typecheck still clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: client-ip helper + rateLimit + verifyCaptcha + unit tests + ESLint allow-list update</name>
  <files>src/lib/headers/client-ip.ts, src/lib/rate-limit/index.ts, src/lib/rate-limit/index.test.ts, src/lib/captcha/verify.ts, src/lib/captcha/verify.test.ts, .eslintrc.json, package.json</files>
  <behavior>
    - getClientIp(): reads x-forwarded-for case-insensitively from next/headers; returns first hop; falls back to x-real-ip; falls back to null
    - rateLimit happy path: count < max → insert attempt → returns ok=true, remaining=max-used-1
    - rateLimit blocks at max: count >= max → returns ok=false, retryAfterSec=windowSec; does NOT insert
    - rateLimit fails open on DB error: returns ok=true, remaining=max (logged via pino)
    - verifyCaptcha happy path: Yandex returns { status: 'ok' } → ok=true
    - verifyCaptcha invalid token: Yandex returns { status: 'failed', message: '...' } → ok=false, reason='invalid'
    - verifyCaptcha network error: fetch throws → ok=false, reason='network'
    - verifyCaptcha missing secret: YANDEX_CAPTCHA_SERVER_KEY absent → ok=false, reason='server_misconfig' (logged via pino)
    - All three modules begin with `import 'server-only';` on the FIRST line
  </behavior>
  <action>
1. **Install `@yandex/smart-captcha` (gated by the human-verify checkpoint above):**
```bash
npm install @yandex/smart-captcha@^2.9.1
```
This will be imported by plan-07's `SmartCaptchaWidget.tsx` (client component); plan-06 only needs the server-side verify helper, so the import is plan-07's concern. We install in plan-06 to centralize package additions.

2. **Update `.eslintrc.json`** — add `src/lib/rate-limit/**/*.ts` and `src/lib/captcha/**/*.ts` to the `no-restricted-imports.overrides` allow-list for `@/lib/supabase/admin` (model after the existing entry for `src/lib/audit-log.ts`). Without this, the rate-limit module's `createAdminClient` import would error.

3. **Create `src/lib/headers/client-ip.ts`:**
```typescript
import 'server-only';
import { headers } from 'next/headers';

/**
 * Extract client IP from request headers (Vercel always proxies — true client IP is in X-Forwarded-For).
 *
 * Header lookup is case-insensitive (Node's Headers class normalizes to lowercase, but documentation
 * note from P1's audit-log helper: some code paths historically passed uppercase; rely on Headers.get
 * which is case-insensitive).
 *
 * Returns: first IP from XFF chain → x-real-ip fallback → null.
 *
 * MUST be called inside a Server Action / Server Component / Route Handler context
 * (next/headers throws elsewhere).
 */
export function getClientIp(): string | null {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff && xff.trim().length > 0) {
    return xff.split(',')[0]!.trim();
  }
  const xri = h.get('x-real-ip');
  if (xri && xri.trim().length > 0) {
    return xri.trim();
  }
  return null;
}
```

**3a. Refactor `src/lib/audit-log.ts` to import `getClientIp` (and drop its inline implementation).**

P1's `auditLog()` currently inlines the X-Forwarded-For parser (see `src/lib/audit-log.ts` lines 77-83 — same pattern this plan extracts into `getClientIp`). With the helper now shared, the inline copy is duplicate logic. Refactor:

- Add the import `import { getClientIp } from '@/lib/headers/client-ip';` at the top of `src/lib/audit-log.ts`
- Inside `auditLog()`, REPLACE the inline IP extraction block:
```typescript
// REMOVE:
const ipAddress =
  hs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
  hs.get('x-real-ip') ??
  null;
// ADD (single call, semantically equivalent):
const ipAddress = getClientIp();
```
- KEEP everything else: the `headers()` call (for `user-agent` extraction one line below), all try/catch, all logger calls, the unchanged `auditLogContextless` variant
- DO NOT touch `auditLogContextless` (it explicitly takes `ipAddress` as a parameter — no `next/headers` dependency)
- Run `npm run test:ci -- audit-log` — P1's existing audit-log tests must still pass (they assert IP extraction from x-forwarded-for and x-real-ip; getClientIp preserves that behavior verbatim)

If P1's audit-log.test.ts mocks were tightly coupled to the inline implementation (e.g., they assert specific intermediate calls), update the mocks to mock `@/lib/headers/client-ip` instead of relying on `headers()` inside audit-log.ts for the IP portion. The user-agent assertion still flows through `headers().get('user-agent')` in audit-log.ts directly.

4. **Create `src/lib/rate-limit/index.ts`** — use the EXACT pattern from RESEARCH §Pattern 7 (lines 696-749) with minor cleanups:
```typescript
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface RateLimitArgs {
  key: string;
  action: string;
  windowSec: number;
  maxAttempts: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec?: number;
}

export async function rateLimit(args: RateLimitArgs): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - args.windowSec * 1000).toISOString();

  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', args.key)
    .eq('action', args.action)
    .gte('attempted_at', cutoff);

  if (error) {
    logger.error({ err: error, args }, 'rate_limit count failed; failing open');
    return { ok: true, remaining: args.maxAttempts };
  }

  const used = count ?? 0;
  if (used >= args.maxAttempts) {
    return { ok: false, remaining: 0, retryAfterSec: args.windowSec };
  }

  const { error: insertError } = await supabase.from('rate_limit_log').insert({
    key: args.key,
    action: args.action,
    attempted_at: new Date().toISOString(),
  });
  if (insertError) {
    logger.error({ err: insertError, args }, 'rate_limit insert failed');
  }

  return { ok: true, remaining: args.maxAttempts - used - 1 };
}
```

5. **Create `src/lib/captcha/verify.ts`** — use EXACT pattern from RESEARCH §Pattern 6 (lines 651-693):
```typescript
import 'server-only';
import { logger } from '@/lib/logger';

const VALIDATE_URL = 'https://smartcaptcha.cloud.yandex.ru/validate';

export interface CaptchaResult {
  ok: boolean;
  reason?: 'invalid' | 'expired' | 'network' | 'server_misconfig';
}

export async function verifyCaptcha(token: string, ip: string | null): Promise<CaptchaResult> {
  const secret = process.env.YANDEX_CAPTCHA_SERVER_KEY;
  if (!secret) {
    logger.error('YANDEX_CAPTCHA_SERVER_KEY missing');
    return { ok: false, reason: 'server_misconfig' };
  }

  const body = new URLSearchParams({ secret, token });
  if (ip) body.append('ip', ip);

  try {
    const res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'captcha validate HTTP error');
      // STRICT in P2 dev — block submission. Production graceful degradation per Yandex docs
      // (treat HTTP error as ok) is a P7 decision once we have monitoring.
      return { ok: false, reason: 'network' };
    }
    const json = (await res.json()) as { status: 'ok' | 'failed'; message?: string };
    if (json.status === 'ok') return { ok: true };
    logger.warn({ message: json.message }, 'captcha rejected by Yandex');
    return { ok: false, reason: 'invalid' };
  } catch (err) {
    logger.error({ err }, 'captcha validate threw');
    return { ok: false, reason: 'network' };
  }
}
```

6. **Unit tests** — write Vitest tests in jsdom environment (not Node, since they're under `src/`):

`src/lib/rate-limit/index.test.ts` — mock `@/lib/supabase/admin` with `vi.mock`. Mock `createAdminClient` to return an object whose `.from('rate_limit_log').select(...).eq(...).eq(...).gte(...)` returns `{ count: 3, error: null }`, etc. Test 4 cases:
- happy path: count=2, max=5 → ok=true, remaining=2
- blocked: count=5, max=5 → ok=false, retryAfterSec=900
- fails open on DB error: select returns `{ count: null, error: { message: 'boom' } }` → ok=true, remaining=max
- insert error is non-fatal: select OK, insert returns error → still ok=true (logged but not propagated)

`src/lib/captcha/verify.test.ts` — use `vi.stubGlobal('fetch', vi.fn())` to mock fetch. Test 4 cases:
- happy path: secret set, fetch resolves with `{ status: 'ok' }` → ok=true
- Yandex rejects: fetch resolves with `{ status: 'failed', message: 'token expired' }` → ok=false, reason='invalid'
- network error: fetch throws → ok=false, reason='network'
- HTTP error: fetch resolves with `res.ok=false` → ok=false, reason='network'
- missing secret: `delete process.env.YANDEX_CAPTCHA_SERVER_KEY` (use `vi.stubEnv`) → ok=false, reason='server_misconfig'

Test files use `describe`/`it` in Russian (project convention from testing/SKILL.md).
  </action>
  <verify>
    <automated>npm run lint && npm run typecheck && npm run test:ci -- src/lib/rate-limit src/lib/captcha src/lib/headers</automated>
  </verify>
  <done>3 new server-only modules exist (client-ip.ts, rate-limit/index.ts, captcha/verify.ts) each with `import 'server-only';` on line 1; ESLint allow-list updated to include rate-limit + captcha paths; @yandex/smart-captcha installed in package.json; 2 unit test files (4+ cases each) pass; npm run lint + typecheck + test:ci all clean.</done>
</task>

<task type="auto">
  <name>Task 3: Integration tests — user_consents RLS + rate_limit sliding window</name>
  <files>tests/integration/rls/user-consents.test.ts, tests/integration/rate-limit.test.ts, tests/integration/captcha.test.ts</files>
  <action>
Use the existing RLS harness (P1 `tests/integration/globalSetup.ts` + `helpers/test-clients.ts` + `helpers/test-users.ts`). All three tests run against local Supabase (Docker required — deferred if absent per P1 pattern).

1. **`tests/integration/rls/user-consents.test.ts`** — extend the canonical 2-user RLS pattern from P1 `profiles.test.ts`:
   - Setup: create User A + User B via `createTestUser` helper
   - Insert one consent row for User A via admin client (`purpose='pdn_processing', policy_version='1.0-draft', ip='127.0.0.1', user_agent='test'`)
   - **Test 1 (positive control):** User A can SELECT own row — `expect(data).toHaveLength(1)` and asserts `purpose, policy_version, ip, user_agent` match
   - **Test 2 (cross-user denial):** User B with their own access token cannot read User A's row — `expect(data ?? []).toEqual([])`
   - **Test 3 (anon denial):** Anon client (no token) cannot read any row — `expect(data ?? []).toEqual([])`
   - **Test 4 (insert denied to authed user):** User A trying to `.from('user_consents').insert(...)` returns an RLS error (no INSERT policy granted) — `expect(error).toBeTruthy()`
   - **Test 5 (immutability trigger):** Admin client tries to UPDATE existing row → error `'user_consents is append-only'`. Admin client tries to DELETE → same error.
   - Cleanup via `deleteTestUser` in `afterAll`

2. **`tests/integration/rate-limit.test.ts`** — exercises sliding window correctness:
   - Setup: pick a synthetic key like `'test:127.0.0.1'` and action `'auth.test'`; clean any existing rows for that key via admin client `beforeEach`
   - **Test 1:** 5 sequential calls to `rateLimit({ key, action, windowSec: 900, maxAttempts: 5 })` — first 5 return ok=true with decreasing remaining; 6th returns ok=false with retryAfterSec=900
   - **Test 2:** sliding window — manually insert a row with `attempted_at = NOW() - INTERVAL '1000 seconds'` (older than window); count of recent attempts = 0; new call returns ok=true
   - **Test 3:** different key isolation — `'test:other-ip'` with same action returns ok=true even if first key is exhausted
   - **Test 4:** different action isolation — same key + different action returns ok=true

3. **`tests/integration/captcha.test.ts`** — exercises the server verify against Yandex's test mode (skipped if no test sitekey present):
   - Use Yandex's documented test sitekey + serverkey pair (per `https://yandex.cloud/en/docs/smartcaptcha/operations/validate-captcha` — there's a documented "always-ok" pair for CI)
   - If `process.env.YANDEX_CAPTCHA_SERVER_KEY === '<test-mode-key>'`, run live request; otherwise SKIP with `it.skip` and log a hint
   - **Test (when not skipped):** `verifyCaptcha('<documented-test-token-or-blank>', '127.0.0.1')` returns `{ ok: true }`
   - **Test (always):** `verifyCaptcha('obviously-bogus-token', null)` returns ok=false with reason='invalid' OR 'network' depending on whether the server is reachable

If integration tests cannot run locally (Docker absent), document in SUMMARY per P1 pattern (test files structurally correct, runtime deferred).
  </action>
  <verify>
    <automated>npm run lint && ls tests/integration/rls/user-consents.test.ts tests/integration/rate-limit.test.ts tests/integration/captcha.test.ts</automated>
  </verify>
  <done>3 integration test files exist with the cases described; npm run lint clean; npm run test:integration runs them (skipped if Docker absent — per P1 pattern); structural correctness verified.</done>
</task>

</tasks>

<verification>
After all 3 tasks:
1. `npm run lint && npm run typecheck && npm run test:ci` — must pass (unit tests for rate-limit + captcha verified)
2. `grep -c "import 'server-only'" src/lib/rate-limit/index.ts src/lib/captcha/verify.ts src/lib/headers/client-ip.ts` — must return 1 per file
3. `head -1 src/lib/rate-limit/index.ts` — must be `import 'server-only';`
4. Both migration files present + types regenerated/patched
5. `@yandex/smart-captcha` in `package.json` dependencies
6. ESLint allow-list updated (try writing `import { createAdminClient } from '@/lib/supabase/admin';` in `src/lib/rate-limit/index.ts` — should NOT trigger no-restricted-imports)
7. If Docker available: `npm run test:integration -- tests/integration/rls/user-consents.test.ts tests/integration/rate-limit.test.ts` passes
</verification>

<success_criteria>
- AUTH-09 (infra): `verifyCaptcha(token, ip)` is a stable, server-only helper that plans 07/09 import in 1 line
- AUTH-10 (infra): `rateLimit({ key, action, windowSec, maxAttempts })` is a stable, server-only helper that plans 07/08/09 invoke at the top of their Server Actions
- AUTH-03 (schema): `user_consents` table exists with all required columns + RLS + immutability trigger; plan-07 only needs to call admin client `.insert(...)` to satisfy the requirement
- `getClientIp()` extracted from audit-log into shared `src/lib/headers/client-ip.ts` for reuse
- All 3 server helpers begin with `import 'server-only';` (Pitfall #21 mitigation)
- Unit tests cover happy path + DB error fail-open + network error + missing secret
- Integration tests exist for RLS cross-user denial + sliding window + immutability trigger
- `@yandex/smart-captcha` install gated by blocking human-verify checkpoint (slopcheck protocol)
</success_criteria>

<out_of_scope>
- Forms that USE captcha — plan-07 (register) + plan-09 (forgot-password)
- Auth Server Actions that USE rate limit — plans 07, 08, 09
- pg_cron schedule for `rate_limit_log_cleanup()` — P6 ops phase
- Distributed rate limiting (Upstash) — RESEARCH §STACK explicitly chose Postgres-only due to RU connectivity uncertainty
- Captcha visibility/UX choices — UI-SPEC §10.3 already locked to "visible" widget
- Production captcha keys — solo dev creates in Yandex Cloud console before plan-07 (the human-verify checkpoint above doubles as the kickoff)
</out_of_scope>

<references>
- RESEARCH.md §Migrations §user_consents (lines 904-947), §rate_limit_log (lines 952-979)
- RESEARCH.md §Pattern 6 (verifyCaptcha — lines 651-693), §Pattern 7 (rateLimit — lines 696-749)
- RESEARCH.md §Package Legitimacy Audit + §Planner guidance (lines 167-179)
- REQUIREMENTS.md AUTH-09, AUTH-10, AUTH-03
- database/SKILL.md §Миграции, §Row-Level Security
- security/SKILL.md §3 (Rate Limiting), §5 (Капча), §7 (152-ФЗ — consent capture context)
- testing/SKILL.md §3 (Integration tests — RLS pattern)
- P1 VERIFICATION.md §Success Criterion 4 (RLS harness shape) + plan-04 SUMMARY (audit-log helper pattern + hand-patch fallback for types)
</references>

<output>
Create `.planning/phases/2-auth-marketing-consent/plans/2-06-SUMMARY.md` when done documenting:
- 2 migrations applied (user_consents + rate_limit_log)
- src/types/database.ts regenerated OR hand-patched (note which)
- 3 server-only helpers (getClientIp, rateLimit, verifyCaptcha) with unit tests
- ESLint allow-list updated for rate-limit + captcha paths
- @yandex/smart-captcha installed (after human-verify checkpoint approval recorded)
- Integration tests structurally correct; runtime deferred if Docker absent (P1 pattern)
- Yandex SmartCaptcha sitekey creation: deferred to plan-07 kickoff (solo dev creates in Yandex Cloud console)
</output>
