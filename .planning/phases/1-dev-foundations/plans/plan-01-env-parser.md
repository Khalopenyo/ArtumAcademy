---
plan_id: 01
phase: 1-dev-foundations
title: Env Zod parser via @t3-oss/env-nextjs
maps_to_req: FOUND-02
depends_on: []
wave: 1
files_created:
  - src/env.ts
  - src/instrumentation.ts
  - src/env.test.ts
files_modified:
  - .env.example
  - package.json
---

# Plan 01 — Env Zod Parser (FOUND-02)

## Goal

`src/env.ts` validates every required secret via Zod at process boot. Missing or malformed env fails the build AND fails `next dev`/`next start` boot with a clear ZodError message. App code imports typed `env` instead of touching `process.env` directly.

## Why now

- **First** in the wave: every other plan in P1 references `env.SUPABASE_*` / `env.SENTRY_DSN` / `env.NODE_ENV` / `env.LOG_LEVEL`. Without this, every other plan would either re-derive a parser OR read `process.env` raw and lose type safety.
- Pitfall #5 (R5 in PLAN.md): without explicit build-time hook, env validation only fires at runtime — broken prod env ships. Plan-01 closes this by adding a `prebuild` script that runs `tsx src/env.ts` before every `next build`.

## Files

### Created

| Path | Purpose | Reference (copy-paste source) |
|---|---|---|
| `src/env.ts` | `createEnv()` call with `server` + `client` + `runtimeEnv` blocks; exports typed `env` object | RESEARCH.md §Pattern 1 lines 239–301 |
| `src/instrumentation.ts` | Next.js boot hook — `register()` forces `await import('./env')` so validation runs once at process start | RESEARCH.md §Pattern 1 lines 307–319 (env-only portion; Sentry imports added in plan-05) |
| `src/env.test.ts` | Vitest unit test: assert schema rejects invalid env (short JWT, invalid URL, empty required field) | Adapt RESEARCH.md schema rules; see Implementation Steps task 5 |

### Modified

| Path | Edit | Reference |
|---|---|---|
| `.env.example` | Append all new env vars listed in `src/env.ts` schema with placeholder values + comments | See task 4 below |
| `package.json` | (a) Add to `dependencies`: `@t3-oss/env-nextjs@^0.13.11`. (b) Add to `devDependencies`: `tsx@^4`. (c) Add `"prebuild": "tsx src/env.ts"` to `scripts`. | RESEARCH.md §Standard Stack line 82 + §Pitfall 2 line 1130 |

NOTE: `next.config.js` is **NOT modified** in this plan. The earlier draft called for `require('./src/env')` inside `next.config.js`, but that file is CommonJS and `src/env.ts` is ESM+TS — `require('./src/env')` would crash (no TS loader at config evaluation). Build-time validation is enforced via the `prebuild` npm script (Task 5 below) which runs `tsx src/env.ts` BEFORE `next build` executes. plan-05 is the only Phase 1 plan that touches `next.config.js`.

## Dependencies

**Blocks-on:** nothing. First plan in the wave.

**Blocks:** plan-03 (logger uses `env.NODE_ENV` + `env.LOG_LEVEL`), plan-04 (audit-log uses admin client which uses `env.SUPABASE_*`), plan-05 (Sentry uses `env.SENTRY_DSN` + `env.NEXT_PUBLIC_SENTRY_DSN`).

## Implementation Steps (atomic commits)

### Task 1: Verify package + install `@t3-oss/env-nextjs` + `tsx`

- Run `npm view @t3-oss/env-nextjs@0.13.11 maintainers homepage repository` to confirm registry record matches RESEARCH.md §Package Legitimacy Audit line 129.
- Run `npm view tsx@4 maintainers homepage repository` to confirm tsx is the published `@esbuild-kit`-successor by `esbuild-kit` org (now `privatenumber`).
- `npm install @t3-oss/env-nextjs@^0.13.11`.
- `npm install -D tsx@^4`.
- Verify `package.json` `dependencies` includes `@t3-oss/env-nextjs` and `devDependencies` includes `tsx`; `package-lock.json` updated.
- `npm run typecheck` should still pass (no code change yet).
- Commit: `chore(p1): install @t3-oss/env-nextjs + tsx for env parser`.

### Task 2: Create `src/env.ts`

- Copy schema from RESEARCH.md §Pattern 1 lines 239–301 verbatim.
- Include both `server` and `client` blocks per the snippet.
- Required server vars (must be present): `NODE_ENV` (with `.default`), `SUPABASE_SERVICE_ROLE_KEY` (min 40 chars), `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_WEBHOOK_PATH_SECRET` (min 32 chars), `KINESCOPE_PROJECT_ID`, `KINESCOPE_PRIVATE_API_TOKEN`, `SENTRY_DSN` (url), `LOG_LEVEL` (enum with `.default('info')`).
- Optional server vars (`.optional()`): `SMTP_HOST`, `YANDEX_CAPTCHA_SERVER_KEY` (these are P2/P7 — present for type completeness).
- Required client vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SITE_URL` (`.default('http://localhost:3000')`).
- Optional client vars (`.optional()`): `NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY`.
- `runtimeEnv` block must list every variable explicitly (Next.js requires this).
- Set `emptyStringAsUndefined: true`.
- **IMPORTANT**: `src/env.ts` must execute its `createEnv()` at module load (top-level side effect). The `prebuild` script (Task 5) runs `tsx src/env.ts` directly — if the schema only constructs lazily, the build won't catch missing vars. `@t3-oss/env-nextjs` evaluates at module load by default; do NOT wrap in a factory function.
- `npm run typecheck` must pass.
- Commit: `feat(p1): add Zod env parser src/env.ts (FOUND-02)`.

### Task 3: Create `src/instrumentation.ts` (env-only — Sentry imports added in plan-05)

- Export an `async function register()`.
- Inside, call `await import('./env')` unconditionally — this triggers validation on the FIRST boot of the Next.js process (covers `next dev` / `next start` runtime; build-time is covered separately by the prebuild script in Task 5).
- Do NOT yet add Sentry imports — those land in plan-05 (plan-05 will modify this file additively).
- Next.js 14 auto-discovers `src/instrumentation.ts` if `src/` layout is in use (it is per `tsconfig.json` paths).
- Commit: `feat(p1): wire env validation via instrumentation.ts (FOUND-02)`.

### Task 4: Update `.env.example`

- Read current `.env.example` to see existing entries.
- Append a clearly delimited block:
  ```
  # =====================================================================
  # Added in Phase 1 / plan-01 (FOUND-02) — env Zod parser requirements
  # =====================================================================
  YOOKASSA_SHOP_ID=
  YOOKASSA_SECRET_KEY=
  YOOKASSA_WEBHOOK_PATH_SECRET=   # 32+ hex chars; generate via `openssl rand -hex 32`
  KINESCOPE_PROJECT_ID=
  KINESCOPE_PRIVATE_API_TOKEN=
  # SMTP_HOST=                     # optional in P1; P2 default uses Supabase SMTP
  # YANDEX_CAPTCHA_SERVER_KEY=     # optional in P1; P2 wires SmartCaptcha
  # YANDEX_CAPTCHA_CLIENT_KEY surfaces as NEXT_PUBLIC_* below
  LOG_LEVEL=info                   # trace|debug|info|warn|error|fatal
  # NEXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY=  # optional in P1; P2 wires SmartCaptcha
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  ```
- DO NOT add `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` yet — those land in plan-05's `.env.example` patch (kept atomic per plan).
- DO NOT add real values; placeholders only.
- Commit: `docs(p1): document new env vars in .env.example (plan-01)`.

### Task 5: Add `prebuild` npm script for build-time env validation

- Read current `package.json` `scripts` block.
- Add NEW script entry (alphabetically placed between existing scripts; `prebuild` runs automatically before `build` per npm lifecycle convention):
  ```json
  "prebuild": "tsx src/env.ts",
  ```
- Rationale (in commit message + recorded here): `next.config.js` is CommonJS without a TS loader at config evaluation; `require('./src/env')` would crash because `src/env.ts` is ESM+TS. The `prebuild` npm script runs `tsx src/env.ts` directly before `next build`, executing the schema (Task 2 ensures top-level evaluation) and crashing the build if any required env var is missing/invalid. The earlier draft of this plan called for `require('./src/env')` in `next.config.js` — that approach is abandoned; this task supersedes it.
- DO NOT modify `next.config.js` in this plan. Preserve the existing `next.config.js` UNTOUCHED (`reactStrictMode`, `poweredByHeader`, `images.remotePatterns`, `experimental.serverActions`, `headers()`). plan-05 is the only Phase 1 plan that edits `next.config.js`.
- Verification:
  - `npm run prebuild` with all required env present → exit 0, no output (or minimal output if schema logs).
  - `SUPABASE_SERVICE_ROLE_KEY= npm run prebuild` → exit non-zero with ZodError mentioning `SUPABASE_SERVICE_ROLE_KEY`.
  - `npm run build` (which auto-invokes `prebuild` first) → if env invalid, fails at `prebuild` step before `next build` even starts.
- Commit: `chore(p1): add prebuild script for build-time env validation (FOUND-02)`.

### Task 6: Add unit test `src/env.test.ts`

- Mock `process.env` for each test case (use `vi.stubEnv` / `vi.unstubAllEnvs`).
- Test cases (minimum):
  1. **Happy path**: all required vars set to valid values → `createEnv()` returns object with typed fields; `env.SUPABASE_SERVICE_ROLE_KEY` is a string.
  2. **Missing required**: omit `SUPABASE_SERVICE_ROLE_KEY` → schema throws with message mentioning "SUPABASE_SERVICE_ROLE_KEY".
  3. **Invalid URL**: `SENTRY_DSN=not-a-url` → schema throws with "url" / "invalid" message.
  4. **Too-short JWT**: `SUPABASE_SERVICE_ROLE_KEY="short"` → schema throws with min-length error.
  5. **Too-short path secret**: `YOOKASSA_WEBHOOK_PATH_SECRET="short"` → schema throws.
  6. **Empty string treated as undefined**: `SMTP_HOST=""` (optional field) → does NOT throw.
- Use Vitest `expect().toThrow()` pattern.
- Run `npm run test:ci -- src/env.test.ts` → all tests pass.
- Commit: `test(p1): cover env Zod schema edge cases (FOUND-02)`.

### Task 7: Full repo smoke check

- `npm run lint` → green.
- `npm run typecheck` → green.
- `npm run test:ci` → green (includes new env.test.ts).
- `npm run prebuild` → green (proves prebuild step works with current `.env.local`).
- `npm run build` → green (auto-invokes prebuild first, then `next build`).
- Optional smoke (manual): temporarily `unset SUPABASE_SERVICE_ROLE_KEY` in shell → `npm run build` → expect prebuild step to fail with ZodError mentioning `SUPABASE_SERVICE_ROLE_KEY` → restore env var.
- Commit: none (smoke verification only).

## Verification (acceptance criteria for FOUND-02)

| Check | Command | Expected Output |
|---|---|---|
| Lint green | `npm run lint` | Exit 0, no errors |
| Typecheck green | `npm run typecheck` | Exit 0 |
| Unit tests green | `npm run test:ci -- src/env.test.ts` | All 6 cases pass |
| prebuild green with valid env | `npm run prebuild` | Exit 0 |
| Build green with valid env | `npm run build` | Exits 0, `.next/` produced (prebuild runs first, then `next build`) |
| Prebuild fails with missing env (smoke) | `SUPABASE_SERVICE_ROLE_KEY= npm run prebuild` | Exit non-zero; stderr mentions ZodError + `SUPABASE_SERVICE_ROLE_KEY` |
| Build fails with missing env (smoke) | `SUPABASE_SERVICE_ROLE_KEY= npm run build` | Exit non-zero at the `prebuild` step (before `next build` starts) |
| Typed import works | In a TS file: `import { env } from '@/env'; const k: string = env.SUPABASE_SERVICE_ROLE_KEY;` | Compiles without `Type 'string \| undefined' is not assignable to type 'string'` |

## Out of Scope (DO NOT do in this plan)

- **No Sentry init** — plan-05 owns Sentry wiring even though `env.SENTRY_DSN` is declared here.
- **No logger wiring** — plan-03 owns pino integration.
- **No admin client** — plan-02 owns `src/lib/supabase/admin.ts`.
- **No `.env.local` modifications** — local secrets are per-developer; this plan only updates `.env.example`.
- **No new env vars beyond the schema in RESEARCH.md §Pattern 1** — Webhook-specific or Kinescope JWT secrets that future phases need are NOT added speculatively.
- **No `next.config.js` modifications** — plan-05 is the only P1 plan that touches `next.config.js` (to wrap with `withSentryConfig`).

## Done When

- All 7 tasks above committed.
- All verification checks pass on a clean machine with `.env.local` populated from `.env.example`.
- A different developer can read this plan + RESEARCH.md §Pattern 1 and execute without asking clarifying questions.
