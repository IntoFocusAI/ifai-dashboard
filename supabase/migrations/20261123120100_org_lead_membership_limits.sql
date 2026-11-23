-- Login roles, part 2 of 2: Org Leads manage only Org Users; staff rows tidied.
--
-- ALTERING. Replaces three existing policies and deletes existing membership rows, so Brian
-- Watson applies it himself (AGENTS.md). Apply after 20261123120000_client_organizations.sql.
--
-- What it changes:
--   1. Policies memberships_insert, memberships_update and memberships_delete on
--      command.organization_memberships (from 20260330180000_command_identity.sql) are replaced.
--      Before: any org_admin of an organization could insert, update or delete any membership
--      row in it, including other org_admin rows and promotions to org_admin.
--      After:
--        * Staff (command.is_intofocus_admin()) may do anything, as before.
--        * An Org Lead (active org_admin of the organization) may insert, update and delete only
--          rows whose role is org_viewer, in their own organization. An update must leave the
--          row an org_viewer row in an organization they lead, so a Lead cannot promote anyone
--          to org_admin, demote or remove an org_admin (including themselves), or touch
--          intofocus_admin rows. Only staff manage Leads.
--      memberships_select is unchanged. The trigger organization_memberships_enforce_intofocus_admin
--      stays: intofocus_admin is still allowed only on the platform organization.
--   2. Deletes Brian Watson's (brian.w@intofocus.ai) and Marc's (marc.s@intofocus.ai) org_admin
--      rows on fender and ledlenser. They are staff (intofocus_admin on intofocus-ai), and staff
--      see every client, so these rows are redundant. Their intofocus_admin rows are not touched.
--   3. Adds Brian Magazu (brian.m@intofocus.ai) as staff: intofocus_admin, active, on
--      intofocus-ai. Guarded: a no-op until his auth user exists. Re-run this one statement after
--      he first signs in (it is safe to run again).
--
-- Check after applying:
--   select polname, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
--     from pg_policy where polrelid = 'command.organization_memberships'::regclass order by 1;
--   select o.slug, u.email, m.role, m.status from command.organization_memberships m
--     join command.organizations o on o.id = m.organization_id join auth.users u on u.id = m.user_id
--     order by 1, 2;   -- staff rows only on intofocus-ai
--
-- Undo:
--   1. Restore the original policies:
--      drop policy memberships_insert on command.organization_memberships;
--      drop policy memberships_update on command.organization_memberships;
--      drop policy memberships_delete on command.organization_memberships;
--      create policy memberships_insert on command.organization_memberships for insert to authenticated
--        with check (command.is_intofocus_admin() or command.user_has_org_role(organization_id, 'org_admin'));
--      create policy memberships_update on command.organization_memberships for update to authenticated
--        using (command.is_intofocus_admin() or command.user_has_org_role(organization_id, 'org_admin'))
--        with check (command.is_intofocus_admin() or command.user_has_org_role(organization_id, 'org_admin'));
--      create policy memberships_delete on command.organization_memberships for delete to authenticated
--        using (command.is_intofocus_admin() or command.user_has_org_role(organization_id, 'org_admin'));
--   2. Re-create the deleted rows:
--      insert into command.organization_memberships (organization_id, user_id, role, status)
--      select o.id, u.id, 'org_admin', 'active' from command.organizations o cross join auth.users u
--      where o.slug in ('fender', 'ledlenser') and u.email in ('brian.w@intofocus.ai', 'marc.s@intofocus.ai')
--      on conflict (organization_id, user_id) do nothing;
--   3. Remove Brian Magazu's staff row (only if it should not stay):
--      delete from command.organization_memberships m using command.organizations o, auth.users u
--      where m.organization_id = o.id and m.user_id = u.id and o.slug = 'intofocus-ai'
--        and u.email = 'brian.m@intofocus.ai';

begin;

-- 1. Policies ----------------------------------------------------------------------------------

drop policy if exists memberships_insert on command.organization_memberships;
drop policy if exists memberships_update on command.organization_memberships;
drop policy if exists memberships_delete on command.organization_memberships;

-- command.user_has_org_role(org, 'org_admin') is true for staff and for an active org_admin of
-- that organization. The role check is on the row: Leads handle org_viewer rows only.
create policy memberships_insert on command.organization_memberships
  for insert to authenticated
  with check (
    command.is_intofocus_admin()
    or (role = 'org_viewer' and command.user_has_org_role(organization_id, 'org_admin'))
  );

create policy memberships_update on command.organization_memberships
  for update to authenticated
  using (
    command.is_intofocus_admin()
    or (role = 'org_viewer' and command.user_has_org_role(organization_id, 'org_admin'))
  )
  with check (
    command.is_intofocus_admin()
    or (role = 'org_viewer' and command.user_has_org_role(organization_id, 'org_admin'))
  );

create policy memberships_delete on command.organization_memberships
  for delete to authenticated
  using (
    command.is_intofocus_admin()
    or (role = 'org_viewer' and command.user_has_org_role(organization_id, 'org_admin'))
  );

-- 2. Staff no longer need org_admin rows on client organizations ------------------------------

delete from command.organization_memberships m
using command.organizations o, auth.users u
where m.organization_id = o.id
  and m.user_id = u.id
  and o.slug in ('fender', 'ledlenser')
  and m.role = 'org_admin'
  and u.email in ('brian.w@intofocus.ai', 'marc.s@intofocus.ai');

-- 3. Brian Magazu as staff (no-op until his auth user exists) --------------------------------

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

commit;
