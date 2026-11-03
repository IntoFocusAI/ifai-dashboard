-- Worker 18.6. Versioned lost-sales and offer-state views that include listings with no active offer
-- (2026-11-02). The v1 views (canvas_listing_sales_loss, canvas_listing_stock_episodes) and the
-- refresh_stock_loss job are unchanged. The Out of Stock tab moves to these v2 views.
--
-- Why v2: v1 starts from live listings, COALESCE(current_price, 0) > 0. A listing with no active offer
-- has no current price, so it never entered v1 and could not get a loss estimate. On 2026-11-02 the
-- retail read marked 116 listings featured_offer_state = 'no_active_offer' (92 on 2026-10-28).
--
-- Population: every catalog listing that is live OR in the retail read (command.fmic_retail_buybox_map).
-- current_price may be NULL. Dead catalog rows outside the retail read stay out.
--
-- Day states, from command.fmic_keepa_daily (Keepa, Amazon.com marketplace, USD). A day with no Keepa
-- row is unknown and is not counted.
--   out_of_stock  no New offer from any seller (new_price_close IS NULL)
--   no_buy_box    a New offer exists but Amazon showed no Buy Box (buybox_price_close IS NULL)
--   in_stock      a New offer exists
-- Keepa re-fetches listings without a current price only every 7 days, so an offline listing's newest
-- days can lag. history_through says how far each row's evidence runs.
--
-- Sales source order (Brian Magazu, 2026-11-02; the same order applies to the R-06 80% figure):
--   1. brand_reported  the brand's own reported Amazon sales for the listing, brand-led clients only.
--                      Not collected yet. Fender is Partner-led, so this step is empty for Fender.
--   2. smartscout      SmartScout (Business plan, Amazon.com catalog, USD).
--   3. none            the listing is awaiting inputs. It is never $0.
-- Keepa is never a sales source. It supplies day counts only.
--
-- Sales per in-stock day (USD), first rule that applies:
--   smartscout_ttm   SmartScout trailing-12-month revenue / Keepa in-stock days in the last 365 (30+ needed)
--   smartscout_30d   SmartScout last-30-day revenue / Keepa in-stock days in the last 30 (7+ needed)
--
-- Missed sales for a window = sales per in-stock day x out-of-stock days in that window, for the last
-- 30 days, 90 days, and 365 days. That lookback is also the estimate for the next period of the same
-- length if the sales rate and the out-of-stock pattern hold; no separate projection is stored.
-- No 80% factor here, and no no-Buy-Box dollar. The 80% suppression figure is R-06 and lives elsewhere.
-- Sales-rank drops are an activity signal only. They are never converted to dollars.
-- Every dollar figure is an analyst estimate (estimate_label).

DROP MATERIALIZED VIEW IF EXISTS command.mv_listing_sales_loss_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS command.mv_listing_offer_state_v2 CASCADE;

CREATE MATERIALIZED VIEW command.mv_listing_sales_loss_v2 AS
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
    d.history_from, d.history_through, d.last_in_stock_day,
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
  END AS awaiting_inputs_reason
FROM b
LEFT JOIN command.fmic_keepa_stats ks USING (asin);

CREATE UNIQUE INDEX mv_listing_sales_loss_v2_asin_idx ON command.mv_listing_sales_loss_v2 (asin);

-- Dated offer state for the same population: one row per stretch of consecutive days a listing was
-- out of stock or had no Buy Box, last 365 days. The evidence behind each day count above.
CREATE MATERIALIZED VIEW command.mv_listing_offer_state_v2 AS
WITH pop AS (
  SELECT c.asin
  FROM command.fmic_electric_catalog c
  LEFT JOIN command.fmic_retail_buybox_map m ON m.asin = c.asin
  WHERE COALESCE(c.current_price, 0) > 0 OR m.asin IS NOT NULL
), days AS (
  SELECT k.asin, k.day, k.sales_rank_drops,
    CASE
      WHEN k.new_price_close IS NULL THEN 'out_of_stock'
      WHEN k.buybox_price_close IS NULL THEN 'no_buy_box'
      ELSE 'in_stock'
    END AS state
  FROM command.fmic_keepa_daily k
  JOIN pop USING (asin)
  WHERE k.day > current_date - 365
), latest AS (
  SELECT asin, max(day) AS history_through FROM days GROUP BY asin
), grouped AS (
  -- Consecutive days in one state share a group. A missing Keepa day breaks the run.
  SELECT asin, day, state, sales_rank_drops,
    day - (row_number() OVER (PARTITION BY asin, state ORDER BY day))::int AS grp
  FROM days
)
SELECT g.asin,
  g.state,
  min(g.day) AS start_day,
  max(g.day) AS end_day,
  count(*)::int AS days,
  max(g.day) = l.history_through AS ongoing,
  sum(g.sales_rank_drops)::int AS rank_drops_activity,
  'Keepa (Amazon.com)'::text AS source
FROM grouped g
JOIN latest l USING (asin)
WHERE g.state <> 'in_stock'
GROUP BY g.asin, g.state, g.grp, l.history_through;

CREATE UNIQUE INDEX mv_listing_offer_state_v2_key_idx
  ON command.mv_listing_offer_state_v2 (asin, state, start_day);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mv_listing_sales_loss_v2', 'mv_listing_offer_state_v2'] LOOP
    EXECUTE format('REVOKE ALL ON command.%I FROM PUBLIC', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON command.%I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON command.%I FROM authenticated', t); END IF;
    EXECUTE format('GRANT SELECT ON command.%I TO service_role', t);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.canvas_listing_sales_loss_v2
WITH (security_invoker = false) AS
SELECT * FROM command.mv_listing_sales_loss_v2;

CREATE OR REPLACE VIEW public.canvas_listing_offer_state_v2
WITH (security_invoker = false) AS
SELECT * FROM command.mv_listing_offer_state_v2;

COMMENT ON VIEW public.canvas_listing_sales_loss_v2 IS
  'Analyst estimate. Missed Amazon sales per listing for the last 30, 90 and 365 days, including listings with no active offer (current_price may be NULL). Population: live listings plus every listing in the retail read. Sales source order: brand-reported (brand-led clients, not yet collected), then SmartScout (Amazon.com, USD); revenue_source names it. Sales per in-stock day = source revenue / Keepa in-stock days. Missed = that rate x out-of-stock days. No 80% factor and no no-Buy-Box dollar. NULL dollars with an awaiting_inputs_reason means awaiting inputs, never zero. Sales-rank drops are activity signals, never dollars. Precomputed hourly (command.mv_listing_sales_loss_v2).';

COMMENT ON VIEW public.canvas_listing_offer_state_v2 IS
  'Keepa (Amazon.com) daily history. One row per stretch of consecutive days a listing was out of stock or had no Buy Box, last 365 days, for the same population as canvas_listing_sales_loss_v2. rank_drops_activity is an activity signal, never dollars. Precomputed hourly (command.mv_listing_offer_state_v2).';

REVOKE ALL ON TABLE public.canvas_listing_sales_loss_v2 FROM PUBLIC;
REVOKE ALL ON TABLE public.canvas_listing_offer_state_v2 FROM PUBLIC;
GRANT SELECT ON TABLE public.canvas_listing_sales_loss_v2 TO anon, authenticated;
GRANT SELECT ON TABLE public.canvas_listing_offer_state_v2 TO anon, authenticated;
GRANT ALL ON TABLE public.canvas_listing_sales_loss_v2 TO service_role;
GRANT ALL ON TABLE public.canvas_listing_offer_state_v2 TO service_role;

-- Hourly refresh, offset from refresh_stock_loss (:17) so the two do not run together.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh_stock_loss_v2';
SELECT cron.schedule(
  'refresh_stock_loss_v2',
  '37 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY command.mv_listing_sales_loss_v2; REFRESH MATERIALIZED VIEW CONCURRENTLY command.mv_listing_offer_state_v2;$$
);

NOTIFY pgrst, 'reload schema';
