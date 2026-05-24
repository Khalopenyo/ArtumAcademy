// tests/integration/globalSetup.ts
//
// Boots / verifies the Supabase local stack before the entire integration suite
// runs. Required by `vitest.integration.config.ts` (globalSetup field) and
// invoked ONCE per `npm run test:integration` run.
//
// =====================================================================
// `supabase status --output json` key-casing matrix (Fix 2 / Task 1a)
// =====================================================================
//
// The Supabase CLI has historically used different JSON field casings across
// versions (e.g. `API_URL` in 1.x current; some intermediate versions used
// `api_url`). To avoid silent-undefined-injection bugs where the URL/key
// strings come back empty and every test then errors with cryptic auth
// failures, this file:
//
//   1. Documents BOTH casing variants below — only one block is active.
//   2. Throws loudly and clearly via the defensive check on
//      `NEXT_PUBLIC_SUPABASE_URL` if injection fails.
//   3. Provides a plain-text regex fallback at the bottom for the case
//      where `--output json` itself breaks in some future CLI rewrite.
//
// REMEDIATION when the throw fires on a developer machine:
//
//   1. Run `supabase status --output json | head -20` (or
//      `npx supabase status --output json | head -20` if the CLI is only
//      in devDependencies). Inspect the first 5-10 keys.
//   2. Compare against Variant A / Variant B below.
//      - If your CLI prints UPPER_SNAKE keys (API_URL, ANON_KEY, ...) →
//        Variant A is already active; the throw means something else
//        failed (network, `supabase start` crashed, etc.).
//      - If your CLI prints lower_snake (api_url, anon_key, ...) →
//        comment out Variant A and uncomment Variant B.
//   3. If the JSON output itself broke (CLI rewrite, malformed JSON, etc.)
//      → comment out both variants and uncomment the regex fallback at
//      the bottom of this file.
//   4. If a developer's CLI version uses a third, unknown casing, add a
//      Variant C block and update this header comment.
//
// Observed CLI baseline at plan-06 ship date (2026-05-24): UPPER_SNAKE
// (CLI 1.200.x line — see `package.json` devDependency `supabase@^1.200.3`).
// Live `supabase status` probe was NOT run during plan-06 execution
// because Docker daemon was not available on the ship machine — the
// defensive throw is the runtime safety net. See plan-06 SUMMARY.md
// "Verification gaps" for context.
//
// External dependency: Docker daemon must be running for `supabase start`
// to succeed. If absent, `supabase status --output json` exits non-zero,
// this file calls `supabase start` which itself fails clearly. There is no
// auto-install of Docker — that is intentionally out of scope.

import { execSync } from 'node:child_process';

export async function setup(): Promise<void> {
  console.log('[globalSetup] Ensuring Supabase local stack is running...');
  // `supabase status --output json` exits 0 if running, non-zero if not.
  let running = false;
  try {
    execSync('supabase status --output json', { stdio: 'pipe' });
    running = true;
  } catch {
    running = false;
  }

  if (!running) {
    console.log('[globalSetup] Starting Supabase (first run may take ~30-60s)...');
    execSync('supabase start', { stdio: 'inherit' });
  }

  // Reset DB to a clean schema for the suite (re-applies migrations + seed).
  console.log('[globalSetup] Resetting DB (re-applies migrations + seed)...');
  execSync('supabase db reset', { stdio: 'inherit' });

  // Read local-stack URLs/keys and inject into process.env for the test suite.
  const statusRaw = execSync('supabase status --output json').toString();
  const status = JSON.parse(statusRaw) as Record<string, string>;

  // ===== Variant A (ACTIVE): UPPER_SNAKE keys (CLI 1.200.x baseline) =====
  process.env.NEXT_PUBLIC_SUPABASE_URL = status.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;

  // ===== Variant B (STANDBY): lower_snake keys =====
  // Uncomment this block (and comment out Variant A) if `supabase status
  // --output json | head` shows lowercase keys on your CLI version.
  // process.env.NEXT_PUBLIC_SUPABASE_URL = status.api_url;
  // process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = status.anon_key;
  // process.env.SUPABASE_SERVICE_ROLE_KEY = status.service_role_key;

  // ===== Defensive check (works regardless of casing) =====
  // If the active Variant block picked the wrong key names, the env vars
  // come back undefined here. Throwing loudly with a remediation pointer
  // is much better than letting every test downstream fail with cryptic
  // auth/connection errors.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      '[globalSetup] Failed to extract Supabase URL / keys from `supabase status --output json`. ' +
        'The CLI may have changed JSON field casing. ' +
        'Run `supabase status --output json | head -20` and update the active casing variant ' +
        'in tests/integration/globalSetup.ts (see header comment for the casing matrix and ' +
        'plan-06 Task 1a for the probe procedure).'
    );
  }

  console.log('[globalSetup] Supabase env injected — ready to run integration tests.');

  // ===== Regex fallback (DISABLED) =====
  // Uncomment ONLY if `--output json` breaks entirely (e.g. CLI rewrite that
  // removes the JSON flag). This parses the human-readable plain-text
  // `supabase status` output instead.
  //
  // const text = execSync('supabase status').toString();
  // process.env.NEXT_PUBLIC_SUPABASE_URL = text.match(/API URL:\s*(\S+)/)?.[1] ?? '';
  // process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = text.match(/anon key:\s*(\S+)/)?.[1] ?? '';
  // process.env.SUPABASE_SERVICE_ROLE_KEY = text.match(/service_role key:\s*(\S+)/)?.[1] ?? '';
}

export async function teardown(): Promise<void> {
  // Intentionally do NOT `supabase stop` — leaves the stack warm for the next
  // local run (re-running tests is much faster when the Docker stack stays up).
  // CI workflows should add an explicit `supabase stop` in a post-step.
}
