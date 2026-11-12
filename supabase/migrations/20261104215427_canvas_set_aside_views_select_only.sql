-- Changes: permissions on two existing views, public.canvas_set_aside_events and
-- public.canvas_set_aside_reasons. anon and authenticated keep SELECT and lose every other right
-- (INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN). postgres and service_role keep
-- what they have. The view definitions and all data stay as they are.
--
-- Why: 20261102190000_issue_set_asides and 20261103150000_issue_done created these views and
-- granted SELECT without a revoke first, so they kept Supabase's default write grants for new
-- public views (anon=arwdDxtm, authenticated=arwdDxtm). Both views are simple enough for Postgres
-- to accept INSERT, UPDATE, and DELETE through them, and both are security_invoker=false and owned
-- by postgres, so those writes run as the owner and skip row-level security on the tables behind
-- them. With the public key alone, a request could delete or rewrite set-aside history in
-- public.audit_log (through canvas_set_aside_events) or change public.set_aside_reasons (through
-- canvas_set_aside_reasons). The dashboard only reads these views, and the set-aside functions
-- write the tables directly, so SELECT is all these roles need.
--
-- Each DO block skips a database where that view does not exist, so the same file is safe on the
-- copies.
--
-- Applied: production, 4 Nov 2026 21:54 UTC, by Brian Watson, recorded as version 20261104215427.
-- Checked 11 Nov 2026: anon=r and authenticated=r on both views.
--
-- Undo (restores the previous grants):
--   GRANT ALL ON public.canvas_set_aside_events TO anon, authenticated;
--   GRANT ALL ON public.canvas_set_aside_reasons TO anon, authenticated;
--
-- Approved: Brian Watson, 4 Nov 2026.
-- Applied: prod, 4 Nov 2026 (UTC) by Brian Watson's Claude Code session, recorded in migration
--   history as version 20261104215427 (file renamed from 20261104152213 to match).
--   sandbox, mirror, claude: not yet applied.
-- Verified on prod after apply: both views anon=r and authenticated=r, postgres and service_role
--   unchanged; as anon, both views still read (7 reasons, 2 events) and DELETE/UPDATE are denied.

DO $$
BEGIN
  IF to_regclass('public.canvas_set_aside_events') IS NOT NULL THEN
    REVOKE ALL ON public.canvas_set_aside_events FROM anon, authenticated;
    GRANT SELECT ON public.canvas_set_aside_events TO anon, authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.canvas_set_aside_reasons') IS NOT NULL THEN
    REVOKE ALL ON public.canvas_set_aside_reasons FROM anon, authenticated;
    GRANT SELECT ON public.canvas_set_aside_reasons TO anon, authenticated;
  END IF;
END $$;
