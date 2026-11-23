-- Review login for workers, PMs and e2e tests: review-bot@intofocus.ai as Org User on every client.
--
-- Asked for by Brian Magazu's PM31 (Slack DM, 23 Nov 2026,
-- https://intofocusai.slack.com/archives/D0BTDQQDVJB/p1795451713024819). Since the client data
-- lockdown (PRs 264/265), anonymous callers cannot read client data, so screenshots, previews and
-- e2e tests need a signed-in account.
--
-- ADDITIVE (data only): adds org_viewer membership rows for review-bot@intofocus.ai on every
-- organization mapped in command.client_organizations (fender and ledlenser today). No table,
-- policy, function or grant changes. It is still a permissions grant, so Brian Watson applies it.
--
-- Before applying: create the auth user in Supabase (Authentication > Users > Add user >
-- Create new user, Auto Confirm on). The insert is a no-op until that user exists, and is safe
-- to re-run.
--
-- The account is never staff: no row on the platform organization intofocus-ai. Org User means
-- read-only: it cannot manage members, edit organizations, or (after PR 249) set aside / mark done.
--
-- New clients: this does not follow new clients automatically. When a client is added to
-- command.client_organizations, re-run the insert below (it picks up every mapped client).
-- The password is never stored in the repo. It lives in the Claude cloud environment
-- (IFAI_REVIEW_EMAIL, IFAI_REVIEW_PASSWORD) and the password manager.
--
-- Check after applying:
--   select o.slug, m.role, m.status from command.organization_memberships m
--     join command.organizations o on o.id = m.organization_id
--     join auth.users u on u.id = m.user_id
--    where lower(u.email) = 'review-bot@intofocus.ai' order by 1;
--     -- fender | org_viewer | active ; ledlenser | org_viewer | active  (no intofocus-ai row)
--   Then sign in as the bot on production and on a deploy preview: the client picker lists
--   Fender and Ledlenser, and staff pages and member management are refused.
--
-- Undo (removes the bot's access; delete the auth user in the Supabase UI if no longer wanted):
--   delete from command.organization_memberships m using auth.users u
--    where m.user_id = u.id and lower(u.email) = 'review-bot@intofocus.ai';

begin;

insert into command.organization_memberships (organization_id, user_id, role, status)
select c.organization_id, u.id, 'org_viewer'::command.organization_role, 'active'::command.membership_status
from command.client_organizations c
join command.organizations o on o.id = c.organization_id and not o.is_platform_org
cross join auth.users u
where lower(u.email) = 'review-bot@intofocus.ai'
on conflict (organization_id, user_id) do update
set role = excluded.role,
    status = excluded.status;

commit;
