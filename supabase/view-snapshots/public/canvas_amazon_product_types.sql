-- public.canvas_amazon_product_types (view) — live definition snapshot, do not apply
--   asin: text
--   product_type: text
--   item_type_keyword: text
CREATE OR REPLACE VIEW public.canvas_amazon_product_types AS
 SELECT asin,
    NULLIF(btrim(product_type_name), ''::text) AS product_type,
    NULLIF(btrim(item_type_keyword), ''::text) AS item_type_keyword
   FROM command.fmic_listing_content l;
