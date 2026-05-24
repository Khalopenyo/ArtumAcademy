// tests/integration/helpers/test-users.ts
//
// Test-user factory + cleanup helpers for integration tests.
//
// `createTestUser(suffix?)` — Creates an auth.users row via service_role
// admin API (auto-confirms email so no SMTP round-trip), then signs in to
// mint an access token. Returned `accessToken` is consumable directly by
// `makeUserClient` for RLS-as-this-user testing.
//
// `deleteTestUser(userId)` — Cleanup via service_role; cascades through
// `profiles` and any other tables with `ON DELETE CASCADE` on auth.users.
// Call from `afterAll`.
//
// Email scheme: `t+<suffix-or-uuid>@test.local`. The `.local` TLD never
// resolves and the `t+` prefix is the documented project convention so
// these rows are obviously test data if they ever leak into a dev DB.

import { makeAdminClient } from './test-clients';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
}

export async function createTestUser(suffix?: string): Promise<TestUser> {
  const admin = makeAdminClient();
  const email = `t+${suffix ?? crypto.randomUUID()}@test.local`;
  const password = 'TestPassword123!';

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification for tests
  });
  if (createErr || !created.user) {
    throw createErr ?? new Error('createUser returned no user');
  }

  // Generate a session (access_token) for the user we just made.
  const { data: session, error: signInErr } = await admin.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !session.session) {
    throw signInErr ?? new Error('signIn returned no session');
  }

  return {
    id: created.user.id,
    email,
    password,
    accessToken: session.session.access_token,
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = makeAdminClient();
  await admin.auth.admin.deleteUser(userId);
}
