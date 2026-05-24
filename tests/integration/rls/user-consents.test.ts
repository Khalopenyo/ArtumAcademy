/**
 * RLS regression test for the `user_consents` table (AUTH-03, plan-06 Task 3).
 *
 * user_consents is a 152-ФЗ compliance evidence table. Each register inserts
 * two rows (purpose=pdn_processing + purpose=oferta). RKN audits read these
 * rows as immutable proof that a specific user agreed to a specific policy
 * version at a specific time.
 *
 * Five assertions:
 *   1. Positive control: User A CAN SELECT own consent row.
 *   2. Cross-user denial: User B with own JWT cannot read User A's row.
 *   3. Anon denial: anon-key client (no token) cannot read any row.
 *   4. Authed INSERT denied: User A cannot INSERT via own JWT (no INSERT
 *      policy granted — service_role-only writes).
 *   5. Immutability trigger: even service_role cannot UPDATE or DELETE
 *      (trigger user_consents_no_update raises 'user_consents is append-only').
 *
 * Typing note (mirrors profiles + audit-log RLS tests):
 *   src/types/database.ts has user_consents hand-patched by plan-06 Task 1.
 *   We still cast `.from('user_consents')` via `as any` for consistency
 *   with the canary RLS pattern and resilience to a future db:types regen
 *   that may restructure the manual placeholder.
 *
 * Schema source of truth:
 *   supabase/migrations/20260525000001_add_user_consents.sql
 *
 * Docker note: This test file is structurally correct but will be SKIPPED at
 * runtime if Docker is absent on the executing machine (the integration
 * harness's globalSetup.ts calls `supabase start` which requires Docker).
 * Per plan-04 / plan-06 P1 pattern, deferred runtime to first dev with Docker.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { makeAdminClient, makeUserClient } from '../helpers/test-clients';
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/test-users';

type UserConsentRow = {
  id: string;
  user_id: string;
  purpose: 'pdn_processing' | 'oferta';
  policy_version: string;
  ip: string | null;
  user_agent: string | null;
  accepted_at: string;
};

function makeAnonClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('makeAnonClient: missing NEXT_PUBLIC_SUPABASE_URL or _ANON_KEY');
  }
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describe('RLS: user_consents', () => {
  let userA: TestUser;
  let userB: TestUser;
  let consentRowId: string;

  beforeAll(async () => {
    userA = await createTestUser('consents-a');
    userB = await createTestUser('consents-b');

    // Seed: one consent row for User A via admin client (service_role bypasses RLS).
    const admin = makeAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from('user_consents') as any)
      .insert({
        user_id: userA.id,
        purpose: 'pdn_processing',
        policy_version: '1.0-draft',
        ip: '127.0.0.1',
        user_agent: 'test-suite',
      })
      .select('id')
      .single();
    if (error) throw error;
    consentRowId = (data as { id: string }).id;
  });

  afterAll(async () => {
    if (userA) await deleteTestUser(userA.id);
    if (userB) await deleteTestUser(userB.id);
  });

  it('1. User A CAN SELECT own consent row (positive control)', async () => {
    const clientA = makeUserClient(userA.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientA.from('user_consents') as any)
      .select('user_id, purpose, policy_version, ip, user_agent')
      .eq('user_id', userA.id);

    expect(error).toBeNull();
    const rows = (data ?? []) as Pick<
      UserConsentRow,
      'user_id' | 'purpose' | 'policy_version' | 'ip' | 'user_agent'
    >[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: userA.id,
      purpose: 'pdn_processing',
      policy_version: '1.0-draft',
      ip: '127.0.0.1',
      user_agent: 'test-suite',
    });
  });

  it("2. User B cannot SELECT User A's consent row (RLS hides silently)", async () => {
    const clientB = makeUserClient(userB.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientB.from('user_consents') as any)
      .select('user_id')
      .eq('user_id', userA.id);

    // RLS hides rows silently — no error, just empty result.
    expect(error).toBeNull();
    expect((data ?? []) as Pick<UserConsentRow, 'user_id'>[]).toEqual([]);
  });

  it('3. Anon client (no JWT) cannot read any consent row', async () => {
    const anon = makeAnonClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (anon.from('user_consents') as any)
      .select('user_id')
      .eq('user_id', userA.id);

    expect(error).toBeNull();
    expect((data ?? []) as Pick<UserConsentRow, 'user_id'>[]).toEqual([]);
  });

  it('4. Authed User A cannot INSERT own consent row (no INSERT policy granted)', async () => {
    const clientA = makeUserClient(userA.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientA.from('user_consents') as any)
      .insert({
        user_id: userA.id,
        purpose: 'oferta',
        policy_version: '1.0-draft',
        ip: '127.0.0.1',
        user_agent: 'test-suite',
      })
      .select();

    // Supabase RLS-deny for INSERT returns an error object (distinct from
    // SELECT/UPDATE which return empty data + null error). The exact code
    // is "42501" (insufficient_privilege) or PGRST-prefixed depending on
    // PostgREST version — we assert truthiness rather than a specific code
    // for resilience.
    expect(error).toBeTruthy();
    expect(data).toBeNull();

    // Authoritative read-back: admin client should still only see the one
    // seeded row (no second 'oferta' row crept in).
    const admin = makeAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminCheck = await (admin.from('user_consents') as any)
      .select('purpose')
      .eq('user_id', userA.id);
    expect((adminCheck.data ?? []).length).toBe(1);
    expect((adminCheck.data as Pick<UserConsentRow, 'purpose'>[])[0]?.purpose).toBe('pdn_processing');
  });

  it('5. Immutability trigger blocks UPDATE and DELETE even from service_role', async () => {
    const admin = makeAdminClient();

    // UPDATE attempt — trigger raises 'user_consents is append-only'.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateResult = await (admin.from('user_consents') as any)
      .update({ policy_version: '2.0-hacked' })
      .eq('id', consentRowId);
    expect(updateResult.error).toBeTruthy();
    expect(String(updateResult.error?.message ?? '')).toMatch(/append-only/);

    // DELETE attempt — same trigger raises the same exception.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deleteResult = await (admin.from('user_consents') as any)
      .delete()
      .eq('id', consentRowId);
    expect(deleteResult.error).toBeTruthy();
    expect(String(deleteResult.error?.message ?? '')).toMatch(/append-only/);

    // Authoritative read-back via admin: row still exists with original values.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const readBack = await (admin.from('user_consents') as any)
      .select('policy_version')
      .eq('id', consentRowId)
      .single();
    expect(readBack.error).toBeNull();
    expect((readBack.data as Pick<UserConsentRow, 'policy_version'> | null)?.policy_version).toBe('1.0-draft');
  });
});
