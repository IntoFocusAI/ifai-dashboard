-- Copy the `sandbox` schema from the SANDBOX project (ltkotsvnkslewecaicvv) to production.
-- Generated from a schema-only pg_dump of the sandbox on 2026-10-27, so it matches what is live there
-- (the original step-by-step files are supabase/sandbox-migrations/ on the dashboard-v2 branch).
-- Grants and RLS policies are kept as in the sandbox: anon and authenticated may read, nobody may write
-- through the API. dashboard-v2 reads this schema with a publishable key.
-- service_role is added so Toolbelt jobs can maintain it.

SET check_function_bodies = false;

CREATE SCHEMA sandbox;

COMMENT ON SCHEMA sandbox IS 'Dashboard v2 model (see docs/v2 on branch dashboard-v2).';

CREATE FUNCTION sandbox.refresh_metric_values(p_client_id text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
declare
  v_now timestamptz := now();
  v_r1 uuid;   -- latest catalog harvest run (offer status, bundles, categories)
  v_r2 uuid;   -- latest seller read run
  v_r3 uuid;   -- latest Featured Offer and benchmark run
  v_spec uuid; -- latest spec check run
  v_ai uuid;   -- latest AI battery run
  v_inserted integer := 0;
  v_n integer;
begin
  select reading_run_id into v_r1 from sandbox.reading_run
   where client_id = p_client_id and source = 'keepa_product' and workflow_name = 'fender_catalog_harvester'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_r2 from sandbox.reading_run
   where client_id = p_client_id and source = 'keepa_seller'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_r3 from sandbox.reading_run
   where client_id = p_client_id and source = 'keepa_product' and workflow_name = 'fender_omnichannel_audit_sync'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_spec from sandbox.reading_run
   where client_id = p_client_id and source = 'spec_check'
   order by finished_at desc nulls last, started_at desc limit 1;
  select reading_run_id into v_ai from sandbox.reading_run
   where client_id = p_client_id and source = 'ai_battery'
   order by finished_at desc nulls last, started_at desc limit 1;

  delete from sandbox.metric_value where client_id = p_client_id;

  -- catalog_monitored: all listings, plus the active count as dimension offer_status = active
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':catalog_monitored', p_client_id, p_client_id || ':catalog_monitored', v_r1, v_now, null::text, null::text, count(*), null::integer, null::integer
    from sandbox.v_listing_current where client_id = p_client_id
  union all
  select p_client_id || ':catalog_monitored:offer_status=active', p_client_id, p_client_id || ':catalog_monitored', v_r1, v_now, 'offer_status', 'active', count(*) filter (where offer_status = 'active'), null::integer, null::integer
    from sandbox.v_listing_current where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- amazon_offer_share: Amazon Retail holds the Featured Offer / active listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':amazon_offer_share', p_client_id, p_client_id || ':amazon_offer_share', v_r2, v_now, null, null,
         round(100.0 * count(*) filter (where seller_class = 'amazon_retail') / nullif(count(*), 0), 2),
         count(*) filter (where seller_class = 'amazon_retail'), count(*)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- seller_mix: active listings per seller class (no seller row at all counts as not_read)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':seller_mix:seller_class=' || coalesce(seller_class, 'not_read'), p_client_id, p_client_id || ':seller_mix', v_r2, v_now, 'seller_class', coalesce(seller_class, 'not_read'), count(*), null, null
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active'
   group by coalesce(seller_class, 'not_read');
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- seller_read_coverage: active listings with a seller class other than not_read / active listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':seller_read_coverage', p_client_id, p_client_id || ':seller_read_coverage', v_r2, v_now, null, null,
         round(100.0 * count(*) filter (where seller_class in ('amazon_retail', 'third_party', 'no_offer')) / nullif(count(*), 0), 2),
         count(*) filter (where seller_class in ('amazon_retail', 'third_party', 'no_offer')), count(*)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- featured_offer_present: withheld = false over listings whose latest benchmark row read the flag
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':featured_offer_present', p_client_id, p_client_id || ':featured_offer_present', v_r3, v_now, null, null,
         count(*) filter (where featured_offer_withheld = false),
         count(*) filter (where featured_offer_withheld = false), count(*) filter (where featured_offer_withheld is not null)
    from sandbox.v_listing_current where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- featured_offer_suppressed: withheld and offer cents above benchmark cents; denominator = active listings with a benchmark
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':featured_offer_suppressed', p_client_id, p_client_id || ':featured_offer_suppressed', v_r3, v_now, null, null,
         count(*) filter (where suppressed),
         count(*) filter (where suppressed), count(*) filter (where competitive_external_price_cents is not null)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- price_gap_above_benchmark: dollars above the benchmark summed over the suppressed listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':price_gap_above_benchmark', p_client_id, p_client_id || ':price_gap_above_benchmark', v_r3, v_now, null, null,
         coalesce(sum((offer_price_cents - competitive_external_price_cents) / 100.0), 0), count(*), null
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active' and suppressed;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- channel_price_coverage: per channel, priced over checked, from the latest channel row per listing
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  with latest as (
    select distinct on (p.listing_id, p.channel) p.listing_id, p.channel, p.match_status, p.reading_run_id, p.read_at
      from sandbox.listing_channel_price p
     where p.client_id = p_client_id
     order by p.listing_id, p.channel, p.read_at desc, p.reading_run_id desc
  )
  select p_client_id || ':channel_price_coverage:channel=' || channel, p_client_id, p_client_id || ':channel_price_coverage',
         (array_agg(reading_run_id order by read_at desc))[1], v_now, 'channel', channel,
         count(*) filter (where match_status = 'priced'),
         count(*) filter (where match_status = 'priced'), count(*)
    from latest group by channel;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- bundle_share: bundles among active listings
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':bundle_share', p_client_id, p_client_id || ':bundle_share', v_r1, v_now, null, null,
         round(100.0 * count(*) filter (where is_bundle) / nullif(count(*), 0), 2),
         count(*) filter (where is_bundle), count(*)
    from sandbox.v_listing_current where client_id = p_client_id and offer_status = 'active';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- spec_fender_page_found: brand page found over listings checked (latest spec row per listing)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':spec_fender_page_found', p_client_id, p_client_id || ':spec_fender_page_found', v_spec, v_now, null, null,
         round(100.0 * count(*) filter (where brand_site_page_found) / nullif(count(*), 0), 2),
         count(*) filter (where brand_site_page_found), count(*)
    from sandbox.v_spec_current where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- spec_additional_property_missing: found pages without additionalProperty over found pages
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':spec_additional_property_missing', p_client_id, p_client_id || ':spec_additional_property_missing', v_spec, v_now, null, null,
         count(*) filter (where additional_property_present = false),
         count(*) filter (where additional_property_present = false), count(*)
    from sandbox.v_spec_current where client_id = p_client_id and brand_site_page_found;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- spec_amazon_completeness: average of found / expected over Amazon-checked listings (numerator and denominator are field totals)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':spec_amazon_completeness', p_client_id, p_client_id || ':spec_amazon_completeness', v_spec, v_now, null, null,
         round(avg(amazon_fields_found * 100.0 / amazon_fields_expected), 2),
         sum(amazon_fields_found), sum(amazon_fields_expected)
    from sandbox.v_spec_current where client_id = p_client_id and amazon_checked and amazon_fields_expected > 0;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_answer_share: client brand wins over resolved answers, all runs
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_answer_share', p_client_id, p_client_id || ':ai_answer_share', v_ai, v_now, null, null,
         round(100.0 * count(*) filter (where client_brand_won) / nullif(count(*), 0), 2),
         count(*) filter (where client_brand_won), count(*)
    from sandbox.v_ai_answer_detail where client_id = p_client_id and outcome = 'resolved';
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_answer_share_by_category: per category (prompts naming a client product excluded; fewer than 10 resolved excluded),
  -- plus the top rival per category as dimension category_top_rival = '<category>:<brand>'
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  with r as (
    select category, winner_brand_name, client_brand_won
      from sandbox.v_ai_answer_detail
     where client_id = p_client_id and outcome = 'resolved' and not names_client_product
  ), c as (
    select category, count(*) as resolved, count(*) filter (where client_brand_won) as wins
      from r group by category having count(*) >= 10
  ), rival as (
    select distinct on (r.category) r.category, r.winner_brand_name, count(*) as rival_wins
      from r join c using (category)
     where not r.client_brand_won
     group by r.category, r.winner_brand_name
     order by r.category, count(*) desc, r.winner_brand_name
  )
  select p_client_id || ':ai_answer_share_by_category:category=' || c.category, p_client_id, p_client_id || ':ai_answer_share_by_category', v_ai, v_now, 'category', c.category,
         round(100.0 * c.wins / c.resolved, 2), c.wins, c.resolved
    from c
  union all
  select p_client_id || ':ai_answer_share_by_category:category_top_rival=' || rival.category || ':' || rival.winner_brand_name, p_client_id, p_client_id || ':ai_answer_share_by_category', v_ai, v_now, 'category_top_rival', rival.category || ':' || rival.winner_brand_name,
         round(100.0 * rival.rival_wins / c.resolved, 2), rival.rival_wins, c.resolved
    from rival join c using (category);
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_wrong_spec_flags: flagged answers (numerator) over all answers (denominator)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_wrong_spec_flags', p_client_id, p_client_id || ':ai_wrong_spec_flags', v_ai, v_now, null, null,
         count(*) filter (where wrong_spec_flag), count(*) filter (where wrong_spec_flag), count(*)
    from sandbox.v_ai_answer_detail where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_answer_share_by_engine: per stored engine (unknown excluded)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_answer_share_by_engine:engine=' || engine, p_client_id, p_client_id || ':ai_answer_share_by_engine', v_ai, v_now, 'engine', engine,
         round(100.0 * count(*) filter (where client_brand_won) / nullif(count(*), 0), 2),
         count(*) filter (where client_brand_won), count(*)
    from sandbox.v_ai_answer_detail where client_id = p_client_id and outcome = 'resolved' and engine <> 'unknown'
   group by engine;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- ai_battery_freshness and reading_freshness: epoch seconds of the latest finished_at per source
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':ai_battery_freshness:source=' || f.source, p_client_id, p_client_id || ':ai_battery_freshness', f.reading_run_id, v_now, 'source', f.source,
         extract(epoch from f.finished_at), null::integer, null::integer
    from sandbox.v_reading_freshness f where f.client_id = p_client_id and f.source = 'ai_battery' and f.finished_at is not null
  union all
  select p_client_id || ':reading_freshness:source=' || f.source, p_client_id, p_client_id || ':reading_freshness', f.reading_run_id, v_now, 'source', f.source,
         extract(epoch from f.finished_at), null::integer, null::integer
    from sandbox.v_reading_freshness f where f.client_id = p_client_id and f.finished_at is not null;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- action_items_open: stored actions not done (no reading run behind it)
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':action_items_open', p_client_id, p_client_id || ':action_items_open', null, v_now, null, null,
         count(*) filter (where status <> 'done'), count(*) filter (where status <> 'done'), count(*)
    from sandbox.action_item where client_id = p_client_id;
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  -- catalog_by_category: listings per retailer category
  insert into sandbox.metric_value (metric_value_id, client_id, registry_key, reading_run_id, computed_at, dimension_name, dimension_value, numeric_value, numerator, denominator)
  select p_client_id || ':catalog_by_category:category=' || coalesce(category, 'uncategorized'), p_client_id, p_client_id || ':catalog_by_category', v_r1, v_now, 'category', coalesce(category, 'uncategorized'), count(*), null, null
    from sandbox.v_listing_current where client_id = p_client_id
   group by coalesce(category, 'uncategorized');
  get diagnostics v_n = row_count; v_inserted := v_inserted + v_n;

  return v_inserted;
end;
$$;

COMMENT ON FUNCTION sandbox.refresh_metric_values(p_client_id text) IS 'Deletes and recomputes sandbox.metric_value for one client from the latest reading rows. Returns the number of rows written. Writes no row for metrics whose inputs do not exist yet (retail_control_partner_led, map_below, ecommerce_to_ai_link, estimate_*).';

CREATE FUNCTION sandbox.reload_readings(p_client_id text DEFAULT 'cl_fender'::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $_$
declare
  v_as_of timestamptz := now();
  v_stamp text := to_char(now() at time zone 'UTC', 'YYYYMMDD"T"HH24MI');
  v_metrics integer;
begin
  if p_client_id <> 'cl_fender' then
    raise exception 'reload_readings maps the Fender command.fmic_* tables only; got client %', p_client_id;
  end if;

  -- 1. clear derived rows (children first)
  delete from sandbox.metric_value where client_id = p_client_id;
  delete from sandbox.ai_answer where client_id = p_client_id;
  delete from sandbox.ai_prompt where client_id = p_client_id;
  delete from sandbox.spec_reading where client_id = p_client_id;
  delete from sandbox.listing_channel_price where client_id = p_client_id;
  delete from sandbox.listing_offer_reading where client_id = p_client_id;
  delete from sandbox.reading_run where client_id = p_client_id;

  -- 2. seller (upsert)
  insert into sandbox.seller (seller_id, marketplace, seller_name, is_amazon_retail, ships_with_amazon, rating_pct, rating_count, first_seen_at, updated_at)
  select s.seller_id, 'amazon', s.seller_name, coalesce(s.is_amazon, false), s.is_fba, s.rating_pct, s.rating_count, s.first_seen, s.updated_at
  from command.fmic_sellers s
  union all
  select distinct c.buybox_seller, 'amazon', null::text, (c.buybox_seller = 'ATVPDKIKX0DER'), null::boolean, null::integer, null::integer, null::timestamptz, null::timestamptz
  from command.fmic_electric_catalog c
  where c.buybox_seller is not null
    and not exists (select 1 from command.fmic_sellers s where s.seller_id = c.buybox_seller)
  on conflict (seller_id) do update set
    seller_name = coalesce(excluded.seller_name, sandbox.seller.seller_name),
    is_amazon_retail = excluded.is_amazon_retail,
    ships_with_amazon = coalesce(excluded.ships_with_amazon, sandbox.seller.ships_with_amazon),
    rating_pct = coalesce(excluded.rating_pct, sandbox.seller.rating_pct),
    rating_count = coalesce(excluded.rating_count, sandbox.seller.rating_count),
    updated_at = coalesce(excluded.updated_at, sandbox.seller.updated_at);

  -- 3. listing (upsert; parent link set in a second pass so a new parent row exists first)
  insert into sandbox.listing (listing_id, client_id, retailer, asin, parent_listing_id, parent_asin, title, brand, manufacturer, model_number, upc, ean, color, category, is_bundle, bundle_name, url, amazon_list_price, first_seen_at, last_harvested_at, updated_at)
  select 'lst_' || c.asin, p_client_id, 'amazon', c.asin, null, c.parent_asin, c.title, c.brand, c.manufacturer, c.model_number, c.upc, c.ean, c.color, c.category,
         coalesce(c.is_bundle, false), m.bundle_name, c.product_url, c.list_price, c.created_at, c.extracted_at, c.updated_at
  from command.fmic_electric_catalog c
  left join command.fmic_retail_buybox_map m on m.asin = c.asin
  on conflict (listing_id) do update set
    parent_asin = excluded.parent_asin, title = excluded.title, brand = excluded.brand, manufacturer = excluded.manufacturer,
    model_number = excluded.model_number, upc = excluded.upc, ean = excluded.ean, color = excluded.color, category = excluded.category,
    is_bundle = excluded.is_bundle, bundle_name = excluded.bundle_name, url = excluded.url, amazon_list_price = excluded.amazon_list_price,
    last_harvested_at = excluded.last_harvested_at, updated_at = excluded.updated_at;

  update sandbox.listing l
     set parent_listing_id = case when exists (select 1 from sandbox.listing p where p.listing_id = 'lst_' || l.parent_asin) then 'lst_' || l.parent_asin end
   where l.client_id = p_client_id
     and l.parent_listing_id is distinct from case when exists (select 1 from sandbox.listing p where p.listing_id = 'lst_' || l.parent_asin) then 'lst_' || l.parent_asin end;

  -- 4. reading runs (fixed ids R1 to R6 as in 0003; workflow_execution_id carries the reload stamp; trigger scheduled)
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000001', p_client_id, 'keepa_product', 'fender_catalog_harvester', 'reload_keepa_product_' || v_stamp, 'backfill',
         min(c.created_at), max(c.updated_at), 'complete', count(*), count(*), 'catalog_harvester',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_electric_catalog',
                            'population', count(*), 'rows_read', count(*),
                            'active_listings', count(*) filter (where c.current_price is not null),
                            'source_max_write', max(c.updated_at))
  from command.fmic_electric_catalog c;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000002', p_client_id, 'keepa_seller', 'fender_buybox_seller_harvester', 'reload_keepa_seller_' || v_stamp, 'backfill',
         coalesce(min(c.buybox_checked_at) filter (where c.current_price is not null), min(c.created_at)), max(c.buybox_checked_at),
         case when count(*) filter (where c.current_price is not null and c.buybox_seller is null) = 0 then 'complete' else 'partial' end,
         count(*) filter (where c.current_price is not null),
         count(*) filter (where c.current_price is not null and c.buybox_seller is not null),
         'buybox_seller_harvester',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_electric_catalog',
                            'population', count(*) filter (where c.current_price is not null),
                            'rows_read', count(*) filter (where c.current_price is not null and c.buybox_seller is not null),
                            'not_read', count(*) filter (where c.current_price is not null and c.buybox_seller is null),
                            'source_max_write', max(c.buybox_checked_at))
  from command.fmic_electric_catalog c;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, findings_count, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000003', p_client_id, 'keepa_product', 'fender_omnichannel_audit_sync', 'reload_keepa_product_benchmark_' || v_stamp, 'backfill',
         (select min(created_at) from command.fmic_retail_buybox_map),
         k.finished_at, 'partial',
         (select count(*) from command.fmic_electric_catalog where current_price is not null),
         (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price is not null and m.competitive_price_threshold_cents > 0),
         (select count(*) from command.fmic_retail_buybox_map m where m.featured_offer_withheld and m.competitive_price_threshold_cents > 0 and round(m.offer_price * 100) > m.competitive_price_threshold_cents),
         k.audit_run_id::text,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_retail_buybox_map',
                            'population', (select count(*) from command.fmic_electric_catalog where current_price is not null),
                            'rows_read', (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price is not null and m.competitive_price_threshold_cents > 0),
                            'map_rows', (select count(*) from command.fmic_retail_buybox_map),
                            'withheld_read', (select count(*) from command.fmic_retail_buybox_map where featured_offer_withheld is not null),
                            'benchmark_rows', (select count(*) from command.fmic_retail_buybox_map where competitive_price_threshold_cents > 0),
                            'latest_audit_run_id', k.audit_run_id,
                            'source_max_write', (select max(updated_at) from command.fmic_retail_buybox_map))
  from (select audit_run_id, created_at as finished_at from command.fmic_brand_kpi_summary order by created_at desc limit 1) k;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, cursor_end, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000004', p_client_id, 'walmart_price', 'fender_retail_buybox_map_audit', 'reload_walmart_price_' || v_stamp, 'backfill',
         coalesce(min(m.wmt_checked_at), min(m.created_at)), j.last_run_at,
         case when count(*) filter (where m.wmt_checked_at is null) = 0 then 'complete' else 'partial' end,
         count(*), count(*) filter (where m.wmt_checked_at is not null), j.cursor_offset, 'map_leakage_walmart',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_retail_buybox_map',
                            'population', count(*), 'rows_read', count(*) filter (where m.wmt_checked_at is not null),
                            'priced', count(*) filter (where m.wmt_price > 0),
                            'job_state_extra', j.extra, 'source_max_write', max(m.wmt_checked_at))
  from command.fmic_retail_buybox_map m
  cross join (select last_run_at, cursor_offset, extra from command.fmic_job_state where job_key = 'map_leakage_walmart') j
  group by j.last_run_at, j.cursor_offset, j.extra;

  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, cursor_end, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000005', p_client_id, 'musiciansfriend_price', 'fender_map_checker_musiciansfriend', 'reload_musiciansfriend_price_' || v_stamp, 'backfill',
         coalesce((select min(mf_checked_at) from command.fmic_retail_buybox_map), (select min(created_at) from command.fmic_retail_buybox_map)),
         j.last_run_at, 'partial',
         (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price >= 100 and not coalesce(c.is_bundle, false)),
         (select count(*) from command.fmic_retail_buybox_map where mf_checked_at is not null),
         j.cursor_offset, 'map_parity_musiciansfriend',
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_retail_buybox_map',
                            'population', (select count(*) from command.fmic_retail_buybox_map m join command.fmic_electric_catalog c on c.asin = m.asin where c.current_price >= 100 and not coalesce(c.is_bundle, false)),
                            'population_rule', 'map rows joined to catalog with current_price >= 100 and not bundle',
                            'rows_read', (select count(*) from command.fmic_retail_buybox_map where mf_checked_at is not null),
                            'priced', (select count(*) from command.fmic_retail_buybox_map where mf_price > 0),
                            'job_state_extra', j.extra, 'source_max_write', (select max(mf_checked_at) from command.fmic_retail_buybox_map))
  from (select last_run_at, cursor_offset, extra from command.fmic_job_state where job_key = 'map_parity_musiciansfriend') j;

  -- R6: population rule from the 2026-10-13 refresh (distinct SKUs the audit has checked); the 0003 rule
  -- (catalog rows with a seller) understated it once the audit checked more SKUs than that.
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, cursor_end, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000006', p_client_id, 'spec_check', 'fender_spec_readiness_audit', 'reload_spec_check_' || v_stamp, 'backfill',
         (select min(coalesce(checked_at, created_at)) from command.fmic_spec_readiness),
         (select max(checked_at) from command.fmic_spec_readiness), 'complete',
         x.n, x.n, j.cursor_offset,
         (select batch_run_id from command.fmic_spec_readiness order by checked_at desc nulls last limit 1),
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_spec_readiness',
                            'population', x.n,
                            'population_rule', 'distinct catalog SKUs the spec audit has checked',
                            'rows_read', x.n,
                            'source_rows', (select count(*) from command.fmic_spec_readiness),
                            'source_rows_skipped_not_in_catalog', (select count(*) from command.fmic_spec_readiness s where not exists (select 1 from command.fmic_electric_catalog c where c.asin = s.asin)),
                            'job_state_extra', j.extra, 'source_max_write', (select max(checked_at) from command.fmic_spec_readiness))
  from (select count(distinct s.asin) as n from command.fmic_spec_readiness s where exists (select 1 from command.fmic_electric_catalog c where c.asin = s.asin)) x
  cross join (select cursor_offset, extra from command.fmic_job_state where job_key = 'spec_readiness') j;

  -- AI battery runs: original audit run uuids
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, findings_count, legacy_run_key, detail)
  select r.id, p_client_id, 'ai_battery', coalesce(r.metadata->>'source', 'fender_ai_simulation_battery_real'),
         coalesce(r.workflow_execution_id, 'legacy_audit_run_' || r.id::text), 'manual',
         r.started_at, r.completed_at, 'complete', coalesce(s.n, 0), coalesce(s.n, 0), s.flags, r.id::text,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.fmic_audit_runs',
                            'legacy_trigger_type', r.trigger_type, 'legacy_status', r.status,
                            'asins_audited', r.asins_audited, 'violations_detected', r.violations_detected,
                            'answers', coalesce(s.n, 0), 'workflow_execution_id_was_null', (r.workflow_execution_id is null),
                            'metadata', r.metadata)
  from command.fmic_audit_runs r
  left join (select audit_run_id, count(*) as n, count(*) filter (where hallucination_flag) as flags from canvas_private.sims_all group by audit_run_id) s on s.audit_run_id = r.id
  where r.metadata->>'source' = 'fender_ai_simulation_battery_real' or s.n is not null;

  -- R7: answers whose audit_run_id has no fmic_audit_runs row (only when such rows exist)
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select 'a0000000-0000-4000-8000-000000000007', p_client_id, 'ai_battery', 'fender_ai_simulation_battery_real', 'reload_ai_battery_' || v_stamp, 'backfill',
         min(s.created_at), max(s.created_at), 'partial', count(*), count(*), null,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'canvas_private.sims_all',
                            'population', count(*), 'rows_read', count(*), 'note', 'answers whose audit_run_id has no fmic_audit_runs row')
  from canvas_private.sims_all s
  where not exists (select 1 from command.fmic_audit_runs r where r.id = s.audit_run_id)
  having count(*) > 0;

  -- R8 / R9: legacy command.listing_channel_price rows (only when rows exist)
  insert into sandbox.reading_run (reading_run_id, client_id, source, workflow_name, workflow_execution_id, trigger_type, started_at, finished_at, status, population_count, rows_read, legacy_run_key, detail)
  select case l.channel when 'sweetwater' then 'a0000000-0000-4000-8000-000000000008'::uuid else 'a0000000-0000-4000-8000-000000000009'::uuid end,
         p_client_id, l.channel || '_price', 'legacy_listing_channel_price', 'reload_' || l.channel || '_price_' || v_stamp, 'backfill',
         min(l.checked_at), max(l.checked_at), 'partial', count(*), count(*), null,
         jsonb_build_object('as_of', v_as_of, 'source_table', 'command.listing_channel_price', 'population', count(*), 'rows_read', count(*))
  from command.listing_channel_price l
  where l.channel in ('sweetwater', 'reverb')
  group by l.channel
  having count(*) > 0;

  -- 5. listing_offer_reading (R1, R2, R3)
  insert into sandbox.listing_offer_reading (listing_offer_reading_id, client_id, listing_id, reading_run_id, read_at, offer_status, listed_price, sales_rank, monthly_sold, offer_count_new, amazon_stock)
  select 'lor_' || c.asin || '_r1', p_client_id, 'lst_' || c.asin, 'a0000000-0000-4000-8000-000000000001',
         coalesce(c.extracted_at, c.updated_at),
         case when c.current_price is not null then 'active' else 'no_active_offer' end,
         c.current_price, c.sales_rank, c.monthly_sold, c.offer_count_new, c.amazon_stock
  from command.fmic_electric_catalog c;

  insert into sandbox.listing_offer_reading (listing_offer_reading_id, client_id, listing_id, reading_run_id, read_at, offer_status, featured_offer_seller_id, seller_class, seller_ships_with_amazon)
  select 'lor_' || c.asin || '_r2', p_client_id, 'lst_' || c.asin, 'a0000000-0000-4000-8000-000000000002',
         coalesce(c.buybox_checked_at, r.finished_at, v_as_of), 'active',
         c.buybox_seller,
         case when c.buybox_seller = 'ATVPDKIKX0DER' then 'amazon_retail'
              when c.buybox_seller is not null then 'third_party'
              else 'not_read' end,
         c.buybox_is_fba
  from command.fmic_electric_catalog c
  cross join (select finished_at from sandbox.reading_run where reading_run_id = 'a0000000-0000-4000-8000-000000000002') r
  where c.current_price is not null;

  -- R3 rows: only map rows whose listing exists (a map row for an ASIN outside the catalog is skipped)
  insert into sandbox.listing_offer_reading (listing_offer_reading_id, client_id, listing_id, reading_run_id, read_at, offer_status, featured_offer_withheld, offer_price, competitive_external_price_cents, legacy_status)
  select 'lor_' || m.asin || '_r3', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000003',
         m.updated_at,
         case when m.buybox_status = 'No Active Offer' then 'no_active_offer' else 'active' end,
         m.featured_offer_withheld, m.offer_price,
         case when m.competitive_price_threshold_cents > 0 then m.competitive_price_threshold_cents end,
         m.buybox_status
  from command.fmic_retail_buybox_map m
  where exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || m.asin);

  -- 6. listing_channel_price
  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at, store_title, store_seller_name, match_confidence)
  select 'lcp_' || m.asin || '_walmart', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000004',
         m.wmt_checked_at, 'walmart',
         case when m.wmt_price > 0 then 'priced' else 'no_match' end,
         case when m.wmt_price > 0 then m.wmt_price end,
         m.wmt_url, m.wmt_checked_at, m.wmt_title, m.wmt_seller, m.wmt_match_conf
  from command.fmic_retail_buybox_map m
  where m.wmt_checked_at is not null
    and exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || m.asin);

  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at, store_title, store_msrp)
  select 'lcp_' || m.asin || '_musiciansfriend', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000005',
         m.mf_checked_at, 'musiciansfriend',
         case when m.mf_price > 0 then 'priced' else 'no_match' end,
         case when m.mf_price > 0 then m.mf_price end,
         null, m.mf_checked_at, m.mf_title, m.mf_msrp
  from command.fmic_retail_buybox_map m
  where m.mf_checked_at is not null
    and exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || m.asin);

  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at, store_title, store_seller_name)
  select 'lcp_' || m.asin || '_amazon', p_client_id, 'lst_' || m.asin, 'a0000000-0000-4000-8000-000000000003',
         m.updated_at, 'amazon', 'priced', m.offer_price, c.product_url, m.updated_at, c.title, s.seller_name
  from command.fmic_retail_buybox_map m
  join command.fmic_electric_catalog c on c.asin = m.asin
  left join command.fmic_sellers s on s.seller_id = c.buybox_seller
  where m.offer_price is not null;

  insert into sandbox.listing_channel_price (listing_channel_price_id, client_id, listing_id, reading_run_id, read_at, channel, match_status, price, url, checked_at)
  select 'lcp_' || l.asin || '_' || l.channel || '_legacy', p_client_id, 'lst_' || l.asin, r.reading_run_id,
         l.checked_at, l.channel,
         case when l.price > 0 then 'priced' else 'no_match' end,
         case when l.price > 0 then l.price end,
         l.url, l.checked_at
  from command.listing_channel_price l
  join sandbox.listing li on li.listing_id = 'lst_' || l.asin
  join sandbox.reading_run r on r.client_id = p_client_id and r.reading_run_id = case l.channel
         when 'amazon' then 'a0000000-0000-4000-8000-000000000003'::uuid
         when 'walmart' then 'a0000000-0000-4000-8000-000000000004'::uuid
         when 'musiciansfriend' then 'a0000000-0000-4000-8000-000000000005'::uuid
         when 'sweetwater' then 'a0000000-0000-4000-8000-000000000008'::uuid
         when 'reverb' then 'a0000000-0000-4000-8000-000000000009'::uuid end
  where l.channel in ('amazon', 'walmart', 'musiciansfriend', 'sweetwater', 'reverb')
  on conflict on constraint listing_channel_price_listing_id_channel_reading_run_id_key do nothing;

  -- 7. spec_reading: every check whose asin is in the catalog (history kept under R6)
  insert into sandbox.spec_reading (spec_reading_id, client_id, listing_id, reading_run_id, read_at, amazon_checked, amazon_fields_found, amazon_fields_expected, amazon_missing_fields, brand_site_page_found, brand_site_url, brand_site_fields_found, brand_site_fields_expected, brand_site_missing_fields, additional_property_present)
  select 'spr_' || s.id, p_client_id, 'lst_' || s.asin, 'a0000000-0000-4000-8000-000000000006',
         coalesce(s.checked_at, s.created_at),
         coalesce(s.amazon_checked, false), s.amazon_fields_found, s.amazon_fields_expected,
         string_to_array(nullif(s.amazon_missing_fields, ''), ';'),
         coalesce(s.fender_found, false), s.fender_url, s.fender_fields_found, s.fender_fields_expected,
         string_to_array(nullif(s.fender_missing_fields, ''), ';'),
         case when s.fender_found then not (coalesce(s.fender_missing_fields, '') ilike '%additionalProperty%') else null end
  from command.fmic_spec_readiness s
  where exists (select 1 from sandbox.listing l where l.listing_id = 'lst_' || s.asin)
  on conflict on constraint spec_reading_listing_id_reading_run_id_read_at_key do nothing;

  -- 8. ai_prompt and ai_answer
  insert into sandbox.ai_prompt (ai_prompt_id, client_id, category, prompt_text, names_client_product, is_active, legacy_sim_id)
  select distinct on (d.ptext) 'pr_' || lpad(d.pidx::text, 2, '0'), p_client_id, d.category, d.ptext, (d.category = 'hallucinations'), true, d.pidx::text
  from (select distinct ((sim_id % 1000) - 1) / 10 as pidx, category,
               regexp_replace(prompt, '\s*\[(chatgpt|perplexity|gemini)\]$', '') as ptext
        from canvas_private.sims_all) d
  order by d.ptext, d.pidx
  on conflict do nothing;

  insert into sandbox.ai_answer (ai_answer_id, client_id, ai_prompt_id, reading_run_id, read_at, answered_at, engine, repeat_no, outcome, winner_brand_id, wrong_spec_flag, wrong_spec_reason, answer_text, citations, citation_urls, remediation_note, legacy_source)
  select s.id::text, p_client_id,
         'pr_' || lpad((((s.sim_id % 1000) - 1) / 10)::text, 2, '0'),
         case when exists (select 1 from command.fmic_audit_runs r where r.id = s.audit_run_id) then s.audit_run_id
              else 'a0000000-0000-4000-8000-000000000007'::uuid end,
         s.created_at, s.created_at,
         coalesce(s.engine,
                  substring(s.prompt from '\[(chatgpt|perplexity|gemini)\]$'),
                  (array['chatgpt', 'perplexity', 'gemini'])[((s.sim_id % 1000) - 1) % 10 + 1],
                  'unknown'),
         coalesce(s.repeat_no, s.sim_id / 1000),
         case when s.winner is null or s.winner = 'Error' then 'error'
              when s.winner = 'Unclear' then 'unclear'
              else 'resolved' end,
         b.competitor_brand_id,
         coalesce(s.hallucination_flag, false), nullif(s.root_cause, ''),
         s.answer_text, l.citations,
         string_to_array(nullif(s.citation_urls, ''), ' | '),
         s.remediation_patch, s.source_table
  from canvas_private.sims_all s
  left join command.fmic_ai_simulations l on l.id = s.id and s.source_table = 'live'
  left join sandbox.competitor_brand b
         on b.client_id = p_client_id
        and s.winner is not null and s.winner not in ('Error', 'Unclear')
        and b.name = case when s.winner = 'Fender/Squier' then 'Fender' else s.winner end
  where exists (select 1 from sandbox.ai_prompt p where p.ai_prompt_id = 'pr_' || lpad((((s.sim_id % 1000) - 1) / 10)::text, 2, '0'));

  -- 9. action items (same generation rules as 0006)
  create temp table if not exists _reload_actions (like sandbox.action_item) on commit drop;
  truncate _reload_actions;
  insert into _reload_actions (action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at)
  select 'act_suppressed_' || v.asin, p_client_id, p_client_id || ':featured_offer_suppressed', v.benchmark_reading_id, v.listing_id,
         'Match the outside price or correct the outside listing for ' || v.asin, 'client', 'open', 'high', now(), now()
    from sandbox.v_listing_current v
   where v.client_id = p_client_id and v.offer_status = 'active' and v.suppressed
  union all
  select 'act_authorized_seller_list', p_client_id, p_client_id || ':retail_control_partner_led', null, null,
         'Supply the authorized-seller list', 'client', 'open', 'high', now(), now()
   where not exists (select 1 from sandbox.seller_authorization a where a.client_id = p_client_id)
  union all
  select 'act_map_sheet', p_client_id, p_client_id || ':map_below', null, null,
         'Supply the MAP sheet', 'client', 'open', 'medium', now(), now()
   where not exists (select 1 from sandbox.listing_map_price m where m.client_id = p_client_id)
  union all
  select 'act_additional_property', p_client_id, p_client_id || ':spec_additional_property_missing', null, null,
         'Add additionalProperty to ' || x.n || ' found fender.com pages', 'intofocus', 'open', 'medium', now(), now()
    from (select count(*) as n from sandbox.v_spec_current
           where client_id = p_client_id and brand_site_page_found and additional_property_present = false) x
   where x.n > 0
  union all
  select 'act_seller_read', p_client_id, p_client_id || ':seller_read_coverage', null, null,
         'Finish the seller read for ' || x.n || ' active offers', 'intofocus', 'open', 'medium', now(), now()
    from (select count(*) as n from sandbox.v_listing_current
           where client_id = p_client_id and offer_status = 'active' and coalesce(seller_class, 'not_read') = 'not_read') x
   where x.n > 0
  union all
  select 'act_phase1_inputs', p_client_id, p_client_id || ':estimate_phase1_uplift', null, null,
         'Supply the Phase 1 uplift inputs (COO)', 'intofocus', 'open', 'medium', now(), now()
   where not exists (select 1 from sandbox.estimate_input i where i.estimate_id = 'est_phase1')
  union all
  select 'act_enterprise_inputs', p_client_id, p_client_id || ':estimate_enterprise_range', null, null,
         'Supply the enterprise range inputs (COO)', 'intofocus', 'open', 'medium', now(), now()
   where not exists (select 1 from sandbox.estimate_input i where i.estimate_id = 'est_enterprise');

  -- generated rows whose finding is gone are closed (status done), as the 2026-10-13 refresh did; in_progress is left alone
  update sandbox.action_item a
     set status = 'done', updated_at = now()
   where a.client_id = p_client_id and a.status = 'open'
     and (a.action_item_id like 'act\_suppressed\_%' or a.action_item_id in
          ('act_authorized_seller_list', 'act_map_sheet', 'act_additional_property', 'act_seller_read', 'act_phase1_inputs', 'act_enterprise_inputs'))
     and not exists (select 1 from _reload_actions n where n.action_item_id = a.action_item_id);

  -- a finding that is back reopens its closed row (v2 has no write path for status, so every done row was closed here)
  insert into sandbox.action_item (action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at)
  select action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at
  from _reload_actions
  on conflict (action_item_id) do update set
    finding_ref = excluded.finding_ref, title = excluded.title,
    status = case when sandbox.action_item.status = 'done' then 'open' else sandbox.action_item.status end,
    updated_at = case when sandbox.action_item.title is distinct from excluded.title
                        or sandbox.action_item.finding_ref is distinct from excluded.finding_ref
                        or sandbox.action_item.status = 'done'
                      then now() else sandbox.action_item.updated_at end;

  -- 10. metric values (the action_item trigger already ran it; the explicit call is the documented entry point)
  v_metrics := sandbox.refresh_metric_values(p_client_id);

  return jsonb_build_object(
    'as_of', v_as_of,
    'listings', (select count(*) from sandbox.listing where client_id = p_client_id),
    'reading_runs', (select count(*) from sandbox.reading_run where client_id = p_client_id),
    'offer_readings', (select count(*) from sandbox.listing_offer_reading where client_id = p_client_id),
    'channel_prices', (select count(*) from sandbox.listing_channel_price where client_id = p_client_id),
    'spec_readings', (select count(*) from sandbox.spec_reading where client_id = p_client_id),
    'ai_answers', (select count(*) from sandbox.ai_answer where client_id = p_client_id),
    'open_actions', (select count(*) from sandbox.action_item where client_id = p_client_id and status <> 'done'),
    'metric_values', v_metrics);
end;
$_$;

COMMENT ON FUNCTION sandbox.reload_readings(p_client_id text) IS 'Rebuilds the sandbox reading tables from the project''s command.* copy, upserts listings, sellers and generated action items, and recomputes metric_value. Scheduled daily at 14:00 UTC by pg_cron job sandbox_reload_readings. See supabase/sandbox-migrations/0008_sandbox_reload.sql.';

CREATE FUNCTION sandbox.tg_action_item_refresh() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
declare c text;
begin
  for c in select client_id from sandbox.client loop
    perform sandbox.refresh_metric_values(c);
  end loop;
  return null;
end;
$$;

CREATE TABLE sandbox.action_item (
    action_item_id text NOT NULL,
    client_id text NOT NULL,
    registry_key text,
    finding_ref text,
    listing_id text,
    title text NOT NULL,
    owner text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    severity text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    due_date date,
    CONSTRAINT action_item_owner_check CHECK ((owner = ANY (ARRAY['intofocus'::text, 'client'::text, 'unassigned'::text]))),
    CONSTRAINT action_item_severity_check CHECK ((severity = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT action_item_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'done'::text])))
);

COMMENT ON TABLE sandbox.action_item IS 'Tracks each action that follows from a metric or finding, who owns it, and where it stands. Grain: One row per action.';

COMMENT ON COLUMN sandbox.action_item.action_item_id IS 'Id for the action.';

COMMENT ON COLUMN sandbox.action_item.client_id IS 'Client the action is for.';

COMMENT ON COLUMN sandbox.action_item.registry_key IS 'Metric the action responds to.';

COMMENT ON COLUMN sandbox.action_item.finding_ref IS 'Reading the action responds to, such as lor_001.';

COMMENT ON COLUMN sandbox.action_item.listing_id IS 'Listing the action is about, if any.';

COMMENT ON COLUMN sandbox.action_item.title IS 'What needs doing, in one line.';

COMMENT ON COLUMN sandbox.action_item.owner IS 'Who does the work.';

COMMENT ON COLUMN sandbox.action_item.status IS 'Where the action stands.';

COMMENT ON COLUMN sandbox.action_item.severity IS 'How much it matters.';

COMMENT ON COLUMN sandbox.action_item.created_at IS 'When the action was added.';

COMMENT ON COLUMN sandbox.action_item.updated_at IS 'When the action last changed.';

COMMENT ON COLUMN sandbox.action_item.due_date IS 'When it should be done.';

CREATE TABLE sandbox.ai_answer (
    ai_answer_id text NOT NULL,
    client_id text NOT NULL,
    ai_prompt_id text NOT NULL,
    reading_run_id uuid NOT NULL,
    read_at timestamp with time zone NOT NULL,
    answered_at timestamp with time zone NOT NULL,
    engine text NOT NULL,
    repeat_no integer DEFAULT 1 NOT NULL,
    outcome text NOT NULL,
    winner_brand_id text,
    wrong_spec_flag boolean DEFAULT false NOT NULL,
    wrong_spec_reason text,
    answer_text text,
    citations text,
    citation_urls text[],
    remediation_note text,
    legacy_source text,
    CONSTRAINT ai_answer_engine_check CHECK ((engine = ANY (ARRAY['chatgpt'::text, 'perplexity'::text, 'gemini'::text, 'unknown'::text]))),
    CONSTRAINT ai_answer_legacy_source_check CHECK ((legacy_source = ANY (ARRAY['live'::text, 'run1_archive'::text, 'conflict_snapshot'::text]))),
    CONSTRAINT ai_answer_outcome_check CHECK ((outcome = ANY (ARRAY['resolved'::text, 'unclear'::text, 'error'::text])))
);

COMMENT ON TABLE sandbox.ai_answer IS 'Stores each answer an AI assistant gave to a prompt, which brand it named, and whether it stated a wrong product fact. Grain: One row per prompt, engine, repeat, and reading run.';

COMMENT ON COLUMN sandbox.ai_answer.ai_answer_id IS 'Id for this answer.';

COMMENT ON COLUMN sandbox.ai_answer.client_id IS 'Client the answer was scored for.';

COMMENT ON COLUMN sandbox.ai_answer.ai_prompt_id IS 'Question that produced the answer.';

COMMENT ON COLUMN sandbox.ai_answer.reading_run_id IS 'Battery run that asked the question.';

COMMENT ON COLUMN sandbox.ai_answer.read_at IS 'When the run stored the answer.';

COMMENT ON COLUMN sandbox.ai_answer.answered_at IS 'When the assistant returned the answer.';

COMMENT ON COLUMN sandbox.ai_answer.engine IS 'Assistant that answered. unknown means the old row didn''t record it.';

COMMENT ON COLUMN sandbox.ai_answer.repeat_no IS 'Which repeat of the same question in the run, since answers vary.';

COMMENT ON COLUMN sandbox.ai_answer.outcome IS 'resolved when the scorer found a named brand, unclear when it couldn''t pick one, error when the call failed.';

COMMENT ON COLUMN sandbox.ai_answer.winner_brand_id IS 'Brand the answer named most. Empty unless the outcome is resolved.';

COMMENT ON COLUMN sandbox.ai_answer.wrong_spec_flag IS 'True when the answer stated a product fact the rule set knows is false.';

COMMENT ON COLUMN sandbox.ai_answer.wrong_spec_reason IS 'The rule the answer broke, in plain words.';

COMMENT ON COLUMN sandbox.ai_answer.answer_text IS 'Full text of the answer.';

COMMENT ON COLUMN sandbox.ai_answer.citations IS 'Sources the assistant listed, as it wrote them.';

COMMENT ON COLUMN sandbox.ai_answer.citation_urls IS 'Links the assistant cited.';

COMMENT ON COLUMN sandbox.ai_answer.remediation_note IS 'What the old battery suggested doing about this answer.';

COMMENT ON COLUMN sandbox.ai_answer.legacy_source IS 'Old table the row was loaded from. Empty for new answers.';

CREATE TABLE sandbox.ai_prompt (
    ai_prompt_id text NOT NULL,
    client_id text NOT NULL,
    category text NOT NULL,
    prompt_text text NOT NULL,
    names_client_product boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    legacy_sim_id text
);

COMMENT ON TABLE sandbox.ai_prompt IS 'Holds each question we ask AI assistants for a client, grouped by shopping category. Grain: One row per client and prompt text.';

COMMENT ON COLUMN sandbox.ai_prompt.ai_prompt_id IS 'Id for the prompt.';

COMMENT ON COLUMN sandbox.ai_prompt.client_id IS 'Client the prompt tests.';

COMMENT ON COLUMN sandbox.ai_prompt.category IS 'Shopping topic the prompt belongs to, such as beginner guitars or wrong specs.';

COMMENT ON COLUMN sandbox.ai_prompt.prompt_text IS 'The exact question sent to the assistant.';

COMMENT ON COLUMN sandbox.ai_prompt.names_client_product IS 'True when the question itself names a client product. These prompts are left out of share rankings.';

COMMENT ON COLUMN sandbox.ai_prompt.is_active IS 'True while the prompt is still in the battery.';

COMMENT ON COLUMN sandbox.ai_prompt.legacy_sim_id IS 'Old prompt id from the simulation tables, so loaded answers trace back.';

CREATE TABLE sandbox.client (
    client_id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    seller_type text NOT NULL,
    organization_id uuid,
    brand_site_domain text,
    is_active boolean DEFAULT true NOT NULL,
    onboarded_at timestamp with time zone,
    updated_at timestamp with time zone
);

COMMENT ON TABLE sandbox.client IS 'Holds each brand IntoFocus reports on, with the seller type that sets its primary retail question. Grain: One row per client brand.';

COMMENT ON COLUMN sandbox.client.client_id IS 'IntoFocus id for the brand we report on.';

COMMENT ON COLUMN sandbox.client.name IS 'Brand name the dashboard shows.';

COMMENT ON COLUMN sandbox.client.slug IS 'Short name used in links, such as sample-brand.';

COMMENT ON COLUMN sandbox.client.seller_type IS 'How the brand sells on Amazon. This picks the primary retail question.';

COMMENT ON COLUMN sandbox.client.organization_id IS 'The client''s login account in command.organizations. Stored as a plain value because login tables stay outside this model.';

COMMENT ON COLUMN sandbox.client.brand_site_domain IS 'Website where the brand publishes its own product pages. The product data check looks here.';

COMMENT ON COLUMN sandbox.client.is_active IS 'True while IntoFocus is reporting on this brand.';

COMMENT ON COLUMN sandbox.client.onboarded_at IS 'When the client was set up.';

COMMENT ON COLUMN sandbox.client.updated_at IS 'When this row last changed.';

CREATE TABLE sandbox.competitor_brand (
    competitor_brand_id text NOT NULL,
    client_id text NOT NULL,
    name text NOT NULL,
    is_client_brand boolean DEFAULT false NOT NULL,
    match_terms text[]
);

COMMENT ON TABLE sandbox.competitor_brand IS 'Lists the brands an AI answer can name for a client, including the client''s own brand, so answers are scored against one list. Grain: One row per client and brand.';

COMMENT ON COLUMN sandbox.competitor_brand.competitor_brand_id IS 'Id for the brand.';

COMMENT ON COLUMN sandbox.competitor_brand.client_id IS 'Client whose answers are scored against this brand.';

COMMENT ON COLUMN sandbox.competitor_brand.name IS 'Brand name as the dashboard shows it.';

COMMENT ON COLUMN sandbox.competitor_brand.is_client_brand IS 'True for the client''s own brand or its sub-brands.';

COMMENT ON COLUMN sandbox.competitor_brand.match_terms IS 'Words the scorer looks for in an answer to count a mention of this brand.';

CREATE TABLE sandbox.estimate (
    estimate_id text NOT NULL,
    client_id text NOT NULL,
    registry_key text NOT NULL,
    name text NOT NULL,
    formula text NOT NULL,
    unit text DEFAULT 'usd'::text NOT NULL,
    low_value numeric(14,2),
    high_value numeric(14,2),
    owner text NOT NULL,
    confidence text NOT NULL,
    as_of date NOT NULL,
    CONSTRAINT estimate_confidence_check CHECK ((confidence = ANY (ARRAY['measured'::text, 'estimate'::text, 'target'::text, 'assumption'::text])))
);

COMMENT ON TABLE sandbox.estimate IS 'Holds each dollar estimate the dashboard shows, with its formula, owner, and as-of date, so no estimate appears without its inputs. Grain: One row per client and estimate.';

COMMENT ON COLUMN sandbox.estimate.estimate_id IS 'Id for the estimate.';

COMMENT ON COLUMN sandbox.estimate.client_id IS 'Client the estimate is about.';

COMMENT ON COLUMN sandbox.estimate.registry_key IS 'Registry row that defines the estimate.';

COMMENT ON COLUMN sandbox.estimate.name IS 'Estimate name the dashboard shows.';

COMMENT ON COLUMN sandbox.estimate.formula IS 'How the inputs combine, in plain terms.';

COMMENT ON COLUMN sandbox.estimate.unit IS 'What the estimate is measured in.';

COMMENT ON COLUMN sandbox.estimate.low_value IS 'Low end of the estimate. Empty until inputs exist.';

COMMENT ON COLUMN sandbox.estimate.high_value IS 'High end of the estimate. Equals the low end for a single figure.';

COMMENT ON COLUMN sandbox.estimate.owner IS 'Person or role who answers for the estimate.';

COMMENT ON COLUMN sandbox.estimate.confidence IS 'How much to trust the figure.';

COMMENT ON COLUMN sandbox.estimate.as_of IS 'Date the estimate was last reviewed.';

CREATE TABLE sandbox.estimate_input (
    estimate_input_id text NOT NULL,
    client_id text NOT NULL,
    estimate_id text NOT NULL,
    input_key text NOT NULL,
    value numeric(14,2) NOT NULL,
    unit text NOT NULL,
    source text NOT NULL,
    as_of date NOT NULL,
    owner text NOT NULL,
    confidence text NOT NULL,
    CONSTRAINT estimate_input_confidence_check CHECK ((confidence = ANY (ARRAY['measured'::text, 'estimate'::text, 'target'::text, 'assumption'::text])))
);

COMMENT ON TABLE sandbox.estimate_input IS 'Stores each input to an estimate with its source and owner, so a reader can check every part of the figure. Grain: One row per estimate and input key.';

COMMENT ON COLUMN sandbox.estimate_input.estimate_input_id IS 'Id for the input.';

COMMENT ON COLUMN sandbox.estimate_input.client_id IS 'Client the input is about.';

COMMENT ON COLUMN sandbox.estimate_input.estimate_id IS 'Estimate this input feeds.';

COMMENT ON COLUMN sandbox.estimate_input.input_key IS 'Name of the input in the formula, such as reduced_returns.';

COMMENT ON COLUMN sandbox.estimate_input.value IS 'The input amount.';

COMMENT ON COLUMN sandbox.estimate_input.unit IS 'What the input is measured in.';

COMMENT ON COLUMN sandbox.estimate_input.source IS 'Where the amount came from.';

COMMENT ON COLUMN sandbox.estimate_input.as_of IS 'Date the amount was true.';

COMMENT ON COLUMN sandbox.estimate_input.owner IS 'Who supplied the amount.';

COMMENT ON COLUMN sandbox.estimate_input.confidence IS 'How much to trust the amount.';

CREATE TABLE sandbox.fender_dealer_catalog (
    report_date date NOT NULL,
    model_number text NOT NULL,
    upc text,
    brand text,
    product_type text,
    product_subtype text,
    series text,
    model_name text,
    availability text,
    inventory_level text,
    expected_availability text,
    msrp numeric,
    map_price numeric,
    source_file text NOT NULL,
    loaded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE sandbox.listing (
    listing_id text NOT NULL,
    client_id text NOT NULL,
    retailer text DEFAULT 'amazon'::text NOT NULL,
    asin text NOT NULL,
    parent_listing_id text,
    parent_asin text,
    title text,
    brand text,
    manufacturer text,
    model_number text,
    upc text,
    ean text,
    color text,
    category text,
    is_bundle boolean DEFAULT false NOT NULL,
    bundle_name text,
    url text,
    amazon_list_price numeric(10,2),
    first_seen_at timestamp with time zone,
    last_harvested_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT listing_retailer_check CHECK ((retailer = 'amazon'::text))
);

COMMENT ON TABLE sandbox.listing IS 'Holds each retailer listing we watch for a client, with the facts that rarely change. Grain: One row per client and retailer listing (ASIN on Amazon).';

COMMENT ON COLUMN sandbox.listing.listing_id IS 'IntoFocus id for the listing.';

COMMENT ON COLUMN sandbox.listing.client_id IS 'Client whose product this listing sells.';

COMMENT ON COLUMN sandbox.listing.retailer IS 'Store the listing lives on. Amazon today.';

COMMENT ON COLUMN sandbox.listing.asin IS 'Amazon''s product id for the listing.';

COMMENT ON COLUMN sandbox.listing.parent_listing_id IS 'The parent listing when this is a size or color variation.';

COMMENT ON COLUMN sandbox.listing.parent_asin IS 'Amazon''s id for the parent listing, as Keepa reports it, even when we don''t watch the parent.';

COMMENT ON COLUMN sandbox.listing.title IS 'Listing title on Amazon.';

COMMENT ON COLUMN sandbox.listing.brand IS 'Brand name on the listing.';

COMMENT ON COLUMN sandbox.listing.manufacturer IS 'Manufacturer name on the listing.';

COMMENT ON COLUMN sandbox.listing.model_number IS 'Manufacturer model number.';

COMMENT ON COLUMN sandbox.listing.upc IS 'UPC barcode number.';

COMMENT ON COLUMN sandbox.listing.ean IS 'EAN barcode number.';

COMMENT ON COLUMN sandbox.listing.color IS 'Color or finish on the listing.';

COMMENT ON COLUMN sandbox.listing.category IS 'Amazon category the listing sits in. This replaces the old hand-named divisions.';

COMMENT ON COLUMN sandbox.listing.is_bundle IS 'True when the title marks a bundle, kit, pack, or combo.';

COMMENT ON COLUMN sandbox.listing.bundle_name IS 'Name of the bundle when the listing is one.';

COMMENT ON COLUMN sandbox.listing.url IS 'Link to the listing page.';

COMMENT ON COLUMN sandbox.listing.amazon_list_price IS 'Price Amazon shows as the list price, in dollars. This isn''t MAP.';

COMMENT ON COLUMN sandbox.listing.first_seen_at IS 'When the catalog reading first found this listing.';

COMMENT ON COLUMN sandbox.listing.last_harvested_at IS 'When the catalog reading last refreshed these facts.';

COMMENT ON COLUMN sandbox.listing.updated_at IS 'When this row last changed.';

CREATE TABLE sandbox.listing_channel_price (
    listing_channel_price_id text NOT NULL,
    client_id text NOT NULL,
    listing_id text NOT NULL,
    reading_run_id uuid NOT NULL,
    read_at timestamp with time zone NOT NULL,
    channel text NOT NULL,
    match_status text NOT NULL,
    price numeric(10,2),
    price_cents integer GENERATED ALWAYS AS ((round((price * (100)::numeric)))::integer) STORED,
    url text,
    checked_at timestamp with time zone NOT NULL,
    store_title text,
    store_seller_name text,
    store_msrp numeric(10,2),
    match_confidence numeric(3,2),
    CONSTRAINT listing_channel_price_channel_check CHECK ((channel = ANY (ARRAY['amazon'::text, 'walmart'::text, 'musiciansfriend'::text, 'sweetwater'::text, 'reverb'::text]))),
    CONSTRAINT listing_channel_price_match_status_check CHECK ((match_status = ANY (ARRAY['priced'::text, 'no_match'::text])))
);

COMMENT ON TABLE sandbox.listing_channel_price IS 'Stores the price one run found for a listing at one store, with the link and the time it was checked. Grain: One row per listing, channel, and reading run.';

COMMENT ON COLUMN sandbox.listing_channel_price.listing_channel_price_id IS 'Id for this price reading.';

COMMENT ON COLUMN sandbox.listing_channel_price.client_id IS 'Client whose product was priced.';

COMMENT ON COLUMN sandbox.listing_channel_price.listing_id IS 'Amazon listing this outside price matches.';

COMMENT ON COLUMN sandbox.listing_channel_price.reading_run_id IS 'Run that checked the store.';

COMMENT ON COLUMN sandbox.listing_channel_price.read_at IS 'When the run stored this reading.';

COMMENT ON COLUMN sandbox.listing_channel_price.channel IS 'Store the price comes from.';

COMMENT ON COLUMN sandbox.listing_channel_price.match_status IS 'priced when the store had a matching item with a price, no_match when it was checked and had none.';

COMMENT ON COLUMN sandbox.listing_channel_price.price IS 'Price shown at the store, in dollars. Empty when there was no match.';

COMMENT ON COLUMN sandbox.listing_channel_price.price_cents IS 'The same price in cents, so it compares directly with Amazon''s benchmark.';

COMMENT ON COLUMN sandbox.listing_channel_price.url IS 'Link to the item at the store.';

COMMENT ON COLUMN sandbox.listing_channel_price.checked_at IS 'When the store page was checked.';

COMMENT ON COLUMN sandbox.listing_channel_price.store_title IS 'Item title as the store shows it. Use it to confirm the match.';

COMMENT ON COLUMN sandbox.listing_channel_price.store_seller_name IS 'Seller named on the store''s offer, such as a Walmart marketplace seller.';

COMMENT ON COLUMN sandbox.listing_channel_price.store_msrp IS 'List price or MSRP the store shows next to its price, in dollars.';

COMMENT ON COLUMN sandbox.listing_channel_price.match_confidence IS 'How sure the reader is that the store item is the same product, from 0 to 1.';

CREATE TABLE sandbox.listing_map_price (
    listing_map_price_id text NOT NULL,
    client_id text NOT NULL,
    listing_id text NOT NULL,
    map_price numeric(10,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    source text,
    supplied_by text,
    loaded_at timestamp with time zone NOT NULL
);

COMMENT ON TABLE sandbox.listing_map_price IS 'Holds the minimum advertised price (MAP) the client sets for each listing, with the dates it applies. Grain: One row per listing and effective start date.';

COMMENT ON COLUMN sandbox.listing_map_price.listing_map_price_id IS 'Id for this MAP record.';

COMMENT ON COLUMN sandbox.listing_map_price.client_id IS 'Client that set the price.';

COMMENT ON COLUMN sandbox.listing_map_price.listing_id IS 'Listing the MAP applies to.';

COMMENT ON COLUMN sandbox.listing_map_price.map_price IS 'Lowest price a seller may advertise, in dollars.';

COMMENT ON COLUMN sandbox.listing_map_price.effective_from IS 'First day this MAP applies.';

COMMENT ON COLUMN sandbox.listing_map_price.effective_to IS 'Last day this MAP applies. Empty means it still applies.';

COMMENT ON COLUMN sandbox.listing_map_price.source IS 'Document the price came from, such as the client''s MAP sheet name.';

COMMENT ON COLUMN sandbox.listing_map_price.supplied_by IS 'Person who sent the sheet.';

COMMENT ON COLUMN sandbox.listing_map_price.loaded_at IS 'When IntoFocus stored this row.';

CREATE TABLE sandbox.listing_offer_reading (
    listing_offer_reading_id text NOT NULL,
    client_id text NOT NULL,
    listing_id text NOT NULL,
    reading_run_id uuid NOT NULL,
    read_at timestamp with time zone NOT NULL,
    offer_status text NOT NULL,
    featured_offer_withheld boolean,
    offer_price numeric(10,2),
    offer_price_cents integer GENERATED ALWAYS AS ((round((offer_price * (100)::numeric)))::integer) STORED,
    competitive_external_price_cents integer,
    listed_price numeric(10,2),
    featured_offer_seller_id text,
    seller_class text,
    seller_ships_with_amazon boolean,
    offer_count_new integer,
    sales_rank integer,
    monthly_sold integer,
    amazon_stock text,
    legacy_status text,
    CONSTRAINT listing_offer_reading_offer_status_check CHECK ((offer_status = ANY (ARRAY['active'::text, 'no_active_offer'::text]))),
    CONSTRAINT listing_offer_reading_seller_class_check CHECK ((seller_class = ANY (ARRAY['amazon_retail'::text, 'third_party'::text, 'not_read'::text, 'no_offer'::text])))
);

COMMENT ON TABLE sandbox.listing_offer_reading IS 'Stores what one Keepa run saw on one Amazon listing: whether Amazon withheld the Featured Offer, the offer price, Amazon''s outside benchmark, and who holds the offer. Grain: One row per listing per reading run.';

COMMENT ON COLUMN sandbox.listing_offer_reading.listing_offer_reading_id IS 'Id for this reading.';

COMMENT ON COLUMN sandbox.listing_offer_reading.client_id IS 'Client whose listing was read.';

COMMENT ON COLUMN sandbox.listing_offer_reading.listing_id IS 'Listing this reading describes.';

COMMENT ON COLUMN sandbox.listing_offer_reading.reading_run_id IS 'Run that took this reading. Use it to see when the run happened and whether it finished.';

COMMENT ON COLUMN sandbox.listing_offer_reading.read_at IS 'When Keepa returned this reading.';

COMMENT ON COLUMN sandbox.listing_offer_reading.offer_status IS 'Whether the listing had any offer shoppers could buy when read.';

COMMENT ON COLUMN sandbox.listing_offer_reading.featured_offer_withheld IS 'True when Amazon showed no Featured Offer on the listing. Empty when this run didn''t read it.';

COMMENT ON COLUMN sandbox.listing_offer_reading.offer_price IS 'Lowest offer price including shipping, in dollars.';

COMMENT ON COLUMN sandbox.listing_offer_reading.offer_price_cents IS 'The same offer price in cents, so it compares directly with Amazon''s benchmark.';

COMMENT ON COLUMN sandbox.listing_offer_reading.competitive_external_price_cents IS 'Amazon''s outside benchmark (Competitive External Price) in cents, as Keepa supplies it. Amazon may withhold the Featured Offer when the offer is above it. Empty when Keepa didn''t report one.';

COMMENT ON COLUMN sandbox.listing_offer_reading.listed_price IS 'Current price Keepa shows for the listing, in dollars, before shipping.';

COMMENT ON COLUMN sandbox.listing_offer_reading.featured_offer_seller_id IS 'Seller holding the Featured Offer when read. Empty when no seller was read.';

COMMENT ON COLUMN sandbox.listing_offer_reading.seller_class IS 'Who holds the Featured Offer: Amazon Retail, a third-party seller, not read yet, or no offer to hold.';

COMMENT ON COLUMN sandbox.listing_offer_reading.seller_ships_with_amazon IS 'True when the offer holding the Featured Offer ships through Fulfillment by Amazon.';

COMMENT ON COLUMN sandbox.listing_offer_reading.offer_count_new IS 'How many sellers offer the item new. A stored 0 means Keepa counted none.';

COMMENT ON COLUMN sandbox.listing_offer_reading.sales_rank IS 'Amazon Best Sellers Rank in the listing''s category. Lower sells more.';

COMMENT ON COLUMN sandbox.listing_offer_reading.monthly_sold IS 'Keepa''s estimate of units bought in the past month.';

COMMENT ON COLUMN sandbox.listing_offer_reading.amazon_stock IS 'Amazon Retail''s stock state, as Keepa reports it, such as in stock or no Amazon offer.';

COMMENT ON COLUMN sandbox.listing_offer_reading.legacy_status IS 'The status text the old table stored for this listing, kept so loaded rows can be checked against it.';

CREATE TABLE sandbox.metric_registry (
    registry_key text NOT NULL,
    client_id text NOT NULL,
    registry_id text NOT NULL,
    name text NOT NULL,
    meaning text NOT NULL,
    unit text NOT NULL,
    population text,
    formula text,
    source_tables text[],
    owner text NOT NULL,
    confidence text NOT NULL,
    status_rule jsonb,
    notes text,
    CONSTRAINT metric_registry_confidence_check CHECK ((confidence = ANY (ARRAY['measured'::text, 'estimate'::text, 'target'::text, 'assumption'::text]))),
    CONSTRAINT metric_registry_unit_check CHECK ((unit = ANY (ARRAY['percent'::text, 'count'::text, 'usd'::text, 'timestamp'::text, 'none'::text])))
);

COMMENT ON TABLE sandbox.metric_registry IS 'Defines every number the dashboard shows: what it means, who it covers, how it''s computed, which tables feed it, and how much to trust it. Grain: One row per client and registry id.';

COMMENT ON COLUMN sandbox.metric_registry.registry_key IS 'Client and registry id joined, such as cl_sample:featured_offer_suppressed.';

COMMENT ON COLUMN sandbox.metric_registry.client_id IS 'Client this definition applies to.';

COMMENT ON COLUMN sandbox.metric_registry.registry_id IS 'Short metric id, such as featured_offer_suppressed.';

COMMENT ON COLUMN sandbox.metric_registry.name IS 'Metric name the dashboard shows.';

COMMENT ON COLUMN sandbox.metric_registry.meaning IS 'One sentence on what the number tells you.';

COMMENT ON COLUMN sandbox.metric_registry.unit IS 'What the number is measured in.';

COMMENT ON COLUMN sandbox.metric_registry.population IS 'Which listings, answers, or runs the number covers and which it leaves out.';

COMMENT ON COLUMN sandbox.metric_registry.formula IS 'How the number is computed, in plain terms.';

COMMENT ON COLUMN sandbox.metric_registry.source_tables IS 'Tables in this model the number is built from.';

COMMENT ON COLUMN sandbox.metric_registry.owner IS 'Who answers for the number: intofocus, client, coo, or mixed.';

COMMENT ON COLUMN sandbox.metric_registry.confidence IS 'measured comes from stored readings; estimate uses stored inputs; target is a goal; assumption has no reading behind it.';

COMMENT ON COLUMN sandbox.metric_registry.status_rule IS 'Rule that turns the value into a dashboard status. Holds kind (higher_is_better, lower_is_better, or count_is_bad), warn, and danger thresholds. Empty means the metric shows a neutral status.';

COMMENT ON COLUMN sandbox.metric_registry.notes IS 'Caveats the reader should know, such as when a number stays unavailable.';

CREATE TABLE sandbox.metric_value (
    metric_value_id text NOT NULL,
    client_id text NOT NULL,
    registry_key text NOT NULL,
    reading_run_id uuid,
    computed_at timestamp with time zone NOT NULL,
    dimension_name text,
    dimension_value text,
    numeric_value numeric,
    numerator integer,
    denominator integer
);

COMMENT ON TABLE sandbox.metric_value IS 'Stores each computed value of a metric, with the run it was computed from, so the dashboard shows a number and its as-of time together. Grain: One row per metric, dimension value, and computation.';

COMMENT ON COLUMN sandbox.metric_value.metric_value_id IS 'Id for this computed value.';

COMMENT ON COLUMN sandbox.metric_value.client_id IS 'Client the value describes.';

COMMENT ON COLUMN sandbox.metric_value.registry_key IS 'Metric this value belongs to.';

COMMENT ON COLUMN sandbox.metric_value.reading_run_id IS 'Latest run that fed the value. Empty for values built from client-supplied data only.';

COMMENT ON COLUMN sandbox.metric_value.computed_at IS 'When the value was computed.';

COMMENT ON COLUMN sandbox.metric_value.dimension_name IS 'What the value is split by, such as category or engine.';

COMMENT ON COLUMN sandbox.metric_value.dimension_value IS 'The split this row covers, such as Electric Guitars.';

COMMENT ON COLUMN sandbox.metric_value.numeric_value IS 'The number itself. A 0 here is a measured zero.';

COMMENT ON COLUMN sandbox.metric_value.numerator IS 'Count on top of the fraction for percent metrics.';

COMMENT ON COLUMN sandbox.metric_value.denominator IS 'Count underneath the fraction for percent metrics.';

CREATE TABLE sandbox.reading_run (
    reading_run_id uuid NOT NULL,
    client_id text NOT NULL,
    source text NOT NULL,
    workflow_name text,
    workflow_execution_id text,
    trigger_type text,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    status text NOT NULL,
    population_count integer NOT NULL,
    rows_read integer DEFAULT 0 NOT NULL,
    findings_count integer,
    cursor_start integer,
    cursor_end integer,
    legacy_run_key text,
    detail jsonb,
    CONSTRAINT reading_run_source_check CHECK ((source = ANY (ARRAY['keepa_product'::text, 'keepa_seller'::text, 'walmart_price'::text, 'musiciansfriend_price'::text, 'sweetwater_price'::text, 'reverb_price'::text, 'spec_check'::text, 'ai_battery'::text]))),
    CONSTRAINT reading_run_status_check CHECK ((status = ANY (ARRAY['complete'::text, 'partial'::text, 'failed'::text]))),
    CONSTRAINT reading_run_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['scheduled'::text, 'manual'::text, 'webhook'::text, 'backfill'::text])))
);

COMMENT ON TABLE sandbox.reading_run IS 'Logs every run that reads data, with how many items it should have read and how many it did, so missing, partial, and zero readings stay distinct. Grain: One row per run of one reading source.';

COMMENT ON COLUMN sandbox.reading_run.reading_run_id IS 'Id for this run. Every reading row points here.';

COMMENT ON COLUMN sandbox.reading_run.client_id IS 'Client the run read data for.';

COMMENT ON COLUMN sandbox.reading_run.source IS 'What the run reads, such as Keepa product data, Walmart prices, or AI answers.';

COMMENT ON COLUMN sandbox.reading_run.workflow_name IS 'Name of the job that ran, such as fender_spec_readiness_audit.';

COMMENT ON COLUMN sandbox.reading_run.workflow_execution_id IS 'The job platform''s id for this run, so a run is never logged twice.';

COMMENT ON COLUMN sandbox.reading_run.trigger_type IS 'What started the run. Backfill marks rows loaded from older tables.';

COMMENT ON COLUMN sandbox.reading_run.started_at IS 'When the run started.';

COMMENT ON COLUMN sandbox.reading_run.finished_at IS 'When the run ended. Empty while it''s still going.';

COMMENT ON COLUMN sandbox.reading_run.status IS 'complete when it read every item it should have, partial when it read fewer, failed when it read nothing usable.';

COMMENT ON COLUMN sandbox.reading_run.population_count IS 'How many items the run should have read, such as every active listing in the batch.';

COMMENT ON COLUMN sandbox.reading_run.rows_read IS 'How many items the run actually read and stored.';

COMMENT ON COLUMN sandbox.reading_run.findings_count IS 'How many items the run flagged, such as offers above the benchmark.';

COMMENT ON COLUMN sandbox.reading_run.cursor_start IS 'Position in the item list where the run began.';

COMMENT ON COLUMN sandbox.reading_run.cursor_end IS 'Position where the next run should pick up.';

COMMENT ON COLUMN sandbox.reading_run.legacy_run_key IS 'Old batch id, such as spec_run_123, so loaded rows trace back to the old tables.';

COMMENT ON COLUMN sandbox.reading_run.detail IS 'Extra facts the job records about the run, such as batch size or API notes.';

CREATE TABLE sandbox.seller (
    seller_id text NOT NULL,
    marketplace text DEFAULT 'amazon'::text NOT NULL,
    seller_name text,
    is_amazon_retail boolean DEFAULT false NOT NULL,
    ships_with_amazon boolean,
    rating_pct integer,
    rating_count integer,
    first_seen_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT seller_marketplace_check CHECK ((marketplace = 'amazon'::text))
);

COMMENT ON TABLE sandbox.seller IS 'Holds each Amazon seller account seen holding a Featured Offer, with its public rating. Grain: One row per Amazon seller id.';

COMMENT ON COLUMN sandbox.seller.seller_id IS 'Amazon''s id for the seller account.';

COMMENT ON COLUMN sandbox.seller.marketplace IS 'Marketplace the seller account belongs to.';

COMMENT ON COLUMN sandbox.seller.seller_name IS 'Storefront name shoppers see. Empty when the lookup didn''t return a name.';

COMMENT ON COLUMN sandbox.seller.is_amazon_retail IS 'True when the seller is Amazon itself (Amazon Retail).';

COMMENT ON COLUMN sandbox.seller.ships_with_amazon IS 'True when the seller''s offers ship through Fulfillment by Amazon.';

COMMENT ON COLUMN sandbox.seller.rating_pct IS 'Share of the seller''s feedback that is positive, in percent.';

COMMENT ON COLUMN sandbox.seller.rating_count IS 'How many feedback ratings the seller has.';

COMMENT ON COLUMN sandbox.seller.first_seen_at IS 'First time a reading saw this seller holding a Featured Offer.';

COMMENT ON COLUMN sandbox.seller.updated_at IS 'When the seller lookup last refreshed this row.';

CREATE TABLE sandbox.seller_authorization (
    seller_authorization_id text NOT NULL,
    client_id text NOT NULL,
    seller_id text NOT NULL,
    authorization_status text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    source text,
    supplied_by text,
    loaded_at timestamp with time zone NOT NULL,
    CONSTRAINT seller_authorization_authorization_status_check CHECK ((authorization_status = ANY (ARRAY['authorized'::text, 'not_authorized'::text])))
);

COMMENT ON TABLE sandbox.seller_authorization IS 'Records which sellers the client says are authorized to sell its products, and from when. Grain: One row per client, seller, and effective start date.';

COMMENT ON COLUMN sandbox.seller_authorization.seller_authorization_id IS 'Id for this authorization record.';

COMMENT ON COLUMN sandbox.seller_authorization.client_id IS 'Client whose list this row comes from.';

COMMENT ON COLUMN sandbox.seller_authorization.seller_id IS 'Amazon seller the client made a decision about.';

COMMENT ON COLUMN sandbox.seller_authorization.authorization_status IS 'Whether the client says this seller may sell its products.';

COMMENT ON COLUMN sandbox.seller_authorization.effective_from IS 'First day the decision applies.';

COMMENT ON COLUMN sandbox.seller_authorization.effective_to IS 'Last day the decision applies. Empty means it still applies.';

COMMENT ON COLUMN sandbox.seller_authorization.source IS 'Where the decision came from, such as the client''s reseller sheet.';

COMMENT ON COLUMN sandbox.seller_authorization.supplied_by IS 'Person who sent the list.';

COMMENT ON COLUMN sandbox.seller_authorization.loaded_at IS 'When IntoFocus stored this row.';

CREATE TABLE sandbox.seller_type (
    seller_type text NOT NULL,
    label text NOT NULL,
    primary_retail_question text NOT NULL,
    description text,
    CONSTRAINT seller_type_seller_type_check CHECK ((seller_type = ANY (ARRAY['partner_led'::text, 'brand_led_marketplace'::text, 'amazon_retail_only'::text, 'hybrid'::text, 'no_managed_presence'::text])))
);

COMMENT ON TABLE sandbox.seller_type IS 'Lists the five ways a brand can sell on Amazon and the retail question the dashboard leads with for each. Grain: One row per seller type.';

COMMENT ON COLUMN sandbox.seller_type.seller_type IS 'Short code for how the brand sells on Amazon.';

COMMENT ON COLUMN sandbox.seller_type.label IS 'Name the dashboard shows, such as Partner-led.';

COMMENT ON COLUMN sandbox.seller_type.primary_retail_question IS 'The first retail question the dashboard answers for a client of this type.';

COMMENT ON COLUMN sandbox.seller_type.description IS 'One sentence that explains this seller type to a new client.';

CREATE TABLE sandbox.spec_reading (
    spec_reading_id text NOT NULL,
    client_id text NOT NULL,
    listing_id text NOT NULL,
    reading_run_id uuid NOT NULL,
    read_at timestamp with time zone NOT NULL,
    amazon_checked boolean NOT NULL,
    amazon_fields_found integer,
    amazon_fields_expected integer,
    amazon_missing_fields text[],
    brand_site_page_found boolean NOT NULL,
    brand_site_url text,
    brand_site_fields_found integer,
    brand_site_fields_expected integer,
    brand_site_missing_fields text[],
    additional_property_present boolean
);

COMMENT ON TABLE sandbox.spec_reading IS 'Stores one check of how complete a listing''s product facts are on Amazon and on the brand''s own product page. Grain: One row per listing per reading run.';

COMMENT ON COLUMN sandbox.spec_reading.spec_reading_id IS 'Id for this check.';

COMMENT ON COLUMN sandbox.spec_reading.client_id IS 'Client whose listing was checked.';

COMMENT ON COLUMN sandbox.spec_reading.listing_id IS 'Listing that was checked.';

COMMENT ON COLUMN sandbox.spec_reading.reading_run_id IS 'Run that did the check.';

COMMENT ON COLUMN sandbox.spec_reading.read_at IS 'When the check ran.';

COMMENT ON COLUMN sandbox.spec_reading.amazon_checked IS 'True when the Amazon page loaded and was read. False means the Amazon counts below aren''t measured.';

COMMENT ON COLUMN sandbox.spec_reading.amazon_fields_found IS 'How many of the expected Amazon product-detail fields are filled.';

COMMENT ON COLUMN sandbox.spec_reading.amazon_fields_expected IS 'How many Amazon product-detail fields the check looks for. 13 today.';

COMMENT ON COLUMN sandbox.spec_reading.amazon_missing_fields IS 'Names of the Amazon fields that are empty.';

COMMENT ON COLUMN sandbox.spec_reading.brand_site_page_found IS 'True when site search found the product''s page on the brand''s own site.';

COMMENT ON COLUMN sandbox.spec_reading.brand_site_url IS 'Link to the brand''s product page that was checked.';

COMMENT ON COLUMN sandbox.spec_reading.brand_site_fields_found IS 'How many expected product facts the brand page''s structured data includes.';

COMMENT ON COLUMN sandbox.spec_reading.brand_site_fields_expected IS 'How many product facts the check looks for on the brand page. 8 today.';

COMMENT ON COLUMN sandbox.spec_reading.brand_site_missing_fields IS 'Names of the product facts the brand page is missing.';

COMMENT ON COLUMN sandbox.spec_reading.additional_property_present IS 'True when the brand page''s structured data has an additionalProperty block, where detailed specs go. Empty when no page was found.';

CREATE VIEW sandbox.v_ai_answer_detail WITH (security_invoker='false') AS
 SELECT a.ai_answer_id,
    a.client_id,
    a.reading_run_id,
    r.finished_at AS run_finished_at,
    r.status AS run_status,
    a.ai_prompt_id,
    p.category,
    p.prompt_text,
    p.names_client_product,
    p.legacy_sim_id,
    a.read_at,
    a.answered_at,
    a.engine,
    a.repeat_no,
    a.outcome,
    a.winner_brand_id,
    b.name AS winner_brand_name,
    COALESCE(b.is_client_brand, false) AS client_brand_won,
    a.wrong_spec_flag,
    a.wrong_spec_reason,
    a.answer_text,
    a.citations,
    a.citation_urls,
    a.remediation_note,
    a.legacy_source
   FROM (((sandbox.ai_answer a
     JOIN sandbox.ai_prompt p ON ((p.ai_prompt_id = a.ai_prompt_id)))
     LEFT JOIN sandbox.competitor_brand b ON ((b.competitor_brand_id = a.winner_brand_id)))
     LEFT JOIN sandbox.reading_run r ON ((r.reading_run_id = a.reading_run_id)));

COMMENT ON VIEW sandbox.v_ai_answer_detail IS 'Every AI answer joined to its prompt (category, text, whether it names a client product) and the brand it named. client_brand_won is true when the winner is the client brand. Answer share = client_brand_won over outcome = resolved.';

CREATE VIEW sandbox.v_listing_current WITH (security_invoker='false') AS
 WITH r1 AS (
         SELECT DISTINCT ON (o.listing_id) o.listing_id,
            o.reading_run_id,
            o.read_at,
            o.offer_status,
            o.listed_price,
            o.sales_rank,
            o.monthly_sold,
            o.offer_count_new,
            o.amazon_stock
           FROM (sandbox.listing_offer_reading o
             JOIN sandbox.reading_run r ON ((r.reading_run_id = o.reading_run_id)))
          WHERE ((r.source = 'keepa_product'::text) AND (r.workflow_name = 'fender_catalog_harvester'::text))
          ORDER BY o.listing_id, o.read_at DESC, o.reading_run_id DESC
        ), r2 AS (
         SELECT DISTINCT ON (o.listing_id) o.listing_id,
            o.reading_run_id,
            o.read_at,
            o.seller_class,
            o.featured_offer_seller_id,
            o.seller_ships_with_amazon
           FROM (sandbox.listing_offer_reading o
             JOIN sandbox.reading_run r ON ((r.reading_run_id = o.reading_run_id)))
          WHERE (r.source = 'keepa_seller'::text)
          ORDER BY o.listing_id, o.read_at DESC, o.reading_run_id DESC
        ), r3 AS (
         SELECT DISTINCT ON (o.listing_id) o.listing_id,
            o.listing_offer_reading_id,
            o.reading_run_id,
            o.read_at,
            o.offer_status,
            o.featured_offer_withheld,
            o.offer_price,
            o.offer_price_cents,
            o.competitive_external_price_cents,
            o.legacy_status
           FROM (sandbox.listing_offer_reading o
             JOIN sandbox.reading_run r ON ((r.reading_run_id = o.reading_run_id)))
          WHERE ((r.source = 'keepa_product'::text) AND (r.workflow_name = 'fender_omnichannel_audit_sync'::text))
          ORDER BY o.listing_id, o.read_at DESC, o.reading_run_id DESC
        ), ch AS (
         SELECT DISTINCT ON (p.listing_id, p.channel) p.listing_id,
            p.channel,
            p.match_status,
            p.price,
            p.price_cents,
            p.url,
            p.checked_at
           FROM sandbox.listing_channel_price p
          ORDER BY p.listing_id, p.channel, p.read_at DESC, p.reading_run_id DESC
        ), bm AS (
         SELECT c.listing_id,
            array_agg(c.channel ORDER BY c.channel) AS channels
           FROM (ch c
             JOIN r3 r3_1 ON ((r3_1.listing_id = c.listing_id)))
          WHERE ((c.match_status = 'priced'::text) AND (c.price_cents = r3_1.competitive_external_price_cents))
          GROUP BY c.listing_id
        )
 SELECT l.listing_id,
    l.client_id,
    l.retailer,
    l.asin,
    l.parent_listing_id,
    l.parent_asin,
    l.title,
    l.brand,
    l.manufacturer,
    l.model_number,
    l.upc,
    l.ean,
    l.color,
    l.category,
    l.is_bundle,
    l.bundle_name,
    l.url,
    l.amazon_list_price,
    l.first_seen_at,
    l.last_harvested_at,
    l.updated_at,
    r1.reading_run_id AS catalog_run_id,
    r1.read_at AS catalog_read_at,
    r1.offer_status,
    r1.listed_price,
    r1.sales_rank,
    r1.monthly_sold,
    r1.offer_count_new,
    r1.amazon_stock,
    r2.reading_run_id AS seller_run_id,
    r2.read_at AS seller_read_at,
    r2.seller_class,
    r2.featured_offer_seller_id,
    s.seller_name AS featured_offer_seller_name,
    r2.seller_ships_with_amazon,
    r3.listing_offer_reading_id AS benchmark_reading_id,
    r3.reading_run_id AS benchmark_run_id,
    r3.read_at AS benchmark_read_at,
    r3.offer_status AS benchmark_offer_status,
    r3.featured_offer_withheld,
    r3.offer_price,
    r3.offer_price_cents,
    r3.competitive_external_price_cents,
    r3.legacy_status,
    ((r3.featured_offer_withheld IS TRUE) AND (r3.offer_price_cents IS NOT NULL) AND (r3.competitive_external_price_cents IS NOT NULL) AND (r3.offer_price_cents > r3.competitive_external_price_cents)) AS suppressed,
    w.price AS walmart_price,
    w.url AS walmart_url,
    w.checked_at AS walmart_checked_at,
    m.price AS musiciansfriend_price,
    m.url AS musiciansfriend_url,
    m.checked_at AS musiciansfriend_checked_at,
    bm.channels AS benchmark_match_channels
   FROM (((((((sandbox.listing l
     LEFT JOIN r1 ON ((r1.listing_id = l.listing_id)))
     LEFT JOIN r2 ON ((r2.listing_id = l.listing_id)))
     LEFT JOIN sandbox.seller s ON ((s.seller_id = r2.featured_offer_seller_id)))
     LEFT JOIN r3 ON ((r3.listing_id = l.listing_id)))
     LEFT JOIN ch w ON (((w.listing_id = l.listing_id) AND (w.channel = 'walmart'::text) AND (w.match_status = 'priced'::text))))
     LEFT JOIN ch m ON (((m.listing_id = l.listing_id) AND (m.channel = 'musiciansfriend'::text) AND (m.match_status = 'priced'::text))))
     LEFT JOIN bm ON ((bm.listing_id = l.listing_id)));

COMMENT ON VIEW sandbox.v_listing_current IS 'One row per listing with its latest catalog read (offer_status, listed_price, rank, stock), latest seller read (seller_class, seller), latest Featured Offer and benchmark read (withheld flag, offer cents, benchmark cents, read_at), the latest priced Walmart and Musician''s Friend price and link, suppressed = withheld and offer cents above benchmark cents, and benchmark_match_channels = channels whose latest priced price_cents equals the benchmark cents (the amazon channel row is the offer itself, so it only matches when the offer equals the benchmark).';

CREATE VIEW sandbox.v_reading_freshness WITH (security_invoker='false') AS
 SELECT DISTINCT ON (client_id, source) client_id,
    source,
    reading_run_id,
    workflow_name,
    trigger_type,
    started_at,
    finished_at,
    status,
    rows_read,
    population_count,
    findings_count,
    legacy_run_key
   FROM sandbox.reading_run r
  ORDER BY client_id, source, finished_at DESC NULLS LAST, started_at DESC;

COMMENT ON VIEW sandbox.v_reading_freshness IS 'One row per client and source: the run with the latest finished_at, with its status, rows_read and population_count. The header as-of is the oldest finished_at across sources, not the newest.';

CREATE VIEW sandbox.v_spec_current WITH (security_invoker='false') AS
 SELECT DISTINCT ON (s.listing_id) s.spec_reading_id,
    s.client_id,
    s.listing_id,
    l.asin,
    l.title,
    l.category,
    s.reading_run_id,
    s.read_at,
    s.amazon_checked,
    s.amazon_fields_found,
    s.amazon_fields_expected,
    s.amazon_missing_fields,
    s.brand_site_page_found,
    s.brand_site_url,
    s.brand_site_fields_found,
    s.brand_site_fields_expected,
    s.brand_site_missing_fields,
    s.additional_property_present,
        CASE
            WHEN (s.amazon_checked AND (s.amazon_fields_expected > 0)) THEN round((((s.amazon_fields_found)::numeric * 100.0) / (s.amazon_fields_expected)::numeric), 1)
            ELSE NULL::numeric
        END AS amazon_completeness_pct
   FROM (sandbox.spec_reading s
     JOIN sandbox.listing l ON ((l.listing_id = s.listing_id)))
  ORDER BY s.listing_id, s.read_at DESC, s.reading_run_id DESC;

COMMENT ON VIEW sandbox.v_spec_current IS 'The latest product-data check per listing, joined to the listing (asin, title, category). amazon_completeness_pct is derived as found / expected and is empty when the Amazon page was not checked.';

ALTER TABLE ONLY sandbox.action_item
    ADD CONSTRAINT action_item_pkey PRIMARY KEY (action_item_id);

ALTER TABLE ONLY sandbox.ai_answer
    ADD CONSTRAINT ai_answer_pkey PRIMARY KEY (ai_answer_id);

ALTER TABLE ONLY sandbox.ai_prompt
    ADD CONSTRAINT ai_prompt_client_id_prompt_text_key UNIQUE (client_id, prompt_text);

ALTER TABLE ONLY sandbox.ai_prompt
    ADD CONSTRAINT ai_prompt_pkey PRIMARY KEY (ai_prompt_id);

ALTER TABLE ONLY sandbox.client
    ADD CONSTRAINT client_pkey PRIMARY KEY (client_id);

ALTER TABLE ONLY sandbox.client
    ADD CONSTRAINT client_slug_key UNIQUE (slug);

ALTER TABLE ONLY sandbox.competitor_brand
    ADD CONSTRAINT competitor_brand_client_id_name_key UNIQUE (client_id, name);

ALTER TABLE ONLY sandbox.competitor_brand
    ADD CONSTRAINT competitor_brand_pkey PRIMARY KEY (competitor_brand_id);

ALTER TABLE ONLY sandbox.estimate_input
    ADD CONSTRAINT estimate_input_estimate_id_input_key_key UNIQUE (estimate_id, input_key);

ALTER TABLE ONLY sandbox.estimate_input
    ADD CONSTRAINT estimate_input_pkey PRIMARY KEY (estimate_input_id);

ALTER TABLE ONLY sandbox.estimate
    ADD CONSTRAINT estimate_pkey PRIMARY KEY (estimate_id);

ALTER TABLE ONLY sandbox.fender_dealer_catalog
    ADD CONSTRAINT fender_dealer_catalog_pkey PRIMARY KEY (report_date, model_number);

ALTER TABLE ONLY sandbox.listing_channel_price
    ADD CONSTRAINT listing_channel_price_listing_id_channel_reading_run_id_key UNIQUE (listing_id, channel, reading_run_id);

ALTER TABLE ONLY sandbox.listing_channel_price
    ADD CONSTRAINT listing_channel_price_pkey PRIMARY KEY (listing_channel_price_id);

ALTER TABLE ONLY sandbox.listing
    ADD CONSTRAINT listing_client_id_retailer_asin_key UNIQUE (client_id, retailer, asin);

ALTER TABLE ONLY sandbox.listing_map_price
    ADD CONSTRAINT listing_map_price_pkey PRIMARY KEY (listing_map_price_id);

ALTER TABLE ONLY sandbox.listing_offer_reading
    ADD CONSTRAINT listing_offer_reading_listing_id_reading_run_id_key UNIQUE (listing_id, reading_run_id);

ALTER TABLE ONLY sandbox.listing_offer_reading
    ADD CONSTRAINT listing_offer_reading_pkey PRIMARY KEY (listing_offer_reading_id);

ALTER TABLE ONLY sandbox.listing
    ADD CONSTRAINT listing_pkey PRIMARY KEY (listing_id);

ALTER TABLE ONLY sandbox.metric_registry
    ADD CONSTRAINT metric_registry_client_id_registry_id_key UNIQUE (client_id, registry_id);

ALTER TABLE ONLY sandbox.metric_registry
    ADD CONSTRAINT metric_registry_pkey PRIMARY KEY (registry_key);

ALTER TABLE ONLY sandbox.metric_value
    ADD CONSTRAINT metric_value_pkey PRIMARY KEY (metric_value_id);

ALTER TABLE ONLY sandbox.reading_run
    ADD CONSTRAINT reading_run_pkey PRIMARY KEY (reading_run_id);

ALTER TABLE ONLY sandbox.reading_run
    ADD CONSTRAINT reading_run_workflow_execution_id_key UNIQUE (workflow_execution_id);

ALTER TABLE ONLY sandbox.seller_authorization
    ADD CONSTRAINT seller_authorization_client_id_seller_id_effective_from_key UNIQUE (client_id, seller_id, effective_from);

ALTER TABLE ONLY sandbox.seller_authorization
    ADD CONSTRAINT seller_authorization_pkey PRIMARY KEY (seller_authorization_id);

ALTER TABLE ONLY sandbox.seller
    ADD CONSTRAINT seller_pkey PRIMARY KEY (seller_id);

ALTER TABLE ONLY sandbox.seller_type
    ADD CONSTRAINT seller_type_pkey PRIMARY KEY (seller_type);

ALTER TABLE ONLY sandbox.spec_reading
    ADD CONSTRAINT spec_reading_listing_id_reading_run_id_read_at_key UNIQUE (listing_id, reading_run_id, read_at);

ALTER TABLE ONLY sandbox.spec_reading
    ADD CONSTRAINT spec_reading_pkey PRIMARY KEY (spec_reading_id);

CREATE TRIGGER action_item_refresh_metrics AFTER INSERT OR DELETE OR UPDATE ON sandbox.action_item FOR EACH STATEMENT EXECUTE FUNCTION sandbox.tg_action_item_refresh();

ALTER TABLE ONLY sandbox.action_item
    ADD CONSTRAINT action_item_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.action_item
    ADD CONSTRAINT action_item_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES sandbox.listing(listing_id);

ALTER TABLE ONLY sandbox.action_item
    ADD CONSTRAINT action_item_registry_key_fkey FOREIGN KEY (registry_key) REFERENCES sandbox.metric_registry(registry_key);

ALTER TABLE ONLY sandbox.ai_answer
    ADD CONSTRAINT ai_answer_ai_prompt_id_fkey FOREIGN KEY (ai_prompt_id) REFERENCES sandbox.ai_prompt(ai_prompt_id);

ALTER TABLE ONLY sandbox.ai_answer
    ADD CONSTRAINT ai_answer_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.ai_answer
    ADD CONSTRAINT ai_answer_reading_run_id_fkey FOREIGN KEY (reading_run_id) REFERENCES sandbox.reading_run(reading_run_id);

ALTER TABLE ONLY sandbox.ai_answer
    ADD CONSTRAINT ai_answer_winner_brand_id_fkey FOREIGN KEY (winner_brand_id) REFERENCES sandbox.competitor_brand(competitor_brand_id);

ALTER TABLE ONLY sandbox.ai_prompt
    ADD CONSTRAINT ai_prompt_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.client
    ADD CONSTRAINT client_seller_type_fkey FOREIGN KEY (seller_type) REFERENCES sandbox.seller_type(seller_type);

ALTER TABLE ONLY sandbox.competitor_brand
    ADD CONSTRAINT competitor_brand_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.estimate
    ADD CONSTRAINT estimate_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.estimate_input
    ADD CONSTRAINT estimate_input_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.estimate_input
    ADD CONSTRAINT estimate_input_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES sandbox.estimate(estimate_id);

ALTER TABLE ONLY sandbox.estimate
    ADD CONSTRAINT estimate_registry_key_fkey FOREIGN KEY (registry_key) REFERENCES sandbox.metric_registry(registry_key);

ALTER TABLE ONLY sandbox.listing_channel_price
    ADD CONSTRAINT listing_channel_price_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.listing_channel_price
    ADD CONSTRAINT listing_channel_price_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES sandbox.listing(listing_id);

ALTER TABLE ONLY sandbox.listing_channel_price
    ADD CONSTRAINT listing_channel_price_reading_run_id_fkey FOREIGN KEY (reading_run_id) REFERENCES sandbox.reading_run(reading_run_id);

ALTER TABLE ONLY sandbox.listing
    ADD CONSTRAINT listing_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.listing_map_price
    ADD CONSTRAINT listing_map_price_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.listing_map_price
    ADD CONSTRAINT listing_map_price_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES sandbox.listing(listing_id);

ALTER TABLE ONLY sandbox.listing_offer_reading
    ADD CONSTRAINT listing_offer_reading_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.listing_offer_reading
    ADD CONSTRAINT listing_offer_reading_featured_offer_seller_id_fkey FOREIGN KEY (featured_offer_seller_id) REFERENCES sandbox.seller(seller_id);

ALTER TABLE ONLY sandbox.listing_offer_reading
    ADD CONSTRAINT listing_offer_reading_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES sandbox.listing(listing_id);

ALTER TABLE ONLY sandbox.listing_offer_reading
    ADD CONSTRAINT listing_offer_reading_reading_run_id_fkey FOREIGN KEY (reading_run_id) REFERENCES sandbox.reading_run(reading_run_id);

ALTER TABLE ONLY sandbox.listing
    ADD CONSTRAINT listing_parent_listing_id_fkey FOREIGN KEY (parent_listing_id) REFERENCES sandbox.listing(listing_id);

ALTER TABLE ONLY sandbox.metric_registry
    ADD CONSTRAINT metric_registry_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.metric_value
    ADD CONSTRAINT metric_value_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.metric_value
    ADD CONSTRAINT metric_value_reading_run_id_fkey FOREIGN KEY (reading_run_id) REFERENCES sandbox.reading_run(reading_run_id);

ALTER TABLE ONLY sandbox.metric_value
    ADD CONSTRAINT metric_value_registry_key_fkey FOREIGN KEY (registry_key) REFERENCES sandbox.metric_registry(registry_key);

ALTER TABLE ONLY sandbox.reading_run
    ADD CONSTRAINT reading_run_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.seller_authorization
    ADD CONSTRAINT seller_authorization_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.seller_authorization
    ADD CONSTRAINT seller_authorization_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES sandbox.seller(seller_id);

ALTER TABLE ONLY sandbox.spec_reading
    ADD CONSTRAINT spec_reading_client_id_fkey FOREIGN KEY (client_id) REFERENCES sandbox.client(client_id);

ALTER TABLE ONLY sandbox.spec_reading
    ADD CONSTRAINT spec_reading_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES sandbox.listing(listing_id);

ALTER TABLE ONLY sandbox.spec_reading
    ADD CONSTRAINT spec_reading_reading_run_id_fkey FOREIGN KEY (reading_run_id) REFERENCES sandbox.reading_run(reading_run_id);

ALTER TABLE sandbox.action_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_item_read_all ON sandbox.action_item FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.ai_answer ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_answer_read_all ON sandbox.ai_answer FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.ai_prompt ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_prompt_read_all ON sandbox.ai_prompt FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.client ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_read_all ON sandbox.client FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.competitor_brand ENABLE ROW LEVEL SECURITY;

CREATE POLICY competitor_brand_read_all ON sandbox.competitor_brand FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.estimate ENABLE ROW LEVEL SECURITY;

ALTER TABLE sandbox.estimate_input ENABLE ROW LEVEL SECURITY;

CREATE POLICY estimate_input_read_all ON sandbox.estimate_input FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY estimate_read_all ON sandbox.estimate FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.fender_dealer_catalog ENABLE ROW LEVEL SECURITY;

ALTER TABLE sandbox.listing ENABLE ROW LEVEL SECURITY;

ALTER TABLE sandbox.listing_channel_price ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_channel_price_read_all ON sandbox.listing_channel_price FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.listing_map_price ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_map_price_read_all ON sandbox.listing_map_price FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.listing_offer_reading ENABLE ROW LEVEL SECURITY;

CREATE POLICY listing_offer_reading_read_all ON sandbox.listing_offer_reading FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY listing_read_all ON sandbox.listing FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.metric_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY metric_registry_read_all ON sandbox.metric_registry FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.metric_value ENABLE ROW LEVEL SECURITY;

CREATE POLICY metric_value_read_all ON sandbox.metric_value FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.reading_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY reading_run_read_all ON sandbox.reading_run FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.seller ENABLE ROW LEVEL SECURITY;

ALTER TABLE sandbox.seller_authorization ENABLE ROW LEVEL SECURITY;

CREATE POLICY seller_authorization_read_all ON sandbox.seller_authorization FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY seller_read_all ON sandbox.seller FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.seller_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY seller_type_read_all ON sandbox.seller_type FOR SELECT TO authenticated, anon USING (true);

ALTER TABLE sandbox.spec_reading ENABLE ROW LEVEL SECURITY;

CREATE POLICY spec_reading_read_all ON sandbox.spec_reading FOR SELECT TO authenticated, anon USING (true);

GRANT USAGE ON SCHEMA sandbox TO anon;
GRANT USAGE ON SCHEMA sandbox TO authenticated;

REVOKE ALL ON FUNCTION sandbox.refresh_metric_values(p_client_id text) FROM PUBLIC;

REVOKE ALL ON FUNCTION sandbox.reload_readings(p_client_id text) FROM PUBLIC;

REVOKE ALL ON FUNCTION sandbox.tg_action_item_refresh() FROM PUBLIC;

GRANT SELECT ON TABLE sandbox.action_item TO anon;
GRANT SELECT ON TABLE sandbox.action_item TO authenticated;

GRANT SELECT ON TABLE sandbox.ai_answer TO anon;
GRANT SELECT ON TABLE sandbox.ai_answer TO authenticated;

GRANT SELECT ON TABLE sandbox.ai_prompt TO anon;
GRANT SELECT ON TABLE sandbox.ai_prompt TO authenticated;

GRANT SELECT ON TABLE sandbox.client TO anon;
GRANT SELECT ON TABLE sandbox.client TO authenticated;

GRANT SELECT ON TABLE sandbox.competitor_brand TO anon;
GRANT SELECT ON TABLE sandbox.competitor_brand TO authenticated;

GRANT SELECT ON TABLE sandbox.estimate TO anon;
GRANT SELECT ON TABLE sandbox.estimate TO authenticated;

GRANT SELECT ON TABLE sandbox.estimate_input TO anon;
GRANT SELECT ON TABLE sandbox.estimate_input TO authenticated;

GRANT SELECT ON TABLE sandbox.listing TO anon;
GRANT SELECT ON TABLE sandbox.listing TO authenticated;

GRANT SELECT ON TABLE sandbox.listing_channel_price TO anon;
GRANT SELECT ON TABLE sandbox.listing_channel_price TO authenticated;

GRANT SELECT ON TABLE sandbox.listing_map_price TO anon;
GRANT SELECT ON TABLE sandbox.listing_map_price TO authenticated;

GRANT SELECT ON TABLE sandbox.listing_offer_reading TO anon;
GRANT SELECT ON TABLE sandbox.listing_offer_reading TO authenticated;

GRANT SELECT ON TABLE sandbox.metric_registry TO anon;
GRANT SELECT ON TABLE sandbox.metric_registry TO authenticated;

GRANT SELECT ON TABLE sandbox.metric_value TO anon;
GRANT SELECT ON TABLE sandbox.metric_value TO authenticated;

GRANT SELECT ON TABLE sandbox.reading_run TO anon;
GRANT SELECT ON TABLE sandbox.reading_run TO authenticated;

GRANT SELECT ON TABLE sandbox.seller TO anon;
GRANT SELECT ON TABLE sandbox.seller TO authenticated;

GRANT SELECT ON TABLE sandbox.seller_authorization TO anon;
GRANT SELECT ON TABLE sandbox.seller_authorization TO authenticated;

GRANT SELECT ON TABLE sandbox.seller_type TO anon;
GRANT SELECT ON TABLE sandbox.seller_type TO authenticated;

GRANT SELECT ON TABLE sandbox.spec_reading TO anon;
GRANT SELECT ON TABLE sandbox.spec_reading TO authenticated;

GRANT SELECT ON TABLE sandbox.v_ai_answer_detail TO anon;
GRANT SELECT ON TABLE sandbox.v_ai_answer_detail TO authenticated;

GRANT SELECT ON TABLE sandbox.v_listing_current TO anon;
GRANT SELECT ON TABLE sandbox.v_listing_current TO authenticated;

GRANT SELECT ON TABLE sandbox.v_reading_freshness TO anon;
GRANT SELECT ON TABLE sandbox.v_reading_freshness TO authenticated;

GRANT SELECT ON TABLE sandbox.v_spec_current TO anon;
GRANT SELECT ON TABLE sandbox.v_spec_current TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sandbox GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA sandbox GRANT SELECT ON TABLES TO authenticated;

GRANT USAGE ON SCHEMA sandbox TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA sandbox TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sandbox TO service_role;
