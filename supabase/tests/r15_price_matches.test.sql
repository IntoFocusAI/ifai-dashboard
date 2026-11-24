-- R-15 (20261123190000): price-match searches and kept matches per client.
-- Staff read both clients; a Fender member only Fender; a Ledlenser member only Ledlenser; a
-- signed-in user with no org nothing; anon is refused. The views show the latest completed search
-- and flag a benchmark that changed since. The tables are append-only. The ignore is a set-aside
-- on the new price_match check through the existing functions.
\set ON_ERROR_STOP 1

create function pg_temp.as_actor(p_who text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  case p_who
    when 'anon' then perform public.test_act_as('anon');
    when 'service' then perform public.test_act_as('service_role');
    else perform public.test_act_as('authenticated', case p_who
      when 'fender' then '00000000-0000-0000-0000-0000000000a2'::uuid
      when 'ledlenser' then '00000000-0000-0000-0000-0000000000b1'::uuid
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

-- Made-up rows (as owner). Fender: an older search at $799.99 with one match, then a newer one at
-- the current $714.99 with a same and an unsure match, then a failed attempt. Ledlenser: one
-- search with one match from a seller not on the retailer list.
insert into command.fmic_retail_buybox_map
  (id, asin, model_name, offer_price, competitive_price_threshold_cents, reviews_count, buybox_status, created_at, updated_at)
values (gen_random_uuid(), 'R15FENDER1', 'Test Jazzmaster', 799.99, 71499, 0, 'withheld', now(), now());
insert into ledlenser.retail_buybox_map
  (id, asin, model_name, offer_price, competitive_price_threshold_cents, reviews_count, buybox_status, created_at, updated_at)
values (gen_random_uuid(), 'R15LEDLEN1', 'Test H7R', 170.01, 11995, 0, 'withheld', now(), now());

do $$
declare c1 bigint; c2 bigint; o1 bigint; o2 bigint; o3 bigint; lc bigint; lo bigint;
begin
  insert into command.price_match_checks (asin, searched_at, benchmark_cents, provider, query_type, status, result_count, exact_count, kept_count, different_count)
    values ('R15FENDER1', '2026-11-16 10:00+00', 79999, 'test', 'title', 'searched', 20, 1, 1, 0) returning id into c1;
  insert into command.price_match_checks (asin, searched_at, benchmark_cents, provider, query_type, status, result_count, exact_count, kept_count, different_count)
    values ('R15FENDER1', '2026-11-23 10:00+00', 71499, 'test', 'title', 'searched', 30, 3, 2, 1) returning id into c2;
  insert into command.price_match_checks (asin, searched_at, benchmark_cents, provider, query_type, status, error)
    values ('R15FENDER1', '2026-11-23 11:00+00', 71499, 'test', 'title', 'failed', 'blocked');
  insert into command.retail_price_observations (asin, retailer, domain, observed_at, status, item_cents, shipping_cents, url, source)
    values ('R15FENDER1', 'musicians-friend', 'musiciansfriend.com', '2026-11-16 10:00+00', 'priced', 79999, 0, 'https://www.musiciansfriend.com/x', 'price_search') returning id into o1;
  insert into command.retail_price_observations (asin, retailer, domain, observed_at, status, item_cents, shipping_cents, url, source)
    values ('R15FENDER1', 'musicians-friend', 'musiciansfriend.com', '2026-11-23 10:00+00', 'priced', 71499, 0, 'https://www.musiciansfriend.com/x', 'price_search') returning id into o2;
  insert into command.retail_price_observations (asin, retailer, domain, observed_at, status, item_cents, url, source)
    values ('R15FENDER1', null, 'guitarcenter.com', '2026-11-23 10:00+00', 'priced', 71499, 'https://www.guitarcenter.com/x', 'price_search') returning id into o3;
  insert into command.price_match_results (check_id, observation_id, match_kind, verdict, verdict_by) values
    (c1, o1, 'landed', 'same', 'test-model'),
    (c2, o2, 'landed', 'same', 'upc'),
    (c2, o3, 'item', 'unsure', 'test-model');

  insert into ledlenser_private.price_match_checks (asin, searched_at, benchmark_cents, provider, query_type, status, result_count, exact_count, kept_count, different_count)
    values ('R15LEDLEN1', '2026-11-23 10:00+00', 11995, 'test', 'title', 'searched', 10, 1, 1, 0) returning id into lc;
  insert into ledlenser_private.retail_price_observations (asin, retailer, domain, observed_at, status, item_cents, url, source)
    values ('R15LEDLEN1', null, 'rei.com', '2026-11-23 10:00+00', 'priced', 11995, 'https://www.rei.com/x', 'price_search') returning id into lo;
  insert into ledlenser_private.price_match_results (check_id, observation_id, match_kind, verdict, verdict_by)
    values (lc, lo, 'item', 'same', 'test-model');
end $$;

-- 1. Who reads what.
do $$
declare
  rel text; who text; got text; owner_n text; errors text[] := '{}';
  fender_rels text[] := array['command.price_match_checks', 'command.price_match_results',
    'public.canvas_price_match_checks', 'public.canvas_price_matches'];
  ledlenser_rels text[] := array['ledlenser_private.price_match_checks', 'ledlenser_private.price_match_results',
    'ledlenser.canvas_price_match_checks', 'ledlenser.canvas_price_matches'];
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
    raise exception E'R-15 access:\n%', array_to_string(errors, E'\n');
  end if;
end $$;

-- 2. Views: the latest completed search wins over a later failed attempt; only its matches show;
--    a seller not on the list keeps its domain; landed = item + shipping when shipping is known.
do $$
declare r record;
begin
  select * into r from public.canvas_price_match_checks where asin = 'R15FENDER1';
  if r.search_benchmark_cents <> 71499 or r.current_benchmark_cents <> 71499 or r.benchmark_changed
     or r.last_attempt_status <> 'failed' or r.kept_count <> 2 then
    raise exception 'canvas_price_match_checks: %', row_to_json(r);
  end if;
  if (select count(*) from public.canvas_price_matches where asin = 'R15FENDER1') <> 2 then
    raise exception 'canvas_price_matches shows only the latest search';
  end if;
  select * into r from public.canvas_price_matches where asin = 'R15FENDER1' and verdict = 'unsure';
  if r.retailer is not null or r.domain <> 'guitarcenter.com' or r.landed_cents is not null or r.match_kind <> 'item' then
    raise exception 'canvas_price_matches unsure row: %', row_to_json(r);
  end if;
  select * into r from public.canvas_price_matches where asin = 'R15FENDER1' and verdict = 'same';
  if r.retailer_name <> 'Musician''s Friend' or r.landed_cents <> 71499 then
    raise exception 'canvas_price_matches same row: %', row_to_json(r);
  end if;
  -- A benchmark that changed after the search is flagged.
  update ledlenser.retail_buybox_map set competitive_price_threshold_cents = 9995 where asin = 'R15LEDLEN1';
  if not (select benchmark_changed from ledlenser.canvas_price_match_checks where asin = 'R15LEDLEN1') then
    raise exception 'ledlenser.canvas_price_match_checks does not flag a changed benchmark';
  end if;
  if (select domain from ledlenser.canvas_price_matches where asin = 'R15LEDLEN1') <> 'rei.com' then
    raise exception 'ledlenser.canvas_price_matches domain';
  end if;
end $$;

-- 3. Append-only: signed-in users cannot write; service_role inserts but cannot update or delete.
do $$
declare t text; who text; got text;
begin
  foreach t in array array['command.price_match_checks', 'ledlenser_private.price_match_checks'] loop
    foreach who in array array['fender', 'ledlenser', 'staff', 'service'] loop
      got := pg_temp.as_actor(who, format('with x as (update %s set error = %L returning 1) select count(*) from x', t, 'changed'));
      if got <> 'denied' then raise exception '% could update %', who, t; end if;
      got := pg_temp.as_actor(who, format('with x as (delete from %s returning 1) select count(*) from x', t));
      if got <> 'denied' then raise exception '% could delete from %', who, t; end if;
    end loop;
    foreach who in array array['fender', 'ledlenser', 'staff', 'anon'] loop
      got := pg_temp.as_actor(who, format(
        $q$with x as (insert into %s (asin, benchmark_cents, provider, query_type, status) values ('R15X', 100, 'test', 'title', 'failed') returning 1) select count(*) from x$q$, t));
      if got <> 'denied' then raise exception '% could insert into %', who, t; end if;
    end loop;
    got := pg_temp.as_actor('service', format(
      $q$with x as (insert into %s (asin, benchmark_cents, provider, query_type, status) values ('R15SVC', 100, 'test', 'title', 'failed') returning 1) select count(*) from x$q$, t));
    if got <> '1' then raise exception 'service_role could not insert into % (%)', t, got; end if;
    execute format('grant update, delete on %s to service_role', t);
    perform public.test_act_as('service_role');
    begin
      execute format('delete from %s', t);
      raise exception 'trigger let service_role delete from %', t;
    exception when insufficient_privilege then null;
    end;
    reset role;
    reset session authorization;
    execute format('revoke update, delete on %s from service_role', t);
  end loop;
  foreach t in array array['command.price_match_results', 'ledlenser_private.price_match_results'] loop
    if has_table_privilege('service_role', t, 'update,delete,truncate')
       or has_table_privilege('authenticated', t, 'insert,update,delete,truncate') then
      raise exception 'R-15 results writable: %', t;
    end if;
  end loop;
end $$;

-- 4. Grants are explicit and views run as the caller.
do $$
declare bad text;
begin
  select string_agg(c.oid::regclass::text, ', ') into bad
  from pg_class c
  where c.oid in ('command.price_match_checks'::regclass, 'command.price_match_results'::regclass,
                  'ledlenser_private.price_match_checks'::regclass, 'ledlenser_private.price_match_results'::regclass,
                  'public.canvas_price_match_checks'::regclass, 'public.canvas_price_matches'::regclass,
                  'ledlenser.canvas_price_match_checks'::regclass, 'ledlenser.canvas_price_matches'::regclass)
    and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate')
         or exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where a.grantee = 0)
         or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate')
         or (c.relkind = 'v' and has_table_privilege('service_role', c.oid, 'insert,update,delete,truncate'))
         or (c.relkind = 'r' and not c.relrowsecurity)
         or (c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false)));
  if bad is not null then raise exception 'R-15 grants: %', bad; end if;
end $$;

-- 5. Ignore: a Fender member sets a listing aside on price_match with the new reason, and reopens it,
--    through the existing functions. A Ledlenser member cannot set aside a Fender listing.
do $$
declare got text; sid uuid;
begin
  if not exists (select 1 from public.set_aside_checks where check_key = 'price_match' and entity_type = 'asin')
     or not exists (select 1 from public.set_aside_reasons where reason_code = 'keep_amazon_price' and check_keys = array['price_match']) then
    raise exception 'price_match check or keep_amazon_price reason missing';
  end if;
  got := pg_temp.as_actor('fender', $q$select status from public.set_aside_issue('fmic', 'price_match', 'B0D2LP2PRQ', 'keep_amazon_price', 'Test Person')$q$);
  if got is distinct from 'active' then raise exception 'Fender member could not ignore a price match (%)', got; end if;
  select id into sid from public.issue_set_asides where client_key = 'fmic' and check_key = 'price_match' and entity_key = 'B0D2LP2PRQ';
  got := pg_temp.as_actor('fender', format($q$select status from public.reopen_set_aside(%L, 'Test Person')$q$, sid));
  if got is distinct from 'reopened' then raise exception 'Fender member could not restore a price match (%)', got; end if;
  begin
    got := pg_temp.as_actor('ledlenser', $q$select status from public.set_aside_issue('fmic', 'price_match', 'B0D2LP4QFF', 'keep_amazon_price', 'Test Person')$q$);
  exception when others then got := 'refused';
  end;
  if got in ('active') then raise exception 'Ledlenser member set aside a Fender listing'; end if;
end $$;
