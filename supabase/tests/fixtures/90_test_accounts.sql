-- Test accounts and made-up rows, loaded after the migrations (as the table owner).
-- Org A owns command (FMIC), sandbox client cl_fender and set-aside client fmic; org B owns
-- ledlenser, cl_ledlenser and set-aside client ledlenser. Staff (platform_admin) has no
-- membership in either. The client_schema_org rows are what Brian Watson inserts at apply time.
-- Every row is made up; no client data.

-- One row in p_rel: p_values sets named columns; other columns take their default, or a made-up
-- value when they are NOT NULL without a default (the first value a CHECK allows, when it lists
-- some). Foreign keys and triggers are off while this fixture loads (session_replication_role).
create function pg_temp.fill(p_rel regclass, p_values jsonb default '{}') returns boolean
language plpgsql as $$
declare cols text := ''; vals text := ''; a record; v text;
begin
  for a in
    select att.attname, att.atttypid, att.attnotnull, format_type(att.atttypid, att.atttypmod) as typ,
      t.typtype, t.typcategory, t.typbasetype,
      (select true from pg_attrdef d where d.adrelid = p_rel and d.adnum = att.attnum) as has_default,
      coalesce(
        (select substring(pg_get_constraintdef(k.oid) from '''([^'']*)''')
           from pg_constraint k
          where k.conrelid = p_rel and k.contype = 'c' and att.attnum = any (k.conkey)
            and pg_get_constraintdef(k.oid) ~ '(ANY|IN|=) ' limit 1),
        -- A domain with a list of values: its first value.
        (select substring(pg_get_constraintdef(k.oid) from '''([^'']*)''')
           from pg_constraint k where k.contypid = att.atttypid and k.contype = 'c' limit 1)) as allowed
    from pg_attribute att join pg_type t on t.oid = att.atttypid
    where att.attrelid = p_rel and att.attnum > 0 and not att.attisdropped
      and att.attgenerated = '' and att.attidentity = ''
  loop
    if p_values ? a.attname then
      v := case when p_values ->> a.attname is null then 'null' else quote_literal(p_values ->> a.attname) end;
    elsif a.has_default then
      continue;
    elsif not a.attnotnull then
      continue;
    else
      v := case
        when a.allowed is not null then quote_literal(a.allowed)
        when a.typtype = 'e' then quote_literal((select enumlabel from pg_enum where enumtypid = a.atttypid order by enumsortorder limit 1))
        when a.typcategory = 'A' then quote_literal('{}')
        when a.typ = 'uuid' then 'gen_random_uuid()::text'
        when a.typcategory = 'S' then quote_literal('t' || substr(md5(random()::text), 1, 8))
        when a.typcategory = 'N' then '1'
        when a.typcategory = 'B' then 'true'
        when a.typcategory = 'D' then 'now()::text'
        when a.typ in ('jsonb', 'json') then quote_literal('{}')
        else quote_literal('x') end;
    end if;
    cols := cols || case when cols = '' then '' else ', ' end || quote_ident(a.attname);
    vals := vals || case when vals = '' then '' else ', ' end || v || '::' || a.typ;
  end loop;
  if cols = '' then
    execute format('insert into %s default values', p_rel);
  else
    execute format('insert into %s (%s) values (%s)', p_rel, cols, vals);
  end if;
  return true;
exception when others then
  raise notice 'fixture: no row in % (%): %', p_rel, p_values, sqlerrm;
  return false;
end $$;

set session_replication_role = replica;

-- Made-up rows do not try to satisfy every CHECK (URL patterns, paired columns). Checks do not
-- affect grants, policies or views, so the fixture drops them on the tables it fills, after the
-- migrations under test have run.
do $$
declare r record;
begin
  for r in
    select k.conname, k.conrelid::regclass as rel
    from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
    where k.contype = 'c'
      and (n.nspname in ('command', 'ledlenser', 'sandbox')
           or c.oid in ('public.canvas_score_snapshots'::regclass, 'public.actuation_programs'::regclass,
                        'public.issue_set_asides'::regclass,
                        'public.actuation_items'::regclass, 'public.actuation_expiry_reminders_sent'::regclass,
                        'public.site_type_classifications'::regclass, 'public.site_type_overrides'::regclass))
  loop
    execute format('alter table %s drop constraint %I', r.rel, r.conname);
  end loop;
end $$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000d1');

-- Accounts (portal model).
select pg_temp.fill('public.organizations', jsonb_build_object('id', '00000000-0000-0000-0000-00000000000a', 'name', 'Org A', 'slug', 'org-a'));
select pg_temp.fill('public.organizations', jsonb_build_object('id', '00000000-0000-0000-0000-00000000000b', 'name', 'Org B', 'slug', 'org-b'));
select pg_temp.fill('public.organizations', jsonb_build_object('id', '00000000-0000-0000-0000-0000000000f0', 'name', 'IntoFocus', 'slug', 'intofocus-ai'));
-- a1 (A admin), a2 (A member), a3 (A, removed), b1 (B admin), c1 (staff), d1: signed in, no account.
select pg_temp.fill('public.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000000a', 'user_id', '00000000-0000-0000-0000-0000000000a1', 'role', 'org_admin', 'status', 'active'));
select pg_temp.fill('public.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000000a', 'user_id', '00000000-0000-0000-0000-0000000000a2', 'role', 'member', 'status', 'active'));
select pg_temp.fill('public.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000000a', 'user_id', '00000000-0000-0000-0000-0000000000a3', 'role', 'member', 'status', 'removed'));
select pg_temp.fill('public.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000000b', 'user_id', '00000000-0000-0000-0000-0000000000b1', 'role', 'org_admin', 'status', 'active'));
select pg_temp.fill('public.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-0000000000f0', 'user_id', '00000000-0000-0000-0000-0000000000c1', 'role', 'platform_admin', 'status', 'active'));

-- Dashboard staff (command model): c1 is intofocus_admin in the platform org.
select pg_temp.fill('command.organizations', jsonb_build_object('id', '00000000-0000-0000-0000-0000000001f0', 'name', 'IntoFocus', 'slug', 'intofocus-ai', 'is_platform_org', true));
select pg_temp.fill('command.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-0000000001f0', 'user_id', '00000000-0000-0000-0000-0000000000c1', 'role', 'intofocus_admin', 'status', 'active'));

-- What Brian Watson inserts at apply time.
-- (Skipped when 1.6 is not loaded, so the guard tests can be run against the structure alone.)
do $$ begin
  if to_regclass('private.client_schema_org') is not null then
    insert into private.client_schema_org (schema_name, organization_id, note) values
      ('command', '00000000-0000-0000-0000-00000000000a', 'test: org A'),
      ('ledlenser', '00000000-0000-0000-0000-00000000000b', 'test: org B');
  end if;
end $$;
select pg_temp.fill('public.set_aside_clients', jsonb_build_object('client_key', 'fmic', 'label', 'Test FMIC', 'organization_id', '00000000-0000-0000-0000-00000000000a'));
select pg_temp.fill('public.set_aside_clients', jsonb_build_object('client_key', 'ledlenser', 'label', 'Test Ledlenser', 'organization_id', '00000000-0000-0000-0000-00000000000b'));
select pg_temp.fill('public.set_aside_checks', jsonb_build_object('check_key', 'amazon_specs', 'label', 'Test check', 'entity_type', 'asin'));

-- Sandbox clients.
select pg_temp.fill('sandbox.client', jsonb_build_object('client_id', 'cl_fender', 'name', 'Test Fender', 'slug', 'test-fender', 'organization_id', '00000000-0000-0000-0000-00000000000a'));
select pg_temp.fill('sandbox.client', jsonb_build_object('client_id', 'cl_ledlenser', 'name', 'Test Ledlenser', 'slug', 'test-ledlenser', 'organization_id', '00000000-0000-0000-0000-00000000000b'));

-- One made-up row in every other client table (sandbox and public: one per client).
do $$
declare r record; missing text[] := '{}';
begin
  for r in
    select c.oid::regclass as rel, n.nspname,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'client_id' and not a.attisdropped) as has_client_id,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'client_key' and not a.attisdropped) as has_client_key,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'organization_id' and not a.attisdropped) as has_org
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and (n.nspname in ('command', 'ledlenser', 'sandbox')
           or c.oid in ('public.issue_set_asides'::regclass, 'public.canvas_score_snapshots'::regclass,
                        'public.site_type_classifications'::regclass, 'public.site_type_overrides'::regclass,
                        'public.audit_log'::regclass, 'public.actuation_programs'::regclass,
                        'public.actuation_items'::regclass, 'public.actuation_expiry_reminders_sent'::regclass))
      and c.oid not in ('command.organizations'::regclass, 'command.organization_memberships'::regclass,
                        'sandbox.client'::regclass)
    order by 1::text
  loop
    if r.nspname in ('command', 'ledlenser') then
      if not pg_temp.fill(r.rel) then missing := missing || r.rel::text; end if;
    elsif r.has_client_id then
      if not pg_temp.fill(r.rel, '{"client_id": "cl_fender"}') then missing := missing || r.rel::text; end if;
      perform pg_temp.fill(r.rel, '{"client_id": "cl_ledlenser"}');
    elsif r.has_client_key then
      if not pg_temp.fill(r.rel, '{"client_key": "fmic"}') then missing := missing || r.rel::text; end if;
      perform pg_temp.fill(r.rel, '{"client_key": "ledlenser"}');
    elsif r.nspname = 'public' and r.has_org then
      perform pg_temp.fill(r.rel, '{"organization_id": "00000000-0000-0000-0000-00000000000a", "entity_table": "issue_set_asides"}');
      perform pg_temp.fill(r.rel, '{"organization_id": "00000000-0000-0000-0000-00000000000b", "entity_table": "issue_set_asides"}');
    else
      if not pg_temp.fill(r.rel) then missing := missing || r.rel::text; end if;
    end if;
  end loop;
  if array_length(missing, 1) > 0 then
    raise notice 'fixture: tables without rows: %', missing;
  end if;
end $$;

set session_replication_role = origin;

do $$
declare r record;
begin
  for r in select c.oid::regclass as mv from pg_class c where c.relkind = 'm' loop
    execute format('refresh materialized view %s', r.mv);
  end loop;
end $$;
