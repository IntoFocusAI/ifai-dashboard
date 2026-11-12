-- Worker 26.9: Amazon product type per listing, for Amazon Specs required fields (D-05).
--
-- What it changes
--   Adds two read views. Nothing existing is altered or deleted (additive).
--     public.canvas_amazon_product_types     Fender: one row per ASIN in command.fmic_listing_content.
--     ledlenser.canvas_amazon_product_types  Ledlenser: one row per ASIN in ledlenser.listing_content.
--   Columns: asin, product_type (Keepa product_type_name, for example GUITARS or FLASHLIGHT),
--   item_type_keyword. The dashboard joins them to canvas_spec_readiness by ASIN and picks the
--   staff field list for that product type (lib/findability/amazon-field-lists.ts). Until this is
--   applied, Amazon Specs reads the view as unavailable and keeps the interim rule (top 10 by fill
--   rate in each category), so nothing breaks on screen.
--   SELECT is granted to anon and authenticated, like the other canvas_* views.
--
-- Apply: additive, so it may be applied by the FenderTest agent after Brian Magazu approves.
--
-- Undo:
--   DROP VIEW IF EXISTS public.canvas_amazon_product_types;
--   DROP VIEW IF EXISTS ledlenser.canvas_amazon_product_types;

BEGIN;

CREATE OR REPLACE VIEW public.canvas_amazon_product_types
WITH (security_invoker = false) AS
SELECT l.asin::text AS asin,
  NULLIF(btrim(l.product_type_name), '') AS product_type,
  NULLIF(btrim(l.item_type_keyword), '') AS item_type_keyword
FROM command.fmic_listing_content l;

COMMENT ON VIEW public.canvas_amazon_product_types IS
  'Fender listings: Amazon product type (Keepa product_type_name) per ASIN. Amazon Specs picks the required field list by this type (D-05).';

GRANT SELECT ON TABLE public.canvas_amazon_product_types TO anon, authenticated;
GRANT ALL ON TABLE public.canvas_amazon_product_types TO service_role;

CREATE OR REPLACE VIEW ledlenser.canvas_amazon_product_types
WITH (security_invoker = false) AS
SELECT l.asin::text AS asin,
  NULLIF(btrim(l.product_type_name), '') AS product_type,
  NULLIF(btrim(l.item_type_keyword), '') AS item_type_keyword
FROM ledlenser.listing_content l;

COMMENT ON VIEW ledlenser.canvas_amazon_product_types IS
  'Ledlenser listings: Amazon product type (Keepa product_type_name) per ASIN. Amazon Specs picks the required field list by this type (D-05).';

GRANT SELECT ON TABLE ledlenser.canvas_amazon_product_types TO anon, authenticated;
GRANT ALL ON TABLE ledlenser.canvas_amazon_product_types TO service_role;

COMMIT;
