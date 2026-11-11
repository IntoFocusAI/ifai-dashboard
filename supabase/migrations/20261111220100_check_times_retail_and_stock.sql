-- Per-row check times for the old-data asterisk (FDD X-25; decisions 68 and 73), Fender and Ledlenser.
--
-- Changes (two existing views and two materialized views; no table, row, or permission changes):
--   public.canvas_retail_listings, ledlenser.canvas_retail_listings
--     add catalog_checked_at (the catalog pass time, catalog.extracted_at) as the last column.
--     Splintered Listings reads its bundle flag and parent ASIN from that pass.
--   command.mv_listing_sales_loss_v2, ledlenser.mv_listing_sales_loss_v2
--     rebuilt with keepa_checked_at (the newest Keepa daily-history load for the listing,
--     max(keepa_daily.loaded_at) over the last 365 days) as the last column. Every other column is
--     the same definition as 20261102170000 (Fender) and 20261104170000 (Ledlenser).
--   public.canvas_listing_sales_loss_v2, ledlenser.canvas_listing_sales_loss_v2
--     now expose keepa_checked_at as the last column.
--
-- Why a materialized view column: keepa_daily holds 1.3M Fender rows. Reading the newest load per
-- listing at request time took 1.7 to 4 s on production (11 Nov), over the 3 s read timeout. The
-- hourly refresh (refresh_stock_loss_v2 :37, ledlenser_refresh_stock_loss_v2 :47) computes it once,
-- so dashboard reads cost nothing extra. The refresh jobs refer to the views by name and need no change.
--
-- How it is applied without blocking reads: the new materialized views are built first (step 1) under
-- *_next names while the current ones keep serving. Only then are the dashboard views pointed at
-- them, the old materialized views dropped, and the new ones renamed into place. Readers wait only
-- for that last step. lock_timeout stops the apply instead of queueing reads behind it.
--
-- Checks inside this file (any failure rolls the whole file back):
--   canvas_retail_listings: every existing column is the same on every row as before the change,
--   and catalog_checked_at is filled. canvas_listing_sales_loss_v2: the same number of rows, and
--   keepa_checked_at is filled.
--
-- Undo: rerun the view definitions in 20261006223000/20261104170000 for canvas_retail_listings
-- (dropping the column requires DROP VIEW and CREATE VIEW with its grants), and the materialized
-- view blocks in 20261102170000 and 20261104170000 with the same swap as below.
--
-- Alters existing views, so Brian Watson applies it (AGENTS.md, Database changes).
-- Applied: not yet.

SET lock_timeout = '5s';

-- 1. Out of Stock: build the new materialized views while the current ones keep serving.
CREATE MATERIALIZED VIEW command.mv_listing_sales_loss_v2_next AS
WITH pop AS (
  SELECT c.asin, c.title, c.current_price, COALESCE(c.is_bundle, false) AS is_bundle,
    m.featured_offer_state, m.featured_offer_checked_at
  FROM command.fmic_electric_catalog c
  LEFT JOIN command.fmic_retail_buybox_map m ON m.asin = c.asin
  WHERE COALESCE(c.current_price, 0) > 0 OR m.asin IS NOT NULL
), ss AS (
  SELECT DISTINCT ON (asin) asin, snapshot_date, est_monthly_units, est_monthly_revenue, ttm_revenue, prev_12m_revenue
  FROM command.fmic_smartscout_products
  ORDER BY asin, snapshot_date DESC
), k AS (
  SELECT k.* FROM command.fmic_keepa_daily k JOIN pop USING (asin) WHERE k.day > current_date - 365
), d AS (
  SELECT asin,
    min(day) AS history_from,
    max(day) AS history_through,
    max(loaded_at) AS keepa_checked_at,
    max(day) FILTER (WHERE new_price_close IS NOT NULL) AS last_in_stock_day,
    count(*) FILTER (WHERE day > current_date - 30) AS observed_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NOT NULL) AS in_stock_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NULL) AS oos_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_30,
    count(*) FILTER (WHERE day > current_date - 90) AS observed_days_90,
    count(*) FILTER (WHERE day > current_date - 90 AND new_price_close IS NULL) AS oos_days_90,
    count(*) FILTER (WHERE day > current_date - 90 AND new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_90,
    count(*) AS observed_days_365,
    count(*) FILTER (WHERE new_price_close IS NOT NULL) AS in_stock_days_365,
    count(*) FILTER (WHERE new_price_close IS NULL) AS oos_days_365,
    count(*) FILTER (WHERE new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_365
  FROM k GROUP BY asin
), cur AS (
  -- Out-of-stock days after the last in-stock day (the current stretch), and rank drops on those days.
  SELECT d.asin,
    (d.last_in_stock_day IS NULL OR d.last_in_stock_day < d.history_through) AS offline_now,
    count(k.day) FILTER (WHERE k.new_price_close IS NULL) AS current_oos_days,
    sum(k.sales_rank_drops) AS current_stretch_rank_drops
  FROM d
  LEFT JOIN k ON k.asin = d.asin AND k.day > COALESCE(d.last_in_stock_day, d.history_from - 1)
  GROUP BY d.asin, d.last_in_stock_day, d.history_through
), b AS (
  SELECT pop.*, ss.snapshot_date, ss.est_monthly_units, ss.est_monthly_revenue, ss.ttm_revenue, ss.prev_12m_revenue,
    d.history_from, d.history_through, d.last_in_stock_day, d.keepa_checked_at,
    d.observed_days_30, d.in_stock_days_30, d.oos_days_30, d.no_buy_box_days_30,
    d.observed_days_90, d.oos_days_90, d.no_buy_box_days_90,
    d.observed_days_365, d.in_stock_days_365, d.oos_days_365, d.no_buy_box_days_365,
    cur.offline_now, cur.current_oos_days, cur.current_stretch_rank_drops,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN 'smartscout_ttm'
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN 'smartscout_30d'
    END AS baseline_method,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN ss.ttm_revenue / d.in_stock_days_365
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN ss.est_monthly_revenue / d.in_stock_days_30
    END AS baseline_daily_revenue
  FROM pop
  LEFT JOIN ss USING (asin)
  LEFT JOIN d USING (asin)
  LEFT JOIN cur USING (asin)
)
SELECT b.asin,
  b.title,
  b.is_bundle,
  b.current_price,
  b.featured_offer_state,
  b.featured_offer_checked_at,
  b.history_from,
  b.history_through,
  b.last_in_stock_day,
  b.offline_now,
  b.current_oos_days,
  b.observed_days_30, b.in_stock_days_30, b.oos_days_30, b.no_buy_box_days_30,
  b.observed_days_90, b.oos_days_90, b.no_buy_box_days_90,
  b.observed_days_365, b.in_stock_days_365, b.oos_days_365, b.no_buy_box_days_365,
  -- Activity signal only. Never dollars.
  b.current_stretch_rank_drops,
  ks.sales_rank_current, ks.sales_rank_drops_30, ks.sales_rank_drops_90,
  -- Sales inputs and their provenance.
  b.snapshot_date AS smartscout_snapshot_date,
  b.est_monthly_units AS smartscout_monthly_units,
  b.est_monthly_revenue AS smartscout_monthly_revenue,
  b.ttm_revenue AS smartscout_ttm_revenue,
  b.prev_12m_revenue AS smartscout_prev_12m_revenue,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'smartscout' END AS revenue_source,
  b.baseline_method,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'USD' END AS currency,
  CASE b.baseline_method
    WHEN 'smartscout_ttm' THEN (b.snapshot_date - interval '12 months')::date
    WHEN 'smartscout_30d' THEN b.snapshot_date - 30
  END AS revenue_window_start,
  CASE WHEN b.baseline_method IS NOT NULL THEN b.snapshot_date END AS revenue_window_end,
  CASE b.baseline_method
    WHEN 'smartscout_ttm' THEN b.in_stock_days_365
    WHEN 'smartscout_30d' THEN b.in_stock_days_30
  END AS in_stock_days_used,
  round(b.baseline_daily_revenue, 2) AS baseline_daily_revenue,
  round(b.baseline_daily_revenue * b.oos_days_30, 2) AS est_lost_revenue_oos_30,
  round(b.baseline_daily_revenue * b.oos_days_90, 2) AS est_lost_revenue_oos_90,
  round(b.baseline_daily_revenue * b.oos_days_365, 2) AS est_lost_revenue_oos_365,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'Analyst estimate' END AS estimate_label,
  -- Why a listing is awaiting inputs. NULL when it has a sales rate.
  CASE
    WHEN b.baseline_method IS NOT NULL THEN NULL
    WHEN b.history_through IS NULL THEN 'no_keepa_history'
    WHEN b.snapshot_date IS NULL THEN 'no_sales_source'
    WHEN COALESCE(b.ttm_revenue, 0) <= 0 AND COALESCE(b.est_monthly_revenue, 0) <= 0 THEN 'smartscout_reports_no_sales'
    ELSE 'too_few_in_stock_days'
  END AS awaiting_inputs_reason,
  b.keepa_checked_at
FROM b
LEFT JOIN command.fmic_keepa_stats ks USING (asin);

CREATE UNIQUE INDEX mv_listing_sales_loss_v2_next_asin_idx ON command.mv_listing_sales_loss_v2_next (asin);

CREATE MATERIALIZED VIEW ledlenser.mv_listing_sales_loss_v2_next AS
WITH pop AS (
  SELECT c.asin, c.title, c.current_price, COALESCE(c.is_bundle, false) AS is_bundle,
    m.featured_offer_state, m.featured_offer_checked_at
  FROM ledlenser.catalog c
  LEFT JOIN ledlenser.retail_buybox_map m ON m.asin = c.asin
  WHERE COALESCE(c.current_price, 0) > 0 OR m.asin IS NOT NULL
), ss AS (
  SELECT DISTINCT ON (asin) asin, snapshot_date, est_monthly_units, est_monthly_revenue, ttm_revenue, prev_12m_revenue
  FROM ledlenser.smartscout_products
  ORDER BY asin, snapshot_date DESC
), k AS (
  SELECT k.* FROM ledlenser.keepa_daily k JOIN pop USING (asin) WHERE k.day > current_date - 365
), d AS (
  SELECT asin,
    min(day) AS history_from,
    max(day) AS history_through,
    max(loaded_at) AS keepa_checked_at,
    max(day) FILTER (WHERE new_price_close IS NOT NULL) AS last_in_stock_day,
    count(*) FILTER (WHERE day > current_date - 30) AS observed_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NOT NULL) AS in_stock_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NULL) AS oos_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_30,
    count(*) FILTER (WHERE day > current_date - 90) AS observed_days_90,
    count(*) FILTER (WHERE day > current_date - 90 AND new_price_close IS NULL) AS oos_days_90,
    count(*) FILTER (WHERE day > current_date - 90 AND new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_90,
    count(*) AS observed_days_365,
    count(*) FILTER (WHERE new_price_close IS NOT NULL) AS in_stock_days_365,
    count(*) FILTER (WHERE new_price_close IS NULL) AS oos_days_365,
    count(*) FILTER (WHERE new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_365
  FROM k GROUP BY asin
), cur AS (
  SELECT d.asin,
    (d.last_in_stock_day IS NULL OR d.last_in_stock_day < d.history_through) AS offline_now,
    count(k.day) FILTER (WHERE k.new_price_close IS NULL) AS current_oos_days,
    sum(k.sales_rank_drops) AS current_stretch_rank_drops
  FROM d
  LEFT JOIN k ON k.asin = d.asin AND k.day > COALESCE(d.last_in_stock_day, d.history_from - 1)
  GROUP BY d.asin, d.last_in_stock_day, d.history_through
), b AS (
  SELECT pop.*, ss.snapshot_date, ss.est_monthly_units, ss.est_monthly_revenue, ss.ttm_revenue, ss.prev_12m_revenue,
    d.history_from, d.history_through, d.last_in_stock_day, d.keepa_checked_at,
    d.observed_days_30, d.in_stock_days_30, d.oos_days_30, d.no_buy_box_days_30,
    d.observed_days_90, d.oos_days_90, d.no_buy_box_days_90,
    d.observed_days_365, d.in_stock_days_365, d.oos_days_365, d.no_buy_box_days_365,
    cur.offline_now, cur.current_oos_days, cur.current_stretch_rank_drops,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN 'smartscout_ttm'
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN 'smartscout_30d'
    END AS baseline_method,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN ss.ttm_revenue / d.in_stock_days_365
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN ss.est_monthly_revenue / d.in_stock_days_30
    END AS baseline_daily_revenue
  FROM pop
  LEFT JOIN ss USING (asin)
  LEFT JOIN d USING (asin)
  LEFT JOIN cur USING (asin)
)
SELECT b.asin, b.title, b.is_bundle, b.current_price, b.featured_offer_state, b.featured_offer_checked_at,
  b.history_from, b.history_through, b.last_in_stock_day, b.offline_now, b.current_oos_days,
  b.observed_days_30, b.in_stock_days_30, b.oos_days_30, b.no_buy_box_days_30,
  b.observed_days_90, b.oos_days_90, b.no_buy_box_days_90,
  b.observed_days_365, b.in_stock_days_365, b.oos_days_365, b.no_buy_box_days_365,
  b.current_stretch_rank_drops,
  ks.sales_rank_current, ks.sales_rank_drops_30, ks.sales_rank_drops_90,
  b.snapshot_date AS smartscout_snapshot_date,
  b.est_monthly_units AS smartscout_monthly_units,
  b.est_monthly_revenue AS smartscout_monthly_revenue,
  b.ttm_revenue AS smartscout_ttm_revenue,
  b.prev_12m_revenue AS smartscout_prev_12m_revenue,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'smartscout' END AS revenue_source,
  b.baseline_method,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'USD' END AS currency,
  CASE b.baseline_method
    WHEN 'smartscout_ttm' THEN (b.snapshot_date - interval '12 months')::date
    WHEN 'smartscout_30d' THEN b.snapshot_date - 30
  END AS revenue_window_start,
  CASE WHEN b.baseline_method IS NOT NULL THEN b.snapshot_date END AS revenue_window_end,
  CASE b.baseline_method
    WHEN 'smartscout_ttm' THEN b.in_stock_days_365
    WHEN 'smartscout_30d' THEN b.in_stock_days_30
  END AS in_stock_days_used,
  round(b.baseline_daily_revenue, 2) AS baseline_daily_revenue,
  round(b.baseline_daily_revenue * b.oos_days_30, 2) AS est_lost_revenue_oos_30,
  round(b.baseline_daily_revenue * b.oos_days_90, 2) AS est_lost_revenue_oos_90,
  round(b.baseline_daily_revenue * b.oos_days_365, 2) AS est_lost_revenue_oos_365,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'Analyst estimate' END AS estimate_label,
  CASE
    WHEN b.baseline_method IS NOT NULL THEN NULL
    WHEN b.history_through IS NULL THEN 'no_keepa_history'
    WHEN b.snapshot_date IS NULL THEN 'no_sales_source'
    WHEN COALESCE(b.ttm_revenue, 0) <= 0 AND COALESCE(b.est_monthly_revenue, 0) <= 0 THEN 'smartscout_reports_no_sales'
    ELSE 'too_few_in_stock_days'
  END AS awaiting_inputs_reason,
  b.keepa_checked_at
FROM b
LEFT JOIN ledlenser.keepa_stats ks USING (asin);

CREATE UNIQUE INDEX mv_listing_sales_loss_v2_next_asin_idx ON ledlenser.mv_listing_sales_loss_v2_next (asin);

DO $$ BEGIN
  IF (SELECT count(*) FROM command.mv_listing_sales_loss_v2_next) <> (SELECT count(*) FROM command.mv_listing_sales_loss_v2) THEN
    RAISE EXCEPTION 'command.mv_listing_sales_loss_v2_next row count differs from the current view';
  END IF;
  IF (SELECT count(*) FROM ledlenser.mv_listing_sales_loss_v2_next) <> (SELECT count(*) FROM ledlenser.mv_listing_sales_loss_v2) THEN
    RAISE EXCEPTION 'ledlenser.mv_listing_sales_loss_v2_next row count differs from the current view';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM command.mv_listing_sales_loss_v2_next WHERE keepa_checked_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM ledlenser.mv_listing_sales_loss_v2_next WHERE keepa_checked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'keepa_checked_at is empty on every row';
  END IF;
END $$;

-- 2. Retail listings: catalog_checked_at. After the slow builds, so these views are locked only briefly.
CREATE TEMP TABLE _before_public_retail ON COMMIT DROP AS SELECT * FROM public.canvas_retail_listings;
CREATE OR REPLACE VIEW public.canvas_retail_listings WITH (security_invoker = false) AS
 SELECT b.asin,
    b.model_name,
    c.title,
    c.category,
    c.is_bundle,
    c.parent_asin,
    c.product_url,
    b.map_price,
    b.offer_price,
    b.leakage_amount AS amz_leakage,
    b.buybox_status,
    b.buybox_winner,
    c.buybox_seller AS buybox_seller_id,
    sl.seller_name AS buybox_seller_name,
    c.buybox_is_fba,
    c.offer_count_new,
    c.sales_rank,
    c.monthly_sold,
    b.reviews_count,
    b.channels,
    b.bundle_name,
    b.wmt_price,
    b.wmt_leakage,
    b.wmt_url,
    b.wmt_seller,
    b.wmt_match_conf,
    b.wmt_checked_at,
    b.mf_price,
    b.mf_leakage,
    b.mf_checked_at,
    LEAST(b.leakage_amount, b.wmt_leakage, b.mf_leakage) AS worst_leakage,
    COALESCE(b.leakage_amount, 0::numeric) < 0::numeric OR COALESCE(b.wmt_leakage, 0::numeric) < 0::numeric OR COALESCE(b.mf_leakage, 0::numeric) < 0::numeric AS is_map_violation,
    b.updated_at,
    b.competitive_price_threshold_cents,
    b.featured_offer_withheld,
    b.featured_offer_state = 'withheld'::text AND b.competitive_external_price_state = 'present'::text AND b.competitive_price_threshold_cents IS NOT NULL AND b.competitive_price_threshold_cents > 0 AND b.featured_offer_observed_price_cents IS NOT NULL AND b.featured_offer_observed_price_cents > 0 AND b.featured_offer_source = 'keepa'::text AND b.featured_offer_checked_at IS NOT NULL AND (b.featured_offer_observed_price_cents + COALESCE(b.featured_offer_observed_shipping_cents, 0)) > b.competitive_price_threshold_cents AS competitive_offer_suppressed,
    b.featured_offer_state,
    b.featured_offer_source,
    b.featured_offer_checked_at,
    b.featured_offer_attempted_at,
    b.featured_offer_last_error,
    b.competitive_external_price_state,
    b.featured_offer_observed_price_cents,
    b.featured_offer_observed_shipping_cents,
    b.featured_offer_observed_seller,
    c.extracted_at AS catalog_checked_at
   FROM command.fmic_retail_buybox_map b
     LEFT JOIN command.fmic_electric_catalog c ON c.asin::text = b.asin::text
     LEFT JOIN command.fmic_sellers sl ON sl.seller_id::text = c.buybox_seller::text;
COMMENT ON COLUMN public.canvas_retail_listings.catalog_checked_at IS 'When the catalog pass last read this listing (bundle flag, parent ASIN, title). Source: catalog.extracted_at.';
DO $$ DECLARE n integer; m integer; BEGIN
  SELECT count(*) INTO n FROM (
    (SELECT to_jsonb(t) AS r FROM _before_public_retail t EXCEPT ALL SELECT to_jsonb(v) - 'catalog_checked_at' FROM public.canvas_retail_listings v)
    UNION ALL
    (SELECT to_jsonb(v) - 'catalog_checked_at' FROM public.canvas_retail_listings v EXCEPT ALL SELECT to_jsonb(t) FROM _before_public_retail t)) x;
  IF n <> 0 THEN RAISE EXCEPTION 'public.canvas_retail_listings: % rows differ from before the change (rerun if a job wrote mid-apply)', n; END IF;
  SELECT count(*) INTO m FROM public.canvas_retail_listings WHERE catalog_checked_at IS NOT NULL;
  IF m = 0 THEN RAISE EXCEPTION 'public.canvas_retail_listings: catalog_checked_at is empty on every row'; END IF;
END $$;

CREATE TEMP TABLE _before_ledlenser_retail ON COMMIT DROP AS SELECT * FROM ledlenser.canvas_retail_listings;
CREATE OR REPLACE VIEW ledlenser.canvas_retail_listings WITH (security_invoker = false) AS
 SELECT b.asin,
    b.model_name,
    c.title,
    c.category,
    c.is_bundle,
    c.parent_asin,
    c.product_url,
    b.map_price,
    b.offer_price,
    b.leakage_amount AS amz_leakage,
    b.buybox_status,
    b.buybox_winner,
    c.buybox_seller AS buybox_seller_id,
    sl.seller_name AS buybox_seller_name,
    c.buybox_is_fba,
    c.offer_count_new,
    c.sales_rank,
    c.monthly_sold,
    b.reviews_count,
    b.channels,
    b.bundle_name,
    b.wmt_price,
    b.wmt_leakage,
    b.wmt_url,
    b.wmt_seller,
    b.wmt_match_conf,
    b.wmt_checked_at,
    LEAST(b.leakage_amount, b.wmt_leakage) AS worst_leakage,
    COALESCE(b.leakage_amount, 0::numeric) < 0::numeric OR COALESCE(b.wmt_leakage, 0::numeric) < 0::numeric AS is_map_violation,
    b.updated_at,
    b.competitive_price_threshold_cents,
    b.featured_offer_withheld,
    b.featured_offer_state = 'withheld'::text AND b.competitive_external_price_state = 'present'::text AND b.competitive_price_threshold_cents IS NOT NULL AND b.competitive_price_threshold_cents > 0 AND b.featured_offer_observed_price_cents IS NOT NULL AND b.featured_offer_observed_price_cents > 0 AND b.featured_offer_source = 'keepa'::text AND b.featured_offer_checked_at IS NOT NULL AND (b.featured_offer_observed_price_cents + COALESCE(b.featured_offer_observed_shipping_cents, 0)) > b.competitive_price_threshold_cents AS competitive_offer_suppressed,
    b.featured_offer_state,
    b.featured_offer_source,
    b.featured_offer_checked_at,
    b.featured_offer_attempted_at,
    b.featured_offer_last_error,
    b.competitive_external_price_state,
    b.featured_offer_observed_price_cents,
    b.featured_offer_observed_shipping_cents,
    b.featured_offer_observed_seller,
    c.extracted_at AS catalog_checked_at
   FROM ledlenser.retail_buybox_map b
     LEFT JOIN ledlenser.catalog c ON c.asin::text = b.asin::text
     LEFT JOIN ledlenser.sellers sl ON sl.seller_id::text = c.buybox_seller::text;
COMMENT ON COLUMN ledlenser.canvas_retail_listings.catalog_checked_at IS 'When the catalog pass last read this listing (bundle flag, parent ASIN, title). Source: catalog.extracted_at.';
DO $$ DECLARE n integer; m integer; BEGIN
  SELECT count(*) INTO n FROM (
    (SELECT to_jsonb(t) AS r FROM _before_ledlenser_retail t EXCEPT ALL SELECT to_jsonb(v) - 'catalog_checked_at' FROM ledlenser.canvas_retail_listings v)
    UNION ALL
    (SELECT to_jsonb(v) - 'catalog_checked_at' FROM ledlenser.canvas_retail_listings v EXCEPT ALL SELECT to_jsonb(t) FROM _before_ledlenser_retail t)) x;
  IF n <> 0 THEN RAISE EXCEPTION 'ledlenser.canvas_retail_listings: % rows differ from before the change (rerun if a job wrote mid-apply)', n; END IF;
  SELECT count(*) INTO m FROM ledlenser.canvas_retail_listings WHERE catalog_checked_at IS NOT NULL;
  IF m = 0 THEN RAISE EXCEPTION 'ledlenser.canvas_retail_listings: catalog_checked_at is empty on every row'; END IF;
END $$;

-- 3. Swap: point the dashboard views at the new materialized views, drop the old ones, rename.
CREATE OR REPLACE VIEW public.canvas_listing_sales_loss_v2 WITH (security_invoker = false) AS
SELECT * FROM command.mv_listing_sales_loss_v2_next;
CREATE OR REPLACE VIEW ledlenser.canvas_listing_sales_loss_v2 WITH (security_invoker = false) AS
SELECT * FROM ledlenser.mv_listing_sales_loss_v2_next;

DROP MATERIALIZED VIEW command.mv_listing_sales_loss_v2;
DROP MATERIALIZED VIEW ledlenser.mv_listing_sales_loss_v2;
ALTER MATERIALIZED VIEW command.mv_listing_sales_loss_v2_next RENAME TO mv_listing_sales_loss_v2;
ALTER MATERIALIZED VIEW ledlenser.mv_listing_sales_loss_v2_next RENAME TO mv_listing_sales_loss_v2;
ALTER INDEX command.mv_listing_sales_loss_v2_next_asin_idx RENAME TO mv_listing_sales_loss_v2_asin_idx;
ALTER INDEX ledlenser.mv_listing_sales_loss_v2_next_asin_idx RENAME TO mv_listing_sales_loss_v2_asin_idx;

-- Same grants as before (postgres and service_role only) on the materialized views; the dashboard
-- views keep their grants (CREATE OR REPLACE VIEW does not change them).
DO $$ DECLARE s text; BEGIN
  FOREACH s IN ARRAY ARRAY['command', 'ledlenser'] LOOP
    EXECUTE format('ALTER MATERIALIZED VIEW %I.mv_listing_sales_loss_v2 OWNER TO postgres', s);
    EXECUTE format('REVOKE ALL ON %I.mv_listing_sales_loss_v2 FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT ALL ON %I.mv_listing_sales_loss_v2 TO service_role', s);
  END LOOP;
END $$;

COMMENT ON COLUMN public.canvas_listing_sales_loss_v2.keepa_checked_at IS 'Newest Keepa daily-history load for this listing (max keepa_daily.loaded_at, last 365 days). Refreshed hourly.';
COMMENT ON COLUMN ledlenser.canvas_listing_sales_loss_v2.keepa_checked_at IS 'Newest Keepa daily-history load for this listing (max keepa_daily.loaded_at, last 365 days). Refreshed hourly.';

NOTIFY pgrst, 'reload schema';
