-- 1.6 isolation: for every relation with client data, each actor sees only what their account
-- membership allows. Accounts and rows come from fixtures/90_test_accounts.sql:
--   org A owns command (FMIC) and sandbox client cl_fender; org B owns ledlenser and cl_ledlenser;
--   staff is entitled to org A only.
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
grant select on actor to anon, authenticated;

-- Run a query as an actor, the way PostgREST does (session user authenticator, then SET ROLE).
-- Returns null when the actor may not read the relation.
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

-- Row count as an actor, with an optional filter; -1 when the actor may not read the relation.
create function pg_temp.count_as(p_who text, p_rel regclass, p_where text default 'true') returns bigint
language sql as $$
  select coalesce(pg_temp.query_as(p_who, format('select count(*) from %s where %s', p_rel, p_where))::bigint, -1)
$$;

-- Everything an actor sees in a relation, as one hash ('denied' when they may not read it).
create function pg_temp.hash_sql(p_rel regclass) returns text language sql as $$
  select format('select md5(coalesce(string_agg(t::text, %L order by t::text), %L)) from %s t', '|', '', p_rel)
$$;
create function pg_temp.hash_as(p_who text, p_rel regclass) returns text language sql as $$
  select coalesce(pg_temp.query_as(p_who, pg_temp.hash_sql(p_rel)), 'denied')
$$;

-- Every relation with client data, and which account(s) it belongs to.
create temporary table subject as
with recursive base as (
  select c.oid, case when c.oid = 'sandbox.fender_dealer_catalog'::regclass then 'A'
                     else case n.nspname when 'command' then 'A' when 'canvas_private' then 'A'
                               when 'ledlenser' then 'B' when 'ledlenser_private' then 'B'
                               else 'rows' end end as side
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('command', 'canvas_private', 'ledlenser', 'ledlenser_private', 'sandbox')
    and c.relkind in ('r', 'p', 'v', 'm')
    and c.oid <> all (array_remove(array[to_regclass('command.organizations'), to_regclass('command.user_profiles'),
      to_regclass('command.organization_memberships'), to_regclass('sandbox.seller'),
      to_regclass('sandbox.seller_type')]::oid[], null))
  union all
  select c.oid, 'rows' from pg_class c
  where c.oid in ('public.issue_set_asides'::regclass, 'public.audit_log'::regclass,
                  'public.set_aside_clients'::regclass)
  union
  select rw.ev_class, b.side from pg_depend d join pg_rewrite rw on rw.oid = d.objid
  join base b on b.oid = d.refobjid
  where d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass
    and rw.ev_class <> d.refobjid
)
select c.oid::regclass as rel, c.relkind,
       case when count(distinct b.side) = 1 then min(b.side) else 'mixed' end as side,
       (select string_agg(attname, ',') from pg_attribute
         where attrelid = c.oid and attname in ('client_id', 'client_key', 'organization_id')
           and not attisdropped) as key_col
from base b join pg_class c on c.oid = b.oid
group by c.oid;

-- The row filter that says which rows belong to org A and to org B.
create function pg_temp.rows_of(p_org text, p_key_col text) returns text language sql as $$
  select case
    when p_key_col like '%client_id%' then format('client_id = %L', case p_org when 'A' then 'cl_fender' else 'cl_ledlenser' end)
    when p_key_col like '%client_key%' then format('client_key = %L', case p_org when 'A' then 'fmic' else 'ledlenser' end)
    when p_key_col like '%organization_id%' then format('organization_id = %L',
      case p_org when 'A' then '00000000-0000-0000-0000-00000000000a' else '00000000-0000-0000-0000-00000000000b' end)
  end
$$;

do $$
declare
  s record; errors text[] := '{}'; tested int := 0; owner_n bigint; n bigint;
  a_rows text; b_rows text; who text; owner_h text; empty_h text; h text;
begin
  for s in select * from pg_temp.subject order by rel::text loop
    tested := tested + 1;
    execute format('select count(*) from %s', s.rel) into owner_n;

    -- Base tables need rows, or the test proves nothing.
    if s.relkind in ('r', 'p') and owner_n = 0 then
      errors := errors || format('%s: fixture has no rows', s.rel);
    end if;

    -- Nobody signed out, signed in without an account, or removed from the account reads anything.
    if pg_temp.count_as('anon', s.rel) <> -1 then
      errors := errors || format('%s: anon can read', s.rel);
    end if;
    -- (Per-client schema relations are checked by content below, which also covers aggregates.)
    if s.side not in ('A', 'B') then
      foreach who in array array['no_account', 'a_removed'] loop
        n := pg_temp.count_as(who, s.rel);
        if n > 0 then errors := errors || format('%s: %s sees %s rows', s.rel, who, n); end if;
      end loop;
    end if;

    -- Materialized views are read only through their reader function.
    if s.relkind = 'm' then
      if pg_temp.count_as('a_admin', s.rel) <> -1 then
        errors := errors || format('%s: materialized view readable directly', s.rel);
      end if;
      continue;
    end if;

    if s.side in ('A', 'B') then
      -- Per-client schema: the owner's members (and entitled staff) see exactly what the table
      -- owner sees; everyone else sees exactly what a signed-in user with no account sees, which
      -- must differ from the owner's view whenever there is data.
      execute pg_temp.hash_sql(s.rel) into owner_h;
      empty_h := pg_temp.hash_as('no_account', s.rel);
      if owner_n > 0 and empty_h = owner_h then
        errors := errors || format('%s: a signed-in user with no account sees the same as the owner', s.rel);
      end if;
      foreach who in array array['a_admin', 'a_member', 'staff', 'b_admin', 'a_removed'] loop
        h := pg_temp.hash_as(who, s.rel);
        if (s.side = 'A' and who in ('a_admin', 'a_member', 'staff')) or (s.side = 'B' and who = 'b_admin') then
          if h <> owner_h then errors := errors || format('%s: %s does not see all rows (%s)', s.rel, who,
            case when h = 'denied' then 'denied' else pg_temp.count_as(who, s.rel)::text || ' of ' || owner_n end); end if;
        elsif h <> empty_h then
          errors := errors || format('%s: %s sees data of another account', s.rel, who);
        end if;
      end loop;
    elsif s.side = 'rows' and s.key_col is not null then
      a_rows := pg_temp.rows_of('A', s.key_col);
      b_rows := pg_temp.rows_of('B', s.key_col);
      foreach who in array array['a_admin', 'a_member', 'staff'] loop
        if pg_temp.count_as(who, s.rel, format('not (%s)', a_rows)) <> 0 then
          errors := errors || format('%s: %s sees rows outside org A', s.rel, who);
        end if;
        execute format('select count(*) from %s where %s', s.rel, a_rows) into owner_n;
        n := pg_temp.count_as(who, s.rel, a_rows);
        if n <> owner_n then errors := errors || format('%s: %s sees %s of %s org A rows', s.rel, who, n, owner_n); end if;
      end loop;
      if pg_temp.count_as('b_admin', s.rel, format('not (%s)', b_rows)) <> 0 then
        errors := errors || format('%s: b_admin sees rows outside org B', s.rel);
      end if;
    else
      -- A view without a client column over per-row data, or over both accounts: org B and
      -- staff must not see more than org A's members do, and the two accounts never match the
      -- owner's total unless one of them owns every row.
      if pg_temp.count_as('staff', s.rel) <> pg_temp.count_as('a_admin', s.rel) then
        errors := errors || format('%s (%s): staff and org A differ', s.rel, s.side);
      end if;
      if pg_temp.count_as('a_admin', s.rel) > owner_n or pg_temp.count_as('b_admin', s.rel) > owner_n then
        errors := errors || format('%s (%s): a signed-in user sees more than exists', s.rel, s.side);
      end if;
      raise notice 'isolation: % (%) checked by totals only; no client column', s.rel, s.side;
    end if;
  end loop;

  raise notice 'isolation: % relations checked for 7 actors', tested;
  if array_length(errors, 1) > 0 then
    raise exception E'isolation failures:\n%', array_to_string(errors, E'\n');
  end if;
end $$;

-- Materialized view readers: org A members get rows, org B gets none, staff follows entitlement.
do $$
declare r record; n_a bigint; n_b bigint; n_s bigint; q text;
begin
  for r in select p.oid::regprocedure as fn, p.proname from pg_proc p
           where p.pronamespace = 'private'::regnamespace and p.proname like 'mv\_\_%' loop
    q := format('select count(*) from %s', r.fn::text);
    n_a := pg_temp.query_as('a_admin', q)::bigint;
    n_b := pg_temp.query_as('b_admin', q)::bigint;
    n_s := pg_temp.query_as('staff', q)::bigint;
    if pg_temp.query_as('anon', q) is not null then raise exception '% callable by anon', r.fn; end if;
    if r.proname like 'mv\_\_command\_\_%' then
      if n_a = 0 or n_b <> 0 or n_s <> n_a then
        raise exception '% gives A %, B %, staff %', r.fn, n_a, n_b, n_s;
      end if;
    elsif r.proname like 'mv\_\_ledlenser\_\_%' then
      if n_b = 0 or n_a <> 0 or n_s <> 0 then
        raise exception '% gives A %, B %, staff %', r.fn, n_a, n_b, n_s;
      end if;
    end if;
  end loop;
end $$;

-- Set-aside writes: a member writes for their own client only; anon cannot call at all.
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
