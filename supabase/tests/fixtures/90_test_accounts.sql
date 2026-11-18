-- Test accounts and made-up rows, loaded after the migrations (as the table owner).
-- Org A owns command (FMIC) and sandbox client cl_fender; org B owns ledlenser and cl_ledlenser.
-- Staff is entitled to org A's dashboard only. The client_schema_org rows are what Brian Watson
-- inserts at apply time.

insert into public.organizations (id, name, slug) values
  ('00000000-0000-0000-0000-00000000000a', 'Org A', 'org-a'),
  ('00000000-0000-0000-0000-00000000000b', 'Org B', 'org-b'),
  ('00000000-0000-0000-0000-0000000000f0', 'IntoFocus', 'intofocus-ai');

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000d1');

-- Users: a1 (A admin), a2 (A member), b1 (B admin), s1 (staff), x1 (signed in, no account),
-- a3 (A member, inactive).
insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'admin', 'active'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'member', 'active'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'member', 'removed'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'admin', 'active'),
  ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000c1', 'platform_admin', 'active');

insert into public.organization_modules (organization_id, module_key, enabled) values
  ('00000000-0000-0000-0000-00000000000a', 'consensus_control', true),
  ('00000000-0000-0000-0000-00000000000b', 'consensus_control', false);

insert into private.client_schema_org (schema_name, organization_id, note) values
  ('command', '00000000-0000-0000-0000-00000000000a', 'test: org A'),
  ('ledlenser', '00000000-0000-0000-0000-00000000000b', 'test: org B');

update public.set_aside_clients set organization_id = '00000000-0000-0000-0000-00000000000a' where client_key = 'fmic';
insert into public.set_aside_clients (client_key, label, organization_id)
values ('ledlenser', 'Ledlenser', '00000000-0000-0000-0000-00000000000b');

insert into command.test_platform_admins values ('00000000-0000-0000-0000-0000000000c1');
insert into command.fmic_ai_prompts (prompt_key, prompt_text, category) values
  ('p01', 'Which test guitar is best?', 'guitars'), ('p02', 'Which test amp is best?', 'amps');
insert into command.fmic_ai_prompt_edits (edited_at, action, prompt_key) values (now(), 'add', 'p01');
insert into command.fmic_audit_runs (run_kind, collector_version, run_state) values ('ai_simulation', 'v11', 'done');
insert into command.fmic_ai_simulations (prompt_key) values ('p01');
insert into command.user_profiles values ('00000000-0000-0000-0000-0000000000c1', 'Test Staff');
insert into public.actuation_programs (client_key, factor, owner_name, evidence_url, verified_on, target_domains, cadence_per_30_days, target_count)
select 'fmic', 'P1', 'Test owner', 'https://example.com/e', current_date, '{example.com}', 1, null
where to_regclass('public.actuation_programs') is not null;

insert into command.fmic_catalog values ('B000000001', 'Test guitar', 100), ('B000000002', 'Test amp', 50);
insert into command.fmic_retail_buybox_map values ('B000000001', 90);
insert into command.fmic_ai_api_runs values (gen_random_uuid(), 'engine-x');
insert into ledlenser.catalog values ('L000000001', 'Test torch');
insert into ledlenser.ai_citations values (1, 'https://example.com/a');
refresh materialized view command.mv_listing_sales_loss;
refresh materialized view ledlenser.mv_listing_offer_state_v2;

-- Sandbox: one made-up row per client in every table (generic filler; foreign keys and
-- triggers are off while loading).
set session_replication_role = replica;
insert into sandbox.client (client_id, name, slug, seller_type, organization_id) values
  ('cl_fender', 'Test Fender', 'test-fender', '1p', '00000000-0000-0000-0000-00000000000a'),
  ('cl_ledlenser', 'Test Ledlenser', 'test-ledlenser', '1p', '00000000-0000-0000-0000-00000000000b');

create function pg_temp.fill(p_rel regclass, p_client text) returns boolean language plpgsql as $$
declare cols text := ''; vals text := ''; a record; v text;
begin
  for a in
    select att.attname, att.atttypid, format_type(att.atttypid, att.atttypmod) as typ, t.typtype, t.typcategory,
      (select substring(pg_get_constraintdef(k.oid) from '''([^'']*)''')
         from pg_constraint k
        where k.conrelid = p_rel and k.contype = 'c' and k.conkey = array[att.attnum]
          and pg_get_constraintdef(k.oid) ~ '(ANY|IN|=) ' limit 1) as allowed
    from pg_attribute att join pg_type t on t.oid = att.atttypid
    where att.attrelid = p_rel and att.attnum > 0 and not att.attisdropped
      and att.attgenerated = '' and att.attidentity = ''
  loop
    v := case
      when a.attname = 'client_id' then quote_literal(p_client)
      -- A check such as col = any (array['a', 'b']): use its first listed value.
      when a.allowed is not null then quote_literal(a.allowed)
      when a.typtype = 'e' then quote_literal((select enumlabel from pg_enum where enumtypid = a.atttypid order by enumsortorder limit 1))
      when a.typcategory = 'A' then quote_literal('{}')
      when a.typ in ('uuid') then 'gen_random_uuid()'
      when a.typcategory = 'S' then quote_literal('t' || substr(md5(random()::text), 1, 8))
      when a.typcategory = 'N' then '1'
      when a.typcategory = 'B' then 'true'
      when a.typcategory = 'D' then 'now()'
      when a.typ in ('jsonb', 'json') then quote_literal('{}')
      else 'default' end;
    cols := cols || case when cols = '' then '' else ', ' end || quote_ident(a.attname);
    vals := vals || case when vals = '' then '' else ', ' end || v || '::' || a.typ;
  end loop;
  execute format('insert into %s (%s) values (%s)', p_rel, cols, replace(vals, 'default::', 'null::'));
  return true;
exception when others then
  raise notice 'fixture: no row in % for %: %', p_rel, p_client, sqlerrm;
  return false;
end $$;

do $$
declare r record;
begin
  for r in select c.oid::regclass as rel from pg_class c
           where c.relnamespace = 'sandbox'::regnamespace and c.relkind = 'r' and c.relname <> 'client'
  loop
    perform pg_temp.fill(r.rel, 'cl_fender');
    perform pg_temp.fill(r.rel, 'cl_ledlenser');
  end loop;
end $$;
set session_replication_role = origin;

insert into public.issue_set_asides (client_key, check_key, entity_type, entity_key, status, outcome, set_by_name)
select 'fmic', check_key, entity_type, 'B000000001', 'active', 'done', 'Test A'
from public.set_aside_checks where entity_type = 'asin' limit 1;
insert into public.issue_set_asides (client_key, check_key, entity_type, entity_key, status, outcome, set_by_name)
select 'ledlenser', check_key, entity_type, 'L000000001', 'active', 'done', 'Test B'
from public.set_aside_checks where entity_type = 'asin' limit 1;
