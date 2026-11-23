-- The database login used by cloud AI coding agents (cursor_map_writer, SUPABASE_DB_URL in
-- AGENTS.md "Database changes") follows row-level security. Asked by Marc Savy, Slack DM 19 Nov
-- 2026: https://intofocusai.slack.com/archives/D0BTYRWJHUL/p1795100770754609
--
-- ALTERING (changes a role attribute and adds policies): Brian Watson applies it. Production only.
--
-- Changes:
--   1. ALTER ROLE cursor_map_writer NOBYPASSRLS. Today the login skips every RLS policy, so any
--      table it is ever granted is readable and writable in full, whatever its policies say.
--   2. Adds three policies so the login keeps exactly the access it has today (checked against
--      the production catalog on 23 Nov 2026):
--        command.fmic_electric_catalog   SELECT   (table grant: SELECT)
--        command.fmic_retail_buybox_map  SELECT   (table grant: SELECT)
--        command.fmic_retail_buybox_map  UPDATE   (column grants: UPDATE on map_price,
--                                                  mf_leakage, wmt_leakage only)
--      The policies cover every row of these two Fender tables, as today. The column grants still
--      limit which columns it can change. It has no other table, view or function grants and no
--      USAGE on schema private, so nothing else it can reach changes.
--   No grants, other roles, rows or existing policies change.
--
-- After this, a table granted to cursor_map_writer later is empty to it until a policy for it is
-- added, which is the point.
--
-- Not changed here (also BYPASSRLS, see the pull request):
--   postgres                 owner of every client table; Supabase-managed. Used by the Supabase
--                            SQL Editor, migrations and pg_net. Removing it would break them.
--   supabase_read_only_user  Supabase-managed (Management API "read-only" SQL, used by the
--                            Supabase MCP connector). Reserved role; cannot be altered by us.
--   service_role             the API key role; used by pipelines and server code.
--   supabase_admin, supabase_etl_admin  Supabase platform internals.
--
-- Check after applying (expects f, then three rows):
--   SELECT rolbypassrls FROM pg_roles WHERE rolname = 'cursor_map_writer';
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE 'cursor_map_writer' = ANY (roles) ORDER BY 1, 2;
-- Then, signed in as cursor_map_writer (SUPABASE_DB_URL), counts should match the owner's:
--   SELECT count(*) FROM command.fmic_electric_catalog;
--   SELECT count(*) FROM command.fmic_retail_buybox_map;
--   BEGIN; UPDATE command.fmic_retail_buybox_map SET map_price = map_price
--     WHERE asin = (SELECT asin FROM command.fmic_retail_buybox_map LIMIT 1); ROLLBACK;
--   (should report UPDATE 1 or more, not UPDATE 0)
--
-- Undo:
--   ALTER ROLE cursor_map_writer BYPASSRLS;
--   DROP POLICY IF EXISTS cursor_map_writer_select ON command.fmic_electric_catalog;
--   DROP POLICY IF EXISTS cursor_map_writer_select ON command.fmic_retail_buybox_map;
--   DROP POLICY IF EXISTS cursor_map_writer_update_map ON command.fmic_retail_buybox_map;
--
-- Applied: not yet.

begin;

alter role cursor_map_writer nobypassrls;

drop policy if exists cursor_map_writer_select on command.fmic_electric_catalog;
create policy cursor_map_writer_select on command.fmic_electric_catalog
  for select to cursor_map_writer using (true);

drop policy if exists cursor_map_writer_select on command.fmic_retail_buybox_map;
create policy cursor_map_writer_select on command.fmic_retail_buybox_map
  for select to cursor_map_writer using (true);

drop policy if exists cursor_map_writer_update_map on command.fmic_retail_buybox_map;
create policy cursor_map_writer_update_map on command.fmic_retail_buybox_map
  for update to cursor_map_writer using (true) with check (true);

commit;
