-- 1.6 Step 1: who may read which client's data. Mapping table and helper functions.
--
-- Additive: new table private.client_schema_org, new functions private.is_backend_caller,
-- private.client_org_readable, private.can_read_schema, private.can_read_client,
-- private.readable_client_ids and private.can_read_set_aside_client, and a NOT VALID foreign key
-- on sandbox.client.organization_id. Nothing existing is read differently until
-- 20261118200100 (Step 0b) uses these helpers. Brian Watson applies both together.
--
-- Rule (approved 2026-11-17): access always comes from the signed-in user's account membership
-- (public.organization_memberships), never from an id passed in a request. Every helper that takes
-- a schema, client or account id checks the caller against that membership.
--
-- A caller may read an account's data when, and only when:
--   * they have an active membership in that account, or
--   * they are IntoFocus staff (private.is_staff()) and the account is entitled to the AEO
--     dashboard (private.module_access(account, 'aeo_dashboard')).
-- Anonymous callers (no auth.uid()) never may.
--
-- At apply time Brian Watson inserts one row per client schema (account ids are not in the repo):
--   insert into private.client_schema_org (schema_name, organization_id, note) values
--     ('command',   '<FMIC account id in public.organizations>',      'Fender (FMIC)'),
--     ('ledlenser', '<Ledlenser account id in public.organizations>', 'Ledlenser');
-- Until those rows exist, nobody but service_role reads command or ledlenser data after Step 0b.
-- Set-asides use public.set_aside_clients.organization_id (already a public.organizations key).
-- Watson checks it is set for every client_key, or nobody can read or write that client's set-asides:
--   select client_key, organization_id from public.set_aside_clients;
--
-- sandbox.client.organization_id: its column comment says it held command.organizations ids. The
-- new foreign key to public.organizations is NOT VALID so existing rows are not checked. Before
-- validating, set each row to the public.organizations id, then:
--   alter table sandbox.client validate constraint client_organization_id_fkey;
--
-- Check after applying:
--   select private.can_read_schema('command');    -- as a signed-in FMIC member: true; others: false
--
-- Undo (nothing depends on these until 20261118200100 is applied; undo that first):
--   alter table sandbox.client drop constraint if exists client_organization_id_fkey;
--   drop function if exists private.can_read_set_aside_client(text), private.readable_client_ids(),
--     private.can_read_client(text), private.can_read_schema(text), private.client_org_readable(uuid),
--     private.is_backend_caller();
--   drop table if exists private.client_schema_org;

begin;

create table private.client_schema_org (
  schema_name text primary key,
  organization_id uuid not null references public.organizations (id),
  note text,
  created_at timestamptz not null default now()
);
comment on table private.client_schema_org is
  '1.6: the account that owns each per-client schema (command = FMIC, ledlenser = Ledlenser). Rows are inserted by Brian Watson.';
alter table private.client_schema_org enable row level security;
revoke all on table private.client_schema_org from public, anon, authenticated;

-- Backend callers that already bypass row security (service_role over the API, or a direct
-- database connection such as the pipelines) also bypass the membership check in the
-- materialized view readers. API requests arrive with session_user = authenticator.
create function private.is_backend_caller() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.role(), '') = 'service_role'
      or session_user::text not in ('authenticator', 'anon', 'authenticated')
$$;
comment on function private.is_backend_caller() is
  '1.6: true for service_role and direct database sessions (not PostgREST requests).';

-- The one place the membership and staff rule lives.
create function private.client_org_readable(p_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and p_organization_id is not null
     and (
       exists (
         select 1 from public.organization_memberships m
         where m.organization_id = p_organization_id
           and m.user_id = auth.uid()
           and m.status = 'active')
       or (private.is_staff() and private.module_access(p_organization_id, 'aeo_dashboard'))
     )
$$;
comment on function private.client_org_readable(uuid) is
  '1.6: true when the signed-in caller is an active member of the account, or staff and the account is entitled to the AEO dashboard.';

create function private.can_read_schema(p_schema_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.client_org_readable(c.organization_id)
    from private.client_schema_org c
    where c.schema_name = p_schema_name), false)
$$;
comment on function private.can_read_schema(text) is
  '1.6: true when the caller may read the per-client schema (via private.client_schema_org).';

create function private.can_read_client(p_client_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.client_org_readable(c.organization_id)
    from sandbox.client c
    where c.client_id = p_client_id), false)
$$;
comment on function private.can_read_client(text) is
  '1.6: true when the caller may read the sandbox client (via sandbox.client.organization_id).';

-- Set form of can_read_client, for row policies on large tables (evaluated once per query).
create function private.readable_client_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select c.client_id from sandbox.client c
  where private.client_org_readable(c.organization_id)
$$;
comment on function private.readable_client_ids() is
  '1.6: the sandbox client ids the caller may read.';

create function private.can_read_set_aside_client(p_client_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.client_org_readable(c.organization_id)
    from public.set_aside_clients c
    where c.client_key = p_client_key), false)
$$;
comment on function private.can_read_set_aside_client(text) is
  '1.6: true when the caller may read and write set-asides for this client_key (via public.set_aside_clients.organization_id).';

revoke all on function private.client_org_readable(uuid), private.can_read_schema(text),
  private.can_read_client(text), private.readable_client_ids(),
  private.can_read_set_aside_client(text), private.is_backend_caller() from public, anon;
grant execute on function private.client_org_readable(uuid), private.can_read_schema(text),
  private.can_read_client(text), private.readable_client_ids(),
  private.can_read_set_aside_client(text), private.is_backend_caller() to authenticated, service_role;
-- Row policies call these as the signed-in user, so authenticated needs to reach the schema.
grant usage on schema private to authenticated;

alter table sandbox.client
  add constraint client_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) not valid;
comment on column sandbox.client.organization_id is
  'The client''s account in public.organizations. 1.6 row policies read it. Foreign key added NOT VALID; validate after existing rows are set to public.organizations ids.';

commit;
