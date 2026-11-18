-- ledlenser.canvas_spec_missing_fields (view) — live definition snapshot, do not apply
--   source: text
--   field: text
--   sku_count: bigint
CREATE OR REPLACE VIEW ledlenser.canvas_spec_missing_fields AS
 SELECT 'amazon'::text AS source,
    f.f AS field,
    count(*) AS sku_count
   FROM ledlenser_private.spec_latest,
    LATERAL unnest(string_to_array(NULLIF(spec_latest.amazon_missing_fields, ''::text), ';'::text)) f(f)
  WHERE f.f <> ''::text
  GROUP BY f.f
UNION ALL
 SELECT 'brand_site'::text AS source,
    f.f AS field,
    count(*) AS sku_count
   FROM ledlenser_private.spec_latest,
    LATERAL unnest(string_to_array(NULLIF(spec_latest.brand_site_missing_fields, ''::text), ';'::text)) f(f)
  WHERE spec_latest.brand_site_found AND f.f <> ''::text
  GROUP BY f.f;
