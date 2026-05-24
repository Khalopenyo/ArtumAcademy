/**
 * Integration test for the Postgres sliding-window rate-limit
 * (AUTH-10, plan-06 Task 3).
 *
 * Drives the real src/lib/rate-limit/index.ts against a local Supabase
 * stack (Docker via tests/integration/globalSetup.ts).
 *
 * Four assertions cover the sliding-window contract:
 *   1. Burst: 5 sequential calls below the limit → all ok=true with
 *      decreasing remaining; 6th call returns ok=false (blocked).
 *   2. Sliding-window forgetting: an attempt older than the window does
 *      not count toward the limit (manually backdated insert).
 *   3. Key isolation: a different key with the same action is unaffected
 *      when the first key is exhausted.
 *   4. Action isolation: same key with a different action is unaffected.
 *
 * Cleanup: each test starts by deleting any rows for the synthetic key it
 * uses (`test:*`). The `rate_limit_log_cleanup()` function targets rows
 * older than 24h, so deliberately-old rows from this suite remain until
 * the test's own cleanup runs.
 *
 * Docker note: This test file is structurally correct but will be SKIPPED
 * at runtime if Docker is absent on the executing machine. Per plan-04 /
 * plan-06 P1 pattern, runtime deferred to first dev with Docker.
 *
 * Why this test imports the real helper instead of re-implementing the
 * SQL: the rate-limit pattern lives in one place (src/lib/rate-limit) and
 * this test exercises THAT module against a real DB. Pure SQL tests in
 * isolation would miss bugs in the SDK chain composition.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { rateLimit } from '@/lib/rate-limit';
import { makeAdminClient } from './helpers/test-clients';

const TEST_ACTION = 'auth.test.rate-limit';

async function clearKeys(keys: string[]): Promise<void> {
  const admin = makeAdminClient();
  for (const key of keys) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('rate_limit_log') as any)
      .delete()
      .eq('key', key)
      .eq('action', TEST_ACTION);
  }
}

describe('rateLimit (integration)', () => {
  beforeEach(async () => {
    await clearKeys(['test:127.0.0.1', 'test:other-ip']);
    // Also clear any rows from other actions on the primary test key.
    const admin = makeAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('rate_limit_log') as any)
      .delete()
      .eq('key', 'test:127.0.0.1');
  });

  afterAll(async () => {
    await clearKeys(['test:127.0.0.1', 'test:other-ip']);
  });

  it('1. burst — 5 calls below max return ok=true; 6th blocked with retryAfterSec', async () => {
    const key = 'test:127.0.0.1';
    const args = { key, action: TEST_ACTION, windowSec: 900, maxAttempts: 5 };

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await rateLimit(args));
    }
    // First 5 are allowed with decreasing remaining.
    expect(results.map((r) => r.ok)).toEqual([true, true, true, true, true]);
    // remaining decreases: 4, 3, 2, 1, 0
    expect(results.map((r) => r.remaining)).toEqual([4, 3, 2, 1, 0]);

    // 6th is blocked.
    const sixth = await rateLimit(args);
    expect(sixth.ok).toBe(false);
    expect(sixth.remaining).toBe(0);
    expect(sixth.retryAfterSec).toBe(900);
  });

  it('2. sliding window — attempts older than windowSec do NOT count', async () => {
    const key = 'test:127.0.0.1';
    const admin = makeAdminClient();

    // Seed an attempt 1000 seconds ago (well outside a 900s window).
    const oldTimestamp = new Date(Date.now() - 1000 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (admin.from('rate_limit_log') as any).insert({
      key,
      action: TEST_ACTION,
      attempted_at: oldTimestamp,
    });
    expect(insertError).toBeNull();

    // Count via rateLimit should treat this as ZERO recent attempts.
    const result = await rateLimit({ key, action: TEST_ACTION, windowSec: 900, maxAttempts: 5 });
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4); // 5 - 0 (recent) - 1 (this attempt) = 4
  });

  it('3. key isolation — different keys do not share the budget', async () => {
    const exhaustedKey = 'test:127.0.0.1';
    const otherKey = 'test:other-ip';
    const args = (key: string) => ({ key, action: TEST_ACTION, windowSec: 900, maxAttempts: 3 });

    // Exhaust the first key (3 calls + 1 blocked).
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(args(exhaustedKey));
      expect(r.ok).toBe(true);
    }
    const blocked = await rateLimit(args(exhaustedKey));
    expect(blocked.ok).toBe(false);

    // Other key is unaffected.
    const otherResult = await rateLimit(args(otherKey));
    expect(otherResult.ok).toBe(true);
    expect(otherResult.remaining).toBe(2); // 3 - 0 (recent on other key) - 1 = 2
  });

  it('4. action isolation — same key + different action do not share the budget', async () => {
    const key = 'test:127.0.0.1';

    // Exhaust the primary test action.
    for (let i = 0; i < 5; i++) {
      await rateLimit({ key, action: TEST_ACTION, windowSec: 900, maxAttempts: 5 });
    }
    const blocked = await rateLimit({ key, action: TEST_ACTION, windowSec: 900, maxAttempts: 5 });
    expect(blocked.ok).toBe(false);

    // Different action with the same key is unaffected.
    const otherAction = await rateLimit({
      key,
      action: 'auth.test.other-action',
      windowSec: 900,
      maxAttempts: 5,
    });
    expect(otherAction.ok).toBe(true);
    expect(otherAction.remaining).toBe(4);

    // Cleanup the other-action row this test inserted.
    const admin = makeAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('rate_limit_log') as any)
      .delete()
      .eq('key', key)
      .eq('action', 'auth.test.other-action');
  });
});
