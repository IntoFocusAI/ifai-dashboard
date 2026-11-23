-- R-15 (a) (20261123210000): the seller holding a withheld Amazon offer, per client.
-- Same columns and view name for every client. Staff read both; each member only their client;
-- a signed-in user with no org nothing; anon is refused. Names follow the ids in order, NULL when
-- the sellers table has no name.
\set ON_ERROR_STOP 1

create function pg_temp.as_actor(p_who text, p_sql text) returns text language plpgsql as $$
declare v text;
begin
  case p_who
    when 'anon' then perform public.test_act_as('anon');
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

-- Made-up rows (as owner): one withheld listing per client, Fender with two sellers tied at the
-- lowest landed price (one named, one not), Ledlenser with one named seller; and one listing per
-- client never read, which the view leaves out.
insert into command.fmic_electric_catalog (asin, withheld_offer_seller_ids, withheld_offer_landed_cents, withheld_offer_checked_at)
values ('WOSFENDER1', array['ASELLERNAMED', 'ASELLERNONAME'], 86239, now()), ('WOSFENDER2', null, null, null);
insert into command.fmic_sellers (seller_id, seller_name, updated_at) values ('ASELLERNAMED', 'Test Music Store', now());
insert into command.fmic_retail_buybox_map
  (id, asin, model_name, offer_price, reviews_count, buybox_status, featured_offer_state, featured_offer_observed_price_cents, created_at, updated_at)
values (gen_random_uuid(), 'WOSFENDER1', 'Test Jazzmaster', 862.39, 0, '3P Confirmed', 'withheld', 86239, now(), now());

insert into ledlenser.catalog (asin, withheld_offer_seller_ids, withheld_offer_landed_cents, withheld_offer_checked_at)
values ('WOSLEDLEN1', array['ALEDSELLER'], 11995, now()), ('WOSLEDLEN2', null, null, null);
insert into ledlenser.sellers (seller_id, seller_name, updated_at) values ('ALEDSELLER', 'Test Outdoor', now());

-- 1. Who reads what.
do $$
declare rel text; who text; got text; owner_n text; errors text[] := '{}';
begin
  foreach rel in array array['public.canvas_withheld_offer_sellers', 'ledlenser.canvas_withheld_offer_sellers'] loop
    execute format('select count(*) from %s', rel) into owner_n;
    if owner_n = '0' then errors := errors || format('%s: no rows to test', rel); end if;
    foreach who in array array['anon', 'fender', 'ledlenser', 'staff', 'none'] loop
      got := pg_temp.as_actor(who, format('select count(*) from %s', rel));
      if who = 'anon' and got <> 'denied' then
        errors := errors || format('%s: anon got %s', rel, got);
      elsif who = 'staff' and got <> owner_n then
        errors := errors || format('%s: staff got %s of %s', rel, got, owner_n);
      elsif (who = 'fender' and rel like 'public.%') or (who = 'ledlenser' and rel like 'ledlenser.%') then
        if got <> owner_n then errors := errors || format('%s: %s member got %s of %s', rel, who, got, owner_n); end if;
      elsif who in ('fender', 'ledlenser', 'none') and got <> '0' then
        errors := errors || format('%s: %s got %s rows of another client', rel, who, got);
      end if;
    end loop;
  end loop;
  if array_length(errors, 1) > 0 then
    raise exception E'withheld offer seller access:\n%', array_to_string(errors, E'\n');
  end if;
end $$;

-- 2. Rows: only read listings; names follow ids; today's Featured Offer state rides along.
do $$
declare r record;
begin
  if exists (select 1 from public.canvas_withheld_offer_sellers where asin = 'WOSFENDER2')
     or exists (select 1 from ledlenser.canvas_withheld_offer_sellers where asin = 'WOSLEDLEN2') then
    raise exception 'a listing never read shows in the view';
  end if;
  select * into r from public.canvas_withheld_offer_sellers where asin = 'WOSFENDER1';
  if r.seller_ids <> array['ASELLERNAMED', 'ASELLERNONAME'] or r.seller_names is distinct from array['Test Music Store', null]
     or r.landed_cents <> 86239 or r.featured_offer_state <> 'withheld' or r.featured_offer_observed_price_cents <> 86239 then
    raise exception 'public.canvas_withheld_offer_sellers: %', row_to_json(r);
  end if;
  select * into r from ledlenser.canvas_withheld_offer_sellers where asin = 'WOSLEDLEN1';
  if r.seller_names <> array['Test Outdoor'] or r.featured_offer_state is not null then
    raise exception 'ledlenser.canvas_withheld_offer_sellers: %', row_to_json(r);
  end if;
end $$;

-- 3. Grants are explicit and the views run as the caller.
do $$
declare bad text;
begin
  select string_agg(c.oid::regclass::text, ', ') into bad
  from pg_class c
  where c.oid in ('public.canvas_withheld_offer_sellers'::regclass, 'ledlenser.canvas_withheld_offer_sellers'::regclass)
    and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate')
         or exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where a.grantee = 0)
         or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate')
         or has_table_privilege('service_role', c.oid, 'insert,update,delete,truncate')
         or not coalesce(c.reloptions @> array['security_invoker=true'], false));
  if bad is not null then raise exception 'withheld offer seller grants: %', bad; end if;
end $$;
