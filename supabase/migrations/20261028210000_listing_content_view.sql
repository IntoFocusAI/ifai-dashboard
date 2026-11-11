-- Amazon listing content per live listing, for the Amazon A+ Matrix tab (2026-10-28).
-- Source: command.fmic_listing_content. Live = a current price on the catalog row, the same rule
-- as canvas_listing_stock_episodes.
--
-- bullet_count and image_count come from Keepa product objects (fender_catalog_harvester) and match
-- the live Amazon page. aplus_state and video_state come from fender_keepa_content_enrich. Keepa does
-- not refresh A+ or video on a product request, so 'present' is confirmed and 'none_reported' is
-- unknown, not absent. 'not_collected' means the content read has not run for that listing.
CREATE OR REPLACE VIEW public.canvas_listing_content
WITH (security_invoker = false) AS
SELECT l.asin,
  c.title,
  l.bullet_count,
  l.image_count,
  l.main_image_px,
  COALESCE(l.aplus_state, 'not_collected') AS aplus_state,
  l.aplus_module_count,
  COALESCE(l.video_state, 'not_collected') AS video_state,
  l.video_count,
  l.content_checked_at,
  l.checked_at
FROM command.fmic_listing_content l
JOIN command.fmic_electric_catalog c USING (asin)
WHERE COALESCE(c.current_price, 0) > 0;
COMMENT ON VIEW public.canvas_listing_content IS
  'Amazon listing content per live listing (catalog row with a current price). bullet_count and image_count are from Keepa product objects. aplus_state / video_state: present = confirmed, none_reported = Keepa holds none (unknown, not absent), not_collected = not read yet.';
REVOKE ALL ON TABLE public.canvas_listing_content FROM PUBLIC;
REVOKE ALL ON TABLE public.canvas_listing_content FROM anon, authenticated;
GRANT SELECT ON TABLE public.canvas_listing_content TO anon, authenticated;
GRANT ALL ON TABLE public.canvas_listing_content TO service_role;
NOTIFY pgrst, 'reload schema';
