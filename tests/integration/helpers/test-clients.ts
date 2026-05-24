// tests/integration/helpers/test-clients.ts
//
// Per-user Supabase client factories for integration tests.
//
// `makeAdminClient()` — service_role; bypasses RLS. Use for setup, teardown,
//   and as the authoritative read-back oracle in RLS-deny tests (never trust
//   the deny-response alone — see tests/integration/rls/profiles.test.ts).
//
// `makeUserClient(accessToken)` — anon key with a per-user JWT injected as
//   Bearer header. RLS applies as that user. This is the primitive that
//   makes RLS regression testing tractable.
//
// Both read URL / keys from process.env populated by tests/integration/globalSetup.ts.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

export function makeAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'makeAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY ' +
        '(globalSetup.ts should have populated these — check casing matrix).'
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Anon-key client authenticated as a specific user.
 * Use this to test RLS — operations behave as the given user would see them.
 */
export function makeUserClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'makeUserClient: missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        '(globalSetup.ts should have populated these — check casing matrix).'
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
