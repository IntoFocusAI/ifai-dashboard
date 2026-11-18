-- public.canvas_retail_listings (view) — live definition snapshot, do not apply
--   asin: character varying(12)
--   model_name: character varying(150)
--   title: text
--   category: character varying
--   is_bundle: boolean
--   parent_asin: character varying
--   product_url: text
--   map_price: numeric(10,2)
--   offer_price: numeric(10,2)
--   amz_leakage: numeric(10,2)
--   buybox_status: character varying(50)
--   buybox_winner: character varying(100)
--   buybox_seller_id: character varying
--   buybox_seller_name: text
--   buybox_is_fba: boolean
--   offer_count_new: integer
--   sales_rank: integer
--   monthly_sold: integer
--   reviews_count: integer
--   channels: character varying(50)
--   bundle_name: character varying(255)
--   wmt_price: numeric(10,2)
--   wmt_leakage: numeric
--   wmt_url: text
--   wmt_seller: text
--   wmt_match_conf: numeric
--   wmt_checked_at: timestamp with time zone
--   mf_price: numeric(10,2)
--   mf_leakage: numeric(11,2)
--   mf_checked_at: timestamp with time zone
--   worst_leakage: numeric
--   is_map_violation: boolean
--   updated_at: timestamp with time zone
--   competitive_price_threshold_cents: integer
--   featured_offer_withheld: boolean
--   competitive_offer_suppressed: boolean
--   featured_offer_state: text
--   featured_offer_source: text
--   featured_offer_checked_at: timestamp with time zone
--   featured_offer_attempted_at: timestamp with time zone
--   featured_offer_last_error: text
--   competitive_external_price_state: text
--   featured_offer_observed_price_cents: integer
--   featured_offer_observed_shipping_cents: integer
--   featured_offer_observed_seller: text
--   catalog_checked_at: timestamp with time zone
CREATE OR REPLACE VIEW public.canvas_retail_listings AS
 SELECT b.asin,
    b.model_name,
    c.title,
    c.category,
    c.is_bundle,
    c.parent_asin,
    c.product_url,
    b.map_price,
    b.offer_price,
    b.leakage_amount AS amz_leakage,
    b.buybox_status,
    b.buybox_winner,
    c.buybox_seller AS buybox_seller_id,
    sl.seller_name AS buybox_seller_name,
    c.buybox_is_fba,
    c.offer_count_new,
    c.sales_rank,
    c.monthly_sold,
    b.reviews_count,
    b.channels,
    b.bundle_name,
    b.wmt_price,
    b.wmt_leakage,
    b.wmt_url,
    b.wmt_seller,
    b.wmt_match_conf,
    b.wmt_checked_at,
    b.mf_price,
    b.mf_leakage,
    b.mf_checked_at,
    LEAST(b.leakage_amount, b.wmt_leakage, b.mf_leakage) AS worst_leakage,
    COALESCE(b.leakage_amount, 0::numeric) < 0::numeric OR COALESCE(b.wmt_leakage, 0::numeric) < 0::numeric OR COALESCE(b.mf_leakage, 0::numeric) < 0::numeric AS is_map_violation,
    b.updated_at,
    b.competitive_price_threshold_cents,
    b.featured_offer_withheld,
    b.featured_offer_state = 'withheld'::text AND b.competitive_external_price_state = 'present'::text AND b.competitive_price_threshold_cents IS NOT NULL AND b.competitive_price_threshold_cents > 0 AND b.featured_offer_observed_price_cents IS NOT NULL AND b.featured_offer_observed_price_cents > 0 AND b.featured_offer_source = 'keepa'::text AND b.featured_offer_checked_at IS NOT NULL AND (b.featured_offer_observed_price_cents + COALESCE(b.featured_offer_observed_shipping_cents, 0)) > b.competitive_price_threshold_cents AS competitive_offer_suppressed,
    b.featured_offer_state,
    b.featured_offer_source,
    b.featured_offer_checked_at,
    b.featured_offer_attempted_at,
    b.featured_offer_last_error,
    b.competitive_external_price_state,
    b.featured_offer_observed_price_cents,
    b.featured_offer_observed_shipping_cents,
    b.featured_offer_observed_seller,
    c.extracted_at AS catalog_checked_at
   FROM command.fmic_retail_buybox_map b
     LEFT JOIN command.fmic_electric_catalog c ON c.asin::text = b.asin::text
     LEFT JOIN command.fmic_sellers sl ON sl.seller_id::text = c.buybox_seller::text;
