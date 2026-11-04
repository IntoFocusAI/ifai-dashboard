-- Count "River City Tools, LLC" (Amazon seller A2MFGMIGS5UPZJ) as a Ledlenser brand seller (2026-11-04).
-- Ledlenser USA (A1A8DQ0I1V6KE5) trades as River City Distributors LLC; Brian Watson confirmed on 2026-11-04 that
-- River City Tools is the same distributor's second account. Buy Boxes held by either account count as the brand's own.
--
-- Changes one existing row (ledlenser.client_config.brand_seller_ids). Applied at Brian Watson's direction.
-- Undo: UPDATE ledlenser.client_config SET brand_seller_ids = array_remove(brand_seller_ids, 'A2MFGMIGS5UPZJ'), updated_at = now() WHERE client_key = 'ledlenser';

UPDATE ledlenser.client_config
SET brand_seller_ids = ARRAY(SELECT DISTINCT unnest(brand_seller_ids || ARRAY['A2MFGMIGS5UPZJ']) ORDER BY 1),
    updated_at = now()
WHERE client_key = 'ledlenser';
