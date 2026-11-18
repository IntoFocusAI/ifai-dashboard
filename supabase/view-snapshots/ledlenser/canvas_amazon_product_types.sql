-- ledlenser.canvas_amazon_product_types (view) — live definition snapshot, do not apply
--   asin: text
--   product_type: text
--   item_type_keyword: text
CREATE OR REPLACE VIEW ledlenser.canvas_amazon_product_types AS
 SELECT asin,
    NULLIF(btrim(product_type_name), ''::text) AS product_type,
    NULLIF(btrim(item_type_keyword), ''::text) AS item_type_keyword
   FROM ledlenser.listing_content l;
