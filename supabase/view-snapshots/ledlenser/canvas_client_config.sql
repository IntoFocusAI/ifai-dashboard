-- ledlenser.canvas_client_config (view) — live definition snapshot, do not apply
--   client_key: text
--   display_name: text
--   seller_type: text
--   brand_site_domains: text[]
--   brand_name_terms: text[]
--   amazon_brand_names: text[]
--   brand_seller_ids: text[]
--   competitor_brands: jsonb
--   updated_at: timestamp with time zone
CREATE OR REPLACE VIEW ledlenser.canvas_client_config AS
 SELECT client_key,
    display_name,
    seller_type,
    brand_site_domains,
    brand_name_terms,
    amazon_brand_names,
    brand_seller_ids,
    competitor_brands,
    updated_at
   FROM ledlenser.client_config;
