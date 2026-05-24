import 'server-only';
/**
 * rateLimit() — Postgres-backed sliding-window rate-limit wrapper
 * (AUTH-10, plan-06).
 *
 * Plans 07 (register), 08 (login), 09 (forgot-password) call this at the
 * top of their Server Actions BEFORE any other work (cheap check first).
 * The intent is to throttle brute-force, signup-spam, and email-bomb
 * abuse without external dependencies (RU connectivity to Upstash is
 * not verified per research/STACK.md §Rate Limiting).
 *
 * Algorithm:
 *   1. SELECT count of rows where (key, action, attempted_at >= cutoff)
 *      from rate_limit_log via the service-role admin client.
 *   2. If count >= maxAttempts → deny (no insert; client gets a
 *      retryAfterSec hint sized to the window).
 *   3. Otherwise → insert one row (this attempt) and allow.
 *
 * Failure mode (fails OPEN):
 *   - If the SELECT errors (DB unreachable, RLS misconfig, etc.), the
 *     helper returns ok=true with remaining=max. Logged loudly via pino.
 *     Rationale: a hard deny on DB error would lock every user out
 *     during a Supabase outage — strictly worse than allowing burst
 *     traffic for a few minutes while ops investigates.
 *   - If the INSERT errors (allowed path), the helper still returns
 *     ok=true. The attempt is not counted toward the window — slight
 *     under-counting is preferred to false denial.
 *
 * Concurrency caveat:
 *   - Two requests racing inside the same window can both pass the
 *     count check before either inserts (TOCTOU). At MVP scale this is
 *     acceptable — exact rate-limit enforcement under high concurrency
 *     would require row-level locking or a SQL-level atomic insert,
 *     which is a P6 optimisation.
 *
 * Used by:
 *   - src/server/actions/auth.ts (plan-07 register: 3/hr/IP)
 *   - src/server/actions/auth.ts (plan-08 login: 5/15min/IP+email)
 *   - src/server/actions/auth.ts (plan-09 forgot-password: 3/hr/email)
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface RateLimitArgs {
  /** Bucket key — typically IP, `ip:${email}`, or `email:${email}`. */
  key: string;
  /** Dotted action name — 'auth.login', 'auth.register', 'auth.forgot_password'. */
  action: string;
  /** Sliding window length in seconds (e.g. 900 = 15 minutes). */
  windowSec: number;
  /** Maximum attempts allowed within the window. */
  maxAttempts: number;
}

export interface RateLimitResult {
  /** true → attempt allowed; false → blocked (caller should reject with retryAfterSec). */
  ok: boolean;
  /** Remaining attempts in the current window (always 0 when ok=false). */
  remaining: number;
  /** Suggested retry-after (seconds). Only meaningful when ok=false. */
  retryAfterSec?: number;
}

export async function rateLimit(args: RateLimitArgs): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - args.windowSec * 1000).toISOString();

  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('*', { count: 'exact', head: true })
    .eq('key', args.key)
    .eq('action', args.action)
    .gte('attempted_at', cutoff);

  if (error) {
    logger.error({ err: error, args }, 'rate_limit count failed; failing open');
    return { ok: true, remaining: args.maxAttempts };
  }

  const used = count ?? 0;
  if (used >= args.maxAttempts) {
    return { ok: false, remaining: 0, retryAfterSec: args.windowSec };
  }

  const { error: insertError } = await supabase.from('rate_limit_log').insert({
    key: args.key,
    action: args.action,
    attempted_at: new Date().toISOString(),
  });
  if (insertError) {
    logger.error({ err: insertError, args }, 'rate_limit insert failed');
  }

  return { ok: true, remaining: args.maxAttempts - used - 1 };
}
