-- Estimated sales lost to out-of-stock and Buy Box suppression, per live listing (2026-10-27).
-- One row per live Amazon listing (command.fmic_electric_catalog, current_price > 0). Every dollar
-- figure is an analyst estimate, and each row carries the inputs it was built from.
--
-- Day states come from command.fmic_keepa_daily. A day with no row is unknown, never in stock:
--   out of stock  no New offer from any seller (new_price_close IS NULL)
--   suppressed    a New offer exists but Amazon showed no Buy Box (buybox_price_close IS NULL)
--   in stock      a New offer exists
--
-- Baseline revenue per in-stock day, first that applies:
--   ttm_per_in_stock_day  SmartScout trailing-12-month revenue / in-stock days in the last 365 (needs 30+)
--   30d_per_in_stock_day  SmartScout monthly revenue / in-stock days in the last 30 (needs 7+)
-- Dividing by in-stock days, not calendar days, keeps a stockout from lowering its own baseline.
-- SmartScout's windows and the Keepa day windows line up only approximately.
--
-- Lost revenue = baseline x out-of-stock days. The suppressed figure assumes no sales without a
-- Buy Box, so it is an upper bound.

CREATE OR REPLACE VIEW public.canvas_listing_sales_loss
WITH (security_invoker = false) AS
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

COMMENT ON VIEW public.canvas_listing_sales_loss IS
  'Analyst estimate. Sales lost to out-of-stock and Buy Box suppression per live Amazon listing. Out of stock = no New offer from any seller that day (Keepa). Suppressed = a New offer but no Buy Box. Days with no Keepa row are unknown and not counted. Baseline = SmartScout revenue per in-stock day (baseline_method names which). Lost = baseline x days. Suppressed figures assume no sales without a Buy Box and are upper bounds. NULL baseline means not enough data to estimate, never zero loss.';

COMMENT ON COLUMN public.canvas_listing_sales_loss.baseline_method IS
  'ttm_per_in_stock_day: SmartScout trailing-12-month revenue / in-stock days in the last 365 (30+ needed). 30d_per_in_stock_day: SmartScout monthly revenue / in-stock days in the last 30 (7+ needed). NULL: no estimate.';

REVOKE ALL ON TABLE public.canvas_listing_sales_loss FROM PUBLIC;
REVOKE ALL ON TABLE public.canvas_listing_sales_loss FROM anon, authenticated;
GRANT SELECT ON TABLE public.canvas_listing_sales_loss TO anon, authenticated;
GRANT ALL ON TABLE public.canvas_listing_sales_loss TO service_role;

NOTIFY pgrst, 'reload schema';
