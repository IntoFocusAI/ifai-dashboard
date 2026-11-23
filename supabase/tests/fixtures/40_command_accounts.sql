-- Made-up command sign-in rows, loaded BEFORE the login-roles migrations (20261123120000,
-- 20261123120100) so their seed and clean-up statements run against hosted-like rows.
-- Shape matches production on 2026-11-23: platform org intofocus-ai with two staff, client orgs
-- fender and ledlenser, and both staff also holding org_admin on each client org.
-- Ids and the example.test users are made up. brian.m@intofocus.ai has no auth user, as on production.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000c01', 'brian.w@intofocus.ai'),
  ('00000000-0000-0000-0000-000000000c02', 'marc.s@intofocus.ai'),
  ('00000000-0000-0000-0000-000000000c11', 'lead.fender@example.test'),
  ('00000000-0000-0000-0000-000000000c12', 'user.fender@example.test'),
  ('00000000-0000-0000-0000-000000000c13', 'lead2.fender@example.test'),
  ('00000000-0000-0000-0000-000000000c14', 'removed.fender@example.test'),
  ('00000000-0000-0000-0000-000000000c21', 'lead.ledlenser@example.test'),
  ('00000000-0000-0000-0000-000000000c22', 'user.ledlenser@example.test'),
  ('00000000-0000-0000-0000-000000000c98', 'new.user@example.test'),
  ('00000000-0000-0000-0000-000000000c99', 'nobody@example.test');

insert into command.organizations (id, name, slug, is_platform_org) values
  ('00000000-0000-0000-0000-00000000c0a1', 'IntoFocus AI', 'intofocus-ai', true),
  ('00000000-0000-0000-0000-00000000c0f1', 'Fender', 'fender', false),
  ('00000000-0000-0000-0000-00000000c0b1', 'Ledlenser', 'ledlenser', false);

insert into command.organization_memberships (id, organization_id, user_id, role, status) values
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-000000000c01', 'intofocus_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-000000000c02', 'intofocus_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c01', 'org_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c02', 'org_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-000000000c01', 'org_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-000000000c02', 'org_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c11', 'org_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c12', 'org_viewer', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c13', 'org_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-000000000c14', 'org_viewer', 'removed'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-000000000c21', 'org_admin', 'active'),
  (gen_random_uuid(), '00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-000000000c22', 'org_viewer', 'active');
