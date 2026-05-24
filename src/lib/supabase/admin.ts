import 'server-only'; // FIRST LINE — Next.js bundler throws if a Client Component pulls this file.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

// Read directly from process.env — runtime guarantee comes from
// src/instrumentation.ts (plan-01) which calls env.ts at boot, and
// the `prebuild` npm script (plan-01 task 5) at build time. Reading
// process.env here avoids a build-time dependency on plan-01 and keeps
// plan-02 truly parallel in Wave 1 (per RESEARCH.md Fix 11).
//
// Allowed callers (enforced by ESLint no-restricted-imports + overrides
// in .eslintrc.json): src/lib/audit-log.ts, src/server/**, src/app/api/**,
// src/instrumentation.ts, sentry.{server,edge}.config.{ts,tsx}.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let _admin: SupabaseClient<Database> | null = null;

/**
 * Returns the memoized service_role Supabase client.
 *
 * SECURITY: This bypasses RLS. Only legitimate callers are:
 *   - audit-log helper (writes to RLS-denied audit_log table)
 *   - payment Server Actions (when user context insufficient)
 *   - webhook handlers (no user session available)
 *
 * NEVER import this from client components. ESLint and the
 * `import 'server-only'` sentinel will both block client inclusion.
 *
 * The `src/middleware.ts` file is explicitly excluded from the ESLint
 * allow-list because middleware runs in the Edge runtime and must not
 * pull Node-only dependencies that the admin client depends on.
 */
export function createAdminClient(): SupabaseClient<Database> {
  if (_admin) return _admin;
  _admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return _admin;
}
