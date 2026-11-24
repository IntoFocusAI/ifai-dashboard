-- R-10 step 1 (20261123170000): retailer lists and price observations per client.
-- Staff read both clients; a Fender member reads only Fender; a Ledlenser member only Ledlenser;
-- a signed-in user with no org reads nothing; anon is refused. Observations are append-only for
-- every role but the table owner. Accounts come from fixtures/40_command_accounts.sql and
-- 90_test_accounts.sql.
\set ON_ERROR_STOP 1

-- Run one query as an actor the way PostgREST does. 'denied' when refused.
create function pg_temp.as_actor(p_who text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  case p_who
    when 'anon' then perform public.test_act_as('anon');
    when 'service' then perform public.test_act_as('service_role');
    else perform public.test_act_as('authenticated', case p_who
      when 'fender' then '00000000-0000-0000-0000-0000000000a2'::uuid   -- Fender Org User
      when 'ledlenser' then '00000000-0000-0000-0000-0000000000b1'::uuid -- Ledlenser Org Lead
      when 'staff' then '00000000-0000-0000-0000-0000000000c1'::uuid
      when 'none' then '00000000-0000-0000-0000-0000000000d1'::uuid end);
  end case;
  begin
    execute p_sql into v;
  exception when insufficient_privilege then v := 'denied';
  end;
  reset role;
  reset session authorization;
  return v;
end $$;

-- Made-up rows (as owner): a Fender listing below MAP at Walmart, then a failed check after it;
-- a Ledlenser listing at Walmart.
insert into command.fmic_retail_buybox_map
  (id, asin, model_name, map_price, offer_price, reviews_count, buybox_status, created_at, updated_at)
values (gen_random_uuid(), 'R10FENDER1', 'Test Strat', 100.00, 100.00, 0, 'won', now(), now());
insert into command.retail_price_observations
  (asin, retailer, domain, observed_at, status, item_cents, source, collector) values
  ('R10FENDER1', 'walmart', 'walmart.com', '2026-11-20 10:00+00', 'priced', 8999, 'retailer_checker', 'test'),
  ('R10FENDER1', 'walmart', 'walmart.com', '2026-11-21 10:00+00', 'check_failed', null, 'retailer_checker', 'test'),
  ('R10FENDER1', 'musicians-friend', 'musiciansfriend.com', '2026-11-21 10:00+00', 'no_match', null, 'retailer_checker', 'test');
insert into ledlenser_private.retail_price_observations
  (asin, retailer, domain, observed_at, status, item_cents, source, collector) values
  ('R10LEDLEN1', 'walmart', 'walmart.com', '2026-11-21 10:00+00', 'priced', 4999, 'retailer_checker', 'test');

-- 1. Seeds: Fender 4 retailers (2 active MAP channels), Ledlenser Walmart only.
do $$ begin
  if (select string_agg(slug || ':' || active || ':' || map_channel, ',' order by sort_order) from command.retailers
       where slug in ('walmart', 'musicians-friend', 'sweetwater', 'reverb'))
     <> 'walmart:true:true,musicians-friend:true:true,sweetwater:false:false,reverb:false:false' then
    raise exception 'command.retailers seed';
  end if;
  if exists (select 1 from ledlenser.retailers where slug = 'musicians-friend')
     or not exists (select 1 from ledlenser.retailers where slug = 'walmart' and active and map_channel) then
    raise exception 'ledlenser.retailers seed: Walmart only';
  end if;
end $$;

-- 2. Who reads what. Fender relations: rows for Fender readers and staff only; Ledlenser
--    relations: rows for Ledlenser readers and staff only; anon refused everywhere.
do $$
declare
  rel text; who text; got text; owner_n text; errors text[] := '{}';
  fender_rels text[] := array['command.retailers', 'command.retail_price_observations',
    'public.canvas_retailers', 'public.canvas_retail_prices', 'public.canvas_retail_price_history',
    'public.canvas_retailer_metrics'];
  ledlenser_rels text[] := array['ledlenser.retailers', 'ledlenser_private.retail_price_observations',
    'ledlenser.canvas_retailers', 'ledlenser.canvas_retail_prices', 'ledlenser.canvas_retail_price_history',
    'ledlenser.canvas_retailer_metrics'];
begin
  foreach rel in array fender_rels || ledlenser_rels loop
    execute format('select count(*) from %s', rel) into owner_n;
    if owner_n = '0' then errors := errors || format('%s: no rows to test', rel); end if;
    foreach who in array array['anon', 'fender', 'ledlenser', 'staff', 'none'] loop
      got := pg_temp.as_actor(who, format('select count(*) from %s', rel));
      if who = 'anon' and got <> 'denied' then
        errors := errors || format('%s: anon got %s', rel, got);
      elsif who = 'staff' and got <> owner_n then
        errors := errors || format('%s: staff got %s of %s', rel, got, owner_n);
      elsif (who = 'fender' and rel = any (fender_rels)) or (who = 'ledlenser' and rel = any (ledlenser_rels)) then
        if got <> owner_n then errors := errors || format('%s: %s member got %s of %s', rel, who, got, owner_n); end if;
      elsif who in ('fender', 'ledlenser', 'none') and got <> '0' then
        errors := errors || format('%s: %s got %s rows of another client', rel, who, got);
      end if;
    end loop;
  end loop;
  if array_length(errors, 1) > 0 then
    raise exception E'R-10 access:\n%', array_to_string(errors, E'\n');
  end if;
end $$;

-- 3. Views: latest usable check wins over a later failed check; leakage = price - MAP.
do $$
declare r record;
begin
  select * into r from public.canvas_retail_prices where asin = 'R10FENDER1' and retailer = 'walmart';
  if r.status <> 'priced' or r.price <> 89.99 or r.map_price <> 100.00 or r.leakage <> -10.01
     or not r.is_below_map or r.last_attempt_at <> '2026-11-21 10:00+00' then
    raise exception 'canvas_retail_prices walmart row: %', row_to_json(r);
  end if;
  select * into r from public.canvas_retail_prices where asin = 'R10FENDER1' and retailer = 'musicians-friend';
  if r.status <> 'no_match' or r.price is not null or r.leakage is not null or r.is_below_map then
    raise exception 'canvas_retail_prices no_match row: %', row_to_json(r);
  end if;
  if (select count(*) from public.canvas_retail_price_history where asin = 'R10FENDER1') <> 3 then
    raise exception 'canvas_retail_price_history keeps every check';
  end if;
  if pg_temp.as_actor('fender', $q$select leaks from public.canvas_retailer_metrics where retailer = 'walmart'$q$)::int < 1 then
    raise exception 'canvas_retailer_metrics walmart leaks';
  end if;
end $$;

-- 4. Append-only. Signed-in users cannot write; service_role (step 2 writers) can insert but not
--    update or delete; even with a grant, the trigger refuses anyone but the owner.
do $$
declare t text; who text; got text;
begin
  foreach t in array array['command.retail_price_observations', 'ledlenser_private.retail_price_observations'] loop
    foreach who in array array['fender', 'ledlenser', 'staff', 'service'] loop
      got := pg_temp.as_actor(who, format('with x as (update %s set title = %L returning 1) select count(*) from x', t, 'changed'));
      if got <> 'denied' then raise exception '% could update %', who, t; end if;
      got := pg_temp.as_actor(who, format('with x as (delete from %s returning 1) select count(*) from x', t));
      if got <> 'denied' then raise exception '% could delete from %', who, t; end if;
      if has_table_privilege(case who when 'service' then 'service_role' else 'authenticated' end, t, 'truncate') then
        raise exception '% could truncate %', who, t;
      end if;
    end loop;
    foreach who in array array['fender', 'ledlenser', 'staff', 'anon'] loop
      got := pg_temp.as_actor(who, format(
        $q$with x as (insert into %s (asin, retailer, observed_at, status, source) values ('R10X', 'walmart', now(), 'no_match', 'retailer_checker') returning 1) select count(*) from x$q$, t));
      if got <> 'denied' then raise exception '% could insert into %', who, t; end if;
    end loop;
    got := pg_temp.as_actor('service', format(
      $q$with x as (insert into %s (asin, retailer, observed_at, status, source) values ('R10SVC', 'walmart', now(), 'no_match', 'retailer_checker') returning 1) select count(*) from x$q$, t));
    if got <> '1' then raise exception 'service_role could not insert into % (%)', t, got; end if;

    -- Even with UPDATE and DELETE granted, the trigger refuses a non-owner.
    execute format('grant update, delete on %s to service_role', t);
    perform public.test_act_as('service_role');
    begin
      execute format('update %s set title = %L', t, 'changed');
      raise exception 'trigger let service_role update %', t;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('delete from %s', t);
      raise exception 'trigger let service_role delete from %', t;
    exception when insufficient_privilege then null;
    end;
    reset role;
    reset session authorization;
    execute format('revoke update, delete on %s from service_role', t);

    -- The owner (migrations, a deliberate thinning job) still can.
    execute format($q$update %s set title = 'owner edit' where asin = 'R10SVC'$q$, t);
    execute format($q$delete from %s where asin = 'R10SVC'$q$, t);
  end loop;
end $$;

-- 5. Grants are explicit: nothing for anon or PUBLIC, no writes on the retailer lists, views
--    run as the caller.
do $$
declare bad text;
begin
  select string_agg(c.oid::regclass::text, ', ') into bad
  from pg_class c
  where c.oid in ('command.retailers'::regclass, 'ledlenser.retailers'::regclass,
                  'command.retail_price_observations'::regclass, 'ledlenser_private.retail_price_observations'::regclass,
                  'public.canvas_retailers'::regclass, 'public.canvas_retail_prices'::regclass,
                  'public.canvas_retail_price_history'::regclass, 'public.canvas_retailer_metrics'::regclass,
                  'ledlenser.canvas_retailers'::regclass, 'ledlenser.canvas_retail_prices'::regclass,
                  'ledlenser.canvas_retail_price_history'::regclass, 'ledlenser.canvas_retailer_metrics'::regclass)
    and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate')
         or exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where a.grantee = 0)
         or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate')
         or (c.relkind = 'v' and has_table_privilege('service_role', c.oid, 'insert,update,delete,truncate'))
         or (c.relname = 'retailers' and has_table_privilege('service_role', c.oid, 'insert,update,delete,truncate'))
         or (c.relkind = 'r' and not c.relrowsecurity)
         or (c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false)));
  if bad is not null then raise exception 'R-10 grants: %', bad; end if;
  if has_function_privilege('anon', 'private.reject_retail_observation_change()', 'execute')
     or has_function_privilege('authenticated', 'private.reject_retail_observation_change()', 'execute') then
    raise exception 'R-10 trigger function executable by API roles';
  end if;
end $$;
