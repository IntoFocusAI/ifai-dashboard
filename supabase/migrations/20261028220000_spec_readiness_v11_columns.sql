-- Columns for fender_spec_readiness_audit v11 (2026-10-28). Applied to prod 2026-10-29 as
-- spec_readiness_v11_columns. The ALTER was also applied to the sandbox, mirror and claude copies,
-- the job's dual-write targets, so v11 inserts land on all four.
-- Every new column is nullable. Null means the read did not produce that value, never false or zero.

ALTER TABLE command.fmic_spec_readiness
  ADD COLUMN IF NOT EXISTS collector_version text,
  ADD COLUMN IF NOT EXISTS fender_page_source text,
  ADD COLUMN IF NOT EXISTS fender_identity_match text,
  ADD COLUMN IF NOT EXISTS fender_variant_sku text,
  ADD COLUMN IF NOT EXISTS fender_spec_values jsonb,
  ADD COLUMN IF NOT EXISTS fender_rating_markup boolean,
  ADD COLUMN IF NOT EXISTS amazon_spec_values jsonb,
  ADD COLUMN IF NOT EXISTS amazon_gtin text,
  ADD COLUMN IF NOT EXISTS amazon_mpn text,
  ADD COLUMN IF NOT EXISTS amazon_aplus_state text,
  ADD COLUMN IF NOT EXISTS amazon_aplus_image_count integer,
  ADD COLUMN IF NOT EXISTS amazon_video_state text,
  ADD COLUMN IF NOT EXISTS amazon_bullet_count integer,
  ADD COLUMN IF NOT EXISTS amazon_image_count integer;

COMMENT ON COLUMN command.fmic_spec_readiness.fender_page_source IS
  'How the fender.com page was chosen: findability (the page Findability accepted) or search (v10 search, variant match required). Null when no page was accepted.';
COMMENT ON COLUMN command.fmic_spec_readiness.fender_identity_match IS
  'How this listing''s variant was found on the page: sku (Fender SKU), upc, or none (a Findability family page that does not list this variant).';
COMMENT ON COLUMN command.fmic_spec_readiness.fender_spec_values IS
  'The matched variant''s fender.com spec table, heading -> value, as displayed on the page.';
COMMENT ON COLUMN command.fmic_spec_readiness.amazon_spec_values IS
  'The 13 Amazon product_details values the spec read checks, field -> value.';
COMMENT ON COLUMN command.fmic_spec_readiness.amazon_aplus_state IS
  'present or absent from the live Amazon page (aplus-media images in the description). Null when the page did not fully parse.';
COMMENT ON COLUMN command.fmic_spec_readiness.amazon_video_state IS
  'present or absent from the live Amazon page (has_videos). Null when the page did not fully parse.';

-- The latest row per ASIN, limited to listings the job still checks (a known Buy Box seller).
-- Listings that left that population no longer carry a stale reading into the dashboard.
CREATE OR REPLACE VIEW canvas_private.spec_latest AS
SELECT DISTINCT ON (s.asin) s.id,
  s.asin, s.title, s.category,
  s.amazon_fields_found, s.amazon_fields_expected, s.amazon_completeness_pct, s.amazon_missing_fields, s.amazon_checked,
  s.fender_url, s.fender_found, s.fender_fields_found, s.fender_fields_expected, s.fender_completeness_pct, s.fender_missing_fields,
  s.checked_at, s.batch_run_id, s.created_at,
  s.collector_version, s.fender_page_source, s.fender_identity_match, s.fender_variant_sku,
  s.fender_spec_values, s.fender_rating_markup, s.amazon_spec_values, s.amazon_gtin, s.amazon_mpn,
  s.amazon_aplus_state, s.amazon_aplus_image_count, s.amazon_video_state, s.amazon_bullet_count, s.amazon_image_count
FROM command.fmic_spec_readiness s
JOIN command.fmic_electric_catalog c ON c.asin = s.asin AND c.buybox_seller IS NOT NULL
ORDER BY s.asin, s.checked_at DESC NULLS LAST;

CREATE OR REPLACE VIEW public.canvas_spec_readiness AS
SELECT asin, title, category, amazon_checked, amazon_fields_found, amazon_fields_expected,
  amazon_completeness_pct, amazon_missing_fields, fender_url, fender_found, fender_fields_found,
  fender_fields_expected, fender_completeness_pct, fender_missing_fields, checked_at,
  collector_version, fender_page_source, fender_identity_match, fender_variant_sku,
  fender_spec_values, fender_rating_markup, amazon_spec_values, amazon_gtin, amazon_mpn,
  amazon_aplus_state, amazon_aplus_image_count, amazon_video_state, amazon_bullet_count, amazon_image_count
FROM canvas_private.spec_latest;

-- A+ and video: a live-page read (present or absent) wins over Keepa, whose none_reported is unknown.
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
  l.checked_at
FROM command.fmic_listing_content l
JOIN command.fmic_electric_catalog c USING (asin)
LEFT JOIN canvas_private.spec_latest s USING (asin)
WHERE COALESCE(c.current_price, 0) > 0;

NOTIFY pgrst, 'reload schema';
