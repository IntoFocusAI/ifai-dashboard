-- TEST FIXTURE ONLY. Never apply to a hosted project.
-- Stand-in for the 1.6 client data isolation contract (issue 247, branch
-- security/client-data-isolation), so this branch can be tested before that one lands.
-- When 247 merges, its migrations replace this file. Names and signatures follow the 247 brief:
--   private.client_schema_org (schema_name text primary key, organization_id uuid)
--   private.can_read_schema(schema_name text) returns boolean
--   private.can_read_client(client_id text) returns boolean   (sandbox.client.client_id is text)
-- Both helpers: true for an active member of the mapped account, or for staff when that
-- account is entitled to the dashboard. Never from an id passed in a request.

create schema if not exists command;
create schema if not exists ledlenser;
create schema if not exists sandbox;
grant usage on schema command, ledlenser, sandbox to authenticated;

create table if not exists private.client_schema_org (
  schema_name text primary key,
  organization_id uuid not null references public.organizations (id)
);

create table if not exists sandbox.client (
  client_id text primary key,
  name text not null,
  slug text not null,
  seller_type text not null default 'brand_led',
  organization_id uuid references public.organizations (id),
  is_active boolean not null default true
);
alter table sandbox.client enable row level security;

create or replace function private.can_read_org(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_org is not null and (
    private.is_member(p_org)
    or (private.is_staff() and exists (
      select 1 from private.module_entitlements e
      where e.organization_id = p_org and e.product = 'consensus_control'))
  )
$$;

create or replace function private.can_read_schema(schema_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_read_org(
    (select c.organization_id from private.client_schema_org c where c.schema_name = can_read_schema.schema_name))
$$;

create or replace function private.can_read_client(client_id text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.can_read_org(
    (select c.organization_id from sandbox.client c where c.client_id = can_read_client.client_id))
$$;

revoke all on function private.can_read_org(uuid), private.can_read_schema(text), private.can_read_client(text) from public, anon;
grant execute on function private.can_read_org(uuid), private.can_read_schema(text), private.can_read_client(text) to authenticated;

drop policy if exists client_read on sandbox.client;
create policy client_read on sandbox.client for select to authenticated using (private.can_read_client(client_id));
revoke all on sandbox.client from anon;
grant select on sandbox.client to authenticated;

-- One made-up relation per client schema, read through RLS, for the isolation tests.
create table if not exists command.fixture_brand_rows (id int primary key, label text not null);
create table if not exists ledlenser.fixture_brand_rows (id int primary key, label text not null);
alter table command.fixture_brand_rows enable row level security;
alter table ledlenser.fixture_brand_rows enable row level security;
drop policy if exists fixture_read on command.fixture_brand_rows;
create policy fixture_read on command.fixture_brand_rows for select to authenticated using (private.can_read_schema('command'));
drop policy if exists fixture_read on ledlenser.fixture_brand_rows;
create policy fixture_read on ledlenser.fixture_brand_rows for select to authenticated using (private.can_read_schema('ledlenser'));
revoke all on command.fixture_brand_rows, ledlenser.fixture_brand_rows from anon;
grant select on command.fixture_brand_rows, ledlenser.fixture_brand_rows to authenticated;
