-- public.canvas_listing_sales_loss_v2 (view) — live definition snapshot, do not apply
--   asin: character varying
--   title: text
--   is_bundle: boolean
--   current_price: numeric(10,2)
--   featured_offer_state: text
--   featured_offer_checked_at: timestamp with time zone
--   history_from: date
--   history_through: date
--   last_in_stock_day: date
--   offline_now: boolean
--   current_oos_days: bigint
--   observed_days_30: bigint
--   in_stock_days_30: bigint
--   oos_days_30: bigint
--   no_buy_box_days_30: bigint
--   observed_days_90: bigint
--   oos_days_90: bigint
--   no_buy_box_days_90: bigint
--   observed_days_365: bigint
--   in_stock_days_365: bigint
--   oos_days_365: bigint
--   no_buy_box_days_365: bigint
--   current_stretch_rank_drops: bigint
--   sales_rank_current: integer
--   sales_rank_drops_30: integer
--   sales_rank_drops_90: integer
--   smartscout_snapshot_date: date
--   smartscout_monthly_units: integer
--   smartscout_monthly_revenue: numeric(14,2)
--   smartscout_ttm_revenue: numeric(14,2)
--   smartscout_prev_12m_revenue: numeric(14,2)
--   revenue_source: text
--   baseline_method: text
--   currency: text
--   revenue_window_start: date
--   revenue_window_end: date
--   in_stock_days_used: bigint
--   baseline_daily_revenue: numeric
--   est_lost_revenue_oos_30: numeric
--   est_lost_revenue_oos_90: numeric
--   est_lost_revenue_oos_365: numeric
--   estimate_label: text
--   awaiting_inputs_reason: text
--   keepa_checked_at: timestamp with time zone
CREATE OR REPLACE VIEW public.canvas_listing_sales_loss_v2 AS
 SELECT asin,
    title,
    is_bundle,
    current_price,
    featured_offer_state,
    featured_offer_checked_at,
    history_from,
    history_through,
    last_in_stock_day,
    offline_now,
    current_oos_days,
    observed_days_30,
    in_stock_days_30,
    oos_days_30,
    no_buy_box_days_30,
    observed_days_90,
    oos_days_90,
    no_buy_box_days_90,
    observed_days_365,
    in_stock_days_365,
    oos_days_365,
    no_buy_box_days_365,
    current_stretch_rank_drops,
    sales_rank_current,
    sales_rank_drops_30,
    sales_rank_drops_90,
    smartscout_snapshot_date,
    smartscout_monthly_units,
    smartscout_monthly_revenue,
    smartscout_ttm_revenue,
    smartscout_prev_12m_revenue,
    revenue_source,
    baseline_method,
    currency,
    revenue_window_start,
    revenue_window_end,
    in_stock_days_used,
    baseline_daily_revenue,
    est_lost_revenue_oos_30,
    est_lost_revenue_oos_90,
    est_lost_revenue_oos_365,
    estimate_label,
    awaiting_inputs_reason,
    keepa_checked_at
   FROM command.mv_listing_sales_loss_v2;
