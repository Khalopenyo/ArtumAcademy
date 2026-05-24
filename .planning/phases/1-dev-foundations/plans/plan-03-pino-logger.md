---
plan_id: 03
phase: 1-dev-foundations
title: pino structured logger singleton (dev pretty / prod JSON, redact secrets)
maps_to_req: FOUND-04
depends_on: [plan-01]
wave: 2
files_created:
  - src/lib/logger.ts
  - src/lib/logger.test.ts
files_modified:
  - .env.example
  - package.json
---

# Plan 03 — pino Structured Logger Singleton (FOUND-04)

## Goal

Single pino instance, lazy-evaluated, with `redact` configured for known secret-shaped keys. Pretty output in dev (human-readable, colorized), raw JSON in prod (stdout — log aggregators parse it natively). Server Actions and Route Handlers use `logger.child({ action, userId })` to scope context per invocation.

## Why now

- Wave 2 (depends on plan-01): logger reads `env.NODE_ENV` and `env.LOG_LEVEL`. Cannot ship before plan-01's `src/env.ts` exists.
- Blocks plan-04: `auditLog()` helper logs failures via `logger.error(...)`. If logger doesn't exist, audit-log helper has to re-derive or use console.log (worse outcome).

## Files

### Created

| Path | Purpose | Reference |
|---|---|---|
| `src/lib/logger.ts` | pino singleton via `getLogger()` + `logger` Proxy convenience export; first line `import 'server-only';` (R4 guard against Edge runtime inclusion) | RESEARCH.md §Pattern 3 lines 446–517 |
| `src/lib/logger.test.ts` | Vitest unit test using `pino.destination({ sync: true })` to a memory buffer — assert (1) JSON structure, (2) `[REDACTED]` substitution for `password`, (3) singleton identity via `Object.is` | See task 4 |

### Modified

| Path | Edit | Reference |
|---|---|---|
| `.env.example` | Append `LOG_LEVEL=info` if not already added by plan-01 (note: plan-01 task 4 already adds `LOG_LEVEL=info`. If plan-01 has merged, this is a no-op. If plan-03 lands first because of out-of-order merges, add it.) | — |
| `package.json` | Add to `dependencies`: `pino@^10.3.1`. Add to `devDependencies`: `pino-pretty@^13.1.3` | RESEARCH.md §Standard Stack lines 84–85 |

## Dependencies

**Blocks-on:** plan-01 (`env.NODE_ENV`, `env.LOG_LEVEL`).

**Blocks:** plan-04 (audit-log helper uses `logger.error()` for failure paths).

## Implementation Steps (atomic commits)

### Task 1: Verify + install pino + pino-pretty

- `npm view pino@10.3.1 maintainers homepage repository`.
- `npm view pino-pretty@13.1.3 maintainers homepage repository`.
- `npm install pino@^10.3.1`.
- `npm install -D pino-pretty@^13.1.3`.
- Verify `package.json` `dependencies.pino` and `devDependencies.pino-pretty` populated.
- `npm run typecheck` still green.
- Commit: `chore(p1): install pino + pino-pretty for structured logging (FOUND-04)`.

### Task 2: Create `src/lib/logger.ts`

- Copy verbatim from RESEARCH.md §Pattern 3 lines 446–517.
- **First line MUST be `import 'server-only';`** — guards against the pino-in-Edge-runtime crash documented in R4 / RESEARCH.md §Pattern 3 line 541.
- Imports `env` from `@/env`.
- Defines `isDev` and `isTest` const based on `env.NODE_ENV`.
- Exports two surfaces:
  - `getLogger()` — explicit factory returning the singleton.
  - `logger` — Proxy over `getLogger()` for ergonomic `import { logger } from '@/lib/logger'`.
- `redact.paths` must include AT MINIMUM (per RESEARCH.md §Pattern 3 lines 469–482):
  - `password`, `*.password`
  - `token`, `*.token`
  - `authorization`, `headers.authorization`, `req.headers.authorization`
  - `headers.cookie`, `req.headers.cookie`
  - `YOOKASSA_SECRET_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `KINESCOPE_PRIVATE_API_TOKEN`
- `redact.censor: '[REDACTED]'`.
- `base: { service: 'videoedit-academy', env: env.NODE_ENV }`.
- `timestamp: pino.stdTimeFunctions.isoTime`.
- Dev transport: `transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname,service,env' } }`. **String target, NOT import** — RESEARCH.md §Pitfall 4 line 1143 (R2 in PLAN.md).
- Test transport: `level: 'silent'` (no log noise during `vitest run`).
- `npm run typecheck` green.
- Commit: `feat(p1): add pino singleton logger with redact + dev/prod transport (FOUND-04)`.

### Task 3: Update `.env.example` (conditional)

- Check if `.env.example` already has `LOG_LEVEL=info` from plan-01.
- If absent (plan-03 lands first): append `LOG_LEVEL=info   # trace|debug|info|warn|error|fatal`.
- If present: no-op for this task.
- Commit (if changed): `docs(p1): document LOG_LEVEL in .env.example (plan-03)`.

### Task 4: Add unit test `src/lib/logger.test.ts` — memory-buffer destination strategy

- **Per Fix 5**: pick ONE strategy and discard the other two. The chosen strategy is `pino.destination({ sync: true, dest: <memory stream> })` — see pino testing docs (https://github.com/pinojs/pino/blob/main/docs/help.md#help-with-testing).
- Concretely:
  1. Build a small in-memory `Writable` stream that buffers chunks into an array.
  2. Construct a one-off pino instance with the SAME `redact` and `base` config as the singleton (import the config object from `logger.ts` — refactor it into an exported `LOGGER_OPTIONS` const if needed for testability), pointed at `pino.destination({ sync: true, dest: <our Writable> })`. This bypasses the Proxy singleton complexity AND avoids stdout pollution.
  3. Assert structure and redaction directly on the buffered chunks.
- File structure:
  ```ts
  // src/lib/logger.test.ts
  import { describe, it, expect } from 'vitest';
  import pino from 'pino';
  import { Writable } from 'node:stream';
  import { LOGGER_OPTIONS, getLogger } from './logger'; // export LOGGER_OPTIONS from logger.ts for test reuse

  function makeBufferedLogger() {
    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); },
    });
    const dest = pino.destination({ sync: true, dest: stream as any });
    // Use bare pino options (no transport — transport is for prod/dev runtime, not tests).
    const { transport: _transport, ...optsForTest } = LOGGER_OPTIONS as any;
    const instance = pino(optsForTest, dest);
    return { instance, chunks };
  }

  describe('logger', () => {
    it('writes a JSON line with expected structure', () => {
      const { instance, chunks } = makeBufferedLogger();
      instance.info({ foo: 'bar' }, 'hello world');
      expect(chunks.length).toBe(1);
      const parsed = JSON.parse(chunks[0]);
      expect(parsed.msg).toBe('hello world');
      expect(parsed.foo).toBe('bar');
      expect(parsed.service).toBe('videoedit-academy');
      expect(parsed.level).toBeDefined();
      expect(parsed.time).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO-time
    });

    it('redacts password field as [REDACTED]', () => {
      const { instance, chunks } = makeBufferedLogger();
      instance.info({ password: 'secret123' }, 'creds');
      const parsed = JSON.parse(chunks[0]);
      expect(parsed.password).toBe('[REDACTED]');
      // Defense-in-depth: raw secret value must not appear anywhere in the serialized line.
      expect(chunks[0]).not.toContain('secret123');
    });

    it('returns the same instance on repeated getLogger() calls (singleton)', () => {
      const a = getLogger();
      const b = getLogger();
      expect(Object.is(a, b)).toBe(true);
    });
  });
  ```
- Refactor note for `logger.ts`: export the options object as `LOGGER_OPTIONS` (or `loggerOptions`) so the test can import and reuse it. The singleton factory passes `LOGGER_OPTIONS` to `pino(...)` internally.
- Run `npm run test:ci -- src/lib/logger.test.ts` → all 3 tests pass.
- Commit: `test(p1): cover pino structure + redact + singleton (FOUND-04)`.

### Task 5: Smoke check — dev pretty + prod JSON output

- Manual smoke (not committed; for developer confidence):
  ```bash
  # Dev (pretty):
  NODE_ENV=development LOG_LEVEL=info npx tsx -e "
    const { logger } = require('./src/lib/logger.ts');
    logger.info({ password: 'should_be_redacted', test: 1 }, 'hello dev');
  "
  # Expect colorized pretty line, `password` shown as `[REDACTED]`.

  # Prod (raw JSON):
  NODE_ENV=production LOG_LEVEL=info npx tsx -e "
    const { logger } = require('./src/lib/logger.ts');
    logger.info({ password: 'should_be_redacted', test: 1 }, 'hello prod');
  "
  # Expect single JSON line on stdout with `"password":"[REDACTED]"`.
  ```
- `tsx` is installed in plan-01 task 1; no extra install needed.
- Eyeball verification only — Task 4 covers reproducible test coverage.

## Verification (acceptance criteria for FOUND-04)

| Check | Command | Expected Output |
|---|---|---|
| Lint green | `npm run lint` | Exit 0 |
| Typecheck green | `npm run typecheck` | Exit 0 |
| Unit tests pass (structure + redact + singleton) | `npm run test:ci -- src/lib/logger.test.ts` | All 3 tests pass |
| Build green | `npm run build` | Exit 0; no `pino-pretty` in client bundle (R2 guard) |
| Logger file has `import 'server-only';` first line | `head -1 src/lib/logger.ts` | `import 'server-only';` |
| Redact paths list complete | Inspect `src/lib/logger.ts` | Must include all 11 paths from RESEARCH.md §Pattern 3 lines 469–482 |
| `LOGGER_OPTIONS` exported for test reuse | `grep -n "export const LOGGER_OPTIONS\|export.*loggerOptions" src/lib/logger.ts` | One match (the export) |

## Out of Scope (DO NOT do in this plan)

- **No actual Server Action wired** — pino is available; first real consumer is plan-04's `auditLog()` helper (failure path). P2+ Server Actions adopt logger as they're built.
- **No middleware integration** — `src/middleware.ts` runs in Edge; pino crashes there (RESEARCH.md §Pattern 3 line 541). If middleware needs structured logs, future plan uses `console.log(JSON.stringify(...))`. Plan-03 explicitly forbids logger import in middleware via the `import 'server-only'` first line (build-time error if attempted).
- **No log aggregator wiring** — Vercel auto-captures stdout JSON; Yandex Cloud likewise. P7 may add custom shipper, not P1.
- **No request-scoped logger via AsyncLocalStorage** — RESEARCH.md §Open Q #3 recommends per-call `logger.child({ action, userId })` instead. P2+ Server Actions follow this pattern, not a global AsyncLocalStorage wrapper.

## Done When

- All 5 tasks complete.
- All 7 verification checks pass.
- A different developer can `import { logger } from '@/lib/logger'` from any Server Action / Route Handler and emit structured JSON with confidence that secrets are redacted.
