-- public.canvas_spec_readiness (view) — live definition snapshot, do not apply
--   asin: character varying
--   title: text
--   category: character varying
--   amazon_checked: boolean
--   amazon_fields_found: integer
--   amazon_fields_expected: integer
--   amazon_completeness_pct: double precision
--   amazon_missing_fields: text
--   fender_url: text
--   fender_found: boolean
--   fender_fields_found: integer
--   fender_fields_expected: integer
--   fender_completeness_pct: double precision
--   fender_missing_fields: text
--   checked_at: timestamp with time zone
--   collector_version: text
--   fender_page_source: text
--   fender_identity_match: text
--   fender_variant_sku: text
--   fender_spec_values: jsonb
--   fender_rating_markup: boolean
--   amazon_spec_values: jsonb
--   amazon_gtin: text
--   amazon_mpn: text
--   amazon_aplus_state: text
--   amazon_aplus_image_count: integer
--   amazon_video_state: text
--   amazon_bullet_count: integer
--   amazon_image_count: integer
CREATE OR REPLACE VIEW public.canvas_spec_readiness AS
 SELECT asin,
    title,
    category,
    amazon_checked,
    amazon_fields_found,
    amazon_fields_expected,
    amazon_completeness_pct,
    amazon_missing_fields,
    fender_url,
    fender_found,
    fender_fields_found,
    fender_fields_expected,
    fender_completeness_pct,
    fender_missing_fields,
    checked_at,
    collector_version,
    fender_page_source,
    fender_identity_match,
    fender_variant_sku,
    fender_spec_values,
    fender_rating_markup,
    amazon_spec_values,
    amazon_gtin,
    amazon_mpn,
    amazon_aplus_state,
    amazon_aplus_image_count,
    amazon_video_state,
    amazon_bullet_count,
    amazon_image_count
   FROM canvas_private.spec_latest;
