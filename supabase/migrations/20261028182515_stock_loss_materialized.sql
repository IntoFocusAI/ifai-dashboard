-- Precompute the out-of-stock and lost-sales reads (2026-10-28).
-- canvas_listing_sales_loss took about 3.4s per browser read and hit the anon statement timeout
-- (HTTP 500), and canvas_listing_stock_episodes took about 2.2s. Both aggregate a year of
-- command.fmic_keepa_daily per call. The logic moves unchanged into materialized views in
-- command, refreshed hourly by pg_cron; the public views keep their names, columns and grants
-- and read the stored rows. Day windows count back from the last refresh, not the moment of the
-- read, so a row can be up to an hour behind.

CREATE MATERIALIZED VIEW IF NOT EXISTS command.mv_listing_sales_loss AS
WITH live AS (
  SELECT c.asin, c.title
  FROM command.fmic_electric_catalog c
  WHERE COALESCE(c.current_price, 0) > 0
), ss AS (
  SELECT DISTINCT ON (asin) asin, snapshot_date, est_monthly_units, est_monthly_revenue, ttm_revenue, prev_12m_revenue
  FROM command.fmic_smartscout_products
  ORDER BY asin, snapshot_date DESC
), d AS (
  SELECT k.asin,
    count(*) FILTER (WHERE k.day > current_date - 30) AS observed_days_30,
    count(*) FILTER (WHERE k.day > current_date - 30 AND k.new_price_close IS NOT NULL) AS in_stock_days_30,
    count(*) FILTER (WHERE k.day > current_date - 90) AS observed_days_90,
    count(*) FILTER (WHERE k.day > current_date - 90 AND k.new_price_close IS NULL) AS oos_days_90,
    count(*) FILTER (WHERE k.day > current_date - 90 AND k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS suppressed_days_90,
    count(*) AS observed_days_365,
    count(*) FILTER (WHERE k.new_price_close IS NOT NULL) AS in_stock_days_365,
    count(*) FILTER (WHERE k.new_price_close IS NULL) AS oos_days_365,
    count(*) FILTER (WHERE k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS suppressed_days_365,
    max(k.day) AS history_through
  FROM command.fmic_keepa_daily k
  JOIN live USING (asin)
  WHERE k.day > current_date - 365
  GROUP BY k.asin
), b AS (
  SELECT live.asin, live.title, ss.snapshot_date, ss.est_monthly_units, ss.est_monthly_revenue, ss.ttm_revenue, ss.prev_12m_revenue,
    d.observed_days_30, d.in_stock_days_30, d.observed_days_90, d.oos_days_90, d.suppressed_days_90,
    d.observed_days_365, d.in_stock_days_365, d.oos_days_365, d.suppressed_days_365, d.history_through,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN 'ttm_per_in_stock_day'
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN '30d_per_in_stock_day'
    END AS baseline_method,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN ss.ttm_revenue / d.in_stock_days_365
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN ss.est_monthly_revenue / d.in_stock_days_30
    END AS baseline_daily_revenue
  FROM live
  LEFT JOIN ss USING (asin)
  LEFT JOIN d USING (asin)
)
SELECT b.asin,
  b.title,
  b.snapshot_date AS smartscout_snapshot_date,
  b.est_monthly_units AS smartscout_monthly_units,
  b.est_monthly_revenue AS smartscout_monthly_revenue,
  b.ttm_revenue AS smartscout_ttm_revenue,
  b.prev_12m_revenue AS smartscout_prev_12m_revenue,
  k.sales_rank_current,
  k.sales_rank_drops_30,
  k.sales_rank_drops_90,
  b.history_through,
  b.observed_days_30,
  b.in_stock_days_30,
  b.observed_days_90,
  b.oos_days_90,
  b.suppressed_days_90,
  b.observed_days_365,
  b.in_stock_days_365,
  b.oos_days_365,
  b.suppressed_days_365,
  b.baseline_method,
  round(b.baseline_daily_revenue, 2) AS baseline_daily_revenue,
  round(b.baseline_daily_revenue * b.oos_days_90, 2) AS est_lost_revenue_oos_90,
  round(b.baseline_daily_revenue * b.suppressed_days_90, 2) AS est_lost_revenue_suppressed_90_max,
  round(b.baseline_daily_revenue * b.oos_days_365, 2) AS est_lost_revenue_oos_365,
  round(b.baseline_daily_revenue * b.suppressed_days_365, 2) AS est_lost_revenue_suppressed_365_max
FROM b
LEFT JOIN command.fmic_keepa_stats k USING (asin);

CREATE UNIQUE INDEX IF NOT EXISTS mv_listing_sales_loss_asin_idx ON command.mv_listing_sales_loss (asin);

CREATE MATERIALIZED VIEW IF NOT EXISTS command.mv_listing_stock_episodes AS
WITH live AS (
  SELECT c.asin
  FROM command.fmic_electric_catalog c
  WHERE COALESCE(c.current_price, 0) > 0
), days AS (
  SELECT k.asin, k.day,
    CASE
      WHEN k.new_price_close IS NULL THEN 'out_of_stock'
      WHEN k.buybox_price_close IS NULL THEN 'no_buy_box'
      ELSE 'in_stock'
    END AS state
  FROM command.fmic_keepa_daily k
  JOIN live USING (asin)
  WHERE k.day > current_date - 365
), latest AS (
  SELECT asin, max(day) AS history_through FROM days GROUP BY asin
), grouped AS (
  SELECT asin, day, state,
    day - (row_number() OVER (PARTITION BY asin, state ORDER BY day))::int AS grp
  FROM days
)
SELECT g.asin,
  g.state,
  min(g.day) AS start_day,
  max(g.day) AS end_day,
  count(*)::int AS days,
  max(g.day) = l.history_through AS ongoing
FROM grouped g
JOIN latest l USING (asin)
WHERE g.state <> 'in_stock'
GROUP BY g.asin, g.state, g.grp, l.history_through;

CREATE UNIQUE INDEX IF NOT EXISTS mv_listing_stock_episodes_key_idx
  ON command.mv_listing_stock_episodes (asin, state, start_day);

-- Same access model as the other command objects: service_role only. The browser reads the
-- public views below, which run with owner rights.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mv_listing_sales_loss', 'mv_listing_stock_episodes'] LOOP
    EXECUTE format('REVOKE ALL ON command.%I FROM PUBLIC', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON command.%I FROM anon', t); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON command.%I FROM authenticated', t); END IF;
    EXECUTE format('GRANT SELECT ON command.%I TO service_role', t);
  END LOOP;
END $$;

-- Same names, columns and order as before, so CREATE OR REPLACE keeps the existing grants.
CREATE OR REPLACE VIEW public.canvas_listing_sales_loss
WITH (security_invoker = false) AS
SELECT asin, title, smartscout_snapshot_date, smartscout_monthly_units, smartscout_monthly_revenue,
  smartscout_ttm_revenue, smartscout_prev_12m_revenue, sales_rank_current, sales_rank_drops_30,
  sales_rank_drops_90, history_through, observed_days_30, in_stock_days_30, observed_days_90,
  oos_days_90, suppressed_days_90, observed_days_365, in_stock_days_365, oos_days_365,
  suppressed_days_365, baseline_method, baseline_daily_revenue, est_lost_revenue_oos_90,
  est_lost_revenue_suppressed_90_max, est_lost_revenue_oos_365, est_lost_revenue_suppressed_365_max
FROM command.mv_listing_sales_loss;

CREATE OR REPLACE VIEW public.canvas_listing_stock_episodes
WITH (security_invoker = false) AS
SELECT asin, state, start_day, end_day, days, ongoing
FROM command.mv_listing_stock_episodes;

COMMENT ON VIEW public.canvas_listing_sales_loss IS
  'Analyst estimate. Sales lost to out-of-stock and Buy Box suppression per live Amazon listing. Out of stock = no New offer from any seller that day (Keepa). Suppressed = a New offer but no Buy Box. Days with no Keepa row are unknown and not counted. Baseline = SmartScout revenue per in-stock day (baseline_method names which). Lost = baseline x days. Suppressed figures assume no sales without a Buy Box and are upper bounds. NULL baseline means not enough data to estimate, never zero loss. Precomputed hourly (command.mv_listing_sales_loss).';

COMMENT ON VIEW public.canvas_listing_stock_episodes IS
  'Keepa daily history. One row per stretch of consecutive days a live Amazon listing was out of stock (no New offer from any seller) or had no Buy Box (a New offer but no Buy Box), last 365 days. Days with no Keepa row are unknown and end a stretch. ongoing = the stretch runs through the newest stored day. The dated evidence behind canvas_listing_sales_loss. Precomputed hourly (command.mv_listing_stock_episodes).';

GRANT SELECT ON TABLE public.canvas_listing_sales_loss TO anon, authenticated;
GRANT SELECT ON TABLE public.canvas_listing_stock_episodes TO anon, authenticated;

-- Hourly refresh. CONCURRENTLY keeps the old rows readable while the new ones build.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh_stock_loss';
SELECT cron.schedule(
  'refresh_stock_loss',
  '17 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY command.mv_listing_sales_loss; REFRESH MATERIALIZED VIEW CONCURRENTLY command.mv_listing_stock_episodes;$$
);

NOTIFY pgrst, 'reload schema';
