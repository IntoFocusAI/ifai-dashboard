-- Seed ledlenser.catalog with the Amazon listings that match Ledlenser's product sheet (2026-11-04).
-- Needs 20261104180000_ledlenser_brand_catalog.sql.
--
-- How the 72 listings were found: every UPC on the sheet was looked up on Keepa (Amazon.com) on 2026-11-04.
-- brand_sku is the sheet SKU with that UPC. Where the sheet gives one UPC to several products, Keepa's model
-- number and title decide:
--   B0HMJBVYMF (UPC 847706104423) H19R Signature -> 503227, not 503114 P18R Signature
--   B08H5TZP32 (UPC 847706100807) ML4 Warm Light -> 502231, not 502053 ML4 White Light
--   B08C95P9J4 (UPC 847706100593) ML6 Warm Light -> 502084, not 500929 ML6
--   B0HMJC8T3Z (UPC 847706104409) H7R Signature  -> 503353, not 503113 P7R Signature or 503219 HF7R Signature
--   B0HMJBN4GY (UPC 847706104218) HF6R           -> 503319, not 503295 TAC7R Outdoor Set
-- B0C2FTKJ1K (W1R Work) carries the older article number 502810 on Amazon; the sheet's SKU is 503269.
--
-- Only identity columns are seeded (ASIN, UPC, Amazon model number, parent ASIN, sheet SKU). Prices, titles,
-- Buy Box seller and content come from the Ledlenser catalog harvester. Listings outside the sheet (resellers,
-- older models) are added by the harvester, not here.
--
-- Additive only. Undo: DELETE FROM ledlenser.catalog WHERE asin IN (<the ASINs below>) (catalog_history keeps a copy).

INSERT INTO ledlenser.catalog (asin, upc, model_number, brand, parent_asin, product_url, brand_sku) VALUES
  ('B09LNJ1WNY', '847706102627', '502537', 'Ledlenser', 'B09LNZDB5Y', 'https://www.amazon.com/dp/B09LNJ1WNY', '502537'),
  ('B0HMJKC6C4', '847706104317', '503222', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJKC6C4', '503222'),
  ('B0HMH87TGK', '847706104416', '503225', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMH87TGK', '503225'),
  ('B0FN9WWBC2', '847706103723', '503109', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN9WWBC2', '503109'),
  ('B0FN6VNQP9', '847706103822', '503107', 'Ledlenser', 'B0FNRZQ3JP', 'https://www.amazon.com/dp/B0FN6VNQP9', '503107'),
  ('B0CYVTDQJT', '847706103488', 'AF12R-Work', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CYVTDQJT', '502913'),
  ('B0HMJBVYMF', '847706104423', '503227', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJBVYMF', '503227'),
  ('B0FN746XTP', '847706103730', '503111', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN746XTP', '503111'),
  ('B0HMJF5XP4', '847706104355', '503356', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJF5XP4', '503356'),
  ('B0CYW3TYRW', '847706103464', 'AF4R-Work', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CYW3TYRW', '502910'),
  ('B0HMJ771GN', '847706104256', '503313', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJ771GN', '503313'),
  ('B0C2FVB73R', '847706103211', '502809', 'Ledlenser', 'B0CN9P9L3N', 'https://www.amazon.com/dp/B0C2FVB73R', '502809'),
  ('B0BGMZ7R6D', '847706103099', '502754', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0BGMZ7R6D', '502754'),
  ('B0HMJDHP4Q', '847706104232', '503344', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJDHP4Q', '503344'),
  ('B0HMGVN8ZT', '847706104270', '503220', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMGVN8ZT', '503220'),
  ('B08H5TZP32', '847706100807', '880568', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B08H5TZP32', '502231'),
  ('B08H5WFGKF', '847706100517', 'h7r', 'Ledlenser', 'B0BGMB7B4B', 'https://www.amazon.com/dp/B08H5WFGKF', '880506'),
  ('B09LXM8TJC', '847706102658', '502536', 'Ledlenser', 'B09LXG98PF', 'https://www.amazon.com/dp/B09LXM8TJC', '502536'),
  ('B08H5XGWW4', '847706100524', '880502', 'Ledlenser', 'B0H8Q6B9Q9', 'https://www.amazon.com/dp/B08H5XGWW4', '880502'),
  ('B08C8ZR9G5', '847706100326', '880556', 'Ledlenser', 'B088BS3MHZ', 'https://www.amazon.com/dp/B08C8ZR9G5', '880556'),
  ('B08H5X2SPX', '847706100531', 'H19R', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B08H5X2SPX', '880503'),
  ('B0BGMXJHND', '847706103105', '502789', 'Ledlenser', 'B0BGQKCRK7', 'https://www.amazon.com/dp/B0BGMXJHND', '502789'),
  ('B09LNQ1P5C', '847706102634', 'Kidled2', 'Ledlenser', 'B09LNZDB5Y', 'https://www.amazon.com/dp/B09LNQ1P5C', '502538'),
  ('B08C95F3QC', '847706100753', '880501', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B08C95F3QC', '880501'),
  ('B08H5WZPDY', '847706100500', '880505', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B08H5WZPDY', '880505'),
  ('B08C95P9J4', '847706100593', '502084', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B08C95P9J4', '502084'),
  ('B0BJ7L2TMR', '847706102672', '502127', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0BJ7L2TMR', '502127'),
  ('B09LX1DCRH', '847706102641', '502535', 'Ledlenser', 'B09LXG98PF', 'https://www.amazon.com/dp/B09LX1DCRH', '502535'),
  ('B073LFZDSS', '847706001791', '880385', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B073LFZDSS', '880385'),
  ('B0F19H7BRM', '847706103518', '502917', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0F19H7BRM', '502917'),
  ('B0FN6R8CR5', '847706103747', '503101', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN6R8CR5', '503101'),
  ('B0C2FCG92Z', '847706103228', '502808', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0C2FCG92Z', '502808'),
  ('B0CYVZDVZL', '847706103525', 'AF2R-Work', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CYVZDVZL', '502921'),
  ('B0CG7NZTX5', '847706103303', '502790', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CG7NZTX5', '502790'),
  ('B0C2FHVZ8R', '847706103204', '502735', 'Ledlenser', 'B0CN9P9L3N', 'https://www.amazon.com/dp/B0C2FHVZ8R', '502735'),
  ('B0C2FTKJ1K', '847706103235', '502810', 'Ledlenser', 'B0CN9P9L3N', 'https://www.amazon.com/dp/B0C2FTKJ1K', '503269'),
  ('B0CG7W5T64', '847706103334', '502796', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CG7W5T64', '502796'),
  ('B0C2FPVCC6', '847706103198', '502733', 'Ledlenser', 'B0CN9P9L3N', 'https://www.amazon.com/dp/B0C2FPVCC6', '502733'),
  ('B0CG7NH3R2', '847706103297', '502802', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CG7NH3R2', '502802'),
  ('B0DGHZNSPY', '847706103594', '503089', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0DGHZNSPY', '503089'),
  ('B0C2FVH6HT', '847706103242', '502736', 'Ledlenser', 'B0CN9P9L3N', 'https://www.amazon.com/dp/B0C2FVH6HT', '502736'),
  ('B0CG7VFWVN', '847706103372', '502801', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CG7VFWVN', '502801'),
  ('B0CYVSXH1Q', '847706103471', 'AF8R-Work', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CYVSXH1Q', '502911'),
  ('B0CG7QHBPM', '847706103280', '502798', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0CG7QHBPM', '502798'),
  ('B0FN6L4RLD', '847706103808', '503102', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN6L4RLD', '503102'),
  ('B0FN6VNMN8', '847706103839', '503099', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN6VNMN8', '503099'),
  ('B0FN6HB4Y3', '847706103815', '503097', 'Ledlenser', 'B0FNS2HKH2', 'https://www.amazon.com/dp/B0FN6HB4Y3', '503097'),
  ('B0FN6VNTSR', '847706103846', '503146', 'Ledlenser', 'B0FNZDDGV8', 'https://www.amazon.com/dp/B0FN6VNTSR', '503146'),
  ('B0HMJBN4GY', '847706104218', 'Hf6r', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJBN4GY', '503319'),
  ('B0FN6QRDK9', '847706103778', '503106', 'Ledlenser', 'B0FNRZQ3JP', 'https://www.amazon.com/dp/B0FN6QRDK9', '503106'),
  ('B0FN74PCXF', '847706103754', '503103', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN74PCXF', '503103'),
  ('B0HM5GTLYQ', '847706104249', '503349', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HM5GTLYQ', '503349'),
  ('B0FN74XSFQ', '847706103853', '503112', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN74XSFQ', '503112'),
  ('B0FN6FVL2F', '847706103785', '503098', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN6FVL2F', '503098'),
  ('B0HMJNR7HR', '847706104225', '503345', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJNR7HR', '503345'),
  ('B0FN6B6QSX', '847706103860', '503105', 'Ledlenser', 'B0FNZBK1L4', 'https://www.amazon.com/dp/B0FN6B6QSX', '503105'),
  ('B0HMJNY6S4', '847706104201', 'Hf4r Pro', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJNY6S4', '503318'),
  ('B0FN6VQ2TQ', '847706103792', '503100', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0FN6VQ2TQ', '503100'),
  ('B0HMJHTX83', '847706104133', '503316', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJHTX83', '503316'),
  ('B0HMJGWSTQ', '847706104164', '503317', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJGWSTQ', '503317'),
  ('B0HMJLB1N1', '847706104195', '503309', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJLB1N1', '503309'),
  ('B0HK1FZ3DS', '847706104287', '503351', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HK1FZ3DS', '503351'),
  ('B0HMJKFS6V', '847706104386', '503347', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJKFS6V', '503347'),
  ('B0HMJJFMB2', '847706104331', '503355', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJJFMB2', '503355'),
  ('B0HMJ787FQ', '847706104263', '503320', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJ787FQ', '503320'),
  ('B0HMJ726W7', '847706104362', '503226', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJ726W7', '503226'),
  ('B0HMJC8T3Z', '847706104409', 'H7r Signature', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJC8T3Z', '503353'),
  ('B0HMGSM5GS', '847706104294', '503221', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMGSM5GS', '503221'),
  ('B0HMGSZZ8J', '847706104348', '503224', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMGSZZ8J', '503224'),
  ('B0HMJDN1PT', '847706104324', '503354', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJDN1PT', '503354'),
  ('B0HMJJJRL3', '847706104379', '503229', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMJJJRL3', '503229'),
  ('B0HMGWJDS7', '847706104300', '503352', 'Ledlenser', NULL, 'https://www.amazon.com/dp/B0HMGWJDS7', '503352')
ON CONFLICT (asin) DO NOTHING;
