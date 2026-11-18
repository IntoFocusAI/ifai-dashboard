-- public.canvas_spec_findability (view) — live definition snapshot, do not apply
--   asin: character varying
--   title: text
--   category: text
--   latest_state: text
--   latest_attempt_at: timestamp with time zone
--   latest_canonical_url: text
--   latest_variant_sku: text
--   last_success_state: text
--   last_success_url: text
--   last_success_variant_sku: text
--   last_success_at: timestamp with time zone
--   last_success_explanation: text
--   last_success_schema_profile: text
--   last_success_present_fields: jsonb
--   last_success_missing_applicable_fields: jsonb
--   product_kind: text
--   confidence: text
--   explanation: text
--   source_method: text
--   latest_failure: text
--   schema_profile: text
--   present_fields: jsonb
--   missing_applicable_fields: jsonb
--   catalog_identity_hash: text
--   last_success_identity_hash: text
--   collector_version: text
--   http_status: integer
--   success_needs_review: boolean
--   counts_as_confirmed: boolean
--   counts_as_finished_search: boolean
--   counts_as_ambiguous: boolean
--   counts_as_blocked: boolean
--   counts_as_timeout: boolean
--   counts_as_parse_failure: boolean
--   counts_as_unchecked: boolean
--   prior_success_latest_failed: boolean
--   prior_success_latest_completed_not_found: boolean
--   prior_success_latest_ambiguous: boolean
--   jsonld_status: text
--   counts_as_eligible: boolean
--   counts_as_attempted: boolean
--   counts_as_completed_not_found: boolean
--   counts_as_unsupported: boolean
CREATE OR REPLACE VIEW public.canvas_spec_findability AS
 SELECT cat.asin,
    COALESCE(f.title, cat.title) AS title,
    COALESCE(f.category, cat.category::text) AS category,
    COALESCE(f.findability_state, 'not_checked'::text) AS latest_state,
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
    f.product_kind,
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
    f.last_success_at IS NOT NULL AND ((COALESCE(f.findability_state, 'not_checked'::text) <> ALL (ARRAY['exact_official_product'::text, 'official_family_page'::text])) OR f.catalog_identity_hash IS DISTINCT FROM f.last_success_identity_hash OR f.last_success_at < (now() - '180 days'::interval)) AS success_needs_review,
    COALESCE(f.findability_state = ANY (ARRAY['exact_official_product'::text, 'official_family_page'::text]), false) AS counts_as_confirmed,
    COALESCE(f.findability_state = ANY (ARRAY['exact_official_product'::text, 'official_family_page'::text, 'ambiguous_candidate'::text, 'completed_not_found'::text]), false) AS counts_as_finished_search,
    COALESCE(f.findability_state = 'ambiguous_candidate'::text, false) AS counts_as_ambiguous,
    COALESCE(f.findability_state = 'blocked'::text, false) AS counts_as_blocked,
    COALESCE(f.findability_state = 'timeout'::text, false) AS counts_as_timeout,
    COALESCE(f.findability_state = 'parse_failure'::text, false) AS counts_as_parse_failure,
    f.asin IS NULL OR f.findability_state = 'not_checked'::text AS counts_as_unchecked,
    f.last_success_url IS NOT NULL AND (f.findability_state = ANY (ARRAY['blocked'::text, 'timeout'::text, 'parse_failure'::text])) AS prior_success_latest_failed,
    f.last_success_url IS NOT NULL AND f.findability_state = 'completed_not_found'::text AS prior_success_latest_completed_not_found,
    f.last_success_url IS NOT NULL AND f.findability_state = 'ambiguous_candidate'::text AS prior_success_latest_ambiguous,
    f.jsonld_status,
    true AS counts_as_eligible,
    f.asin IS NOT NULL AS counts_as_attempted,
    COALESCE(f.findability_state = 'completed_not_found'::text, false) AS counts_as_completed_not_found,
    COALESCE(f.findability_state = 'unsupported_product_type'::text, false) AS counts_as_unsupported
   FROM command.fmic_electric_catalog cat
     LEFT JOIN command.fmic_spec_findability_current f ON f.asin::text = cat.asin::text
  WHERE cat.buybox_seller IS NOT NULL;
