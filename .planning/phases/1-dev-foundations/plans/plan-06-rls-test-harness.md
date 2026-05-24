---
plan_id: 06
phase: 1-dev-foundations
title: RLS test harness — Vitest globalSetup + Supabase local + canary cross-user denial test
maps_to_req: FOUND-10
depends_on: []
wave: 1
files_created:
  - vitest.integration.config.ts
  - tests/integration/globalSetup.ts
  - tests/integration/setup.ts
  - tests/integration/helpers/test-clients.ts
  - tests/integration/helpers/test-users.ts
  - tests/integration/rls/profiles.test.ts
files_modified: []
---

# Plan 06 — RLS Test Harness (FOUND-10)

## Goal

Production-grade RLS regression harness usable by every future migration in P2+. Vitest `globalSetup` ensures `supabase start` is running, runs `supabase db reset` for a clean schema. Helpers create test users via `auth.admin.createUser`, mint per-user anon-key clients with the user's JWT, and a canary test against the existing `profiles` table proves that User B cannot see User A's row. The canary serves as the copy-paste template for every RLS test in P2–P6.

## Why now

- Wave 1 (parallel with plan-01 and plan-02): only depends on the existing scaffold (`supabase` CLI in devDependencies, base `profiles` table with RLS, `src/types/database.ts`).
- Does NOT depend on `src/env.ts` because the test harness reads env from `supabase status --output json` and injects directly into `process.env` (per RESEARCH.md §Pattern 6 lines 922–926).
- Blocks nothing in P1, but its existence is critical for plan-04 (Task 5 optional integration test of audit_log RLS denial) and every P2+ migration.

## Files

### Created

| Path | Purpose | Reference |
|---|---|---|
| `vitest.integration.config.ts` | Separate Vitest config; runs `tests/integration/**/*.test.ts`; `globals: true`, `environment: 'node'`, `globalSetup: './tests/integration/globalSetup.ts'`, `setupFiles: ['./tests/integration/setup.ts']`, `poolOptions.threads.singleThread: true`, `testTimeout: 30_000`, `hookTimeout: 60_000` | RESEARCH.md §Pattern 6 lines 868–893 |
| `tests/integration/globalSetup.ts` | Ensures `supabase start` running (idempotent check), runs `supabase db reset`, reads `supabase status --output json` (with both UPPER_SNAKE and lower_snake key variants per Fix 2) and exports URLs/keys to `process.env` for the test suite | RESEARCH.md §Pattern 6 lines 899–933 (with key-casing probe per Fix 2) |
| `tests/integration/setup.ts` | Minimal per-suite setup (extends `tests/unit/setup.ts` if needed; placeholder for future Vitest matchers / global mocks) | New — see task 4 |
| `tests/integration/helpers/test-clients.ts` | Exports `makeAdminClient()` (service_role) and `makeUserClient(accessToken)` (anon key + per-user JWT Bearer header) | RESEARCH.md §Pattern 6 lines 938–964 |
| `tests/integration/helpers/test-users.ts` | Exports `createTestUser(suffix?)` → `{id, email, password, accessToken}`. Uses `supabase.auth.admin.createUser` + `signInWithPassword`. Also `deleteTestUser(userId)` for cleanup. | RESEARCH.md §Pattern 6 lines 967–1007 |
| `tests/integration/rls/profiles.test.ts` | Canary RLS test: creates two users, asserts User B cannot SELECT/UPDATE User A's profile (using standard Supabase RLS-deny pattern per Fix 12), asserts User A CAN SELECT own. **This is the copy-paste template for every future RLS test.** | RESEARCH.md §Pattern 6 lines 1012–1072 (with Fix 12 UPDATE-deny correction) |

### Modified

None. The `test:integration` script already exists in `package.json` line 19:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```
This script points to a file that will exist after this plan ships — no `package.json` edit needed.

## Dependencies

**Blocks-on:** nothing. Uses existing Supabase scaffold's `profiles` table (created in `supabase/migrations/20260522000001_init_base_tables.sql`).

**Blocks:** plan-04 Task 5 (optional RLS test for `audit_log` table — leverages this harness). Every P2+ migration that adds an RLS-protected table will add a `tests/integration/rls/<table>.test.ts` following this template.

**External dependency:** Docker daemon must be running on the developer's machine for `supabase start` to work. RESEARCH.md §Environment Availability lines 1234–1240 documents this as the only external dep; if Docker absent, RLS tests defer to CI-only.

## Implementation Steps (atomic commits)

### Task 1: Verify Docker + Supabase CLI

- `docker info` → expect daemon running (no error). If error, abort: harness can't run locally.
- `supabase --version` → expect 1.x output (per `package.json` devDep `supabase@^1.200.3`).
- `supabase start` (if not already running) → expect Supabase local stack up. First run takes ~30-60s to pull Docker images.
- `supabase status --output json` → expect JSON with URL/key fields (exact casing probed in Task 1a).
- No commit (verification only).

### Task 1a: Probe `supabase status --output json` key casing (Fix 2)

- **Per Fix 2**: the Supabase CLI changed JSON field casing across versions (`API_URL` vs `api_url`, etc.). Probe the installed CLI's actual output BEFORE writing globalSetup to avoid silent-undefined-injection bugs.
- Run:
  ```bash
  supabase status --output json | head -20
  ```
- **Record the actual key casing** you observe in this comment (paste the first 5–10 lines of output) — this becomes the source of truth for Task 3 below.
- Document in `tests/integration/globalSetup.ts` header comment:
  ```ts
  // globalSetup.ts — supabase status JSON key-casing matrix
  // Observed CLI version: <output of `supabase --version`>
  // Observed status keys (paste the actual keys from `supabase status --output json`):
  //   - API_URL or api_url? --> use the variant your CLI prints
  //   - ANON_KEY or anon_key?
  //   - SERVICE_ROLE_KEY or service_role_key?
  // If a developer's machine has a different CLI version with a different casing,
  // they should re-probe and update the destructuring below.
  ```
- **Alternative fallback path** (also document in the header): if `--output json` ever breaks entirely (e.g., CLI rewrite), parse the plain text output of `supabase status` via regex:
  ```ts
  // Fallback parser (uncomment if JSON output breaks):
  // const text = execSync('supabase status').toString();
  // const apiUrl = text.match(/API URL:\s*(\S+)/)?.[1];
  // const anonKey = text.match(/anon key:\s*(\S+)/)?.[1];
  // const srvKey  = text.match(/service_role key:\s*(\S+)/)?.[1];
  ```
- No commit yet (the documented casing is consumed by Task 3's commit).

### Task 2: Create `vitest.integration.config.ts`

- Copy verbatim from RESEARCH.md §Pattern 6 lines 868–893.
- Key settings:
  - `globals: true` (no need to import `describe`/`it`/`expect`)
  - `environment: 'node'` (no jsdom — these are real Postgres + HTTP tests)
  - `include: ['tests/integration/**/*.test.ts', 'src/**/*.integration.test.ts']`
  - `exclude: ['tests/e2e/**', 'node_modules/**']`
  - `globalSetup: './tests/integration/globalSetup.ts'`
  - `setupFiles: ['./tests/integration/setup.ts']`
  - `testTimeout: 30_000`, `hookTimeout: 60_000`
  - `poolOptions.threads.singleThread: true` (sequential — DB mutations would collide otherwise)
  - Path alias `'@'` → `./src`
- `npm run typecheck` green.
- Commit: `chore(p1): add vitest.integration.config.ts (FOUND-10)`.

### Task 3: Create `tests/integration/globalSetup.ts`

- Create `tests/integration/` directory.
- Adapt RESEARCH.md §Pattern 6 lines 899–933 — **with key-casing handled per Task 1a probe**.
- Body (templatized with both variants commented per Fix 2):
  ```ts
  // tests/integration/globalSetup.ts
  //
  // supabase status JSON key-casing matrix (probed in plan-06 Task 1a)
  // Observed CLI version: <fill in from `supabase --version` output>
  // Observed status keys: <fill in actual casing — e.g. API_URL or api_url>
  //
  // IMPORTANT: if your `supabase` CLI is a different version with
  // different casing, re-probe via `supabase status --output json | head`
  // and uncomment the variant below that matches your output.
  // If JSON output breaks entirely, see the regex fallback at the bottom.

  import { execSync } from 'node:child_process';

  export async function setup() {
    console.log('[globalSetup] Ensuring Supabase local stack is running...');
    let running = false;
    try {
      execSync('supabase status --output json', { stdio: 'pipe' });
      running = true;
    } catch {
      running = false;
    }

    if (!running) {
      console.log('[globalSetup] Starting Supabase (this may take ~30s)...');
      execSync('supabase start', { stdio: 'inherit' });
    }

    console.log('[globalSetup] Resetting DB (re-applies migrations + seed)...');
    execSync('supabase db reset', { stdio: 'inherit' });

    const statusRaw = execSync('supabase status --output json').toString();
    const status = JSON.parse(statusRaw);

    // ===== Key casing — UNCOMMENT the block that matches Task 1a probe =====

    // Variant A: UPPER_SNAKE (CLI v1.x and most current versions as of probe date 2026-05-24)
    process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;

    // Variant B: lower_snake (if CLI started using snake_case)
    // process.env.NEXT_PUBLIC_SUPABASE_URL = status.api_url;
    // process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.anon_key;
    // process.env.SUPABASE_SERVICE_ROLE_KEY = status.service_role_key;

    // ===== Defensive check (works regardless of casing) =====
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error(
        '[globalSetup] Failed to extract API URL from supabase status. ' +
        'Probe `supabase status --output json | head` and update key casing in this file. ' +
        'See plan-06 Task 1a for the casing-probe procedure.'
      );
    }

    // ===== Regex fallback (uncomment if --output json breaks entirely) =====
    // const text = execSync('supabase status').toString();
    // process.env.NEXT_PUBLIC_SUPABASE_URL = text.match(/API URL:\s*(\S+)/)?.[1] ?? '';
    // process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = text.match(/anon key:\s*(\S+)/)?.[1] ?? '';
    // process.env.SUPABASE_SERVICE_ROLE_KEY = text.match(/service_role key:\s*(\S+)/)?.[1] ?? '';
  }

  export async function teardown() {
    // Intentionally do NOT `supabase stop` — leaves the stack warm for next run.
  }
  ```
- Add file-header comment explaining this file is required-by `vitest.integration.config.ts` and runs ONCE before the entire suite.
- The defensive `if (!process.env.NEXT_PUBLIC_SUPABASE_URL)` throw is the safety net — if the developer's CLI version uses unexpected casing, the test suite fails loudly with a clear remediation message (NOT silently with empty connection strings).
- Commit: `feat(p1): add Vitest globalSetup for Supabase local stack with key-casing matrix (FOUND-10)`.

### Task 4: Create `tests/integration/setup.ts`

- Per-suite setup file (runs in each worker BEFORE each test file is loaded).
- Minimal contents for now:
  ```ts
  // tests/integration/setup.ts
  // Per-suite setup for integration tests.
  // Add Vitest matchers, global mocks, or per-test fixtures here as the suite grows.
  // Phase 1: intentionally empty — globalSetup.ts handles infrastructure boot.

  // Re-export jest-dom matchers if integration tests use Testing Library
  // (Phase 1: not needed; Phase 6 may add for component integration).
  ```
- This file exists so `vitest.integration.config.ts` `setupFiles` reference doesn't 404. Future plans can extend.
- Commit: `chore(p1): add integration test per-suite setup placeholder (FOUND-10)`.

### Task 5: Create `tests/integration/helpers/test-clients.ts`

- Create `tests/integration/helpers/` directory.
- Copy verbatim from RESEARCH.md §Pattern 6 lines 938–964.
- Exports:
  - `makeAdminClient()` — `createClient<Database>(URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } })`. Bypasses RLS.
  - `makeUserClient(accessToken)` — `createClient<Database>(URL, ANON_KEY, { global: { headers: { Authorization: 'Bearer ' + accessToken } } })`. Behaves like the given user (RLS applies as that user).
- Reads URL/keys from `process.env.NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (populated by globalSetup).
- Imports `Database` type from `@/types/database`.
- Commit: `feat(p1): add test-clients helper (admin + per-user anon factories) (FOUND-10)`.

### Task 6: Create `tests/integration/helpers/test-users.ts`

- Copy verbatim from RESEARCH.md §Pattern 6 lines 967–1007.
- Exports:
  - `interface TestUser { id, email, password, accessToken }`
  - `async function createTestUser(suffix?)` — calls `admin.auth.admin.createUser({ email: 't+<suffix or uuid>@test.local', password: 'TestPassword123!', email_confirm: true })`. Then `signInWithPassword` to mint a session and return `accessToken`.
  - `async function deleteTestUser(userId)` — calls `admin.auth.admin.deleteUser(userId)`. Used in `afterAll` for cleanup.
- Email scheme `t+<suffix>@test.local` is the documented test-user convention.
- Commit: `feat(p1): add test-users helper (createTestUser/deleteTestUser) (FOUND-10)`.

### Task 7: Create canary RLS test `tests/integration/rls/profiles.test.ts`

- Create `tests/integration/rls/` directory.
- Adapt RESEARCH.md §Pattern 6 lines 1012–1072, **with the UPDATE-deny assertion corrected per Fix 12** (RESEARCH.md line 1053 contains a meaningless `expect(... ?? 0).not.toBe(undefined)` that always passes — `0` is never `undefined`). Replace with the standard Supabase RLS-deny pattern + read-back assertion.
- Test cases:
  1. **Setup**: `beforeAll` creates `userA` + `userB` (two real Supabase auth users with confirmed email).
  2. **Teardown**: `afterAll` deletes both users.
  3. **Test A — User B cannot SELECT User A profile**: `makeUserClient(userB.accessToken).from('profiles').select(...).eq('user_id', userA.id)` → expect `data` to be `[]` and `error` to be `null` (RLS hides rows silently per Supabase convention).
  4. **Test B — User B cannot UPDATE User A profile** (Fix 12 — corrected from RESEARCH.md line 1053):
     ```ts
     it('User B cannot UPDATE User A profile', async () => {
       const clientB = makeUserClient(userB.accessToken);
       const adminClient = makeAdminClient();

       const { data, error } = await clientB
         .from('profiles')
         .update({ full_name: 'Hacked' })
         .eq('user_id', userA.id)
         .select();

       // Standard Supabase RLS-deny pattern for UPDATE:
       // UPDATE returns no rows (data is empty array) and typically no error.
       // The dead-code line `expect((error?.code ?? data?.length) ?? 0).not.toBe(undefined)`
       // from the earlier draft always passed (0 is never undefined) — removed per Fix 12.
       expect(data ?? []).toEqual([]);

       // Read-back via admin client (bypasses RLS) is the AUTHORITATIVE proof
       // that nothing was mutated. NEVER trust the deny-response alone.
       const adminCheck = await adminClient
         .from('profiles')
         .select('full_name')
         .eq('user_id', userA.id)
         .single();
       expect(adminCheck.error).toBeNull();
       expect(adminCheck.data?.full_name).not.toBe('Hacked');
     });
     ```
  5. **Test C — User A CAN SELECT own profile**: `makeUserClient(userA.accessToken).from('profiles').select(...).eq('user_id', userA.id).single()` → expect non-null data with correct `user_id`.
- Add a top-of-file JSDoc comment: `/** Canary RLS regression test. This is the COPY-PASTE TEMPLATE for every future RLS test under tests/integration/rls/. The UPDATE-deny pattern in 'User B cannot UPDATE' is the AUTHORITATIVE template — uses admin-client read-back as the source of truth, NOT the deny-response shape. */`
- Note for future RLS tests: the canary uses `makeAdminClient()` (added to imports) for read-back. This is the right primitive — non-admin read-back as User A would also work but is less robust if there's ever a multi-condition RLS policy bug that affects both UPDATE and SELECT.
- Run `npm run test:integration -- tests/integration/rls/profiles.test.ts` → all 3 tests pass against fresh `supabase db reset`. First run ~60s (image pull + reset); subsequent ~10-20s.
- Commit: `test(p1): canary RLS test for profiles with admin-readback UPDATE deny (FOUND-10 template)`.

### Task 8: Smoke verification

- Fresh terminal:
  ```bash
  npm run test:integration -- tests/integration/rls/profiles.test.ts
  ```
- Expected: all 3 tests pass, runtime well under 30s (warm stack), under 60s cold.
- Optional: run `npm run test:integration` without filter — should run only the profiles.test.ts file in this plan (P2+ will add more).
- Additionally: if `globalSetup` threw the "Failed to extract API URL" error, that's the casing-matrix warning from Task 3 — re-run Task 1a probe and update the active variant in `globalSetup.ts`.
- No commit (smoke only).

## Verification (acceptance criteria for FOUND-10)

| Check | Command | Expected Output |
|---|---|---|
| Vitest integration config exists | `ls vitest.integration.config.ts` | File present |
| globalSetup file exists | `ls tests/integration/globalSetup.ts` | File present |
| globalSetup has key-casing matrix comment (Fix 2) | `grep -n "Variant A\|Variant B\|key-casing matrix" tests/integration/globalSetup.ts` | Multiple matches (proves both variants documented + defensive throw present) |
| Helper files exist | `ls tests/integration/helpers/test-{clients,users}.ts` | Both files present |
| Canary test exists | `ls tests/integration/rls/profiles.test.ts` | File present |
| UPDATE-deny test uses admin-readback (Fix 12) | `grep -n "makeAdminClient\|adminCheck" tests/integration/rls/profiles.test.ts` | Both matches present (proves the dead-code assertion was replaced with the read-back pattern) |
| No dead-code `.not.toBe(undefined)` assertion (Fix 12) | `grep -n "not.toBe(undefined)" tests/integration/rls/profiles.test.ts` | EMPTY (the meaningless assertion from RESEARCH.md line 1053 must not appear) |
| Canary test passes | `npm run test:integration -- tests/integration/rls/profiles.test.ts` | All 3 tests green |
| Typecheck green | `npm run typecheck` | Exit 0 |
| Lint green | `npm run lint` | Exit 0 |
| Existing unit tests still pass | `npm run test:ci` | Exit 0 (integration config is separate; unit config excludes `tests/integration/**`) |

## Out of Scope (DO NOT do in this plan)

- **No RLS tests for `audit_log`** — that table doesn't exist until plan-04 lands. Plan-04 Task 5 is OPTIONAL — adds `tests/integration/rls/audit-log.test.ts` IF plan-06 has merged.
- **No RLS tests for `courses`/`modules`/`lessons`** — even though they have RLS in the base scaffold, their RLS rules are most usefully tested AFTER P3 adds the `purchases` table that gates `SELECT` on `lessons`. P5 RLS test will exercise the full chain.
- **No CI workflow** — `.github/workflows/` is P6 (OPS-03) territory. Plan-06 just ensures `npm run test:integration` works locally.
- **No Docker provisioning script** — if developer doesn't have Docker, the harness fails clearly via `supabase status` error. No attempt to install Docker.
- **No mock Supabase** — RESEARCH.md §Anti-Patterns line 1094 explicit: mocking Supabase in RLS tests defeats the purpose. Always use real Postgres via `supabase start`.

## Done When

- All 9 tasks complete (6 commits; task 1, task 1a, and task 8 are verification/probe-only).
- All 11 verification checks pass (includes Fix 2 key-casing matrix and Fix 12 admin-readback gates).
- globalSetup.ts has BOTH casing variants documented, defensive throw if injection fails, and regex fallback note for JSON breakage (Fix 2).
- Canary UPDATE-deny test uses admin-client read-back as the source of truth, NOT the dead-code `.not.toBe(undefined)` from RESEARCH.md line 1053 (Fix 12).
- A different developer can:
  1. `npm install && npm run test:integration` and the harness boots Supabase + runs the canary green.
  2. Copy `tests/integration/rls/profiles.test.ts` as a template to test any new RLS-protected table in P2+.
- This plan SHIPS the FOUNDATION the rest of the project's RLS-correctness depends on. Per ROADMAP §Cut Lines line 274: "Do not cut: Phase 1 (security foundations)" — plan-06 is the central security-test foundation.
