-- ledlenser.canvas_ai_category (view) — live definition snapshot, do not apply
--   category: character varying(60)
--   total_sims: bigint
--   resolved: bigint
--   brand_wins: bigint
--   brand_win_pct: numeric
--   top_competitor: character varying(100)
--   top_competitor_wins: bigint
--   top_competitor_pct: numeric
--   sov_gap_pts: numeric
--   unclear: bigint
--   errors: bigint
--   hallucinations: bigint
CREATE OR REPLACE VIEW ledlenser.canvas_ai_category AS
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
