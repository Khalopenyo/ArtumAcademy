-- =====================================================================
-- Migration: 20260524000001_add_audit_log
-- audit_log — append-only finance/access/compliance trail (FOUND-05).
-- Read/write only via service_role (no user-facing reads in M1).
--
-- Filename rationale (Fix 9): Form `YYYYMMDD000001` (date + 6-digit
-- pseudo-sequence) is a DELIBERATE one-time exception, NOT the full
-- `YYYYMMDDHHMMSS` convention specified in .claude/skills/database/SKILL.md
-- line 18. Chosen to keep Phase 1's audit_log migration legibly grouped
-- with the base scaffold (20260522000001_init_base_tables.sql, same form)
-- — both are foundational. All P2+ migrations MUST use the skill's full
-- `date -u +%Y%m%d%H%M%S` convention to avoid same-day collisions.
--
-- Schema rationale (Fix 13):
--  - Column names match .claude/skills/security/SKILL.md §6 verbatim
--    (user_id, action, entity_type, entity_id, meta, ip_address,
--     created_at).
--  - INTENTIONAL divergences from the skill table (justified, documented):
--      a) `entity_id text` (skill says uuid). Reason: ЮKassa payment_id
--         and Kinescope external IDs are non-UUID strings. The skill's
--         `uuid` type is too narrow; text is necessary.
--      b) `user_agent text` ADDED (not in the skill table column list).
--         Reason: forensic value (browser/OS for fraud + 152-ФЗ
--         deletion audits). Non-conflicting addition.
--    A non-blocking doc-only follow-up should widen the skill table in
--    P2 housekeeping.
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,                              -- e.g. 'payment.succeeded'
  entity_type text,                                       -- e.g. 'purchase'
  entity_id   text,                                       -- text not uuid (see Fix 13 note above)
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address  inet,
  user_agent  text,                                       -- (added per Fix 13 note above)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns (admin export in M2; ops debugging in M1).
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- RLS: enable + empty policy set. Empty set means no user (anon/authenticated)
-- can read or write. service_role bypasses RLS (per Supabase docs), so admin
-- client inserts succeed. Defense-in-depth: two trigger functions below
-- block UPDATE/DELETE even for service_role to keep the log immutable.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Immutability trigger: forbids UPDATE/DELETE even for service_role.
-- Protects against accidental tampering by buggy admin code.
CREATE OR REPLACE FUNCTION public.audit_log_no_mutate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (no UPDATE/DELETE allowed)';
END;
$$;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_no_mutate();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_no_mutate();
