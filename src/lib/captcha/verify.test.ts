// @vitest-environment node
/**
 * Unit tests for src/lib/captcha/verify.ts (AUTH-09, plan-06).
 *
 * Mocking strategy:
 *   - `server-only` → no-op.
 *   - `@/lib/logger` → stubbed so warn/error logs are silent AND assertable.
 *   - `fetch` is replaced via `vi.stubGlobal('fetch', vi.fn())`. Each test
 *     resets it via `vi.unstubAllGlobals()` in afterEach.
 *   - `process.env.YANDEX_CAPTCHA_SERVER_KEY` is managed via `vi.stubEnv` so
 *     the missing-secret case can clear it without leaking to other tests.
 *
 * Cases (5 mandatory per plan-06 Task 2 §6):
 *   1. happy path: secret set, fetch resolves { status: 'ok' } → ok=true
 *   2. Yandex rejects: fetch resolves { status: 'failed' } → ok=false, reason='invalid'
 *   3. network error: fetch throws → ok=false, reason='network'
 *   4. HTTP error: fetch resolves res.ok=false → ok=false, reason='network'
 *   5. missing secret: YANDEX_CAPTCHA_SERVER_KEY absent → ok=false, reason='server_misconfig'
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyCaptcha } from './verify';

vi.mock('server-only', () => ({}));

const { loggerErrorMock, loggerWarnMock } = vi.hoisted(() => ({
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
    info: vi.fn(),
  },
  getLogger: () => ({
    error: loggerErrorMock,
    warn: loggerWarnMock,
    info: vi.fn(),
  }),
}));

beforeEach(() => {
  loggerErrorMock.mockClear();
  loggerWarnMock.mockClear();
  // Default: server key present (most tests want this — Case 5 overrides).
  vi.stubEnv('YANDEX_CAPTCHA_SERVER_KEY', 'test-secret-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('verifyCaptcha', () => {
  it('1. happy path — secret set, fetch resolves { status: ok } → ok=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', host: 'localhost' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyCaptcha('valid-token', '203.0.113.5');
    expect(result).toEqual({ ok: true });

    // POST to the documented Yandex endpoint with form-urlencoded body.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://smartcaptcha.cloud.yandex.ru/validate');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    // URLSearchParams contains the secret, token, and ip.
    const body = init.body as URLSearchParams;
    expect(body.get('secret')).toBe('test-secret-key');
    expect(body.get('token')).toBe('valid-token');
    expect(body.get('ip')).toBe('203.0.113.5');
  });

  it('2. Yandex rejects — fetch resolves { status: failed } → ok=false, reason=invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'failed', message: 'token expired' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyCaptcha('expired-token', '203.0.113.5');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'token expired' }),
      'captcha rejected by Yandex',
    );
  });

  it('3. network error — fetch throws → ok=false, reason=network', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyCaptcha('any-token', null);
    expect(result).toEqual({ ok: false, reason: 'network' });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'captcha validate threw',
    );
  });

  it('4. HTTP error — fetch resolves res.ok=false → ok=false, reason=network', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyCaptcha('any-token', null);
    // STRICT in P2: HTTP errors block submission (Pattern 6 docstring).
    expect(result).toEqual({ ok: false, reason: 'network' });
    expect(loggerWarnMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 }),
      'captcha validate HTTP error',
    );
  });

  it('5. missing secret — YANDEX_CAPTCHA_SERVER_KEY absent → ok=false, reason=server_misconfig', async () => {
    vi.stubEnv('YANDEX_CAPTCHA_SERVER_KEY', '');
    // fetch should NEVER be called when the secret is missing.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await verifyCaptcha('any-token', '203.0.113.5');
    expect(result).toEqual({ ok: false, reason: 'server_misconfig' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledWith('YANDEX_CAPTCHA_SERVER_KEY missing');
  });

  it('omits ip from body when caller passes null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await verifyCaptcha('token', null);
    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get('ip')).toBeNull();
    expect(body.get('secret')).toBe('test-secret-key');
    expect(body.get('token')).toBe('token');
  });
});
