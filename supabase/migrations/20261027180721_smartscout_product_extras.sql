-- SmartScout product snapshot: extra fields available on the Business plan (2026-10-27).
-- TTM and previous-12-month revenue give a year-over-year view per ASIN even though the plan
-- has no month-by-month product history.
ALTER TABLE command.fmic_smartscout_products
  ADD COLUMN IF NOT EXISTS parent_asin text,
  ADD COLUMN IF NOT EXISTS ttm_revenue numeric(14,2),
  ADD COLUMN IF NOT EXISTS prev_12m_revenue numeric(14,2),
  ADD COLUMN IF NOT EXISTS seller_count integer,
  ADD COLUMN IF NOT EXISTS fba_seller_count integer,
  ADD COLUMN IF NOT EXISTS amazon_in_stock_rate_90 numeric(5,4),
  ADD COLUMN IF NOT EXISTS page_score numeric(4,1),
  ADD COLUMN IF NOT EXISTS primary_subcategory_rank integer,
  ADD COLUMN IF NOT EXISTS listed_since date,
  ADD COLUMN IF NOT EXISTS smartscout_last_refreshed date,
  ADD COLUMN IF NOT EXISTS is_out_of_stock boolean;
