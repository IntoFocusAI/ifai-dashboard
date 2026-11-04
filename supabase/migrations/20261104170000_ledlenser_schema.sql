-- Ledlenser, second dashboard client: its own schema, kept apart from Fender (2026-11-04).
--
-- What this adds (additive only; no existing object or row is changed):
--   * schema ledlenser          data tables written by the Ledlenser Toolbelt assistant, plus the
--                               canvas_* views the dashboard reads for Ledlenser
--   * schema ledlenser_private  helper views behind the canvas_* views (not exposed to the API)
--   * ledlenser.client_config   one row: display name, seller type, brand sites, Amazon seller ids,
--                               competitor set
--   * command.organizations     a 'ledlenser' org, with the same two IntoFocus staff as org_admin as Fender
--   * public.set_aside_clients  a 'ledlenser' client key for the shared set-aside tables
--   * pg_cron job               ledlenser_refresh_stock_loss_v2, hourly at :47
--
-- Why a separate schema: decided with Brian Watson on 2026-11-04. The command.fmic_* tables carry no
-- client key, and the Fender jobs update, count and delete across whole tables, so Ledlenser rows in
-- the same tables would corrupt Fender's numbers. Nothing in this file reads or writes command.fmic_*.
--
-- Table shapes mirror command.fmic_* as of 2026-11-04, with Fender-specific names made generic:
--   fmic_electric_catalog      -> catalog
--   fmic_spec_readiness.fender_* -> spec_readiness.brand_site_*
--   fmic_ai_simulations.probe_brand_sku -> ai_simulations.probe_brand_sku, outcome 'brand_win' -> 'brand_win'
--   fmic_retail_buybox_map     -> retail_buybox_map, without the Musician's Friend (mf_*) columns
-- brand_catalog is new: the brand's own product sheet (Plytix export), loaded without wholesale price or
-- cost, because the canvas views are readable with the public key until login ships.
--
-- Canvas views: ledlenser.canvas_* mirror the public.canvas_* Fender views with no Fender names in them.
-- The dashboard maps both clients to one internal shape. Differences from the Fender views:
--   outcome 'fender_win'                    -> 'brand_win'
--   fender_wins, fender_win_pct             -> brand_wins, brand_win_pct
--   fender_url, fender_found, fender_*      -> brand_site_url, brand_site_found, brand_site_*
--   spec_fender_found(_pct), spec_avg_fender_pct -> spec_brand_site_found(_pct), spec_avg_brand_site_pct
--   probe_fender_sku                        -> probe_brand_sku
--   canvas_spec_missing_fields.source 'fender' -> 'brand_site'
--   mf_* (Musician's Friend) columns        -> not present
--   canvas_competitor_sov labels the client's wins 'Ledlenser' (Fender's say 'Fender/Squier')
--   canvas_metrics adds bb_brand and bb_brand_pct (Buy Boxes held by the brand's own seller)
-- canvas_listing_sales_loss (v1) and canvas_listing_stock_episodes (v1) are not copied; the dashboard
-- reads the v2 views. Sales come from SmartScout only; there is no brand-reported sales step.
--
-- Not done here (owner steps):
--   * Add "ledlenser" to the API's exposed schemas (Supabase dashboard > Settings > API > Exposed schemas)
--     so the dashboard can read ledlenser.canvas_*.
--
-- Undo:
--   SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ledlenser_refresh_stock_loss_v2';
--   DROP SCHEMA ledlenser_private CASCADE;
--   DROP SCHEMA ledlenser CASCADE;
--   DELETE FROM public.set_aside_clients WHERE client_key = 'ledlenser';   -- only while no set-asides use it
--   DELETE FROM command.organizations WHERE slug = 'ledlenser';             -- memberships cascade
--   NOTIFY pgrst, 'reload schema';

CREATE SCHEMA ledlenser;
CREATE SCHEMA ledlenser_private;

COMMENT ON SCHEMA ledlenser IS
  'Ledlenser client data (Toolbelt writes with service_role) and the canvas_* views the dashboard reads. Mirrors command.fmic_* for Fender.';
COMMENT ON SCHEMA ledlenser_private IS
  'Helper views behind ledlenser.canvas_*. Not exposed to the API.';

-- ---------------------------------------------------------------------------------------------------
-- Client config
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE ledlenser.client_config (
  client_key text PRIMARY KEY CHECK (client_key = 'ledlenser'),
  display_name text NOT NULL,
  legal_name text,
  seller_type text NOT NULL CHECK (seller_type IN ('partner_led', 'brand_led', 'amazon_retail_only', 'hybrid', 'no_managed_presence')),
  brand_site_domains text[] NOT NULL,
  brand_name_terms text[] NOT NULL,
  amazon_brand_names text[] NOT NULL,
  brand_seller_ids text[] NOT NULL DEFAULT '{}',
  competitor_brands jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ledlenser.client_config IS
  'One row. brand_seller_ids are Amazon seller ids that count as the brand selling (brand-led). competitor_brands is the AI Search competitor set: [{name, terms[], domains[]}].';

INSERT INTO ledlenser.client_config
  (client_key, display_name, legal_name, seller_type, brand_site_domains, brand_name_terms, amazon_brand_names,
   brand_seller_ids, competitor_brands)
VALUES (
  'ledlenser',
  'Ledlenser',
  'Ledlenser GmbH & Co. KG',
  'brand_led',
  ARRAY['ledlenser.com', 'ledlenserusa.com'],
  ARRAY['ledlenser', 'led lenser'],
  ARRAY['Ledlenser', 'LED Lenser'],
  -- "Ledlenser USA" (River City Distributors LLC), the only US seller holding the Buy Box on 2026-11-04.
  ARRAY['A1A8DQ0I1V6KE5'],
  '[
    {"name": "Petzl",         "terms": ["petzl"],                    "domains": ["petzl.com"]},
    {"name": "Black Diamond", "terms": ["black diamond"],            "domains": ["blackdiamondequipment.com"]},
    {"name": "Fenix",         "terms": ["fenix"],                    "domains": ["fenixlighting.com", "fenixlight.com"]},
    {"name": "Nitecore",      "terms": ["nitecore"],                 "domains": ["nitecore.com", "flashlight.nitecore.com", "nitecorestore.com"]},
    {"name": "Olight",        "terms": ["olight"],                   "domains": ["olight.com", "olightstore.com"]},
    {"name": "Streamlight",   "terms": ["streamlight"],              "domains": ["streamlight.com"]},
    {"name": "Coast",         "terms": ["coast"],                    "domains": ["coastportland.com"]},
    {"name": "Klein Tools",   "terms": ["klein tools", "klein"],     "domains": ["kleintools.com"]}
  ]'::jsonb
);

-- ---------------------------------------------------------------------------------------------------
-- Trigger functions (copies of the command.* ones, scoped to this schema)
-- ---------------------------------------------------------------------------------------------------

CREATE FUNCTION ledlenser.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- Same as command.fmic_capture_history, writing to ledlenser.<table>_history.
CREATE FUNCTION ledlenser.capture_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  ignore_cols text[] := CASE WHEN TG_NARGS > 1 THEN TG_ARGV[1:TG_NARGS - 1] ELSE '{}'::text[] END;
  new_j jsonb := to_jsonb(NEW) - ignore_cols;
BEGIN
  IF TG_OP = 'UPDATE' AND new_j = (to_jsonb(OLD) - ignore_cols) THEN
    RETURN NEW;
  END IF;
  EXECUTE format('INSERT INTO ledlenser.%I (entity_key, row_hash, op, row_data) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', TG_TABLE_NAME || '_history')
    USING new_j ->> TG_ARGV[0], md5(new_j::text), TG_OP, new_j;
  RETURN NEW;
END $$;

-- Walmart only; Ledlenser has no Musician's Friend channel.
CREATE FUNCTION ledlenser.enforce_channel_leakage()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.wmt_leakage := CASE WHEN NEW.map_price IS NOT NULL AND NEW.wmt_price IS NOT NULL THEN round(NEW.wmt_price - NEW.map_price, 2) END;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------------------------------
-- Brand product sheet
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE ledlenser.brand_catalog (
  sku text PRIMARY KEY,
  label text NOT NULL,
  gtin text,
  upc text,
  category_path text,
  division text,
  family text,
  sheet_status text,
  model text,
  edition text,
  color text,
  short_description text,
  description text,
  key_features text,
  map_price numeric(10,2),
  max_lumens integer,
  min_lumens integer,
  ip_rating text,
  weight_g integer,
  rechargeable boolean,
  battery_type text,
  included_accessories text,
  youtube_url text,
  datasheet_url text,
  user_manual_url text,
  keywords text,
  source_file text NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brand_catalog_upc_idx ON ledlenser.brand_catalog (upc);
CREATE INDEX brand_catalog_model_idx ON ledlenser.brand_catalog (model);

COMMENT ON TABLE ledlenser.brand_catalog IS
  'Ledlenser''s own product sheet (Plytix export). Wholesale price and cost columns are deliberately not stored. division is the first part of the sheet''s category path (Headlamps, Flashlights, ...).';

-- ---------------------------------------------------------------------------------------------------
-- Amazon catalog, content, Keepa, sellers, SmartScout
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE ledlenser.catalog (
  asin varchar PRIMARY KEY,
  model_number varchar,
  upc varchar,
  ean varchar,
  title text,
  brand varchar,
  manufacturer varchar,
  color varchar,
  category varchar,
  parent_asin varchar,
  current_price numeric(10,2),
  list_price numeric(10,2),
  sales_rank integer,
  monthly_sold integer,
  is_bundle boolean DEFAULT false,
  buybox_seller varchar,
  amazon_stock varchar,
  product_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  extracted_at timestamptz,
  buybox_is_fba boolean,
  buybox_checked_at timestamptz,
  offer_count_new integer,
  brand_sku text
);
CREATE INDEX catalog_upc_idx ON ledlenser.catalog (upc);
CREATE INDEX catalog_model_idx ON ledlenser.catalog (model_number);
CREATE INDEX catalog_sales_rank_idx ON ledlenser.catalog (sales_rank);
COMMENT ON COLUMN ledlenser.catalog.brand_sku IS 'ledlenser.brand_catalog.sku this listing matched (by UPC or model), when it matched.';

CREATE TABLE ledlenser.catalog_history (
  entity_key text, row_hash text, op text, row_data jsonb, updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (entity_key, row_hash)
);
CREATE TRIGGER catalog_history AFTER INSERT OR UPDATE ON ledlenser.catalog
  FOR EACH ROW EXECUTE FUNCTION ledlenser.capture_history('asin', 'created_at', 'updated_at', 'extracted_at');

CREATE TABLE ledlenser.listing_content (
  asin text PRIMARY KEY,
  checked_at timestamptz NOT NULL,
  keepa_last_update timestamptz,
  source text NOT NULL DEFAULT 'keepa_product_raw',
  collector_version text NOT NULL,
  raw_payload_ref text,
  title text,
  bullet_count integer,
  bullets jsonb,
  image_count integer,
  main_image_px integer,
  min_image_px integer,
  images jsonb,
  category_id bigint,
  category_path text,
  category_tree jsonb,
  root_category bigint,
  sales_rank_reference bigint,
  website_display_group text,
  website_display_group_name text,
  item_type_keyword text,
  product_type_code integer,
  material text,
  parent_asin text,
  variation_count integer,
  variation_asins jsonb,
  has_reviews boolean,
  listed_since timestamptz,
  amazon_oos_pct_90 integer,
  new_oos_pct_90 integer,
  amazon_oos_count_30 integer,
  amazon_oos_count_90 integer,
  aplus_state text NOT NULL DEFAULT 'not_collected',
  video_state text NOT NULL DEFAULT 'not_collected',
  rating_state text NOT NULL DEFAULT 'not_collected',
  updated_at timestamptz NOT NULL DEFAULT now(),
  part_number text,
  parent_title text,
  gtin_list jsonb,
  is_redirect_asin boolean,
  style text,
  size text,
  product_type_name text,
  materials jsonb,
  sales_rank_display_group text,
  package_quantity integer,
  number_of_items integer,
  item_length_mm integer,
  item_width_mm integer,
  item_height_mm integer,
  item_weight_g integer,
  package_length_mm integer,
  package_width_mm integer,
  package_height_mm integer,
  package_weight_g integer,
  fba_pick_pack_fee numeric(10,2),
  referral_fee_pct numeric(5,2),
  suggested_lower_price numeric(10,2),
  competitive_price_threshold numeric(10,2),
  availability_amazon_delay jsonb,
  last_price_change_at timestamptz,
  last_rating_update_at timestamptz,
  tracking_since timestamptz,
  url_slug text,
  description text,
  description_length integer,
  aplus_text text,
  aplus_module_count integer,
  videos jsonb,
  video_count integer,
  content_checked_at timestamptz,
  content_payload_ref text
);
CREATE INDEX listing_content_part_number_idx ON ledlenser.listing_content (part_number);

CREATE TABLE ledlenser.listing_content_history (
  entity_key text, row_hash text, op text, row_data jsonb, updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (entity_key, row_hash)
);
CREATE TRIGGER listing_content_history AFTER INSERT OR UPDATE ON ledlenser.listing_content
  FOR EACH ROW EXECUTE FUNCTION ledlenser.capture_history('asin', 'updated_at', 'checked_at', 'keepa_last_update', 'raw_payload_ref', 'collector_version', 'content_checked_at', 'content_payload_ref');

CREATE TABLE ledlenser.keepa_daily (
  asin text NOT NULL,
  day date NOT NULL,
  sales_rank_min integer,
  sales_rank_avg integer,
  sales_rank_close integer,
  sales_rank_drops integer,
  new_price_min numeric(10,2),
  new_price_close numeric(10,2),
  amazon_price_close numeric(10,2),
  amazon_in_stock boolean,
  buybox_price_close numeric(10,2),
  buybox_shipping_close numeric(10,2),
  rating numeric(2,1),
  review_count integer,
  source text,
  collector_version text,
  loaded_at timestamptz,
  PRIMARY KEY (asin, day)
);
CREATE INDEX keepa_daily_day_idx ON ledlenser.keepa_daily (day);

CREATE TABLE ledlenser.keepa_stats (
  asin text PRIMARY KEY,
  checked_at timestamptz NOT NULL,
  keepa_last_update timestamptz,
  collector_version text,
  raw_payload_ref text,
  sales_rank_current integer,
  sales_rank_avg30 integer,
  sales_rank_avg90 integer,
  sales_rank_avg180 integer,
  sales_rank_avg365 integer,
  sales_rank_drops_30 integer,
  sales_rank_drops_90 integer,
  sales_rank_drops_180 integer,
  sales_rank_drops_365 integer,
  new_price_current numeric(10,2),
  new_price_avg30 numeric(10,2),
  new_price_avg90 numeric(10,2),
  new_price_avg180 numeric(10,2),
  new_price_avg365 numeric(10,2),
  new_price_min numeric(10,2),
  new_price_min_at timestamptz,
  new_price_max numeric(10,2),
  new_price_max_at timestamptz,
  amazon_price_current numeric(10,2),
  amazon_price_avg90 numeric(10,2),
  amazon_price_avg365 numeric(10,2),
  amazon_price_min numeric(10,2),
  amazon_price_min_at timestamptz,
  list_price_current numeric(10,2),
  buybox_price_current numeric(10,2),
  buybox_price_avg90 numeric(10,2),
  buybox_price_avg365 numeric(10,2),
  new_offer_count_current integer,
  new_offer_count_avg90 integer,
  total_offer_count integer,
  amazon_oos_pct_30 integer,
  amazon_oos_pct_90 integer,
  amazon_oos_pct_180 integer,
  amazon_oos_pct_365 integer,
  new_oos_pct_30 integer,
  new_oos_pct_90 integer,
  new_oos_pct_180 integer,
  new_oos_pct_365 integer,
  amazon_oos_count_30 integer,
  amazon_oos_count_90 integer,
  buybox_is_amazon boolean,
  buybox_seller_id text,
  buybox_availability text,
  rating_current numeric(2,1),
  review_count_current integer,
  monthly_sold integer,
  monthly_sold_delta_pct_90 integer,
  stats jsonb,
  updated_at timestamptz
);

CREATE TABLE ledlenser.sellers (
  seller_id varchar PRIMARY KEY,
  seller_name text,
  is_amazon boolean,
  is_fba boolean,
  rating_pct integer,
  rating_count integer,
  first_seen timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledlenser.sellers_history (
  entity_key text, row_hash text, op text, row_data jsonb, updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (entity_key, row_hash)
);
CREATE TRIGGER sellers_history AFTER INSERT OR UPDATE ON ledlenser.sellers
  FOR EACH ROW EXECUTE FUNCTION ledlenser.capture_history('seller_id', 'updated_at');

CREATE TABLE ledlenser.smartscout_products (
  asin text NOT NULL,
  snapshot_date date NOT NULL,
  title text,
  tracking_status text,
  est_monthly_units integer,
  est_monthly_revenue numeric(14,2),
  buybox_price numeric(10,2),
  main_category_rank integer,
  review_count integer,
  review_rating numeric(2,1),
  brand_query text,
  raw jsonb,
  collector_version text,
  loaded_at timestamptz,
  parent_asin text,
  ttm_revenue numeric(14,2),
  prev_12m_revenue numeric(14,2),
  seller_count integer,
  fba_seller_count integer,
  amazon_in_stock_rate_90 numeric(5,4),
  page_score numeric(4,1),
  primary_subcategory_rank integer,
  listed_since date,
  smartscout_last_refreshed date,
  is_out_of_stock boolean,
  PRIMARY KEY (asin, snapshot_date)
);
CREATE INDEX smartscout_products_snapshot_idx ON ledlenser.smartscout_products (snapshot_date);

CREATE TABLE ledlenser.job_state (
  job_key varchar PRIMARY KEY,
  cursor_offset integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------------------------------
-- Runs, KPIs, divisions, retail read
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE ledlenser.audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id varchar(128) UNIQUE,
  trigger_type varchar(50) DEFAULT 'scheduled',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status varchar(30) NOT NULL DEFAULT 'running',
  asins_audited integer,
  violations_detected integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  run_kind text,
  run_state text CHECK (run_state IS NULL OR run_state IN ('running', 'completed', 'partial', 'failed', 'historical')),
  collector_version text,
  prompt_set_hash text,
  expected_calls integer,
  attempted_calls integer,
  answered_calls integer,
  error_calls integer,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  prompt_set_id uuid,
  versioned_set_hash text,
  CONSTRAINT audit_runs_published_check CHECK (NOT is_published OR (prompt_set_hash IS NOT NULL AND run_state IN ('completed', 'partial')))
);

CREATE TABLE ledlenser.brand_kpi_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES ledlenser.audit_runs (id) ON DELETE SET NULL,
  metric_id varchar(64) NOT NULL,
  metric_name varchar(128) NOT NULL,
  metric_value varchar(64) NOT NULL,
  numeric_value numeric(10,2),
  status_tone varchar(20) DEFAULT 'normal',
  trend_direction varchar(10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_kpi_metric_created_idx ON ledlenser.brand_kpi_summary (metric_id, created_at DESC);
CREATE TRIGGER brand_kpi_summary_updated_at BEFORE UPDATE ON ledlenser.brand_kpi_summary
  FOR EACH ROW EXECUTE FUNCTION ledlenser.touch_updated_at();

CREATE TABLE ledlenser.division_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES ledlenser.audit_runs (id) ON DELETE SET NULL,
  division varchar(80) NOT NULL,
  monitored_skus integer NOT NULL DEFAULT 0,
  buybox_pct numeric(5,2) NOT NULL DEFAULT 0.00,
  splinter_bundles integer NOT NULL DEFAULT 0,
  schema_sync_pct numeric(5,2) NOT NULL DEFAULT 0.00,
  primary_threat varchar(255),
  strategic_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX division_metrics_div_created_idx ON ledlenser.division_metrics (division, created_at DESC);
CREATE TRIGGER division_metrics_updated_at BEFORE UPDATE ON ledlenser.division_metrics
  FOR EACH ROW EXECUTE FUNCTION ledlenser.touch_updated_at();

CREATE TABLE ledlenser.retail_buybox_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES ledlenser.audit_runs (id) ON DELETE SET NULL,
  asin varchar(12) NOT NULL UNIQUE,
  model_name varchar(150) NOT NULL,
  bundle_name varchar(255),
  map_price numeric(10,2),
  offer_price numeric(10,2) NOT NULL,
  leakage_amount numeric(10,2) GENERATED ALWAYS AS (offer_price - map_price) STORED,
  reviews_count integer NOT NULL DEFAULT 0,
  channels varchar(50) DEFAULT 'AMZ',
  -- Brand-led statuses: 'Brand Seller' (a client_config.brand_seller_ids seller holds the Buy Box),
  -- 'Amazon 1P', '3P Confirmed', 'No Active Offer', 'Unknown/Not Harvested'.
  buybox_status varchar(50) NOT NULL DEFAULT 'Unknown/Not Harvested',
  buybox_winner varchar(100),
  buybox_share_pct numeric(5,2) DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  wmt_price numeric(10,2),
  wmt_title text,
  wmt_url text,
  wmt_seller text,
  wmt_leakage numeric,
  wmt_match_conf numeric,
  wmt_checked_at timestamptz,
  competitive_price_threshold_cents integer,
  featured_offer_withheld boolean,
  featured_offer_state text,
  featured_offer_checked_at timestamptz,
  featured_offer_attempted_at timestamptz,
  featured_offer_source text,
  featured_offer_last_error text,
  competitive_external_price_state text,
  featured_offer_observed_price_cents integer,
  featured_offer_observed_shipping_cents integer,
  featured_offer_observed_seller text
);
CREATE INDEX retail_buybox_map_status_idx ON ledlenser.retail_buybox_map (buybox_status);
CREATE TRIGGER retail_buybox_map_channel_leakage BEFORE INSERT OR UPDATE ON ledlenser.retail_buybox_map
  FOR EACH ROW EXECUTE FUNCTION ledlenser.enforce_channel_leakage();
CREATE TRIGGER retail_buybox_map_updated_at BEFORE UPDATE ON ledlenser.retail_buybox_map
  FOR EACH ROW EXECUTE FUNCTION ledlenser.touch_updated_at();

CREATE TABLE ledlenser.retail_buybox_map_history (
  entity_key text, row_hash text, op text, row_data jsonb, updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (entity_key, row_hash)
);
CREATE TRIGGER retail_buybox_map_history AFTER INSERT OR UPDATE ON ledlenser.retail_buybox_map
  FOR EACH ROW EXECUTE FUNCTION ledlenser.capture_history('asin', 'id', 'created_at', 'updated_at', 'audit_run_id');

CREATE TABLE ledlenser.listing_channel_price (
  asin varchar(12) NOT NULL,
  channel text NOT NULL CHECK (channel ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  price numeric(10,2) NOT NULL CHECK (price > 0),
  url text,
  checked_at timestamptz NOT NULL,
  PRIMARY KEY (asin, channel)
);

-- ---------------------------------------------------------------------------------------------------
-- Spec readiness and findability (brand site = ledlenser.com / ledlenserusa.com)
-- ---------------------------------------------------------------------------------------------------

CREATE TABLE ledlenser.spec_readiness (
  id varchar PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  asin varchar NOT NULL,
  title text,
  category varchar,
  amazon_fields_found integer,
  amazon_fields_expected integer,
  amazon_completeness_pct double precision,
  amazon_missing_fields text,
  amazon_checked boolean,
  brand_site_url text,
  brand_site_found boolean,
  brand_site_fields_found integer,
  brand_site_fields_expected integer,
  brand_site_completeness_pct double precision,
  brand_site_missing_fields text,
  checked_at timestamptz,
  batch_run_id varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  collector_version text,
  brand_site_page_source text,
  brand_site_identity_match text,
  brand_site_variant_sku text,
  brand_site_spec_values jsonb,
  brand_site_rating_markup boolean,
  amazon_spec_values jsonb,
  amazon_gtin text,
  amazon_mpn text,
  amazon_aplus_state text,
  amazon_aplus_image_count integer,
  amazon_video_state text,
  amazon_bullet_count integer,
  amazon_image_count integer
);
CREATE INDEX spec_readiness_asin_checked_idx ON ledlenser.spec_readiness (asin, checked_at DESC);

-- Shared by both findability tables.
CREATE DOMAIN ledlenser.findability_state AS text CHECK (VALUE IN (
  'exact_official_product', 'official_family_page', 'ambiguous_candidate', 'completed_not_found',
  'unsupported_product_type', 'blocked', 'timeout', 'parse_failure', 'not_checked'));
CREATE DOMAIN ledlenser.product_kind AS text CHECK (VALUE IN (
  'headlamp', 'flashlight', 'work_light', 'area_light', 'lantern', 'powerbank', 'accessory'));

CREATE TABLE ledlenser.spec_findability_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_key text NOT NULL UNIQUE,
  asin varchar NOT NULL,
  findability_state ledlenser.findability_state NOT NULL,
  canonical_url text,
  resolved_url text,
  source_method text CHECK (source_method IS NULL OR source_method IN ('variant_sku', 'search_meta', 'derived_handle', 'model_number_search')),
  matched_identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  conflicting_identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_confidence text NOT NULL DEFAULT 'none' CHECK (match_confidence IN ('sku', 'gtin', 'variant_options', 'none')),
  match_explanation text,
  page_title text,
  canonical_tag text,
  structured_identifiers jsonb,
  http_status integer,
  browser_outcome text,
  collector_version text NOT NULL,
  last_error text,
  attempt_at timestamptz NOT NULL DEFAULT now(),
  product_kind ledlenser.product_kind,
  schema_profile text,
  schema_fields_present jsonb,
  schema_fields_missing jsonb,
  catalog_identity_hash text,
  variant_sku text,
  jsonld_status text NOT NULL DEFAULT 'not_checked' CHECK (jsonld_status IN ('checked', 'not_checked', 'blocked', 'parse_failure')),
  CONSTRAINT spec_findability_attempt_jsonld_fields_chk CHECK (jsonld_status <> 'not_checked' OR (schema_profile IS NULL AND schema_fields_present IS NULL AND schema_fields_missing IS NULL)),
  CONSTRAINT spec_findability_attempt_url_chk CHECK (
    (findability_state IN ('exact_official_product', 'official_family_page')
      AND canonical_url ~ '^https://(www\.)?(ledlenser\.com|ledlenserusa\.com)/\S+$'
      AND match_confidence IN ('sku', 'gtin', 'variant_options')
      AND product_kind IS NOT NULL AND variant_sku IS NOT NULL)
    OR (findability_state NOT IN ('exact_official_product', 'official_family_page') AND canonical_url IS NULL))
);
CREATE INDEX spec_findability_attempt_asin_idx ON ledlenser.spec_findability_attempt (asin, attempt_at DESC);

CREATE TABLE ledlenser.spec_findability_current (
  asin varchar PRIMARY KEY,
  title text,
  category text,
  findability_state ledlenser.findability_state NOT NULL,
  canonical_url text,
  resolved_url text,
  source_method text,
  matched_identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  conflicting_identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_confidence text NOT NULL DEFAULT 'none' CHECK (match_confidence IN ('sku', 'gtin', 'variant_options', 'none')),
  match_explanation text,
  page_title text,
  canonical_tag text,
  structured_identifiers jsonb,
  http_status integer,
  browser_outcome text,
  collector_version text,
  last_error text,
  attempt_at timestamptz NOT NULL,
  product_kind ledlenser.product_kind,
  schema_profile text,
  schema_fields_present jsonb,
  schema_fields_missing jsonb,
  catalog_identity_hash text,
  variant_sku text,
  attempt_key text,
  last_success_state text,
  last_success_url text,
  last_success_variant_sku text,
  last_success_at timestamptz,
  last_success_identity_hash text,
  last_success_explanation text,
  last_success_schema_profile text,
  last_success_fields_present jsonb,
  last_success_fields_missing jsonb,
  jsonld_status text NOT NULL DEFAULT 'not_checked' CHECK (jsonld_status IN ('checked', 'not_checked', 'blocked', 'parse_failure')),
  CONSTRAINT spec_findability_current_jsonld_fields_chk CHECK (jsonld_status <> 'not_checked' OR (schema_profile IS NULL AND schema_fields_present IS NULL AND schema_fields_missing IS NULL)),
  CONSTRAINT spec_findability_current_url_chk CHECK (
    (findability_state IN ('exact_official_product', 'official_family_page')
      AND canonical_url ~ '^https://(www\.)?(ledlenser\.com|ledlenserusa\.com)/\S+$'
      AND match_confidence IN ('sku', 'gtin', 'variant_options')
      AND product_kind IS NOT NULL AND variant_sku IS NOT NULL)
    OR (findability_state NOT IN ('exact_official_product', 'official_family_page') AND canonical_url IS NULL)),
  CONSTRAINT spec_findability_current_success_url_chk CHECK (
    last_success_state IS NULL
    OR (last_success_state IN ('exact_official_product', 'official_family_page')
      AND last_success_url ~ '^https://(www\.)?(ledlenser\.com|ledlenserusa\.com)/\S+$'
      AND last_success_at IS NOT NULL AND last_success_variant_sku IS NOT NULL))
);

-- ---------------------------------------------------------------------------------------------------
-- AI Search
-- ---------------------------------------------------------------------------------------------------

-- analytical_intent, headline_denominator and names_client_brand live on the prompt row here (Fender keeps
-- them on versioned prompt revisions). A versioned prompt-set workflow for Ledlenser is later work.
CREATE TABLE ledlenser.ai_prompts (
  prompt_key text PRIMARY KEY,
  prompt_text text NOT NULL UNIQUE,
  category varchar(60) NOT NULL,
  prompt_kind text NOT NULL CHECK (prompt_kind IN ('commercial', 'probe')),
  analytical_intent text CHECK (analytical_intent IS NULL OR analytical_intent IN ('unbranded_discovery', 'shopping_guidance', 'brand_associated_discovery', 'branded_consideration', 'product_fact', 'product_fact_probe')),
  headline_denominator text CHECK (headline_denominator IS NULL OR headline_denominator IN ('unbranded_discovery', 'brand_associated_discovery', 'branded_consideration', 'excluded')),
  names_client_brand boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  probe_mode text DEFAULT 'fixed',
  probe_slots integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE ledlenser.ai_probe_facts (
  prompt_key text PRIMARY KEY REFERENCES ledlenser.ai_prompts (prompt_key),
  claim text NOT NULL,
  contradiction_pattern text NOT NULL,
  source_url text NOT NULL,
  verified_by text NOT NULL,
  verified_at timestamptz NOT NULL
);

CREATE TABLE ledlenser.ai_probe_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES ledlenser.audit_runs (id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  repeat_no integer NOT NULL,
  asin text,
  asins text[],
  sku text,
  category text,
  series text,
  spec_field text,
  question text,
  expected_value text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (audit_run_id, prompt_key, repeat_no)
);

CREATE TABLE ledlenser.ai_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES ledlenser.audit_runs (id) ON DELETE SET NULL,
  sim_id integer NOT NULL,
  category varchar(60) NOT NULL,
  prompt text NOT NULL,
  brand_win_rate numeric(5,2) NOT NULL DEFAULT 0.00,
  winner varchar(100),
  citations text,
  hallucination_flag boolean NOT NULL DEFAULT false,
  root_cause text,
  remediation_patch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  answer_text text,
  citation_urls text,
  engine varchar,
  repeat_no integer,
  prompt_key text,
  prompt_text text,
  prompt_kind text CHECK (prompt_kind IS NULL OR prompt_kind IN ('commercial', 'probe')),
  model text,
  call_status text CHECK (call_status IS NULL OR call_status IN ('answered', 'error')),
  outcome text CHECK (outcome IS NULL OR outcome IN ('brand_win', 'competitor_win', 'unresolved', 'error', 'not_scored')),
  primary_brand text,
  material_hallucination text CHECK (material_hallucination IS NULL OR material_hallucination IN ('none', 'confirmed', 'suspected', 'historical_unverified', 'not_evaluated')),
  hallucination_evidence text,
  attempt_no integer NOT NULL DEFAULT 1,
  error_message text,
  record_origin text,
  analytical_intent text CHECK (analytical_intent IS NULL OR analytical_intent IN ('unbranded_discovery', 'shopping_guidance', 'brand_associated_discovery', 'branded_consideration', 'product_fact', 'product_fact_probe')),
  headline_denominator text CHECK (headline_denominator IS NULL OR headline_denominator IN ('unbranded_discovery', 'brand_associated_discovery', 'branded_consideration', 'excluded')),
  prompt_revision_no integer,
  prompt_set_id uuid,
  versioned_set_hash text,
  source_ref text,
  probe_asin text,
  probe_asins text[],
  probe_brand_sku text,
  probe_category text,
  probe_series text,
  probe_spec_field text,
  probe_expected_value text,
  probe_source_url text,
  probe_amazon_value text,
  probe_is_anchor boolean,
  CONSTRAINT ai_sim_confirmed_needs_evidence CHECK (material_hallucination IS DISTINCT FROM 'confirmed' OR length(btrim(COALESCE(hallucination_evidence, ''))) > 0),
  UNIQUE (audit_run_id, sim_id)
);
CREATE INDEX ai_simulations_category_idx ON ledlenser.ai_simulations (category);
CREATE INDEX ai_simulations_probe_kind_idx ON ledlenser.ai_simulations (audit_run_id) WHERE prompt_kind = 'probe';
CREATE INDEX ai_simulations_probe_asin_idx ON ledlenser.ai_simulations (probe_asin) WHERE probe_asin IS NOT NULL;
CREATE TRIGGER ai_simulations_updated_at BEFORE UPDATE ON ledlenser.ai_simulations
  FOR EACH ROW EXECUTE FUNCTION ledlenser.touch_updated_at();

CREATE TABLE ledlenser.ai_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL REFERENCES ledlenser.ai_simulations (id) ON DELETE CASCADE,
  audit_run_id uuid,
  sim_id integer,
  engine text,
  position integer NOT NULL,
  url text NOT NULL,
  domain text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (simulation_id, position)
);
CREATE INDEX ai_citations_domain_idx ON ledlenser.ai_citations (domain);
CREATE INDEX ai_citations_run_idx ON ledlenser.ai_citations (audit_run_id);

CREATE TABLE ledlenser.ai_remediations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id uuid NOT NULL UNIQUE REFERENCES ledlenser.ai_simulations (id) ON DELETE CASCADE,
  remediation_text text NOT NULL CHECK (length(btrim(remediation_text)) > 0),
  basis text NOT NULL,
  source text NOT NULL CHECK (source IN ('curated', 'reviewed_generated')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Published runs are immutable, as for Fender.
CREATE FUNCTION ledlenser.block_published_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE rid uuid;
BEGIN
  rid := CASE WHEN TG_OP = 'DELETE' THEN OLD.audit_run_id ELSE NEW.audit_run_id END;
  IF rid IS NOT NULL AND EXISTS (SELECT 1 FROM ledlenser.audit_runs WHERE id = rid AND is_published) THEN
    RAISE EXCEPTION 'run % is published and immutable', rid;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER ai_simulations_published_immutable BEFORE INSERT OR DELETE OR UPDATE ON ledlenser.ai_simulations
  FOR EACH ROW EXECUTE FUNCTION ledlenser.block_published_edit();

CREATE FUNCTION ledlenser.ai_prompt_set_hash()
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT md5(string_agg(prompt_key || ':' || prompt_text, E'\n' ORDER BY prompt_key)) FROM ledlenser.ai_prompts WHERE active
$$;

-- Same rules as command.fmic_ai_publish_run, against Ledlenser's tables.
CREATE FUNCTION ledlenser.ai_publish_run(p_run_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE r ledlenser.audit_runs%ROWTYPE; n integer;
BEGIN
  SELECT * INTO r FROM ledlenser.audit_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'run % not found', p_run_id; END IF;
  IF r.is_published THEN RETURN; END IF;
  IF r.run_state IS NULL OR r.run_state NOT IN ('completed', 'partial') THEN
    RAISE EXCEPTION 'run % has run_state %, only completed or partial runs can be published', p_run_id, r.run_state;
  END IF;
  IF r.prompt_set_hash IS DISTINCT FROM ledlenser.ai_prompt_set_hash() THEN
    RAISE EXCEPTION 'run % prompt_set_hash does not match the active prompt set', p_run_id;
  END IF;
  SELECT count(*) INTO n FROM ledlenser.ai_simulations WHERE audit_run_id = p_run_id;
  IF r.expected_calls IS NULL OR r.attempted_calls IS DISTINCT FROM n OR n = 0 THEN
    RAISE EXCEPTION 'run % call counts do not reconcile (attempted %, rows %)', p_run_id, r.attempted_calls, n;
  END IF;
  UPDATE ledlenser.audit_runs SET is_published = true, published_at = now() WHERE id = p_run_id;
END $$;

-- ---------------------------------------------------------------------------------------------------
-- Private helper views (same logic as canvas_private.* for Fender).
-- ---------------------------------------------------------------------------------------------------

CREATE VIEW ledlenser_private.ai_current_run AS
SELECT id, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls, answered_calls,
  error_calls, started_at, completed_at, published_at
FROM ledlenser.audit_runs r
WHERE is_published AND run_kind = 'ai_simulation'
ORDER BY published_at DESC, id DESC
LIMIT 1;

CREATE VIEW ledlenser_private.ai_current_calls AS
SELECT s.id, s.audit_run_id, s.sim_id, s.category, s.prompt_key, s.prompt_text, s.prompt_kind, s.engine, s.model,
  s.repeat_no, s.attempt_no, s.call_status,
  s.outcome,
  s.primary_brand, s.winner, s.material_hallucination, s.hallucination_evidence,
  NULLIF(s.root_cause, '') AS root_cause, rem.remediation_text, s.error_message, s.answer_text, s.citation_urls,
  s.created_at, c.run_state, c.published_at,
  s.probe_asin, s.probe_asins, s.probe_brand_sku, s.probe_category, s.probe_series,
  s.probe_spec_field, s.probe_expected_value, s.probe_source_url, s.probe_amazon_value, s.probe_is_anchor
FROM ledlenser.ai_simulations s
JOIN ledlenser_private.ai_current_run c ON c.id = s.audit_run_id
LEFT JOIN ledlenser.ai_remediations rem ON rem.simulation_id = s.id;

-- Fender's version also admits two named October runs and pins collector v11; Ledlenser has neither.
CREATE VIEW ledlenser_private.ai_history_runs AS
SELECT r.id, r.run_kind, r.run_state, r.collector_version, r.prompt_set_hash, r.expected_calls,
  c.attempted AS attempted_calls, c.answered AS answered_calls, c.errors AS error_calls,
  r.is_published, r.published_at, r.started_at, r.completed_at
FROM ledlenser.audit_runs r
JOIN LATERAL (
  SELECT count(*)::integer AS attempted,
    (count(*) FILTER (WHERE s.call_status = 'answered'))::integer AS answered,
    (count(*) FILTER (WHERE s.call_status = 'error'))::integer AS errors
  FROM ledlenser.ai_simulations s WHERE s.audit_run_id = r.id
) c ON true
WHERE r.run_kind = 'ai_simulation'
  AND r.is_published
  AND r.run_state IN ('completed', 'partial')
  AND r.prompt_set_hash IS NOT NULL
  AND r.expected_calls IS NOT NULL
  AND r.attempted_calls = r.expected_calls
  AND r.published_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ledlenser.ai_simulations s
    WHERE s.audit_run_id = r.id
      AND (s.record_origin = 'historical_backfill' OR s.material_hallucination = 'historical_unverified'));

CREATE VIEW ledlenser_private.ai_history_calls AS
SELECT s.id, s.audit_run_id, s.sim_id, s.category, s.prompt_key, s.prompt_text, s.prompt_kind, s.engine, s.model,
  s.repeat_no, s.attempt_no, s.call_status,
  s.outcome,
  s.primary_brand, s.winner, s.material_hallucination, s.hallucination_evidence,
  NULLIF(s.root_cause, '') AS root_cause, rem.remediation_text, s.error_message, s.answer_text, s.citation_urls,
  s.created_at, r.run_state, r.published_at,
  s.probe_asin, s.probe_asins, s.probe_brand_sku, s.probe_category, s.probe_series,
  s.probe_spec_field, s.probe_expected_value, s.probe_source_url, s.probe_amazon_value, s.probe_is_anchor
FROM ledlenser.ai_simulations s
JOIN ledlenser_private.ai_history_runs r ON r.id = s.audit_run_id
LEFT JOIN ledlenser.ai_remediations rem ON rem.simulation_id = s.id
WHERE s.record_origin IS DISTINCT FROM 'historical_backfill'
  AND s.material_hallucination IS DISTINCT FROM 'historical_unverified';

CREATE VIEW ledlenser_private.div_latest AS
SELECT DISTINCT ON (division) id, audit_run_id, division, monitored_skus, buybox_pct, splinter_bundles,
  schema_sync_pct, primary_threat, strategic_action, created_at, updated_at
FROM ledlenser.division_metrics
WHERE audit_run_id = (SELECT d.audit_run_id FROM ledlenser.division_metrics d ORDER BY d.created_at DESC LIMIT 1)
ORDER BY division, created_at DESC;

CREATE VIEW ledlenser_private.spec_latest AS
SELECT DISTINCT ON (s.asin) s.id, s.asin, s.title, s.category, s.amazon_fields_found, s.amazon_fields_expected,
  s.amazon_completeness_pct, s.amazon_missing_fields, s.amazon_checked,
  s.brand_site_url,
  s.brand_site_found,
  s.brand_site_fields_found,
  s.brand_site_fields_expected,
  s.brand_site_completeness_pct,
  s.brand_site_missing_fields,
  s.checked_at, s.batch_run_id, s.created_at, s.collector_version,
  s.brand_site_page_source,
  s.brand_site_identity_match,
  s.brand_site_variant_sku,
  s.brand_site_spec_values,
  s.brand_site_rating_markup,
  s.amazon_spec_values, s.amazon_gtin, s.amazon_mpn, s.amazon_aplus_state, s.amazon_aplus_image_count,
  s.amazon_video_state, s.amazon_bullet_count, s.amazon_image_count
FROM ledlenser.spec_readiness s
JOIN ledlenser.catalog c ON c.asin::text = s.asin::text AND c.buybox_seller IS NOT NULL
ORDER BY s.asin, s.checked_at DESC NULLS LAST;

-- ---------------------------------------------------------------------------------------------------
-- Lost sales (copy of the v2 Fender materialized views; SmartScout is the only sales source)
-- ---------------------------------------------------------------------------------------------------

CREATE MATERIALIZED VIEW ledlenser.mv_listing_sales_loss_v2 AS
WITH pop AS (
  SELECT c.asin, c.title, c.current_price, COALESCE(c.is_bundle, false) AS is_bundle,
    m.featured_offer_state, m.featured_offer_checked_at
  FROM ledlenser.catalog c
  LEFT JOIN ledlenser.retail_buybox_map m ON m.asin = c.asin
  WHERE COALESCE(c.current_price, 0) > 0 OR m.asin IS NOT NULL
), ss AS (
  SELECT DISTINCT ON (asin) asin, snapshot_date, est_monthly_units, est_monthly_revenue, ttm_revenue, prev_12m_revenue
  FROM ledlenser.smartscout_products
  ORDER BY asin, snapshot_date DESC
), k AS (
  SELECT k.* FROM ledlenser.keepa_daily k JOIN pop USING (asin) WHERE k.day > current_date - 365
), d AS (
  SELECT asin,
    min(day) AS history_from,
    max(day) AS history_through,
    max(day) FILTER (WHERE new_price_close IS NOT NULL) AS last_in_stock_day,
    count(*) FILTER (WHERE day > current_date - 30) AS observed_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NOT NULL) AS in_stock_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NULL) AS oos_days_30,
    count(*) FILTER (WHERE day > current_date - 30 AND new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_30,
    count(*) FILTER (WHERE day > current_date - 90) AS observed_days_90,
    count(*) FILTER (WHERE day > current_date - 90 AND new_price_close IS NULL) AS oos_days_90,
    count(*) FILTER (WHERE day > current_date - 90 AND new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_90,
    count(*) AS observed_days_365,
    count(*) FILTER (WHERE new_price_close IS NOT NULL) AS in_stock_days_365,
    count(*) FILTER (WHERE new_price_close IS NULL) AS oos_days_365,
    count(*) FILTER (WHERE new_price_close IS NOT NULL AND buybox_price_close IS NULL) AS no_buy_box_days_365
  FROM k GROUP BY asin
), cur AS (
  SELECT d.asin,
    (d.last_in_stock_day IS NULL OR d.last_in_stock_day < d.history_through) AS offline_now,
    count(k.day) FILTER (WHERE k.new_price_close IS NULL) AS current_oos_days,
    sum(k.sales_rank_drops) AS current_stretch_rank_drops
  FROM d
  LEFT JOIN k ON k.asin = d.asin AND k.day > COALESCE(d.last_in_stock_day, d.history_from - 1)
  GROUP BY d.asin, d.last_in_stock_day, d.history_through
), b AS (
  SELECT pop.*, ss.snapshot_date, ss.est_monthly_units, ss.est_monthly_revenue, ss.ttm_revenue, ss.prev_12m_revenue,
    d.history_from, d.history_through, d.last_in_stock_day,
    d.observed_days_30, d.in_stock_days_30, d.oos_days_30, d.no_buy_box_days_30,
    d.observed_days_90, d.oos_days_90, d.no_buy_box_days_90,
    d.observed_days_365, d.in_stock_days_365, d.oos_days_365, d.no_buy_box_days_365,
    cur.offline_now, cur.current_oos_days, cur.current_stretch_rank_drops,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN 'smartscout_ttm'
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN 'smartscout_30d'
    END AS baseline_method,
    CASE
      WHEN ss.ttm_revenue > 0 AND d.in_stock_days_365 >= 30 THEN ss.ttm_revenue / d.in_stock_days_365
      WHEN ss.est_monthly_revenue > 0 AND d.in_stock_days_30 >= 7 THEN ss.est_monthly_revenue / d.in_stock_days_30
    END AS baseline_daily_revenue
  FROM pop
  LEFT JOIN ss USING (asin)
  LEFT JOIN d USING (asin)
  LEFT JOIN cur USING (asin)
)
SELECT b.asin, b.title, b.is_bundle, b.current_price, b.featured_offer_state, b.featured_offer_checked_at,
  b.history_from, b.history_through, b.last_in_stock_day, b.offline_now, b.current_oos_days,
  b.observed_days_30, b.in_stock_days_30, b.oos_days_30, b.no_buy_box_days_30,
  b.observed_days_90, b.oos_days_90, b.no_buy_box_days_90,
  b.observed_days_365, b.in_stock_days_365, b.oos_days_365, b.no_buy_box_days_365,
  b.current_stretch_rank_drops,
  ks.sales_rank_current, ks.sales_rank_drops_30, ks.sales_rank_drops_90,
  b.snapshot_date AS smartscout_snapshot_date,
  b.est_monthly_units AS smartscout_monthly_units,
  b.est_monthly_revenue AS smartscout_monthly_revenue,
  b.ttm_revenue AS smartscout_ttm_revenue,
  b.prev_12m_revenue AS smartscout_prev_12m_revenue,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'smartscout' END AS revenue_source,
  b.baseline_method,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'USD' END AS currency,
  CASE b.baseline_method
    WHEN 'smartscout_ttm' THEN (b.snapshot_date - interval '12 months')::date
    WHEN 'smartscout_30d' THEN b.snapshot_date - 30
  END AS revenue_window_start,
  CASE WHEN b.baseline_method IS NOT NULL THEN b.snapshot_date END AS revenue_window_end,
  CASE b.baseline_method
    WHEN 'smartscout_ttm' THEN b.in_stock_days_365
    WHEN 'smartscout_30d' THEN b.in_stock_days_30
  END AS in_stock_days_used,
  round(b.baseline_daily_revenue, 2) AS baseline_daily_revenue,
  round(b.baseline_daily_revenue * b.oos_days_30, 2) AS est_lost_revenue_oos_30,
  round(b.baseline_daily_revenue * b.oos_days_90, 2) AS est_lost_revenue_oos_90,
  round(b.baseline_daily_revenue * b.oos_days_365, 2) AS est_lost_revenue_oos_365,
  CASE WHEN b.baseline_method IS NOT NULL THEN 'Analyst estimate' END AS estimate_label,
  CASE
    WHEN b.baseline_method IS NOT NULL THEN NULL
    WHEN b.history_through IS NULL THEN 'no_keepa_history'
    WHEN b.snapshot_date IS NULL THEN 'no_sales_source'
    WHEN COALESCE(b.ttm_revenue, 0) <= 0 AND COALESCE(b.est_monthly_revenue, 0) <= 0 THEN 'smartscout_reports_no_sales'
    ELSE 'too_few_in_stock_days'
  END AS awaiting_inputs_reason
FROM b
LEFT JOIN ledlenser.keepa_stats ks USING (asin);

CREATE UNIQUE INDEX mv_listing_sales_loss_v2_asin_idx ON ledlenser.mv_listing_sales_loss_v2 (asin);

CREATE MATERIALIZED VIEW ledlenser.mv_listing_offer_state_v2 AS
WITH pop AS (
  SELECT c.asin
  FROM ledlenser.catalog c
  LEFT JOIN ledlenser.retail_buybox_map m ON m.asin = c.asin
  WHERE COALESCE(c.current_price, 0) > 0 OR m.asin IS NOT NULL
), days AS (
  SELECT k.asin, k.day, k.sales_rank_drops,
    CASE
      WHEN k.new_price_close IS NULL THEN 'out_of_stock'
      WHEN k.buybox_price_close IS NULL THEN 'no_buy_box'
      ELSE 'in_stock'
    END AS state
  FROM ledlenser.keepa_daily k
  JOIN pop USING (asin)
  WHERE k.day > current_date - 365
), latest AS (
  SELECT asin, max(day) AS history_through FROM days GROUP BY asin
), grouped AS (
  SELECT asin, day, state, sales_rank_drops,
    day - (row_number() OVER (PARTITION BY asin, state ORDER BY day))::int AS grp
  FROM days
)
SELECT g.asin, g.state, min(g.day) AS start_day, max(g.day) AS end_day, count(*)::int AS days,
  max(g.day) = l.history_through AS ongoing,
  sum(g.sales_rank_drops)::int AS rank_drops_activity,
  'Keepa (Amazon.com)'::text AS source
FROM grouped g
JOIN latest l USING (asin)
WHERE g.state <> 'in_stock'
GROUP BY g.asin, g.state, g.grp, l.history_through;

CREATE UNIQUE INDEX mv_listing_offer_state_v2_key_idx ON ledlenser.mv_listing_offer_state_v2 (asin, state, start_day);

-- ---------------------------------------------------------------------------------------------------
-- Canvas views (same logic as public.canvas_* for Fender, generic names; see the header)
-- ---------------------------------------------------------------------------------------------------

CREATE VIEW ledlenser.canvas_client_config WITH (security_invoker = false) AS
SELECT client_key, display_name, seller_type, brand_site_domains, brand_name_terms, amazon_brand_names,
  brand_seller_ids, competitor_brands, updated_at
FROM ledlenser.client_config;

CREATE VIEW ledlenser.canvas_ai_current_run WITH (security_invoker = false) AS
SELECT id AS audit_run_id, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls,
  answered_calls, error_calls, started_at, completed_at, published_at,
  (expected_calls - answered_calls) AS missing_calls
FROM ledlenser_private.ai_current_run;

CREATE VIEW ledlenser.canvas_ai_simulations WITH (security_invoker = false) AS
SELECT id, audit_run_id, 'current_run'::text AS source_table, sim_id, engine, repeat_no, category,
  prompt_text AS prompt, winner, (outcome IN ('brand_win', 'competitor_win')) AS is_resolved,
  (material_hallucination = 'confirmed') AS hallucination_flag, root_cause, remediation_text AS remediation_patch,
  answer_text, citation_urls, created_at, prompt_key, prompt_kind, model, call_status, outcome, primary_brand,
  material_hallucination, hallucination_evidence, attempt_no, error_message, run_state, published_at
FROM ledlenser_private.ai_current_calls;

CREATE VIEW ledlenser.canvas_ai_citations WITH (security_invoker = false) AS
SELECT ci.audit_run_id, ci.sim_id, ci.simulation_id, s.prompt_key, s.prompt_kind, s.category, ci.engine,
  ci.position, ci.url, ci.domain, ci.title
FROM ledlenser.ai_citations ci
JOIN ledlenser_private.ai_current_calls s ON s.id = ci.simulation_id;

CREATE VIEW ledlenser.canvas_ai_probes WITH (security_invoker = false) AS
SELECT c.audit_run_id, c.sim_id, c.prompt_key, c.prompt_text AS prompt, c.engine, c.model, c.call_status,
  c.material_hallucination, c.hallucination_evidence, c.root_cause, c.remediation_text,
  COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
  COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
  f.verified_at, c.answer_text, c.created_at, c.probe_asin, c.probe_asins, c.probe_brand_sku, c.probe_category,
  c.probe_series, c.probe_spec_field, c.probe_expected_value, c.probe_source_url, c.probe_amazon_value, c.probe_is_anchor
FROM ledlenser_private.ai_current_calls c
LEFT JOIN ledlenser.ai_probe_facts f ON f.prompt_key = c.prompt_key
WHERE c.prompt_kind = 'probe';

CREATE VIEW ledlenser.canvas_ai_engine WITH (security_invoker = false) AS
SELECT COALESCE(engine, 'unknown'::varchar) AS engine,
  count(*) FILTER (WHERE prompt_kind = 'commercial') AS total_sims,
  count(*) FILTER (WHERE prompt_kind = 'commercial' AND outcome IN ('brand_win', 'competitor_win')) AS resolved,
  count(*) FILTER (WHERE prompt_kind = 'commercial' AND outcome = 'brand_win' AND material_hallucination IS DISTINCT FROM 'confirmed') AS brand_wins,
  round(100.0 * (count(*) FILTER (WHERE prompt_kind = 'commercial' AND outcome = 'brand_win' AND material_hallucination IS DISTINCT FROM 'confirmed'))::numeric
    / NULLIF(count(*) FILTER (WHERE prompt_kind = 'commercial' AND outcome IN ('brand_win', 'competitor_win')), 0)::numeric, 1) AS brand_win_pct,
  count(*) FILTER (WHERE material_hallucination = 'confirmed') AS hallucinations
FROM ledlenser_private.ai_current_calls
GROUP BY COALESCE(engine, 'unknown'::varchar);

CREATE VIEW ledlenser.canvas_ai_category WITH (security_invoker = false) AS
WITH s AS (
  SELECT * FROM ledlenser_private.ai_current_calls WHERE prompt_kind = 'commercial'
), r AS (
  SELECT * FROM s WHERE outcome IN ('brand_win', 'competitor_win')
), c AS (
  SELECT r.category, count(*) AS resolved,
    count(*) FILTER (WHERE r.outcome = 'brand_win' AND r.material_hallucination IS DISTINCT FROM 'confirmed') AS brand_wins
  FROM r GROUP BY r.category
), comp AS (
  SELECT DISTINCT ON (r.category) r.category, r.primary_brand::varchar(100) AS top_competitor, count(*) AS top_competitor_wins
  FROM r WHERE r.outcome = 'competitor_win'
  GROUP BY r.category, r.primary_brand
  ORDER BY r.category, count(*) DESC, r.primary_brand
), a AS (
  SELECT s.category, count(*) AS total_sims,
    count(*) FILTER (WHERE s.outcome = 'unresolved') AS unclear,
    count(*) FILTER (WHERE s.outcome = 'error') AS errors,
    count(*) FILTER (WHERE s.material_hallucination = 'confirmed') AS hallucinations
  FROM s GROUP BY s.category
)
SELECT a.category, a.total_sims,
  COALESCE(c.resolved, 0::bigint) AS resolved,
  COALESCE(c.brand_wins, 0::bigint) AS brand_wins,
  round(100.0 * c.brand_wins::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS brand_win_pct,
  comp.top_competitor,
  COALESCE(comp.top_competitor_wins, 0::bigint) AS top_competitor_wins,
  round(100.0 * comp.top_competitor_wins::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS top_competitor_pct,
  round(100.0 * (COALESCE(c.brand_wins, 0::bigint) - COALESCE(comp.top_competitor_wins, 0::bigint))::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS sov_gap_pts,
  a.unclear, a.errors, a.hallucinations
FROM a
LEFT JOIN c USING (category)
LEFT JOIN comp USING (category);

-- Fender labels its own wins 'Fender/Squier'; Ledlenser uses its display name.
CREATE VIEW ledlenser.canvas_competitor_sov WITH (security_invoker = false) AS
WITH r AS (
  SELECT category,
    (CASE WHEN outcome = 'brand_win' THEN (SELECT display_name FROM ledlenser.client_config LIMIT 1)
          ELSE primary_brand END)::varchar(100) AS winner
  FROM ledlenser_private.ai_current_calls
  WHERE prompt_kind = 'commercial' AND outcome IN ('brand_win', 'competitor_win')
), g AS (
  SELECT COALESCE(r.category, 'all'::varchar) AS category, r.winner AS competitor, count(*) AS wins
  FROM r GROUP BY GROUPING SETS ((r.category, r.winner), (r.winner))
), t AS (
  SELECT COALESCE(r.category, 'all'::varchar) AS category, count(*) AS resolved
  FROM r GROUP BY GROUPING SETS ((r.category), ())
)
SELECT g.category, g.competitor, g.wins, t.resolved AS category_resolved,
  round(100.0 * g.wins::numeric / NULLIF(t.resolved, 0)::numeric, 1) AS sov_pct
FROM g JOIN t USING (category);

CREATE VIEW ledlenser.canvas_ai_run_history WITH (security_invoker = false) AS
SELECT id AS audit_run_id, run_kind, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls,
  answered_calls, error_calls, is_published, published_at, started_at, completed_at
FROM ledlenser.audit_runs
WHERE run_kind = 'ai_simulation';

CREATE VIEW ledlenser.canvas_ai_history_runs WITH (security_invoker = false) AS
SELECT id AS audit_run_id, run_kind, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls,
  answered_calls, error_calls, is_published, published_at, started_at, completed_at,
  (expected_calls - answered_calls) AS missing_calls
FROM ledlenser_private.ai_history_runs;

CREATE VIEW ledlenser.canvas_ai_history_calls WITH (security_invoker = false) AS
SELECT id, audit_run_id, 'history_run'::text AS source_table, sim_id, engine, repeat_no, category,
  prompt_text AS prompt, winner, (outcome IN ('brand_win', 'competitor_win')) AS is_resolved,
  (material_hallucination = 'confirmed') AS hallucination_flag, root_cause, remediation_text AS remediation_patch,
  answer_text, citation_urls, created_at, prompt_key, prompt_kind, model, call_status, outcome, primary_brand,
  material_hallucination, hallucination_evidence, attempt_no, error_message, run_state, published_at
FROM ledlenser_private.ai_history_calls;

CREATE VIEW ledlenser.canvas_ai_history_citations WITH (security_invoker = false) AS
SELECT ci.audit_run_id, ci.sim_id, ci.simulation_id, s.prompt_key, s.prompt_kind, s.category, ci.engine,
  ci.position, ci.url, ci.domain, ci.title
FROM ledlenser.ai_citations ci
JOIN ledlenser_private.ai_history_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

CREATE VIEW ledlenser.canvas_ai_history_citations_by_run WITH (security_invoker = false) AS
SELECT * FROM ledlenser.canvas_ai_history_citations;

CREATE VIEW ledlenser.canvas_ai_history_outcome_counts WITH (security_invoker = false) AS
SELECT audit_run_id, engine, prompt_kind, prompt_key, prompt AS prompt_text, category, call_status, outcome,
  material_hallucination, primary_brand, count(*) AS calls
FROM ledlenser.canvas_ai_history_calls
GROUP BY audit_run_id, engine, prompt_kind, prompt_key, prompt, category, call_status, outcome, material_hallucination, primary_brand;

CREATE VIEW ledlenser.canvas_ai_history_probes WITH (security_invoker = false) AS
SELECT c.audit_run_id, c.sim_id, c.prompt_key, c.prompt_text AS prompt, c.engine, c.model, c.call_status,
  c.material_hallucination, c.hallucination_evidence, c.root_cause, c.remediation_text,
  COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
  COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
  f.verified_at, c.answer_text, c.created_at, c.probe_asin, c.probe_asins, c.probe_brand_sku, c.probe_category,
  c.probe_series, c.probe_spec_field, c.probe_expected_value, c.probe_source_url, c.probe_amazon_value, c.probe_is_anchor
FROM ledlenser_private.ai_history_calls c
LEFT JOIN ledlenser.ai_probe_facts f ON f.prompt_key = c.prompt_key
WHERE c.prompt_kind = 'probe';

-- models_in_scope falls back to the complete rows on the brand's product sheet (Fender uses 180).
CREATE VIEW ledlenser.canvas_ai_probe_coverage WITH (security_invoker = false) AS
SELECT s.audit_run_id,
  ((r.metadata -> 'probe_rotation') ->> 'cycle_no')::integer AS cycle_no,
  COALESCE(s.probe_category, s.category::text) AS category,
  s.engine::text AS engine,
  COALESCE(((r.metadata -> 'probe_rotation') ->> 'in_scope_models')::integer,
    (SELECT count(*)::integer FROM ledlenser.brand_catalog WHERE sheet_status = 'Complete')) AS models_in_scope,
  count(DISTINCT COALESCE(s.probe_source_url, s.probe_brand_sku, s.prompt_key)) AS models_checked,
  count(DISTINCT COALESCE(a.asin, s.probe_asin, s.prompt_key)) AS asins_covered,
  count(DISTINCT s.id) FILTER (WHERE s.material_hallucination = 'confirmed') AS wrong_answers
FROM ledlenser.ai_simulations s
JOIN ledlenser.audit_runs r ON r.id = s.audit_run_id
LEFT JOIN LATERAL unnest(s.probe_asins) a(asin) ON true
WHERE s.prompt_kind = 'probe'
GROUP BY s.audit_run_id, ((r.metadata -> 'probe_rotation') ->> 'cycle_no')::integer,
  COALESCE(s.probe_category, s.category::text), s.engine::text,
  COALESCE(((r.metadata -> 'probe_rotation') ->> 'in_scope_models')::integer,
    (SELECT count(*)::integer FROM ledlenser.brand_catalog WHERE sheet_status = 'Complete'));

CREATE VIEW ledlenser.canvas_divisions WITH (security_invoker = false) AS
SELECT division, monitored_skus, buybox_pct, splinter_bundles, schema_sync_pct, primary_threat, strategic_action, created_at
FROM ledlenser_private.div_latest;

CREATE VIEW ledlenser.canvas_freshness WITH (security_invoker = false) AS
SELECT job_key, last_run_at, cursor_offset, updated_at FROM ledlenser.job_state
UNION ALL
SELECT 'kpi_recompute'::varchar, max(created_at), NULL::integer, max(created_at) FROM ledlenser.brand_kpi_summary
UNION ALL
SELECT 'ai_simulations'::varchar, c.completed_at, NULL::integer, c.published_at FROM ledlenser_private.ai_current_run c;

CREATE VIEW ledlenser.canvas_listing_channel_price WITH (security_invoker = false) AS
SELECT asin, channel, price, url, checked_at FROM ledlenser.listing_channel_price;

CREATE VIEW ledlenser.canvas_listing_content WITH (security_invoker = false) AS
SELECT l.asin, c.title, l.bullet_count, l.image_count, l.main_image_px,
  COALESCE(s.amazon_aplus_state, l.aplus_state, 'not_collected') AS aplus_state,
  l.aplus_module_count,
  COALESCE(s.amazon_video_state, l.video_state, 'not_collected') AS video_state,
  l.video_count, l.content_checked_at, l.checked_at,
  CASE WHEN s.amazon_aplus_state IS NOT NULL THEN 'live_page' WHEN l.aplus_state IS NOT NULL THEN 'keepa' END AS aplus_source,
  CASE WHEN s.amazon_video_state IS NOT NULL THEN 'live_page' WHEN l.video_state IS NOT NULL THEN 'keepa' END AS video_source
FROM ledlenser.listing_content l
JOIN ledlenser.catalog c USING (asin)
LEFT JOIN ledlenser_private.spec_latest s USING (asin)
WHERE COALESCE(c.current_price, 0) > 0;

CREATE VIEW ledlenser.canvas_listing_sales_loss_v2 WITH (security_invoker = false) AS
SELECT * FROM ledlenser.mv_listing_sales_loss_v2;

CREATE VIEW ledlenser.canvas_listing_offer_state_v2 WITH (security_invoker = false) AS
SELECT * FROM ledlenser.mv_listing_offer_state_v2;

-- No Musician's Friend (mf_*) columns: Ledlenser has no such channel.
CREATE VIEW ledlenser.canvas_retail_listings WITH (security_invoker = false) AS
SELECT b.asin, b.model_name, c.title, c.category, c.is_bundle, c.parent_asin, c.product_url, b.map_price,
  b.offer_price, b.leakage_amount AS amz_leakage, b.buybox_status, b.buybox_winner,
  c.buybox_seller AS buybox_seller_id, sl.seller_name AS buybox_seller_name, c.buybox_is_fba, c.offer_count_new,
  c.sales_rank, c.monthly_sold, b.reviews_count, b.channels, b.bundle_name,
  b.wmt_price, b.wmt_leakage, b.wmt_url, b.wmt_seller, b.wmt_match_conf, b.wmt_checked_at,
  LEAST(b.leakage_amount, b.wmt_leakage) AS worst_leakage,
  (COALESCE(b.leakage_amount, 0) < 0 OR COALESCE(b.wmt_leakage, 0) < 0) AS is_map_violation,
  b.updated_at, b.competitive_price_threshold_cents, b.featured_offer_withheld,
  (b.featured_offer_state = 'withheld' AND b.competitive_external_price_state = 'present'
    AND b.competitive_price_threshold_cents IS NOT NULL AND b.competitive_price_threshold_cents > 0
    AND b.featured_offer_observed_price_cents IS NOT NULL AND b.featured_offer_observed_price_cents > 0
    AND b.featured_offer_source = 'keepa' AND b.featured_offer_checked_at IS NOT NULL
    AND (b.featured_offer_observed_price_cents + COALESCE(b.featured_offer_observed_shipping_cents, 0)) > b.competitive_price_threshold_cents) AS competitive_offer_suppressed,
  b.featured_offer_state, b.featured_offer_source, b.featured_offer_checked_at, b.featured_offer_attempted_at,
  b.featured_offer_last_error, b.competitive_external_price_state, b.featured_offer_observed_price_cents,
  b.featured_offer_observed_shipping_cents, b.featured_offer_observed_seller
FROM ledlenser.retail_buybox_map b
LEFT JOIN ledlenser.catalog c ON c.asin::text = b.asin::text
LEFT JOIN ledlenser.sellers sl ON sl.seller_id::text = c.buybox_seller::text;

CREATE VIEW ledlenser.canvas_spec_missing_fields WITH (security_invoker = false) AS
SELECT 'amazon'::text AS source, f.f AS field, count(*) AS sku_count
FROM ledlenser_private.spec_latest, LATERAL unnest(string_to_array(NULLIF(spec_latest.amazon_missing_fields, ''), ';')) f(f)
WHERE f.f <> ''
GROUP BY f.f
UNION ALL
SELECT 'brand_site'::text AS source, f.f AS field, count(*) AS sku_count
FROM ledlenser_private.spec_latest, LATERAL unnest(string_to_array(NULLIF(spec_latest.brand_site_missing_fields, ''), ';')) f(f)
WHERE spec_latest.brand_site_found AND f.f <> ''
GROUP BY f.f;

CREATE VIEW ledlenser.canvas_spec_readiness WITH (security_invoker = false) AS
SELECT asin, title, category, amazon_checked, amazon_fields_found, amazon_fields_expected, amazon_completeness_pct,
  amazon_missing_fields, brand_site_url, brand_site_found, brand_site_fields_found, brand_site_fields_expected,
  brand_site_completeness_pct, brand_site_missing_fields, checked_at, collector_version, brand_site_page_source,
  brand_site_identity_match, brand_site_variant_sku, brand_site_spec_values, brand_site_rating_markup, amazon_spec_values,
  amazon_gtin, amazon_mpn, amazon_aplus_state, amazon_aplus_image_count, amazon_video_state,
  amazon_bullet_count, amazon_image_count
FROM ledlenser_private.spec_latest;

CREATE VIEW ledlenser.canvas_spec_findability WITH (security_invoker = false) AS
SELECT cat.asin,
  COALESCE(f.title, cat.title) AS title,
  COALESCE(f.category, cat.category::text) AS category,
  COALESCE(f.findability_state::text, 'not_checked') AS latest_state,
  f.attempt_at AS latest_attempt_at,
  f.canonical_url AS latest_canonical_url,
  f.variant_sku AS latest_variant_sku,
  f.last_success_state, f.last_success_url, f.last_success_variant_sku, f.last_success_at,
  f.last_success_explanation, f.last_success_schema_profile,
  f.last_success_fields_present AS last_success_present_fields,
  f.last_success_fields_missing AS last_success_missing_applicable_fields,
  f.product_kind::text AS product_kind,
  f.match_confidence AS confidence,
  f.match_explanation AS explanation,
  f.source_method,
  f.last_error AS latest_failure,
  f.schema_profile,
  f.schema_fields_present AS present_fields,
  f.schema_fields_missing AS missing_applicable_fields,
  f.catalog_identity_hash, f.last_success_identity_hash, f.collector_version, f.http_status,
  (f.last_success_at IS NOT NULL AND (COALESCE(f.findability_state::text, 'not_checked') NOT IN ('exact_official_product', 'official_family_page')
    OR f.catalog_identity_hash IS DISTINCT FROM f.last_success_identity_hash
    OR f.last_success_at < now() - interval '180 days')) AS success_needs_review,
  COALESCE(f.findability_state::text IN ('exact_official_product', 'official_family_page'), false) AS counts_as_confirmed,
  COALESCE(f.findability_state::text IN ('exact_official_product', 'official_family_page', 'ambiguous_candidate', 'completed_not_found'), false) AS counts_as_finished_search,
  COALESCE(f.findability_state::text = 'ambiguous_candidate', false) AS counts_as_ambiguous,
  COALESCE(f.findability_state::text = 'blocked', false) AS counts_as_blocked,
  COALESCE(f.findability_state::text = 'timeout', false) AS counts_as_timeout,
  COALESCE(f.findability_state::text = 'parse_failure', false) AS counts_as_parse_failure,
  (f.asin IS NULL OR f.findability_state::text = 'not_checked') AS counts_as_unchecked,
  (f.last_success_url IS NOT NULL AND f.findability_state::text IN ('blocked', 'timeout', 'parse_failure')) AS prior_success_latest_failed,
  (f.last_success_url IS NOT NULL AND f.findability_state::text = 'completed_not_found') AS prior_success_latest_completed_not_found,
  (f.last_success_url IS NOT NULL AND f.findability_state::text = 'ambiguous_candidate') AS prior_success_latest_ambiguous,
  f.jsonld_status,
  true AS counts_as_eligible,
  (f.asin IS NOT NULL) AS counts_as_attempted,
  COALESCE(f.findability_state::text = 'completed_not_found', false) AS counts_as_completed_not_found,
  COALESCE(f.findability_state::text = 'unsupported_product_type', false) AS counts_as_unsupported
FROM ledlenser.catalog cat
LEFT JOIN ledlenser.spec_findability_current f ON f.asin::text = cat.asin::text
WHERE cat.buybox_seller IS NOT NULL;

-- Same columns as public.canvas_metrics (renamed per the header, no mf_*), plus bb_brand / bb_brand_pct for the brand-led question
-- ("what share of Buy Boxes does the brand's own seller hold?"). sim_* counts use outcomes, since
-- Ledlenser has no legacy winner labels or run-1 archive.
CREATE VIEW ledlenser.canvas_metrics WITH (security_invoker = false) AS
WITH kr AS (
  SELECT audit_run_id, created_at FROM ledlenser.brand_kpi_summary
  WHERE metric_id IS NOT NULL ORDER BY created_at DESC LIMIT 1
), kpi AS (
  SELECT jsonb_object_agg(metric_id, metric_value) AS j FROM ledlenser.brand_kpi_summary
  WHERE audit_run_id = (SELECT kr.audit_run_id FROM kr)
), cat AS (
  SELECT count(*) AS catalog_skus,
    count(*) FILTER (WHERE buybox_checked_at IS NOT NULL) AS seller_harvested,
    count(*) FILTER (WHERE is_bundle) AS catalog_bundles
  FROM ledlenser.catalog
), bb AS (
  SELECT count(*) AS bb_total,
    count(*) FILTER (WHERE buybox_status::text = 'Brand Seller') AS bb_brand,
    count(*) FILTER (WHERE buybox_status::text = 'Amazon 1P') AS bb_1p,
    count(*) FILTER (WHERE buybox_status::text = '3P Confirmed') AS bb_3p,
    count(*) FILTER (WHERE buybox_status::text = 'Unknown/Not Harvested') AS bb_unharvested,
    count(*) FILTER (WHERE buybox_status::text = 'No Active Offer') AS bb_no_offer,
    count(*) FILTER (WHERE leakage_amount < 0) AS amz_below_map,
    round(avg(leakage_amount) FILTER (WHERE leakage_amount < 0), 2) AS amz_avg_drift,
    count(*) FILTER (WHERE wmt_checked_at IS NOT NULL) AS wmt_checked,
    count(*) FILTER (WHERE wmt_price IS NOT NULL) AS wmt_priced,
    count(*) FILTER (WHERE wmt_leakage < 0) AS wmt_leaks,
    round(avg(wmt_leakage) FILTER (WHERE wmt_leakage < 0), 2) AS offamz_avg_leak,
    count(*) FILTER (WHERE COALESCE(leakage_amount, 0) < 0 OR COALESCE(wmt_leakage, 0) < 0) AS map_violation_skus,
    NULLIF(sum(reviews_count), 0) AS bundle_reviews
  FROM ledlenser.retail_buybox_map
), sp AS (
  SELECT count(*) AS spec_checked,
    round(avg(amazon_completeness_pct)::numeric, 1) AS spec_avg_amazon_pct,
    count(*) FILTER (WHERE brand_site_found) AS spec_brand_site_found,
    round(100.0 * (count(*) FILTER (WHERE brand_site_found))::numeric / NULLIF(count(*), 0)::numeric, 1) AS spec_brand_site_found_pct,
    round((avg(brand_site_completeness_pct) FILTER (WHERE brand_site_found))::numeric, 1) AS spec_avg_brand_site_pct,
    count(*) FILTER (WHERE brand_site_found AND brand_site_missing_fields ILIKE '%additionalProperty%') AS spec_missing_additional_property
  FROM ledlenser_private.spec_latest
), mfx AS (
  SELECT count(DISTINCT field) AS spec_missing_field_types FROM ledlenser.canvas_spec_missing_fields WHERE source = 'amazon'
), ai AS (
  SELECT count(*) AS sim_total,
    count(DISTINCT audit_run_id) AS sim_runs,
    count(*) FILTER (WHERE outcome IN ('brand_win', 'competitor_win')) AS sim_resolved,
    count(*) FILTER (WHERE outcome = 'brand_win') AS sim_wins,
    count(*) FILTER (WHERE outcome = 'unresolved') AS sim_unclear,
    count(*) FILTER (WHERE outcome = 'error' OR call_status = 'error') AS sim_errors,
    count(*) FILTER (WHERE material_hallucination = 'confirmed') AS sim_hallucinations,
    count(*) FILTER (WHERE category::text = 'hallucinations') AS sim_hallucination_risk,
    max(created_at) AS sim_last_at
  FROM ledlenser.ai_simulations
), wk AS (
  SELECT category, brand_win_pct, resolved, top_competitor, top_competitor_pct, sov_gap_pts
  FROM ledlenser.canvas_ai_category WHERE resolved >= 10 ORDER BY brand_win_pct LIMIT 1
), st AS (
  SELECT category, brand_win_pct, resolved, brand_wins
  FROM ledlenser.canvas_ai_category WHERE resolved >= 10 ORDER BY brand_win_pct DESC, resolved DESC LIMIT 1
), dv AS (
  SELECT count(DISTINCT division) AS division_count FROM ledlenser_private.div_latest
)
SELECT (SELECT kr.audit_run_id FROM kr) AS kpi_audit_run_id,
  (SELECT kr.created_at FROM kr) AS kpi_computed_at,
  (SELECT kpi.j FROM kpi) AS kpi,
  cat.catalog_skus, cat.catalog_bundles, cat.seller_harvested,
  round(100.0 * cat.seller_harvested::numeric / NULLIF(cat.catalog_skus, 0)::numeric, 1) AS seller_harvested_pct,
  dv.division_count,
  bb.bb_total, bb.bb_1p, bb.bb_3p, bb.bb_unharvested, bb.bb_no_offer,
  round(100.0 * bb.bb_1p::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_1p_pct,
  round(100.0 * bb.bb_3p::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_3p_pct,
  round(100.0 * bb.bb_unharvested::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_unharvested_pct,
  round(100.0 * bb.bb_total::numeric / NULLIF(cat.catalog_skus, 0)::numeric, 1) AS active_offer_coverage_pct,
  bb.amz_below_map, bb.amz_avg_drift, bb.wmt_checked, bb.wmt_priced, bb.wmt_leaks,
  bb.offamz_avg_leak, bb.map_violation_skus, bb.bundle_reviews,
  sp.spec_checked, sp.spec_avg_amazon_pct, sp.spec_brand_site_found, sp.spec_brand_site_found_pct, sp.spec_avg_brand_site_pct,
  sp.spec_missing_additional_property, mfx.spec_missing_field_types,
  ai.sim_total, ai.sim_runs, ai.sim_resolved, ai.sim_wins,
  round(100.0 * ai.sim_wins::numeric / NULLIF(ai.sim_resolved, 0)::numeric, 1) AS sim_win_pct,
  ai.sim_unclear, ai.sim_errors, ai.sim_hallucinations, ai.sim_hallucination_risk, ai.sim_last_at,
  wk.category AS weakest_category, wk.brand_win_pct AS weakest_win_pct, wk.top_competitor AS weakest_top_competitor,
  wk.top_competitor_pct AS weakest_competitor_pct, wk.sov_gap_pts AS weakest_sov_gap_pts,
  st.category AS strongest_category, st.brand_win_pct AS strongest_win_pct, st.brand_wins AS strongest_wins,
  st.resolved AS strongest_resolved,
  now() AS served_at,
  bb.bb_brand,
  round(100.0 * bb.bb_brand::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_brand_pct
FROM cat, bb, sp, mfx, ai, (dv LEFT JOIN wk ON true) LEFT JOIN st ON true;

-- ---------------------------------------------------------------------------------------------------
-- Access: tables and helpers closed to the API roles; Toolbelt writes with service_role; anon and
-- authenticated read only the canvas_* views (public read accepted until login ships, 2026-11-04).
-- ---------------------------------------------------------------------------------------------------

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'ledlenser' AND c.relkind = 'r' LOOP
    EXECUTE format('ALTER TABLE ledlenser.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA ledlenser FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA ledlenser_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ledlenser FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA ledlenser TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA ledlenser_private TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA ledlenser TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA ledlenser_private TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ledlenser TO service_role;

DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'ledlenser' AND c.relkind = 'v' AND c.relname LIKE 'canvas\_%' LOOP
    EXECUTE format('GRANT SELECT ON ledlenser.%I TO anon, authenticated', v.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------------
-- Hourly lost-sales refresh, offset from Fender's :17 and :37 jobs
-- ---------------------------------------------------------------------------------------------------

SELECT cron.schedule(
  'ledlenser_refresh_stock_loss_v2',
  '47 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY ledlenser.mv_listing_sales_loss_v2; REFRESH MATERIALIZED VIEW CONCURRENTLY ledlenser.mv_listing_offer_state_v2;$$
);

-- ---------------------------------------------------------------------------------------------------
-- Client identity rows
-- ---------------------------------------------------------------------------------------------------

INSERT INTO command.organizations (name, slug, is_platform_org)
VALUES ('Ledlenser', 'ledlenser', false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO command.organization_memberships (organization_id, user_id, role, status)
SELECT o.id, u.id, 'org_admin'::command.organization_role, 'active'::command.membership_status
FROM command.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'ledlenser'
  AND u.email IN ('brian.w@intofocus.ai', 'marc.s@intofocus.ai')
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO public.set_aside_clients (client_key, label)
VALUES ('ledlenser', 'Ledlenser')
ON CONFLICT (client_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
