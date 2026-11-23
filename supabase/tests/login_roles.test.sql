-- Login roles (20261123120000, 20261123120100): client mapping, read helpers, my_clients(),
-- Org Lead membership limits, staff row clean-up, guarded Brian Magazu insert.
-- Users and orgs come from fixtures/40_command_accounts.sql. Writes run in a transaction that is
-- rolled back, so later test files see the fixture rows unchanged.
\set ON_ERROR_STOP 1

-- Seed, grants, clean-up ----------------------------------------------------------------------
do $$
begin
  if (select count(*) from command.client_organizations) <> 2 then
    raise exception 'expected 2 client_organizations rows';
  end if;
  if not exists (select 1 from command.client_organizations c join command.organizations o on o.id = c.organization_id
                 where c.client_key = 'fender' and o.slug = 'fender' and c.data_schema = 'public' and c.set_aside_key = 'fmic') then
    raise exception 'fender mapping wrong';
  end if;
  if not exists (select 1 from command.client_organizations c join command.organizations o on o.id = c.organization_id
                 where c.client_key = 'ledlenser' and o.slug = 'ledlenser' and c.data_schema = 'ledlenser' and c.set_aside_key = 'ledlenser') then
    raise exception 'ledlenser mapping wrong';
  end if;
  -- client_key equals the org slug for every row.
  if exists (select 1 from command.client_organizations c join command.organizations o on o.id = c.organization_id
             where o.slug <> c.client_key) then
    raise exception 'client_key differs from organization slug';
  end if;
  if has_table_privilege('anon', 'command.client_organizations', 'select')
     or has_table_privilege('authenticated', 'command.client_organizations', 'select') then
    raise exception 'client_organizations is readable by anon or authenticated';
  end if;
  if has_function_privilege('anon', 'command.my_clients()', 'execute')
     or not has_function_privilege('authenticated', 'command.my_clients()', 'execute') then
    raise exception 'my_clients grants wrong';
  end if;
  if has_function_privilege('anon', 'command.can_read_client_key(text)', 'execute')
     or has_function_privilege('anon', 'command.can_read_schema(text)', 'execute')
     or has_function_privilege('anon', 'command.can_read_organization(uuid)', 'execute') then
    raise exception 'anon can execute a read helper';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'command'::regnamespace
               and p.proname in ('my_clients', 'can_read_client_key', 'can_read_schema', 'can_read_organization')
               and (not p.prosecdef or p.proconfig is distinct from array['search_path=""'])) then
    raise exception 'helper is not SECURITY DEFINER with search_path empty';
  end if;
  -- Staff org_admin rows on client orgs are gone; their staff rows stay.
  if exists (select 1 from command.organization_memberships m join auth.users u on u.id = m.user_id
             join command.organizations o on o.id = m.organization_id
             where u.email in ('brian.w@intofocus.ai', 'marc.s@intofocus.ai') and o.slug <> 'intofocus-ai') then
    raise exception 'staff still hold client org rows';
  end if;
  if (select count(*) from command.organization_memberships m join auth.users u on u.id = m.user_id
      where u.email in ('brian.w@intofocus.ai', 'marc.s@intofocus.ai') and m.role = 'intofocus_admin') <> 2 then
    raise exception 'staff rows changed';
  end if;
  -- Other org_admin rows untouched.
  if (select count(*) from command.organization_memberships
      where role = 'org_admin' and user_id::text like '00000000-0000-0000-0000-000000000c%') <> 3 then
    raise exception 'expected 3 Lead rows (2 fender, 1 ledlenser)';
  end if;
  -- Brian Magazu has no auth user here, so no row and no error.
  if exists (select 1 from auth.users where email = 'brian.m@intofocus.ai') then
    raise exception 'fixture should not have brian.m';
  end if;
end $$;

-- Read helpers and my_clients() per actor --------------------------------------------------------
create function pg_temp.expect_clients(p_user uuid, p_expected text) returns void language plpgsql as $$
declare got text;
begin
  perform public.test_act_as('authenticated', p_user);
  select coalesce(string_agg(client_key || ':' || role, ',' order by client_key), '') into got from command.my_clients();
  if got <> p_expected then
    reset role; reset session authorization;
    raise exception 'my_clients for %: expected "%", got "%"', p_user, p_expected, got;
  end if;
  if command.can_read_client_key('fender') <> (p_expected like '%fender%')
     or command.can_read_client_key('ledlenser') <> (p_expected like '%ledlenser%')
     or command.can_read_schema('public') <> (p_expected like '%fender%')
     or command.can_read_schema('ledlenser') <> (p_expected like '%ledlenser%')
     or command.can_read_client_key('nope') then
    reset role; reset session authorization;
    raise exception 'read helpers disagree with my_clients for %', p_user;
  end if;
  reset role; reset session authorization;
end $$;

select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c01', 'fender:intofocus_admin,ledlenser:intofocus_admin');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c02', 'fender:intofocus_admin,ledlenser:intofocus_admin');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c11', 'fender:org_admin');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c12', 'fender:org_viewer');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c14', '');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c21', 'ledlenser:org_admin');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c22', 'ledlenser:org_viewer');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c99', '');

-- anon cannot call my_clients().
select public.test_act_as('anon');
do $$ begin
  begin
    perform * from command.my_clients();
    raise exception 'anon called my_clients';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset session authorization;

-- An inactive organization gives its members nothing (staff still see it).
begin;
update command.organizations set is_active = false where slug = 'ledlenser';
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c22', '');
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c01', 'fender:intofocus_admin,ledlenser:intofocus_admin');
rollback;

-- Org Lead membership limits ------------------------------------------------------------------
-- Each statement runs as the Fender Lead (c11). ok = must change exactly 1 row; no = must change
-- 0 rows or be refused by row security.
create function pg_temp.lead_try(p_user uuid, p_sql text, p_ok boolean) returns void language plpgsql as $$
declare n int := 0; refused boolean := false; err text;
begin
  perform public.test_act_as('authenticated', p_user);
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception
    -- Row security (42501), or the platform-org trigger, which runs as the caller and cannot
    -- see organizations outside their own.
    when insufficient_privilege or raise_exception then refused := true; err := sqlerrm;
  end;
  reset role; reset session authorization;
  if p_ok and (refused or n <> 1) then
    raise exception 'expected allowed (1 row): % [refused %: %, rows %]', p_sql, refused, err, n;
  end if;
  if not p_ok and not refused and n <> 0 then
    raise exception 'expected blocked: % [rows %]', p_sql, n;
  end if;
end $$;

begin;
-- Fender Lead c11; Fender org f1, Ledlenser org b1, platform a1.
-- Allowed: add, edit, suspend and remove Org Users in their own org.
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$insert into command.organization_memberships (organization_id, user_id, role, status)
     values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c98', 'org_viewer', 'active')$q$, true);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set status = 'suspended'
     where user_id = '00000000-0000-0000-0000-000000000c12' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, true);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set status = 'active'
     where user_id = '00000000-0000-0000-0000-000000000c14' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, true);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$delete from command.organization_memberships
     where user_id = '00000000-0000-0000-0000-000000000c98' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, true);

-- Blocked: create a Lead, promote a User, demote or remove a Lead (another or themselves).
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$insert into command.organization_memberships (organization_id, user_id, role, status)
     values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c98', 'org_admin', 'active')$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set role = 'org_admin'
     where user_id = '00000000-0000-0000-0000-000000000c12' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set role = 'org_viewer'
     where user_id = '00000000-0000-0000-0000-000000000c13' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set status = 'suspended'
     where user_id = '00000000-0000-0000-0000-000000000c13' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$delete from command.organization_memberships
     where user_id = '00000000-0000-0000-0000-000000000c13' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set role = 'org_viewer'
     where user_id = '00000000-0000-0000-0000-000000000c11' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$delete from command.organization_memberships
     where user_id = '00000000-0000-0000-0000-000000000c11' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, false);
-- Blocked: other orgs (Ledlenser, platform), staff rows, moving a User to another org.
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$insert into command.organization_memberships (organization_id, user_id, role, status)
     values ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-000000000c98', 'org_viewer', 'active')$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$insert into command.organization_memberships (organization_id, user_id, role, status)
     values ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-000000000c98', 'intofocus_admin', 'active')$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$delete from command.organization_memberships
     where user_id = '00000000-0000-0000-0000-000000000c22'$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set status = 'removed'
     where role = 'intofocus_admin'$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c11',
  $q$update command.organization_memberships set organization_id = '00000000-0000-0000-0000-00000000c0b1'
     where user_id = '00000000-0000-0000-0000-000000000c12'$q$, false);
-- Org Users manage nothing.
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c12',
  $q$insert into command.organization_memberships (organization_id, user_id, role, status)
     values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c98', 'org_viewer', 'active')$q$, false);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c12',
  $q$update command.organization_memberships set status = 'removed'
     where user_id = '00000000-0000-0000-0000-000000000c14'$q$, false);
-- Staff manage Leads.
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c01',
  $q$update command.organization_memberships set role = 'org_viewer'
     where user_id = '00000000-0000-0000-0000-000000000c13' and organization_id = '00000000-0000-0000-0000-00000000c0f1'$q$, true);
select pg_temp.lead_try('00000000-0000-0000-0000-000000000c01',
  $q$insert into command.organization_memberships (organization_id, user_id, role, status)
     values ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-000000000c98', 'org_admin', 'active')$q$, true);
-- intofocus_admin stays platform-only, even for staff (trigger).
do $$ begin
  begin
    perform public.test_act_as('authenticated', '00000000-0000-0000-0000-000000000c01');
    insert into command.organization_memberships (organization_id, user_id, role, status)
      values ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c99', 'intofocus_admin', 'active');
    raise exception 'intofocus_admin allowed on a client org';
  exception when raise_exception then
    if sqlerrm not like '%platform organization%' then raise; end if;
  end;
  reset role; reset session authorization;
end $$;
rollback;
reset role;
reset session authorization;

-- Guarded Brian Magazu insert: adds him once his auth user exists (same statement as the migration).
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000c03', 'brian.m@intofocus.ai');
insert into command.organization_memberships (organization_id, user_id, role, status)
select o.id, u.id, 'intofocus_admin'::command.organization_role, 'active'::command.membership_status
from command.organizations o
cross join auth.users u
where o.slug = 'intofocus-ai'
  and o.is_platform_org
  and lower(u.email) = 'brian.m@intofocus.ai'
on conflict (organization_id, user_id) do update
set role = excluded.role,
    status = excluded.status;
select pg_temp.expect_clients('00000000-0000-0000-0000-000000000c03', 'fender:intofocus_admin,ledlenser:intofocus_admin');
rollback;
