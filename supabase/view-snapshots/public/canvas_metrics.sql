-- public.canvas_metrics (view) — live definition snapshot, do not apply
--   kpi_audit_run_id: uuid
--   kpi_computed_at: timestamp with time zone
--   kpi: jsonb
--   catalog_skus: bigint
--   catalog_bundles: bigint
--   seller_harvested: bigint
--   seller_harvested_pct: numeric
--   division_count: bigint
--   bb_total: bigint
--   bb_1p: bigint
--   bb_3p: bigint
--   bb_unharvested: bigint
--   bb_no_offer: bigint
--   bb_1p_pct: numeric
--   bb_3p_pct: numeric
--   bb_unharvested_pct: numeric
--   active_offer_coverage_pct: numeric
--   amz_below_map: bigint
--   amz_avg_drift: numeric
--   wmt_checked: bigint
--   wmt_priced: bigint
--   wmt_leaks: bigint
--   mf_checked: bigint
--   mf_priced: bigint
--   mf_leaks: bigint
--   offamz_avg_leak: numeric
--   map_violation_skus: bigint
--   bundle_reviews: bigint
--   spec_checked: bigint
--   spec_avg_amazon_pct: numeric
--   spec_fender_found: bigint
--   spec_fender_found_pct: numeric
--   spec_avg_fender_pct: numeric
--   spec_missing_additional_property: bigint
--   spec_missing_field_types: bigint
--   sim_total: bigint
--   sim_runs: bigint
--   sim_resolved: bigint
--   sim_wins: bigint
--   sim_win_pct: numeric
--   sim_unclear: bigint
--   sim_errors: bigint
--   sim_hallucinations: bigint
--   sim_hallucination_risk: bigint
--   sim_last_at: timestamp with time zone
--   weakest_category: character varying(60)
--   weakest_win_pct: numeric
--   weakest_top_competitor: character varying(100)
--   weakest_competitor_pct: numeric
--   weakest_sov_gap_pts: numeric
--   strongest_category: character varying(60)
--   strongest_win_pct: numeric
--   strongest_wins: bigint
--   strongest_resolved: bigint
--   served_at: timestamp with time zone
CREATE OR REPLACE VIEW public.canvas_metrics AS
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
