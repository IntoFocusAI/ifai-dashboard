-- ledlenser.canvas_spec_readiness (view) — live definition snapshot, do not apply
--   asin: character varying
--   title: text
--   category: character varying
--   amazon_checked: boolean
--   amazon_fields_found: integer
--   amazon_fields_expected: integer
--   amazon_completeness_pct: double precision
--   amazon_missing_fields: text
--   brand_site_url: text
--   brand_site_found: boolean
--   brand_site_fields_found: integer
--   brand_site_fields_expected: integer
--   brand_site_completeness_pct: double precision
--   brand_site_missing_fields: text
--   checked_at: timestamp with time zone
--   collector_version: text
--   brand_site_page_source: text
--   brand_site_identity_match: text
--   brand_site_variant_sku: text
--   brand_site_spec_values: jsonb
--   brand_site_rating_markup: boolean
--   amazon_spec_values: jsonb
--   amazon_gtin: text
--   amazon_mpn: text
--   amazon_aplus_state: text
--   amazon_aplus_image_count: integer
--   amazon_video_state: text
--   amazon_bullet_count: integer
--   amazon_image_count: integer
CREATE OR REPLACE VIEW ledlenser.canvas_spec_readiness AS
 SELECT asin,
    title,
    category,
    amazon_checked,
    amazon_fields_found,
    amazon_fields_expected,
    amazon_completeness_pct,
    amazon_missing_fields,
    brand_site_url,
    brand_site_found,
    brand_site_fields_found,
    brand_site_fields_expected,
    brand_site_completeness_pct,
    brand_site_missing_fields,
    checked_at,
    collector_version,
    brand_site_page_source,
    brand_site_identity_match,
    brand_site_variant_sku,
    brand_site_spec_values,
    brand_site_rating_markup,
    amazon_spec_values,
    amazon_gtin,
    amazon_mpn,
    amazon_aplus_state,
    amazon_aplus_image_count,
    amazon_video_state,
    amazon_bullet_count,
    amazon_image_count
   FROM ledlenser_private.spec_latest;
