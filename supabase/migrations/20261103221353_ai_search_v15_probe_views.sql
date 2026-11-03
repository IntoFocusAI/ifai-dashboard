-- Worker 20.9. Collector v15 Step 1, migration 2 of 2: probe columns in the AI Search views.
-- Record only; already applied.
-- The SQL below is copied word for word from section 4 of
-- docs/pending-migrations/collector-v15-step1-applied.md. Prod's migration history has it as
-- version 20261103221353.
--
-- Changes:
--   Replaces four existing views and appends the 10 probe_* columns at the end of each. No existing
--   column is renamed or retyped. The history filter in ai_history_calls is unchanged.
--     canvas_private.ai_current_calls    public.canvas_ai_probes
--     canvas_private.ai_history_calls    public.canvas_ai_history_probes
--   In the two public probe views, verified_claim and verified_source_url now take the call's
--   probe_expected_value and probe_source_url when present. Otherwise they come from
--   command.fmic_ai_probe_facts as before.
--   Adds public.canvas_ai_probe_coverage: models in scope, models checked, ASINs covered, and wrong
--   answers by run, cycle, category, and engine. SELECT granted to anon and authenticated.
--
-- Why: collector v15 Step 1. The dashboard can show which catalog model each probe checked and how
-- much of the catalog the probes cover. Approved by Brian Magazu, 3 Nov 2026, in the collector plan.
--
-- Undo (section 5 of the report). Do this before undoing the probe indexes and migration 1.
--   DROP VIEW IF EXISTS public.canvas_ai_probe_coverage;
--   Recreate the other four views with their definitions from before 3 Nov 2026. CREATE OR REPLACE
--   can't remove columns, so drop each view and recreate it. The earlier definitions are in
--   20261012150400_ai_search_truth_4_current_views.sql (ai_current_calls, canvas_ai_probes) and
--   20261014190000_ai_search_history_views.sql (ai_history_calls, canvas_ai_history_probes).
--   Other views are built on ai_current_calls and ai_history_calls. Recreate them too, from those
--   two files and 20261103214459_ai_history_citations_by_run.sql.
--   NOTIFY pgrst, 'reload schema';
--
-- Applied: 3 Nov 2026 22:13:53 UTC on production by Schema-Architect, verified by AEO_Product_Research-FenderTest
-- Record only; already applied.

CREATE OR REPLACE VIEW canvas_private.ai_current_calls AS
 SELECT s.id, s.audit_run_id, s.sim_id, s.category, s.prompt_key, s.prompt_text, s.prompt_kind,
    s.engine, s.model, s.repeat_no, s.attempt_no, s.call_status, s.outcome, s.primary_brand,
    s.winner, s.material_hallucination, s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause, rem.remediation_text, s.error_message,
    s.answer_text, s.citation_urls, s.created_at, c.run_state, c.published_at,
    s.probe_asin, s.probe_asins, s.probe_fender_sku, s.probe_category, s.probe_series,
    s.probe_spec_field, s.probe_expected_value, s.probe_source_url, s.probe_amazon_value,
    s.probe_is_anchor
   FROM command.fmic_ai_simulations s
     JOIN canvas_private.ai_current_run c ON c.id = s.audit_run_id
     LEFT JOIN command.fmic_ai_remediations rem ON rem.simulation_id = s.id;

CREATE OR REPLACE VIEW canvas_private.ai_history_calls AS
 SELECT s.id, s.audit_run_id, s.sim_id, s.category, s.prompt_key, s.prompt_text, s.prompt_kind,
    s.engine, s.model, s.repeat_no, s.attempt_no, s.call_status, s.outcome, s.primary_brand,
    s.winner, s.material_hallucination, s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause, rem.remediation_text, s.error_message,
    s.answer_text, s.citation_urls, s.created_at, r.run_state, r.published_at,
    s.probe_asin, s.probe_asins, s.probe_fender_sku, s.probe_category, s.probe_series,
    s.probe_spec_field, s.probe_expected_value, s.probe_source_url, s.probe_amazon_value,
    s.probe_is_anchor
   FROM command.fmic_ai_simulations s
     JOIN canvas_private.ai_history_runs r ON r.id = s.audit_run_id
     LEFT JOIN command.fmic_ai_remediations rem ON rem.simulation_id = s.id
  WHERE (s.audit_run_id = ANY (ARRAY['7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7'::uuid, 'e775ee16-ec5b-45b0-8918-579181b44aff'::uuid]))
     OR s.record_origin IS DISTINCT FROM 'historical_backfill'::text
    AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text;

CREATE OR REPLACE VIEW public.canvas_ai_probes AS
 SELECT c.audit_run_id, c.sim_id, c.prompt_key, c.prompt_text AS prompt, c.engine, c.model,
    c.call_status, c.material_hallucination, c.hallucination_evidence, c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at, c.answer_text, c.created_at,
    c.probe_asin, c.probe_asins, c.probe_fender_sku, c.probe_category, c.probe_series,
    c.probe_spec_field, c.probe_expected_value, c.probe_source_url, c.probe_amazon_value,
    c.probe_is_anchor
   FROM canvas_private.ai_current_calls c
     LEFT JOIN command.fmic_ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

CREATE OR REPLACE VIEW public.canvas_ai_history_probes AS
 SELECT c.audit_run_id, c.sim_id, c.prompt_key, c.prompt_text AS prompt, c.engine, c.model,
    c.call_status, c.material_hallucination, c.hallucination_evidence, c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at, c.answer_text, c.created_at,
    c.probe_asin, c.probe_asins, c.probe_fender_sku, c.probe_category, c.probe_series,
    c.probe_spec_field, c.probe_expected_value, c.probe_source_url, c.probe_amazon_value,
    c.probe_is_anchor
   FROM canvas_private.ai_history_calls c
     LEFT JOIN command.fmic_ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

CREATE OR REPLACE VIEW public.canvas_ai_probe_coverage AS
 SELECT s.audit_run_id,
    (r.metadata -> 'probe_rotation' ->> 'cycle_no')::integer AS cycle_no,
    COALESCE(s.probe_category, s.category::text) AS category,
    s.engine::text AS engine,
    COALESCE((r.metadata -> 'probe_rotation' ->> 'in_scope_models')::integer, 180) AS models_in_scope,
    count(DISTINCT COALESCE(s.probe_source_url, s.probe_fender_sku, s.prompt_key)) AS models_checked,
    count(DISTINCT COALESCE(a.asin, s.probe_asin, s.prompt_key)) AS asins_covered,
    count(DISTINCT s.id) FILTER (WHERE s.material_hallucination = 'confirmed'::text) AS wrong_answers
   FROM command.fmic_ai_simulations s
     JOIN command.fmic_audit_runs r ON r.id = s.audit_run_id
     LEFT JOIN LATERAL unnest(s.probe_asins) a(asin) ON true
  WHERE s.prompt_kind = 'probe'::text
  GROUP BY s.audit_run_id, (r.metadata -> 'probe_rotation' ->> 'cycle_no')::integer,
    COALESCE(s.probe_category, s.category::text), s.engine::text,
    COALESCE((r.metadata -> 'probe_rotation' ->> 'in_scope_models')::integer, 180);

ALTER VIEW public.canvas_ai_probes OWNER TO postgres;
COMMENT ON VIEW public.canvas_ai_probes IS 'Current-run AI probe evaluations with catalog metadata and fallback verified facts.';
GRANT SELECT ON public.canvas_ai_probes TO anon, authenticated;
ALTER VIEW public.canvas_ai_history_probes OWNER TO postgres;
COMMENT ON VIEW public.canvas_ai_history_probes IS 'Historical AI probe evaluations with catalog metadata and fallback verified facts.';
GRANT SELECT ON public.canvas_ai_history_probes TO anon, authenticated;
ALTER VIEW public.canvas_ai_probe_coverage OWNER TO postgres;
COMMENT ON VIEW public.canvas_ai_probe_coverage IS 'AI probe catalog coverage: models in scope, models checked, ASINs covered, and wrong answers by run, cycle, category and engine.';
GRANT SELECT ON public.canvas_ai_probe_coverage TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
