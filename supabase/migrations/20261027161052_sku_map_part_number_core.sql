-- v_fmic_sku_map: also match the 10-digit Fender model number inside reseller part numbers (2026-10-27).
-- Amazon part numbers often wrap the Fender number, e.g. AUS-0379605507-COMBO-PRO-1.
-- Match order: exact part number, 10-digit core of the part number (bundles and kits match their
-- base model here, flagged by match_method and is_bundle), UPC/EAN, Amazon model.
CREATE OR REPLACE VIEW command.v_fmic_sku_map WITH (security_invoker = true) AS
WITH d AS (
  SELECT DISTINCT ON (model_number) model_number, ltrim(upc, '0') AS upc_norm, model_name, series, product_type,
         availability, inventory_level, msrp, map_price, report_date
  FROM command.fmic_dealer_catalog
  ORDER BY model_number, report_date DESC
)
SELECT c.asin,
       c.title,
       c.current_price,
       lc.part_number,
       m.model_number AS fender_model_number,
       m.match_method,
       m.model_name AS fender_model_name,
       m.series AS fender_series,
       m.product_type AS fender_product_type,
       m.availability AS dealer_availability,
       m.inventory_level AS dealer_inventory_level,
       m.msrp AS dealer_msrp,
       m.map_price AS dealer_map_price,
       m.report_date AS dealer_report_date,
       c.is_bundle
FROM command.fmic_electric_catalog c
LEFT JOIN command.fmic_listing_content lc ON lc.asin = c.asin
LEFT JOIN LATERAL (
  SELECT x.* FROM (
    SELECT d.*, 'part_number'::text AS match_method, 1 AS pri FROM d WHERE lc.part_number IS NOT NULL AND d.model_number = lc.part_number
    UNION ALL
    SELECT d.*, 'part_number_core', 2 FROM d WHERE lc.part_number IS NOT NULL AND d.model_number = substring(lc.part_number FROM '(\d{10})')
    UNION ALL
    SELECT d.*, 'upc', 3 FROM d WHERE d.upc_norm <> '' AND d.upc_norm IN (ltrim(c.upc, '0'), ltrim(c.ean, '0'))
    UNION ALL
    SELECT d.*, 'amazon_model', 4 FROM d WHERE c.model_number IS NOT NULL AND d.model_number = c.model_number
  ) x ORDER BY x.pri, x.model_number LIMIT 1
) m ON true;

REVOKE ALL ON command.v_fmic_sku_map FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON command.v_fmic_sku_map FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON command.v_fmic_sku_map FROM authenticated; END IF;
END $$;
GRANT SELECT ON command.v_fmic_sku_map TO service_role;
