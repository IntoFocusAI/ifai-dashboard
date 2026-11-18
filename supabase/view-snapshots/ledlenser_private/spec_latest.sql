-- ledlenser_private.spec_latest (view) — live definition snapshot, do not apply
--   id: character varying
--   asin: character varying
--   title: text
--   category: character varying
--   amazon_fields_found: integer
--   amazon_fields_expected: integer
--   amazon_completeness_pct: double precision
--   amazon_missing_fields: text
--   amazon_checked: boolean
--   brand_site_url: text
--   brand_site_found: boolean
--   brand_site_fields_found: integer
--   brand_site_fields_expected: integer
--   brand_site_completeness_pct: double precision
--   brand_site_missing_fields: text
--   checked_at: timestamp with time zone
--   batch_run_id: character varying
--   created_at: timestamp with time zone
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
CREATE OR REPLACE VIEW ledlenser_private.spec_latest AS
 SELECT DISTINCT ON (s.asin) s.id,
    s.asin,
    s.title,
    s.category,
    s.amazon_fields_found,
    s.amazon_fields_expected,
    s.amazon_completeness_pct,
    s.amazon_missing_fields,
    s.amazon_checked,
    s.brand_site_url,
    s.brand_site_found,
    s.brand_site_fields_found,
    s.brand_site_fields_expected,
    s.brand_site_completeness_pct,
    s.brand_site_missing_fields,
    s.checked_at,
    s.batch_run_id,
    s.created_at,
    s.collector_version,
    s.brand_site_page_source,
    s.brand_site_identity_match,
    s.brand_site_variant_sku,
    s.brand_site_spec_values,
    s.brand_site_rating_markup,
    s.amazon_spec_values,
    s.amazon_gtin,
    s.amazon_mpn,
    s.amazon_aplus_state,
    s.amazon_aplus_image_count,
    s.amazon_video_state,
    s.amazon_bullet_count,
    s.amazon_image_count
   FROM ledlenser.spec_readiness s
     JOIN ledlenser.catalog c ON c.asin::text = s.asin::text AND c.buybox_seller IS NOT NULL AND (c.brand_sku IS NOT NULL OR c.title ~~* '%led%lenser%'::text)
  ORDER BY s.asin, s.checked_at DESC NULLS LAST;
