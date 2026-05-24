// @vitest-environment node
/**
 * Unit tests for src/env.ts (FOUND-02, plan-01).
 *
 * NOTE: vitest's default environment in this repo is `jsdom`, which makes
 * `@t3-oss/env-nextjs` treat reads as client-side (it inspects `typeof window`).
 * Server-only variables then trip the `onInvalidAccess` guard. We pin this
 * file to `node` so `process.env.*` reads behave as if at server runtime.
 *
 * `@t3-oss/env-nextjs` evaluates `createEnv()` at module-load time.
 * To exercise different env shapes per test we:
 *   1. `vi.stubEnv(...)` each required variable for the current case.
 *   2. `vi.resetModules()` so the next `import('./env')` re-runs evaluation.
 *   3. `vi.unstubAllEnvs()` between tests to keep cases independent.
 *
 * The env parser is configured with `emptyStringAsUndefined: true`, so
 * we treat empty-string assignments as "missing" (see Case 6).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `@t3-oss/env-nextjs` throws a generic `Error('Invalid environment variables')`
 * but logs the underlying ZodIssue array via `console.error` immediately before.
 * Capture those calls so we can assert which variable failed.
 */
let errorSpy: ReturnType<typeof vi.spyOn>;

function consoleErrorOutput(): string {
  return errorSpy.mock.calls.map((c) => JSON.stringify(c)).join('\n');
}

/**
 * A complete, valid env baseline. Each test starts from this set and
 * mutates a single field to provoke the desired failure (or none).
 */
const BASELINE = {
  NODE_ENV: 'development',
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

function applyEnv(overrides: Partial<Record<keyof typeof BASELINE | string, string | undefined>>) {
  const merged: Record<string, string | undefined> = { ...BASELINE, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    vi.stubEnv(k, v ?? '');
  }
}

beforeEach(() => {
  vi.resetModules();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  errorSpy.mockRestore();
});

describe('src/env.ts (Zod env parser)', () => {
  it('Happy path: parses fully-valid env and exposes typed string fields', async () => {
    applyEnv({});
    const { env } = await import('./env');
    expect(typeof env.SUPABASE_SERVICE_ROLE_KEY).toBe('string');
    expect(env.SUPABASE_SERVICE_ROLE_KEY.length).toBeGreaterThanOrEqual(40);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^http/);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('Missing required: throws when SUPABASE_SERVICE_ROLE_KEY is absent', async () => {
    applyEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    await expect(import('./env')).rejects.toThrow(/Invalid environment variables/);
    expect(consoleErrorOutput()).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('Invalid URL: throws when SENTRY_DSN is not a URL', async () => {
    applyEnv({ SENTRY_DSN: 'not-a-url' });
    await expect(import('./env')).rejects.toThrow(/Invalid environment variables/);
    expect(consoleErrorOutput()).toMatch(/SENTRY_DSN/);
    expect(consoleErrorOutput()).toMatch(/url|URL/i);
  });

  it('Too-short JWT: throws when SUPABASE_SERVICE_ROLE_KEY shorter than 40 chars', async () => {
    applyEnv({ SUPABASE_SERVICE_ROLE_KEY: 'short' });
    await expect(import('./env')).rejects.toThrow(/Invalid environment variables/);
    expect(consoleErrorOutput()).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('Too-short path secret: throws when YOOKASSA_WEBHOOK_PATH_SECRET shorter than 32 chars', async () => {
    applyEnv({ YOOKASSA_WEBHOOK_PATH_SECRET: 'short' });
    await expect(import('./env')).rejects.toThrow(/Invalid environment variables/);
    expect(consoleErrorOutput()).toMatch(/YOOKASSA_WEBHOOK_PATH_SECRET/);
  });

  it('Empty string treated as undefined: SMTP_HOST="" passes (optional field)', async () => {
    applyEnv({ SMTP_HOST: '' });
    // Should NOT throw — emptyStringAsUndefined: true makes "" flow into .optional()
    const { env } = await import('./env');
    expect(env.SMTP_HOST).toBeUndefined();
  });
});
