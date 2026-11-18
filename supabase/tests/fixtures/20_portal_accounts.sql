-- Test-only stand-in for the intofocus-portal account model. Not a migration; hosted already has
-- these, created by intofocus-portal. Only the columns the 1.6 helpers read are here.
-- VERIFY against the hosted catalog snapshot (2026-11-18): column names, status values,
-- private.is_staff() and private.module_access() signatures.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null,
  role text not null,            -- 'owner' | 'admin' | 'member' | 'platform_admin'
  status text not null default 'active',
  unique (organization_id, user_id)
);

-- Which dashboards each account is entitled to (portal entitlements, simplified).
create table public.organization_modules (
  organization_id uuid not null references public.organizations (id),
  module_key text not null,
  enabled boolean not null default true,
  primary key (organization_id, module_key)
);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_modules enable row level security;

-- Staff: an active platform_admin membership.
create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.user_id = auth.uid() and m.role = 'platform_admin' and m.status = 'active')
$$;

-- Whether an account is entitled to a dashboard.
create function private.module_access(p_organization_id uuid, p_module_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_modules om
    where om.organization_id = p_organization_id and om.module_key = p_module_key and om.enabled)
$$;

grant usage on schema private to authenticated, service_role;
revoke all on function private.is_staff(), private.module_access(uuid, text) from public;
grant execute on function private.is_staff(), private.module_access(uuid, text) to authenticated, service_role;
