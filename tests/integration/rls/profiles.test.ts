/**
 * Canary RLS regression test for the `profiles` table.
 *
 * THIS IS THE COPY-PASTE TEMPLATE for every future RLS test under
 * tests/integration/rls/. Three assertions form the canonical shape:
 *
 *   1. User B cannot SELECT User A's row    (RLS hides rows silently — data === [])
 *   2. User B cannot UPDATE User A's row    (per Fix 12 — see below)
 *   3. User A CAN SELECT own row            (positive control — RLS isn't a brick wall)
 *
 * UPDATE-deny pattern (Fix 12 — the authoritative one):
 *
 * Supabase RLS denies for UPDATE return `data: []` and (usually) `error: null`.
 * An earlier RESEARCH.md draft (line 1054) wrapped `error?.code ?? data?.length`
 * with `?? 0` and then asserted the result was defined — but `0` is always
 * defined, so the assertion always passed regardless of whether RLS actually
 * blocked the UPDATE. (Verification grep in plan-06 deliberately greps for
 * that exact substring; do not paste the literal expression back into this
 * file.) Plan-06 Task 7 supersedes with:
 *
 *   (a) `expect(data ?? []).toEqual([])` — the standard Supabase RLS-deny
 *       response shape for UPDATE.
 *   (b) An admin-client read-back via `makeAdminClient()` as the AUTHORITATIVE
 *       proof of no-mutation. Always trust the read-back, never the
 *       deny-response shape alone — Supabase has shipped versions where
 *       the deny shape silently changed.
 *
 * The admin client is the right primitive for read-back here. A
 * non-admin read-back as User A would also work but is less robust if
 * there's ever a multi-condition RLS policy bug that affects both
 * UPDATE and SELECT.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { makeAdminClient, makeUserClient } from '../helpers/test-clients';
import { createTestUser, deleteTestUser, type TestUser } from '../helpers/test-users';

// `src/types/database.ts` currently ships as a placeholder
// (`Tables: Record<string, never>`) because `npm run db:types` requires a
// running Supabase local stack (Docker). Until the first `db:types`
// regeneration lands in this repo, the SupabaseClient's `.from(...)` infers
// the row type as `never`, which breaks any field access in this test.
//
// We narrow the per-call view with an inline `ProfileRow` type here. Once
// `db:types` is run (P1 OPS task or any P2+ migration), this local type
// can be replaced with `Database['public']['Tables']['profiles']['Row']`.
// Schema source of truth: supabase/migrations/20260522000001_init_base_tables.sql
type ProfileRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  telegram_id: number | null;
  created_at: string;
  updated_at: string;
};

describe('RLS: profiles', () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser('a');
    userB = await createTestUser('b');
  });

  afterAll(async () => {
    if (userA) await deleteTestUser(userA.id);
    if (userB) await deleteTestUser(userB.id);
  });

  it('User B cannot SELECT User A profile via anon-key client', async () => {
    const clientB = makeUserClient(userB.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientB.from('profiles') as any)
      .select('user_id, full_name')
      .eq('user_id', userA.id);

    expect(error).toBeNull();
    // RLS hides rows silently — no error, just empty result.
    expect(data as Pick<ProfileRow, 'user_id' | 'full_name'>[]).toEqual([]);
  });

  it('User B cannot UPDATE User A profile', async () => {
    const clientB = makeUserClient(userB.accessToken);
    const adminClient = makeAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientB.from('profiles') as any)
      .update({ full_name: 'Hacked' })
      .eq('user_id', userA.id)
      .select();

    // Standard Supabase RLS-deny pattern for UPDATE:
    // returns an empty result set, typically with no error. The earlier
    // dead-code assertion from RESEARCH.md line 1054 (`error?.code ?? data?.length`
    // coalesced through `?? 0` and asserted as defined) always passed —
    // 0 is always defined — and was removed per Fix 12.
    expect(error).toBeNull();
    expect((data ?? []) as ProfileRow[]).toEqual([]);

    // Read-back via admin client (bypasses RLS) is the AUTHORITATIVE proof
    // that nothing was mutated. NEVER trust the deny-response alone.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminCheck = await (adminClient.from('profiles') as any)
      .select('full_name')
      .eq('user_id', userA.id)
      .single();
    expect(adminCheck.error).toBeNull();
    expect((adminCheck.data as Pick<ProfileRow, 'full_name'> | null)?.full_name).not.toBe('Hacked');
  });

  it('User A CAN SELECT own profile', async () => {
    const clientA = makeUserClient(userA.accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (clientA.from('profiles') as any)
      .select('user_id')
      .eq('user_id', userA.id)
      .single();

    expect(error).toBeNull();
    expect((data as Pick<ProfileRow, 'user_id'> | null)?.user_id).toBe(userA.id);
  });
});
