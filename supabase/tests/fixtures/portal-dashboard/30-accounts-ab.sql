-- TEST FIXTURE ONLY. Made-up accounts, users and rows. No client data.
-- Account A is mapped to the command schema (the Fender brand settings), account B to the
-- ledlenser schema. Account N has a member but no dashboard entitlement. The platform account
-- holds the staff user.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a.user@example.test', '', now(), now(), '{}', '{}'),
  ('b0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b.user@example.test', '', now(), now(), '{}', '{}'),
  ('c0000000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'none.user@example.test', '', now(), now(), '{}', '{}'),
  ('d0000000-0000-4000-8000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff.user@example.test', '', now(), now(), '{}', '{}'),
  ('e0000000-0000-4000-8000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ab.user@example.test', '', now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, is_platform) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Account A', 'account-a', false),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Account B', 'account-b', false),
  ('cccccccc-0000-4000-8000-000000000003', 'Account N', 'account-n', false),
  ('dddddddd-0000-4000-8000-000000000004', 'IntoFocus', 'intofocus', true)
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'member', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000b', 'admin', 'active'),
  ('cccccccc-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-00000000000c', 'member', 'active'),
  ('dddddddd-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-00000000000d', 'platform_admin', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-00000000000e', 'member', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-00000000000e', 'member', 'suspended')
on conflict do nothing;

-- ab.user is active in A and suspended in B, so only A counts.

insert into private.module_entitlements (organization_id, product) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'consensus_control'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'consensus_control')
on conflict do nothing;

insert into private.client_schema_org (schema_name, organization_id) values
  ('command', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('ledlenser', 'bbbbbbbb-0000-4000-8000-000000000002')
on conflict do nothing;

insert into sandbox.client (client_id, name, slug, organization_id) values
  ('fixture-sandbox-a', 'Sample Brand A', 'sample-brand-a', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('fixture-sandbox-b', 'Sample Brand B', 'sample-brand-b', 'bbbbbbbb-0000-4000-8000-000000000002')
on conflict do nothing;

insert into command.fixture_brand_rows (id, label) values (1, 'made-up row for account A') on conflict do nothing;
insert into ledlenser.fixture_brand_rows (id, label) values (1, 'made-up row for account B') on conflict do nothing;
