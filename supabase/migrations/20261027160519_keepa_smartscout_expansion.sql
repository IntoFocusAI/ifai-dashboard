-- Keepa and SmartScout expansion (2026-10-27).
-- Stores the Keepa product fields the catalog harvester already downloads, Keepa stats,
-- daily Keepa history, Keepa listing content (description, A+, video) and SmartScout
-- product estimates, plus a map from Amazon ASINs to Fender model numbers.
-- Idempotent: safe to run on prod, sandbox, mirror and claude copies.

-- 1. Listing content: fields already present in the raw Keepa product object.
ALTER TABLE command.fmic_listing_content
  ADD COLUMN IF NOT EXISTS part_number text,
  ADD COLUMN IF NOT EXISTS parent_title text,
  ADD COLUMN IF NOT EXISTS gtin_list jsonb,
  ADD COLUMN IF NOT EXISTS is_redirect_asin boolean,
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS product_type_name text,
  ADD COLUMN IF NOT EXISTS materials jsonb,
  ADD COLUMN IF NOT EXISTS sales_rank_display_group text,
  ADD COLUMN IF NOT EXISTS package_quantity integer,
  ADD COLUMN IF NOT EXISTS number_of_items integer,
  ADD COLUMN IF NOT EXISTS item_length_mm integer,
  ADD COLUMN IF NOT EXISTS item_width_mm integer,
  ADD COLUMN IF NOT EXISTS item_height_mm integer,
  ADD COLUMN IF NOT EXISTS item_weight_g integer,
  ADD COLUMN IF NOT EXISTS package_length_mm integer,
  ADD COLUMN IF NOT EXISTS package_width_mm integer,
  ADD COLUMN IF NOT EXISTS package_height_mm integer,
  ADD COLUMN IF NOT EXISTS package_weight_g integer,
  ADD COLUMN IF NOT EXISTS fba_pick_pack_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS referral_fee_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS suggested_lower_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS competitive_price_threshold numeric(10,2),
  ADD COLUMN IF NOT EXISTS availability_amazon_delay jsonb,
  ADD COLUMN IF NOT EXISTS last_price_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_rating_update_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_since timestamptz,
  ADD COLUMN IF NOT EXISTS url_slug text,
  -- Filled by the weekly Keepa content job (get_product_content).
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS description_length integer,
  ADD COLUMN IF NOT EXISTS aplus_text text,
  ADD COLUMN IF NOT EXISTS aplus_module_count integer,
  ADD COLUMN IF NOT EXISTS videos jsonb,
  ADD COLUMN IF NOT EXISTS video_count integer,
  ADD COLUMN IF NOT EXISTS content_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_payload_ref text;

CREATE INDEX IF NOT EXISTS fmic_listing_content_part_number_idx ON command.fmic_listing_content (part_number);

-- 2. Keepa stats: one row per ASIN from the raw product object's stats block (no extra tokens).
-- Prices in dollars; -1/-2 Keepa sentinels stored as NULL.
CREATE TABLE IF NOT EXISTS command.fmic_keepa_stats (
  asin text PRIMARY KEY,
  checked_at timestamptz NOT NULL,
  keepa_last_update timestamptz,
  collector_version text,
  raw_payload_ref text,
  sales_rank_current integer,
  sales_rank_avg30 integer,
  sales_rank_avg90 integer,
  sales_rank_avg180 integer,
  sales_rank_avg365 integer,
  sales_rank_drops_30 integer,
  sales_rank_drops_90 integer,
  sales_rank_drops_180 integer,
  sales_rank_drops_365 integer,
  new_price_current numeric(10,2),
  new_price_avg30 numeric(10,2),
  new_price_avg90 numeric(10,2),
  new_price_avg180 numeric(10,2),
  new_price_avg365 numeric(10,2),
  new_price_min numeric(10,2),
  new_price_min_at timestamptz,
  new_price_max numeric(10,2),
  new_price_max_at timestamptz,
  amazon_price_current numeric(10,2),
  amazon_price_avg90 numeric(10,2),
  amazon_price_avg365 numeric(10,2),
  amazon_price_min numeric(10,2),
  amazon_price_min_at timestamptz,
  list_price_current numeric(10,2),
  buybox_price_current numeric(10,2),
  buybox_price_avg90 numeric(10,2),
  buybox_price_avg365 numeric(10,2),
  new_offer_count_current integer,
  new_offer_count_avg90 integer,
  total_offer_count integer,
  amazon_oos_pct_30 integer,
  amazon_oos_pct_90 integer,
  amazon_oos_pct_180 integer,
  amazon_oos_pct_365 integer,
  new_oos_pct_30 integer,
  new_oos_pct_90 integer,
  new_oos_pct_180 integer,
  new_oos_pct_365 integer,
  amazon_oos_count_30 integer,
  amazon_oos_count_90 integer,
  buybox_is_amazon boolean,
  buybox_seller_id text,
  buybox_availability text,
  rating_current numeric(2,1),
  review_count_current integer,
  monthly_sold integer,
  monthly_sold_delta_pct_90 integer,
  stats jsonb,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS command.fmic_keepa_stats_history (
  entity_key text NOT NULL,
  row_hash text NOT NULL,
  op text,
  row_data jsonb,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (entity_key, row_hash)
);

DROP TRIGGER IF EXISTS trg_fmic_keepa_stats_history ON command.fmic_keepa_stats;
CREATE TRIGGER trg_fmic_keepa_stats_history AFTER INSERT OR UPDATE ON command.fmic_keepa_stats
  FOR EACH ROW EXECUTE FUNCTION command.fmic_capture_history('asin', 'checked_at', 'updated_at', 'keepa_last_update', 'raw_payload_ref', 'collector_version');

-- 3. Keepa daily history: one row per ASIN per day, decoded from get_price_history
-- (SALES, NEW, AMAZON, BUY_BOX_SHIPPING, RATING, COUNT_REVIEWS). Backfilled 365 days.
CREATE TABLE IF NOT EXISTS command.fmic_keepa_daily (
  asin text NOT NULL,
  day date NOT NULL,
  sales_rank_min integer,
  sales_rank_avg integer,
  sales_rank_close integer,
  sales_rank_drops integer,
  new_price_min numeric(10,2),
  new_price_close numeric(10,2),
  amazon_price_close numeric(10,2),
  amazon_in_stock boolean,
  buybox_price_close numeric(10,2),
  buybox_shipping_close numeric(10,2),
  rating numeric(2,1),
  review_count integer,
  source text,
  collector_version text,
  loaded_at timestamptz,
  PRIMARY KEY (asin, day)
);

CREATE INDEX IF NOT EXISTS fmic_keepa_daily_day_idx ON command.fmic_keepa_daily (day);

-- 4. SmartScout product estimates: one row per ASIN per snapshot (Business plan shows the last 30 days only).
CREATE TABLE IF NOT EXISTS command.fmic_smartscout_products (
  asin text NOT NULL,
  snapshot_date date NOT NULL,
  title text,
  tracking_status text,
  est_monthly_units integer,
  est_monthly_revenue numeric(14,2),
  buybox_price numeric(10,2),
  main_category_rank integer,
  review_count integer,
  review_rating numeric(2,1),
  brand_query text,
  raw jsonb,
  collector_version text,
  loaded_at timestamptz,
  PRIMARY KEY (asin, snapshot_date)
);

CREATE INDEX IF NOT EXISTS fmic_smartscout_products_snapshot_idx ON command.fmic_smartscout_products (snapshot_date);

-- 5. Same access model as the other command tables: RLS on, no policies, service_role only.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fmic_keepa_stats', 'fmic_keepa_stats_history', 'fmic_keepa_daily', 'fmic_smartscout_products'] LOOP
    EXECUTE format('ALTER TABLE command.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON command.%I FROM PUBLIC', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON command.%I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON command.%I FROM authenticated', t); END IF;
    EXECUTE format('GRANT ALL ON command.%I TO service_role', t);
  END LOOP;
END $$;

-- 6. Amazon ASIN to Fender model number. Match order: Keepa part number, then UPC/EAN, then Amazon model.
-- Dealer fields come from the newest inventory report row for the matched model.
CREATE OR REPLACE VIEW command.v_fmic_sku_map WITH (security_invoker = true) AS
WITH d AS (
  SELECT DISTINCT ON (model_number) model_number, ltrim(upc, '0') AS upc_norm, model_name, series, product_type,
         availability, inventory_level, msrp, map_price, report_date
  FROM command.fmic_dealer_catalog
  ORDER BY model_number, report_date DESC
)
SELECT c.asin,
       c.title,
       c.current_price,
       lc.part_number,
       m.model_number AS fender_model_number,
       m.match_method,
       m.model_name AS fender_model_name,
       m.series AS fender_series,
       m.product_type AS fender_product_type,
       m.availability AS dealer_availability,
       m.inventory_level AS dealer_inventory_level,
       m.msrp AS dealer_msrp,
       m.map_price AS dealer_map_price,
       m.report_date AS dealer_report_date
FROM command.fmic_electric_catalog c
LEFT JOIN command.fmic_listing_content lc ON lc.asin = c.asin
LEFT JOIN LATERAL (
  SELECT x.* FROM (
    SELECT d.*, 'part_number'::text AS match_method, 1 AS pri FROM d WHERE lc.part_number IS NOT NULL AND d.model_number = lc.part_number
    UNION ALL
    SELECT d.*, 'upc', 2 FROM d WHERE d.upc_norm <> '' AND d.upc_norm IN (ltrim(c.upc, '0'), ltrim(c.ean, '0'))
    UNION ALL
    SELECT d.*, 'amazon_model', 3 FROM d WHERE c.model_number IS NOT NULL AND d.model_number = c.model_number
  ) x ORDER BY x.pri, x.model_number LIMIT 1
) m ON true;

REVOKE ALL ON command.v_fmic_sku_map FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON command.v_fmic_sku_map FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON command.v_fmic_sku_map FROM authenticated; END IF;
END $$;
GRANT SELECT ON command.v_fmic_sku_map TO service_role;
