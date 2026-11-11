-- Dated out-of-stock and no-Buy-Box stretches, per live listing (2026-10-28).
-- The dated evidence behind public.canvas_listing_sales_loss: one row per run of consecutive days a
-- live Amazon listing spent out of stock or without a Buy Box, over the last 365 days.
--
-- Day states use the same rules as canvas_listing_sales_loss (source: command.fmic_keepa_daily):
--   out_of_stock  no New offer from any seller (new_price_close IS NULL)
--   no_buy_box    a New offer exists but Amazon showed no Buy Box (buybox_price_close IS NULL)
-- A day with no Keepa row is unknown and ends a stretch. ongoing is true when the stretch runs
-- through the newest stored day for that listing.

CREATE OR REPLACE VIEW public.canvas_listing_stock_episodes
WITH (security_invoker = false) AS
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

COMMENT ON VIEW public.canvas_listing_stock_episodes IS
  'Keepa daily history. One row per stretch of consecutive days a live Amazon listing was out of stock (no New offer from any seller) or had no Buy Box (a New offer but no Buy Box), last 365 days. Days with no Keepa row are unknown and end a stretch. ongoing = the stretch runs through the newest stored day. The dated evidence behind canvas_listing_sales_loss.';

REVOKE ALL ON TABLE public.canvas_listing_stock_episodes FROM PUBLIC;
REVOKE ALL ON TABLE public.canvas_listing_stock_episodes FROM anon, authenticated;
GRANT SELECT ON TABLE public.canvas_listing_stock_episodes TO anon, authenticated;
GRANT ALL ON TABLE public.canvas_listing_stock_episodes TO service_role;

NOTIFY pgrst, 'reload schema';
