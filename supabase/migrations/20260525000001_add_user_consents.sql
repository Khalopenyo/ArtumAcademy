-- =====================================================================
-- Migration: 20260525000001_add_user_consents
-- user_consents — 152-ФЗ compliance evidence (AUTH-03, plan-06).
--
-- Append-only consent capture: every register stores two rows (one per
-- purpose — pdn_processing + oferta) carrying policy_version, IP, UA,
-- and timestamp. RKN audits read these rows as immutable proof that
-- a given user agreed to a specific policy version at a specific time.
--
-- Schema source-of-truth: .planning/phases/2-auth-marketing-consent/
--   RESEARCH.md §Migrations §user_consents (lines 904-947, used verbatim).
--
-- RLS:
--   - SELECT: own consents only (subquery form per Pitfall #11 — scales
--     better than direct auth.uid() reference under load).
--   - No INSERT/UPDATE/DELETE policies. Only service_role writes via
--     admin client from src/server/actions/auth.ts (plan-07).
--
-- Immutability trigger (defence in depth):
--   - Blocks UPDATE OR DELETE even from service_role.
--   - Mirrors the audit_log immutability pattern (plan-04, FOUND-05).
--   - If a user revokes consent, the consent row stays — a separate
--     `revoked_at` column (future) records the revocation instead of
--     mutating the original row. M1 has no revocation UI (PROF-02 → P6).
-- =====================================================================

CREATE TYPE consent_purpose AS ENUM ('pdn_processing', 'oferta');

CREATE TABLE IF NOT EXISTS user_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose         consent_purpose NOT NULL,
  policy_version  text NOT NULL,
  ip              inet,
  user_agent      text,
  accepted_at     timestamptz NOT NULL DEFAULT now(),
  -- One row per (user, purpose, version) — re-consent on new version creates new row.
  UNIQUE (user_id, purpose, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_purpose
  ON user_consents(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_user_consents_purpose_version
  ON user_consents(purpose, policy_version);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users CAN read their own consents (right to access — 152-ФЗ).
-- Subquery form per Pitfall #11 (scales better than auth.uid() at scale).
CREATE POLICY "Users read own consents"
  ON user_consents FOR SELECT
  USING ((select auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE policies — only service_role writes.
-- Consent is INSERT-only by domain — never updated.
-- (If a user revokes consent, we soft-delete via cron in M2.)

-- Immutability: prevent UPDATE or DELETE on existing rows even from
-- service_role (defence in depth).
CREATE OR REPLACE FUNCTION user_consents_no_update()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'user_consents is append-only';
END;
$$;

CREATE TRIGGER user_consents_no_update
  BEFORE UPDATE OR DELETE ON user_consents
  FOR EACH ROW EXECUTE FUNCTION user_consents_no_update();
