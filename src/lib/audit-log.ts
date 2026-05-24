import 'server-only';
/**
 * auditLog() helper — append-only compliance trail (FOUND-05, plan-04).
 *
 * Writes a single row into the `audit_log` table via the service_role admin
 * client (RLS-bypassed) and captures the caller's IP + User-Agent from
 * `next/headers()`. Used for finance/access/compliance events such as:
 *   - payment.created / payment.succeeded / payment.failed
 *   - access.granted / access.revoked
 *   - account.deleted
 *   - webhook.auth_failed
 *
 * Exports:
 *   - `auditLog(input)` — request-context variant; captures IP+UA from
 *     `next/headers()`. Use from Server Actions, Route Handlers, server
 *     queries.
 *   - `auditLogContextless(input + ipAddress + userAgent)` — variant for
 *     cron jobs / background workers where `headers()` would throw.
 *
 * Failure mode (BOTH variants):
 *   - Logs via pino at `error` level.
 *   - Returns `undefined` (NEVER throws).
 *
 * Compliance reasoning: an audit-write failure MUST NOT abort the calling
 * business flow (e.g., a failed audit row write must not abort a successful
 * payment). The audit failure is logged loudly; the caller continues.
 *
 * Imports:
 *   - `import 'server-only'` (first line) — guards against accidental
 *     inclusion in client bundles (admin client uses service_role).
 *
 * Schema source-of-truth:
 *   - supabase/migrations/20260524000001_add_audit_log.sql
 *   - .claude/skills/security/SKILL.md §6 (column names match verbatim)
 *
 * See: .planning/phases/1-dev-foundations/RESEARCH.md §Pattern 5.
 */

import { headers } from 'next/headers';

import { getClientIp } from '@/lib/headers/client-ip';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface AuditLogInput {
  /** Acting user UUID. Null for anonymous events (e.g., webhook from ЮKassa). */
  userId: string | null;
  /** Dotted action key, e.g. 'payment.succeeded', 'webhook.auth_failed'. */
  action: string;
  /** Entity type, e.g. 'purchase', 'profile'. Optional. */
  entityType?: string;
  /** Entity id (text — some entities have non-uuid ids like ЮKassa payment_id). */
  entityId?: string;
  /**
   * Arbitrary JSON metadata. Will NOT be redacted — caller MUST scrub secrets
   * before passing (passwords, tokens, raw card numbers).
   */
  meta?: Record<string, unknown>;
}

/**
 * Append an immutable record to `audit_log`, capturing IP + User-Agent from
 * the current request via `next/headers()`. Safe to call from Server Actions,
 * Route Handlers, and server queries.
 *
 * Failure mode: logs via pino and returns `undefined`. Does NOT throw.
 * Compliance reasoning: never let an audit-write failure abort a payment.
 *
 * @param input — see {@link AuditLogInput}
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  // NOTE: headers() is SYNC in Next.js 14.2.x (current locked version per
  // CLAUDE.md Technology Stack section). If/when this project upgrades to
  // Next.js 15+, change `const hs = headers()` to `const hs = await headers()`
  // and update the function's awaits accordingly. The mocks in
  // audit-log.test.ts also need updating.
  // See https://nextjs.org/docs/app/api-reference/functions/headers for the 15+ async signature.
  try {
    // IP extraction lives in src/lib/headers/client-ip.ts (plan-06 — shared
    // with rate-limit + plan-07 consent capture). The user-agent read still
    // calls headers() directly here because UA capture is audit-log-specific.
    const ipAddress = getClientIp();
    const hs = headers();
    const userAgent = hs.get('user-agent') ?? null;

    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_log').insert({
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      meta: (input.meta ?? {}) as never,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      logger.error({ err: error, audit: input }, 'auditLog insert failed');
      // Intentional: log and continue. Audit failures MUST NOT abort caller.
    }
  } catch (err) {
    logger.error({ err, audit: input }, 'auditLog helper crashed');
    // Do not re-throw — audit MUST NOT abort business flow.
  }
}

/**
 * Variant for non-request contexts (cron jobs, background workers) where
 * `next/headers()` throws. Pass IP/UA explicitly if known, or omit (will be
 * stored as NULL).
 *
 * Parameter names use skill-aligned `ipAddress` / `userAgent` (NOT `ip` / `ua`)
 * to match the audit_log column names (`ip_address`, `user_agent`).
 *
 * Same no-throw failure semantics as {@link auditLog}.
 */
export async function auditLogContextless(
  input: AuditLogInput & { ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('audit_log').insert({
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      meta: (input.meta ?? {}) as never,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
    if (error) {
      logger.error({ err: error, audit: input }, 'auditLogContextless insert failed');
    }
  } catch (err) {
    logger.error({ err, audit: input }, 'auditLogContextless helper crashed');
  }
}
