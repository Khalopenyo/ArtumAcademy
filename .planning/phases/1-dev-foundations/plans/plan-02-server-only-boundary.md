---
plan_id: 02
phase: 1-dev-foundations
title: server-only boundary on admin.ts + ESLint no-restricted-imports
maps_to_req: FOUND-03
depends_on: []
wave: 1
files_created:
  - src/lib/supabase/admin.ts
  - src/lib/supabase/admin.lint.test.ts
files_modified:
  - .eslintrc.json
  - package.json
---

# Plan 02 — server-only Boundary + ESLint Rule (FOUND-03)

## Goal

Build-time guarantee that `SUPABASE_SERVICE_ROLE_KEY` cannot end up in the client bundle. Three layers of defense:

1. **`import 'server-only'`** at line 1 of `src/lib/supabase/admin.ts` → Next.js bundler throws at build if a client component pulls this file (transitively or directly).
2. **ESLint `no-restricted-imports`** with glob pattern → fails CI/pre-commit before bundling.
3. **grep smoke check** → catches stray `service_role` references in client surface directories.

## Why now

- Wave 1 (parallel with plan-01 and plan-06). plan-02 has TRULY no `depends_on` — `admin.ts` reads `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY` directly via `process.env.*!` non-null assertion. Runtime guarantee of those vars being populated and valid comes from plan-01's `src/instrumentation.ts` at boot AND the `prebuild` npm script at build time. This means plan-02 ships independently and can execute fully in parallel with plan-01 in Wave 1.

## Files

### Created

| Path | Purpose | Reference |
|---|---|---|
| `src/lib/supabase/admin.ts` | service_role Supabase client; first line `import 'server-only'`; exports `createAdminClient()` singleton | RESEARCH.md §Pattern 2 lines 338–373 (adapted to read `process.env.*` directly per Fix 11) |
| `src/lib/supabase/admin.lint.test.ts` | Vitest unit test invoking Node's ESLint API on synthetic client-component code that imports `@/lib/supabase/admin`; asserts at least one error from `no-restricted-imports` rule. Reproducible in CI forever — replaces the plant-and-remove smoke from the earlier draft. | See task 4 |

### Modified

| Path | Edit | Reference |
|---|---|---|
| `.eslintrc.json` | Add `no-restricted-imports` rule blocking `@/lib/supabase/admin` AND `pino-pretty`; add `overrides` block exempting allowed callers (covers `.ts` and `.tsx`) | RESEARCH.md §Pattern 2 lines 376–414 + Fixes 3, 10 |
| `package.json` | Add to `dependencies`: `server-only@^0.0.1`. (Note: `eslint` is already in devDependencies — the lint-test reuses the installed copy.) | RESEARCH.md §Standard Stack line 83 |

## Dependencies

**Blocks-on:** nothing structurally. `admin.ts` reads `process.env.*` directly — no `@/env` import — so plan-02 truly has `depends_on: []` and ships fully in parallel with plan-01 and plan-06. Runtime safety of `process.env.NEXT_PUBLIC_SUPABASE_URL` / `process.env.SUPABASE_SERVICE_ROLE_KEY` being populated and valid is enforced by plan-01's `instrumentation.ts` at boot and the `prebuild` npm script at build time. plan-02 does not need to wait for plan-01 to ship.

**Blocks:** plan-04 (audit-log helper uses `createAdminClient()`).

## Implementation Steps (atomic commits)

### Task 1: Verify + install `server-only` package

- Run `npm view server-only@0.0.1 maintainers homepage repository` to confirm Vercel-published.
- `npm install server-only@^0.0.1`.
- Verify in `package.json` dependencies.
- Commit: `chore(p1): install server-only sentinel (FOUND-03)`.

### Task 2: Create `src/lib/supabase/admin.ts`

- **First line MUST be `import 'server-only';`** — non-negotiable.
- Body follows this exact shape (per Fix 11 — reads `process.env.*` directly to honor Wave 1 parallelism):
  ```ts
  import 'server-only'; // FIRST LINE
  import { createClient, type SupabaseClient } from '@supabase/supabase-js';
  import type { Database } from '@/types/database';

  // Read directly from process.env — runtime guarantee comes from
  // src/instrumentation.ts (plan-01) which calls env.ts at boot, and
  // the `prebuild` npm script (plan-01 task 5) at build time. Reading
  // process.env here avoids a build-time dependency on plan-01 and keeps
  // plan-02 truly parallel in Wave 1.
  //
  // Allowed callers (enforced by ESLint no-restricted-imports + overrides
  // in .eslintrc.json): src/lib/audit-log.ts, src/server/**, src/app/api/**,
  // src/instrumentation.ts, sentry.{server,edge}.config.ts.
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  let _admin: SupabaseClient<Database> | null = null;

  /**
   * Returns the memoized service_role Supabase client.
   *
   * SECURITY: This bypasses RLS. Only legitimate callers are:
   *   - audit-log helper (writes to RLS-denied audit_log table)
   *   - payment Server Actions (when user context insufficient)
   *   - webhook handlers (no user session available)
   *
   * NEVER import this from client components. ESLint and the
   * `import 'server-only'` sentinel will both block client inclusion.
   */
  export function createAdminClient(): SupabaseClient<Database> {
    if (_admin) return _admin;
    _admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    return _admin;
  }
  ```
- `npm run typecheck` must pass (requires the existing `src/types/database.ts` from the scaffold to be present; it is).
- Commit: `feat(p1): add service_role admin Supabase client with server-only sentinel (FOUND-03)`.

### Task 3: Update `.eslintrc.json`

- Read current `.eslintrc.json` to preserve existing rules (`@typescript-eslint/no-unused-vars`, `no-console`, `react/no-unescaped-entities`).
- Add to `rules`:
  ```json
  "no-restricted-imports": [
    "error",
    {
      "patterns": [
        {
          "group": ["@/lib/supabase/admin", "**/lib/supabase/admin"],
          "message": "service_role Supabase client is server-only. Use createServerSupabase() from @/lib/supabase/server instead (RLS-bound, safe for components)."
        },
        {
          "group": ["pino-pretty"],
          "message": "pino-pretty is a dev-only transport. Use `transport: { target: 'pino-pretty' }` string form in src/lib/logger.ts — do NOT `import` it. (Direct import bundles the dev transport into client code.)"
        }
      ]
    }
  ]
  ```
- Add `overrides` block (sibling of `extends` and `rules`). Globs cover BOTH `.ts` and `.tsx` (Fix 3). `pino-pretty` allowance is scoped to `src/lib/logger.ts` only (Fix 10):
  ```json
  "overrides": [
    {
      "files": [
        "src/lib/supabase/admin.ts",
        "src/lib/audit-log.ts",
        "src/server/**/*.{ts,tsx}",
        "src/app/api/**/*.{ts,tsx}",
        "src/instrumentation.ts",
        "sentry.*.config.{ts,tsx}"
      ],
      "excludedFiles": [
        "src/middleware.ts"
      ],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["pino-pretty"],
                "message": "pino-pretty is a dev-only transport. Use string-form transport target in logger.ts."
              }
            ]
          }
        ]
      }
    },
    {
      "files": ["src/lib/logger.ts"],
      "rules": {
        "no-restricted-imports": "off"
      }
    },
    {
      "files": ["src/lib/supabase/admin.lint.test.ts"],
      "rules": {
        "no-restricted-imports": "off"
      }
    }
  ]
  ```
  - First override: server-side files (admin, audit-log, server actions, api routes, instrumentation, sentry configs) — admin/audit-log overrides off the admin-import block, but `pino-pretty` is still blocked here (no server file should import it either — only `logger.ts` legitimately uses it via string-form transport target).
  - **NOTE: `src/middleware.ts` is intentionally `excludedFiles` from the first override** — middleware runs in Edge runtime, must never import `@/lib/supabase/admin` (admin client uses service_role + Node-only `pg` deps under the hood). If middleware needs Supabase, it uses `src/lib/supabase/middleware.ts` from the existing scaffold (anon-key, Edge-safe).
  - Second override: `src/lib/logger.ts` — the ONLY file allowed to reference `pino-pretty` (and it should still use string-form transport target per RESEARCH.md §Pitfall 4; this override just ensures the eslint rule doesn't false-positive on the string literal if it ever appears).
  - Third override: `admin.lint.test.ts` — the lint test from Task 4 contains an intentional `import` of `@/lib/supabase/admin` as a string argument to ESLint API; without this override the test file itself would lint-fail.
- `npm run lint` must pass on the whole repo with no false positives. If a legitimate caller flags, ADD that file to the appropriate `overrides.files` list (do not relax the rule).
- Commit: `chore(p1): add ESLint no-restricted-imports rule for admin client + pino-pretty (FOUND-03)`.

### Task 4: Create `src/lib/supabase/admin.lint.test.ts` (replaces plant-and-remove smoke from earlier draft)

- **Per Fix 4**: the earlier draft's "plant `_admin_leak_test.tsx` → lint → expect fail → delete" approach leaves the repo broken mid-task and is not reproducible in CI. Replaced with a Vitest unit test that uses Node's ESLint API to lint a string of synthetic client-component code.
- File contents:
  ```ts
  // src/lib/supabase/admin.lint.test.ts
  //
  // Reproducible test that the no-restricted-imports rule actually blocks
  // client-side imports of @/lib/supabase/admin. Runs in CI forever.
  // Replaces the plant-and-remove smoke verification from the earlier draft.
  import { describe, it, expect, beforeAll } from 'vitest';
  import { ESLint } from 'eslint';
  import path from 'node:path';

  describe('admin.ts ESLint boundary', () => {
    let eslint: ESLint;

    beforeAll(() => {
      // Reuse the repo's .eslintrc.json — do NOT inline a new config.
      eslint = new ESLint({
        cwd: path.resolve(__dirname, '../../../'),
        useEslintrc: true,
      });
    });

    it('reports an error when a client component imports @/lib/supabase/admin', async () => {
      const source = [
        "'use client';",
        "import { createAdminClient } from '@/lib/supabase/admin';",
        "export function ClientLeak() { return null; }",
      ].join('\n');

      // Use a synthetic file path under src/components/ so the lint
      // overrides for src/server/**, src/app/api/**, etc. do NOT exempt it.
      const results = await eslint.lintText(source, {
        filePath: path.resolve(__dirname, '../../../src/components/__synthetic_client_leak__.tsx'),
      });

      const ruleErrors = results[0]?.messages.filter(
        (m) => m.ruleId === 'no-restricted-imports' && m.severity === 2
      ) ?? [];

      expect(ruleErrors.length).toBeGreaterThan(0);
      expect(ruleErrors[0].message).toMatch(/server-only/i);
    });

    it('does NOT report an error when audit-log.ts imports @/lib/supabase/admin', async () => {
      const source = "import { createAdminClient } from '@/lib/supabase/admin';";

      const results = await eslint.lintText(source, {
        filePath: path.resolve(__dirname, '../../../src/lib/audit-log.ts'),
      });

      const ruleErrors = results[0]?.messages.filter(
        (m) => m.ruleId === 'no-restricted-imports' && m.severity === 2
      ) ?? [];

      expect(ruleErrors.length).toBe(0);
    });
  });
  ```
- Run `npm run test:ci -- src/lib/supabase/admin.lint.test.ts` → both test cases pass.
- This test does NOT plant any file on disk — it lints a STRING via the ESLint API. Fully reproducible, no cleanup needed, never leaves the repo broken.
- Commit: `test(p1): reproducible ESLint test for admin-client boundary (FOUND-03)`.

### Task 5: grep smoke check for service_role pollution

- Run:
  ```bash
  grep -ri "service_role" src/components/ src/app/\(marketing\)/ src/app/\(app\)/ 2>/dev/null
  ```
- Expected output: empty (no matches). If any match surfaces, that file MUST be cleaned (move logic to a Server Action, use anon-client, etc.) before this plan can close.
- This grep is documented as a recurring CI check in P6 + P7 — plan-02 just establishes the baseline.

## Verification (acceptance criteria for FOUND-03)

| Check | Command | Expected Output |
|---|---|---|
| `admin.ts` first line is `import 'server-only';` | `head -1 src/lib/supabase/admin.ts` | `import 'server-only';` |
| ESLint boundary test passes | `npm run test:ci -- src/lib/supabase/admin.lint.test.ts` | Both test cases pass (rule fires on client component; rule silent on audit-log.ts) |
| ESLint rule clean on real codebase | `npm run lint` | Exit 0 |
| Build clean | `npm run build` | Exit 0 |
| Service-role grep clean | `grep -ri "service_role" src/components/ src/app/\(marketing\)/ src/app/\(app\)/` | Empty |
| `admin.ts` reads `process.env.*` directly (not `@/env`) | `grep -n "from '@/env'" src/lib/supabase/admin.ts` | Empty (zero matches — proves no plan-01 import dependency) |
| Admin caller works | Reference import `createAdminClient` from `src/lib/audit-log.ts` (plan-04) or `src/app/api/test/route.ts` → lints clean | OK due to overrides |
| `pino-pretty` import in src/components/X.tsx fails lint | Manual: write `import 'pino-pretty'` in a client component string fed to ESLint API (or test on a temp file) | Exit non-zero with the dev-only-transport message |

## Out of Scope (DO NOT do in this plan)

- **No usage of `createAdminClient()`** — plan-04 (audit-log helper) is the first legitimate caller.
- **No `no-restricted-syntax` rule for `require()`** — R10 in PLAN.md acknowledges this is an accepted limitation; the second-line `import 'server-only'` runtime guard catches require-path inclusion. Adding this rule introduces complexity for marginal benefit.
- **No CI workflow changes** — Phase 6 owns CI pipeline (OPS-03). Plan-02 just ensures `npm run lint` catches violations locally and `npm run test:ci` exercises the boundary.
- **No grep CI job** — also Phase 6 / Phase 7 territory (COMP-04 covers prod-build secret-leak grep).

## Done When

- All 5 tasks complete.
- All 8 verification checks pass.
- `src/lib/supabase/admin.ts` exists, is server-only, reads `process.env.*` directly (Fix 11), and is documented (JSDoc lists allowed callers).
- ESLint blocks client imports of admin module AND of `pino-pretty` (Fix 10).
- ESLint globs cover both `.ts` and `.tsx`, and `src/middleware.ts` is explicitly excluded (Fix 3).
- Lint-test in `admin.lint.test.ts` (Fix 4) is reproducible in CI forever.
- grep on client surfaces returns empty.
