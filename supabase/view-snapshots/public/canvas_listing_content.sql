-- public.canvas_listing_content (view) — live definition snapshot, do not apply
--   asin: text
--   title: text
--   bullet_count: integer
--   image_count: integer
--   main_image_px: integer
--   aplus_state: text
--   aplus_module_count: integer
--   video_state: text
--   video_count: integer
--   content_checked_at: timestamp with time zone
--   checked_at: timestamp with time zone
--   aplus_source: text
--   video_source: text
CREATE OR REPLACE VIEW public.canvas_listing_content AS
 SELECT l.asin,
    c.title,
    l.bullet_count,
    l.image_count,
    l.main_image_px,
    COALESCE(s.amazon_aplus_state, l.aplus_state, 'not_collected'::text) AS aplus_state,
    l.aplus_module_count,
    COALESCE(s.amazon_video_state, l.video_state, 'not_collected'::text) AS video_state,
    l.video_count,
    l.content_checked_at,
    l.checked_at,
        CASE
            WHEN s.amazon_aplus_state IS NOT NULL THEN 'live_page'::text
            WHEN l.aplus_state IS NOT NULL THEN 'keepa'::text
            ELSE NULL::text
        END AS aplus_source,
        CASE
            WHEN s.amazon_video_state IS NOT NULL THEN 'live_page'::text
            WHEN l.video_state IS NOT NULL THEN 'keepa'::text
            ELSE NULL::text
        END AS video_source
   FROM command.fmic_listing_content l
     JOIN command.fmic_electric_catalog c USING (asin)
     LEFT JOIN canvas_private.spec_latest s USING (asin)
  WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric;
