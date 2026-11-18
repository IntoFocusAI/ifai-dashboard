-- Isolation tests for supabase/migrations/20261118210000_dashboard_portal_access.sql (issue 248).
-- Local stack only. Run with scripts/portal-local-stack.sh test, which loads the fixtures in
-- supabase/tests/fixtures/portal-dashboard/ first. Every check raises on failure; the run is
-- rolled back, so the open log written by the staff test does not stay.

begin;

create or replace function pg_temp.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;

create or replace function pg_temp.expect(p_ok boolean, p_what text) returns void
language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAILED: %', p_what;
  end if;
  raise notice 'ok: %', p_what;
end $$;

grant execute on function pg_temp.act_as(uuid), pg_temp.expect(boolean, text) to anon, authenticated;

-- Account A user ------------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-4000-8000-00000000000a');
select pg_temp.expect(
  (select array_agg(slug order by slug) from public.my_dashboard_accounts()) = array['account-a'],
  'A user has exactly account A');
select pg_temp.expect(
  (select count(*) from public.my_dashboard_accounts('bbbbbbbb-0000-4000-8000-000000000002')) = 1
  and not exists (select 1 from public.my_dashboard_accounts('bbbbbbbb-0000-4000-8000-000000000002') where slug = 'account-b'),
  'A user passing account B as the selector does not get account B');
select pg_temp.expect(
  (select array_agg(client_ref order by client_ref) from public.my_dashboard_clients('aaaaaaaa-0000-4000-8000-000000000001'))
    = array['command', 'fixture-sandbox-a'],
  'A user reads the A brands (command schema and sandbox A)');
select pg_temp.expect(
  not exists (select 1 from public.my_dashboard_clients('bbbbbbbb-0000-4000-8000-000000000002')),
  'A user passing account B gets no B brands');
select pg_temp.expect(public.dashboard_viewer_is_staff() = false, 'A user is not staff');
select pg_temp.expect(
  (public.open_module('aaaaaaaa-0000-4000-8000-000000000001', 'consensus_control', null) ->> 'access') = 'open',
  'A user opens the dashboard for A');
select pg_temp.expect(
  (public.open_module('bbbbbbbb-0000-4000-8000-000000000002', 'consensus_control', null) ->> 'access') <> 'open',
  'A user cannot open the dashboard for B');
select pg_temp.expect((select count(*) from command.fixture_brand_rows) = 1, 'A user reads A rows');
select pg_temp.expect((select count(*) from ledlenser.fixture_brand_rows) = 0, 'A user reads no B rows');
reset role;

-- Account B user ------------------------------------------------------------------------
select pg_temp.act_as('b0000000-0000-4000-8000-00000000000b');
select pg_temp.expect(
  (select array_agg(slug order by slug) from public.my_dashboard_accounts()) = array['account-b'],
  'B user has exactly account B');
select pg_temp.expect(
  (select array_agg(client_ref order by client_ref) from public.my_dashboard_clients('bbbbbbbb-0000-4000-8000-000000000002'))
    = array['fixture-sandbox-b', 'ledlenser'],
  'B user reads the B brands');
select pg_temp.expect(
  not exists (select 1 from public.my_dashboard_clients('aaaaaaaa-0000-4000-8000-000000000001')),
  'B user passing account A gets no A brands');
select pg_temp.expect((select count(*) from command.fixture_brand_rows) = 0, 'B user reads no A rows');
reset role;

-- Active in A, suspended in B -----------------------------------------------------------
select pg_temp.act_as('e0000000-0000-4000-8000-00000000000e');
select pg_temp.expect(
  (select array_agg(slug order by slug) from public.my_dashboard_accounts()) = array['account-a'],
  'A suspended membership does not count');
select pg_temp.expect(
  not exists (select 1 from public.my_dashboard_clients('bbbbbbbb-0000-4000-8000-000000000002')),
  'Suspended in B reads no B brands');
reset role;

-- Member of an account without the dashboard --------------------------------------------
select pg_temp.act_as('c0000000-0000-4000-8000-00000000000c');
select pg_temp.expect(
  (public.open_module('cccccccc-0000-4000-8000-000000000003', 'consensus_control', null) ->> 'access') = 'not_entitled',
  'Member of an account without the dashboard gets not_entitled');
select pg_temp.expect(
  not exists (select 1 from public.my_dashboard_clients('cccccccc-0000-4000-8000-000000000003')),
  'Member of an account without the dashboard reads no brands');
reset role;

-- Staff ----------------------------------------------------------------------------------
select pg_temp.act_as('d0000000-0000-4000-8000-00000000000d');
select pg_temp.expect(public.dashboard_viewer_is_staff() = true, 'Staff user is staff');
select pg_temp.expect(
  exists (select 1 from public.my_dashboard_accounts('aaaaaaaa-0000-4000-8000-000000000001') where slug = 'account-a' and role = 'staff'),
  'Staff gets the selected account with role staff');
select pg_temp.expect(
  (public.open_module('aaaaaaaa-0000-4000-8000-000000000001', 'consensus_control', null) ->> 'access') = 'staff_reason_required',
  'Staff without a reason is asked for one');
select pg_temp.expect(
  (public.open_module('aaaaaaaa-0000-4000-8000-000000000001', 'consensus_control', 'Checking the weekly scores') ->> 'access') = 'open_staff',
  'Staff with a reason opens');
select pg_temp.expect(
  (select array_agg(client_ref order by client_ref) from public.my_dashboard_clients('aaaaaaaa-0000-4000-8000-000000000001'))
    = array['command', 'fixture-sandbox-a'],
  'Staff reads the brands of an entitled account');
select pg_temp.expect(
  not exists (select 1 from public.my_dashboard_clients('cccccccc-0000-4000-8000-000000000003')),
  'Staff reads no brands for an account without the dashboard');
reset role;
select pg_temp.expect(
  (select count(*) from private.module_open_log where reason = 'Checking the weekly scores') = 1,
  'The staff open is logged with its reason');

-- Anon -----------------------------------------------------------------------------------
select pg_temp.act_as(null);
do $$
begin
  begin
    perform public.my_dashboard_accounts();
    raise exception 'FAILED: anon executed my_dashboard_accounts';
  exception when insufficient_privilege then raise notice 'ok: anon cannot list accounts';
  end;
  begin
    perform public.my_dashboard_clients('aaaaaaaa-0000-4000-8000-000000000001');
    raise exception 'FAILED: anon executed my_dashboard_clients';
  exception when insufficient_privilege then raise notice 'ok: anon cannot list brands';
  end;
  begin
    perform public.dashboard_viewer_is_staff();
    raise exception 'FAILED: anon executed dashboard_viewer_is_staff';
  exception when insufficient_privilege then raise notice 'ok: anon cannot check staff';
  end;
  begin
    perform count(*) from command.fixture_brand_rows;
    raise exception 'FAILED: anon read command rows';
  exception when insufficient_privilege then raise notice 'ok: anon cannot read client rows';
  end;
end $$;
reset role;

-- Catalog guard: the three functions are security definer with an empty search_path and
-- are not executable by anon or public.
select pg_temp.expect(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('my_dashboard_accounts', 'my_dashboard_clients', 'dashboard_viewer_is_staff')),
  'Dashboard functions are security definer with an empty search_path');
select pg_temp.expect(
  not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('my_dashboard_accounts', 'my_dashboard_clients', 'dashboard_viewer_is_staff')
      and (has_function_privilege('anon', p.oid, 'execute'))),
  'anon cannot execute any dashboard function');

rollback;
