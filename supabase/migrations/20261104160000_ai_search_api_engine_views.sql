-- Worker 21.8. AI Search API engines (FDD A-02): read-only views for Brian Watson's API job.
--
-- Adds six new views. Nothing that exists today is replaced, altered, or dropped, and no row is
-- written. Each statement is CREATE VIEW, not CREATE OR REPLACE, so it stops on a name that is
-- already taken instead of replacing that object.
--   canvas_private.ai_api_runs       one row per audit run with API-engine calls, and the run rule
--   canvas_private.ai_api_calls      the API-engine calls of the runs that count
--   public.canvas_ai_api_runs        every API-engine run, its counts, and whether it counts
--   public.canvas_ai_api_calls       the columns of public.canvas_ai_history_calls, plus engine_group
--   public.canvas_ai_api_probes      the columns of public.canvas_ai_history_probes, plus engine_group
--   public.canvas_ai_api_citations   the columns of public.canvas_ai_history_citations, plus engine_group
--
-- Where the API data lives (read-only checks on 4 Nov 2026). The API job writes its calls to
-- command.fmic_ai_simulations with engine openai_api, gemini_api, claude_api, grok_api, or
-- crescent_api, under its own rows in command.fmic_audit_runs. Those runs do not have run_kind
-- 'ai_simulation', so canvas_ai_run_history and the history views leave them out. Two runs were
-- visible through public.canvas_ai_probe_coverage, which has no run_kind filter:
-- fe3ada9e-ce44-41dd-83f3-cc7f78636b17 (27 to 28 Oct) and 8aa2eb28-4a66-4af2-b770-4a5f8349a74b
-- (3 Nov), each with all five API engines. canvas_freshness shows the job's lock rows
-- (subchat_lock_fe3ada9e_<engine> and subchat_lock_8aa2eb28_all). The repo's database role cannot
-- read either table, so run_kind, run_state, and prompt_set_hash for those runs were not seen.
--
-- Run rule (Brian Watson, 4 Nov 2026: the battery's rule, not completed only). A run counts when
-- it finished as completed or partial, its question set matches the battery's, and it has answered
-- calls. Its question set matches when every question it asked (prompt_key and the exact
-- prompt_text) was asked by a run in canvas_private.ai_history_runs, or its prompt_set_hash equals
-- one of theirs. The API job asks no rotating catalog fact check, so it can ask fewer questions than
-- the battery and still match. No answer-rate minimum (Brian Magazu rejected a 50% floor). Scoring
-- is the stored outcome, the same as the battery. canvas_ai_api_runs lists every API-engine run,
-- counted or not, with questions_asked and questions_matched so a run left out shows why.
-- canvas_ai_api_calls, _probes, and _citations hold only counted runs. Rows marked
-- historical_backfill or historical_unverified stay out, as in the history views.
--
-- Grants. Every view is REVOKE ALL from PUBLIC, anon, and authenticated first, then the four
-- public views GRANT SELECT to anon and authenticated only. Without the revoke, new public views
-- keep Supabase's default write grants (fixed for other views in 20261104145317 and PR #125).
-- The canvas_private views get no grant to anon or authenticated.
--
-- Undo (drops only what this file adds):
--   DROP VIEW IF EXISTS public.canvas_ai_api_citations;
--   DROP VIEW IF EXISTS public.canvas_ai_api_probes;
--   DROP VIEW IF EXISTS public.canvas_ai_api_calls;
--   DROP VIEW IF EXISTS public.canvas_ai_api_runs;
--   DROP VIEW IF EXISTS canvas_private.ai_api_calls;
--   DROP VIEW IF EXISTS canvas_private.ai_api_runs;
--   NOTIFY pgrst, 'reload schema';
--
-- Additive. Not applied anywhere. Applied to production only after Brian Magazu approves
-- (AGENTS.md, Database changes). The dashboard works without these views: API engines stay absent
-- and the engine switch reads Not available*.

CREATE VIEW canvas_private.ai_api_runs AS
WITH api_calls AS (
  SELECT s.audit_run_id, s.engine::text AS engine, s.call_status, s.repeat_no,
         coalesce(s.prompt_key, '') || E'\x1f' || coalesce(s.prompt_text, '') AS question,
         s.prompt_key, s.prompt_text
    FROM command.fmic_ai_simulations s
   WHERE s.engine IN ('openai_api', 'gemini_api', 'claude_api', 'grok_api', 'crescent_api')
     AND s.audit_run_id IS NOT NULL
     AND s.record_origin IS DISTINCT FROM 'historical_backfill'
     AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'
),
battery_questions AS (
  SELECT DISTINCT b.prompt_key, b.prompt_text
    FROM command.fmic_ai_simulations b
    JOIN canvas_private.ai_history_runs h ON h.id = b.audit_run_id
   WHERE b.prompt_key IS NOT NULL
),
per_run AS (
  SELECT c.audit_run_id,
         count(*)::integer AS attempted,
         count(*) FILTER (WHERE c.call_status = 'answered')::integer AS answered,
         count(*) FILTER (WHERE c.call_status = 'error')::integer AS errors,
         count(DISTINCT c.question)::integer AS questions_asked,
         count(DISTINCT c.question) FILTER (WHERE bq.prompt_key IS NOT NULL)::integer AS questions_matched,
         array_agg(DISTINCT c.engine ORDER BY c.engine) AS engines,
         max(c.repeat_no) AS repeats
    FROM api_calls c
    LEFT JOIN battery_questions bq ON bq.prompt_key = c.prompt_key AND bq.prompt_text = c.prompt_text
   GROUP BY c.audit_run_id
),
judged AS (
  SELECT r.id, r.run_kind, r.run_state, r.collector_version, r.prompt_set_hash, r.expected_calls,
         p.attempted AS attempted_calls, p.answered AS answered_calls, p.errors AS error_calls,
         r.is_published, r.published_at, r.started_at, r.completed_at,
         p.engines, p.repeats, p.questions_asked, p.questions_matched,
         (
           (p.questions_asked > 0 AND p.questions_matched = p.questions_asked)
           OR EXISTS (
             SELECT 1 FROM canvas_private.ai_history_runs h
              WHERE r.prompt_set_hash IS NOT NULL AND h.prompt_set_hash = r.prompt_set_hash
           )
         ) AS question_set_match
    FROM per_run p
    JOIN command.fmic_audit_runs r ON r.id = p.audit_run_id
)
SELECT j.*,
       (j.run_state IN ('completed', 'partial') AND j.question_set_match AND j.answered_calls > 0) AS counted
  FROM judged j;

CREATE VIEW canvas_private.ai_api_calls AS
 SELECT s.id, s.audit_run_id, s.sim_id, s.category, s.prompt_key, s.prompt_text, s.prompt_kind,
    s.engine, s.model, s.repeat_no, s.attempt_no, s.call_status, s.outcome, s.primary_brand,
    s.winner, s.material_hallucination, s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause, rem.remediation_text, s.error_message,
    s.answer_text, s.citation_urls, s.created_at, r.run_state, r.published_at,
    s.probe_asin, s.probe_asins, s.probe_fender_sku, s.probe_category, s.probe_series,
    s.probe_spec_field, s.probe_expected_value, s.probe_source_url, s.probe_amazon_value,
    s.probe_is_anchor
   FROM command.fmic_ai_simulations s
     JOIN canvas_private.ai_api_runs r ON r.id = s.audit_run_id AND r.counted
     LEFT JOIN command.fmic_ai_remediations rem ON rem.simulation_id = s.id
  WHERE s.engine IN ('openai_api', 'gemini_api', 'claude_api', 'grok_api', 'crescent_api')
    AND s.record_origin IS DISTINCT FROM 'historical_backfill'::text
    AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text;

CREATE VIEW public.canvas_ai_api_runs WITH (security_invoker = false) AS
 SELECT id AS audit_run_id, run_kind, run_state, collector_version, prompt_set_hash, expected_calls,
        attempted_calls, answered_calls, error_calls, is_published, published_at, started_at,
        completed_at, (expected_calls - answered_calls) AS missing_calls,
        'api'::text AS engine_group, engines, repeats, questions_asked, questions_matched,
        question_set_match, counted
   FROM canvas_private.ai_api_runs;

CREATE VIEW public.canvas_ai_api_calls WITH (security_invoker = false) AS
 SELECT id, audit_run_id, 'api_run'::text AS source_table, sim_id, engine, repeat_no, category,
        prompt_text AS prompt, winner,
        (outcome IN ('fender_win', 'competitor_win')) AS is_resolved,
        (material_hallucination = 'confirmed') AS hallucination_flag,
        root_cause, remediation_text AS remediation_patch, answer_text, citation_urls, created_at,
        prompt_key, prompt_kind, model, call_status, outcome, primary_brand, material_hallucination,
        hallucination_evidence, attempt_no, error_message, run_state, published_at,
        'api'::text AS engine_group
   FROM canvas_private.ai_api_calls;

CREATE VIEW public.canvas_ai_api_probes WITH (security_invoker = false) AS
 SELECT c.audit_run_id, c.sim_id, c.prompt_key, c.prompt_text AS prompt, c.engine, c.model,
    c.call_status, c.material_hallucination, c.hallucination_evidence, c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at, c.answer_text, c.created_at,
    c.probe_asin, c.probe_asins, c.probe_fender_sku, c.probe_category, c.probe_series,
    c.probe_spec_field, c.probe_expected_value, c.probe_source_url, c.probe_amazon_value,
    c.probe_is_anchor,
    'api'::text AS engine_group
   FROM canvas_private.ai_api_calls c
     LEFT JOIN command.fmic_ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

CREATE VIEW public.canvas_ai_api_citations WITH (security_invoker = false) AS
 SELECT ci.audit_run_id, ci.sim_id, ci.simulation_id, s.prompt_key, s.prompt_kind, s.category,
        ci.engine, ci.position, ci.url, ci.domain, ci.title,
        'api'::text AS engine_group
   FROM command.fmic_ai_citations ci
   JOIN canvas_private.ai_api_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

DO $$ DECLARE v text; BEGIN
  FOREACH v IN ARRAY ARRAY['ai_api_runs', 'ai_api_calls'] LOOP
    EXECUTE format('ALTER VIEW canvas_private.%I OWNER TO postgres', v);
    EXECUTE format('REVOKE ALL ON TABLE canvas_private.%I FROM PUBLIC, anon, authenticated', v);
  END LOOP;
  FOREACH v IN ARRAY ARRAY['canvas_ai_api_runs', 'canvas_ai_api_calls', 'canvas_ai_api_probes', 'canvas_ai_api_citations'] LOOP
    EXECUTE format('ALTER VIEW public.%I OWNER TO postgres', v);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', v);
  END LOOP;
END $$;

COMMENT ON VIEW public.canvas_ai_api_runs IS 'AI Search API-engine runs (openai_api, gemini_api, claude_api, grok_api, crescent_api) with counts and the battery run rule. Read only.';
COMMENT ON VIEW public.canvas_ai_api_calls IS 'API-engine calls of counted runs, in the columns of canvas_ai_history_calls plus engine_group. Read only.';
COMMENT ON VIEW public.canvas_ai_api_probes IS 'API-engine product fact checks of counted runs, in the columns of canvas_ai_history_probes plus engine_group. Read only.';
COMMENT ON VIEW public.canvas_ai_api_citations IS 'Citations on API-engine calls of counted runs, in the columns of canvas_ai_history_citations plus engine_group. Read only.';

NOTIFY pgrst, 'reload schema';
