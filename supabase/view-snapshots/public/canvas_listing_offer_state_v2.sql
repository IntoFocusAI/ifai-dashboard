-- public.canvas_listing_offer_state_v2 (view) — live definition snapshot, do not apply
--   asin: text
--   state: text
--   start_day: date
--   end_day: date
--   days: integer
--   ongoing: boolean
--   rank_drops_activity: integer
--   source: text
CREATE OR REPLACE VIEW public.canvas_listing_offer_state_v2 AS
 SELECT asin,
    state,
    start_day,
    end_day,
    days,
    ongoing,
    rank_drops_activity,
    source
   FROM command.mv_listing_offer_state_v2;
