-- Changes: adds one database login, score_snapshot_writer, for the weekly score save
-- (.github/workflows/score-snapshots.yml, decision 94, Worker 27.6). Its only grants are USAGE on
-- schema public and EXECUTE on public.canvas_score_snapshot_save. It has no table, view or other
-- function grants. That function is SECURITY DEFINER with an empty search_path and does one
-- insert-or-update on public.canvas_score_snapshots, so this login can write that week's score row
-- and nothing else. No existing object, grant or row changes.
--
-- Requires: 20261116200000_canvas_score_snapshots (creates the function). If the function does not
-- exist, this file raises an error and changes nothing, so apply it after that migration.
--
-- The password is NOT set here and must not be committed. After applying, the person applying runs
-- once in the SQL Editor:
--   ALTER ROLE score_snapshot_writer WITH PASSWORD '<long random password>';
-- then stores the Session pooler connection string as the repository secret SCORE_SNAPSHOT_DB_URL:
--   postgresql://score_snapshot_writer.<project_ref>:<password>@<pooler host>:5432/postgres?sslmode=require
--
-- Check after applying (should list only canvas_score_snapshot_save; Postgres grants EXECUTE to
-- PUBLIC on functions by default, so any other row is a function that every login can run):
--   SELECT p.oid::regprocedure AS fn, p.prosecdef AS runs_as_owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname IN ('public', 'command')
--     AND has_function_privilege('score_snapshot_writer', p.oid, 'EXECUTE')
--   ORDER BY 1;
--
-- Production only: the copies (sandbox, mirror, claude) do not run the weekly save.
--
-- Undo:
--   REVOKE EXECUTE ON FUNCTION public.canvas_score_snapshot_save(text, date, numeric, numeric, numeric, numeric, jsonb) FROM score_snapshot_writer;
--   REVOKE USAGE ON SCHEMA public FROM score_snapshot_writer;
--   DROP ROLE score_snapshot_writer;
--   and delete the SCORE_SNAPSHOT_DB_URL repository secret (the weekly job then skips with a notice).
--
-- Adds a login and grants: Brian Watson applies (AGENTS.md).
-- Applied: not yet.

DO $$
BEGIN
  IF to_regprocedure('public.canvas_score_snapshot_save(text, date, numeric, numeric, numeric, numeric, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'public.canvas_score_snapshot_save does not exist; apply 20261116200000_canvas_score_snapshots first';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'score_snapshot_writer') THEN
    CREATE ROLE score_snapshot_writer WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 2;
  END IF;
END
$$;

ALTER ROLE score_snapshot_writer SET statement_timeout = '30s';

GRANT USAGE ON SCHEMA public TO score_snapshot_writer;
GRANT EXECUTE ON FUNCTION public.canvas_score_snapshot_save(text, date, numeric, numeric, numeric, numeric, jsonb)
  TO score_snapshot_writer;
