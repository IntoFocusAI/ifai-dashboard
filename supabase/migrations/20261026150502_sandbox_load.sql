-- Load the sandbox schema on production.
-- 1. Hand-entered rows copied from the sandbox: client, seller types, competitor brands, metric registry,
--    estimates, and the worker20 prompt-versioning check results (command.worker20_prompt_versioning_checks).
-- 2. Dealer catalog: production already holds the same 4,262 rows in command.fmic_dealer_catalog.
-- 3. sandbox.reload_readings rebuilds listings, sellers, readings, AI answers, action items and metrics
--    from production's command.* tables.
-- 4. Action items copied from the sandbox keep their history: items closed in the sandbox are carried over,
--    and each item keeps its earliest created_at. Current status comes from the reload.

SET check_function_bodies = false;

INSERT INTO command.worker20_prompt_versioning_checks (check_name, passed, detail) VALUES
	('client_org_exists', true, '8255d4f7-b177-4330-b3af-34c326b148f3'),
	('other_org_exists', true, 'ed3e6a78-bb49-45be-be83-2ceef8b48462'),
	('fender_org_untouched', true, '0'),
	('unique_keys_34', true, '34'),
	('sandbox_run_starts_unpublished', true, 'false'),
	('intent_counts', true, '{"product_fact": 6, "shopping_guidance": 1, "product_fact_probe": 5, "unbranded_discovery": 11, "branded_consideration": 10, "brand_associated_discovery": 1}'),
	('p26_is_shopping_guidance', true, 'shopping_guidance/excluded'),
	('legacy_hash', true, '7336a48b5f1b2e7be7136319aee3d454'),
	('versioned_hash', true, 'acb0cb9437163cdfa184ccf06a6c2c45'),
	('hash_stable', true, 'acb0cb9437163cdfa184ccf06a6c2c45 vs 7336a48b5f1b2e7be7136319aee3d454'),
	('live_prompt_table_hash_unchanged', true, '7336a48b5f1b2e7be7136319aee3d454'),
	('reject_unbranded_names_brand', true, 'new row for relation "fmic_ai_prompt_revisions" violates check constraint "fmic_ai_prompt_revisions_intent_check"'),
	('reject_probe_as_commercial', true, 'prompt validation: product_fact_probe stays probe'),
	('reject_shopping_in_unbranded_denominator', true, 'new row for relation "fmic_ai_prompt_revisions" violates check constraint "fmic_ai_prompt_revisions_intent_check"'),
	('reject_missing_intent', true, 'null value in column "analytical_intent" of relation "fmic_ai_prompt_revisions" violates not-null constraint'),
	('reject_duplicate_prompt_key', true, 'prompt immutable: members of set a20a20a2-0a20-4a20-8a20-a20a20a20a20 cannot change'),
	('anonymous_denied', true, 'prompt auth: anonymous users cannot preview a prompt set'),
	('cross_org_preview_denied', true, 'prompt auth: org_viewer required to preview a prompt set'),
	('cross_org_draft_denied', true, 'prompt auth: org_admin required to save a draft'),
	('viewer_can_preview', true, '{"engines": ["chatgpt", "perplexity", "gemini"], "by_intent": {"product_fact": [{"active": true, "status": "published", "category": "electrics", "prompt_key": "p04", "prompt_kind": "commercial", "prompt_text": "What are the pickup types on a Fender Player II Stratocaster?", "revision_no": 1, "names_'),
	('viewer_preview_expected_calls', true, '102'),
	('viewer_sees_p26_excluded', true, '{"excluded": ["p04", "p08", "p10", "p17", "p18", "p19", "p25", "p26", "p27", "p31", "p33", "p34"], "unbranded_discovery": ["p01", "p05", "p06", "p07", "p09", "p11", "p15", "p21", "p24", "p28", "p29"], "branded_consideration": ["p02", "p03", "p12", "p14", "p16", "p20", "p22", "p23", "p30", "p32"], "brand_associated_discovery": ["p13"]}'),
	('viewer_cannot_draft', true, 'prompt auth: org_admin required to save a draft'),
	('viewer_can_list', true, 'list ok'),
	('org_admin_cannot_approve', true, 'prompt auth: IntoFocus platform admin required to approve or reject a revision'),
	('org_admin_cannot_publish', true, 'prompt auth: IntoFocus platform admin required to publish a prompt set'),
	('org_admin_can_draft', true, 'rollback temporary draft'),
	('publish_blocked_before_approval', true, 'already published on an earlier sandbox run'),
	('platform_admin_approved', true, 'already approved on an earlier sandbox run'),
	('reject_active_above_max', true, 'already enforced on an earlier sandbox run'),
	('platform_admin_published', true, 'already published on an earlier sandbox run'),
	('published_status', true, 'published found=true valid=true'),
	('stored_legacy_field', true, '7336a48b5f1b2e7be7136319aee3d454'),
	('stored_versioned_field', true, 'acb0cb9437163cdfa184ccf06a6c2c45'),
	('hashes_not_conflated', true, '7336a48b5f1b2e7be7136319aee3d454 / acb0cb9437163cdfa184ccf06a6c2c45'),
	('published_active_count', true, '34'),
	('read_contract_returns_34', true, '34'),
	('published_revision_immutable', true, 'prompt immutable: published revision 78a3d80a-4ff0-42c2-89df-656b9f21c911 cannot change'),
	('published_set_immutable', true, 'prompt immutable: published set a20a20a2-0a20-4a20-8a20-a20a20a20a20 cannot change'),
	('published_members_immutable', true, 'prompt immutable: members of set a20a20a2-0a20-4a20-8a20-a20a20a20a20 cannot change'),
	('no_ai_run_published', true, '0->0'),
	('legacy_prompt_rows_unchanged', true, '34 7336a48b5f1b2e7be7136319aee3d454'),
	('historical_simulation_rows_unchanged', true, '102->102'),
	('service_role_cannot_read_base', true, 'permission denied for table fmic_ai_prompt_revisions'),
	('service_role_can_read_published_view', true, 'published view readable'),
	('service_role_cannot_save_draft', true, 'permission denied for function fmic_ai_prompt_save_draft'),
	('anon_cannot_read_published_view', true, 'permission denied for view fmic_ai_published_prompts');

INSERT INTO sandbox.seller_type (seller_type, label, primary_retail_question, description) VALUES
	('partner_led', 'Partner-led', 'Does an authorized seller hold a healthy Featured Offer on each active listing?', 'Authorized resellers sell the brand on Amazon; the brand doesn''t sell there itself.'),
	('brand_led_marketplace', 'Brand-led marketplace', 'Does the brand''s own seller account hold the Featured Offer at a healthy price?', 'The brand sells on Amazon through its own seller account.'),
	('amazon_retail_only', 'Amazon Retail only', 'Does Amazon Retail keep each listing in stock and hold the Featured Offer?', 'The brand sells wholesale to Amazon, and Amazon Retail sells to shoppers.'),
	('hybrid', 'Hybrid', 'Is the seller holding the Featured Offer on each listing the one the brand planned for?', 'The brand mixes Amazon Retail, its own account, and partners across listings.'),
	('no_managed_presence', 'No managed presence', 'Who sells the brand''s products on Amazon today, and at what price?', 'The brand doesn''t manage Amazon; whoever lists the products sells them.');

INSERT INTO sandbox.client (client_id, name, slug, seller_type, organization_id, brand_site_domain, is_active, onboarded_at, updated_at) VALUES
	('cl_fender', 'Fender', 'fender', 'partner_led', '9dc6c1af-c367-4f40-b657-42720dd44269', 'fender.com', true, '2026-10-01 15:14:05.193655+00', '2026-10-08 20:35:06.555407+00');

INSERT INTO sandbox.metric_registry (registry_key, client_id, registry_id, name, meaning, unit, population, formula, source_tables, owner, confidence, status_rule, notes) VALUES
	('cl_fender:ai_answer_share', 'cl_fender', 'ai_answer_share', 'AI answer share', 'Of the AI answers that named a brand, how often it was Fender or Squier.', 'percent', 'Every answer in the simulation battery, all runs, where the scorer resolved a brand. Unclear answers and errors are excluded.', 'fender_wins / resolved_answers', '{ai_answer}', 'intofocus', 'measured', '{"kind": "higher_is_better", "warn": 80, "danger": 65}', 'Keyword scorer: an answer counts as a Fender win when it mentions Fender terms at least as often as rival names.'),
	('cl_fender:ai_answer_share_by_category', 'cl_fender', 'ai_answer_share_by_category', 'Weakest category', 'The prompt category where Fender is named least, and the rival named most there.', 'percent', 'Resolved answers per category; categories with fewer than 10 resolved answers are not ranked; the hallucinations category is excluded because its prompts name Fender products.', 'per category: fender_wins / resolved; gap = fender share minus top rival share', '{ai_answer}', 'intofocus', 'measured', '{"kind": "higher_is_better", "warn": 70, "danger": 50}', NULL),
	('cl_fender:ai_wrong_spec_flags', 'cl_fender', 'ai_wrong_spec_flags', 'Answers flagged for a wrong spec', 'Answers that stated a product fact the rule set knows is false.', 'count', 'All answers, all runs.', 'count(flag)', '{ai_answer}', 'intofocus', 'measured', '{"kind": "count_is_bad", "warn": 1, "danger": 50}', 'Four fixed text rules; each flag carries the rule text as its reason.'),
	('cl_fender:ai_battery_freshness', 'cl_fender', 'ai_battery_freshness', 'Last AI read', 'When the simulation battery last wrote an answer.', 'timestamp', 'All answers.', 'max(answered_at)', '{ai_answer}', 'intofocus', 'measured', NULL, NULL),
	('cl_fender:retail_control_partner_led', 'cl_fender', 'retail_control_partner_led', 'Healthy Featured Offer, authorized seller', 'Share of active Amazon listings where a Featured Offer is present and the seller holding it is on the client''s authorized list.', 'percent', 'Active offers.', 'count(featured offer present AND seller authorized) / active offers', '{listing_offer_reading,seller_authorization}', 'client', 'measured', NULL, 'Unavailable until the client''s authorized-seller list is stored.'),
	('cl_fender:featured_offer_suppressed', 'cl_fender', 'featured_offer_suppressed', 'Featured Offer withheld above Amazon''s outside benchmark', 'Listings where Amazon shows no Featured Offer and the offer, including shipping, is above the Competitive External Price.', 'count', 'Active offers with a benchmark reading.', 'withheld = true AND offer_cents > benchmark_cents', '{listing_offer_reading}', 'intofocus', 'measured', '{"kind": "count_is_bad", "warn": 1, "danger": 10}', 'Keepa competitivePriceThreshold and buyBoxIsUnqualified.'),
	('cl_fender:featured_offer_present', 'cl_fender', 'featured_offer_present', 'Featured Offer present', 'Listings where Amazon shows a Featured Offer.', 'count', 'Active offers with a Featured Offer reading.', 'count(withheld = false) / read', '{listing_offer_reading}', 'intofocus', 'measured', '{"kind": "higher_is_better", "warn": 95, "danger": 85}', NULL),
	('cl_fender:seller_mix', 'cl_fender', 'seller_mix', 'Who holds the Featured Offer', 'Amazon Retail, a confirmed third-party seller, or not yet read.', 'count', 'Active offers.', 'counts by seller class', '{listing_offer_reading,seller}', 'intofocus', 'measured', NULL, NULL),
	('cl_fender:amazon_offer_share', 'cl_fender', 'amazon_offer_share', 'Amazon Retail share of Featured Offers', 'Share of active offers where Amazon Retail holds the Featured Offer. A drill-down fact for a Partner-led brand, not the headline.', 'percent', 'Active offers. Rows with no active offer are excluded.', 'amazon / active offers', '{listing_offer_reading}', 'intofocus', 'measured', NULL, NULL),
	('cl_fender:seller_read_coverage', 'cl_fender', 'seller_read_coverage', 'Seller read coverage', 'How much of the active catalog has a seller reading.', 'percent', 'Active offers.', 'read / active', '{listing_offer_reading}', 'intofocus', 'measured', '{"kind": "higher_is_better", "warn": 98, "danger": 90}', NULL),
	('cl_fender:map_below', 'cl_fender', 'map_below', 'Offers below MAP', 'Listings priced under the client''s minimum advertised price on any channel.', 'count', 'Active offers with a stored MAP.', 'offer < map_price, per channel', '{listing_channel_price,listing_map_price}', 'client', 'measured', NULL, 'Unavailable until a MAP sheet is stored. The Keepa list price was removed as a MAP stand-in on 2026-10-08.'),
	('cl_fender:channel_price_coverage', 'cl_fender', 'channel_price_coverage', 'Outside prices on file', 'How many active listings have a stored price at each outside retailer.', 'count', 'Active offers per channel.', 'counts per channel', '{listing_channel_price}', 'intofocus', 'measured', NULL, NULL),
	('cl_fender:bundle_share', 'cl_fender', 'bundle_share', 'Partner bundles', 'Active offers whose title marks a bundle, kit, pack, or combo.', 'percent', 'Active offers.', 'count(is_bundle) / active', '{listing}', 'intofocus', 'measured', NULL, 'Title pattern.'),
	('cl_fender:spec_fender_page_found', 'cl_fender', 'spec_fender_page_found', 'fender.com page found', 'Checked SKUs for which site search found a fender.com product page.', 'percent', 'SKUs with a known Buy Box seller, checked in hourly batches.', 'found / checked', '{spec_reading}', 'intofocus', 'measured', '{"kind": "higher_is_better", "warn": 50, "danger": 25}', NULL),
	('cl_fender:spec_additional_property_missing', 'cl_fender', 'spec_additional_property_missing', 'Pages missing additionalProperty', 'Found fender.com pages whose JSON-LD has no additionalProperty block.', 'count', 'Found pages.', 'missing / found', '{spec_reading}', 'intofocus', 'measured', '{"kind": "count_is_bad", "warn": 1, "danger": 20}', NULL),
	('cl_fender:spec_amazon_completeness', 'cl_fender', 'spec_amazon_completeness', 'Amazon attribute completeness', 'Average share of 13 Amazon product-detail fields that are filled.', 'percent', 'Checked SKUs.', 'avg(found / 13)', '{spec_reading}', 'intofocus', 'measured', '{"kind": "higher_is_better", "warn": 92, "danger": 85}', NULL),
	('cl_fender:ecommerce_to_ai_link', 'cl_fender', 'ecommerce_to_ai_link', 'Ecommerce cause of the AI result', 'The claim that listing control and product-data gaps change which brand an assistant names.', 'none', 'Not defined.', 'not defined', '{}', 'intofocus', 'assumption', NULL, 'No stored reading links one listing''s gap to one answer.'),
	('cl_fender:price_gap_above_benchmark', 'cl_fender', 'price_gap_above_benchmark', 'Price gap on suppressed listings', 'Dollars by which suppressed offers sit above Amazon''s outside benchmark, summed. A price gap, not revenue.', 'usd', 'Suppressed listings.', 'sum(offer_price - benchmark_cents / 100)', '{listing_offer_reading}', 'intofocus', 'measured', NULL, NULL),
	('cl_fender:estimate_phase1_uplift', 'cl_fender', 'estimate_phase1_uplift', 'Phase 1 uplift', 'The annual uplift figure the current dashboard shows as $680K.', 'usd', 'Not defined until inputs exist.', 'buybox_recapture + ai_dtc_conversions + reduced_returns + review_synergy', '{estimate,estimate_input}', 'coo', 'estimate', NULL, 'Formula shape stored; no input values stored.'),
	('cl_fender:estimate_enterprise_range', 'cl_fender', 'estimate_enterprise_range', 'Enterprise uplift range', 'The figure the current dashboard shows as $38M to $62M.', 'usd', 'Not defined until inputs exist.', 'sum of four stored lines, low and high', '{estimate,estimate_input}', 'coo', 'estimate', NULL, 'Three documents disagree on the value.'),
	('cl_fender:action_items_open', 'cl_fender', 'action_items_open', 'Open action items', 'Stored actions that are not done, each tied to a registry row.', 'count', 'Action rows with status other than done.', 'count(*)', '{action_item}', 'mixed', 'measured', '{"kind": "count_is_bad", "warn": 5, "danger": 20}', NULL),
	('cl_fender:catalog_monitored', 'cl_fender', 'catalog_monitored', 'Monitored ASINs', 'ASINs in the monitored catalog, and how many have an active Amazon offer.', 'count', 'All listings for the client.', 'count(*); count(active)', '{listing}', 'intofocus', 'measured', NULL, NULL),
	('cl_fender:catalog_by_category', 'cl_fender', 'catalog_by_category', 'Listings by category', 'Listings grouped by the retailer category.', 'count', 'All listings for the client.', 'count by category', '{listing}', 'intofocus', 'measured', NULL, 'The six authored division names from 2026-09-29 are retired.'),
	('cl_fender:reading_freshness', 'cl_fender', 'reading_freshness', 'As-of per reading', 'One timestamp per source.', 'timestamp', 'All reading runs.', 'max(finished_at) per source', '{reading_run}', 'intofocus', 'measured', NULL, NULL),
	('cl_fender:ai_answer_share_by_engine', 'cl_fender', 'ai_answer_share_by_engine', 'Share by engine', 'AI answer share split by ChatGPT, Perplexity, and Gemini.', 'percent', 'All answers. The engine comes from the stored engine column, or from the engine tag the battery appends to every prompt and encodes in the sim id.', 'per engine: fender_wins / resolved', '{ai_answer}', 'intofocus', 'measured', NULL, 'The stored engine column covers 114 answers; the prompt tag and sim id cover every answer, and the two agree on all 114.');

INSERT INTO sandbox.competitor_brand (competitor_brand_id, client_id, name, is_client_brand, match_terms) VALUES
	('cb_fender', 'cl_fender', 'Fender', true, '{fender,squier,"player ii","american professional","american ultra",acoustasonic,"mustang micro","tone master"}'),
	('cb_prs', 'cl_fender', 'PRS', false, '{prs}'),
	('cb_taylor', 'cl_fender', 'Taylor', false, '{taylor}'),
	('cb_yamaha', 'cl_fender', 'Yamaha', false, '{yamaha}'),
	('cb_ibanez', 'cl_fender', 'Ibanez', false, '{ibanez}'),
	('cb_gibson', 'cl_fender', 'Gibson', false, '{gibson}'),
	('cb_boss', 'cl_fender', 'Boss', false, '{boss}'),
	('cb_positive_grid', 'cl_fender', 'Positive Grid', false, '{"positive grid"}'),
	('cb_sire', 'cl_fender', 'Sire', false, '{sire}');

INSERT INTO sandbox.estimate (estimate_id, client_id, registry_key, name, formula, unit, low_value, high_value, owner, confidence, as_of) VALUES
	('est_phase1', 'cl_fender', 'cl_fender:estimate_phase1_uplift', 'Phase 1 uplift', 'buybox_recapture + ai_dtc_conversions + reduced_returns + review_synergy', 'usd', NULL, NULL, 'coo', 'estimate', '2026-10-08'),
	('est_enterprise', 'cl_fender', 'cl_fender:estimate_enterprise_range', 'Enterprise uplift range', 'sum of four stored lines, low and high', 'usd', NULL, NULL, 'coo', 'estimate', '2026-10-08');

INSERT INTO sandbox.fender_dealer_catalog
SELECT report_date, model_number, upc, brand, product_type, product_subtype, series, model_name, availability,
       inventory_level, expected_availability, msrp, map_price, source_file, loaded_at
FROM command.fmic_dealer_catalog;

SELECT sandbox.reload_readings('cl_fender');

INSERT INTO sandbox.action_item (action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at, due_date) VALUES
	('act_suppressed_B00I5QXTYU', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B00I5QXTYU_r3', 'lst_B00I5QXTYU', 'Match the outside price or correct the outside listing for B00I5QXTYU', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-19 14:00:00.276319+00', NULL),
	('act_suppressed_B08L36383B', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L36383B_r3', 'lst_B08L36383B', 'Match the outside price or correct the outside listing for B08L36383B', 'client', 'open', 'high', '2026-10-19 14:00:00.276319+00', '2026-10-26 14:00:00.361206+00', NULL),
	('act_suppressed_B09R6FB9C2', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B09R6FB9C2_r3', 'lst_B09R6FB9C2', 'Match the outside price or correct the outside listing for B09R6FB9C2', 'client', 'open', 'high', '2026-10-15 13:35:29.460505+00', '2026-10-15 13:35:29.460505+00', NULL),
	('act_suppressed_B0B6211V4R', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0B6211V4R_r3', 'lst_B0B6211V4R', 'Match the outside price or correct the outside listing for B0B6211V4R', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-15 13:45:21.783798+00', NULL),
	('act_suppressed_B0B623JL3C', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0B623JL3C_r3', 'lst_B0B623JL3C', 'Match the outside price or correct the outside listing for B0B623JL3C', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0B6277LBK', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0B6277LBK_r3', 'lst_B0B6277LBK', 'Match the outside price or correct the outside listing for B0B6277LBK', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0B627SLR9', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0B627SLR9_r3', 'lst_B0B627SLR9', 'Match the outside price or correct the outside listing for B0B627SLR9', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0B629JZ8K', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0B629JZ8K_r3', 'lst_B0B629JZ8K', 'Match the outside price or correct the outside listing for B0B629JZ8K', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0B9ZVTN24', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0B9ZVTN24_r3', 'lst_B0B9ZVTN24', 'Match the outside price or correct the outside listing for B0B9ZVTN24', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0CNKR6Z9Y', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0CNKR6Z9Y_r3', 'lst_B0CNKR6Z9Y', 'Match the outside price or correct the outside listing for B0CNKR6Z9Y', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-16 14:00:00.091923+00', NULL),
	('act_suppressed_B0CNKRB17N', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0CNKRB17N_r3', 'lst_B0CNKRB17N', 'Match the outside price or correct the outside listing for B0CNKRB17N', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08L35C3ST', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L35C3ST_r3', 'lst_B08L35C3ST', 'Match the outside price or correct the outside listing for B08L35C3ST', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-16 14:00:00.091923+00', NULL),
	('act_suppressed_B0CPBZP3TF', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0CPBZP3TF_r3', 'lst_B0CPBZP3TF', 'Match the outside price or correct the outside listing for B0CPBZP3TF', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0D2LMMBNR', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0D2LMMBNR_r3', 'lst_B0D2LMMBNR', 'Match the outside price or correct the outside listing for B0D2LMMBNR', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B000RW7U40', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B000RW7U40_r3', 'lst_B000RW7U40', 'Match the outside price or correct the outside listing for B000RW7U40', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B088FXLX79', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B088FXLX79_r3', 'lst_B088FXLX79', 'Match the outside price or correct the outside listing for B088FXLX79', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-23 14:00:00.385544+00', NULL),
	('act_suppressed_B08GL3HR1F', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08GL3HR1F_r3', 'lst_B08GL3HR1F', 'Match the outside price or correct the outside listing for B08GL3HR1F', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08GL4DT9F', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08GL4DT9F_r3', 'lst_B08GL4DT9F', 'Match the outside price or correct the outside listing for B08GL4DT9F', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08L35NYJT', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L35NYJT_r3', 'lst_B08L35NYJT', 'Match the outside price or correct the outside listing for B08L35NYJT', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-24 14:00:00.289481+00', NULL),
	('act_suppressed_B0D2LNNB24', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0D2LNNB24_r3', 'lst_B0D2LNNB24', 'Match the outside price or correct the outside listing for B0D2LNNB24', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B00EOQ96ZG', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B00EOQ96ZG_r3', 'lst_B00EOQ96ZG', 'Match the outside price or correct the outside listing for B00EOQ96ZG', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-16 14:00:00.091923+00', NULL),
	('act_suppressed_B0CS9XMZFG', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0CS9XMZFG_r3', 'lst_B0CS9XMZFG', 'Match the outside price or correct the outside listing for B0CS9XMZFG', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-16 14:00:00.091923+00', NULL),
	('act_authorized_seller_list', 'cl_fender', 'cl_fender:retail_control_partner_led', NULL, NULL, 'Supply the authorized-seller list', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0BQ2VT3D6', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0BQ2VT3D6_r3', 'lst_B0BQ2VT3D6', 'Match the outside price or correct the outside listing for B0BQ2VT3D6', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-13 14:41:32.893164+00', NULL),
	('act_suppressed_B08GL3NVBJ', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08GL3NVBJ_r3', 'lst_B08GL3NVBJ', 'Match the outside price or correct the outside listing for B08GL3NVBJ', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-13 14:41:32.893164+00', NULL),
	('act_suppressed_B0DCX2BFWB', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0DCX2BFWB_r3', 'lst_B0DCX2BFWB', 'Match the outside price or correct the outside listing for B0DCX2BFWB', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-13 14:41:32.893164+00', NULL),
	('act_suppressed_B08GLZ8R3M', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08GLZ8R3M_r3', 'lst_B08GLZ8R3M', 'Match the outside price or correct the outside listing for B08GLZ8R3M', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-13 14:41:32.893164+00', NULL),
	('act_suppressed_B0D87QRBF8', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0D87QRBF8_r3', 'lst_B0D87QRBF8', 'Match the outside price or correct the outside listing for B0D87QRBF8', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-13 14:41:32.893164+00', NULL),
	('act_suppressed_B08L32XHK8', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L32XHK8_r3', 'lst_B08L32XHK8', 'Match the outside price or correct the outside listing for B08L32XHK8', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08L31GJWZ', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L31GJWZ_r3', 'lst_B08L31GJWZ', 'Match the outside price or correct the outside listing for B08L31GJWZ', 'client', 'done', 'high', '2026-10-15 13:35:29.460505+00', '2026-10-24 14:00:00.289481+00', NULL),
	('act_suppressed_B0C2ZRX2YW', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0C2ZRX2YW_r3', 'lst_B0C2ZRX2YW', 'Match the outside price or correct the outside listing for B0C2ZRX2YW', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-19 14:00:00.276319+00', NULL),
	('act_suppressed_B0C8BJVNPZ', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0C8BJVNPZ_r3', 'lst_B0C8BJVNPZ', 'Match the outside price or correct the outside listing for B0C8BJVNPZ', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0C8BJYTVZ', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0C8BJYTVZ_r3', 'lst_B0C8BJYTVZ', 'Match the outside price or correct the outside listing for B0C8BJYTVZ', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0C8BKGKG5', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0C8BKGKG5_r3', 'lst_B0C8BKGKG5', 'Match the outside price or correct the outside listing for B0C8BKGKG5', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B07T7H78BL', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B07T7H78BL_r3', 'lst_B07T7H78BL', 'Match the outside price or correct the outside listing for B07T7H78BL', 'client', 'done', 'high', '2026-10-16 14:00:00.091923+00', '2026-10-19 14:00:00.276319+00', NULL),
	('act_suppressed_B07XDFJ6K3', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B07XDFJ6K3_r3', 'lst_B07XDFJ6K3', 'Match the outside price or correct the outside listing for B07XDFJ6K3', 'client', 'open', 'high', '2026-10-16 14:00:00.091923+00', '2026-10-16 14:00:00.091923+00', NULL),
	('act_suppressed_B07ZFJQR5P', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B07ZFJQR5P_r3', 'lst_B07ZFJQR5P', 'Match the outside price or correct the outside listing for B07ZFJQR5P', 'client', 'open', 'high', '2026-10-16 14:00:00.091923+00', '2026-10-16 14:00:00.091923+00', NULL),
	('act_suppressed_B08L33Z2LF', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L33Z2LF_r3', 'lst_B08L33Z2LF', 'Match the outside price or correct the outside listing for B08L33Z2LF', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08L34LQZG', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L34LQZG_r3', 'lst_B08L34LQZG', 'Match the outside price or correct the outside listing for B08L34LQZG', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-24 14:00:00.289481+00', NULL),
	('act_suppressed_B08L31K9JV', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L31K9JV_r3', 'lst_B08L31K9JV', 'Match the outside price or correct the outside listing for B08L31K9JV', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-24 14:00:00.289481+00', NULL),
	('act_suppressed_B08GL28YDK', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08GL28YDK_r3', 'lst_B08GL28YDK', 'Match the outside price or correct the outside listing for B08GL28YDK', 'client', 'done', 'high', '2026-10-16 14:00:00.091923+00', '2026-10-22 14:00:00.290198+00', NULL),
	('act_suppressed_B08L31Z9RN', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L31Z9RN_r3', 'lst_B08L31Z9RN', 'Match the outside price or correct the outside listing for B08L31Z9RN', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-17 14:00:00.278953+00', NULL),
	('act_suppressed_B08L34BFNZ', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L34BFNZ_r3', 'lst_B08L34BFNZ', 'Match the outside price or correct the outside listing for B08L34BFNZ', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08L34XV4J', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L34XV4J_r3', 'lst_B08L34XV4J', 'Match the outside price or correct the outside listing for B08L34XV4J', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-26 14:00:00.361206+00', NULL),
	('act_suppressed_B08L32YG11', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L32YG11_r3', 'lst_B08L32YG11', 'Match the outside price or correct the outside listing for B08L32YG11', 'client', 'done', 'high', '2026-10-13 14:41:32.893164+00', '2026-10-19 14:00:00.276319+00', NULL),
	('act_suppressed_B08L33J2TT', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L33J2TT_r3', 'lst_B08L33J2TT', 'Match the outside price or correct the outside listing for B08L33J2TT', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08L33JRGK', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L33JRGK_r3', 'lst_B08L33JRGK', 'Match the outside price or correct the outside listing for B08L33JRGK', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_map_sheet', 'cl_fender', 'cl_fender:map_below', NULL, NULL, 'Supply the MAP sheet', 'client', 'open', 'medium', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B08L334L1X', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L334L1X_r3', 'lst_B08L334L1X', 'Match the outside price or correct the outside listing for B08L334L1X', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-24 14:00:00.289481+00', NULL),
	('act_suppressed_B08L33PKSW', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B08L33PKSW_r3', 'lst_B08L33PKSW', 'Match the outside price or correct the outside listing for B08L33PKSW', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-24 14:00:00.289481+00', NULL)
ON CONFLICT (action_item_id) DO UPDATE SET created_at = LEAST(sandbox.action_item.created_at, EXCLUDED.created_at);
INSERT INTO sandbox.action_item (action_item_id, client_id, registry_key, finding_ref, listing_id, title, owner, status, severity, created_at, updated_at, due_date) VALUES
	('act_suppressed_B0D76XP4DN', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0D76XP4DN_r3', 'lst_B0D76XP4DN', 'Match the outside price or correct the outside listing for B0D76XP4DN', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-17 14:00:00.278953+00', NULL),
	('act_suppressed_B0D2M95G9J', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0D2M95G9J_r3', 'lst_B0D2M95G9J', 'Match the outside price or correct the outside listing for B0D2M95G9J', 'client', 'done', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-17 14:00:00.278953+00', NULL),
	('act_suppressed_B0D2LPFNJ1', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0D2LPFNJ1_r3', 'lst_B0D2LPFNJ1', 'Match the outside price or correct the outside listing for B0D2LPFNJ1', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0D2LQNDS7', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0D2LQNDS7_r3', 'lst_B0D2LQNDS7', 'Match the outside price or correct the outside listing for B0D2LQNDS7', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0DQ1LRD7J', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0DQ1LRD7J_r3', 'lst_B0DQ1LRD7J', 'Match the outside price or correct the outside listing for B0DQ1LRD7J', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0F6VHHWYG', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0F6VHHWYG_r3', 'lst_B0F6VHHWYG', 'Match the outside price or correct the outside listing for B0F6VHHWYG', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0F6WMD3RH', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0F6WMD3RH_r3', 'lst_B0F6WMD3RH', 'Match the outside price or correct the outside listing for B0F6WMD3RH', 'client', 'open', 'high', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_suppressed_B0GNNN9SN8', 'cl_fender', 'cl_fender:featured_offer_suppressed', 'lor_B0GNNN9SN8_r3', 'lst_B0GNNN9SN8', 'Match the outside price or correct the outside listing for B0GNNN9SN8', 'client', 'open', 'high', '2026-10-13 14:41:32.893164+00', '2026-10-15 13:35:29.460505+00', NULL),
	('act_additional_property', 'cl_fender', 'cl_fender:spec_additional_property_missing', NULL, NULL, 'Add additionalProperty to 364 found fender.com pages', 'intofocus', 'open', 'medium', '2026-10-08 20:46:47.499089+00', '2026-10-26 14:00:00.361206+00', NULL),
	('act_seller_read', 'cl_fender', 'cl_fender:seller_read_coverage', NULL, NULL, 'Finish the seller read for 56 active offers', 'intofocus', 'open', 'medium', '2026-10-08 20:46:47.499089+00', '2026-10-25 14:00:00.341466+00', NULL),
	('act_phase1_inputs', 'cl_fender', 'cl_fender:estimate_phase1_uplift', NULL, NULL, 'Supply the Phase 1 uplift inputs (COO)', 'intofocus', 'open', 'medium', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL),
	('act_enterprise_inputs', 'cl_fender', 'cl_fender:estimate_enterprise_range', NULL, NULL, 'Supply the enterprise range inputs (COO)', 'intofocus', 'open', 'medium', '2026-10-08 20:46:47.499089+00', '2026-10-08 20:46:47.499089+00', NULL)
ON CONFLICT (action_item_id) DO UPDATE SET created_at = LEAST(sandbox.action_item.created_at, EXCLUDED.created_at);

SELECT sandbox.refresh_metric_values('cl_fender');
