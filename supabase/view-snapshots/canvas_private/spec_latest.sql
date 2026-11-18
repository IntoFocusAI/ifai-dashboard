-- canvas_private.spec_latest (view) — live definition snapshot, do not apply
--   id: character varying
--   asin: character varying
--   title: text
--   category: character varying
--   amazon_fields_found: integer
--   amazon_fields_expected: integer
--   amazon_completeness_pct: double precision
--   amazon_missing_fields: text
--   amazon_checked: boolean
--   fender_url: text
--   fender_found: boolean
--   fender_fields_found: integer
--   fender_fields_expected: integer
--   fender_completeness_pct: double precision
--   fender_missing_fields: text
--   checked_at: timestamp with time zone
--   batch_run_id: character varying
--   created_at: timestamp with time zone
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
CREATE OR REPLACE VIEW canvas_private.spec_latest AS
 SELECT DISTINCT ON (s.asin) s.id,
    s.asin,
    s.title,
    s.category,
    s.amazon_fields_found,
    s.amazon_fields_expected,
    s.amazon_completeness_pct,
    s.amazon_missing_fields,
    s.amazon_checked,
    s.fender_url,
    s.fender_found,
    s.fender_fields_found,
    s.fender_fields_expected,
    s.fender_completeness_pct,
    s.fender_missing_fields,
    s.checked_at,
    s.batch_run_id,
    s.created_at,
    s.collector_version,
    s.fender_page_source,
    s.fender_identity_match,
    s.fender_variant_sku,
    s.fender_spec_values,
    s.fender_rating_markup,
    s.amazon_spec_values,
    s.amazon_gtin,
    s.amazon_mpn,
    s.amazon_aplus_state,
    s.amazon_aplus_image_count,
    s.amazon_video_state,
    s.amazon_bullet_count,
    s.amazon_image_count
   FROM command.fmic_spec_readiness s
     JOIN command.fmic_electric_catalog c ON c.asin::text = s.asin::text AND c.buybox_seller IS NOT NULL
  ORDER BY s.asin, s.checked_at DESC NULLS LAST;
