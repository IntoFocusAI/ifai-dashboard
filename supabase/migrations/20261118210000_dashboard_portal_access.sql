-- Dashboard sign-in from portal accounts (issue 248, FDD 3.5b).
--
-- What it changes (additive only; no existing object, row or grant changes):
--   Adds three read-only functions in public that the dashboard calls as the signed-in user.
--   They read the portal's accounts (public.organizations, public.organization_memberships),
--   the portal's staff check (private.is_staff()) and the 1.6 isolation helpers
--   (private.client_schema_org, private.can_read_schema, private.can_read_client).
--
--   public.my_dashboard_accounts(p_selected uuid default null)
--     The caller's active portal accounts. A staff caller also gets p_selected (role 'staff')
--     when that account exists, so staff can open a client account they do not belong to.
--     p_selected is only a selector: a non-staff caller never gets an account they are not in.
--   public.dashboard_viewer_is_staff()
--     private.is_staff() for the caller, so the app never reads the private schema.
--   public.my_dashboard_clients(p_organization_id uuid)
--     The brands the caller may read for one account: per-client schemas mapped to it in
--     private.client_schema_org, and sandbox.client rows with that organization_id. Each row is
--     re-checked with private.can_read_schema / private.can_read_client, so the answer comes
--     from the caller's membership, never from the id passed in.
--
--   anon cannot execute any of them. authenticated can.
--
-- Depends on: the portal migrations (accounts and private.is_staff()) and the 1.6 isolation
-- migration from issue 247 (private.client_schema_org and the two helpers). Apply after both.
--
-- How to undo:
--   drop function if exists public.my_dashboard_clients(uuid);
--   drop function if exists public.dashboard_viewer_is_staff();
--   drop function if exists public.my_dashboard_accounts(uuid);

create or replace function public.my_dashboard_accounts(p_selected uuid default null)
returns table (organization_id uuid, name text, slug text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name::text, o.slug::text, m.role::text
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.status::text = 'active'
  union
  select o.id, o.name::text, o.slug::text, 'staff'::text
  from public.organizations o
  where p_selected is not null
    and o.id = p_selected
    and auth.uid() is not null
    and private.is_staff()
    and not exists (
      select 1 from public.organization_memberships m
      where m.organization_id = o.id and m.user_id = auth.uid() and m.status::text = 'active'
    )
$$;

comment on function public.my_dashboard_accounts(uuid) is
  'Dashboard sign-in: the caller''s active portal accounts, plus p_selected for staff. Issue 248.';

create or replace function public.dashboard_viewer_is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and coalesce(private.is_staff(), false)
$$;

comment on function public.dashboard_viewer_is_staff() is
  'Dashboard sign-in: private.is_staff() for the caller. Issue 248.';

create or replace function public.my_dashboard_clients(p_organization_id uuid)
returns table (source text, client_ref text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'schema'::text, c.schema_name::text
  from private.client_schema_org c
  where c.organization_id = p_organization_id
    and private.can_read_schema(c.schema_name)
  union
  select 'sandbox'::text, s.client_id::text
  from sandbox.client s
  where s.organization_id = p_organization_id
    and private.can_read_client(s.client_id)
$$;

comment on function public.my_dashboard_clients(uuid) is
  'Dashboard sign-in: brands the caller may read for one account, re-checked with the 1.6 helpers. Issue 248.';

revoke all on function public.my_dashboard_accounts(uuid) from public, anon;
revoke all on function public.dashboard_viewer_is_staff() from public, anon;
revoke all on function public.my_dashboard_clients(uuid) from public, anon;
grant execute on function public.my_dashboard_accounts(uuid) to authenticated;
grant execute on function public.dashboard_viewer_is_staff() to authenticated;
grant execute on function public.my_dashboard_clients(uuid) to authenticated;
