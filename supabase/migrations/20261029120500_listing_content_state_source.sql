-- Where each A+ and video state comes from (2026-10-29). live_page = spec_readiness v11 read the
-- live Amazon page (present or absent). keepa = Keepa only (present confirmed, none_reported unknown).
-- The A+ Matrix shares count live_page rows only, so Keepa's present never inflates them.
CREATE OR REPLACE VIEW public.canvas_listing_content
WITH (security_invoker = false) AS
SELECT l.asin,
  c.title,
  l.bullet_count,
  l.image_count,
  l.main_image_px,
  COALESCE(s.amazon_aplus_state, l.aplus_state, 'not_collected') AS aplus_state,
  l.aplus_module_count,
  COALESCE(s.amazon_video_state, l.video_state, 'not_collected') AS video_state,
  l.video_count,
  l.content_checked_at,
  l.checked_at,
  CASE WHEN s.amazon_aplus_state IS NOT NULL THEN 'live_page' WHEN l.aplus_state IS NOT NULL THEN 'keepa' END AS aplus_source,
  CASE WHEN s.amazon_video_state IS NOT NULL THEN 'live_page' WHEN l.video_state IS NOT NULL THEN 'keepa' END AS video_source
FROM command.fmic_listing_content l
JOIN command.fmic_electric_catalog c USING (asin)
LEFT JOIN canvas_private.spec_latest s USING (asin)
WHERE COALESCE(c.current_price, 0) > 0;
COMMENT ON VIEW public.canvas_listing_content IS
  'Amazon listing content per live listing (catalog row with a current price). bullet_count and image_count are from Keepa product objects. aplus_state / video_state: a live-page read (spec_readiness v11, source live_page) wins and is present or absent; otherwise Keepa (source keepa), where present is confirmed and none_reported is unknown. not_collected = not read yet.';
NOTIFY pgrst, 'reload schema';
