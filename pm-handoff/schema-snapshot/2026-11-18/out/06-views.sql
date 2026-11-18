-- canvas_private.ai_api_calls  kind=view  owner=postgres  reloptions={}
create view canvas_private.ai_api_calls as
 SELECT s.id,
    s.audit_run_id,
    s.sim_id,
    s.category,
    s.prompt_key,
    s.prompt_text,
    s.prompt_kind,
    s.engine,
    s.model,
    s.repeat_no,
    s.attempt_no,
    s.call_status,
    s.outcome,
    s.primary_brand,
    s.winner,
    s.material_hallucination,
    s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause,
    rem.remediation_text,
    s.error_message,
    s.answer_text,
    s.citation_urls,
    s.created_at,
    r.run_state,
    r.published_at,
    s.probe_asin,
    s.probe_asins,
    s.probe_fender_sku,
    s.probe_category,
    s.probe_series,
    s.probe_spec_field,
    s.probe_expected_value,
    s.probe_source_url,
    s.probe_amazon_value,
    s.probe_is_anchor
   FROM command.fmic_ai_simulations s
     JOIN canvas_private.ai_api_runs r ON r.id = s.audit_run_id AND r.counted
     LEFT JOIN command.fmic_ai_remediations rem ON rem.simulation_id = s.id
  WHERE (s.engine::text = ANY (ARRAY['openai_api'::character varying, 'gemini_api'::character varying, 'claude_api'::character varying, 'grok_api'::character varying, 'crescent_api'::character varying]::text[])) AND s.record_origin IS DISTINCT FROM 'historical_backfill'::text AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text;

-- canvas_private.ai_api_runs  kind=view  owner=postgres  reloptions={}
create view canvas_private.ai_api_runs as
 WITH api_calls AS (
         SELECT s.audit_run_id,
            s.engine::text AS engine,
            s.call_status,
            s.repeat_no,
            (COALESCE(s.prompt_key, ''::text) || ''::text) || COALESCE(s.prompt_text, ''::text) AS question,
            s.prompt_key,
            s.prompt_text
           FROM command.fmic_ai_simulations s
          WHERE (s.engine::text = ANY (ARRAY['openai_api'::character varying, 'gemini_api'::character varying, 'claude_api'::character varying, 'grok_api'::character varying, 'crescent_api'::character varying]::text[])) AND s.audit_run_id IS NOT NULL AND s.record_origin IS DISTINCT FROM 'historical_backfill'::text AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text
        ), battery_questions AS (
         SELECT DISTINCT b.prompt_key,
            b.prompt_text
           FROM command.fmic_ai_simulations b
             JOIN canvas_private.ai_history_runs h ON h.id = b.audit_run_id
          WHERE b.prompt_key IS NOT NULL
        ), per_run AS (
         SELECT c.audit_run_id,
            count(*)::integer AS attempted,
            count(*) FILTER (WHERE c.call_status = 'answered'::text)::integer AS answered,
            count(*) FILTER (WHERE c.call_status = 'error'::text)::integer AS errors,
            count(DISTINCT c.question)::integer AS questions_asked,
            count(DISTINCT c.question) FILTER (WHERE bq.prompt_key IS NOT NULL)::integer AS questions_matched,
            array_agg(DISTINCT c.engine ORDER BY c.engine) AS engines,
            max(c.repeat_no) AS repeats
           FROM api_calls c
             LEFT JOIN battery_questions bq ON bq.prompt_key = c.prompt_key AND bq.prompt_text = c.prompt_text
          GROUP BY c.audit_run_id
        ), judged AS (
         SELECT r.id,
            r.run_kind,
            r.run_state,
            r.collector_version,
            r.prompt_set_hash,
            r.expected_calls,
            p.attempted AS attempted_calls,
            p.answered AS answered_calls,
            p.errors AS error_calls,
            r.is_published,
            r.published_at,
            r.started_at,
            r.completed_at,
            p.engines,
            p.repeats,
            p.questions_asked,
            p.questions_matched,
            p.questions_asked > 0 AND p.questions_matched = p.questions_asked OR (EXISTS ( SELECT 1
                   FROM canvas_private.ai_history_runs h
                  WHERE r.prompt_set_hash IS NOT NULL AND h.prompt_set_hash = r.prompt_set_hash)) AS question_set_match
           FROM per_run p
             JOIN command.fmic_audit_runs r ON r.id = p.audit_run_id
        )
 SELECT id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at,
    engines,
    repeats,
    questions_asked,
    questions_matched,
    question_set_match,
    (run_state = ANY (ARRAY['completed'::text, 'partial'::text])) AND question_set_match AND answered_calls > 0 AS counted
   FROM judged j;

-- canvas_private.ai_current_calls  kind=view  owner=postgres  reloptions={}
create view canvas_private.ai_current_calls as
 SELECT s.id,
    s.audit_run_id,
    s.sim_id,
    s.category,
    s.prompt_key,
    s.prompt_text,
    s.prompt_kind,
    s.engine,
    s.model,
    s.repeat_no,
    s.attempt_no,
    s.call_status,
    s.outcome,
    s.primary_brand,
    s.winner,
    s.material_hallucination,
    s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause,
    rem.remediation_text,
    s.error_message,
    s.answer_text,
    s.citation_urls,
    s.created_at,
    c.run_state,
    c.published_at,
    s.probe_asin,
    s.probe_asins,
    s.probe_fender_sku,
    s.probe_category,
    s.probe_series,
    s.probe_spec_field,
    s.probe_expected_value,
    s.probe_source_url,
    s.probe_amazon_value,
    s.probe_is_anchor
   FROM command.fmic_ai_simulations s
     JOIN canvas_private.ai_current_run c ON c.id = s.audit_run_id
     LEFT JOIN command.fmic_ai_remediations rem ON rem.simulation_id = s.id;

-- canvas_private.ai_current_run  kind=view  owner=postgres  reloptions={}
create view canvas_private.ai_current_run as
 SELECT id,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    started_at,
    completed_at,
    published_at
   FROM command.fmic_audit_runs r
  WHERE is_published AND run_kind = 'ai_simulation'::text
  ORDER BY published_at DESC, id DESC
 LIMIT 1;

-- canvas_private.ai_history_calls  kind=view  owner=postgres  reloptions={}
create view canvas_private.ai_history_calls as
 SELECT s.id,
    s.audit_run_id,
    s.sim_id,
    s.category,
    s.prompt_key,
    s.prompt_text,
    s.prompt_kind,
    s.engine,
    s.model,
    s.repeat_no,
    s.attempt_no,
    s.call_status,
    s.outcome,
    s.primary_brand,
    s.winner,
    s.material_hallucination,
    s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause,
    rem.remediation_text,
    s.error_message,
    s.answer_text,
    s.citation_urls,
    s.created_at,
    r.run_state,
    r.published_at,
    s.probe_asin,
    s.probe_asins,
    s.probe_fender_sku,
    s.probe_category,
    s.probe_series,
    s.probe_spec_field,
    s.probe_expected_value,
    s.probe_source_url,
    s.probe_amazon_value,
    s.probe_is_anchor
   FROM command.fmic_ai_simulations s
     JOIN canvas_private.ai_history_runs r ON r.id = s.audit_run_id
     LEFT JOIN command.fmic_ai_remediations rem ON rem.simulation_id = s.id
  WHERE (s.audit_run_id = ANY (ARRAY['7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7'::uuid, 'e775ee16-ec5b-45b0-8918-579181b44aff'::uuid])) OR s.record_origin IS DISTINCT FROM 'historical_backfill'::text AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text;

-- canvas_private.ai_history_runs  kind=view  owner=postgres  reloptions={}
create view canvas_private.ai_history_runs as
 SELECT r.id,
    r.run_kind,
    r.run_state,
    r.collector_version,
    r.prompt_set_hash,
    r.expected_calls,
    c.attempted AS attempted_calls,
    c.answered AS answered_calls,
    c.errors AS error_calls,
    r.is_published,
    r.published_at,
    r.started_at,
    r.completed_at
   FROM command.fmic_audit_runs r
     JOIN LATERAL ( SELECT count(*)::integer AS attempted,
            count(*) FILTER (WHERE s.call_status = 'answered'::text)::integer AS answered,
            count(*) FILTER (WHERE s.call_status = 'error'::text)::integer AS errors
           FROM command.fmic_ai_simulations s
          WHERE s.audit_run_id = r.id) c ON true
  WHERE r.run_kind = 'ai_simulation'::text AND (r.is_published AND (r.run_state = ANY (ARRAY['completed'::text, 'partial'::text])) AND r.prompt_set_hash IS NOT NULL AND r.collector_version = 'v11'::text AND r.expected_calls IS NOT NULL AND r.attempted_calls = r.expected_calls AND r.published_at IS NOT NULL AND NOT (EXISTS ( SELECT 1
           FROM command.fmic_ai_simulations s
          WHERE s.audit_run_id = r.id AND (s.record_origin = 'historical_backfill'::text OR s.material_hallucination = 'historical_unverified'::text))) OR (r.id = ANY (ARRAY['7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7'::uuid, 'e775ee16-ec5b-45b0-8918-579181b44aff'::uuid])));

-- canvas_private.div_latest  kind=view  owner=postgres  reloptions={}
create view canvas_private.div_latest as
 SELECT DISTINCT ON (division) id,
    audit_run_id,
    division,
    monitored_skus,
    buybox_pct,
    splinter_bundles,
    schema_sync_pct,
    primary_threat,
    strategic_action,
    created_at,
    updated_at
   FROM command.fmic_division_metrics
  WHERE audit_run_id = (( SELECT d.audit_run_id
           FROM command.fmic_division_metrics d
          ORDER BY d.created_at DESC
         LIMIT 1))
  ORDER BY division, created_at DESC;

-- canvas_private.sims_all  kind=view  owner=postgres  reloptions={}
create view canvas_private.sims_all as
 SELECT l.id,
    l.audit_run_id,
    l.sim_id,
    l.category,
    l.prompt,
    l.winner,
    l.hallucination_flag,
    l.root_cause,
    l.remediation_patch,
    l.created_at,
    l.answer_text,
    l.citation_urls,
    l.engine,
    l.repeat_no,
    'live'::text AS source_table
   FROM command.fmic_ai_simulations l
UNION ALL
 SELECT a.id,
    a.audit_run_id,
    a.sim_id,
    a.category,
    a.prompt,
    a.winner,
    a.hallucination_flag,
    a.root_cause,
    a.remediation_patch,
    a.created_at,
    NULL::text AS answer_text,
    NULL::text AS citation_urls,
    a.engine,
    a.repeat_no,
    'run1_archive'::text AS source_table
   FROM command.fmic_ai_simulations_run1_archive a
  WHERE NOT (EXISTS ( SELECT 1
           FROM command.fmic_ai_simulations l
          WHERE l.audit_run_id = a.audit_run_id AND l.sim_id = a.sim_id));

-- canvas_private.spec_latest  kind=view  owner=postgres  reloptions={}
create view canvas_private.spec_latest as
 SELECT DISTINCT ON (s.asin) s.id,
    s.asin,
    s.title,
    s.category,
    s.amazon_fields_found,
    s.amazon_fields_expected,
    s.amazon_completeness_pct,
    s.amazon_missing_fields,
    s.amazon_checked,
    s.fender_url,
    s.fender_found,
    s.fender_fields_found,
    s.fender_fields_expected,
    s.fender_completeness_pct,
    s.fender_missing_fields,
    s.checked_at,
    s.batch_run_id,
    s.created_at,
    s.collector_version,
    s.fender_page_source,
    s.fender_identity_match,
    s.fender_variant_sku,
    s.fender_spec_values,
    s.fender_rating_markup,
    s.amazon_spec_values,
    s.amazon_gtin,
    s.amazon_mpn,
    s.amazon_aplus_state,
    s.amazon_aplus_image_count,
    s.amazon_video_state,
    s.amazon_bullet_count,
    s.amazon_image_count
   FROM command.fmic_spec_readiness s
     JOIN command.fmic_electric_catalog c ON c.asin::text = s.asin::text AND c.buybox_seller IS NOT NULL
  ORDER BY s.asin, s.checked_at DESC NULLS LAST;

-- command.fmic_ai_published_prompts  kind=view  owner=postgres  reloptions={}
create view command.fmic_ai_published_prompts as
 SELECT p.organization_id,
    p.set_id,
    p.revision_id,
    p.revision_no,
    p.prompt_key,
    p.prompt_text,
    p.category,
    p.prompt_kind,
    p.analytical_intent,
    p.names_client_brand,
    p.induces_client_brand,
    p.headline_denominator,
    p.active,
    p.versioned_set_hash,
    p.legacy_prompt_set_hash
   FROM command.organizations o
     CROSS JOIN LATERAL command.fmic_ai_current_published_prompts(o.id) p(organization_id, set_id, revision_id, revision_no, prompt_key, prompt_text, category, prompt_kind, analytical_intent, names_client_brand, induces_client_brand, headline_denominator, active, versioned_set_hash, legacy_prompt_set_hash);

-- command.mv_listing_offer_state_v2  kind=materialized view  owner=postgres  reloptions={}
create materialized view command.mv_listing_offer_state_v2 as
 WITH pop AS (
         SELECT c.asin
           FROM command.fmic_electric_catalog c
             LEFT JOIN command.fmic_retail_buybox_map m ON m.asin::text = c.asin::text
          WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric OR m.asin IS NOT NULL
        ), days AS (
         SELECT k.asin,
            k.day,
            k.sales_rank_drops,
                CASE
                    WHEN k.new_price_close IS NULL THEN 'out_of_stock'::text
                    WHEN k.buybox_price_close IS NULL THEN 'no_buy_box'::text
                    ELSE 'in_stock'::text
                END AS state
           FROM command.fmic_keepa_daily k
             JOIN pop USING (asin)
          WHERE k.day > (CURRENT_DATE - 365)
        ), latest AS (
         SELECT days.asin,
            max(days.day) AS history_through
           FROM days
          GROUP BY days.asin
        ), grouped AS (
         SELECT days.asin,
            days.day,
            days.state,
            days.sales_rank_drops,
            days.day - row_number() OVER (PARTITION BY days.asin, days.state ORDER BY days.day)::integer AS grp
           FROM days
        )
 SELECT g.asin,
    g.state,
    min(g.day) AS start_day,
    max(g.day) AS end_day,
    count(*)::integer AS days,
    max(g.day) = l.history_through AS ongoing,
    sum(g.sales_rank_drops)::integer AS rank_drops_activity,
    'Keepa (Amazon.com)'::text AS source
   FROM grouped g
     JOIN latest l USING (asin)
  WHERE g.state <> 'in_stock'::text
  GROUP BY g.asin, g.state, g.grp, l.history_through;

-- command.mv_listing_sales_loss  kind=materialized view  owner=postgres  reloptions={}
create materialized view command.mv_listing_sales_loss as
 WITH live AS (
         SELECT c.asin,
            c.title
           FROM command.fmic_electric_catalog c
          WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric
        ), ss AS (
         SELECT DISTINCT ON (fmic_smartscout_products.asin) fmic_smartscout_products.asin,
            fmic_smartscout_products.snapshot_date,
            fmic_smartscout_products.est_monthly_units,
            fmic_smartscout_products.est_monthly_revenue,
            fmic_smartscout_products.ttm_revenue,
            fmic_smartscout_products.prev_12m_revenue
           FROM command.fmic_smartscout_products
          ORDER BY fmic_smartscout_products.asin, fmic_smartscout_products.snapshot_date DESC
        ), d AS (
         SELECT k_1.asin,
            count(*) FILTER (WHERE k_1.day > (CURRENT_DATE - 30)) AS observed_days_30,
            count(*) FILTER (WHERE k_1.day > (CURRENT_DATE - 30) AND k_1.new_price_close IS NOT NULL) AS in_stock_days_30,
            count(*) FILTER (WHERE k_1.day > (CURRENT_DATE - 90)) AS observed_days_90,
            count(*) FILTER (WHERE k_1.day > (CURRENT_DATE - 90) AND k_1.new_price_close IS NULL) AS oos_days_90,
            count(*) FILTER (WHERE k_1.day > (CURRENT_DATE - 90) AND k_1.new_price_close IS NOT NULL AND k_1.buybox_price_close IS NULL) AS suppressed_days_90,
            count(*) AS observed_days_365,
            count(*) FILTER (WHERE k_1.new_price_close IS NOT NULL) AS in_stock_days_365,
            count(*) FILTER (WHERE k_1.new_price_close IS NULL) AS oos_days_365,
            count(*) FILTER (WHERE k_1.new_price_close IS NOT NULL AND k_1.buybox_price_close IS NULL) AS suppressed_days_365,
            max(k_1.day) AS history_through
           FROM command.fmic_keepa_daily k_1
             JOIN live USING (asin)
          WHERE k_1.day > (CURRENT_DATE - 365)
          GROUP BY k_1.asin
        ), b AS (
         SELECT live.asin,
            live.title,
            ss.snapshot_date,
            ss.est_monthly_units,
            ss.est_monthly_revenue,
            ss.ttm_revenue,
            ss.prev_12m_revenue,
            d.observed_days_30,
            d.in_stock_days_30,
            d.observed_days_90,
            d.oos_days_90,
            d.suppressed_days_90,
            d.observed_days_365,
            d.in_stock_days_365,
            d.oos_days_365,
            d.suppressed_days_365,
            d.history_through,
                CASE
                    WHEN ss.ttm_revenue > 0::numeric AND d.in_stock_days_365 >= 30 THEN 'ttm_per_in_stock_day'::text
                    WHEN ss.est_monthly_revenue > 0::numeric AND d.in_stock_days_30 >= 7 THEN '30d_per_in_stock_day'::text
                    ELSE NULL::text
                END AS baseline_method,
                CASE
                    WHEN ss.ttm_revenue > 0::numeric AND d.in_stock_days_365 >= 30 THEN ss.ttm_revenue / d.in_stock_days_365::numeric
                    WHEN ss.est_monthly_revenue > 0::numeric AND d.in_stock_days_30 >= 7 THEN ss.est_monthly_revenue / d.in_stock_days_30::numeric
                    ELSE NULL::numeric
                END AS baseline_daily_revenue
           FROM live
             LEFT JOIN ss USING (asin)
             LEFT JOIN d USING (asin)
        )
 SELECT b.asin,
    b.title,
    b.snapshot_date AS smartscout_snapshot_date,
    b.est_monthly_units AS smartscout_monthly_units,
    b.est_monthly_revenue AS smartscout_monthly_revenue,
    b.ttm_revenue AS smartscout_ttm_revenue,
    b.prev_12m_revenue AS smartscout_prev_12m_revenue,
    k.sales_rank_current,
    k.sales_rank_drops_30,
    k.sales_rank_drops_90,
    b.history_through,
    b.observed_days_30,
    b.in_stock_days_30,
    b.observed_days_90,
    b.oos_days_90,
    b.suppressed_days_90,
    b.observed_days_365,
    b.in_stock_days_365,
    b.oos_days_365,
    b.suppressed_days_365,
    b.baseline_method,
    round(b.baseline_daily_revenue, 2) AS baseline_daily_revenue,
    round(b.baseline_daily_revenue * b.oos_days_90::numeric, 2) AS est_lost_revenue_oos_90,
    round(b.baseline_daily_revenue * b.suppressed_days_90::numeric, 2) AS est_lost_revenue_suppressed_90_max,
    round(b.baseline_daily_revenue * b.oos_days_365::numeric, 2) AS est_lost_revenue_oos_365,
    round(b.baseline_daily_revenue * b.suppressed_days_365::numeric, 2) AS est_lost_revenue_suppressed_365_max
   FROM b
     LEFT JOIN command.fmic_keepa_stats k USING (asin);

-- command.mv_listing_sales_loss_v2  kind=materialized view  owner=postgres  reloptions={}
create materialized view command.mv_listing_sales_loss_v2 as
 WITH pop AS (
         SELECT c.asin,
            c.title,
            c.current_price,
            COALESCE(c.is_bundle, false) AS is_bundle,
            m.featured_offer_state,
            m.featured_offer_checked_at
           FROM command.fmic_electric_catalog c
             LEFT JOIN command.fmic_retail_buybox_map m ON m.asin::text = c.asin::text
          WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric OR m.asin IS NOT NULL
        ), ss AS (
         SELECT DISTINCT ON (fmic_smartscout_products.asin) fmic_smartscout_products.asin,
            fmic_smartscout_products.snapshot_date,
            fmic_smartscout_products.est_monthly_units,
            fmic_smartscout_products.est_monthly_revenue,
            fmic_smartscout_products.ttm_revenue,
            fmic_smartscout_products.prev_12m_revenue
           FROM command.fmic_smartscout_products
          ORDER BY fmic_smartscout_products.asin, fmic_smartscout_products.snapshot_date DESC
        ), k AS (
         SELECT k.asin,
            k.day,
            k.sales_rank_min,
            k.sales_rank_avg,
            k.sales_rank_close,
            k.sales_rank_drops,
            k.new_price_min,
            k.new_price_close,
            k.amazon_price_close,
            k.amazon_in_stock,
            k.buybox_price_close,
            k.buybox_shipping_close,
            k.rating,
            k.review_count,
            k.source,
            k.collector_version,
            k.loaded_at
           FROM command.fmic_keepa_daily k
             JOIN pop USING (asin)
          WHERE k.day > (CURRENT_DATE - 365)
        ), d AS (
         SELECT k.asin,
            min(k.day) AS history_from,
            max(k.day) AS history_through,
            max(k.loaded_at) AS keepa_checked_at,
            max(k.day) FILTER (WHERE k.new_price_close IS NOT NULL) AS last_in_stock_day,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30)) AS observed_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30) AND k.new_price_close IS NOT NULL) AS in_stock_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30) AND k.new_price_close IS NULL) AS oos_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30) AND k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS no_buy_box_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 90)) AS observed_days_90,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 90) AND k.new_price_close IS NULL) AS oos_days_90,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 90) AND k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS no_buy_box_days_90,
            count(*) AS observed_days_365,
            count(*) FILTER (WHERE k.new_price_close IS NOT NULL) AS in_stock_days_365,
            count(*) FILTER (WHERE k.new_price_close IS NULL) AS oos_days_365,
            count(*) FILTER (WHERE k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS no_buy_box_days_365
           FROM k
          GROUP BY k.asin
        ), cur AS (
         SELECT d.asin,
            d.last_in_stock_day IS NULL OR d.last_in_stock_day < d.history_through AS offline_now,
            count(k.day) FILTER (WHERE k.new_price_close IS NULL) AS current_oos_days,
            sum(k.sales_rank_drops) AS current_stretch_rank_drops
           FROM d
             LEFT JOIN k ON k.asin = d.asin AND k.day > COALESCE(d.last_in_stock_day, d.history_from - 1)
          GROUP BY d.asin, d.last_in_stock_day, d.history_through
        ), b AS (
         SELECT pop.asin,
            pop.title,
            pop.current_price,
            pop.is_bundle,
            pop.featured_offer_state,
            pop.featured_offer_checked_at,
            ss.snapshot_date,
            ss.est_monthly_units,
            ss.est_monthly_revenue,
            ss.ttm_revenue,
            ss.prev_12m_revenue,
            d.history_from,
            d.history_through,
            d.last_in_stock_day,
            d.keepa_checked_at,
            d.observed_days_30,
            d.in_stock_days_30,
            d.oos_days_30,
            d.no_buy_box_days_30,
            d.observed_days_90,
            d.oos_days_90,
            d.no_buy_box_days_90,
            d.observed_days_365,
            d.in_stock_days_365,
            d.oos_days_365,
            d.no_buy_box_days_365,
            cur.offline_now,
            cur.current_oos_days,
            cur.current_stretch_rank_drops,
                CASE
                    WHEN ss.ttm_revenue > 0::numeric AND d.in_stock_days_365 >= 30 THEN 'smartscout_ttm'::text
                    WHEN ss.est_monthly_revenue > 0::numeric AND d.in_stock_days_30 >= 7 THEN 'smartscout_30d'::text
                    ELSE NULL::text
                END AS baseline_method,
                CASE
                    WHEN ss.ttm_revenue > 0::numeric AND d.in_stock_days_365 >= 30 THEN ss.ttm_revenue / d.in_stock_days_365::numeric
                    WHEN ss.est_monthly_revenue > 0::numeric AND d.in_stock_days_30 >= 7 THEN ss.est_monthly_revenue / d.in_stock_days_30::numeric
                    ELSE NULL::numeric
                END AS baseline_daily_revenue
           FROM pop
             LEFT JOIN ss USING (asin)
             LEFT JOIN d USING (asin)
             LEFT JOIN cur USING (asin)
        )
 SELECT b.asin,
    b.title,
    b.is_bundle,
    b.current_price,
    b.featured_offer_state,
    b.featured_offer_checked_at,
    b.history_from,
    b.history_through,
    b.last_in_stock_day,
    b.offline_now,
    b.current_oos_days,
    b.observed_days_30,
    b.in_stock_days_30,
    b.oos_days_30,
    b.no_buy_box_days_30,
    b.observed_days_90,
    b.oos_days_90,
    b.no_buy_box_days_90,
    b.observed_days_365,
    b.in_stock_days_365,
    b.oos_days_365,
    b.no_buy_box_days_365,
    b.current_stretch_rank_drops,
    ks.sales_rank_current,
    ks.sales_rank_drops_30,
    ks.sales_rank_drops_90,
    b.snapshot_date AS smartscout_snapshot_date,
    b.est_monthly_units AS smartscout_monthly_units,
    b.est_monthly_revenue AS smartscout_monthly_revenue,
    b.ttm_revenue AS smartscout_ttm_revenue,
    b.prev_12m_revenue AS smartscout_prev_12m_revenue,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN 'smartscout'::text
            ELSE NULL::text
        END AS revenue_source,
    b.baseline_method,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN 'USD'::text
            ELSE NULL::text
        END AS currency,
        CASE b.baseline_method
            WHEN 'smartscout_ttm'::text THEN (b.snapshot_date - '1 year'::interval)::date
            WHEN 'smartscout_30d'::text THEN b.snapshot_date - 30
            ELSE NULL::date
        END AS revenue_window_start,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN b.snapshot_date
            ELSE NULL::date
        END AS revenue_window_end,
        CASE b.baseline_method
            WHEN 'smartscout_ttm'::text THEN b.in_stock_days_365
            WHEN 'smartscout_30d'::text THEN b.in_stock_days_30
            ELSE NULL::bigint
        END AS in_stock_days_used,
    round(b.baseline_daily_revenue, 2) AS baseline_daily_revenue,
    round(b.baseline_daily_revenue * b.oos_days_30::numeric, 2) AS est_lost_revenue_oos_30,
    round(b.baseline_daily_revenue * b.oos_days_90::numeric, 2) AS est_lost_revenue_oos_90,
    round(b.baseline_daily_revenue * b.oos_days_365::numeric, 2) AS est_lost_revenue_oos_365,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN 'Analyst estimate'::text
            ELSE NULL::text
        END AS estimate_label,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN NULL::text
            WHEN b.history_through IS NULL THEN 'no_keepa_history'::text
            WHEN b.snapshot_date IS NULL THEN 'no_sales_source'::text
            WHEN COALESCE(b.ttm_revenue, 0::numeric) <= 0::numeric AND COALESCE(b.est_monthly_revenue, 0::numeric) <= 0::numeric THEN 'smartscout_reports_no_sales'::text
            ELSE 'too_few_in_stock_days'::text
        END AS awaiting_inputs_reason,
    b.keepa_checked_at
   FROM b
     LEFT JOIN command.fmic_keepa_stats ks USING (asin);

-- command.mv_listing_stock_episodes  kind=materialized view  owner=postgres  reloptions={}
create materialized view command.mv_listing_stock_episodes as
 WITH live AS (
         SELECT c.asin
           FROM command.fmic_electric_catalog c
          WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric
        ), days AS (
         SELECT k.asin,
            k.day,
                CASE
                    WHEN k.new_price_close IS NULL THEN 'out_of_stock'::text
                    WHEN k.buybox_price_close IS NULL THEN 'no_buy_box'::text
                    ELSE 'in_stock'::text
                END AS state
           FROM command.fmic_keepa_daily k
             JOIN live USING (asin)
          WHERE k.day > (CURRENT_DATE - 365)
        ), latest AS (
         SELECT days.asin,
            max(days.day) AS history_through
           FROM days
          GROUP BY days.asin
        ), grouped AS (
         SELECT days.asin,
            days.day,
            days.state,
            days.day - row_number() OVER (PARTITION BY days.asin, days.state ORDER BY days.day)::integer AS grp
           FROM days
        )
 SELECT g.asin,
    g.state,
    min(g.day) AS start_day,
    max(g.day) AS end_day,
    count(*)::integer AS days,
    max(g.day) = l.history_through AS ongoing
   FROM grouped g
     JOIN latest l USING (asin)
  WHERE g.state <> 'in_stock'::text
  GROUP BY g.asin, g.state, g.grp, l.history_through;

-- command.v_fmic_ai_simulations_all  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_ai_simulations_all as
 SELECT l.id,
    l.audit_run_id,
    l.sim_id,
    l.category,
    l.prompt,
    l.fender_win_rate,
    l.winner,
    l.citations,
    l.hallucination_flag,
    l.root_cause,
    l.remediation_patch,
    l.created_at,
    l.updated_at,
    l.answer_text,
    l.citation_urls,
    l.engine,
    l.repeat_no,
    'live'::text AS source_table
   FROM command.fmic_ai_simulations l
UNION ALL
 SELECT a.id,
    a.audit_run_id,
    a.sim_id,
    a.category,
    a.prompt,
    a.fender_win_rate,
    a.winner,
    a.citations,
    a.hallucination_flag,
    a.root_cause,
    a.remediation_patch,
    a.created_at,
    a.updated_at,
    NULL::text AS answer_text,
    NULL::text AS citation_urls,
    a.engine,
    a.repeat_no,
    'run1_archive'::text AS source_table
   FROM command.fmic_ai_simulations_run1_archive a
  WHERE NOT (EXISTS ( SELECT 1
           FROM command.fmic_ai_simulations l
          WHERE l.audit_run_id = a.audit_run_id AND l.sim_id = a.sim_id));

-- command.v_fmic_ai_simulations_latest  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_ai_simulations_latest as
 SELECT DISTINCT ON (sim_id) id,
    audit_run_id,
    sim_id,
    category,
    prompt,
    fender_win_rate,
    winner,
    citations,
    hallucination_flag,
    root_cause,
    remediation_patch,
    created_at,
    updated_at
   FROM command.fmic_ai_simulations
  ORDER BY sim_id, created_at DESC;

-- command.v_fmic_brand_kpi_summary_latest  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_brand_kpi_summary_latest as
 SELECT DISTINCT ON (metric_id) id,
    audit_run_id,
    metric_id,
    metric_name,
    metric_value,
    numeric_value,
    status_tone,
    trend_direction,
    created_at,
    updated_at
   FROM command.fmic_brand_kpi_summary
  ORDER BY metric_id, created_at DESC;

-- command.v_fmic_division_metrics_latest  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_division_metrics_latest as
 SELECT DISTINCT ON (division) id,
    audit_run_id,
    division,
    monitored_skus,
    buybox_pct,
    splinter_bundles,
    schema_sync_pct,
    primary_threat,
    strategic_action,
    created_at,
    updated_at
   FROM command.fmic_division_metrics
  ORDER BY division, created_at DESC;

-- command.v_fmic_listing_monitor  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_listing_monitor as
 SELECT c.asin,
    c.title,
    c.brand,
    c.category,
    c.is_bundle,
    c.current_price,
    c.list_price,
    c.sales_rank,
    c.monthly_sold,
    c.buybox_seller,
    s.seller_name AS buybox_seller_name,
    c.buybox_is_fba,
    c.offer_count_new,
    c.buybox_checked_at,
    b.map_price,
    b.offer_price,
    b.leakage_amount,
    b.buybox_status,
    b.buybox_winner,
    b.mf_price,
    b.mf_leakage,
    b.wmt_price,
    r.amazon_completeness_pct,
    r.fender_completeness_pct,
    r.checked_at AS spec_checked_at
   FROM command.fmic_electric_catalog c
     LEFT JOIN command.fmic_sellers s ON s.seller_id::text = c.buybox_seller::text
     LEFT JOIN command.fmic_retail_buybox_map b ON b.asin::text = c.asin::text
     LEFT JOIN command.v_fmic_spec_readiness_latest r ON r.asin::text = c.asin::text;

-- command.v_fmic_retail_buybox_latest  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_retail_buybox_latest as
 SELECT DISTINCT ON (asin) id,
    audit_run_id,
    asin,
    model_name,
    bundle_name,
    map_price,
    offer_price,
    leakage_amount,
    reviews_count,
    channels,
    buybox_status,
    buybox_winner,
    buybox_share_pct,
    created_at,
    updated_at
   FROM command.fmic_retail_buybox_map
  ORDER BY asin, created_at DESC;

-- command.v_fmic_sku_map  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_sku_map as
 WITH d AS (
         SELECT DISTINCT ON (fmic_dealer_catalog.model_number) fmic_dealer_catalog.model_number,
            ltrim(fmic_dealer_catalog.upc, '0'::text) AS upc_norm,
            fmic_dealer_catalog.model_name,
            fmic_dealer_catalog.series,
            fmic_dealer_catalog.product_type,
            fmic_dealer_catalog.availability,
            fmic_dealer_catalog.inventory_level,
            fmic_dealer_catalog.msrp,
            fmic_dealer_catalog.map_price,
            fmic_dealer_catalog.report_date
           FROM command.fmic_dealer_catalog
          ORDER BY fmic_dealer_catalog.model_number, fmic_dealer_catalog.report_date DESC
        )
 SELECT c.asin,
    c.title,
    c.current_price,
    lc.part_number,
    m.model_number AS fender_model_number,
    m.match_method,
    m.model_name AS fender_model_name,
    m.series AS fender_series,
    m.product_type AS fender_product_type,
    m.availability AS dealer_availability,
    m.inventory_level AS dealer_inventory_level,
    m.msrp AS dealer_msrp,
    m.map_price AS dealer_map_price,
    m.report_date AS dealer_report_date,
    c.is_bundle
   FROM command.fmic_electric_catalog c
     LEFT JOIN command.fmic_listing_content lc ON lc.asin = c.asin::text
     LEFT JOIN LATERAL ( SELECT x.model_number,
            x.upc_norm,
            x.model_name,
            x.series,
            x.product_type,
            x.availability,
            x.inventory_level,
            x.msrp,
            x.map_price,
            x.report_date,
            x.match_method,
            x.pri
           FROM ( SELECT d.model_number,
                    d.upc_norm,
                    d.model_name,
                    d.series,
                    d.product_type,
                    d.availability,
                    d.inventory_level,
                    d.msrp,
                    d.map_price,
                    d.report_date,
                    'part_number'::text AS match_method,
                    1 AS pri
                   FROM d
                  WHERE lc.part_number IS NOT NULL AND d.model_number = lc.part_number
                UNION ALL
                 SELECT d.model_number,
                    d.upc_norm,
                    d.model_name,
                    d.series,
                    d.product_type,
                    d.availability,
                    d.inventory_level,
                    d.msrp,
                    d.map_price,
                    d.report_date,
                    'part_number_core'::text,
                    2
                   FROM d
                  WHERE lc.part_number IS NOT NULL AND d.model_number = "substring"(lc.part_number, '(\d{10})'::text)
                UNION ALL
                 SELECT d.model_number,
                    d.upc_norm,
                    d.model_name,
                    d.series,
                    d.product_type,
                    d.availability,
                    d.inventory_level,
                    d.msrp,
                    d.map_price,
                    d.report_date,
                    'upc'::text,
                    3
                   FROM d
                  WHERE d.upc_norm <> ''::text AND (d.upc_norm = ANY (ARRAY[ltrim(c.upc::text, '0'::text), ltrim(c.ean::text, '0'::text)]))
                UNION ALL
                 SELECT d.model_number,
                    d.upc_norm,
                    d.model_name,
                    d.series,
                    d.product_type,
                    d.availability,
                    d.inventory_level,
                    d.msrp,
                    d.map_price,
                    d.report_date,
                    'amazon_model'::text,
                    4
                   FROM d
                  WHERE c.model_number IS NOT NULL AND d.model_number = c.model_number::text) x
          ORDER BY x.pri, x.model_number
         LIMIT 1) m ON true;

-- command.v_fmic_spec_readiness_latest  kind=view  owner=postgres  reloptions={security_invoker=true}
create view command.v_fmic_spec_readiness_latest as
 SELECT DISTINCT ON (asin) id,
    asin,
    title,
    category,
    amazon_fields_found,
    amazon_fields_expected,
    amazon_completeness_pct,
    amazon_missing_fields,
    amazon_checked,
    fender_url,
    fender_found,
    fender_fields_found,
    fender_fields_expected,
    fender_completeness_pct,
    fender_missing_fields,
    checked_at,
    batch_run_id,
    created_at
   FROM command.fmic_spec_readiness
  ORDER BY asin, checked_at DESC NULLS LAST;

-- ledlenser.canvas_ai_api_calls  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_api_calls as
 SELECT id,
    audit_run_id,
    'api_run'::text AS source_table,
    sim_id,
    engine,
    repeat_no,
    category,
    prompt_text AS prompt,
    winner,
    outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]) AS is_resolved,
    material_hallucination = 'confirmed'::text AS hallucination_flag,
    root_cause,
    remediation_text AS remediation_patch,
    answer_text,
    citation_urls,
    created_at,
    prompt_key,
    prompt_kind,
    model,
    call_status,
    outcome,
    primary_brand,
    material_hallucination,
    hallucination_evidence,
    attempt_no,
    error_message,
    run_state,
    published_at,
    'api'::text AS engine_group
   FROM ledlenser_private.ai_api_calls;

-- ledlenser.canvas_ai_api_citations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_api_citations as
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title,
    'api'::text AS engine_group
   FROM ledlenser.ai_citations ci
     JOIN ledlenser_private.ai_api_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

-- ledlenser.canvas_ai_api_probes  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_api_probes as
 SELECT c.audit_run_id,
    c.sim_id,
    c.prompt_key,
    c.prompt_text AS prompt,
    c.engine,
    c.model,
    c.call_status,
    c.material_hallucination,
    c.hallucination_evidence,
    c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at,
    c.answer_text,
    c.created_at,
    c.probe_asin,
    c.probe_asins,
    c.probe_brand_sku,
    c.probe_category,
    c.probe_series,
    c.probe_spec_field,
    c.probe_expected_value,
    c.probe_source_url,
    c.probe_amazon_value,
    c.probe_is_anchor,
    'api'::text AS engine_group
   FROM ledlenser_private.ai_api_calls c
     LEFT JOIN ledlenser.ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

-- ledlenser.canvas_ai_api_runs  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_api_runs as
 SELECT id AS audit_run_id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at,
    expected_calls - answered_calls AS missing_calls,
    'api'::text AS engine_group,
    engines,
    repeats,
    questions_asked,
    questions_matched,
    question_set_match,
    counted
   FROM ledlenser_private.ai_api_runs;

-- ledlenser.canvas_ai_category  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_category as
 WITH s AS (
         SELECT ai_current_calls.id,
            ai_current_calls.audit_run_id,
            ai_current_calls.sim_id,
            ai_current_calls.category,
            ai_current_calls.prompt_key,
            ai_current_calls.prompt_text,
            ai_current_calls.prompt_kind,
            ai_current_calls.engine,
            ai_current_calls.model,
            ai_current_calls.repeat_no,
            ai_current_calls.attempt_no,
            ai_current_calls.call_status,
            ai_current_calls.outcome,
            ai_current_calls.primary_brand,
            ai_current_calls.winner,
            ai_current_calls.material_hallucination,
            ai_current_calls.hallucination_evidence,
            ai_current_calls.root_cause,
            ai_current_calls.remediation_text,
            ai_current_calls.error_message,
            ai_current_calls.answer_text,
            ai_current_calls.citation_urls,
            ai_current_calls.created_at,
            ai_current_calls.run_state,
            ai_current_calls.published_at,
            ai_current_calls.probe_asin,
            ai_current_calls.probe_asins,
            ai_current_calls.probe_brand_sku,
            ai_current_calls.probe_category,
            ai_current_calls.probe_series,
            ai_current_calls.probe_spec_field,
            ai_current_calls.probe_expected_value,
            ai_current_calls.probe_source_url,
            ai_current_calls.probe_amazon_value,
            ai_current_calls.probe_is_anchor
           FROM ledlenser_private.ai_current_calls
          WHERE ai_current_calls.prompt_kind = 'commercial'::text
        ), r AS (
         SELECT s.id,
            s.audit_run_id,
            s.sim_id,
            s.category,
            s.prompt_key,
            s.prompt_text,
            s.prompt_kind,
            s.engine,
            s.model,
            s.repeat_no,
            s.attempt_no,
            s.call_status,
            s.outcome,
            s.primary_brand,
            s.winner,
            s.material_hallucination,
            s.hallucination_evidence,
            s.root_cause,
            s.remediation_text,
            s.error_message,
            s.answer_text,
            s.citation_urls,
            s.created_at,
            s.run_state,
            s.published_at,
            s.probe_asin,
            s.probe_asins,
            s.probe_brand_sku,
            s.probe_category,
            s.probe_series,
            s.probe_spec_field,
            s.probe_expected_value,
            s.probe_source_url,
            s.probe_amazon_value,
            s.probe_is_anchor
           FROM s
          WHERE s.outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text])
        ), c AS (
         SELECT r.category,
            count(*) AS resolved,
            count(*) FILTER (WHERE r.outcome = 'brand_win'::text AND r.material_hallucination IS DISTINCT FROM 'confirmed'::text) AS brand_wins
           FROM r
          GROUP BY r.category
        ), comp AS (
         SELECT DISTINCT ON (r.category) r.category,
            r.primary_brand::character varying(100) AS top_competitor,
            count(*) AS top_competitor_wins
           FROM r
          WHERE r.outcome = 'competitor_win'::text
          GROUP BY r.category, r.primary_brand
          ORDER BY r.category, (count(*)) DESC, r.primary_brand
        ), a AS (
         SELECT s.category,
            count(*) AS total_sims,
            count(*) FILTER (WHERE s.outcome = 'unresolved'::text) AS unclear,
            count(*) FILTER (WHERE s.outcome = 'error'::text) AS errors,
            count(*) FILTER (WHERE s.material_hallucination = 'confirmed'::text) AS hallucinations
           FROM s
          GROUP BY s.category
        )
 SELECT a.category,
    a.total_sims,
    COALESCE(c.resolved, 0::bigint) AS resolved,
    COALESCE(c.brand_wins, 0::bigint) AS brand_wins,
    round(100.0 * c.brand_wins::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS brand_win_pct,
    comp.top_competitor,
    COALESCE(comp.top_competitor_wins, 0::bigint) AS top_competitor_wins,
    round(100.0 * comp.top_competitor_wins::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS top_competitor_pct,
    round(100.0 * (COALESCE(c.brand_wins, 0::bigint) - COALESCE(comp.top_competitor_wins, 0::bigint))::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS sov_gap_pts,
    a.unclear,
    a.errors,
    a.hallucinations
   FROM a
     LEFT JOIN c USING (category)
     LEFT JOIN comp USING (category);

-- ledlenser.canvas_ai_citations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_citations as
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title
   FROM ledlenser.ai_citations ci
     JOIN ledlenser_private.ai_current_calls s ON s.id = ci.simulation_id;

-- ledlenser.canvas_ai_current_run  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_current_run as
 SELECT id AS audit_run_id,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    started_at,
    completed_at,
    published_at,
    expected_calls - answered_calls AS missing_calls
   FROM ledlenser_private.ai_current_run;

-- ledlenser.canvas_ai_engine  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_engine as
 SELECT COALESCE(engine, 'unknown'::character varying) AS engine,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text) AS total_sims,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]))) AS resolved,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'brand_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text) AS brand_wins,
    round(100.0 * count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'brand_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text)::numeric / NULLIF(count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]))), 0)::numeric, 1) AS brand_win_pct,
    count(*) FILTER (WHERE material_hallucination = 'confirmed'::text) AS hallucinations
   FROM ledlenser_private.ai_current_calls
  GROUP BY (COALESCE(engine, 'unknown'::character varying));

-- ledlenser.canvas_ai_history_calls  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_history_calls as
 SELECT id,
    audit_run_id,
    'history_run'::text AS source_table,
    sim_id,
    engine,
    repeat_no,
    category,
    prompt_text AS prompt,
    winner,
    outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]) AS is_resolved,
    material_hallucination = 'confirmed'::text AS hallucination_flag,
    root_cause,
    remediation_text AS remediation_patch,
    answer_text,
    citation_urls,
    created_at,
    prompt_key,
    prompt_kind,
    model,
    call_status,
    outcome,
    primary_brand,
    material_hallucination,
    hallucination_evidence,
    attempt_no,
    error_message,
    run_state,
    published_at
   FROM ledlenser_private.ai_history_calls;

-- ledlenser.canvas_ai_history_citations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_history_citations as
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title
   FROM ledlenser.ai_citations ci
     JOIN ledlenser_private.ai_history_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

-- ledlenser.canvas_ai_history_citations_by_run  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_history_citations_by_run as
 SELECT audit_run_id,
    sim_id,
    simulation_id,
    prompt_key,
    prompt_kind,
    category,
    engine,
    "position",
    url,
    domain,
    title
   FROM ledlenser.canvas_ai_history_citations;

-- ledlenser.canvas_ai_history_outcome_counts  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_history_outcome_counts as
 SELECT audit_run_id,
    engine,
    prompt_kind,
    prompt_key,
    prompt AS prompt_text,
    category,
    call_status,
    outcome,
    material_hallucination,
    primary_brand,
    count(*) AS calls
   FROM ledlenser.canvas_ai_history_calls
  GROUP BY audit_run_id, engine, prompt_kind, prompt_key, prompt, category, call_status, outcome, material_hallucination, primary_brand;

-- ledlenser.canvas_ai_history_probes  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_history_probes as
 SELECT c.audit_run_id,
    c.sim_id,
    c.prompt_key,
    c.prompt_text AS prompt,
    c.engine,
    c.model,
    c.call_status,
    c.material_hallucination,
    c.hallucination_evidence,
    c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at,
    c.answer_text,
    c.created_at,
    c.probe_asin,
    c.probe_asins,
    c.probe_brand_sku,
    c.probe_category,
    c.probe_series,
    c.probe_spec_field,
    c.probe_expected_value,
    c.probe_source_url,
    c.probe_amazon_value,
    c.probe_is_anchor
   FROM ledlenser_private.ai_history_calls c
     LEFT JOIN ledlenser.ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

-- ledlenser.canvas_ai_history_runs  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_history_runs as
 SELECT id AS audit_run_id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at,
    expected_calls - answered_calls AS missing_calls
   FROM ledlenser_private.ai_history_runs;

-- ledlenser.canvas_ai_probe_coverage  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_probe_coverage as
 SELECT s.audit_run_id,
    ((r.metadata -> 'probe_rotation'::text) ->> 'cycle_no'::text)::integer AS cycle_no,
    COALESCE(s.probe_category, s.category::text) AS category,
    s.engine::text AS engine,
    COALESCE(((r.metadata -> 'probe_rotation'::text) ->> 'in_scope_models'::text)::integer, ( SELECT count(*)::integer AS count
           FROM ledlenser.brand_catalog
          WHERE brand_catalog.sheet_status = 'Complete'::text)) AS models_in_scope,
    count(DISTINCT COALESCE(s.probe_source_url, s.probe_brand_sku, s.prompt_key)) AS models_checked,
    count(DISTINCT COALESCE(a.asin, s.probe_asin, s.prompt_key)) AS asins_covered,
    count(DISTINCT s.id) FILTER (WHERE s.material_hallucination = 'confirmed'::text) AS wrong_answers
   FROM ledlenser.ai_simulations s
     JOIN ledlenser.audit_runs r ON r.id = s.audit_run_id
     LEFT JOIN LATERAL unnest(s.probe_asins) a(asin) ON true
  WHERE s.prompt_kind = 'probe'::text
  GROUP BY s.audit_run_id, (((r.metadata -> 'probe_rotation'::text) ->> 'cycle_no'::text)::integer), (COALESCE(s.probe_category, s.category::text)), (s.engine::text), (COALESCE(((r.metadata -> 'probe_rotation'::text) ->> 'in_scope_models'::text)::integer, ( SELECT count(*)::integer AS count
           FROM ledlenser.brand_catalog
          WHERE brand_catalog.sheet_status = 'Complete'::text)));

-- ledlenser.canvas_ai_probes  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_probes as
 SELECT c.audit_run_id,
    c.sim_id,
    c.prompt_key,
    c.prompt_text AS prompt,
    c.engine,
    c.model,
    c.call_status,
    c.material_hallucination,
    c.hallucination_evidence,
    c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at,
    c.answer_text,
    c.created_at,
    c.probe_asin,
    c.probe_asins,
    c.probe_brand_sku,
    c.probe_category,
    c.probe_series,
    c.probe_spec_field,
    c.probe_expected_value,
    c.probe_source_url,
    c.probe_amazon_value,
    c.probe_is_anchor
   FROM ledlenser_private.ai_current_calls c
     LEFT JOIN ledlenser.ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

-- ledlenser.canvas_ai_prompts  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_prompts as
 SELECT prompt_key,
    prompt_text,
    category::text AS category,
    prompt_kind,
    active,
    created_at,
    updated_at,
    analytical_intent
   FROM ledlenser.ai_prompts p;

-- ledlenser.canvas_ai_run_history  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_run_history as
 SELECT id AS audit_run_id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at
   FROM ledlenser.audit_runs
  WHERE run_kind = 'ai_simulation'::text;

-- ledlenser.canvas_ai_simulations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_ai_simulations as
 SELECT id,
    audit_run_id,
    'current_run'::text AS source_table,
    sim_id,
    engine,
    repeat_no,
    category,
    prompt_text AS prompt,
    winner,
    outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]) AS is_resolved,
    material_hallucination = 'confirmed'::text AS hallucination_flag,
    root_cause,
    remediation_text AS remediation_patch,
    answer_text,
    citation_urls,
    created_at,
    prompt_key,
    prompt_kind,
    model,
    call_status,
    outcome,
    primary_brand,
    material_hallucination,
    hallucination_evidence,
    attempt_no,
    error_message,
    run_state,
    published_at
   FROM ledlenser_private.ai_current_calls;

-- ledlenser.canvas_amazon_product_types  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_amazon_product_types as
 SELECT asin,
    NULLIF(btrim(product_type_name), ''::text) AS product_type,
    NULLIF(btrim(item_type_keyword), ''::text) AS item_type_keyword
   FROM ledlenser.listing_content l;

-- ledlenser.canvas_client_config  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_client_config as
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

-- ledlenser.canvas_competitor_sov  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_competitor_sov as
 WITH r AS (
         SELECT ai_current_calls.category,
                CASE
                    WHEN ai_current_calls.outcome = 'brand_win'::text THEN ( SELECT client_config.display_name
                       FROM ledlenser.client_config
                     LIMIT 1)
                    ELSE ai_current_calls.primary_brand
                END::character varying(100) AS winner
           FROM ledlenser_private.ai_current_calls
          WHERE ai_current_calls.prompt_kind = 'commercial'::text AND (ai_current_calls.outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]))
        ), g AS (
         SELECT COALESCE(r.category, 'all'::character varying) AS category,
            r.winner AS competitor,
            count(*) AS wins
           FROM r
          GROUP BY GROUPING SETS ((r.category, r.winner), (r.winner))
        ), t AS (
         SELECT COALESCE(r.category, 'all'::character varying) AS category,
            count(*) AS resolved
           FROM r
          GROUP BY GROUPING SETS ((r.category), ())
        )
 SELECT g.category,
    g.competitor,
    g.wins,
    t.resolved AS category_resolved,
    round(100.0 * g.wins::numeric / NULLIF(t.resolved, 0)::numeric, 1) AS sov_pct
   FROM g
     JOIN t USING (category);

-- ledlenser.canvas_divisions  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_divisions as
 SELECT division,
    monitored_skus,
    buybox_pct,
    splinter_bundles,
    schema_sync_pct,
    primary_threat,
    strategic_action,
    created_at
   FROM ledlenser_private.div_latest;

-- ledlenser.canvas_freshness  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_freshness as
 SELECT job_state.job_key,
    job_state.last_run_at,
    job_state.cursor_offset,
    job_state.updated_at
   FROM ledlenser.job_state
UNION ALL
 SELECT 'kpi_recompute'::character varying AS job_key,
    max(brand_kpi_summary.created_at) AS last_run_at,
    NULL::integer AS cursor_offset,
    max(brand_kpi_summary.created_at) AS updated_at
   FROM ledlenser.brand_kpi_summary
UNION ALL
 SELECT 'ai_simulations'::character varying AS job_key,
    c.completed_at AS last_run_at,
    NULL::integer AS cursor_offset,
    c.published_at AS updated_at
   FROM ledlenser_private.ai_current_run c;

-- ledlenser.canvas_listing_channel_price  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_listing_channel_price as
 SELECT asin,
    channel,
    price,
    url,
    checked_at
   FROM ledlenser.listing_channel_price;

-- ledlenser.canvas_listing_content  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_listing_content as
 SELECT l.asin,
    c.title,
    l.bullet_count,
    l.image_count,
    l.main_image_px,
    COALESCE(s.amazon_aplus_state, l.aplus_state, 'not_collected'::text) AS aplus_state,
    l.aplus_module_count,
    COALESCE(s.amazon_video_state, l.video_state, 'not_collected'::text) AS video_state,
    l.video_count,
    l.content_checked_at,
    l.checked_at,
        CASE
            WHEN s.amazon_aplus_state IS NOT NULL THEN 'live_page'::text
            WHEN l.aplus_state IS NOT NULL THEN 'keepa'::text
            ELSE NULL::text
        END AS aplus_source,
        CASE
            WHEN s.amazon_video_state IS NOT NULL THEN 'live_page'::text
            WHEN l.video_state IS NOT NULL THEN 'keepa'::text
            ELSE NULL::text
        END AS video_source
   FROM ledlenser.listing_content l
     JOIN ledlenser.catalog c USING (asin)
     LEFT JOIN ledlenser_private.spec_latest s USING (asin)
  WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric;

-- ledlenser.canvas_listing_offer_state_v2  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_listing_offer_state_v2 as
 SELECT asin,
    state,
    start_day,
    end_day,
    days,
    ongoing,
    rank_drops_activity,
    source
   FROM ledlenser.mv_listing_offer_state_v2;

-- ledlenser.canvas_listing_sales_loss_v2  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_listing_sales_loss_v2 as
 SELECT asin,
    title,
    is_bundle,
    current_price,
    featured_offer_state,
    featured_offer_checked_at,
    history_from,
    history_through,
    last_in_stock_day,
    offline_now,
    current_oos_days,
    observed_days_30,
    in_stock_days_30,
    oos_days_30,
    no_buy_box_days_30,
    observed_days_90,
    oos_days_90,
    no_buy_box_days_90,
    observed_days_365,
    in_stock_days_365,
    oos_days_365,
    no_buy_box_days_365,
    current_stretch_rank_drops,
    sales_rank_current,
    sales_rank_drops_30,
    sales_rank_drops_90,
    smartscout_snapshot_date,
    smartscout_monthly_units,
    smartscout_monthly_revenue,
    smartscout_ttm_revenue,
    smartscout_prev_12m_revenue,
    revenue_source,
    baseline_method,
    currency,
    revenue_window_start,
    revenue_window_end,
    in_stock_days_used,
    baseline_daily_revenue,
    est_lost_revenue_oos_30,
    est_lost_revenue_oos_90,
    est_lost_revenue_oos_365,
    estimate_label,
    awaiting_inputs_reason,
    keepa_checked_at
   FROM ledlenser.mv_listing_sales_loss_v2;

-- ledlenser.canvas_metrics  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_metrics as
 WITH kr AS (
         SELECT brand_kpi_summary.audit_run_id,
            brand_kpi_summary.created_at
           FROM ledlenser.brand_kpi_summary
          WHERE brand_kpi_summary.metric_id IS NOT NULL
          ORDER BY brand_kpi_summary.created_at DESC
         LIMIT 1
        ), kpi AS (
         SELECT jsonb_object_agg(brand_kpi_summary.metric_id, brand_kpi_summary.metric_value) AS j
           FROM ledlenser.brand_kpi_summary
          WHERE brand_kpi_summary.audit_run_id = (( SELECT kr.audit_run_id
                   FROM kr))
        ), cat AS (
         SELECT count(*) AS catalog_skus,
            count(*) FILTER (WHERE catalog.buybox_checked_at IS NOT NULL) AS seller_harvested,
            count(*) FILTER (WHERE catalog.is_bundle) AS catalog_bundles
           FROM ledlenser.catalog
        ), bb AS (
         SELECT count(*) AS bb_total,
            count(*) FILTER (WHERE retail_buybox_map.buybox_status::text = 'Brand Seller'::text) AS bb_brand,
            count(*) FILTER (WHERE retail_buybox_map.buybox_status::text = 'Amazon 1P'::text) AS bb_1p,
            count(*) FILTER (WHERE retail_buybox_map.buybox_status::text = '3P Confirmed'::text) AS bb_3p,
            count(*) FILTER (WHERE retail_buybox_map.buybox_status::text = 'Unknown/Not Harvested'::text) AS bb_unharvested,
            count(*) FILTER (WHERE retail_buybox_map.buybox_status::text = 'No Active Offer'::text) AS bb_no_offer,
            count(*) FILTER (WHERE retail_buybox_map.leakage_amount < 0::numeric) AS amz_below_map,
            round(avg(retail_buybox_map.leakage_amount) FILTER (WHERE retail_buybox_map.leakage_amount < 0::numeric), 2) AS amz_avg_drift,
            count(*) FILTER (WHERE retail_buybox_map.wmt_checked_at IS NOT NULL) AS wmt_checked,
            count(*) FILTER (WHERE retail_buybox_map.wmt_price IS NOT NULL) AS wmt_priced,
            count(*) FILTER (WHERE retail_buybox_map.wmt_leakage < 0::numeric) AS wmt_leaks,
            round(avg(retail_buybox_map.wmt_leakage) FILTER (WHERE retail_buybox_map.wmt_leakage < 0::numeric), 2) AS offamz_avg_leak,
            count(*) FILTER (WHERE COALESCE(retail_buybox_map.leakage_amount, 0::numeric) < 0::numeric OR COALESCE(retail_buybox_map.wmt_leakage, 0::numeric) < 0::numeric) AS map_violation_skus,
            NULLIF(sum(retail_buybox_map.reviews_count), 0) AS bundle_reviews
           FROM ledlenser.retail_buybox_map
        ), sp AS (
         SELECT count(*) AS spec_checked,
            round(avg(spec_latest.amazon_completeness_pct)::numeric, 1) AS spec_avg_amazon_pct,
            count(*) FILTER (WHERE spec_latest.brand_site_found) AS spec_brand_site_found,
            round(100.0 * count(*) FILTER (WHERE spec_latest.brand_site_found)::numeric / NULLIF(count(*), 0)::numeric, 1) AS spec_brand_site_found_pct,
            round(avg(spec_latest.brand_site_completeness_pct) FILTER (WHERE spec_latest.brand_site_found)::numeric, 1) AS spec_avg_brand_site_pct,
            count(*) FILTER (WHERE spec_latest.brand_site_found AND spec_latest.brand_site_missing_fields ~~* '%additionalProperty%'::text) AS spec_missing_additional_property
           FROM ledlenser_private.spec_latest
        ), mfx AS (
         SELECT count(DISTINCT canvas_spec_missing_fields.field) AS spec_missing_field_types
           FROM ledlenser.canvas_spec_missing_fields
          WHERE canvas_spec_missing_fields.source = 'amazon'::text
        ), ai AS (
         SELECT count(*) AS sim_total,
            count(DISTINCT ai_simulations.audit_run_id) AS sim_runs,
            count(*) FILTER (WHERE ai_simulations.outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text])) AS sim_resolved,
            count(*) FILTER (WHERE ai_simulations.outcome = 'brand_win'::text) AS sim_wins,
            count(*) FILTER (WHERE ai_simulations.outcome = 'unresolved'::text) AS sim_unclear,
            count(*) FILTER (WHERE ai_simulations.outcome = 'error'::text OR ai_simulations.call_status = 'error'::text) AS sim_errors,
            count(*) FILTER (WHERE ai_simulations.material_hallucination = 'confirmed'::text) AS sim_hallucinations,
            count(*) FILTER (WHERE ai_simulations.category::text = 'hallucinations'::text) AS sim_hallucination_risk,
            max(ai_simulations.created_at) AS sim_last_at
           FROM ledlenser.ai_simulations
        ), wk AS (
         SELECT canvas_ai_category.category,
            canvas_ai_category.brand_win_pct,
            canvas_ai_category.resolved,
            canvas_ai_category.top_competitor,
            canvas_ai_category.top_competitor_pct,
            canvas_ai_category.sov_gap_pts
           FROM ledlenser.canvas_ai_category
          WHERE canvas_ai_category.resolved >= 10
          ORDER BY canvas_ai_category.brand_win_pct
         LIMIT 1
        ), st AS (
         SELECT canvas_ai_category.category,
            canvas_ai_category.brand_win_pct,
            canvas_ai_category.resolved,
            canvas_ai_category.brand_wins
           FROM ledlenser.canvas_ai_category
          WHERE canvas_ai_category.resolved >= 10
          ORDER BY canvas_ai_category.brand_win_pct DESC, canvas_ai_category.resolved DESC
         LIMIT 1
        ), dv AS (
         SELECT count(DISTINCT div_latest.division) AS division_count
           FROM ledlenser_private.div_latest
        )
 SELECT ( SELECT kr.audit_run_id
           FROM kr) AS kpi_audit_run_id,
    ( SELECT kr.created_at
           FROM kr) AS kpi_computed_at,
    ( SELECT kpi.j
           FROM kpi) AS kpi,
    cat.catalog_skus,
    cat.catalog_bundles,
    cat.seller_harvested,
    round(100.0 * cat.seller_harvested::numeric / NULLIF(cat.catalog_skus, 0)::numeric, 1) AS seller_harvested_pct,
    dv.division_count,
    bb.bb_total,
    bb.bb_1p,
    bb.bb_3p,
    bb.bb_unharvested,
    bb.bb_no_offer,
    round(100.0 * bb.bb_1p::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_1p_pct,
    round(100.0 * bb.bb_3p::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_3p_pct,
    round(100.0 * bb.bb_unharvested::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_unharvested_pct,
    round(100.0 * bb.bb_total::numeric / NULLIF(cat.catalog_skus, 0)::numeric, 1) AS active_offer_coverage_pct,
    bb.amz_below_map,
    bb.amz_avg_drift,
    bb.wmt_checked,
    bb.wmt_priced,
    bb.wmt_leaks,
    bb.offamz_avg_leak,
    bb.map_violation_skus,
    bb.bundle_reviews,
    sp.spec_checked,
    sp.spec_avg_amazon_pct,
    sp.spec_brand_site_found,
    sp.spec_brand_site_found_pct,
    sp.spec_avg_brand_site_pct,
    sp.spec_missing_additional_property,
    mfx.spec_missing_field_types,
    ai.sim_total,
    ai.sim_runs,
    ai.sim_resolved,
    ai.sim_wins,
    round(100.0 * ai.sim_wins::numeric / NULLIF(ai.sim_resolved, 0)::numeric, 1) AS sim_win_pct,
    ai.sim_unclear,
    ai.sim_errors,
    ai.sim_hallucinations,
    ai.sim_hallucination_risk,
    ai.sim_last_at,
    wk.category AS weakest_category,
    wk.brand_win_pct AS weakest_win_pct,
    wk.top_competitor AS weakest_top_competitor,
    wk.top_competitor_pct AS weakest_competitor_pct,
    wk.sov_gap_pts AS weakest_sov_gap_pts,
    st.category AS strongest_category,
    st.brand_win_pct AS strongest_win_pct,
    st.brand_wins AS strongest_wins,
    st.resolved AS strongest_resolved,
    now() AS served_at,
    bb.bb_brand,
    round(100.0 * bb.bb_brand::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_brand_pct
   FROM cat,
    bb,
    sp,
    mfx,
    ai,
    dv
     LEFT JOIN wk ON true
     LEFT JOIN st ON true;

-- ledlenser.canvas_retail_listings  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_retail_listings as
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
    LEAST(b.leakage_amount, b.wmt_leakage) AS worst_leakage,
    COALESCE(b.leakage_amount, 0::numeric) < 0::numeric OR COALESCE(b.wmt_leakage, 0::numeric) < 0::numeric AS is_map_violation,
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
   FROM ledlenser.retail_buybox_map b
     LEFT JOIN ledlenser.catalog c ON c.asin::text = b.asin::text
     LEFT JOIN ledlenser.sellers sl ON sl.seller_id::text = c.buybox_seller::text;

-- ledlenser.canvas_spec_findability  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_spec_findability as
 SELECT cat.asin,
    COALESCE(f.title, cat.title) AS title,
    COALESCE(f.category, cat.category::text) AS category,
    COALESCE(f.findability_state::text, 'not_checked'::text) AS latest_state,
    f.attempt_at AS latest_attempt_at,
    f.canonical_url AS latest_canonical_url,
    f.variant_sku AS latest_variant_sku,
    f.last_success_state,
    f.last_success_url,
    f.last_success_variant_sku,
    f.last_success_at,
    f.last_success_explanation,
    f.last_success_schema_profile,
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
    f.catalog_identity_hash,
    f.last_success_identity_hash,
    f.collector_version,
    f.http_status,
    f.last_success_at IS NOT NULL AND ((COALESCE(f.findability_state::text, 'not_checked'::text) <> ALL (ARRAY['exact_official_product'::text, 'official_family_page'::text])) OR f.catalog_identity_hash IS DISTINCT FROM f.last_success_identity_hash OR f.last_success_at < (now() - '180 days'::interval)) AS success_needs_review,
    COALESCE(f.findability_state::text = ANY (ARRAY['exact_official_product'::text, 'official_family_page'::text]), false) AS counts_as_confirmed,
    COALESCE(f.findability_state::text = ANY (ARRAY['exact_official_product'::text, 'official_family_page'::text, 'ambiguous_candidate'::text, 'completed_not_found'::text]), false) AS counts_as_finished_search,
    COALESCE(f.findability_state::text = 'ambiguous_candidate'::text, false) AS counts_as_ambiguous,
    COALESCE(f.findability_state::text = 'blocked'::text, false) AS counts_as_blocked,
    COALESCE(f.findability_state::text = 'timeout'::text, false) AS counts_as_timeout,
    COALESCE(f.findability_state::text = 'parse_failure'::text, false) AS counts_as_parse_failure,
    f.asin IS NULL OR f.findability_state::text = 'not_checked'::text AS counts_as_unchecked,
    f.last_success_url IS NOT NULL AND (f.findability_state::text = ANY (ARRAY['blocked'::text, 'timeout'::text, 'parse_failure'::text])) AS prior_success_latest_failed,
    f.last_success_url IS NOT NULL AND f.findability_state::text = 'completed_not_found'::text AS prior_success_latest_completed_not_found,
    f.last_success_url IS NOT NULL AND f.findability_state::text = 'ambiguous_candidate'::text AS prior_success_latest_ambiguous,
    f.jsonld_status,
    true AS counts_as_eligible,
    f.asin IS NOT NULL AS counts_as_attempted,
    COALESCE(f.findability_state::text = 'completed_not_found'::text, false) AS counts_as_completed_not_found,
    COALESCE(f.findability_state::text = 'unsupported_product_type'::text, false) AS counts_as_unsupported,
    cat.brand_sku IS NOT NULL AS on_brand_sheet
   FROM ledlenser.catalog cat
     LEFT JOIN ledlenser.spec_findability_current f ON f.asin::text = cat.asin::text
  WHERE cat.buybox_seller IS NOT NULL AND (cat.brand_sku IS NOT NULL OR cat.title ~~* '%led%lenser%'::text);

-- ledlenser.canvas_spec_missing_fields  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_spec_missing_fields as
 SELECT 'amazon'::text AS source,
    f.f AS field,
    count(*) AS sku_count
   FROM ledlenser_private.spec_latest,
    LATERAL unnest(string_to_array(NULLIF(spec_latest.amazon_missing_fields, ''::text), ';'::text)) f(f)
  WHERE f.f <> ''::text
  GROUP BY f.f
UNION ALL
 SELECT 'brand_site'::text AS source,
    f.f AS field,
    count(*) AS sku_count
   FROM ledlenser_private.spec_latest,
    LATERAL unnest(string_to_array(NULLIF(spec_latest.brand_site_missing_fields, ''::text), ';'::text)) f(f)
  WHERE spec_latest.brand_site_found AND f.f <> ''::text
  GROUP BY f.f;

-- ledlenser.canvas_spec_readiness  kind=view  owner=postgres  reloptions={security_invoker=false}
create view ledlenser.canvas_spec_readiness as
 SELECT asin,
    title,
    category,
    amazon_checked,
    amazon_fields_found,
    amazon_fields_expected,
    amazon_completeness_pct,
    amazon_missing_fields,
    brand_site_url,
    brand_site_found,
    brand_site_fields_found,
    brand_site_fields_expected,
    brand_site_completeness_pct,
    brand_site_missing_fields,
    checked_at,
    collector_version,
    brand_site_page_source,
    brand_site_identity_match,
    brand_site_variant_sku,
    brand_site_spec_values,
    brand_site_rating_markup,
    amazon_spec_values,
    amazon_gtin,
    amazon_mpn,
    amazon_aplus_state,
    amazon_aplus_image_count,
    amazon_video_state,
    amazon_bullet_count,
    amazon_image_count
   FROM ledlenser_private.spec_latest;

-- ledlenser.mv_listing_offer_state_v2  kind=materialized view  owner=postgres  reloptions={}
create materialized view ledlenser.mv_listing_offer_state_v2 as
 WITH pop AS (
         SELECT c.asin
           FROM ledlenser.catalog c
             LEFT JOIN ledlenser.retail_buybox_map m ON m.asin::text = c.asin::text
          WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric OR m.asin IS NOT NULL
        ), days AS (
         SELECT k.asin,
            k.day,
            k.sales_rank_drops,
                CASE
                    WHEN k.new_price_close IS NULL THEN 'out_of_stock'::text
                    WHEN k.buybox_price_close IS NULL THEN 'no_buy_box'::text
                    ELSE 'in_stock'::text
                END AS state
           FROM ledlenser.keepa_daily k
             JOIN pop USING (asin)
          WHERE k.day > (CURRENT_DATE - 365)
        ), latest AS (
         SELECT days.asin,
            max(days.day) AS history_through
           FROM days
          GROUP BY days.asin
        ), grouped AS (
         SELECT days.asin,
            days.day,
            days.state,
            days.sales_rank_drops,
            days.day - row_number() OVER (PARTITION BY days.asin, days.state ORDER BY days.day)::integer AS grp
           FROM days
        )
 SELECT g.asin,
    g.state,
    min(g.day) AS start_day,
    max(g.day) AS end_day,
    count(*)::integer AS days,
    max(g.day) = l.history_through AS ongoing,
    sum(g.sales_rank_drops)::integer AS rank_drops_activity,
    'Keepa (Amazon.com)'::text AS source
   FROM grouped g
     JOIN latest l USING (asin)
  WHERE g.state <> 'in_stock'::text
  GROUP BY g.asin, g.state, g.grp, l.history_through;

-- ledlenser.mv_listing_sales_loss_v2  kind=materialized view  owner=postgres  reloptions={}
create materialized view ledlenser.mv_listing_sales_loss_v2 as
 WITH pop AS (
         SELECT c.asin,
            c.title,
            c.current_price,
            COALESCE(c.is_bundle, false) AS is_bundle,
            m.featured_offer_state,
            m.featured_offer_checked_at
           FROM ledlenser.catalog c
             LEFT JOIN ledlenser.retail_buybox_map m ON m.asin::text = c.asin::text
          WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric OR m.asin IS NOT NULL
        ), ss AS (
         SELECT DISTINCT ON (smartscout_products.asin) smartscout_products.asin,
            smartscout_products.snapshot_date,
            smartscout_products.est_monthly_units,
            smartscout_products.est_monthly_revenue,
            smartscout_products.ttm_revenue,
            smartscout_products.prev_12m_revenue
           FROM ledlenser.smartscout_products
          ORDER BY smartscout_products.asin, smartscout_products.snapshot_date DESC
        ), k AS (
         SELECT k.asin,
            k.day,
            k.sales_rank_min,
            k.sales_rank_avg,
            k.sales_rank_close,
            k.sales_rank_drops,
            k.new_price_min,
            k.new_price_close,
            k.amazon_price_close,
            k.amazon_in_stock,
            k.buybox_price_close,
            k.buybox_shipping_close,
            k.rating,
            k.review_count,
            k.source,
            k.collector_version,
            k.loaded_at
           FROM ledlenser.keepa_daily k
             JOIN pop USING (asin)
          WHERE k.day > (CURRENT_DATE - 365)
        ), d AS (
         SELECT k.asin,
            min(k.day) AS history_from,
            max(k.day) AS history_through,
            max(k.loaded_at) AS keepa_checked_at,
            max(k.day) FILTER (WHERE k.new_price_close IS NOT NULL) AS last_in_stock_day,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30)) AS observed_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30) AND k.new_price_close IS NOT NULL) AS in_stock_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30) AND k.new_price_close IS NULL) AS oos_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 30) AND k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS no_buy_box_days_30,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 90)) AS observed_days_90,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 90) AND k.new_price_close IS NULL) AS oos_days_90,
            count(*) FILTER (WHERE k.day > (CURRENT_DATE - 90) AND k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS no_buy_box_days_90,
            count(*) AS observed_days_365,
            count(*) FILTER (WHERE k.new_price_close IS NOT NULL) AS in_stock_days_365,
            count(*) FILTER (WHERE k.new_price_close IS NULL) AS oos_days_365,
            count(*) FILTER (WHERE k.new_price_close IS NOT NULL AND k.buybox_price_close IS NULL) AS no_buy_box_days_365
           FROM k
          GROUP BY k.asin
        ), cur AS (
         SELECT d.asin,
            d.last_in_stock_day IS NULL OR d.last_in_stock_day < d.history_through AS offline_now,
            count(k.day) FILTER (WHERE k.new_price_close IS NULL) AS current_oos_days,
            sum(k.sales_rank_drops) AS current_stretch_rank_drops
           FROM d
             LEFT JOIN k ON k.asin = d.asin AND k.day > COALESCE(d.last_in_stock_day, d.history_from - 1)
          GROUP BY d.asin, d.last_in_stock_day, d.history_through
        ), b AS (
         SELECT pop.asin,
            pop.title,
            pop.current_price,
            pop.is_bundle,
            pop.featured_offer_state,
            pop.featured_offer_checked_at,
            ss.snapshot_date,
            ss.est_monthly_units,
            ss.est_monthly_revenue,
            ss.ttm_revenue,
            ss.prev_12m_revenue,
            d.history_from,
            d.history_through,
            d.last_in_stock_day,
            d.keepa_checked_at,
            d.observed_days_30,
            d.in_stock_days_30,
            d.oos_days_30,
            d.no_buy_box_days_30,
            d.observed_days_90,
            d.oos_days_90,
            d.no_buy_box_days_90,
            d.observed_days_365,
            d.in_stock_days_365,
            d.oos_days_365,
            d.no_buy_box_days_365,
            cur.offline_now,
            cur.current_oos_days,
            cur.current_stretch_rank_drops,
                CASE
                    WHEN ss.ttm_revenue > 0::numeric AND d.in_stock_days_365 >= 30 THEN 'smartscout_ttm'::text
                    WHEN ss.est_monthly_revenue > 0::numeric AND d.in_stock_days_30 >= 7 THEN 'smartscout_30d'::text
                    ELSE NULL::text
                END AS baseline_method,
                CASE
                    WHEN ss.ttm_revenue > 0::numeric AND d.in_stock_days_365 >= 30 THEN ss.ttm_revenue / d.in_stock_days_365::numeric
                    WHEN ss.est_monthly_revenue > 0::numeric AND d.in_stock_days_30 >= 7 THEN ss.est_monthly_revenue / d.in_stock_days_30::numeric
                    ELSE NULL::numeric
                END AS baseline_daily_revenue
           FROM pop
             LEFT JOIN ss USING (asin)
             LEFT JOIN d USING (asin)
             LEFT JOIN cur USING (asin)
        )
 SELECT b.asin,
    b.title,
    b.is_bundle,
    b.current_price,
    b.featured_offer_state,
    b.featured_offer_checked_at,
    b.history_from,
    b.history_through,
    b.last_in_stock_day,
    b.offline_now,
    b.current_oos_days,
    b.observed_days_30,
    b.in_stock_days_30,
    b.oos_days_30,
    b.no_buy_box_days_30,
    b.observed_days_90,
    b.oos_days_90,
    b.no_buy_box_days_90,
    b.observed_days_365,
    b.in_stock_days_365,
    b.oos_days_365,
    b.no_buy_box_days_365,
    b.current_stretch_rank_drops,
    ks.sales_rank_current,
    ks.sales_rank_drops_30,
    ks.sales_rank_drops_90,
    b.snapshot_date AS smartscout_snapshot_date,
    b.est_monthly_units AS smartscout_monthly_units,
    b.est_monthly_revenue AS smartscout_monthly_revenue,
    b.ttm_revenue AS smartscout_ttm_revenue,
    b.prev_12m_revenue AS smartscout_prev_12m_revenue,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN 'smartscout'::text
            ELSE NULL::text
        END AS revenue_source,
    b.baseline_method,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN 'USD'::text
            ELSE NULL::text
        END AS currency,
        CASE b.baseline_method
            WHEN 'smartscout_ttm'::text THEN (b.snapshot_date - '1 year'::interval)::date
            WHEN 'smartscout_30d'::text THEN b.snapshot_date - 30
            ELSE NULL::date
        END AS revenue_window_start,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN b.snapshot_date
            ELSE NULL::date
        END AS revenue_window_end,
        CASE b.baseline_method
            WHEN 'smartscout_ttm'::text THEN b.in_stock_days_365
            WHEN 'smartscout_30d'::text THEN b.in_stock_days_30
            ELSE NULL::bigint
        END AS in_stock_days_used,
    round(b.baseline_daily_revenue, 2) AS baseline_daily_revenue,
    round(b.baseline_daily_revenue * b.oos_days_30::numeric, 2) AS est_lost_revenue_oos_30,
    round(b.baseline_daily_revenue * b.oos_days_90::numeric, 2) AS est_lost_revenue_oos_90,
    round(b.baseline_daily_revenue * b.oos_days_365::numeric, 2) AS est_lost_revenue_oos_365,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN 'Analyst estimate'::text
            ELSE NULL::text
        END AS estimate_label,
        CASE
            WHEN b.baseline_method IS NOT NULL THEN NULL::text
            WHEN b.history_through IS NULL THEN 'no_keepa_history'::text
            WHEN b.snapshot_date IS NULL THEN 'no_sales_source'::text
            WHEN COALESCE(b.ttm_revenue, 0::numeric) <= 0::numeric AND COALESCE(b.est_monthly_revenue, 0::numeric) <= 0::numeric THEN 'smartscout_reports_no_sales'::text
            ELSE 'too_few_in_stock_days'::text
        END AS awaiting_inputs_reason,
    b.keepa_checked_at
   FROM b
     LEFT JOIN ledlenser.keepa_stats ks USING (asin);

-- ledlenser_private.ai_api_calls  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.ai_api_calls as
 SELECT s.id,
    s.audit_run_id,
    s.sim_id,
    s.category,
    s.prompt_key,
    s.prompt_text,
    s.prompt_kind,
    s.engine,
    s.model,
    s.repeat_no,
    s.attempt_no,
    s.call_status,
    s.outcome,
    s.primary_brand,
    s.winner,
    s.material_hallucination,
    s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause,
    rem.remediation_text,
    s.error_message,
    s.answer_text,
    s.citation_urls,
    s.created_at,
    r.run_state,
    r.published_at,
    s.probe_asin,
    s.probe_asins,
    s.probe_brand_sku,
    s.probe_category,
    s.probe_series,
    s.probe_spec_field,
    s.probe_expected_value,
    s.probe_source_url,
    s.probe_amazon_value,
    s.probe_is_anchor
   FROM ledlenser.ai_simulations s
     JOIN ledlenser_private.ai_api_runs r ON r.id = s.audit_run_id AND r.counted
     LEFT JOIN ledlenser.ai_remediations rem ON rem.simulation_id = s.id
  WHERE (s.engine::text = ANY (ARRAY['openai_api'::character varying, 'gemini_api'::character varying, 'claude_api'::character varying, 'grok_api'::character varying, 'crescent_api'::character varying]::text[])) AND s.record_origin IS DISTINCT FROM 'historical_backfill'::text AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text;

-- ledlenser_private.ai_api_runs  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.ai_api_runs as
 WITH api_calls AS (
         SELECT s.audit_run_id,
            s.engine::text AS engine,
            s.call_status,
            s.repeat_no,
            (COALESCE(s.prompt_key, ''::text) || ''::text) || COALESCE(s.prompt_text, ''::text) AS question,
            s.prompt_key,
            s.prompt_text
           FROM ledlenser.ai_simulations s
          WHERE (s.engine::text = ANY (ARRAY['openai_api'::character varying, 'gemini_api'::character varying, 'claude_api'::character varying, 'grok_api'::character varying, 'crescent_api'::character varying]::text[])) AND s.audit_run_id IS NOT NULL AND s.record_origin IS DISTINCT FROM 'historical_backfill'::text AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text
        ), battery_questions AS (
         SELECT DISTINCT b.prompt_key,
            b.prompt_text
           FROM ledlenser.ai_simulations b
             JOIN ledlenser_private.ai_history_runs h ON h.id = b.audit_run_id
          WHERE b.prompt_key IS NOT NULL
        ), per_run AS (
         SELECT c.audit_run_id,
            count(*)::integer AS attempted,
            count(*) FILTER (WHERE c.call_status = 'answered'::text)::integer AS answered,
            count(*) FILTER (WHERE c.call_status = 'error'::text)::integer AS errors,
            count(DISTINCT c.question)::integer AS questions_asked,
            count(DISTINCT c.question) FILTER (WHERE bq.prompt_key IS NOT NULL)::integer AS questions_matched,
            array_agg(DISTINCT c.engine ORDER BY c.engine) AS engines,
            max(c.repeat_no) AS repeats
           FROM api_calls c
             LEFT JOIN battery_questions bq ON bq.prompt_key = c.prompt_key AND bq.prompt_text = c.prompt_text
          GROUP BY c.audit_run_id
        ), judged AS (
         SELECT r.id,
            r.run_kind,
            r.run_state,
            r.collector_version,
            r.prompt_set_hash,
            r.expected_calls,
            p.attempted AS attempted_calls,
            p.answered AS answered_calls,
            p.errors AS error_calls,
            r.is_published,
            r.published_at,
            r.started_at,
            r.completed_at,
            p.engines,
            p.repeats,
            p.questions_asked,
            p.questions_matched,
            p.questions_asked > 0 AND p.questions_matched = p.questions_asked OR (EXISTS ( SELECT 1
                   FROM ledlenser_private.ai_history_runs h
                  WHERE r.prompt_set_hash IS NOT NULL AND h.prompt_set_hash = r.prompt_set_hash)) AS question_set_match
           FROM per_run p
             JOIN ledlenser.audit_runs r ON r.id = p.audit_run_id
        )
 SELECT id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at,
    engines,
    repeats,
    questions_asked,
    questions_matched,
    question_set_match,
    (run_state = ANY (ARRAY['completed'::text, 'partial'::text])) AND question_set_match AND answered_calls > 0 AS counted
   FROM judged j;

-- ledlenser_private.ai_current_calls  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.ai_current_calls as
 SELECT s.id,
    s.audit_run_id,
    s.sim_id,
    s.category,
    s.prompt_key,
    s.prompt_text,
    s.prompt_kind,
    s.engine,
    s.model,
    s.repeat_no,
    s.attempt_no,
    s.call_status,
    s.outcome,
    s.primary_brand,
    s.winner,
    s.material_hallucination,
    s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause,
    rem.remediation_text,
    s.error_message,
    s.answer_text,
    s.citation_urls,
    s.created_at,
    c.run_state,
    c.published_at,
    s.probe_asin,
    s.probe_asins,
    s.probe_brand_sku,
    s.probe_category,
    s.probe_series,
    s.probe_spec_field,
    s.probe_expected_value,
    s.probe_source_url,
    s.probe_amazon_value,
    s.probe_is_anchor
   FROM ledlenser.ai_simulations s
     JOIN ledlenser_private.ai_current_run c ON c.id = s.audit_run_id
     LEFT JOIN ledlenser.ai_remediations rem ON rem.simulation_id = s.id;

-- ledlenser_private.ai_current_run  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.ai_current_run as
 SELECT id,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    started_at,
    completed_at,
    published_at
   FROM ledlenser.audit_runs r
  WHERE is_published AND run_kind = 'ai_simulation'::text
  ORDER BY published_at DESC, id DESC
 LIMIT 1;

-- ledlenser_private.ai_history_calls  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.ai_history_calls as
 SELECT s.id,
    s.audit_run_id,
    s.sim_id,
    s.category,
    s.prompt_key,
    s.prompt_text,
    s.prompt_kind,
    s.engine,
    s.model,
    s.repeat_no,
    s.attempt_no,
    s.call_status,
    s.outcome,
    s.primary_brand,
    s.winner,
    s.material_hallucination,
    s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause,
    rem.remediation_text,
    s.error_message,
    s.answer_text,
    s.citation_urls,
    s.created_at,
    r.run_state,
    r.published_at,
    s.probe_asin,
    s.probe_asins,
    s.probe_brand_sku,
    s.probe_category,
    s.probe_series,
    s.probe_spec_field,
    s.probe_expected_value,
    s.probe_source_url,
    s.probe_amazon_value,
    s.probe_is_anchor
   FROM ledlenser.ai_simulations s
     JOIN ledlenser_private.ai_history_runs r ON r.id = s.audit_run_id
     LEFT JOIN ledlenser.ai_remediations rem ON rem.simulation_id = s.id
  WHERE s.record_origin IS DISTINCT FROM 'historical_backfill'::text AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text;

-- ledlenser_private.ai_history_runs  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.ai_history_runs as
 SELECT r.id,
    r.run_kind,
    r.run_state,
    r.collector_version,
    r.prompt_set_hash,
    r.expected_calls,
    c.attempted AS attempted_calls,
    c.answered AS answered_calls,
    c.errors AS error_calls,
    r.is_published,
    r.published_at,
    r.started_at,
    r.completed_at
   FROM ledlenser.audit_runs r
     JOIN LATERAL ( SELECT count(*)::integer AS attempted,
            count(*) FILTER (WHERE s.call_status = 'answered'::text)::integer AS answered,
            count(*) FILTER (WHERE s.call_status = 'error'::text)::integer AS errors
           FROM ledlenser.ai_simulations s
          WHERE s.audit_run_id = r.id) c ON true
  WHERE r.run_kind = 'ai_simulation'::text AND r.is_published AND (r.run_state = ANY (ARRAY['completed'::text, 'partial'::text])) AND r.prompt_set_hash IS NOT NULL AND r.expected_calls IS NOT NULL AND r.attempted_calls = r.expected_calls AND r.published_at IS NOT NULL AND NOT (EXISTS ( SELECT 1
           FROM ledlenser.ai_simulations s
          WHERE s.audit_run_id = r.id AND (s.record_origin = 'historical_backfill'::text OR s.material_hallucination = 'historical_unverified'::text)));

-- ledlenser_private.div_latest  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.div_latest as
 SELECT DISTINCT ON (division) id,
    audit_run_id,
    division,
    monitored_skus,
    buybox_pct,
    splinter_bundles,
    schema_sync_pct,
    primary_threat,
    strategic_action,
    created_at,
    updated_at
   FROM ledlenser.division_metrics
  WHERE audit_run_id = (( SELECT d.audit_run_id
           FROM ledlenser.division_metrics d
          ORDER BY d.created_at DESC
         LIMIT 1))
  ORDER BY division, created_at DESC;

-- ledlenser_private.spec_latest  kind=view  owner=postgres  reloptions={}
create view ledlenser_private.spec_latest as
 SELECT DISTINCT ON (s.asin) s.id,
    s.asin,
    s.title,
    s.category,
    s.amazon_fields_found,
    s.amazon_fields_expected,
    s.amazon_completeness_pct,
    s.amazon_missing_fields,
    s.amazon_checked,
    s.brand_site_url,
    s.brand_site_found,
    s.brand_site_fields_found,
    s.brand_site_fields_expected,
    s.brand_site_completeness_pct,
    s.brand_site_missing_fields,
    s.checked_at,
    s.batch_run_id,
    s.created_at,
    s.collector_version,
    s.brand_site_page_source,
    s.brand_site_identity_match,
    s.brand_site_variant_sku,
    s.brand_site_spec_values,
    s.brand_site_rating_markup,
    s.amazon_spec_values,
    s.amazon_gtin,
    s.amazon_mpn,
    s.amazon_aplus_state,
    s.amazon_aplus_image_count,
    s.amazon_video_state,
    s.amazon_bullet_count,
    s.amazon_image_count
   FROM ledlenser.spec_readiness s
     JOIN ledlenser.catalog c ON c.asin::text = s.asin::text AND c.buybox_seller IS NOT NULL AND (c.brand_sku IS NOT NULL OR c.title ~~* '%led%lenser%'::text)
  ORDER BY s.asin, s.checked_at DESC NULLS LAST;

-- public.canvas_ai_api_calls  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_api_calls as
 SELECT id,
    audit_run_id,
    'api_run'::text AS source_table,
    sim_id,
    engine,
    repeat_no,
    category,
    prompt_text AS prompt,
    winner,
    outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]) AS is_resolved,
    material_hallucination = 'confirmed'::text AS hallucination_flag,
    root_cause,
    remediation_text AS remediation_patch,
    answer_text,
    citation_urls,
    created_at,
    prompt_key,
    prompt_kind,
    model,
    call_status,
    outcome,
    primary_brand,
    material_hallucination,
    hallucination_evidence,
    attempt_no,
    error_message,
    run_state,
    published_at,
    'api'::text AS engine_group
   FROM canvas_private.ai_api_calls;

-- public.canvas_ai_api_citations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_api_citations as
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title,
    'api'::text AS engine_group
   FROM command.fmic_ai_citations ci
     JOIN canvas_private.ai_api_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

-- public.canvas_ai_api_probes  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_api_probes as
 SELECT c.audit_run_id,
    c.sim_id,
    c.prompt_key,
    c.prompt_text AS prompt,
    c.engine,
    c.model,
    c.call_status,
    c.material_hallucination,
    c.hallucination_evidence,
    c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at,
    c.answer_text,
    c.created_at,
    c.probe_asin,
    c.probe_asins,
    c.probe_fender_sku,
    c.probe_category,
    c.probe_series,
    c.probe_spec_field,
    c.probe_expected_value,
    c.probe_source_url,
    c.probe_amazon_value,
    c.probe_is_anchor,
    'api'::text AS engine_group
   FROM canvas_private.ai_api_calls c
     LEFT JOIN command.fmic_ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

-- public.canvas_ai_api_runs  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_api_runs as
 SELECT id AS audit_run_id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at,
    expected_calls - answered_calls AS missing_calls,
    'api'::text AS engine_group,
    engines,
    repeats,
    questions_asked,
    questions_matched,
    question_set_match,
    counted
   FROM canvas_private.ai_api_runs;

-- public.canvas_ai_category  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_category as
 WITH s AS (
         SELECT ai_current_calls.id,
            ai_current_calls.audit_run_id,
            ai_current_calls.sim_id,
            ai_current_calls.category,
            ai_current_calls.prompt_key,
            ai_current_calls.prompt_text,
            ai_current_calls.prompt_kind,
            ai_current_calls.engine,
            ai_current_calls.model,
            ai_current_calls.repeat_no,
            ai_current_calls.attempt_no,
            ai_current_calls.call_status,
            ai_current_calls.outcome,
            ai_current_calls.primary_brand,
            ai_current_calls.winner,
            ai_current_calls.material_hallucination,
            ai_current_calls.hallucination_evidence,
            ai_current_calls.root_cause,
            ai_current_calls.remediation_text,
            ai_current_calls.error_message,
            ai_current_calls.answer_text,
            ai_current_calls.citation_urls,
            ai_current_calls.created_at,
            ai_current_calls.run_state,
            ai_current_calls.published_at
           FROM canvas_private.ai_current_calls
          WHERE ai_current_calls.prompt_kind = 'commercial'::text
        ), r AS (
         SELECT s.id,
            s.audit_run_id,
            s.sim_id,
            s.category,
            s.prompt_key,
            s.prompt_text,
            s.prompt_kind,
            s.engine,
            s.model,
            s.repeat_no,
            s.attempt_no,
            s.call_status,
            s.outcome,
            s.primary_brand,
            s.winner,
            s.material_hallucination,
            s.hallucination_evidence,
            s.root_cause,
            s.remediation_text,
            s.error_message,
            s.answer_text,
            s.citation_urls,
            s.created_at,
            s.run_state,
            s.published_at
           FROM s
          WHERE s.outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text])
        ), c AS (
         SELECT r.category,
            count(*) AS resolved,
            count(*) FILTER (WHERE r.outcome = 'fender_win'::text AND r.material_hallucination IS DISTINCT FROM 'confirmed'::text) AS fender_wins
           FROM r
          GROUP BY r.category
        ), comp AS (
         SELECT DISTINCT ON (r.category) r.category,
            r.primary_brand::character varying(100) AS top_competitor,
            count(*) AS top_competitor_wins
           FROM r
          WHERE r.outcome = 'competitor_win'::text
          GROUP BY r.category, r.primary_brand
          ORDER BY r.category, (count(*)) DESC, r.primary_brand
        ), a AS (
         SELECT s.category,
            count(*) AS total_sims,
            count(*) FILTER (WHERE s.outcome = 'unresolved'::text) AS unclear,
            count(*) FILTER (WHERE s.outcome = 'error'::text) AS errors,
            count(*) FILTER (WHERE s.material_hallucination = 'confirmed'::text) AS hallucinations
           FROM s
          GROUP BY s.category
        )
 SELECT a.category,
    a.total_sims,
    COALESCE(c.resolved, 0::bigint) AS resolved,
    COALESCE(c.fender_wins, 0::bigint) AS fender_wins,
    round(100.0 * c.fender_wins::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS fender_win_pct,
    comp.top_competitor,
    COALESCE(comp.top_competitor_wins, 0::bigint) AS top_competitor_wins,
    round(100.0 * comp.top_competitor_wins::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS top_competitor_pct,
    round(100.0 * (COALESCE(c.fender_wins, 0::bigint) - COALESCE(comp.top_competitor_wins, 0::bigint))::numeric / NULLIF(c.resolved, 0)::numeric, 1) AS sov_gap_pts,
    a.unclear,
    a.errors,
    a.hallucinations
   FROM a
     LEFT JOIN c USING (category)
     LEFT JOIN comp USING (category);

-- public.canvas_ai_citations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_citations as
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title
   FROM command.fmic_ai_citations ci
     JOIN canvas_private.ai_current_calls s ON s.id = ci.simulation_id;

-- public.canvas_ai_current_run  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_current_run as
 SELECT id AS audit_run_id,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    started_at,
    completed_at,
    published_at,
    expected_calls - answered_calls AS missing_calls
   FROM canvas_private.ai_current_run;

-- public.canvas_ai_engine  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_engine as
 SELECT COALESCE(engine, 'unknown'::character varying) AS engine,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text) AS total_sims,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]))) AS resolved,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'fender_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text) AS fender_wins,
    round(100.0 * count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'fender_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text)::numeric / NULLIF(count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]))), 0)::numeric, 1) AS fender_win_pct,
    count(*) FILTER (WHERE material_hallucination = 'confirmed'::text) AS hallucinations
   FROM canvas_private.ai_current_calls
  GROUP BY (COALESCE(engine, 'unknown'::character varying));

-- public.canvas_ai_history_calls  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_history_calls as
 SELECT id,
    audit_run_id,
    'history_run'::text AS source_table,
    sim_id,
    engine,
    repeat_no,
    category,
    prompt_text AS prompt,
    winner,
    outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]) AS is_resolved,
    material_hallucination = 'confirmed'::text AS hallucination_flag,
    root_cause,
    remediation_text AS remediation_patch,
    answer_text,
    citation_urls,
    created_at,
    prompt_key,
    prompt_kind,
    model,
    call_status,
    outcome,
    primary_brand,
    material_hallucination,
    hallucination_evidence,
    attempt_no,
    error_message,
    run_state,
    published_at
   FROM canvas_private.ai_history_calls;

-- public.canvas_ai_history_citations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_history_citations as
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title
   FROM command.fmic_ai_citations ci
     JOIN canvas_private.ai_history_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

-- public.canvas_ai_history_citations_by_run  kind=view  owner=postgres  reloptions={}
create view public.canvas_ai_history_citations_by_run as
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title
   FROM command.fmic_ai_citations ci
     JOIN canvas_private.ai_history_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

-- public.canvas_ai_history_outcome_counts  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_history_outcome_counts as
 SELECT audit_run_id,
    engine,
    prompt_kind,
    prompt_key,
    prompt AS prompt_text,
    category,
    call_status,
    outcome,
    material_hallucination,
    primary_brand,
    count(*) AS calls
   FROM canvas_ai_history_calls
  GROUP BY audit_run_id, engine, prompt_kind, prompt_key, prompt, category, call_status, outcome, material_hallucination, primary_brand;

-- public.canvas_ai_history_probes  kind=view  owner=postgres  reloptions={}
create view public.canvas_ai_history_probes as
 SELECT c.audit_run_id,
    c.sim_id,
    c.prompt_key,
    c.prompt_text AS prompt,
    c.engine,
    c.model,
    c.call_status,
    c.material_hallucination,
    c.hallucination_evidence,
    c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at,
    c.answer_text,
    c.created_at,
    c.probe_asin,
    c.probe_asins,
    c.probe_fender_sku,
    c.probe_category,
    c.probe_series,
    c.probe_spec_field,
    c.probe_expected_value,
    c.probe_source_url,
    c.probe_amazon_value,
    c.probe_is_anchor
   FROM canvas_private.ai_history_calls c
     LEFT JOIN command.fmic_ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

-- public.canvas_ai_history_runs  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_history_runs as
 SELECT id AS audit_run_id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at,
    expected_calls - answered_calls AS missing_calls
   FROM canvas_private.ai_history_runs;

-- public.canvas_ai_probe_coverage  kind=view  owner=postgres  reloptions={}
create view public.canvas_ai_probe_coverage as
 SELECT s.audit_run_id,
    ((r.metadata -> 'probe_rotation'::text) ->> 'cycle_no'::text)::integer AS cycle_no,
    COALESCE(s.probe_category, s.category::text) AS category,
    s.engine::text AS engine,
    COALESCE(((r.metadata -> 'probe_rotation'::text) ->> 'in_scope_models'::text)::integer, 180) AS models_in_scope,
    count(DISTINCT COALESCE(s.probe_source_url, s.probe_fender_sku, s.prompt_key)) AS models_checked,
    count(DISTINCT COALESCE(a.asin, s.probe_asin, s.prompt_key)) AS asins_covered,
    count(DISTINCT s.id) FILTER (WHERE s.material_hallucination = 'confirmed'::text) AS wrong_answers
   FROM command.fmic_ai_simulations s
     JOIN command.fmic_audit_runs r ON r.id = s.audit_run_id
     LEFT JOIN LATERAL unnest(s.probe_asins) a(asin) ON true
  WHERE s.prompt_kind = 'probe'::text
  GROUP BY s.audit_run_id, (((r.metadata -> 'probe_rotation'::text) ->> 'cycle_no'::text)::integer), (COALESCE(s.probe_category, s.category::text)), (s.engine::text), (COALESCE(((r.metadata -> 'probe_rotation'::text) ->> 'in_scope_models'::text)::integer, 180));

-- public.canvas_ai_probes  kind=view  owner=postgres  reloptions={}
create view public.canvas_ai_probes as
 SELECT c.audit_run_id,
    c.sim_id,
    c.prompt_key,
    c.prompt_text AS prompt,
    c.engine,
    c.model,
    c.call_status,
    c.material_hallucination,
    c.hallucination_evidence,
    c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at,
    c.answer_text,
    c.created_at,
    c.probe_asin,
    c.probe_asins,
    c.probe_fender_sku,
    c.probe_category,
    c.probe_series,
    c.probe_spec_field,
    c.probe_expected_value,
    c.probe_source_url,
    c.probe_amazon_value,
    c.probe_is_anchor
   FROM canvas_private.ai_current_calls c
     LEFT JOIN command.fmic_ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

-- public.canvas_ai_run_history  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_run_history as
 SELECT id AS audit_run_id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at
   FROM command.fmic_audit_runs
  WHERE run_kind = 'ai_simulation'::text;

-- public.canvas_ai_simulations  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_ai_simulations as
 SELECT id,
    audit_run_id,
    'current_run'::text AS source_table,
    sim_id,
    engine,
    repeat_no,
    category,
    prompt_text AS prompt,
    winner,
    outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]) AS is_resolved,
    material_hallucination = 'confirmed'::text AS hallucination_flag,
    root_cause,
    remediation_text AS remediation_patch,
    answer_text,
    citation_urls,
    created_at,
    prompt_key,
    prompt_kind,
    model,
    call_status,
    outcome,
    primary_brand,
    material_hallucination,
    hallucination_evidence,
    attempt_no,
    error_message,
    run_state,
    published_at
   FROM canvas_private.ai_current_calls;

-- public.canvas_amazon_product_types  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_amazon_product_types as
 SELECT asin,
    NULLIF(btrim(product_type_name), ''::text) AS product_type,
    NULLIF(btrim(item_type_keyword), ''::text) AS item_type_keyword
   FROM command.fmic_listing_content l;

-- public.canvas_competitor_sov  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_competitor_sov as
 WITH r AS (
         SELECT ai_current_calls.category,
                CASE
                    WHEN ai_current_calls.outcome = 'fender_win'::text THEN 'Fender/Squier'::text
                    ELSE ai_current_calls.primary_brand
                END::character varying(100) AS winner
           FROM canvas_private.ai_current_calls
          WHERE ai_current_calls.prompt_kind = 'commercial'::text AND (ai_current_calls.outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]))
        ), g AS (
         SELECT COALESCE(r.category, 'all'::character varying) AS category,
            r.winner AS competitor,
            count(*) AS wins
           FROM r
          GROUP BY GROUPING SETS ((r.category, r.winner), (r.winner))
        ), t AS (
         SELECT COALESCE(r.category, 'all'::character varying) AS category,
            count(*) AS resolved
           FROM r
          GROUP BY GROUPING SETS ((r.category), ())
        )
 SELECT g.category,
    g.competitor,
    g.wins,
    t.resolved AS category_resolved,
    round(100.0 * g.wins::numeric / NULLIF(t.resolved, 0)::numeric, 1) AS sov_pct
   FROM g
     JOIN t USING (category);

-- public.canvas_divisions  kind=view  owner=postgres  reloptions={}
create view public.canvas_divisions as
 SELECT division,
    monitored_skus,
    buybox_pct,
    splinter_bundles,
    schema_sync_pct,
    primary_threat,
    strategic_action,
    created_at
   FROM canvas_private.div_latest;

-- public.canvas_freshness  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_freshness as
 SELECT fmic_job_state.job_key,
    fmic_job_state.last_run_at,
    fmic_job_state.cursor_offset,
    fmic_job_state.updated_at
   FROM command.fmic_job_state
UNION ALL
 SELECT 'kpi_recompute'::character varying AS job_key,
    max(fmic_brand_kpi_summary.created_at) AS last_run_at,
    NULL::integer AS cursor_offset,
    max(fmic_brand_kpi_summary.created_at) AS updated_at
   FROM command.fmic_brand_kpi_summary
UNION ALL
 SELECT 'ai_simulations'::character varying AS job_key,
    c.completed_at AS last_run_at,
    NULL::integer AS cursor_offset,
    c.published_at AS updated_at
   FROM canvas_private.ai_current_run c;

-- public.canvas_issue_set_asides  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_issue_set_asides as
 SELECT s.id,
    s.client_key,
    s.check_key,
    k.label AS check_label,
    s.entity_type,
    s.entity_key,
    s.entity_label,
    s.status,
    s.reason_code,
    r.label AS reason_label,
    s.note,
    s.set_by_name,
    s.set_at,
    s.reopened_by_name,
    s.reopened_at,
    s.reopen_note,
    s.updated_at,
    s.outcome
   FROM issue_set_asides s
     JOIN set_aside_checks k ON k.check_key = s.check_key
     LEFT JOIN set_aside_reasons r ON r.reason_code = s.reason_code;

-- public.canvas_listing_channel_price  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_listing_channel_price as
 SELECT asin,
    channel,
    price,
    url,
    checked_at
   FROM command.listing_channel_price;

-- public.canvas_listing_content  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_listing_content as
 SELECT l.asin,
    c.title,
    l.bullet_count,
    l.image_count,
    l.main_image_px,
    COALESCE(s.amazon_aplus_state, l.aplus_state, 'not_collected'::text) AS aplus_state,
    l.aplus_module_count,
    COALESCE(s.amazon_video_state, l.video_state, 'not_collected'::text) AS video_state,
    l.video_count,
    l.content_checked_at,
    l.checked_at,
        CASE
            WHEN s.amazon_aplus_state IS NOT NULL THEN 'live_page'::text
            WHEN l.aplus_state IS NOT NULL THEN 'keepa'::text
            ELSE NULL::text
        END AS aplus_source,
        CASE
            WHEN s.amazon_video_state IS NOT NULL THEN 'live_page'::text
            WHEN l.video_state IS NOT NULL THEN 'keepa'::text
            ELSE NULL::text
        END AS video_source
   FROM command.fmic_listing_content l
     JOIN command.fmic_electric_catalog c USING (asin)
     LEFT JOIN canvas_private.spec_latest s USING (asin)
  WHERE COALESCE(c.current_price, 0::numeric) > 0::numeric;

-- public.canvas_listing_offer_state_v2  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_listing_offer_state_v2 as
 SELECT asin,
    state,
    start_day,
    end_day,
    days,
    ongoing,
    rank_drops_activity,
    source
   FROM command.mv_listing_offer_state_v2;

-- public.canvas_listing_sales_loss  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_listing_sales_loss as
 SELECT asin,
    title,
    smartscout_snapshot_date,
    smartscout_monthly_units,
    smartscout_monthly_revenue,
    smartscout_ttm_revenue,
    smartscout_prev_12m_revenue,
    sales_rank_current,
    sales_rank_drops_30,
    sales_rank_drops_90,
    history_through,
    observed_days_30,
    in_stock_days_30,
    observed_days_90,
    oos_days_90,
    suppressed_days_90,
    observed_days_365,
    in_stock_days_365,
    oos_days_365,
    suppressed_days_365,
    baseline_method,
    baseline_daily_revenue,
    est_lost_revenue_oos_90,
    est_lost_revenue_suppressed_90_max,
    est_lost_revenue_oos_365,
    est_lost_revenue_suppressed_365_max
   FROM command.mv_listing_sales_loss;

-- public.canvas_listing_sales_loss_v2  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_listing_sales_loss_v2 as
 SELECT asin,
    title,
    is_bundle,
    current_price,
    featured_offer_state,
    featured_offer_checked_at,
    history_from,
    history_through,
    last_in_stock_day,
    offline_now,
    current_oos_days,
    observed_days_30,
    in_stock_days_30,
    oos_days_30,
    no_buy_box_days_30,
    observed_days_90,
    oos_days_90,
    no_buy_box_days_90,
    observed_days_365,
    in_stock_days_365,
    oos_days_365,
    no_buy_box_days_365,
    current_stretch_rank_drops,
    sales_rank_current,
    sales_rank_drops_30,
    sales_rank_drops_90,
    smartscout_snapshot_date,
    smartscout_monthly_units,
    smartscout_monthly_revenue,
    smartscout_ttm_revenue,
    smartscout_prev_12m_revenue,
    revenue_source,
    baseline_method,
    currency,
    revenue_window_start,
    revenue_window_end,
    in_stock_days_used,
    baseline_daily_revenue,
    est_lost_revenue_oos_30,
    est_lost_revenue_oos_90,
    est_lost_revenue_oos_365,
    estimate_label,
    awaiting_inputs_reason,
    keepa_checked_at
   FROM command.mv_listing_sales_loss_v2;

-- public.canvas_listing_stock_episodes  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_listing_stock_episodes as
 SELECT asin,
    state,
    start_day,
    end_day,
    days,
    ongoing
   FROM command.mv_listing_stock_episodes;

-- public.canvas_metrics  kind=view  owner=postgres  reloptions={}
create view public.canvas_metrics as
 WITH kr AS (
         SELECT fmic_brand_kpi_summary.audit_run_id,
            fmic_brand_kpi_summary.created_at
           FROM command.fmic_brand_kpi_summary
          WHERE fmic_brand_kpi_summary.metric_id IS NOT NULL
          ORDER BY fmic_brand_kpi_summary.created_at DESC
         LIMIT 1
        ), kpi AS (
         SELECT jsonb_object_agg(fmic_brand_kpi_summary.metric_id, fmic_brand_kpi_summary.metric_value) AS j
           FROM command.fmic_brand_kpi_summary
          WHERE fmic_brand_kpi_summary.audit_run_id = (( SELECT kr.audit_run_id
                   FROM kr))
        ), cat AS (
         SELECT count(*) AS catalog_skus,
            count(*) FILTER (WHERE fmic_electric_catalog.buybox_checked_at IS NOT NULL) AS seller_harvested,
            count(*) FILTER (WHERE fmic_electric_catalog.is_bundle) AS catalog_bundles
           FROM command.fmic_electric_catalog
        ), bb AS (
         SELECT count(*) AS bb_total,
            count(*) FILTER (WHERE fmic_retail_buybox_map.buybox_status::text = 'Amazon 1P'::text) AS bb_1p,
            count(*) FILTER (WHERE fmic_retail_buybox_map.buybox_status::text = '3P Confirmed'::text) AS bb_3p,
            count(*) FILTER (WHERE fmic_retail_buybox_map.buybox_status::text = 'Unknown/Not Harvested'::text) AS bb_unharvested,
            count(*) FILTER (WHERE fmic_retail_buybox_map.buybox_status::text = 'No Active Offer'::text) AS bb_no_offer,
            count(*) FILTER (WHERE fmic_retail_buybox_map.leakage_amount < 0::numeric) AS amz_below_map,
            round(avg(fmic_retail_buybox_map.leakage_amount) FILTER (WHERE fmic_retail_buybox_map.leakage_amount < 0::numeric), 2) AS amz_avg_drift,
            count(*) FILTER (WHERE fmic_retail_buybox_map.wmt_checked_at IS NOT NULL) AS wmt_checked,
            count(*) FILTER (WHERE fmic_retail_buybox_map.wmt_price IS NOT NULL) AS wmt_priced,
            count(*) FILTER (WHERE fmic_retail_buybox_map.wmt_leakage < 0::numeric) AS wmt_leaks,
            count(*) FILTER (WHERE fmic_retail_buybox_map.mf_checked_at IS NOT NULL) AS mf_checked,
            count(*) FILTER (WHERE fmic_retail_buybox_map.mf_price IS NOT NULL) AS mf_priced,
            count(*) FILTER (WHERE fmic_retail_buybox_map.mf_leakage < 0::numeric) AS mf_leaks,
            round(avg(LEAST(COALESCE(fmic_retail_buybox_map.wmt_leakage, 0::numeric), COALESCE(fmic_retail_buybox_map.mf_leakage, 0::numeric))) FILTER (WHERE fmic_retail_buybox_map.wmt_leakage < 0::numeric OR fmic_retail_buybox_map.mf_leakage < 0::numeric), 2) AS offamz_avg_leak,
            count(*) FILTER (WHERE COALESCE(fmic_retail_buybox_map.leakage_amount, 0::numeric) < 0::numeric OR COALESCE(fmic_retail_buybox_map.wmt_leakage, 0::numeric) < 0::numeric OR COALESCE(fmic_retail_buybox_map.mf_leakage, 0::numeric) < 0::numeric) AS map_violation_skus,
            NULLIF(sum(fmic_retail_buybox_map.reviews_count), 0) AS bundle_reviews
           FROM command.fmic_retail_buybox_map
        ), sp AS (
         SELECT count(*) AS spec_checked,
            round(avg(spec_latest.amazon_completeness_pct)::numeric, 1) AS spec_avg_amazon_pct,
            count(*) FILTER (WHERE spec_latest.fender_found) AS spec_fender_found,
            round(100.0 * count(*) FILTER (WHERE spec_latest.fender_found)::numeric / NULLIF(count(*), 0)::numeric, 1) AS spec_fender_found_pct,
            round(avg(spec_latest.fender_completeness_pct) FILTER (WHERE spec_latest.fender_found)::numeric, 1) AS spec_avg_fender_pct,
            count(*) FILTER (WHERE spec_latest.fender_found AND spec_latest.fender_missing_fields ~~* '%additionalProperty%'::text) AS spec_missing_additional_property
           FROM canvas_private.spec_latest
        ), mfx AS (
         SELECT count(DISTINCT canvas_spec_missing_fields.field) AS spec_missing_field_types
           FROM canvas_spec_missing_fields
          WHERE canvas_spec_missing_fields.source = 'amazon'::text
        ), ai AS (
         SELECT count(*) AS sim_total,
            count(DISTINCT sims_all.audit_run_id) AS sim_runs,
            count(*) FILTER (WHERE sims_all.winner IS NOT NULL AND (sims_all.winner::text <> ALL (ARRAY['Error'::character varying, 'Unclear'::character varying]::text[]))) AS sim_resolved,
            count(*) FILTER (WHERE sims_all.winner::text = 'Fender/Squier'::text) AS sim_wins,
            count(*) FILTER (WHERE sims_all.winner::text = 'Unclear'::text) AS sim_unclear,
            count(*) FILTER (WHERE sims_all.winner::text = 'Error'::text OR sims_all.winner IS NULL) AS sim_errors,
            count(*) FILTER (WHERE sims_all.hallucination_flag) AS sim_hallucinations,
            count(*) FILTER (WHERE sims_all.category::text = 'hallucinations'::text) AS sim_hallucination_risk,
            max(sims_all.created_at) AS sim_last_at
           FROM canvas_private.sims_all
        ), wk AS (
         SELECT canvas_ai_category.category,
            canvas_ai_category.fender_win_pct,
            canvas_ai_category.resolved,
            canvas_ai_category.top_competitor,
            canvas_ai_category.top_competitor_pct,
            canvas_ai_category.sov_gap_pts
           FROM canvas_ai_category
          WHERE canvas_ai_category.resolved >= 10
          ORDER BY canvas_ai_category.fender_win_pct
         LIMIT 1
        ), st AS (
         SELECT canvas_ai_category.category,
            canvas_ai_category.fender_win_pct,
            canvas_ai_category.resolved,
            canvas_ai_category.fender_wins
           FROM canvas_ai_category
          WHERE canvas_ai_category.resolved >= 10
          ORDER BY canvas_ai_category.fender_win_pct DESC, canvas_ai_category.resolved DESC
         LIMIT 1
        ), dv AS (
         SELECT count(DISTINCT div_latest.division) AS division_count
           FROM canvas_private.div_latest
        )
 SELECT ( SELECT kr.audit_run_id
           FROM kr) AS kpi_audit_run_id,
    ( SELECT kr.created_at
           FROM kr) AS kpi_computed_at,
    ( SELECT kpi.j
           FROM kpi) AS kpi,
    cat.catalog_skus,
    cat.catalog_bundles,
    cat.seller_harvested,
    round(100.0 * cat.seller_harvested::numeric / NULLIF(cat.catalog_skus, 0)::numeric, 1) AS seller_harvested_pct,
    dv.division_count,
    bb.bb_total,
    bb.bb_1p,
    bb.bb_3p,
    bb.bb_unharvested,
    bb.bb_no_offer,
    round(100.0 * bb.bb_1p::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_1p_pct,
    round(100.0 * bb.bb_3p::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_3p_pct,
    round(100.0 * bb.bb_unharvested::numeric / NULLIF(bb.bb_total, 0)::numeric, 1) AS bb_unharvested_pct,
    round(100.0 * bb.bb_total::numeric / NULLIF(cat.catalog_skus, 0)::numeric, 1) AS active_offer_coverage_pct,
    bb.amz_below_map,
    bb.amz_avg_drift,
    bb.wmt_checked,
    bb.wmt_priced,
    bb.wmt_leaks,
    bb.mf_checked,
    bb.mf_priced,
    bb.mf_leaks,
    bb.offamz_avg_leak,
    bb.map_violation_skus,
    bb.bundle_reviews,
    sp.spec_checked,
    sp.spec_avg_amazon_pct,
    sp.spec_fender_found,
    sp.spec_fender_found_pct,
    sp.spec_avg_fender_pct,
    sp.spec_missing_additional_property,
    mfx.spec_missing_field_types,
    ai.sim_total,
    ai.sim_runs,
    ai.sim_resolved,
    ai.sim_wins,
    round(100.0 * ai.sim_wins::numeric / NULLIF(ai.sim_resolved, 0)::numeric, 1) AS sim_win_pct,
    ai.sim_unclear,
    ai.sim_errors,
    ai.sim_hallucinations,
    ai.sim_hallucination_risk,
    ai.sim_last_at,
    wk.category AS weakest_category,
    wk.fender_win_pct AS weakest_win_pct,
    wk.top_competitor AS weakest_top_competitor,
    wk.top_competitor_pct AS weakest_competitor_pct,
    wk.sov_gap_pts AS weakest_sov_gap_pts,
    st.category AS strongest_category,
    st.fender_win_pct AS strongest_win_pct,
    st.fender_wins AS strongest_wins,
    st.resolved AS strongest_resolved,
    now() AS served_at
   FROM cat,
    bb,
    sp,
    mfx,
    ai,
    dv
     LEFT JOIN wk ON true
     LEFT JOIN st ON true;

-- public.canvas_retail_listings  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_retail_listings as
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

-- public.canvas_set_aside_events  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_set_aside_events as
 SELECT id AS event_id,
    entity_id AS set_aside_id,
    occurred_at,
    new_value ->> 'client_key'::text AS client_key,
    new_value ->> 'check_key'::text AS check_key,
    new_value ->> 'entity_key'::text AS entity_key,
    new_value ->> 'status'::text AS status,
        CASE
            WHEN (new_value ->> 'status'::text) = 'reopened'::text THEN new_value ->> 'reopened_by_name'::text
            ELSE new_value ->> 'set_by_name'::text
        END AS actor_name,
    new_value ->> 'reason_code'::text AS reason_code,
        CASE
            WHEN (new_value ->> 'status'::text) = 'reopened'::text THEN new_value ->> 'reopen_note'::text
            ELSE new_value ->> 'note'::text
        END AS note,
    COALESCE(new_value ->> 'outcome'::text, 'set_aside'::text) AS outcome
   FROM audit_log a
  WHERE entity_table = 'issue_set_asides'::text;

-- public.canvas_set_aside_reasons  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_set_aside_reasons as
 SELECT reason_code,
    label,
    description,
    check_keys,
    requires_note,
    sort_order
   FROM set_aside_reasons
  WHERE is_active;

-- public.canvas_site_types  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_site_types as
 WITH candidates AS (
         SELECT c.client_key,
            o.domain,
            o.site_type,
            NULL::numeric AS confidence,
            'staff'::text AS source,
            NULL::text AS model,
            o.set_at AS classified_at,
                CASE
                    WHEN o.client_key IS NULL THEN 2
                    ELSE 1
                END AS rank
           FROM site_type_overrides o
             JOIN set_aside_clients c ON o.client_key IS NULL OR o.client_key = c.client_key
        UNION ALL
         SELECT c.client_key,
            k.domain,
            k.site_type,
            k.confidence,
            k.origin,
            k.model,
            k.classified_at,
                CASE
                    WHEN k.client_key IS NULL THEN 4
                    ELSE 3
                END AS rank
           FROM site_type_classifications k
             JOIN set_aside_clients c ON k.client_key IS NULL OR k.client_key = c.client_key
        )
 SELECT DISTINCT ON (client_key, domain) client_key,
    domain,
    site_type,
    source,
    confidence,
    model,
    classified_at,
    source = 'ai'::text AND confidence < (( SELECT s.review_below
           FROM site_type_settings s
          WHERE s.id)) AS needs_review
   FROM candidates x
  ORDER BY client_key, domain, rank;

-- public.canvas_spec_findability  kind=view  owner=postgres  reloptions={security_invoker=false}
create view public.canvas_spec_findability as
 SELECT cat.asin,
    COALESCE(f.title, cat.title) AS title,
    COALESCE(f.category, cat.category::text) AS category,
    COALESCE(f.findability_state, 'not_checked'::text) AS latest_state,
    f.attempt_at AS latest_attempt_at,
    f.canonical_url AS latest_canonical_url,
    f.variant_sku AS latest_variant_sku,
    f.last_success_state,
    f.last_success_url,
    f.last_success_variant_sku,
    f.last_success_at,
    f.last_success_explanation,
    f.last_success_schema_profile,
    f.last_success_fields_present AS last_success_present_fields,
    f.last_success_fields_missing AS last_success_missing_applicable_fields,
    f.product_kind,
    f.match_confidence AS confidence,
    f.match_explanation AS explanation,
    f.source_method,
    f.last_error AS latest_failure,
    f.schema_profile,
    f.schema_fields_present AS present_fields,
    f.schema_fields_missing AS missing_applicable_fields,
    f.catalog_identity_hash,
    f.last_success_identity_hash,
    f.collector_version,
    f.http_status,
    f.last_success_at IS NOT NULL AND ((COALESCE(f.findability_state, 'not_checked'::text) <> ALL (ARRAY['exact_official_product'::text, 'official_family_page'::text])) OR f.catalog_identity_hash IS DISTINCT FROM f.last_success_identity_hash OR f.last_success_at < (now() - '180 days'::interval)) AS success_needs_review,
    COALESCE(f.findability_state = ANY (ARRAY['exact_official_product'::text, 'official_family_page'::text]), false) AS counts_as_confirmed,
    COALESCE(f.findability_state = ANY (ARRAY['exact_official_product'::text, 'official_family_page'::text, 'ambiguous_candidate'::text, 'completed_not_found'::text]), false) AS counts_as_finished_search,
    COALESCE(f.findability_state = 'ambiguous_candidate'::text, false) AS counts_as_ambiguous,
    COALESCE(f.findability_state = 'blocked'::text, false) AS counts_as_blocked,
    COALESCE(f.findability_state = 'timeout'::text, false) AS counts_as_timeout,
    COALESCE(f.findability_state = 'parse_failure'::text, false) AS counts_as_parse_failure,
    f.asin IS NULL OR f.findability_state = 'not_checked'::text AS counts_as_unchecked,
    f.last_success_url IS NOT NULL AND (f.findability_state = ANY (ARRAY['blocked'::text, 'timeout'::text, 'parse_failure'::text])) AS prior_success_latest_failed,
    f.last_success_url IS NOT NULL AND f.findability_state = 'completed_not_found'::text AS prior_success_latest_completed_not_found,
    f.last_success_url IS NOT NULL AND f.findability_state = 'ambiguous_candidate'::text AS prior_success_latest_ambiguous,
    f.jsonld_status,
    true AS counts_as_eligible,
    f.asin IS NOT NULL AS counts_as_attempted,
    COALESCE(f.findability_state = 'completed_not_found'::text, false) AS counts_as_completed_not_found,
    COALESCE(f.findability_state = 'unsupported_product_type'::text, false) AS counts_as_unsupported
   FROM command.fmic_electric_catalog cat
     LEFT JOIN command.fmic_spec_findability_current f ON f.asin::text = cat.asin::text
  WHERE cat.buybox_seller IS NOT NULL;

-- public.canvas_spec_missing_fields  kind=view  owner=postgres  reloptions={}
create view public.canvas_spec_missing_fields as
 SELECT 'amazon'::text AS source,
    f.f AS field,
    count(*) AS sku_count
   FROM canvas_private.spec_latest,
    LATERAL unnest(string_to_array(NULLIF(spec_latest.amazon_missing_fields, ''::text), ';'::text)) f(f)
  WHERE f.f <> ''::text
  GROUP BY f.f
UNION ALL
 SELECT 'fender'::text AS source,
    f.f AS field,
    count(*) AS sku_count
   FROM canvas_private.spec_latest,
    LATERAL unnest(string_to_array(NULLIF(spec_latest.fender_missing_fields, ''::text), ';'::text)) f(f)
  WHERE spec_latest.fender_found AND f.f <> ''::text
  GROUP BY f.f;

-- public.canvas_spec_readiness  kind=view  owner=postgres  reloptions={}
create view public.canvas_spec_readiness as
 SELECT asin,
    title,
    category,
    amazon_checked,
    amazon_fields_found,
    amazon_fields_expected,
    amazon_completeness_pct,
    amazon_missing_fields,
    fender_url,
    fender_found,
    fender_fields_found,
    fender_fields_expected,
    fender_completeness_pct,
    fender_missing_fields,
    checked_at,
    collector_version,
    fender_page_source,
    fender_identity_match,
    fender_variant_sku,
    fender_spec_values,
    fender_rating_markup,
    amazon_spec_values,
    amazon_gtin,
    amazon_mpn,
    amazon_aplus_state,
    amazon_aplus_image_count,
    amazon_video_state,
    amazon_bullet_count,
    amazon_image_count
   FROM canvas_private.spec_latest;

-- sandbox.v_ai_answer_detail  kind=view  owner=postgres  reloptions={security_invoker=false}
create view sandbox.v_ai_answer_detail as
 SELECT a.ai_answer_id,
    a.client_id,
    a.reading_run_id,
    r.finished_at AS run_finished_at,
    r.status AS run_status,
    a.ai_prompt_id,
    p.category,
    p.prompt_text,
    p.names_client_product,
    p.legacy_sim_id,
    a.read_at,
    a.answered_at,
    a.engine,
    a.repeat_no,
    a.outcome,
    a.winner_brand_id,
    b.name AS winner_brand_name,
    COALESCE(b.is_client_brand, false) AS client_brand_won,
    a.wrong_spec_flag,
    a.wrong_spec_reason,
    a.answer_text,
    a.citations,
    a.citation_urls,
    a.remediation_note,
    a.legacy_source
   FROM sandbox.ai_answer a
     JOIN sandbox.ai_prompt p ON p.ai_prompt_id = a.ai_prompt_id
     LEFT JOIN sandbox.competitor_brand b ON b.competitor_brand_id = a.winner_brand_id
     LEFT JOIN sandbox.reading_run r ON r.reading_run_id = a.reading_run_id;

-- sandbox.v_listing_current  kind=view  owner=postgres  reloptions={security_invoker=false}
create view sandbox.v_listing_current as
 WITH r1 AS (
         SELECT DISTINCT ON (o.listing_id) o.listing_id,
            o.reading_run_id,
            o.read_at,
            o.offer_status,
            o.listed_price,
            o.sales_rank,
            o.monthly_sold,
            o.offer_count_new,
            o.amazon_stock
           FROM sandbox.listing_offer_reading o
             JOIN sandbox.reading_run r ON r.reading_run_id = o.reading_run_id
          WHERE r.source = 'keepa_product'::text AND r.workflow_name = 'fender_catalog_harvester'::text
          ORDER BY o.listing_id, o.read_at DESC, o.reading_run_id DESC
        ), r2 AS (
         SELECT DISTINCT ON (o.listing_id) o.listing_id,
            o.reading_run_id,
            o.read_at,
            o.seller_class,
            o.featured_offer_seller_id,
            o.seller_ships_with_amazon
           FROM sandbox.listing_offer_reading o
             JOIN sandbox.reading_run r ON r.reading_run_id = o.reading_run_id
          WHERE r.source = 'keepa_seller'::text
          ORDER BY o.listing_id, o.read_at DESC, o.reading_run_id DESC
        ), r3 AS (
         SELECT DISTINCT ON (o.listing_id) o.listing_id,
            o.listing_offer_reading_id,
            o.reading_run_id,
            o.read_at,
            o.offer_status,
            o.featured_offer_withheld,
            o.offer_price,
            o.offer_price_cents,
            o.competitive_external_price_cents,
            o.legacy_status
           FROM sandbox.listing_offer_reading o
             JOIN sandbox.reading_run r ON r.reading_run_id = o.reading_run_id
          WHERE r.source = 'keepa_product'::text AND r.workflow_name = 'fender_omnichannel_audit_sync'::text
          ORDER BY o.listing_id, o.read_at DESC, o.reading_run_id DESC
        ), ch AS (
         SELECT DISTINCT ON (p.listing_id, p.channel) p.listing_id,
            p.channel,
            p.match_status,
            p.price,
            p.price_cents,
            p.url,
            p.checked_at
           FROM sandbox.listing_channel_price p
          ORDER BY p.listing_id, p.channel, p.read_at DESC, p.reading_run_id DESC
        ), bm AS (
         SELECT c.listing_id,
            array_agg(c.channel ORDER BY c.channel) AS channels
           FROM ch c
             JOIN r3 r3_1 ON r3_1.listing_id = c.listing_id
          WHERE c.match_status = 'priced'::text AND c.price_cents = r3_1.competitive_external_price_cents
          GROUP BY c.listing_id
        )
 SELECT l.listing_id,
    l.client_id,
    l.retailer,
    l.asin,
    l.parent_listing_id,
    l.parent_asin,
    l.title,
    l.brand,
    l.manufacturer,
    l.model_number,
    l.upc,
    l.ean,
    l.color,
    l.category,
    l.is_bundle,
    l.bundle_name,
    l.url,
    l.amazon_list_price,
    l.first_seen_at,
    l.last_harvested_at,
    l.updated_at,
    r1.reading_run_id AS catalog_run_id,
    r1.read_at AS catalog_read_at,
    r1.offer_status,
    r1.listed_price,
    r1.sales_rank,
    r1.monthly_sold,
    r1.offer_count_new,
    r1.amazon_stock,
    r2.reading_run_id AS seller_run_id,
    r2.read_at AS seller_read_at,
    r2.seller_class,
    r2.featured_offer_seller_id,
    s.seller_name AS featured_offer_seller_name,
    r2.seller_ships_with_amazon,
    r3.listing_offer_reading_id AS benchmark_reading_id,
    r3.reading_run_id AS benchmark_run_id,
    r3.read_at AS benchmark_read_at,
    r3.offer_status AS benchmark_offer_status,
    r3.featured_offer_withheld,
    r3.offer_price,
    r3.offer_price_cents,
    r3.competitive_external_price_cents,
    r3.legacy_status,
    r3.featured_offer_withheld IS TRUE AND r3.offer_price_cents IS NOT NULL AND r3.competitive_external_price_cents IS NOT NULL AND r3.offer_price_cents > r3.competitive_external_price_cents AS suppressed,
    w.price AS walmart_price,
    w.url AS walmart_url,
    w.checked_at AS walmart_checked_at,
    m.price AS musiciansfriend_price,
    m.url AS musiciansfriend_url,
    m.checked_at AS musiciansfriend_checked_at,
    bm.channels AS benchmark_match_channels
   FROM sandbox.listing l
     LEFT JOIN r1 ON r1.listing_id = l.listing_id
     LEFT JOIN r2 ON r2.listing_id = l.listing_id
     LEFT JOIN sandbox.seller s ON s.seller_id = r2.featured_offer_seller_id
     LEFT JOIN r3 ON r3.listing_id = l.listing_id
     LEFT JOIN ch w ON w.listing_id = l.listing_id AND w.channel = 'walmart'::text AND w.match_status = 'priced'::text
     LEFT JOIN ch m ON m.listing_id = l.listing_id AND m.channel = 'musiciansfriend'::text AND m.match_status = 'priced'::text
     LEFT JOIN bm ON bm.listing_id = l.listing_id;

-- sandbox.v_reading_freshness  kind=view  owner=postgres  reloptions={security_invoker=false}
create view sandbox.v_reading_freshness as
 SELECT DISTINCT ON (client_id, source) client_id,
    source,
    reading_run_id,
    workflow_name,
    trigger_type,
    started_at,
    finished_at,
    status,
    rows_read,
    population_count,
    findings_count,
    legacy_run_key
   FROM sandbox.reading_run r
  ORDER BY client_id, source, finished_at DESC NULLS LAST, started_at DESC;

-- sandbox.v_spec_current  kind=view  owner=postgres  reloptions={security_invoker=false}
create view sandbox.v_spec_current as
 SELECT DISTINCT ON (s.listing_id) s.spec_reading_id,
    s.client_id,
    s.listing_id,
    l.asin,
    l.title,
    l.category,
    s.reading_run_id,
    s.read_at,
    s.amazon_checked,
    s.amazon_fields_found,
    s.amazon_fields_expected,
    s.amazon_missing_fields,
    s.brand_site_page_found,
    s.brand_site_url,
    s.brand_site_fields_found,
    s.brand_site_fields_expected,
    s.brand_site_missing_fields,
    s.additional_property_present,
        CASE
            WHEN s.amazon_checked AND s.amazon_fields_expected > 0 THEN round(s.amazon_fields_found::numeric * 100.0 / s.amazon_fields_expected::numeric, 1)
            ELSE NULL::numeric
        END AS amazon_completeness_pct
   FROM sandbox.spec_reading s
     JOIN sandbox.listing l ON l.listing_id = s.listing_id
  ORDER BY s.listing_id, s.read_at DESC, s.reading_run_id DESC;
