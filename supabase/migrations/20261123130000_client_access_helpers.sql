-- 1.6 Step 1: who may read which client's data. Helpers for sandbox clients and set-aside keys.
--
-- ADDITIVE: new functions private.is_backend_caller, private.can_read_client,
-- private.readable_client_ids and private.can_read_set_aside_client, and a NOT VALID foreign key
-- on sandbox.client.organization_id. Nothing existing is read differently until
-- 20261123130100 (Step 0b) uses these helpers. Brian Watson applies both together.
-- Needs 20261123120000_client_organizations.sql (command.client_organizations and
-- command.can_read_organization / can_read_client_key).
--
-- Rule (Brian Watson, 2026-11-23): roles live only in the command sign-in tables. A caller may
-- read a client's data when, and only when:
--   * they are IntoFocus staff (command.is_intofocus_admin(): active intofocus_admin on the
--     platform org), who see every client, or
--   * they are an active member (org_admin or org_viewer) of the command organization mapped to
--     that client in command.client_organizations.
-- Anonymous callers (no auth.uid()) never may. Access never comes from an id passed in a request.
-- The one place the rule lives is command.can_read_organization(uuid) (20261123120000). The
-- per-client schemas use command.can_read_client_key('fender' | 'ledlenser') directly.
-- The portal's public.* identity tables (public.organizations, platform_admin,
-- private.has_org_role) are not used.
--
-- How each kind of client data maps to its organization:
--   command, canvas_private      -> client_key fender    (command.client_organizations)
--   ledlenser, ledlenser_private -> client_key ledlenser
--   sandbox rows                 -> sandbox.client.organization_id (a command.organizations id;
--                                   cl_fender is already set to the Fender org on production)
--   public set-aside tables      -> client_key there is the set_aside_key (fmic, ledlenser),
--                                   mapped by command.client_organizations.set_aside_key
--
-- sandbox.client.organization_id gets a foreign key to command.organizations, NOT VALID so
-- existing rows are not checked. On production cl_fender already holds the Fender command org
-- id, so Watson can validate it right away:
--   alter table sandbox.client validate constraint client_organization_id_fkey;
--
-- Check after applying (as a signed-in Fender member or staff: true; others: false):
--   select private.can_read_client('cl_fender'), private.can_read_set_aside_client('fmic');
--
-- Undo (nothing depends on these until 20261123130100 is applied; undo that first):
--   alter table sandbox.client drop constraint if exists client_organization_id_fkey;
--   drop function if exists private.can_read_set_aside_client(text), private.readable_client_ids(),
--     private.can_read_client(text), private.is_backend_caller();

begin;

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

create function private.can_read_client(p_client_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select command.can_read_organization(c.organization_id)
    from sandbox.client c
    where c.client_id = p_client_id), false)
$$;
comment on function private.can_read_client(text) is
  '1.6: true when the caller may read the sandbox client (staff, or a member of the command organization in sandbox.client.organization_id).';

-- Set form of can_read_client, for row policies on large tables (evaluated once per query).
create function private.readable_client_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select c.client_id from sandbox.client c
  where command.can_read_organization(c.organization_id)
$$;
comment on function private.readable_client_ids() is
  '1.6: the sandbox client ids the caller may read.';

create function private.can_read_set_aside_client(p_client_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select command.can_read_organization(c.organization_id)
    from command.client_organizations c
    where c.set_aside_key = p_client_key), false)
$$;
comment on function private.can_read_set_aside_client(text) is
  '1.6: true when the caller may read and write rows for this set-aside client_key (fmic, ledlenser), via command.client_organizations.set_aside_key.';

revoke all on function private.can_read_client(text), private.readable_client_ids(),
  private.can_read_set_aside_client(text), private.is_backend_caller() from public, anon;
grant execute on function private.can_read_client(text), private.readable_client_ids(),
  private.can_read_set_aside_client(text), private.is_backend_caller() to authenticated, service_role;
-- Row policies call these as the signed-in user, so authenticated needs to reach the schema.
grant usage on schema private to authenticated;

alter table sandbox.client
  add constraint client_organization_id_fkey
  foreign key (organization_id) references command.organizations (id) not valid;
comment on column sandbox.client.organization_id is
  'The client''s organization in command.organizations. 1.6 row policies read it. Foreign key added NOT VALID; validate once every row holds a command.organizations id.';

commit;
