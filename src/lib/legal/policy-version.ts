/**
 * Single source of truth for legal document version.
 *
 * Bumped when /privacy or /oferta wording changes substantively.
 * Used by:
 *   - src/content/privacy.tsx + src/content/oferta.tsx (header label)
 *   - src/server/actions/auth.ts (plan-07) — written to user_consents.policy_version
 *
 * Format: <major>.<minor>[-<status>]
 *   - '1.0-draft': initial P2 ship (TODO markers visible, юрист sign-off pending)
 *   - '1.0':       after P7 COMP-02 юрист sign-off (drop -draft suffix)
 *   - '1.1':       patch wording (typo, contact email change)
 *   - '2.0':       substantive change (new data category, new purpose)
 *
 * NEVER mutate a row in user_consents — re-consent on bump creates a new row.
 *
 * Safe to import from both Server and Client Components (no 'server-only' marker).
 */
export const LEGAL_POLICY_VERSION = '1.0-draft' as const;

export type PolicyVersion = typeof LEGAL_POLICY_VERSION;
