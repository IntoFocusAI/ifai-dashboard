-- ledlenser.canvas_listing_channel_price (view) — live definition snapshot, do not apply
--   asin: character varying(12)
--   channel: text
--   price: numeric(10,2)
--   url: text
--   checked_at: timestamp with time zone
CREATE OR REPLACE VIEW ledlenser.canvas_listing_channel_price AS
 SELECT asin,
    channel,
    price,
    url,
    checked_at
   FROM ledlenser.listing_channel_price;
