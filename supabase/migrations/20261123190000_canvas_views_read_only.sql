-- Changes: permissions only, on six existing views in public, plus the default grants for tables
-- and views the postgres role creates in public from now on. No view definition, table or row
-- changes. No screen change: the dashboard only reads these views.
--
--   1. authenticated loses every right except SELECT on:
--        public.canvas_amazon_product_types  (had INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES,
--        public.canvas_site_types             TRIGGER, MAINTAIN)
--        public.canvas_ai_citations           (had MAINTAIN)
--        public.canvas_ai_current_run         (had MAINTAIN)
--        public.canvas_ai_probes              (had MAINTAIN)
--        public.canvas_ai_run_history         (had MAINTAIN)
--      anon already has nothing on these six since the 23 Nov lockdown (20261123130100) and still
--      gets nothing. postgres and service_role keep what they have.
--   2. Default privileges: tables and views that postgres creates in public later no longer grant
--      anon and authenticated everything (arwdDxtm). Each new object then needs its own GRANT, which
--      every migration in this repo already writes.
--
-- Why (Build Audit C3): after the 23 Nov lockdown (#264) anon has no access, but signed-in users
-- still held write rights on two canvas views and MAINTAIN on four more. Read on prod 23 Nov 2026:
-- all six are security_invoker views owned by postgres, so a write is checked against the base
-- table as the caller; canvas_amazon_product_types and canvas_ai_run_history are auto-updatable
-- single-table views (over command.fmic_listing_content and command.fmic_audit_runs). No write
-- works today only because the base tables or their RLS refuse it, not because of the view's own
-- grant. These are leftovers of Supabase's default grant for new public objects
-- (pg_default_acl: postgres in public, r = anon/authenticated arwdDxtm), which is why part 2 exists.
-- Every other canvas_* relation in public and ledlenser is already SELECT-only for both roles.
--
-- Kept: SELECT for authenticated on all six (the dashboard reads them: lib/ai-search/queries.ts,
-- lib/ai-search/history-queries.ts, lib/ai-search/site-types.ts,
-- lib/findability/amazon-product-types.ts). Nothing in the app writes to a canvas_* relation; the
-- writes go through functions (set_aside_issue, reopen_set_aside, mark_issue_done,
-- site_type_override, ai_prompt_save, actuation_*), which this file does not touch.
-- Not changed: default grants for functions and sequences in public, and supabase_admin's own
-- defaults (those apply only to objects supabase_admin creates).
--
-- Alters permissions on existing objects: waits for Brian Watson to apply (AGENTS.md).
-- Applied: not yet.
--
-- How to verify after apply (expect zero rows from the first, and no anon/authenticated entry
-- in the second):
--   select n.nspname, c.relname, a.grantee::regrole, a.privilege_type
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace, aclexplode(c.relacl) a
--    where c.relname like 'canvas\_%' and c.relkind in ('r', 'v', 'm', 'p', 'f')
--      and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
--      and a.privilege_type <> 'SELECT';
--   select defaclacl::text from pg_default_acl
--    where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace
--      and defaclobjtype = 'r';
--
-- Undo (restores the grants as they were on prod 23 Nov 2026):
--   GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
--     ON public.canvas_amazon_product_types, public.canvas_site_types TO authenticated;
--   GRANT MAINTAIN ON public.canvas_ai_citations, public.canvas_ai_current_run,
--     public.canvas_ai_probes, public.canvas_ai_run_history TO authenticated;
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;

-- 1. The six views: SELECT only for authenticated, nothing for anon. Each view is skipped on a
--    copy of the database where it does not exist.
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'public.canvas_amazon_product_types',
    'public.canvas_site_types',
    'public.canvas_ai_citations',
    'public.canvas_ai_current_run',
    'public.canvas_ai_probes',
    'public.canvas_ai_run_history']
  LOOP
    IF to_regclass(v) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON %s FROM anon, authenticated', v);
      EXECUTE format('GRANT SELECT ON %s TO authenticated', v);
    END IF;
  END LOOP;
END $$;

-- 2. Future objects. This is the cause of the leftovers above: every table or view postgres
--    creates in public has been granted to anon and authenticated in full unless the migration
--    revoked it. After this, a new public object starts with no rights for those two roles and
--    its migration grants what it needs (usually SELECT to authenticated). service_role keeps its
--    default. Separate from part 1 so it can be left out on its own if needed.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
