-- public.canvas_listing_sales_loss (view) — live definition snapshot, do not apply
--   asin: character varying
--   title: text
--   smartscout_snapshot_date: date
--   smartscout_monthly_units: integer
--   smartscout_monthly_revenue: numeric(14,2)
--   smartscout_ttm_revenue: numeric(14,2)
--   smartscout_prev_12m_revenue: numeric(14,2)
--   sales_rank_current: integer
--   sales_rank_drops_30: integer
--   sales_rank_drops_90: integer
--   history_through: date
--   observed_days_30: bigint
--   in_stock_days_30: bigint
--   observed_days_90: bigint
--   oos_days_90: bigint
--   suppressed_days_90: bigint
--   observed_days_365: bigint
--   in_stock_days_365: bigint
--   oos_days_365: bigint
--   suppressed_days_365: bigint
--   baseline_method: text
--   baseline_daily_revenue: numeric
--   est_lost_revenue_oos_90: numeric
--   est_lost_revenue_suppressed_90_max: numeric
--   est_lost_revenue_oos_365: numeric
--   est_lost_revenue_suppressed_365_max: numeric
CREATE OR REPLACE VIEW public.canvas_listing_sales_loss AS
 SELECT asin,
    title,
    smartscout_snapshot_date,
    smartscout_monthly_units,
    smartscout_monthly_revenue,
    smartscout_ttm_revenue,
    smartscout_prev_12m_revenue,
    sales_rank_current,
    sales_rank_drops_30,
    sales_rank_drops_90,
    history_through,
    observed_days_30,
    in_stock_days_30,
    observed_days_90,
    oos_days_90,
    suppressed_days_90,
    observed_days_365,
    in_stock_days_365,
    oos_days_365,
    suppressed_days_365,
    baseline_method,
    baseline_daily_revenue,
    est_lost_revenue_oos_90,
    est_lost_revenue_suppressed_90_max,
    est_lost_revenue_oos_365,
    est_lost_revenue_suppressed_365_max
   FROM command.mv_listing_sales_loss;
