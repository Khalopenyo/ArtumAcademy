// @vitest-environment node
/**
 * Unit tests for src/lib/logger.ts (FOUND-04, plan-03).
 *
 * Strategy: memory-buffer destination via `pino.destination({ sync: true })`.
 *   - Builds a one-off pino instance with the SAME LOGGER_OPTIONS the
 *     singleton uses (minus `transport`, which is for prod/dev stdout —
 *     tests point pino at an in-memory Writable instead).
 *   - Asserts structure (JSON line, base fields, ISO time) and redaction
 *     (`password: 'secret123'` → `[REDACTED]`, raw value absent from line).
 *   - Verifies singleton identity via `Object.is(getLogger(), getLogger())`.
 *
 * NOTE: vitest's default environment in this repo is `jsdom`. `server-only`
 * inside logger.ts errors out when imported under jsdom (it checks for a
 * client-side global). Pinning to `node` runs the file as a server module.
 *
 * env stubbing mirrors src/env.test.ts: we resetModules + stubEnv before
 * dynamic import so the typed `env` proxy from @/env loads with valid values.
 */

import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import pino from 'pino';

/**
 * Mock the `server-only` sentinel.
 *
 * `server-only` throws at import time outside Next.js's RSC bundling context
 * (its purpose is to fail the build when a server module is imported from a
 * Client Component). In unit-tests run under Node via vitest we want the
 * sentinel to be a no-op — the bundler-level guarantee is provided by
 * Next.js + ESLint (admin.lint.test.ts), not by this test.
 *
 * `vi.mock` is hoisted by vitest, so it applies before `import './logger'`
 * executes the `import 'server-only'` statement.
 */
vi.mock('server-only', () => ({}));

/**
 * Minimum valid env shape — keep in sync with src/env.test.ts BASELINE.
 * Logger only reads NODE_ENV + LOG_LEVEL, but @t3-oss/env-nextjs evaluates
 * the entire createEnv schema at module load, so all required keys must be set.
 */
const BASELINE_ENV = {
  NODE_ENV: 'test',
  SUPABASE_SERVICE_ROLE_KEY: 'a'.repeat(44),
  YOOKASSA_SHOP_ID: '123456',
  YOOKASSA_SECRET_KEY: 'test_secret_value',
  YOOKASSA_WEBHOOK_PATH_SECRET: 'b'.repeat(32),
  KINESCOPE_PROJECT_ID: 'proj_test',
  KINESCOPE_PRIVATE_API_TOKEN: 'kin_test_token',
  SENTRY_DSN: 'https://example@sentry.io/1',
  LOG_LEVEL: 'info',
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'c'.repeat(44),
  NEXT_PUBLIC_SENTRY_DSN: 'https://example@sentry.io/1',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
} as const;

function applyBaselineEnv() {
  for (const [k, v] of Object.entries(BASELINE_ENV)) {
    vi.stubEnv(k, v);
  }
}

beforeEach(() => {
  vi.resetModules();
  applyBaselineEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Build a pino instance that writes synchronously into an in-memory buffer.
 * Reuses the production LOGGER_OPTIONS (redact + base + timestamp) so the
 * test assertions hold for the actual config the singleton uses.
 *
 * Pass the Writable directly as pino's second `destination` arg
 * (`pino(opts, stream)`). `pino.destination` would wrap it in SonicBoom,
 * which only accepts file descriptors — see pino testing docs
 * https://github.com/pinojs/pino/blob/main/docs/help.md#help-with-testing.
 *
 * We strip:
 *   - `transport` — transports run in a worker thread + write to stdout;
 *     tests need a synchronous, in-process write to a Writable we control.
 *   - level override — tests need INFO emitted even though the singleton
 *     runs at `silent` under NODE_ENV=test.
 */
async function makeBufferedLogger() {
  const { LOGGER_OPTIONS } = await import('./logger');
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { transport: _transport, level: _level, ...optsForTest } = LOGGER_OPTIONS;
  const instance = pino({ ...optsForTest, level: 'info' }, stream);
  return { instance, chunks };
}

describe('logger', () => {
  it('writes a JSON line with expected structure', async () => {
    const { instance, chunks } = await makeBufferedLogger();
    instance.info({ foo: 'bar' }, 'hello world');
    expect(chunks).toHaveLength(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.msg).toBe('hello world');
    expect(parsed.foo).toBe('bar');
    expect(parsed.service).toBe('videoedit-academy');
    expect(parsed.env).toBe('test');
    expect(parsed.level).toBeDefined();
    expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO-time
  });

  it('redacts password field as [REDACTED]', async () => {
    const { instance, chunks } = await makeBufferedLogger();
    instance.info({ password: 'secret123' }, 'creds');
    expect(chunks).toHaveLength(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.password).toBe('[REDACTED]');
    // Defense-in-depth: raw secret value must not appear anywhere in the line.
    expect(chunks[0]).not.toContain('secret123');
  });

  it('returns the same instance on repeated getLogger() calls (singleton)', async () => {
    const { getLogger } = await import('./logger');
    const a = getLogger();
    const b = getLogger();
    expect(Object.is(a, b)).toBe(true);
  });
});
