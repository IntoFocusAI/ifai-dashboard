-- Login roles, part 1 of 2: which command organization owns each dashboard client.
--
-- ADDITIVE. New table command.client_organizations and four new functions. No existing table,
-- view, policy, grant or row is changed. Nothing reads these until the app (sign-in) and the
-- client data lockdown use them. May be applied by an agent after approval (AGENTS.md).
--
-- Roles live only in the command identity tables (20260330180000_command_identity.sql):
--   Staff    = active intofocus_admin membership on the platform org intofocus-ai
--              (command.is_intofocus_admin()). Staff see every client.
--   Org Lead = org_admin, Org User = org_viewer. They see only the client mapped to their org.
-- The public.* identity tables (public.organizations, platform_admin, private.has_org_role)
-- belong to the separate portal and are not used here.
--
-- What it adds:
--   1. command.client_organizations: one row per dashboard client. client_key equals the
--      dashboard client_key in data/clients/*.json and the command organization's slug.
--      Seeded here for fender and ledlenser from data/clients/*.json (only where the command
--      organization with that slug exists). RLS on, no grants to anon or authenticated: callers
--      read it only through the functions below.
--   2. command.can_read_organization(uuid): true for staff, or an active member of that
--      command organization (organization active too). The one place the rule lives.
--   3. command.can_read_client_key(text): the same rule for a dashboard client_key.
--   4. command.can_read_schema(text): the same rule for a client's data_schema
--      (fender = public, ledlenser = ledlenser, as in data/clients/*.json).
--   5. command.my_clients(): the clients the caller may open, for the app's client picker.
--      Staff get every client with role intofocus_admin; everyone else gets one row per active
--      membership in a mapped, active organization, with that membership's role.
-- All functions: SECURITY DEFINER, search_path = '', anon and PUBLIC cannot execute them.
-- The helpers are executable by authenticated (row policies call them as the signed-in user)
-- and service_role; my_clients() by authenticated only. They answer only for auth.uid(), never
-- for an id passed in a request, so calling them over the API reveals nothing about other users.
--
-- Check after applying:
--   select client_key, organization_id, data_schema, set_aside_key from command.client_organizations;
--     -- fender | <fender org id> | public | fmic ; ledlenser | <ledlenser org id> | ledlenser | ledlenser
--   select has_function_privilege('anon', 'command.my_clients()', 'execute');  -- false
--   As a signed-in staff user, from the app: supabase.schema('command').rpc('my_clients')
--     -- returns fender and ledlenser with role intofocus_admin.
--
-- Undo (nothing else depends on these unless the client data lockdown has been applied; undo that first):
--   drop function if exists command.my_clients(), command.can_read_schema(text),
--     command.can_read_client_key(text), command.can_read_organization(uuid);
--   drop table if exists command.client_organizations;

begin;

create table command.client_organizations (
  client_key text primary key,
  organization_id uuid not null references command.organizations (id),
  data_schema text not null unique,
  set_aside_key text unique,
  created_at timestamptz not null default now()
);
comment on table command.client_organizations is
  'Dashboard client (data/clients/<client_key>.json) -> owning command organization. client_key equals the organization slug. Read through command.my_clients() and the can_read_* helpers.';
comment on column command.client_organizations.data_schema is
  'The client''s data_schema in data/clients/*.json (fender = public; its tables live in command).';
comment on column command.client_organizations.set_aside_key is
  'The client''s set_aside_key in data/clients/*.json (public.set_aside_clients.client_key).';

alter table command.client_organizations enable row level security;
revoke all on table command.client_organizations from public, anon, authenticated;
grant select, insert, update, delete on table command.client_organizations to service_role;

-- Seed from data/clients/*.json. Skips a client whose command organization does not exist.
insert into command.client_organizations (client_key, organization_id, data_schema, set_aside_key)
select v.client_key, o.id, v.data_schema, v.set_aside_key
from (values
  ('fender', 'public', 'fmic'),
  ('ledlenser', 'ledlenser', 'ledlenser')
) v(client_key, data_schema, set_aside_key)
join command.organizations o on o.slug = v.client_key
on conflict (client_key) do nothing;

create function command.can_read_organization(p_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and p_organization_id is not null
     and (
       command.is_intofocus_admin()
       or exists (
         select 1
         from command.organization_memberships m
         join command.organizations o on o.id = m.organization_id
         where m.organization_id = p_organization_id
           and m.user_id = auth.uid()
           and m.status = 'active'
           and o.is_active)
     )
$$;
comment on function command.can_read_organization(uuid) is
  'True when the signed-in caller is IntoFocus staff or an active member of this active command organization.';

create function command.can_read_client_key(p_client_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select command.can_read_organization(c.organization_id)
    from command.client_organizations c
    where c.client_key = p_client_key), false)
$$;
comment on function command.can_read_client_key(text) is
  'True when the signed-in caller may read this dashboard client (staff, or an active member of its organization).';

create function command.can_read_schema(p_schema_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select command.can_read_organization(c.organization_id)
    from command.client_organizations c
    where c.data_schema = p_schema_name), false)
$$;
comment on function command.can_read_schema(text) is
  'True when the signed-in caller may read the client whose data_schema this is (staff, or an active member of its organization).';

create function command.my_clients()
returns table (client_key text, organization_id uuid, organization_name text, role text)
language sql stable security definer set search_path = '' as $$
  select c.client_key, o.id, o.name, 'intofocus_admin'::text
  from command.client_organizations c
  join command.organizations o on o.id = c.organization_id
  where auth.uid() is not null and command.is_intofocus_admin()
  union all
  select c.client_key, o.id, o.name, m.role::text
  from command.client_organizations c
  join command.organizations o on o.id = c.organization_id
  join command.organization_memberships m on m.organization_id = o.id
  where auth.uid() is not null
    and not command.is_intofocus_admin()
    and m.user_id = auth.uid()
    and m.status = 'active'
    and o.is_active
  order by 1
$$;
comment on function command.my_clients() is
  'Clients the signed-in caller may open: every client for staff (role intofocus_admin), else one row per active membership (role org_admin or org_viewer).';

revoke all on function command.can_read_organization(uuid), command.can_read_client_key(text),
  command.can_read_schema(text), command.my_clients() from public, anon;
grant execute on function command.can_read_organization(uuid), command.can_read_client_key(text),
  command.can_read_schema(text) to authenticated, service_role;
grant execute on function command.my_clients() to authenticated;

notify pgrst, 'reload schema';

commit;
