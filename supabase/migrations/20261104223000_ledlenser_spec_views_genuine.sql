-- Ledlenser spec views: count genuine Ledlenser listings only, and say which are on the brand's product sheet (2026-11-04).
--
-- What changes
--   1. ledlenser_private.spec_latest (feeds canvas_spec_readiness and canvas_spec_missing_fields) and
--      ledlenser.canvas_spec_findability now include a catalog listing only when it is a genuine Ledlenser
--      listing: on the brand's product sheet (brand_sku IS NOT NULL) or titled Ledlenser / LED Lenser.
--      This is the same population the Spec Readiness collector (ledlenser_spec_readiness_audit) checks.
--      Before this, 10 listings with a Buy Box seller but not Ledlenser (for example "99 Lighting" LED strips
--      tagged brand Ledlenser on Amazon) showed as never checked.
--   2. ledlenser.canvas_spec_findability gains one column at the end, on_brand_sheet (boolean), so the
--      dashboard can show how listings on Ledlenser's product sheet fare next to the other Ledlenser-titled
--      listings (older accessories, discontinued models, imports).
--
-- Alters two existing views (no table or data change; grants and security_invoker are kept by CREATE OR REPLACE).
-- Fender's views in public are untouched.
--
-- Undo: run the two CREATE OR REPLACE VIEW statements at the bottom of this file (commented out). The
-- on_brand_sheet column cannot be dropped by CREATE OR REPLACE, so the undo for canvas_spec_findability
-- drops and recreates it, then re-grants SELECT to anon and authenticated.

BEGIN;

CREATE OR REPLACE VIEW ledlenser_private.spec_latest AS
SELECT DISTINCT ON (s.asin)
  s.id, s.asin, s.title, s.category,
  s.amazon_fields_found, s.amazon_fields_expected, s.amazon_completeness_pct, s.amazon_missing_fields, s.amazon_checked,
  s.brand_site_url, s.brand_site_found, s.brand_site_fields_found, s.brand_site_fields_expected,
  s.brand_site_completeness_pct, s.brand_site_missing_fields,
  s.checked_at, s.batch_run_id, s.created_at, s.collector_version,
  s.brand_site_page_source, s.brand_site_identity_match, s.brand_site_variant_sku, s.brand_site_spec_values,
  s.brand_site_rating_markup, s.amazon_spec_values, s.amazon_gtin, s.amazon_mpn,
  s.amazon_aplus_state, s.amazon_aplus_image_count, s.amazon_video_state, s.amazon_bullet_count, s.amazon_image_count
FROM ledlenser.spec_readiness s
JOIN ledlenser.catalog c
  ON c.asin::text = s.asin::text
 AND c.buybox_seller IS NOT NULL
 AND (c.brand_sku IS NOT NULL OR c.title ILIKE '%led%lenser%')
ORDER BY s.asin, s.checked_at DESC NULLS LAST;

CREATE OR REPLACE VIEW ledlenser.canvas_spec_findability WITH (security_invoker = false) AS
SELECT cat.asin,
  COALESCE(f.title, cat.title) AS title,
  COALESCE(f.category, cat.category::text) AS category,
  COALESCE(f.findability_state::text, 'not_checked') AS latest_state,
  f.attempt_at AS latest_attempt_at,
  f.canonical_url AS latest_canonical_url,
  f.variant_sku AS latest_variant_sku,
  f.last_success_state,
  f.last_success_url,
  f.last_success_variant_sku,
  f.last_success_at,
  f.last_success_explanation,
  f.last_success_schema_profile,
  f.last_success_fields_present AS last_success_present_fields,
  f.last_success_fields_missing AS last_success_missing_applicable_fields,
  f.product_kind::text AS product_kind,
  f.match_confidence AS confidence,
  f.match_explanation AS explanation,
  f.source_method,
  f.last_error AS latest_failure,
  f.schema_profile,
  f.schema_fields_present AS present_fields,
  f.schema_fields_missing AS missing_applicable_fields,
  f.catalog_identity_hash,
  f.last_success_identity_hash,
  f.collector_version,
  f.http_status,
  (f.last_success_at IS NOT NULL AND (
     COALESCE(f.findability_state::text, 'not_checked') <> ALL (ARRAY['exact_official_product', 'official_family_page'])
     OR f.catalog_identity_hash IS DISTINCT FROM f.last_success_identity_hash
     OR f.last_success_at < now() - interval '180 days')) AS success_needs_review,
  COALESCE(f.findability_state::text = ANY (ARRAY['exact_official_product', 'official_family_page']), false) AS counts_as_confirmed,
  COALESCE(f.findability_state::text = ANY (ARRAY['exact_official_product', 'official_family_page', 'ambiguous_candidate', 'completed_not_found']), false) AS counts_as_finished_search,
  COALESCE(f.findability_state::text = 'ambiguous_candidate', false) AS counts_as_ambiguous,
  COALESCE(f.findability_state::text = 'blocked', false) AS counts_as_blocked,
  COALESCE(f.findability_state::text = 'timeout', false) AS counts_as_timeout,
  COALESCE(f.findability_state::text = 'parse_failure', false) AS counts_as_parse_failure,
  (f.asin IS NULL OR f.findability_state::text = 'not_checked') AS counts_as_unchecked,
  (f.last_success_url IS NOT NULL AND f.findability_state::text = ANY (ARRAY['blocked', 'timeout', 'parse_failure'])) AS prior_success_latest_failed,
  (f.last_success_url IS NOT NULL AND f.findability_state::text = 'completed_not_found') AS prior_success_latest_completed_not_found,
  (f.last_success_url IS NOT NULL AND f.findability_state::text = 'ambiguous_candidate') AS prior_success_latest_ambiguous,
  f.jsonld_status,
  true AS counts_as_eligible,
  (f.asin IS NOT NULL) AS counts_as_attempted,
  COALESCE(f.findability_state::text = 'completed_not_found', false) AS counts_as_completed_not_found,
  COALESCE(f.findability_state::text = 'unsupported_product_type', false) AS counts_as_unsupported,
  (cat.brand_sku IS NOT NULL) AS on_brand_sheet
FROM ledlenser.catalog cat
LEFT JOIN ledlenser.spec_findability_current f ON f.asin::text = cat.asin::text
WHERE cat.buybox_seller IS NOT NULL
  AND (cat.brand_sku IS NOT NULL OR cat.title ILIKE '%led%lenser%');

COMMIT;

-- Undo (restores the 2026-11-04 definitions from 20261104170000_ledlenser_schema.sql):
--
-- BEGIN;
-- CREATE OR REPLACE VIEW ledlenser_private.spec_latest AS
--   <same SELECT as above, with the JOIN condition reduced to:
--    ON c.asin::text = s.asin::text AND c.buybox_seller IS NOT NULL>;
-- DROP VIEW ledlenser.canvas_spec_findability;
-- CREATE VIEW ledlenser.canvas_spec_findability WITH (security_invoker = false) AS
--   <same SELECT as above without the on_brand_sheet column, and with WHERE cat.buybox_seller IS NOT NULL only>;
-- GRANT SELECT ON ledlenser.canvas_spec_findability TO anon, authenticated;
-- COMMIT;
