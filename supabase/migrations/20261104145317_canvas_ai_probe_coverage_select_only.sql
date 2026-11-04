-- Changes: permissions on the existing view public.canvas_ai_probe_coverage. anon and authenticated
-- keep SELECT and lose every other right (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER,
-- MAINTAIN). The view definition and all data stay as they are.
--
-- Why: 20261103221353_ai_search_v15_probe_views created the view and granted SELECT without a
-- revoke first, so it kept Supabase's default write grants for new public views
-- (anon=arwdDxtm). Every other canvas_ai_* view the dashboard reads is SELECT only for these roles.
--
-- The DO block skips any database where the view does not exist, so the same statement is safe on
-- the copies.
--
-- Undo (restores the previous grants):
--   GRANT ALL ON public.canvas_ai_probe_coverage TO anon, authenticated;
--
-- Approved: Brian Watson, 4 Nov 2026.
-- Applied: 4 Nov 2026 (UTC) by Brian Watson's Claude Code session, through the supabase_sql_runner wrench.
--   prod     14:53:17, recorded in migration history as version 20261104145317
--   sandbox, mirror, claude: same statement run with execute_sql (no migration history row)
-- Verified on prod after apply: anon=r, authenticated=r.

DO $$
BEGIN
  IF to_regclass('public.canvas_ai_probe_coverage') IS NOT NULL THEN
    REVOKE ALL ON public.canvas_ai_probe_coverage FROM anon, authenticated;
    GRANT SELECT ON public.canvas_ai_probe_coverage TO anon, authenticated;
  END IF;
END $$;
