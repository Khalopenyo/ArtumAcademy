/**
 * RLS regression test for the `audit_log` table (FOUND-05, plan-04 Task 5).
 *
 * audit_log is unusual among project tables: it has RLS enabled but the
 * policy set is INTENTIONALLY EMPTY. The contract is:
 *   - service_role (admin client) bypasses RLS — CAN read and write.
 *   - anon / authenticated users — CANNOT read or write (silently denied).
 *   - UPDATE / DELETE are blocked even for service_role by trigger
 *     `audit_log_no_mutate` (defense-in-depth against tampering bugs).
 *
 * Four assertions (mapped to plan-04 Task 5 spec):
 *   1. Anonymous user cannot SELECT from audit_log     (empty result, no error)
 *   2. Authenticated user cannot SELECT from audit_log (empty result, no error)
 *   3. Authenticated user cannot INSERT into audit_log (error returned;
 *      service_role required)
 *   4. Admin client (service_role) CAN INSERT, and the row appears via
 *      authoritative admin-client read-back.
 *
 * BONUS assertion (proves the immutability trigger from plan-04 Task 1):
 *   5. Admin client UPDATE on audit_log raises `audit_log is append-only`
 *      (RLS-bypass doesn't bypass triggers).
 *
 * Typing note (mirrors tests/integration/rls/profiles.test.ts Fix 12 pattern):
 *   src/types/database.ts currently has audit_log types HAND-PATCHED by
 *   plan-04 Task 2 (Docker absent, `npm run db:types` deferred — see
 *   plan-04-SUMMARY.md). So `.from('audit_log')` actually IS typed correctly
 *   on this machine. We still use `as any` here for two reasons:
 *     - consistency with the canary profiles test (plan-06 pattern)
 *     - resilience to a future db:types regen that drops/restructures the
 *       manual placeholder before this test next runs.
 *
 * Schema source of truth:
 *   supabase/migrations/20260524000001_add_audit_log.sql
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { makeAdminClient, makeUserClient } from '../helpers/test-clients';
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/test-users';

type AuditLogRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

/**
 * Build a fully anonymous client (no JWT, anon key only) — distinct from
 * makeUserClient which injects a Bearer for an authenticated user.
 */
function makeAnonClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('makeAnonClient: env not populated by globalSetup.ts');
  }
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe('RLS: audit_log', () => {
  let userA: TestUser;

  beforeAll(async () => {
    userA = await createTestUser('a');
  });

  afterAll(async () => {
    if (userA) await deleteTestUser(userA.id);
  });

  it('1. anonymous client cannot SELECT from audit_log (silent empty)', async () => {
    const anon = makeAnonClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (anon.from('audit_log') as any)
      .select('id, action')
      .limit(1);

    // RLS hides rows silently with no error.
    expect(error).toBeNull();
    expect(data as Pick<AuditLogRow, 'id' | 'action'>[]).toEqual([]);
  });

  it('2. authenticated user cannot SELECT from audit_log (silent empty)', async () => {
    const clientA = makeUserClient(userA.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientA.from('audit_log') as any)
      .select('id, action')
      .limit(1);

    expect(error).toBeNull();
    expect(data as Pick<AuditLogRow, 'id' | 'action'>[]).toEqual([]);
  });

  it('3. authenticated user cannot INSERT into audit_log', async () => {
    const clientA = makeUserClient(userA.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientA.from('audit_log') as any).insert({
      user_id: userA.id,
      action: 'rls.test.unauthorized.insert',
    });

    // Supabase returns an RLS error for INSERT denial (different from SELECT,
    // which silently drops). Either an error is set OR data is empty — both
    // are valid denial signals across Supabase versions; we accept either.
    const denied = error !== null || (Array.isArray(data) && data.length === 0);
    expect(denied).toBe(true);

    // Authoritative no-write read-back: admin client confirms no row landed.
    const adminClient = makeAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminCheck = await (adminClient.from('audit_log') as any)
      .select('id')
      .eq('action', 'rls.test.unauthorized.insert');
    expect(adminCheck.error).toBeNull();
    expect(adminCheck.data as { id: string }[]).toEqual([]);
  });

  it('4. admin (service_role) CAN INSERT, and the row is visible via admin read-back', async () => {
    const adminClient = makeAdminClient();
    const action = `rls.test.admin.insert.${Date.now()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertResult = await (adminClient.from('audit_log') as any).insert({
      user_id: userA.id,
      action,
      meta: { test: 'plan-04-rls-canary' },
    });
    expect(insertResult.error).toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminCheck = await (adminClient.from('audit_log') as any)
      .select('user_id, action, meta')
      .eq('action', action)
      .single();
    expect(adminCheck.error).toBeNull();
    const row = adminCheck.data as Pick<AuditLogRow, 'user_id' | 'action' | 'meta'>;
    expect(row.user_id).toBe(userA.id);
    expect(row.action).toBe(action);
    expect(row.meta).toMatchObject({ test: 'plan-04-rls-canary' });
  });

  it('5. immutability trigger raises on UPDATE even for service_role (defense-in-depth)', async () => {
    const adminClient = makeAdminClient();
    const action = `rls.test.update.attempt.${Date.now()}`;

    // Seed a row to attempt UPDATE on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('audit_log') as any).insert({
      user_id: userA.id,
      action,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient.from('audit_log') as any)
      .update({ action: 'tampered' })
      .eq('action', action);

    expect(error).not.toBeNull();
    // Trigger raises the canonical "append-only" message.
    expect(error?.message ?? '').toMatch(/append-only/i);
  });
});
