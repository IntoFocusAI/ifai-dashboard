-- Worker 28.1: let the existing score_snapshot_writer login run the Actuation expiry reminder job
-- (.github/workflows/actuation-reminders.yml, decision 77), so the job reuses the repository secret
-- SCORE_SNAPSHOT_DB_URL instead of needing a new login and secret.
--
-- Changes: grants EXECUTE on the three reminder functions to score_snapshot_writer. That login
-- already has USAGE on schema public and EXECUTE on public.canvas_score_snapshot_save only
-- (20261116210000_score_snapshot_writer_role). It gets no table or view grant: the functions run as
-- their owner and return only in-place P1 and P2 programs' client key, factor, owner name and expiry
-- date (no links, notes or domains), and write only the reminder sent-log.
--
-- This adds grants to an existing role, a permissions change: Brian Watson applies (AGENTS.md).
--
-- Requires: 20261116210000_score_snapshot_writer_role (the login) and
-- 20261116233000_actuation_expiry_reminders (the functions). If either is missing, this file raises
-- an error and changes nothing.
--
-- Check after applying (should list canvas_score_snapshot_save and the three reminder functions):
--   SELECT p.oid::regprocedure AS fn
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND has_function_privilege('score_snapshot_writer', p.oid, 'EXECUTE')
--   ORDER BY 1;
--
-- Undo:
--   REVOKE EXECUTE ON FUNCTION public.actuation_expiry_reminder_release(text, text, date, integer) FROM score_snapshot_writer;
--   REVOKE EXECUTE ON FUNCTION public.actuation_expiry_reminder_claim(text, text, date, integer, integer) FROM score_snapshot_writer;
--   REVOKE EXECUTE ON FUNCTION public.actuation_expiry_reminder_candidates() FROM score_snapshot_writer;
--   The daily reminder job then fails at its first read until the grants are back.
--
-- Production only: the copies (sandbox, mirror, claude) do not run the reminder job.
--
-- Status: NOT APPLIED. Permissions change; waits for Brian Watson.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'score_snapshot_writer') THEN
    RAISE EXCEPTION 'score_snapshot_writer does not exist; apply 20261116210000_score_snapshot_writer_role first';
  END IF;
  IF to_regprocedure('public.actuation_expiry_reminder_candidates()') IS NULL
     OR to_regprocedure('public.actuation_expiry_reminder_claim(text, text, date, integer, integer)') IS NULL
     OR to_regprocedure('public.actuation_expiry_reminder_release(text, text, date, integer)') IS NULL THEN
    RAISE EXCEPTION 'the reminder functions do not exist; apply 20261116233000_actuation_expiry_reminders first';
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.actuation_expiry_reminder_candidates() TO score_snapshot_writer;
GRANT EXECUTE ON FUNCTION public.actuation_expiry_reminder_claim(text, text, date, integer, integer) TO score_snapshot_writer;
GRANT EXECUTE ON FUNCTION public.actuation_expiry_reminder_release(text, text, date, integer) TO score_snapshot_writer;
