-- public.canvas_listing_stock_episodes (view) — live definition snapshot, do not apply
--   asin: text
--   state: text
--   start_day: date
--   end_day: date
--   days: integer
--   ongoing: boolean
CREATE OR REPLACE VIEW public.canvas_listing_stock_episodes AS
 SELECT asin,
    state,
    start_day,
    end_day,
    days,
    ongoing
   FROM command.mv_listing_stock_episodes;
