// scripts/sentry-test.ts
//
// TEMPORARY — created in plan-05 task 7b for FOUND-06 verification.
// Deleted alongside src/server/actions/_sentry-test.ts at phase close (task 8).
//
// Usage:   `npx tsx scripts/sentry-test.ts`
// Expects: SENTRY_DSN populated in .env.local pointing at running Bugsink.
//
// Behaviour: imports the temporary `_sentryTestAction()` Server Action,
// invokes it once, and exits. The action calls Sentry.flush(2000)
// internally so the event is delivered before this process terminates —
// no extra sleep/await is required here.
//
// Acceptance: within 30 seconds of running this command,
// "Phase 1 sentry verification — ignore me" appears in the local
// Bugsink/GlitchTip dashboard.
//
// See: docs/runbooks/sentry-dev-setup.md for the full setup + verification flow.

import { _sentryTestAction } from '../src/server/actions/_sentry-test';

async function main(): Promise<void> {
  console.warn('[sentry-test] Triggering _sentryTestAction()…');
  await _sentryTestAction();
  console.warn('[sentry-test] Done. Check Bugsink/GlitchTip dashboard within 30s.');
}

main().catch((err) => {
  console.error('[sentry-test] Failed:', err);
  process.exit(1);
});
