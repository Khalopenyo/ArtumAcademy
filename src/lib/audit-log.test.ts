// @vitest-environment node
/**
 * Unit tests for src/lib/audit-log.ts (FOUND-05, plan-04).
 *
 * Mocking strategy:
 *   - `server-only` is mocked to a no-op (it throws at import time outside
 *     Next.js RSC bundling — same pattern as src/lib/logger.test.ts).
 *   - `next/headers` is mocked with a default `Headers` instance; individual
 *     test cases override via `vi.mocked(headers).mockReturnValueOnce(...)`.
 *     IMPORTANT (Fix 6): we use `new Headers(...)` NOT `new Map(...)`.
 *     Next.js `headers()` returns `ReadonlyHeaders` (a `Headers`-like,
 *     CASE-INSENSITIVE object). Mocking with `Map` would silently miss
 *     `X-Forwarded-For` vs `x-forwarded-for` casing — a real bug observed
 *     behind load balancers that uppercase the header. Case 2 below
 *     explicitly proves case-insensitivity.
 *   - `@/lib/supabase/admin.createAdminClient` is mocked to return a fake
 *     chain `from() → insert()` where `insert` is a vi.fn we assert on.
 *   - `@/lib/logger` is mocked to no-op so logger.error doesn't pollute
 *     test stdout and so we can assert it was called on failure paths.
 *
 * Test cases (9 mandatory per plan-04 Task 4):
 *   1. IP from x-forwarded-for first hop (lowercase header)
 *   2. IP from X-Forwarded-For first hop (uppercase header — Fix 6 case-insens)
 *   3. User-Agent captured into user_agent column
 *   4. Fallback to x-real-ip when x-forwarded-for absent
 *   5. ip_address = null when no headers present
 *   6. Helper does NOT throw on insert failure (insert returns {error: ...})
 *   7. Helper does NOT throw if headers() itself throws (non-request ctx)
 *   8. meta defaults to {} when not supplied
 *   9. auditLogContextless uses passed IP/UA (bypasses headers())
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { headers } from 'next/headers';

import { auditLog, auditLogContextless } from './audit-log';

vi.mock('server-only', () => ({}));

// vi.hoisted() — vitest hoists vi.mock(...) calls to the top of the file
// BEFORE any top-level `const` declarations execute. Without vi.hoisted,
// the factory closures below would close over uninitialized bindings
// (ReferenceError: Cannot access 'insertMock' before initialization).
// vi.hoisted runs the callback in the same hoisted phase, so the resulting
// bindings ARE available inside the factories.
const { insertMock, loggerErrorMock } = vi.hoisted(() => ({
  insertMock: vi.fn().mockResolvedValue({ error: null }),
  loggerErrorMock: vi.fn(),
}));

// Default mock — most tests override via mockReturnValueOnce below.
vi.mock('next/headers', () => ({
  headers: vi.fn(
    () =>
      new Headers({
        'x-forwarded-for': '203.0.113.42, 10.0.0.1',
        'user-agent': 'Test Agent 1.0',
      }),
  ),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

// Stub logger so logger.error doesn't pollute test output AND so we can
// assert that failure paths actually log.
vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn() },
  getLogger: () => ({ error: loggerErrorMock, info: vi.fn(), warn: vi.fn() }),
}));

const mockedHeaders = vi.mocked(headers);

beforeEach(() => {
  insertMock.mockClear();
  insertMock.mockResolvedValue({ error: null });
  loggerErrorMock.mockClear();
  mockedHeaders.mockReset();
  // Restore the default mock (most tests want this — Cases 2/4/5/7 override).
  mockedHeaders.mockReturnValue(
    new Headers({
      'x-forwarded-for': '203.0.113.42, 10.0.0.1',
      'user-agent': 'Test Agent 1.0',
    }) as ReturnType<typeof headers>,
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('auditLog', () => {
  it('1. captures IP from x-forwarded-for first hop (lowercase header)', async () => {
    await auditLog({ userId: 'user-1', action: 'test.event' });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: '203.0.113.42',
        action: 'test.event',
        user_id: 'user-1',
      }),
    );
  });

  it('2. captures IP from X-Forwarded-For (uppercase header — proves case-insensitive Headers, Fix 6)', async () => {
    mockedHeaders.mockReturnValueOnce(
      new Headers({
        'X-Forwarded-For': '198.51.100.99, 10.0.0.2',
        'User-Agent': 'Uppercase UA',
      }) as ReturnType<typeof headers>,
    );
    await auditLog({ userId: 'user-2', action: 'test.case.event' });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: '198.51.100.99',
        user_agent: 'Uppercase UA',
      }),
    );
  });

  it('3. captures User-Agent into the user_agent column', async () => {
    await auditLog({ userId: 'user-3', action: 'test.ua' });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_agent: 'Test Agent 1.0',
      }),
    );
  });

  it('4. falls back to x-real-ip when x-forwarded-for is absent', async () => {
    mockedHeaders.mockReturnValueOnce(
      new Headers({
        'x-real-ip': '192.0.2.55',
        'user-agent': 'NoXFF UA',
      }) as ReturnType<typeof headers>,
    );
    await auditLog({ userId: 'user-4', action: 'test.fallback' });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: '192.0.2.55',
        user_agent: 'NoXFF UA',
      }),
    );
  });

  it('5. inserts ip_address: null when no IP headers are present', async () => {
    mockedHeaders.mockReturnValueOnce(new Headers({}) as ReturnType<typeof headers>);
    await auditLog({ userId: 'user-5', action: 'test.no.ip' });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: null,
        user_agent: null,
      }),
    );
  });

  it('6. does NOT throw on insert failure (returns undefined, logs via pino)', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'simulated insert failure' } });
    await expect(
      auditLog({ userId: 'user-6', action: 'test.fail' }),
    ).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ message: 'simulated insert failure' }),
      }),
      'auditLog insert failed',
    );
  });

  it('7. does NOT throw when headers() itself throws (non-request context)', async () => {
    mockedHeaders.mockImplementationOnce(() => {
      throw new Error('headers() called outside a request');
    });
    await expect(
      auditLog({ userId: 'user-7', action: 'test.no.context' }),
    ).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'auditLog helper crashed',
    );
    // insert never reached because headers() threw before createAdminClient().
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('8. meta defaults to empty object {} when not supplied', async () => {
    await auditLog({ userId: 'user-8', action: 'test.no.meta' });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {},
      }),
    );
  });
});

describe('auditLogContextless', () => {
  it('9. uses passed IP/UA instead of headers() (bypasses request context entirely)', async () => {
    await auditLogContextless({
      userId: 'user-9',
      action: 'cron.cleanup',
      ipAddress: '10.10.10.10',
      userAgent: 'cron/1.0',
      entityType: 'job',
      entityId: 'job-abc-123',
      meta: { rowsCleaned: 42 },
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ip_address: '10.10.10.10',
        user_agent: 'cron/1.0',
        action: 'cron.cleanup',
        entity_type: 'job',
        entity_id: 'job-abc-123',
        meta: { rowsCleaned: 42 },
        user_id: 'user-9',
      }),
    );
    // Crucially, headers() must NOT have been touched.
    expect(mockedHeaders).not.toHaveBeenCalled();
  });

  it('does NOT throw on insert failure (mirrors auditLog no-throw contract)', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'ctx-less fail' } });
    await expect(
      auditLogContextless({ userId: 'u', action: 'a' }),
    ).resolves.toBeUndefined();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ message: 'ctx-less fail' }),
      }),
      'auditLogContextless insert failed',
    );
  });
});
