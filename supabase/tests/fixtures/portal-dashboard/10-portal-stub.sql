-- TEST FIXTURE ONLY. Never apply to a hosted project.
-- A minimal copy of the intofocus-portal account and entitlement objects the dashboard calls.
-- Differences from hosted (the portal's own migrations are the source of truth):
--   * Only the columns the dashboard reads. Column names follow the 1.6 design brief:
--     organizations(id, name, slug), organization_memberships(organization_id, user_id, role, status).
--   * Staff are members of the IntoFocus platform account with role 'platform_admin'.
--   * Entitlements are one table, private.module_entitlements(organization_id, product).
--   * public.open_module returns jsonb {"access": <state>, "organization_id", "product"}.
--     The states are the ones lib/portal/contract.ts lists. Every staff open is logged in
--     private.module_open_log with its reason.
-- If the portal's names differ, change lib/portal/contract.ts and this file together.

create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_platform boolean not null default false
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'platform_admin')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'removed')),
  unique (organization_id, user_id)
);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
revoke all on public.organizations, public.organization_memberships from anon;
grant select on public.organizations, public.organization_memberships to authenticated;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid() and m.status = 'active'
      and m.role = 'platform_admin' and o.is_platform
  )
$$;

create or replace function private.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select to authenticated using (private.is_member(id) or private.is_staff());
drop policy if exists memberships_self_read on public.organization_memberships;
create policy memberships_self_read on public.organization_memberships
  for select to authenticated using (user_id = auth.uid() or private.is_staff());

create table if not exists private.module_entitlements (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product text not null,
  primary key (organization_id, product)
);

create table if not exists private.module_open_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  product text not null,
  user_id uuid not null,
  reason text,
  opened_at timestamptz not null default now()
);

create or replace function private.module_access(p_org uuid, p_product text) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when auth.uid() is null then 'signed_out'
    when not exists (select 1 from public.organizations o where o.id = p_org) then 'no_account'
    when not (private.is_member(p_org) or private.is_staff()) then 'no_account'
    when not exists (
      select 1 from private.module_entitlements e
      where e.organization_id = p_org and e.product = p_product
    ) then 'not_entitled'
    when private.is_member(p_org) then 'open'
    else 'staff_reason_required'
  end
$$;

create or replace function public.my_modules(p_org uuid)
returns table (product text, access text)
language sql stable security definer set search_path = ''
as $$
  select e.product, private.module_access(p_org, e.product)
  from private.module_entitlements e
  where e.organization_id = p_org and (private.is_member(p_org) or private.is_staff())
$$;

create or replace function public.open_module(p_org uuid, p_product text, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_access text := private.module_access(p_org, p_product);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_access = 'staff_reason_required' and v_reason is not null and length(v_reason) >= 10 then
    insert into private.module_open_log (organization_id, product, user_id, reason)
    values (p_org, p_product, auth.uid(), v_reason);
    v_access := 'open_staff';
  end if;
  return jsonb_build_object('access', v_access, 'organization_id', p_org, 'product', p_product);
end
$$;

revoke all on function public.my_modules(uuid), public.open_module(uuid, text, text) from public, anon;
grant execute on function public.my_modules(uuid), public.open_module(uuid, text, text) to authenticated;
revoke all on function private.is_staff(), private.is_member(uuid), private.module_access(uuid, text) from public, anon;
grant execute on function private.is_staff(), private.is_member(uuid), private.module_access(uuid, text) to authenticated;
