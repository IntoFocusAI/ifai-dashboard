-- 1.6 isolation: for every relation with client data (found from the catalog of the hosted
-- structure), each actor sees only what their account membership allows.
-- Accounts and rows come from fixtures/90_test_accounts.sql: org A owns command (FMIC), sandbox
-- client cl_fender and set-aside client fmic; org B owns ledlenser, cl_ledlenser and ledlenser.
-- Staff (platform_admin) is a member of neither. Run twice:
--   1. as the database is today (no portal entitlement functions): staff read every account that
--      has dashboard data;
--   2. with the portal's private.is_staff() and private.module_access() present and org A the only
--      entitled account: staff read org A only.
\set ON_ERROR_STOP 1

create temporary table actor (who text primary key, role text, uid uuid);
insert into actor values
  ('anon', 'anon', null),
  ('a_admin', 'authenticated', '00000000-0000-0000-0000-0000000000a1'),
  ('a_member', 'authenticated', '00000000-0000-0000-0000-0000000000a2'),
  ('a_removed', 'authenticated', '00000000-0000-0000-0000-0000000000a3'),
  ('b_admin', 'authenticated', '00000000-0000-0000-0000-0000000000b1'),
  ('staff', 'authenticated', '00000000-0000-0000-0000-0000000000c1'),
  ('no_account', 'authenticated', '00000000-0000-0000-0000-0000000000d1');

-- Run one query as an actor, the way PostgREST does (session user authenticator, then SET ROLE).
-- Returns null when the actor may not read what the query touches.
create function pg_temp.query_as(p_who text, p_sql text) returns text
language plpgsql as $$
declare v text; a record;
begin
  select * into a from pg_temp.actor where who = p_who;
  perform set_config('request.jwt.claims',
    jsonb_build_object('role', a.role, 'sub', coalesce(a.uid::text, ''))::text, true);
  set session authorization authenticator;
  execute format('set role %I', a.role);
  begin
    execute p_sql into v;
  exception when insufficient_privilege then v := null;
  end;
  reset role;
  reset session authorization;
  return v;
end $$;

create function pg_temp.count_sql(p_rel regclass, p_where text default 'true') returns text language sql as $$
  select format('select count(*) from %s where %s', p_rel, p_where)
$$;
-- Everything visible in a relation, as one hash (covers aggregate views, where counts do not).
create function pg_temp.hash_sql(p_rel regclass) returns text language sql as $$
  select format('select md5(coalesce(string_agg(t::text, %L order by t::text), %L)) from %s t', '|', '', p_rel)
$$;

-- Every relation with client data, which account owns it ('A', 'B', or 'rows' when each row
-- carries its client), and the column that says whose a row is.
create temporary table subject as
with recursive base as (
  select c.oid,
         case when c.oid = 'sandbox.fender_dealer_catalog'::regclass then 'A'
              when n.nspname in ('command', 'canvas_private') then 'A'
              when n.nspname in ('ledlenser', 'ledlenser_private') then 'B'
              else 'rows' end as side
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('command', 'canvas_private', 'ledlenser', 'ledlenser_private', 'sandbox')
    and c.relkind in ('r', 'p', 'v', 'm')
    and c.oid <> all (array_remove(array[to_regclass('command.organizations'), to_regclass('command.user_profiles'),
      to_regclass('command.organization_memberships'), to_regclass('sandbox.seller'),
      to_regclass('sandbox.seller_type')]::oid[], null))
  union all
  select c.oid, 'rows' from pg_class c
  where c.oid = any (array_remove(array[
    to_regclass('public.issue_set_asides'), to_regclass('public.set_aside_clients'),
    to_regclass('public.canvas_score_snapshots'), to_regclass('public.site_type_classifications'),
    to_regclass('public.site_type_overrides'), to_regclass('public.audit_log'),
    to_regclass('public.actuation_programs'), to_regclass('public.actuation_items'),
    to_regclass('public.actuation_expiry_reminders_sent')]::oid[], null))
  union
  select rw.ev_class, b.side from pg_depend d join pg_rewrite rw on rw.oid = d.objid
  join base b on b.oid = d.refobjid
  where d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
    and rw.ev_class <> d.refobjid
)
select c.oid::regclass as rel, c.relkind,
       case when count(distinct b.side) = 1 then min(b.side) else 'mixed' end as side,
       case
         when exists (select 1 from pg_attribute where attrelid = c.oid and attname = 'client_id' and not attisdropped) then 'client_id'
         when exists (select 1 from pg_attribute where attrelid = c.oid and attname = 'client_key' and not attisdropped) then 'client_key'
         when exists (select 1 from pg_attribute where attrelid = c.oid and attname = 'organization_id' and not attisdropped) then 'organization_id'
       end as key_col
from base b join pg_class c on c.oid = b.oid
group by c.oid;

-- Row filter for one account's rows.
create function pg_temp.rows_of(p_org text, p_key_col text) returns text language sql as $$
  select case p_key_col
    when 'client_id' then format('client_id = %L', case p_org when 'A' then 'cl_fender' else 'cl_ledlenser' end)
    when 'client_key' then format('client_key = %L', case p_org when 'A' then 'fmic' else 'ledlenser' end)
    when 'organization_id' then format('organization_id = %L',
      case p_org when 'A' then '00000000-0000-0000-0000-00000000000a' else '00000000-0000-0000-0000-00000000000b' end)
  end
$$;

-- Which accounts an actor may read. Staff: A and B today; A only once entitlements exist.
create function pg_temp.reads(p_who text, p_mode text) returns text[] language sql as $$
  select case p_who
    when 'a_admin' then array['A'] when 'a_member' then array['A'] when 'b_admin' then array['B']
    when 'staff' then case p_mode when 'fallback' then array['A', 'B'] else array['A'] end
    else array[]::text[] end
$$;

create function pg_temp.check_all(p_mode text) returns text[] language plpgsql as $$
declare
  s record; errors text[] := '{}'; tested int := 0; owner_n bigint; owner_h text; empty_h text;
  who text; h text; n bigint; allowed text; denied text; org text; want text[];
begin
  for s in select * from pg_temp.subject order by rel::text loop
    tested := tested + 1;
    execute pg_temp.count_sql(s.rel) into owner_n;
    execute pg_temp.hash_sql(s.rel) into owner_h;

    if s.relkind in ('r', 'p') and owner_n = 0 then
      errors := errors || format('%s: fixture has no rows', s.rel);
    end if;
    if pg_temp.query_as('anon', pg_temp.count_sql(s.rel)) is not null then
      errors := errors || format('%s: anon can read', s.rel);
    end if;

    -- Backend only (materialized views, staff-only tables, views over backend-only functions):
    -- no signed-in user reads them directly.
    if not has_table_privilege('authenticated', s.rel, 'select') then
      foreach who in array array['a_admin', 'b_admin', 'staff'] loop
        if pg_temp.query_as(who, pg_temp.count_sql(s.rel)) is not null then
          errors := errors || format('%s: backend-only relation readable by %s', s.rel, who);
        end if;
      end loop;
      continue;
    end if;

    if s.side in ('A', 'B') then
      -- Per-client schema: readers of the owning account see exactly what the owner sees;
      -- everyone else sees exactly what a signed-in user with no account sees, which must differ
      -- from the owner's view when there is data.
      empty_h := coalesce(pg_temp.query_as('no_account', pg_temp.hash_sql(s.rel)), 'denied');
      if owner_n > 0 and empty_h = owner_h then
        errors := errors || format('%s: a user with no account sees the same as the owner', s.rel);
      end if;
      foreach who in array array['a_admin', 'a_member', 'a_removed', 'b_admin', 'staff'] loop
        h := coalesce(pg_temp.query_as(who, pg_temp.hash_sql(s.rel)), 'denied');
        if s.side = any (pg_temp.reads(who, p_mode)) then
          if h <> owner_h then
            errors := errors || format('%s: %s does not see all rows (%s)', s.rel, who,
              coalesce(pg_temp.query_as(who, pg_temp.count_sql(s.rel)) || ' of ' || owner_n, 'denied'));
          end if;
        elsif h <> empty_h then
          errors := errors || format('%s: %s sees data of another account', s.rel, who);
        end if;
      end loop;
    elsif s.side = 'rows' and s.key_col is not null then
      foreach who in array array['a_admin', 'a_member', 'a_removed', 'b_admin', 'staff', 'no_account'] loop
        want := pg_temp.reads(who, p_mode);
        allowed := 'false';
        foreach org in array want loop
          allowed := allowed || ' or ' || pg_temp.rows_of(org, s.key_col);
        end loop;
        n := coalesce(pg_temp.query_as(who, pg_temp.count_sql(s.rel, format('not (%s)', allowed)))::bigint, -1);
        if n <> 0 then
          errors := errors || format('%s: %s sees %s rows of other accounts', s.rel, who, n);
        end if;
        execute pg_temp.count_sql(s.rel, allowed) into owner_n;
        n := coalesce(pg_temp.query_as(who, pg_temp.count_sql(s.rel, allowed))::bigint, -1);
        if n <> owner_n then
          errors := errors || format('%s: %s sees %s of %s of its own rows', s.rel, who, n, owner_n);
        end if;
      end loop;
    else
      -- No client column (a sandbox view without client_id, or a view over both accounts):
      -- nobody without an account sees more than the empty result, and nobody sees more rows
      -- than exist.
      empty_h := coalesce(pg_temp.query_as('no_account', pg_temp.hash_sql(s.rel)), 'denied');
      if coalesce(pg_temp.query_as('a_removed', pg_temp.hash_sql(s.rel)), 'denied') <> empty_h then
        errors := errors || format('%s (%s): a removed member sees data', s.rel, s.side);
      end if;
      raise notice 'isolation (%): % (%) has no client column; checked against the empty result only', p_mode, s.rel, s.side;
    end if;
  end loop;

  -- Materialized view readers follow the same rule.
  for s in select p.oid::regprocedure as fn, p.proname from pg_proc p
           where p.pronamespace = 'private'::regnamespace and p.proname like 'mv\_\_%' loop
    foreach who in array array['a_admin', 'b_admin', 'staff', 'no_account'] loop
      n := coalesce(pg_temp.query_as(who, format('select count(*) from %s', s.fn))::bigint, -1);
      org := case when s.proname like 'mv\_\_command\_\_%' then 'A' else 'B' end;
      execute format('select count(*) from %s', s.fn) into owner_n;
      if (org = any (pg_temp.reads(who, p_mode)) and n <> owner_n) or (not org = any (pg_temp.reads(who, p_mode)) and n <> 0) then
        errors := errors || format('%s: %s gets %s of %s rows', s.fn, who, n, owner_n);
      end if;
    end loop;
    if pg_temp.query_as('anon', format('select count(*) from %s', s.fn)) is not null then
      errors := errors || format('%s: callable by anon', s.fn);
    end if;
  end loop;

  raise notice 'isolation (%): % relations checked for 7 actors', p_mode, tested;
  return errors;
end $$;

-- 1. The database as it is today.
do $$
declare errors text[];
begin
  errors := pg_temp.check_all('fallback');
  if array_length(errors, 1) > 0 then
    raise exception E'isolation failures (today):\n%', array_to_string(errors, E'\n');
  end if;
end $$;

-- 2. With the portal's staff and entitlement functions present; org A entitled, org B not.
create table private.test_entitlements (organization_id uuid primary key);
insert into private.test_entitlements values ('00000000-0000-0000-0000-00000000000a');
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_memberships m
                 where m.user_id = auth.uid() and m.status = 'active' and m.role = 'platform_admin')
$$;
create function private.module_access(p_organization_id uuid, p_module_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_module_key = 'consensus_control'
     and exists (select 1 from private.test_entitlements e where e.organization_id = p_organization_id)
$$;
grant execute on function private.is_staff(), private.module_access(uuid, text) to authenticated;

do $$
declare errors text[];
begin
  errors := pg_temp.check_all('entitled');
  if array_length(errors, 1) > 0 then
    raise exception E'isolation failures (with entitlements):\n%', array_to_string(errors, E'\n');
  end if;
end $$;

-- Back to the database as it is today, for the tests that follow.
drop function private.is_staff();
drop function private.module_access(uuid, text);
drop table private.test_entitlements;

-- Set-aside writes: a member writes for their own client only; reopen only their own rows.
do $$
declare v_check text; v_id uuid;
begin
  select check_key into v_check from public.set_aside_checks where entity_type = 'asin' limit 1;

  perform public.test_act_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
  perform public.mark_issue_done('fmic', v_check, 'B000000002', 'Ann A');
  begin
    perform public.mark_issue_done('ledlenser', v_check, 'L000000002', 'Ann A');
    raise exception 'org A wrote a set-aside for org B';
  exception when insufficient_privilege then null;
  end;
  reset role;
  reset session authorization;

  select id into v_id from public.issue_set_asides where client_key = 'ledlenser' and status = 'active' limit 1;
  if v_id is null then raise exception 'fixture: no active ledlenser set-aside'; end if;
  perform public.test_act_as('authenticated', '00000000-0000-0000-0000-0000000000a1');
  begin
    perform public.reopen_set_aside(v_id, 'Ann A');
    raise exception 'org A reopened an org B set-aside';
  exception when sqlstate '22023' then null;
  end;
  reset role;
  reset session authorization;

  perform public.test_act_as('authenticated', '00000000-0000-0000-0000-0000000000b1');
  perform public.reopen_set_aside(v_id, 'Bo B');
  reset role;
  reset session authorization;
end $$;
