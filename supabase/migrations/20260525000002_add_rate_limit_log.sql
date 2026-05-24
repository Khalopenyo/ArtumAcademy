-- =====================================================================
-- Migration: 20260525000002_add_rate_limit_log
-- rate_limit_log — Postgres sliding-window rate-limit attempt log
-- (AUTH-10, plan-06).
--
-- Stores one row per attempt; src/lib/rate-limit/index.ts counts recent
-- attempts within a window and either inserts a new row (allow) or
-- returns a denial (deny). Service-role-only (no user-facing reads or
-- writes). Cleanup function rate_limit_log_cleanup() is intended to
-- run daily via pg_cron — scheduling is deferred to P6 ops; the
-- function exists now so plan-06 owns its definition.
--
-- Schema source-of-truth: .planning/phases/2-auth-marketing-consent/
--   RESEARCH.md §Migrations §rate_limit_log (lines 952-979, used verbatim).
--
-- Index: composite (key, action, attempted_at DESC) supports the hot-path
-- query `WHERE key = ? AND action = ? AND attempted_at >= ?` with an
-- index-only seek.
-- =====================================================================

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id            bigserial PRIMARY KEY,
  key           text NOT NULL,           -- e.g. '203.0.113.5' or 'email:user@example.com'
  action        text NOT NULL,           -- 'auth.login', 'auth.register', 'auth.forgot_password'
  attempted_at  timestamptz NOT NULL DEFAULT now()
);

-- Composite index for hot-path query: count attempts for (key, action) within last window.
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_action_time
  ON rate_limit_log(key, action, attempted_at DESC);

ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
-- No policies — only service_role can read/write.

-- Cleanup function (call from pg_cron daily — wiring in P6 ops phase or manually run).
CREATE OR REPLACE FUNCTION rate_limit_log_cleanup()
  RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE attempted_at < now() - interval '24 hours';
END;
$$;

COMMENT ON TABLE rate_limit_log IS
  'Sliding-window rate-limit attempt log. Cleanup via rate_limit_log_cleanup() — schedule with pg_cron daily.';
