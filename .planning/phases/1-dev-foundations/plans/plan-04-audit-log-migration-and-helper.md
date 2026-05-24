---
plan_id: 04
phase: 1-dev-foundations
title: audit_log Postgres table + auditLog() helper with IP/UA capture
maps_to_req: FOUND-05
depends_on: [plan-01, plan-02, plan-03]
wave: 3
files_created:
  - supabase/migrations/20260524000001_add_audit_log.sql
  - src/lib/audit-log.ts
  - src/lib/audit-log.test.ts
files_modified: []
---

# Plan 04 — `audit_log` Migration + `auditLog()` Helper (FOUND-05)

## Goal

Append-only Postgres table `audit_log` for finance/access/compliance events. RLS denies all non-service-role reads/writes. UPDATE/DELETE blocked by trigger even for service_role (defense against accidental tampering). Helper `auditLog()` captures IP and User-Agent from `next/headers()`, inserts via the admin client, NEVER throws (logs via pino + Sentry-capture but does not abort the calling business flow).

## Why now

- Wave 3 — last in the dependency chain. Needs:
  - **plan-01** for `env.SUPABASE_*` (although `admin.ts` reads `process.env.*` directly per Fix 11, the helper's other code paths still benefit from `env.*` and the prebuild safety net).
  - **plan-02** for `createAdminClient()` (the only file allowed to use service_role).
  - **plan-03** for `logger.error(...)` on failure path.
- Migration uses forward-only idempotent style per `.claude/skills/database/SKILL.md`.

## Files

### Created

| Path | Purpose | Reference |
|---|---|---|
| `supabase/migrations/20260524000001_add_audit_log.sql` | Table + indexes + RLS + UPDATE/DELETE blocking trigger. **Column names match `.claude/skills/security/SKILL.md` §6 verbatim** (`user_id, action, entity_type, entity_id, meta, ip_address, created_at`) per Fix 13 option (a). | RESEARCH.md §Pattern 5 lines 677–727 (adapted to skill column names) |
| `src/lib/audit-log.ts` | Exports `auditLog(input)` (request-context, captures IP+UA via `headers()`) and `auditLogContextless(input + ipAddress + userAgent)` (cron/worker variant) | RESEARCH.md §Pattern 5 lines 733–815 (adapted to skill column names) |
| `src/lib/audit-log.test.ts` | Vitest unit tests with mocked `next/headers` + mocked admin client; assert IP capture from `x-forwarded-for` first hop with case-insensitive header access; assert helper does NOT throw on insert error | RESEARCH.md §Pattern 5 lines 820–855 (adapted per Fix 6 + Fix 13) |

### Modified

None. (Note: `src/types/database.ts` will be regenerated via `npm run db:types` after migration applies, but this is a build artifact tracked separately — list explicitly in the task below.)

## Dependencies

**Blocks-on:**
- plan-01 — `env.SUPABASE_*` runtime guarantee (not a direct import in admin.ts per Fix 11, but plan-01's `prebuild` and `instrumentation.ts` ensure `process.env.SUPABASE_*` is populated/validated before admin.ts ever runs).
- plan-02 — `createAdminClient()` from `src/lib/supabase/admin.ts`.
- plan-03 — `logger` from `src/lib/logger.ts`.

**Blocks:** Future plans in P3/P4 (payment Server Actions, webhook handler) will call `auditLog()`. No P1 plans block on plan-04.

## Implementation Steps (atomic commits)

### Task 1: Create migration file

- Filename: `supabase/migrations/20260524000001_add_audit_log.sql`.

  **Filename rationale (Fix 9)**: The form is `YYYYMMDD000001` (date `20260524` + 6-digit pseudo-sequence `000001`), NOT the full `YYYYMMDDHHMMSS` convention specified in `.claude/skills/database/SKILL.md` line 18. This is a **deliberate one-time exception** chosen to keep Phase 1's audit_log migration legibly grouped with the base scaffold migration (`20260522000001_init_base_tables.sql`, also `YYYYMMDD000001` form) — both are foundational and benefit from human-scannable ordering during the dev-foundations phase. **All P2+ migrations MUST use the skill's full `date -u +%Y%m%d%H%M%S` convention** to avoid timestamp collisions when multiple migrations land on the same day. This rationale is recorded here so future readers don't propagate the exception.

- Copy verbatim from RESEARCH.md §Pattern 5 lines 677–727, **with column names changed to match `.claude/skills/security/SKILL.md` §6 verbatim** (Fix 13 option a — chosen because the skill is the source of truth and audit_log is referenced by many features; renaming columns later is more expensive than aligning now).

  **Column-name reconciliation (Fix 13)**:

  | Earlier draft (this plan) | Final (per skill §6) | Notes |
  |---|---|---|
  | `entity` | `entity_type` | text |
  | `payload` | `meta` | jsonb |
  | `ip` | `ip_address` | inet |
  | `user_agent` | `user_agent` | text — **kept**; not in the skill table but listed in the skill body ("Логировать ... IP, timestamp" + "User-Agent" implied by request context). Adding `user_agent` is a non-conflicting addition; the skill table can be updated in a non-blocking docs follow-up. |
  | `entity_id` (text) | `entity_id` (uuid in skill) | **Kept as `text` here**, NOT uuid. Justification: ЮKassa payment_id and Kinescope external IDs are non-UUID strings. The skill's `uuid` type is too narrow; this is a documented divergence — see "Open follow-up" below. |

  **Open follow-up (non-blocking)**: a future doc-only task (suggested for P2 housekeeping) should reconcile `.claude/skills/security/SKILL.md` §6 to (a) widen `entity_id` from `uuid` to `text` and (b) add `user_agent text` to the column list. **Not required for plan-04 to ship.**

- Important elements (final schema):
  - Table columns: `id uuid PK default gen_random_uuid()`, `user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`, `action text NOT NULL`, `entity_type text`, `entity_id text` (text — see note above), `meta jsonb NOT NULL DEFAULT '{}'`, `ip_address inet`, `user_agent text`, `created_at timestamptz NOT NULL DEFAULT now()`.
  - Three indexes (per RESEARCH.md, renamed for new column names):
    1. `idx_audit_log_user_created ON (user_id, created_at DESC) WHERE user_id IS NOT NULL`
    2. `idx_audit_log_action_created ON (action, created_at DESC)`
    3. `idx_audit_log_entity ON (entity_type, entity_id) WHERE entity_type IS NOT NULL`
  - `ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;`
  - NO policies — empty policy set = nobody except service_role can read/write (service_role bypasses RLS per RESEARCH.md §A7 line 1360).
  - `audit_log_no_mutate` trigger function (raises exception on UPDATE/DELETE).
  - Two triggers: `audit_log_no_update BEFORE UPDATE` + `audit_log_no_delete BEFORE DELETE`.
  - Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotency (per `.claude/skills/database/SKILL.md`).
- Commit: `feat(p1): add audit_log table migration with immutable triggers (FOUND-05)`.

### Task 2: Apply migration locally and regenerate types

- `npm run db:reset` — resets local Supabase, applies all migrations (base scaffold + new audit_log).
- Expected: no errors. `psql` connection string can be retrieved from `supabase status` if a manual verification is wanted: `psql -h localhost -p 54322 -U postgres -d postgres -c "\d audit_log"` should show the 9 columns + 3 indexes + 2 triggers.
- `npm run db:types` — regenerates `src/types/database.ts` to include `audit_log` row/insert/update types.
- Commit: `chore(p1): regenerate database types for audit_log table`.

### Task 3: Create `src/lib/audit-log.ts`

- Copy structure from RESEARCH.md §Pattern 5 lines 733–815, adapted to the final column names from Task 1.
- **First line MUST be `import 'server-only';`** — helper uses admin client + `next/headers` (both server-only).

- **Sync vs async `headers()` note (Fix 7)** — add this comment block ABOVE the body of `auditLog()`:
  ```ts
  // NOTE: headers() is SYNC in Next.js 14.2.x (current locked version per CLAUDE.md
  // Technology Stack section). If/when this project upgrades to Next.js 15+,
  // change `const hs = headers()` to `const hs = await headers()` and update the
  // function's awaits accordingly. The mocks in audit-log.test.ts also need updating.
  // See https://nextjs.org/docs/app/api-reference/functions/headers for the 15+ async signature.
  ```

- Exports:
  - `interface AuditLogInput` — `userId, action, entityType?, entityId?, meta?` (note column-name-aligned field names per Fix 13).
  - `async function auditLog(input)` — primary entry point; uses `headers()` (sync — Next 14.2.x) from `next/headers`; captures IP from `x-forwarded-for` first hop (falls back to `x-real-ip`); inserts via `createAdminClient()`; wraps everything in `try/catch` that logs via `logger.error(...)` and returns undefined (NEVER throws).
  - `async function auditLogContextless(input + ipAddress + userAgent)` — variant for cron/worker contexts where `next/headers()` throws (RESEARCH.md §Pitfall 8 lines 1170–1175). Parameter names use skill-aligned `ipAddress` (NOT `ip`) to match the column name (inserted as `ip_address`).
- Internal field mapping when calling `.insert(...)`: TS-side `entityType` → DB column `entity_type`; TS-side `meta` → DB column `meta`; TS-side IP → DB column `ip_address`. (Supabase JS client uses snake_case column names directly; TS field names can differ — pick TS camelCase per project convention.)
- JSDoc on `auditLog` must explicitly state: "Failure mode: logs via pino + does NOT throw. Compliance reasoning: never let an audit-write failure abort a payment."
- `npm run typecheck` green (requires `src/types/database.ts` to have `audit_log` types from Task 2).
- Commit: `feat(p1): add auditLog helper with IP/UA capture from next/headers (FOUND-05)`.

### Task 4: Add unit test `src/lib/audit-log.test.ts`

- Use the mock structure from RESEARCH.md §Pattern 5 lines 820–855, BUT corrected per Fix 6: use `new Headers(...)` (case-insensitive, web-standard) instead of `new Map(...)` (case-sensitive, will silently miss `X-Forwarded-For` vs `x-forwarded-for`).
- Mock structure:
  ```ts
  // src/lib/audit-log.test.ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { headers } from 'next/headers';

  // Per Fix 6: use new Headers(...) — Next.js headers() returns ReadonlyHeaders
  // (case-insensitive), NOT Map (case-sensitive). Map mocks silently miss
  // 'X-Forwarded-For' vs 'x-forwarded-for' casing.
  vi.mock('next/headers', () => ({
    headers: () => new Headers({
      'x-forwarded-for': '203.0.113.42, 10.0.0.1',
      'user-agent': 'Test Agent 1.0',
    }),
  }));

  const insertMock = vi.fn().mockResolvedValue({ error: null });
  vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => ({ from: () => ({ insert: insertMock }) }),
  }));

  // Stub pino logger so logger.error doesn't pollute test output.
  vi.mock('@/lib/logger', () => ({
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    getLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
  }));

  import { auditLog, auditLogContextless } from './audit-log';

  describe('auditLog', () => {
    beforeEach(() => insertMock.mockClear());

    it('captures IP from x-forwarded-for first hop (lowercase header name)', async () => {
      await auditLog({ userId: 'user-1', action: 'test.event' });
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        ip_address: '203.0.113.42',
        user_agent: 'Test Agent 1.0',
        action: 'test.event',
      }));
    });

    it('captures IP from uppercase X-Forwarded-For (proves case-insensitivity)', async () => {
      // Re-mock with uppercase to prove Headers is case-insensitive (Fix 6).
      vi.doMock('next/headers', () => ({
        headers: () => new Headers({
          'X-Forwarded-For': '198.51.100.99, 10.0.0.2',
          'User-Agent': 'Uppercase UA',
        }),
      }));
      vi.resetModules();
      const { auditLog: auditLogReimport } = await import('./audit-log');
      await auditLogReimport({ userId: 'user-2', action: 'test.case.event' });
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        ip_address: '198.51.100.99',
        user_agent: 'Uppercase UA',
      }));
    });

    // ... (cases 3–7 from earlier draft, with column-name updates: `ip` → `ip_address`,
    // `payload` → `meta`, `entity` → `entity_type`) ...
  });

  describe('auditLogContextless', () => {
    it('uses passed IP/UA instead of headers()', async () => {
      await auditLogContextless({
        userId: 'user-3',
        action: 'cron.cleanup',
        ipAddress: '10.10.10.10',
        userAgent: 'cron/1.0',
      });
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        ip_address: '10.10.10.10',
        user_agent: 'cron/1.0',
      }));
    });
  });
  ```

- Test cases (minimum):
  1. **IP from x-forwarded-for first hop** (lowercase) — verifies basic capture path uses skill-aligned `ip_address` column.
  2. **IP from X-Forwarded-For first hop** (uppercase) — proves `new Headers(...)` is case-insensitive (Fix 6 — would silently fail with `new Map(...)`).
  3. **User-Agent captured** — assert `user_agent` field on insert.
  4. **Fallback to x-real-ip when x-forwarded-for absent**: mocked headers omits XFF, sets `x-real-ip` → assert correct IP.
  5. **Null IP when no headers present**: empty Headers → assert `insert` called with `ip_address: null`.
  6. **Helper does NOT throw on insert failure**: mocked `insert` returns `{ error: { message: 'fail' } }` → assert `await auditLog(...)` resolves to `undefined` and does not throw.
  7. **Helper does NOT throw if headers() itself throws** (simulating non-request context): mock `headers()` to throw → assert `await auditLog(...)` still resolves to `undefined`. Verify `auditLogContextless` is the suggested variant for non-request paths.
  8. **meta defaults to empty object**: omit `meta` from input → assert `insert` called with `meta: {}`.
  9. **`auditLogContextless` uses passed IP/UA**: bypasses `headers()` entirely, inserts the provided values.

- Run `npm run test:ci -- src/lib/audit-log.test.ts` → all 9 cases pass.
- Commit: `test(p1): cover auditLog IP capture (case-insensitive), no-throw failure, contextless variant (FOUND-05)`.

### Task 5: Optional integration test for RLS denial (deferred to plan-06 framework)

- This task is OPTIONAL in plan-04 — it leverages the harness from plan-06.
- If plan-06 has merged: add `tests/integration/rls/audit-log.test.ts` asserting:
  1. Anonymous client cannot SELECT from `audit_log` (empty result, no error).
  2. Authenticated user cannot SELECT from `audit_log` (empty result).
  3. Authenticated user cannot INSERT into `audit_log` (error or empty result; service_role required).
  4. Admin client (service_role) CAN INSERT and the row appears.
- If plan-06 not yet merged: defer this test. Note it in PHASE SUMMARY.md so it lands in plan-06's wake.
- Commit (if executed): `test(p1): cover audit_log RLS denial for non-service-role (FOUND-05)`.

## Verification (acceptance criteria for FOUND-05)

| Check | Command | Expected Output |
|---|---|---|
| Migration applies cleanly | `npm run db:reset` | Exit 0; "Finished supabase db reset" |
| Table + indexes + triggers exist | `psql -h localhost -p 54322 -U postgres -d postgres -c "\d audit_log"` (after `supabase start`) | Lists 9 columns (`id, user_id, action, entity_type, entity_id, meta, ip_address, user_agent, created_at`), 3 indexes, 2 triggers |
| Column names match skill §6 | `psql -h localhost -p 54322 -U postgres -d postgres -c "\d audit_log" \| grep -E "entity_type\|meta\|ip_address"` | All three rows present (proves Fix 13 alignment) |
| Database types regenerated | Open `src/types/database.ts`, search "audit_log" | Type definitions for Row/Insert/Update present, fields named `entity_type`, `meta`, `ip_address` |
| Helper file has `import 'server-only';` first line | `head -1 src/lib/audit-log.ts` | `import 'server-only';` |
| Sync-`headers()` comment present | `grep -n "SYNC in Next.js 14" src/lib/audit-log.ts` | One match (proves Fix 7 comment landed) |
| Unit tests pass | `npm run test:ci -- src/lib/audit-log.test.ts` | All 9 cases pass (includes case-insensitive header test from Fix 6) |
| Typecheck green | `npm run typecheck` | Exit 0 |
| Lint green | `npm run lint` | Exit 0 (audit-log.ts is in ESLint overrides from plan-02) |
| RLS denial (if plan-06 ready) | `npm run test:integration -- tests/integration/rls/audit-log.test.ts` | All RLS denial cases pass |

## Out of Scope (DO NOT do in this plan)

- **No `auditLog()` call sites** — plan-04 ships the helper; the FIRST real caller is P3's payment Server Action and P4's webhook handler. Phase 1 does NOT instrument any real Server Action.
- **No admin UI for browsing audit_log** — M2 (`ADMIN-06` requirement).
- **No retention/archival policy** — `audit_log` grows indefinitely in M1. P7 may define a 7-year retention pg_cron job; out of scope for P1.
- **No metric/alert on audit-log insert failure** — RESEARCH.md §Security Domain line 1326 notes this as a follow-up. P5+ may add Sentry alert; out of scope for P1.
- **No Sentry capture in `auditLog()` failure path** — Sentry SDK is from plan-05; if both plans land, optionally add `Sentry.captureException(err)` in the catch block, but the minimum is `logger.error(...)`. Adding Sentry capture is a +1 line edit deferred to plan-05's catch-up pass IF audit-log helper has already landed.
- **No skill-doc update** — recommend a P2 housekeeping commit to widen `entity_id` from `uuid` to `text` and add `user_agent text` in `.claude/skills/security/SKILL.md` §6. NOT blocking for plan-04.

## Done When

- All 4 mandatory tasks complete (Task 5 is optional, depends on plan-06).
- All 10 mandatory verification checks pass (11 if Task 5 executed).
- Migration file in `supabase/migrations/`, type file regenerated.
- Column names match skill §6 verbatim (Fix 13).
- Helper exports `auditLog` and `auditLogContextless` with correct signatures and sync-`headers()` comment (Fix 7).
- Unit tests demonstrate IP capture, case-insensitive header lookup (Fix 6), and no-throw behavior.
- Migration filename rationale recorded (Fix 9) — future migrations follow skill's full timestamp convention.
- A different developer can `await auditLog({ userId, action: 'payment.succeeded', entityType: 'purchase', entityId: '...', meta: {...} })` from any Server Action and trust the row lands without aborting the caller's flow.
