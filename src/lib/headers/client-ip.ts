import 'server-only';
/**
 * getClientIp() — shared helper that extracts the client IP from
 * Next.js request headers (AUTH-09 / AUTH-10 infra, plan-06).
 *
 * Header lookup is case-insensitive: Node's `Headers` class (which
 * `next/headers().headers()` returns) normalises all reads to lowercase
 * automatically. The case-sensitivity guard is preserved in case the
 * mock ever swaps to a `Map`-based shim.
 *
 * Order of precedence:
 *   1. First (left-most) hop of `X-Forwarded-For`
 *   2. `X-Real-IP`
 *   3. `null` (no headers — non-request context)
 *
 * Used by:
 *   - src/lib/audit-log.ts (refactored in plan-06 to import this helper)
 *   - src/lib/rate-limit/index.ts (plan-06 caller derives the key from IP)
 *   - src/server/actions/auth.ts (plan-07, plan-08, plan-09 — passes IP
 *     into captcha verify + consent capture)
 *
 * MUST be called inside a Server Action / Server Component / Route
 * Handler context — `next/headers().headers()` throws elsewhere
 * (e.g. during static generation or in `auditLogContextless` which
 * accepts IP/UA as parameters).
 *
 * Failure mode: this helper never throws on its own. If `next/headers()`
 * throws, that exception propagates — callers are expected to wrap in
 * try/catch (see auditLog() for the canonical pattern).
 */

import { headers } from 'next/headers';

export function getClientIp(): string | null {
  const h = headers();
  const xff = h.get('x-forwarded-for');
  if (xff && xff.trim().length > 0) {
    return xff.split(',')[0]!.trim();
  }
  const xri = h.get('x-real-ip');
  if (xri && xri.trim().length > 0) {
    return xri.trim();
  }
  return null;
}
