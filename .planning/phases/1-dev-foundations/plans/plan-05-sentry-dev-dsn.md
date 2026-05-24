---
plan_id: 05
phase: 1-dev-foundations
title: "@sentry/nextjs ^8 wired with self-hosted dev DSN (GlitchTip/Bugsink)"
maps_to_req: FOUND-06
depends_on: [plan-01]
wave: 2
files_created:
  - sentry.server.config.ts
  - sentry.client.config.ts
  - sentry.edge.config.ts
  - src/server/actions/_sentry-test.ts
  - scripts/sentry-test.ts
  - docs/runbooks/sentry-dev-setup.md
files_modified:
  - next.config.js
  - src/instrumentation.ts
  - .env.example
  - package.json
files_deleted_before_phase_close:
  - src/server/actions/_sentry-test.ts
  - scripts/sentry-test.ts
---

# Plan 05 — `@sentry/nextjs` ^8 with Self-Hosted Dev DSN (FOUND-06)

## Goal

Install and wire `@sentry/nextjs@^8` (NOT 10.x — STACK.md locked decision for GlitchTip/Bugsink compatibility). Three config files at repo root, `withSentryConfig` wrapping `next.config.js`, init hook from `src/instrumentation.ts`. DSN read from `env.SENTRY_DSN` (server/edge) and `env.NEXT_PUBLIC_SENTRY_DSN` (client) — both pointing at developer's self-hosted GlitchTip/Bugsink instance. `enabled: !!process.env.SENTRY_DSN` graceful no-op if DSN absent (so install + config can ship without blocking on infra provisioning).

Final acceptance gate: developer runs `docs/runbooks/sentry-dev-setup.md` to spin up local Bugsink, sets `SENTRY_DSN`, runs `npx tsx scripts/sentry-test.ts`, observes event in dashboard within 30 seconds.

## Why now

- Wave 2 (depends on plan-01): config files read `env.SENTRY_DSN` AND modify `src/instrumentation.ts` and `next.config.js` that plan-01 introduced. Sequential after plan-01.

  **Note (plan-01 scope refinement)**: plan-01's earlier draft added `require('./src/env')` to `next.config.js`; that was replaced by a `prebuild` npm script (plan-01 Fix 1). Therefore `next.config.js` arrives at plan-05 UNCHANGED from the original scaffold — plan-05 is the ONLY Phase 1 plan that modifies `next.config.js`. The `withSentryConfig` wrap in Task 3 below is a clean, scoped edit.

- Concurrent with plan-03 (pino) — no file overlap.
- Closes ROADMAP Phase 1 success criterion #3.

## Files

### Created

| Path | Purpose | Reference |
|---|---|---|
| `sentry.server.config.ts` | `Sentry.init()` for Node runtime; reads `process.env.SENTRY_DSN`; strips cookie/auth in `beforeSend` | RESEARCH.md §Pattern 4 lines 566–585 |
| `sentry.client.config.ts` | `Sentry.init()` for browser; reads `process.env.NEXT_PUBLIC_SENTRY_DSN`; disables Replay (noise) | RESEARCH.md §Pattern 4 lines 588–600 |
| `sentry.edge.config.ts` | `Sentry.init()` for Edge runtime | RESEARCH.md §Pattern 4 lines 603–612 |
| `src/server/actions/_sentry-test.ts` | TEMPORARY Server Action `_sentryTestAction()` that calls `Sentry.captureException(new Error('Phase 1 sentry verification — ignore me'))` + `Sentry.flush(2000)`. **MUST be deleted before phase close.** | RESEARCH.md §Pattern 4 lines 646–656 |
| `scripts/sentry-test.ts` | **Per Fix 8** — tsx-runnable invocation script (5–10 lines) that imports and calls `_sentryTestAction()` directly. Eliminates Task 8 ambiguity about "how to invoke" the test action. **TEMPORARY** — deleted alongside `_sentry-test.ts` at phase close. | See task 7b |
| `docs/runbooks/sentry-dev-setup.md` | Developer-facing runbook: how to run Bugsink locally (`docker run -p 8000:8000 bugsink/bugsink`), how to mint a DSN, how to trigger via `npx tsx scripts/sentry-test.ts`, how to verify event in dashboard, troubleshooting (CORS, DSN format, etc.) | New — see task 6 |

### Modified

| Path | Edit | Reference |
|---|---|---|
| `next.config.js` | Wrap `module.exports` with `withSentryConfig(nextConfig, { hideSourceMaps: true, telemetry: false, silent: !process.env.SENTRY_DSN })`. **Preserve all existing nextConfig fields (`headers`, `images`, etc.).** plan-01 did NOT modify `next.config.js`, so this is the file's first Phase 1 edit. | RESEARCH.md §Pattern 4 lines 615–640 |
| `src/instrumentation.ts` | Inside the existing `register()` function (from plan-01), AFTER `await import('./env')`, add the Node + Edge runtime imports: `if (process.env.NEXT_RUNTIME === 'nodejs') await import('../sentry.server.config')` and `if (process.env.NEXT_RUNTIME === 'edge') await import('../sentry.edge.config')`. **Preserve the env import.** | RESEARCH.md §Pattern 1 lines 307–319 (full version with Sentry imports) |
| `.env.example` | Append `SENTRY_DSN=` and `NEXT_PUBLIC_SENTRY_DSN=` with comments pointing to the runbook | See task 5 |
| `package.json` | Add to `dependencies`: `@sentry/nextjs@^8` (latest 8.x — currently 8.55.2). DO NOT install 10.x. | RESEARCH.md §Standard Stack line 86 |

### Deleted before phase close

| Path | When | Why |
|---|---|---|
| `src/server/actions/_sentry-test.ts` | Final step of Phase 1 close (after `_sentryTestAction` has been triggered and event verified in dashboard) | Temporary verification artifact; should not ship to P2+ |
| `scripts/sentry-test.ts` | Same time as `_sentry-test.ts` | Imports the deleted Server Action; would become a dead file |

## Dependencies

**Blocks-on:** plan-01 (env file exists; `src/instrumentation.ts` exists; `prebuild` script in place — this means by the time plan-05 runs, the env validation contract is already enforced at build time).

**Concurrent with:** plan-03 (no file overlap). Both can ship in Wave 2.

**Blocks:** Nothing in P1. (P6 OPS-01 verifies events reach prod-DSN; P7 cuts over to prod DSN.)

## Implementation Steps (atomic commits)

### Task 1: Verify + install `@sentry/nextjs@^8`

- Run `npm view @sentry/nextjs maintainers homepage repository`.
- Confirm latest 8.x version: `npm view @sentry/nextjs@8 version` (should be 8.55.2 or higher within 8.x; do NOT accept 10.x).
- `npm install @sentry/nextjs@^8`.
- Verify `package.json` `dependencies` has `"@sentry/nextjs": "^8.something"`. If npm resolves to 10.x, lock to a specific minor: `npm install @sentry/nextjs@^8.55.2`.
- `npm run typecheck` green.
- Commit: `chore(p1): install @sentry/nextjs ^8 (pinned for GlitchTip/Bugsink compat)`.

### Task 2: Create the three Sentry config files at repo root

- `sentry.server.config.ts` — copy verbatim from RESEARCH.md §Pattern 4 lines 566–585.
  - Reads `process.env.SENTRY_DSN` (raw `process.env`, NOT `@/env`, because instrumentation may import before env.ts module side-effects complete).
  - `tracesSampleRate`: 1.0 in dev, 0.1 in prod.
  - `enabled: !!process.env.SENTRY_DSN` — graceful no-op if DSN missing.
  - `beforeSend(event)` strips `event.request.headers.cookie` and `event.request.headers.authorization` (defense in depth even though pino redacts).
- `sentry.client.config.ts` — copy verbatim from RESEARCH.md §Pattern 4 lines 588–600.
  - Reads `process.env.NEXT_PUBLIC_SENTRY_DSN`.
  - `replaysOnErrorSampleRate: 0`, `replaysSessionSampleRate: 0` (disable Replay to avoid noise + Sanctions-affected SaaS dependencies).
- `sentry.edge.config.ts` — copy verbatim from RESEARCH.md §Pattern 4 lines 603–612.
- All three live at REPO ROOT (NOT under `src/`) — this is the Next.js convention; `withSentryConfig` looks for them there.
- `npm run typecheck` green.
- Commit: `feat(p1): add sentry.{server,client,edge}.config.ts (FOUND-06)`.

### Task 3: Wrap `next.config.js` with `withSentryConfig`

- Read current `next.config.js` (unchanged from the original scaffold — plan-01 does NOT modify this file per Fix 1).
- At the top of the file, ADD: `const { withSentryConfig } = require('@sentry/nextjs');`.
- At the bottom, REPLACE `module.exports = nextConfig;` with:
  ```js
  module.exports = withSentryConfig(nextConfig, {
    // Self-hosted GlitchTip/Bugsink — set sentryUrl/org/project in P7 (prod deploy).
    // sentryUrl: 'https://glitchtip.your-domain.ru',
    // org: 'videoedit-academy',
    // project: 'web',

    // Source-map upload — requires SENTRY_AUTH_TOKEN. Deferred to P7.
    // authToken: process.env.SENTRY_AUTH_TOKEN,

    hideSourceMaps: true,   // don't expose maps to client
    telemetry: false,       // disable Sentry SaaS telemetry
    silent: !process.env.SENTRY_DSN, // silently skip if no DSN (dev convenience)
  });
  ```
- **Preserve nextConfig fields** (`reactStrictMode`, `poweredByHeader`, `images.remotePatterns`, `experimental.serverActions`, `headers()`) UNTOUCHED inside the const.
- `npm run build` — should succeed (with or without `SENTRY_DSN` set, thanks to `silent` flag). Note: plan-01's `prebuild` script runs first automatically (npm lifecycle) — if env is invalid, build dies at `prebuild` before Sentry is ever invoked.
- Commit: `chore(p1): wrap next.config.js with withSentryConfig (FOUND-06)`.

### Task 4: Update `src/instrumentation.ts` to register Sentry on boot

- Read current `src/instrumentation.ts` (from plan-01, just has `register()` with `await import('./env')`).
- Inside `register()`, AFTER `await import('./env');`, ADD:
  ```ts
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
  ```
- **Preserve the env import.** Total function body becomes 5 lines (1 env import + 4 conditional Sentry imports).
- The client config (`sentry.client.config.ts`) is auto-discovered by `withSentryConfig` — no manual import needed.
- `npm run typecheck && npm run build` green.
- Commit: `feat(p1): register Sentry init via instrumentation.ts on Node/Edge runtimes (FOUND-06)`.

### Task 5: Update `.env.example`

- Append a delimited block:
  ```
  # =====================================================================
  # Added in Phase 1 / plan-05 (FOUND-06) — Sentry self-hosted DSN
  # Set to a Bugsink/GlitchTip DSN for dev (see docs/runbooks/sentry-dev-setup.md).
  # Leave empty to silently no-op Sentry locally (build still succeeds).
  # =====================================================================
  SENTRY_DSN=
  NEXT_PUBLIC_SENTRY_DSN=
  ```
- Commit: `docs(p1): document Sentry DSN env vars + runbook reference (plan-05)`.

### Task 6: Author `docs/runbooks/sentry-dev-setup.md`

- Create `docs/runbooks/` directory if it doesn't exist.
- Write a runbook with these sections:
  1. **What** — one-paragraph explanation: P1 ships Sentry SDK; this runbook lets you point it at a local error monitor.
  2. **Why two options** — Bugsink (single container, SQLite, faster setup) vs GlitchTip (4 containers, Postgres, closer to prod parity). Recommend Bugsink for dev.
  3. **Bugsink setup (recommended for dev)**:
     - `docker run -d --name bugsink -p 8000:8000 bugsink/bugsink:latest`
     - Open `http://localhost:8000`, create admin account, create project, copy DSN.
     - DSN format: `http://<key>@localhost:8000/1`
     - Add to `.env.local`:
       ```
       SENTRY_DSN=http://<key>@localhost:8000/1
       NEXT_PUBLIC_SENTRY_DSN=http://<key>@localhost:8000/1
       ```
  4. **GlitchTip setup (alternative)** — link to GlitchTip docker-compose docs; briefly note it needs Postgres + Redis + 4 containers.
  5. **Verification** — run the test script (per Fix 8 — no ambiguity, single concrete path):
     ```bash
     npx tsx scripts/sentry-test.ts
     ```
     **Expected:** within 30 seconds of running this command, the error "Phase 1 sentry verification — ignore me" appears in the Bugsink/GlitchTip UI.
  6. **Troubleshooting** —
     - DSN not formatted right → check `http://<key>@host:port/<projectId>`.
     - CORS errors on client-side capture → ensure Bugsink is on same origin or has CORS allowlist for `localhost:3000`.
     - No event arrives → check `enabled: !!process.env.SENTRY_DSN` — DSN must be non-empty.
     - `next build` fails on Sentry config → `silent: !process.env.SENTRY_DSN` should suppress; if not, verify `withSentryConfig` wrapping in `next.config.js`.
     - `npx tsx scripts/sentry-test.ts` exits with `ECONNREFUSED` → Bugsink container not running. `docker ps | grep bugsink`.
  7. **Phase close cleanup** — link forward: after success criterion #3 is verified, BOTH `src/server/actions/_sentry-test.ts` AND `scripts/sentry-test.ts` are deleted (Task 8 below).
- Commit: `docs(p1): runbook for local Sentry/Bugsink dev setup`.

### Task 7: Create temporary `_sentryTestAction()` + invocation script

#### Task 7a — Server Action `src/server/actions/_sentry-test.ts`

- File: `src/server/actions/_sentry-test.ts`.
- Copy verbatim from RESEARCH.md §Pattern 4 lines 646–656.
- Must be marked `'use server';`.
- The leading underscore + `_sentry-test` filename signal "temporary, do not depend on".
- Add a clear file-header comment: `// TEMPORARY — created in plan-05 for FOUND-06 verification. Deleted before Phase 1 closes (see plan-05 task 8). Invoked via scripts/sentry-test.ts (also temporary).`
- `npm run typecheck && npm run lint && npm run build` green.
- Commit: `chore(p1): add temporary Sentry test Server Action for FOUND-06 verification`.

#### Task 7b — Invocation script `scripts/sentry-test.ts` (Fix 8 — concrete path)

- **Per Fix 8**: the earlier draft's "navigate to a way to invoke (e.g. temp page, OR Node REPL)" was ambiguous. Replaced with a single concrete invocation path: a tsx-runnable script.
- Create `scripts/` directory if it doesn't exist.
- File contents (5–10 lines):
  ```ts
  // scripts/sentry-test.ts
  //
  // TEMPORARY — created in plan-05 task 7b for FOUND-06 verification.
  // Deleted alongside src/server/actions/_sentry-test.ts at phase close (task 8).
  //
  // Usage: `npx tsx scripts/sentry-test.ts`
  // Expected: within 30 seconds, "Phase 1 sentry verification — ignore me"
  // appears in the local Bugsink/GlitchTip dashboard.
  //
  // Prerequisite: SENTRY_DSN populated in .env.local pointing at running Bugsink.
  // See docs/runbooks/sentry-dev-setup.md.

  import { _sentryTestAction } from '../src/server/actions/_sentry-test';

  async function main() {
    console.log('[sentry-test] Triggering _sentryTestAction()...');
    await _sentryTestAction();
    console.log('[sentry-test] Done. Check Bugsink/GlitchTip dashboard within 30s.');
  }

  main().catch((err) => {
    console.error('[sentry-test] Failed:', err);
    process.exit(1);
  });
  ```
- The script imports the temporary action directly — no `next dev` server needed.
- `tsx` is installed in plan-01 task 1; `npx tsx scripts/sentry-test.ts` works out of the box.
- Note: the action calls `Sentry.flush(2000)` internally before returning, so the event is delivered before the script exits — no extra wait/sleep needed in this script.
- Commit: `chore(p1): add scripts/sentry-test.ts as concrete invocation path for FOUND-06`.

### Task 8: Verification + delete temporary test action AND script

- **Pre-condition**: developer has provisioned Bugsink (or GlitchTip) per runbook and set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in `.env.local`.
- Run `npx tsx scripts/sentry-test.ts` from the repo root.
- Open Bugsink/GlitchTip dashboard.
- Confirm: an event with title "Phase 1 sentry verification — ignore me" appears within 30 seconds.
- Save screenshot to `docs/compliance/sentry-dev-verification.png` (one-time evidence; not required for P1 close but useful for future audits).
- **Delete** BOTH files:
  - `src/server/actions/_sentry-test.ts`
  - `scripts/sentry-test.ts`
- `npm run typecheck && npm run lint && npm run build` green.
- Commit: `chore(p1): remove temporary Sentry test action + script after FOUND-06 verified`.

## Verification (acceptance criteria for FOUND-06)

| Check | Command / Manual | Expected Output |
|---|---|---|
| Three Sentry config files exist at repo root | `ls sentry.*.config.ts` | Lists `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts` |
| `next.config.js` wrapped | Inspect file | Top has `const { withSentryConfig } = require('@sentry/nextjs')`; bottom has `module.exports = withSentryConfig(nextConfig, {...})` |
| `src/instrumentation.ts` registers Sentry | Inspect file | `register()` does `await import('./env')` then conditionally imports `../sentry.server.config` / `../sentry.edge.config` |
| Typecheck green | `npm run typecheck` | Exit 0 |
| Lint green | `npm run lint` | Exit 0 (sentry.*.config.{ts,tsx} allowed via plan-02 overrides) |
| Build green without DSN | `SENTRY_DSN= npm run build` | Exit 0 (silent due to `silent: !process.env.SENTRY_DSN`; prebuild env-validate still runs first per plan-01) |
| Build green with DSN | `SENTRY_DSN=http://fake@localhost:8000/1 npm run build` | Exit 0 |
| Runbook exists | `ls docs/runbooks/sentry-dev-setup.md` | File present, ≥ 50 lines covering Bugsink + verification steps |
| **Manual — concrete invocation** (Fix 8) — test event appears in dashboard within 30s of running invocation script | `npx tsx scripts/sentry-test.ts` (after Bugsink running + DSN set) | Within 30 seconds, event titled "Phase 1 sentry verification — ignore me" visible in Bugsink/GlitchTip UI |
| Temporary test action deleted before phase close | `ls src/server/actions/_sentry-test.ts` | File NOT present (must be deleted in Task 8) |
| Temporary invocation script deleted before phase close | `ls scripts/sentry-test.ts` | File NOT present (must be deleted in Task 8) |

## Out of Scope (DO NOT do in this plan)

- **No source-map upload** — requires `SENTRY_AUTH_TOKEN` against a prod GlitchTip/Bugsink instance. Deferred to Phase 7 (production deploy).
- **No `sentryUrl` / `org` / `project`** in `withSentryConfig` — these point to a specific self-hosted instance; not provisioned in P1. The config has these as COMMENTED-OUT placeholders for P7 to fill in.
- **No prod DSN** — only dev DSN. P7 switches via env var change, no code change needed (we already use `process.env.*`).
- **No `tunnelRoute` option** — RESEARCH.md §Pattern 4 line 661 explicit: unsupported for self-hosted GlitchTip/Bugsink.
- **No GlitchTip/Bugsink docker-compose committed to repo** — runbook tells developer to run `docker run`; persistent infra config is P7 territory.
- **No real Server Action instrumented with manual `Sentry.captureException`** — auto-instrumentation from `@sentry/nextjs` covers Server Actions/Route Handlers automatically. Manual capture is a P2+ pattern as business-critical paths emerge.
- **No CI integration** — sending CI errors to Sentry is P6 (OPS-03).

## Done When

- All 8 tasks complete (including 7a + 7b).
- Temporary `src/server/actions/_sentry-test.ts` AND `scripts/sentry-test.ts` BOTH DELETED at phase close.
- All 11 verification checks pass (the manual one — test event in dashboard via `npx tsx scripts/sentry-test.ts` — IS required for success criterion #3 in ROADMAP; if Bugsink/GlitchTip cannot be provisioned in the P1 window, success criterion #3 is the only criterion that defers; document this in PHASE SUMMARY).
- Runbook exists so any developer can re-do the verification later via a single `npx tsx` command.
