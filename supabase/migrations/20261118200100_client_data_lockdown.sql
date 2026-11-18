-- 1.6 Step 0b: client data is readable only by signed-in members of the owning account
-- (and IntoFocus staff for entitled accounts). Anonymous callers read nothing.
--
-- Alters existing permissions, policies, views and functions, so Brian Watson applies it, staging
-- first, after 20261118200000 and after inserting the private.client_schema_org rows. The dashboard
-- switch to signed-in reads ("Open the dashboard from the portal") must ship at the same time.
--
-- Scope. "Client schemas" and the account each belongs to:
--   command, canvas_private      -> private.can_read_schema('command')    (FMIC)
--   ledlenser, ledlenser_private -> private.can_read_schema('ledlenser')  (Ledlenser)
--   sandbox                      -> per row, client_id in private.readable_client_ids()
-- Not client data, left as they are: command.organizations, command.user_profiles,
-- command.organization_memberships (dashboard sign-in tables with their own policies),
-- sandbox.seller and sandbox.seller_type (marketplace reference lists, readable when signed in).
-- Public tables with client data, scoped by the account that owns the client_key
-- (public.set_aside_clients.organization_id) or by organization_id:
--   read by the dashboard: issue_set_asides, set_aside_clients, canvas_score_snapshots,
--     site_type_classifications, site_type_overrides, audit_log;
--   staff only (read through their staff functions, no SELECT grant): actuation_programs,
--     actuation_items, actuation_expiry_reminders_sent.
-- Registries the client views join (same for every client): set_aside_checks, set_aside_reasons,
-- site_type_settings become readable when signed in, and lose anon and authenticated writes.
-- Portal tables in public (organizations, work_* and so on) already have membership policies and
-- are not changed here.
--
-- What it does (objects are found from the catalog at apply time; every change is printed as a
-- NOTICE, so run it on staging first and keep the output):
--   1. Schema usage: anon loses USAGE on command, ledlenser and sandbox; authenticated gets USAGE
--      on canvas_private and ledlenser_private (views now run as the caller and read through them).
--   2. Every client table: REVOKE ALL from anon and PUBLIC; RLS on; every policy for anon,
--      authenticated or PUBLIC that is a literal true is dropped, as is every policy for anon;
--      a SELECT policy "client_read" for authenticated with the membership check is added;
--      SELECT granted to authenticated.
--   3. Every materialized view in a client schema (they cannot have RLS): REVOKE ALL from anon,
--      authenticated and PUBLIC. A SECURITY DEFINER reader private.mv__<schema>__<name>() returns
--      its rows only when the caller may read the schema, or is a backend caller (service_role or a
--      direct database session, which bypass row security on tables too); every view that read the materialized
--      view is redefined to read the function instead (same columns, same rows otherwise).
--   4. Every view in a client schema, and every public view that reads client data (directly or
--      through other views): security_invoker = true, REVOKE ALL from anon and PUBLIC, SELECT for
--      authenticated. Rows are then filtered by the policies in step 2.
--   5. Functions: EXECUTE revoked from anon and PUBLIC on every function in the client schemas and
--      on the public functions that return client data. The set-aside write path checks the
--      caller's membership for the client_key (private.check_issue_input, public.reopen_set_aside).
--   6. Default privileges (for role postgres, which owns these schemas and creates their objects):
--      new tables, views and functions in the client schemas are not granted to anon.
--
-- Check after applying (both must return no rows):
--   select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname in ('command','ledlenser','sandbox','canvas_private','ledlenser_private')
--      and c.relkind in ('r','p','v','m') and has_table_privilege('anon', c.oid, 'select');
--   select c.relname from pg_class c where c.relkind = 'v' and c.relnamespace = 'public'::regnamespace
--      and has_table_privilege('anon', c.oid, 'select') and c.relname like 'canvas\_%';
--
-- Undo. There is no one-line undo; restore from the NOTICE output of the apply run, which lists
-- every object changed. In short, per object type:
--   tables:  drop policy client_read on <t>; recreate the dropped policies (their definitions are
--            printed); grant select on <t> to anon (where it was granted before).
--   views:   alter view <v> set (security_invoker = false); grant select on <v> to anon;
--            redefined views over materialized views: re-run their printed old definitions.
--   matviews: grant select on <mv> to anon, authenticated; drop function private.mv__<schema>__<name>().
--   schemas: grant usage on schema command, ledlenser, sandbox to anon.
--   functions: grant execute on <f> to anon; re-run the old bodies of private.check_issue_input
--            and public.reopen_set_aside from 20261103150000.

begin;

set local search_path = '';

-- Scope tables, kept only for this transaction ------------------------------------------------

create temporary table lockdown_schema (schema_name text primary key, read_as text) on commit drop;
insert into lockdown_schema values
  ('command', 'command'), ('canvas_private', 'command'),
  ('ledlenser', 'ledlenser'), ('ledlenser_private', 'ledlenser'),
  ('sandbox', null);

create temporary table lockdown_skip (rel regclass primary key, why text) on commit drop;
do $$
declare r record;
begin
  for r in select * from (values
      ('command.organizations', 'dashboard sign-in table'),
      ('command.user_profiles', 'dashboard sign-in table'),
      ('command.organization_memberships', 'dashboard sign-in table'),
      ('sandbox.seller', 'marketplace reference list'),
      ('sandbox.seller_type', 'marketplace reference list')) v(name, why)
  loop
    if to_regclass(r.name) is not null then
      insert into pg_temp.lockdown_skip values (to_regclass(r.name), r.why);
    end if;
  end loop;
end $$;

-- Public tables that hold client data. read = the dashboard reads them (directly or through a
-- view), so signed-in users get SELECT, filtered by the policy; staff-only tables keep no SELECT
-- grant (read through their staff functions) but get the same policy.
create temporary table lockdown_public (rel regclass primary key, check_expr text not null, read boolean not null) on commit drop;
do $$
declare r record;
begin
  for r in select * from (values
      ('public.issue_set_asides', '(private.can_read_set_aside_client(client_key))', true),
      ('public.set_aside_clients', '(private.can_read_set_aside_client(client_key))', true),
      ('public.canvas_score_snapshots', '(private.can_read_set_aside_client(client_key))', true),
      ('public.site_type_classifications', '(private.can_read_set_aside_client(client_key))', true),
      ('public.site_type_overrides', '(private.can_read_set_aside_client(client_key))', true),
      ('public.audit_log', '(private.client_org_readable(organization_id))', true),
      ('public.actuation_programs', '(private.can_read_set_aside_client(client_key))', false),
      ('public.actuation_items', '(private.can_read_set_aside_client(client_key))', false),
      ('public.actuation_expiry_reminders_sent', '(private.can_read_set_aside_client(client_key))', false)
    ) v(name, check_expr, read)
  loop
    if to_regclass(r.name) is not null then
      insert into pg_temp.lockdown_public values (to_regclass(r.name), r.check_expr, r.read);
    end if;
  end loop;
end $$;

-- Row check for one client table (null when the table needs a decision).
create function pg_temp.lockdown_check(p_rel regclass) returns text language sql stable as $$
  select case
    when s.read_as is not null then format('(select private.can_read_schema(%L))', s.read_as)
    when c.oid = to_regclass('sandbox.fender_dealer_catalog')
      then $c$(select private.can_read_client('cl_fender'))$c$
    when exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'client_id'
                   and not a.attisdropped)
      then '(client_id in (select private.readable_client_ids()))'
    end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  join pg_temp.lockdown_schema s on s.schema_name = n.nspname
  where c.oid = p_rel
$$;

-- 1. Schema usage ------------------------------------------------------------------------------

do $$
declare s text;
begin
  foreach s in array array['command', 'ledlenser', 'sandbox'] loop
    if to_regnamespace(s) is not null then
      execute format('revoke usage on schema %I from anon', s);
      raise notice '1.6 schema %: usage revoked from anon', s;
    end if;
  end loop;
  foreach s in array array['canvas_private', 'ledlenser_private'] loop
    if to_regnamespace(s) is not null then
      execute format('grant usage on schema %I to authenticated', s);
      raise notice '1.6 schema %: usage granted to authenticated', s;
    end if;
  end loop;
end $$;

-- 2. Client tables -----------------------------------------------------------------------------

create function pg_temp.lockdown_table(p_rel regclass, p_check text, p_grant boolean default true) returns void
language plpgsql as $$
declare pol record;
begin
  execute format('revoke all on table %s from anon, public', p_rel);
  -- Sequences behind the table's id columns too.
  for pol in
    select d.objid::regclass as seq from pg_depend d join pg_class s on s.oid = d.objid
    where d.refobjid = p_rel and d.classid = 'pg_class'::regclass and s.relkind = 'S'
  loop
    execute format('revoke all on sequence %s from anon, public', pol.seq);
  end loop;
  execute format('alter table %s enable row level security', p_rel);
  for pol in
    select p.polname, pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as wcheck, p.polroles, p.polcmd
    from pg_policy p
    where p.polrelid = p_rel
      and (p.polroles && array[0::oid, 'anon'::regrole::oid, 'authenticated'::regrole::oid])
      and (
        'anon'::regrole::oid = any (p.polroles)
        or coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true'
           and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), 'true') = 'true'
      )
  loop
    raise notice '1.6 table %: drop policy % (cmd %, using %, with check %)',
      p_rel, pol.polname, pol.polcmd, pol.qual, pol.wcheck;
    execute format('drop policy %I on %s', pol.polname, p_rel);
  end loop;
  execute format('drop policy if exists client_read on %s', p_rel);
  execute format('create policy client_read on %s for select to authenticated using (%s)', p_rel, p_check);
  if p_grant then
    execute format('grant select on table %s to authenticated', p_rel);
  end if;
  raise notice '1.6 table %: rls on, anon revoked, policy client_read using %, select for authenticated: %',
    p_rel, p_check, p_grant;
end $$;

do $$
declare r record; chk text;
begin
  for r in
    select c.oid::regclass as rel
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_temp.lockdown_schema s on s.schema_name = n.nspname
    where c.relkind in ('r', 'p')
      and not exists (select 1 from pg_temp.lockdown_skip k where k.rel = c.oid)
      and not c.relispartition
    order by 1::text
  loop
    chk := pg_temp.lockdown_check(r.rel);
    if chk is null then
      raise exception '1.6: % has no client_id and no mapping; decide how it is scoped before applying', r.rel;
    end if;
    perform pg_temp.lockdown_table(r.rel, chk);
  end loop;

  -- Skipped tables still lose anon.
  for r in select rel from pg_temp.lockdown_skip loop
    execute format('revoke all on table %s from anon', r.rel);
    raise notice '1.6 table % (not client data): anon revoked, policies unchanged', r.rel;
  end loop;

  -- Public tables that hold client data.
  for r in select * from pg_temp.lockdown_public order by rel::text loop
    perform pg_temp.lockdown_table(r.rel, r.check_expr, r.read);
  end loop;
end $$;

-- Registries the client views join (same rows for every client): readable when signed in.
do $$
declare t text;
begin
  foreach t in array array['public.set_aside_checks', 'public.set_aside_reasons', 'public.site_type_settings'] loop
    if to_regclass(t) is not null then
      execute format('revoke insert, update, delete, truncate, references, trigger on table %s from anon, authenticated', t);
      execute format('alter table %s enable row level security', t);
      execute format('drop policy if exists registry_read on %s', t);
      execute format('create policy registry_read on %s for select to authenticated using (true)', t);
      execute format('grant select on table %s to authenticated', t);
      raise notice '1.6 table % (registry, not client data): select for authenticated; anon and authenticated writes revoked', t;
    end if;
  end loop;
end $$;

-- 3. Materialized views ------------------------------------------------------------------------

create temporary table lockdown_mv (mv regclass primary key, reader text not null) on commit drop;

do $$
declare r record; reader text; chk text;
begin
  for r in
    select c.oid::regclass as mv, n.nspname, c.relname, s.read_as
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_temp.lockdown_schema s on s.schema_name = n.nspname
    where c.relkind = 'm'
    order by 1::text
  loop
    if r.read_as is null then
      raise exception '1.6: materialized view % in sandbox needs a reader decision', r.mv;
    end if;
    reader := format('private.%I', 'mv__' || r.nspname || '__' || r.relname);
    chk := format('(private.can_read_schema(%L) or private.is_backend_caller())', r.read_as);
    execute format('revoke all on table %s from anon, authenticated, public', r.mv);
    execute format(
      'create or replace function %s() returns setof %s language sql stable security definer '
      'set search_path = '''' as $f$ select * from %s where %s $f$',
      reader, r.mv, r.mv, chk);
    execute format('revoke all on function %s() from public, anon', reader);
    execute format('grant execute on function %s() to authenticated, service_role', reader);
    execute format('comment on function %s() is %L', reader,
      '1.6: rows of ' || r.mv::text || ' for callers who may read ' || r.read_as || '.');
    insert into pg_temp.lockdown_mv values (r.mv, reader);
    raise notice '1.6 matview %: revoked from anon and authenticated; reader %()', r.mv, reader;
  end loop;
end $$;

-- Redefine views that read a materialized view so they read its reader function instead.
-- With search_path empty, pg_get_viewdef qualifies every name, so "schema.mv" is matched exactly.
-- A FROM item keeps its alias, or is given the materialized view's own name as alias, so column
-- references in the rest of the definition still resolve.
do $$
declare v record; m record; def text; newdef text; mvname text;
begin
  for v in
    select distinct d.refobjid as mv_oid, r.ev_class::regclass as view
    from pg_depend d join pg_rewrite r on r.oid = d.objid
    join pg_temp.lockdown_mv lm on lm.mv = d.refobjid
    where d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
      and r.ev_class <> d.refobjid
  loop
    select * into m from pg_temp.lockdown_mv where mv = v.mv_oid;
    def := pg_get_viewdef(v.view, false);
    select c.relname into mvname from pg_class c where c.oid = v.mv_oid;
    -- "schema.mv alias" -> "reader() alias"; then a bare "schema.mv" -> "reader() mv".
    newdef := regexp_replace(def,
      '\m' || regexp_replace(m.mv::text, '([.])', '\\\1', 'g') ||
      '\M(\s+(?!(WHERE|JOIN|LEFT|RIGHT|INNER|FULL|CROSS|ON|USING|GROUP|ORDER|LIMIT|OFFSET|UNION|EXCEPT|INTERSECT|WINDOW|HAVING|LATERAL|NATURAL)\M)[a-z_][a-z0-9_]*)',
      m.reader || '()\1', 'gi');
    newdef := regexp_replace(newdef,
      '\m' || regexp_replace(m.mv::text, '([.])', '\\\1', 'g') || '\M(?!\()',
      m.reader || '() ' || quote_ident(mvname), 'gi');
    if newdef = def then
      raise exception '1.6: could not rewrite % (reads %)', v.view, m.mv;
    end if;
    raise notice '1.6 view %: old definition: %', v.view, def;
    execute format('create or replace view %s as %s', v.view, newdef);
    raise notice '1.6 view %: now reads %() instead of %', v.view, m.reader, m.mv;
  end loop;
end $$;

-- 4. Views -------------------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    with recursive client_rel as (
      -- Client schema relations and the public client tables.
      select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in (select schema_name from pg_temp.lockdown_schema)
         or c.oid in (select rel from pg_temp.lockdown_public)
      union
      -- Views that read any of them.
      select rw.ev_class from pg_depend d join pg_rewrite rw on rw.oid = d.objid
      join client_rel cr on cr.oid = d.refobjid
      where d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
    )
    select c.oid::regclass as view
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'v' and c.oid in (select oid from client_rel)
      and n.nspname not in ('pg_catalog', 'information_schema')
    order by 1::text
  loop
    execute format('alter view %s set (security_invoker = true)', r.view);
    execute format('revoke all on table %s from anon, public', r.view);
    execute format('grant select on table %s to authenticated', r.view);
    raise notice '1.6 view %: security_invoker on, anon revoked, select for authenticated', r.view;
  end loop;
end $$;

-- 5. Functions ---------------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in (select schema_name from pg_temp.lockdown_schema)
      and p.prokind in ('f', 'p')
    order by 1::text
  loop
    execute format('revoke execute on %s %s from anon, public',
      case when (select prokind from pg_proc where oid = r.fn) = 'p' then 'procedure' else 'function' end, r.fn);
    raise notice '1.6 function %: execute revoked from anon and public', r.fn;
  end loop;
end $$;

-- Set-aside writes: the caller must be able to read the client they write for.
create or replace function private.check_issue_input(
  p_client_key text,
  p_check_key text,
  p_entity_key text,
  p_name text,
  p_note text
)
returns public.set_aside_checks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check public.set_aside_checks;
  v_key text := btrim(coalesce(p_entity_key, ''));
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not exists (select 1 from public.set_aside_clients where client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  -- 1.6: membership of the client's account, never the key alone.
  if not private.can_read_set_aside_client(p_client_key) then
    raise exception 'You do not have access to this client.' using errcode = '42501';
  end if;
  select * into v_check from public.set_aside_checks where check_key = p_check_key;
  if not found then
    raise exception 'Unknown check.' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your name (2 to 80 characters).' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;
  if (v_check.entity_type = 'asin' and v_key !~ '^[A-Z0-9]{10}$')
     or (v_check.entity_type = 'queue_item' and v_key !~ '^[a-z0-9-]{2,60}$')
     or (v_check.entity_type = 'url' and (v_key !~ '^https?://' or char_length(v_key) > 500)) then
    raise exception 'That item id does not fit this check.' using errcode = '22023';
  end if;
  return v_check;
end;
$$;
revoke all on function private.check_issue_input(text, text, text, text, text) from public, anon;

create or replace function public.reopen_set_aside(
  p_id uuid,
  p_name text,
  p_note text default null
)
returns public.issue_set_asides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_row public.issue_set_asides;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your name (2 to 80 characters).' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;

  update public.issue_set_asides
     set status = 'reopened',
         reopened_by_name = v_name,
         reopened_by_user_id = auth.uid(),
         reopened_at = now(),
         reopen_note = v_note,
         updated_at = now()
   where id = p_id and status = 'active'
     -- 1.6: only rows of a client the caller may read.
     and private.can_read_set_aside_client(client_key)
  returning * into v_row;

  if not found then
    raise exception 'That item is not done or set aside.' using errcode = '22023';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.reopen_set_aside(uuid, text, text) from public, anon;

-- 6. Default privileges for objects created later in the client schemas -----------------------

do $$
declare s text;
begin
  for s in select schema_name from pg_temp.lockdown_schema where to_regnamespace(schema_name) is not null loop
    -- for role postgres: the role that owns these schemas and creates their objects on hosted.
    execute format('alter default privileges for role postgres in schema %I revoke all on tables from anon', s);
    execute format('alter default privileges for role postgres in schema %I revoke all on functions from anon', s);
    raise notice '1.6 schema %: default privileges no longer grant anon', s;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
