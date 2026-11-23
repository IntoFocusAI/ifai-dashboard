-- Test accounts and made-up rows, loaded after the migrations (as the table owner).
-- Command sign-in model only. Org A is the command organization "fender" (client_key fender:
-- schemas command and canvas_private, sandbox client cl_fender, set-aside client fmic); org B is
-- "ledlenser" (ledlenser, ledlenser_private, cl_ledlenser, ledlenser). Both orgs, the platform
-- org and the client mapping come from fixtures/40_command_accounts.sql and
-- 20261123120000_client_organizations.sql. Staff (intofocus_admin on the platform org) has no
-- membership in either client org. Every row is made up; no client data.

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

-- a1 (A Lead), a2 (A User), a3 (A, removed), b1 (B Lead), c1 (staff), d1: signed in, no org.
select pg_temp.fill('command.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000c0f1', 'user_id', '00000000-0000-0000-0000-0000000000a1', 'role', 'org_admin', 'status', 'active'));
select pg_temp.fill('command.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000c0f1', 'user_id', '00000000-0000-0000-0000-0000000000a2', 'role', 'org_viewer', 'status', 'active'));
select pg_temp.fill('command.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000c0f1', 'user_id', '00000000-0000-0000-0000-0000000000a3', 'role', 'org_viewer', 'status', 'removed'));
select pg_temp.fill('command.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000c0b1', 'user_id', '00000000-0000-0000-0000-0000000000b1', 'role', 'org_admin', 'status', 'active'));
select pg_temp.fill('command.organization_memberships', jsonb_build_object('organization_id', '00000000-0000-0000-0000-00000000c0a1', 'user_id', '00000000-0000-0000-0000-0000000000c1', 'role', 'intofocus_admin', 'status', 'active'));

select pg_temp.fill('public.set_aside_clients', jsonb_build_object('client_key', 'fmic', 'label', 'Test FMIC'));
select pg_temp.fill('public.set_aside_clients', jsonb_build_object('client_key', 'ledlenser', 'label', 'Test Ledlenser'));
select pg_temp.fill('public.set_aside_checks', jsonb_build_object('check_key', 'amazon_specs', 'label', 'Test check', 'entity_type', 'asin'));

-- Sandbox clients.
select pg_temp.fill('sandbox.client', jsonb_build_object('client_id', 'cl_fender', 'name', 'Test Fender', 'slug', 'test-fender', 'organization_id', '00000000-0000-0000-0000-00000000c0f1'));
select pg_temp.fill('sandbox.client', jsonb_build_object('client_id', 'cl_ledlenser', 'name', 'Test Ledlenser', 'slug', 'test-ledlenser', 'organization_id', '00000000-0000-0000-0000-00000000c0b1'));

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
                        'public.actuation_programs'::regclass,
                        'public.actuation_items'::regclass, 'public.actuation_expiry_reminders_sent'::regclass))
      and c.oid not in ('command.organizations'::regclass, 'command.organization_memberships'::regclass,
                        'command.client_organizations'::regclass, 'command.user_profiles'::regclass,
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
    else
      if not pg_temp.fill(r.rel) then missing := missing || r.rel::text; end if;
    end if;
  end loop;
  -- A general domain label (no client), readable by any signed-in user.
  perform pg_temp.fill('public.site_type_classifications', '{"client_key": null}');
  -- R-10: ledlenser_private holds one table (the rest are views); fill it with a valid row.
  if to_regclass('ledlenser_private.retail_price_observations') is not null
     and not pg_temp.fill('ledlenser_private.retail_price_observations',
       '{"asin": "L000000001", "retailer": "walmart", "observed_at": "2026-11-20 00:00:00+00", "status": "priced", "item_cents": "1999", "source": "backfill"}') then
    missing := missing || 'ledlenser_private.retail_price_observations'::text;
  end if;
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
