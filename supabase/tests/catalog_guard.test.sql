-- 1.6 catalog guards. Read-only: it only queries the catalog, so the same file can be run against
-- staging after applying (psql -v ON_ERROR_STOP=1 -f supabase/tests/catalog_guard.test.sql).
-- Each block raises with the full list of offenders.
\set ON_ERROR_STOP 1

-- Client data relations: everything in the client schemas (except the sign-in tables and the
-- marketplace reference lists), the public tables with client data, and every view that reads
-- any of them, in any schema.
create temporary view client_relation as
with recursive base as (
  select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('command', 'canvas_private', 'ledlenser', 'ledlenser_private', 'sandbox')
    and c.relkind in ('r', 'p', 'v', 'm')
    -- array_remove: a missing table must not turn the whole test into NULL (which excludes all).
    and c.oid <> all (array_remove(array[to_regclass('command.organizations'), to_regclass('command.user_profiles'),
      to_regclass('command.organization_memberships'), to_regclass('command.client_organizations'),
      to_regclass('sandbox.seller'),
      to_regclass('sandbox.seller_type')]::oid[], null))
  union
  select c.oid from pg_class c
  where c.oid = any (array_remove(array[
    to_regclass('public.issue_set_asides'), to_regclass('public.set_aside_clients'),
    to_regclass('public.canvas_score_snapshots'), to_regclass('public.site_type_classifications'),
    to_regclass('public.site_type_overrides'),
    to_regclass('public.actuation_programs'), to_regclass('public.actuation_items'),
    to_regclass('public.actuation_expiry_reminders_sent')]::oid[], null))
  union
  select rw.ev_class from pg_depend d join pg_rewrite rw on rw.oid = d.objid
  join base b on b.oid = d.refobjid
  where d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
)
select distinct c.oid, c.oid::regclass::text as name, c.relkind, c.relrowsecurity, c.reloptions
from base b join pg_class c on c.oid = b.oid;

-- 0. The guard itself sees the client schemas (a broken scope would pass everything).
do $$ begin
  if (select count(*) from client_relation) = 0 then raise exception 'guard found no client relations'; end if;
  raise notice 'catalog guard: % client relations', (select count(*) from client_relation);
end $$;

-- 1. Nothing with client data is selectable by anon (table or any column).
do $$
declare bad text;
begin
  select string_agg(name, ', ' order by name) into bad from client_relation
  where has_table_privilege('anon', oid, 'select') or has_any_column_privilege('anon', oid, 'select');
  if bad is not null then raise exception 'anon can select client data: %', bad; end if;
end $$;

-- 2. Every view over client data runs as the caller.
do $$
declare bad text;
begin
  select string_agg(name, ', ' order by name) into bad from client_relation
  where relkind = 'v'
    and not coalesce(reloptions && array['security_invoker=true', 'security_invoker=on', 'security_invoker=1'], false);
  if bad is not null then raise exception 'views over client data without security_invoker: %', bad; end if;
end $$;

-- 3. Every client table has RLS and a membership policy; no policy for anon, authenticated or
--    PUBLIC is a literal true.
do $$
declare bad text;
begin
  select string_agg(name, ', ' order by name) into bad from client_relation
  where relkind in ('r', 'p') and not relrowsecurity;
  if bad is not null then raise exception 'client tables without RLS: %', bad; end if;

  select string_agg(name, ', ' order by name) into bad from client_relation r
  where relkind in ('r', 'p') and not exists (
    select 1 from pg_policy p where p.polrelid = r.oid and p.polcmd in ('r', '*')
      and pg_get_expr(p.polqual, p.polrelid) ~ 'private\.(can_read_client|readable_client_ids|can_read_set_aside_client)\(|command\.(can_read_client_key|can_read_schema|can_read_organization)\(');
  if bad is not null then raise exception 'client tables without a membership read policy: %', bad; end if;

  select string_agg(format('%s.%s', r.name, p.polname), ', ') into bad
  from client_relation r join pg_policy p on p.polrelid = r.oid
  where p.polroles && array[0::oid, 'anon'::regrole::oid, 'authenticated'::regrole::oid]
    and (pg_get_expr(p.polqual, p.polrelid) = 'true' or pg_get_expr(p.polwithcheck, p.polrelid) = 'true');
  if bad is not null then raise exception 'client policies that are literal true: %', bad; end if;

  select string_agg(format('%s.%s', r.name, p.polname), ', ') into bad
  from client_relation r join pg_policy p on p.polrelid = r.oid
  where 'anon'::regrole::oid = any (p.polroles);
  if bad is not null then raise exception 'client policies for anon: %', bad; end if;
end $$;

-- 4. Materialized views (no RLS possible) are not selectable by signed-in users either; they are
--    read through their private.mv__ reader functions.
do $$
declare bad text;
begin
  select string_agg(name, ', ' order by name) into bad from client_relation
  where relkind = 'm' and has_table_privilege('authenticated', oid, 'select');
  if bad is not null then raise exception 'materialized views selectable by authenticated: %', bad; end if;
end $$;

-- 5. Functions. No function in a client schema or private is executable by anon. Every
--    SECURITY DEFINER function a signed-in user can call that touches client data calls a
--    membership helper (or a function that does, or is staff only).
do $$
declare bad text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('command', 'canvas_private', 'ledlenser', 'ledlenser_private', 'sandbox', 'private')
    and has_function_privilege('anon', p.oid, 'execute');
  if bad is not null then raise exception 'anon can execute: %', bad; end if;

  select string_agg(p.oid::regprocedure::text, ', ') into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef
    and n.nspname in ('public', 'private', 'command', 'canvas_private', 'ledlenser', 'ledlenser_private', 'sandbox')
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.prosrc ~* '\m(command|canvas_private|ledlenser|ledlenser_private|sandbox)\.|\mpublic\.(issue_set_asides|audit_log|set_aside_clients|actuation_|canvas_)'
    -- Membership checks: the 1.6 helpers, the command sign-in checks (staff, org role, client
    -- key), and the prompt workflow's wrappers of command.user_has_org_role.
    and p.prosrc !~* 'private\.(can_read_client|readable_client_ids|can_read_set_aside_client|check_issue_input)\(|command\.(is_intofocus_admin|user_has_org_role|can_read_organization|can_read_client_key|can_read_schema|fmic_ai_prompt_require|fmic_ai_prompt_actor_ok)\('
    -- The dashboard sign-in functions read only the sign-in tables.
    and p.oid <> all (array_remove(array[to_regprocedure('command.is_intofocus_admin()'),
      to_regprocedure('command.user_has_org_role(uuid,command.organization_role)'),
      to_regprocedure('command.role_rank(command.organization_role)')]::oid[], null))
    and not (n.nspname = 'private' and p.proname in ('is_backend_caller',
      'can_read_client', 'readable_client_ids', 'can_read_set_aside_client'));
  if bad is not null then raise exception 'SECURITY DEFINER functions over client data without a membership check: %', bad; end if;

  -- Signed-in users reach private only for the helpers they need.
  select string_agg(p.oid::regprocedure::text, ', ') into bad
  from pg_proc p where p.pronamespace = 'private'::regnamespace
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname not in ('is_staff', 'module_access', 'has_org_role', 'is_active_org_member',
      'is_backend_caller', 'can_read_client', 'readable_client_ids', 'can_read_set_aside_client')
    and p.proname !~ '^mv__';
  if bad is not null then raise exception 'private functions callable by signed-in users: %', bad; end if;
end $$;

-- 5b. The client mapping is closed: read only through the SECURITY DEFINER helpers.
do $$ begin
  if to_regclass('command.client_organizations') is not null and (
       has_table_privilege('anon', 'command.client_organizations', 'select')
       or has_table_privilege('authenticated', 'command.client_organizations', 'select')
       or not (select relrowsecurity from pg_class where oid = 'command.client_organizations'::regclass)) then
    raise exception 'command.client_organizations is readable by anon or authenticated, or has no RLS';
  end if;
end $$;

-- 6. Objects created later in the client schemas are not granted to anon by default.
do $$
declare bad text;
begin
  select string_agg(format('%s (%s)', n.nspname, d.defaclobjtype), ', ') into bad
  from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace,
       aclexplode(d.defaclacl) a
  where n.nspname in ('command', 'canvas_private', 'ledlenser', 'ledlenser_private', 'sandbox')
    and a.grantee = 'anon'::regrole;
  if bad is not null then raise exception 'default privileges grant anon in: %', bad; end if;
  -- And a schema anon still has usage on holds nothing anon can read (checked in 1).
end $$;
