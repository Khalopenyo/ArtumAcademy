// @vitest-environment node
/**
 * Unit tests for src/lib/rate-limit/index.ts (AUTH-10, plan-06).
 *
 * Mocking strategy:
 *   - `server-only` → no-op (it throws at import time outside RSC bundling —
 *     same pattern as audit-log.test.ts).
 *   - `@/lib/supabase/admin.createAdminClient` → fake supabase chain
 *     `.from('rate_limit_log').select(...).eq().eq().gte()` resolving to
 *     `{ count, error }`, and `.from('rate_limit_log').insert(...)` resolving
 *     to `{ error }`. The chain is shared via vi.hoisted so the factory
 *     closures see the same mock instances after hoisting.
 *   - `@/lib/logger` → stubbed so error logs don't pollute stdout AND so
 *     we can assert that the fail-open path actually logs.
 *
 * Cases (4 mandatory per plan-06 Task 2 §6):
 *   1. happy path: count<max → ok=true, remaining=max-used-1, insert called
 *   2. blocked at max: count>=max → ok=false, retryAfterSec=windowSec, NO insert
 *   3. fail-open on DB error (select): error returned → ok=true, remaining=max
 *   4. insert error is non-fatal: select ok, insert error → still ok=true (logged)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rateLimit } from './index';

vi.mock('server-only', () => ({}));

// Hoisted so the factory below sees the mocks after vi.mock's import-time hoist.
const { selectMock, insertMock, loggerErrorMock } = vi.hoisted(() => {
  // Chained query mock — `.select(...).eq().eq().gte()` returns the final
  // promise-like shape `{ count, error }`. We expose `selectMock` as the
  // entry point and chain the rest by returning a thenable on the last call.
  const gteMock = vi.fn();
  const eq2Mock = vi.fn(() => ({ gte: gteMock }));
  const eq1Mock = vi.fn(() => ({ eq: eq2Mock }));
  const selectM = vi.fn(() => ({ eq: eq1Mock }));
  const insertM = vi.fn();
  return {
    selectMock: { entry: selectM, gte: gteMock, eq1: eq1Mock, eq2: eq2Mock },
    insertMock: insertM,
    loggerErrorMock: vi.fn(),
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: selectMock.entry,
      insert: insertMock,
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: loggerErrorMock, info: vi.fn(), warn: vi.fn() },
  getLogger: () => ({ error: loggerErrorMock, info: vi.fn(), warn: vi.fn() }),
}));

beforeEach(() => {
  selectMock.entry.mockClear();
  selectMock.eq1.mockClear();
  selectMock.eq2.mockClear();
  selectMock.gte.mockClear();
  insertMock.mockClear();
  loggerErrorMock.mockClear();
  // Restore chain after clearing.
  selectMock.entry.mockImplementation(() => ({ eq: selectMock.eq1 }));
  selectMock.eq1.mockImplementation(() => ({ eq: selectMock.eq2 }));
  selectMock.eq2.mockImplementation(() => ({ gte: selectMock.gte }));
  // Default: insert succeeds.
  insertMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('rateLimit', () => {
  it('1. happy path — count<max → ok=true, remaining=max-used-1, insert called', async () => {
    selectMock.gte.mockResolvedValueOnce({ count: 2, error: null });
    const result = await rateLimit({
      key: '203.0.113.5',
      action: 'auth.register',
      windowSec: 3600,
      maxAttempts: 5,
    });
    expect(result).toEqual({ ok: true, remaining: 2 }); // 5 - 2 - 1 = 2
    // Insert MUST have been called (this attempt is now recorded).
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: '203.0.113.5',
        action: 'auth.register',
        attempted_at: expect.any(String),
      }),
    );
  });

  it('2. blocks at max — count>=max → ok=false, retryAfterSec=windowSec, NO insert', async () => {
    selectMock.gte.mockResolvedValueOnce({ count: 5, error: null });
    const result = await rateLimit({
      key: '198.51.100.1',
      action: 'auth.login',
      windowSec: 900,
      maxAttempts: 5,
    });
    expect(result).toEqual({ ok: false, remaining: 0, retryAfterSec: 900 });
    // Insert MUST NOT have been called when the limit is exhausted —
    // logging blocked attempts would itself extend the window indefinitely.
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('3. fails OPEN on DB error — select returns error → ok=true, remaining=max, logged', async () => {
    selectMock.gte.mockResolvedValueOnce({
      count: null,
      error: { message: 'connection refused', code: '08006' },
    });
    const result = await rateLimit({
      key: 'email:user@example.com',
      action: 'auth.forgot_password',
      windowSec: 3600,
      maxAttempts: 3,
    });
    // Fail-open contract — never lock users out on DB outage.
    expect(result).toEqual({ ok: true, remaining: 3 });
    // No insert on the error path (we already logged the failure).
    expect(insertMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ message: 'connection refused' }),
      }),
      'rate_limit count failed; failing open',
    );
  });

  it('4. insert error is non-fatal — select ok, insert fails → still ok=true (logged)', async () => {
    selectMock.gte.mockResolvedValueOnce({ count: 1, error: null });
    insertMock.mockResolvedValueOnce({ error: { message: 'insert failed' } });
    const result = await rateLimit({
      key: '203.0.113.42',
      action: 'auth.register',
      windowSec: 3600,
      maxAttempts: 3,
    });
    // Even if the insert silently fails, the attempt was allowed by the
    // check — slight under-counting is preferred to false denial.
    expect(result).toEqual({ ok: true, remaining: 1 }); // 3 - 1 - 1 = 1
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({ message: 'insert failed' }),
      }),
      'rate_limit insert failed',
    );
  });
});
