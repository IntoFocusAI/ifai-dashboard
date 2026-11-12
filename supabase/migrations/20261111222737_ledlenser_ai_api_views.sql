-- Ledlenser AI Search API engines: the same read-only views Fender got on 4 Nov (migration
-- 20261104160000_ai_search_api_engine_views.sql), in Ledlenser's own schema.
--
-- Adds six new views. Nothing that exists today is replaced, altered, or dropped, and no row is
-- written. Each statement is CREATE VIEW, not CREATE OR REPLACE, so it stops on a name that is
-- already taken.
--   ledlenser_private.ai_api_runs      one row per audit run with API-engine calls, and the run rule
--   ledlenser_private.ai_api_calls     the API-engine calls of the runs that count
--   ledlenser.canvas_ai_api_runs       every API-engine run, its counts, and whether it counts
--   ledlenser.canvas_ai_api_calls      the columns of ledlenser.canvas_ai_history_calls, plus engine_group
--   ledlenser.canvas_ai_api_probes     the columns of ledlenser.canvas_ai_history_probes, plus engine_group
--   ledlenser.canvas_ai_api_citations  the columns of ledlenser.canvas_ai_history_citations, plus engine_group
--
-- Why: Ledlenser's API job (Toolbelt, collector ledlenser_subchat_v1) has written completed runs
-- with all five API engines to ledlenser.audit_runs and ledlenser.ai_simulations since 4 Nov, but
-- Ledlenser had no API views, so the dashboard never showed them.
--
-- Run rule: the same as Fender's (Brian Watson, 4 Nov 2026). A run counts when it finished as
-- completed or partial, every question it asked (prompt_key and exact prompt_text) was asked by a
-- run in ledlenser_private.ai_history_runs (or its prompt_set_hash equals one of theirs), and it has
-- answered calls. No answer-rate minimum. Ledlenser's names follow its schema: brand_win instead of
-- fender_win, probe_brand_sku instead of probe_fender_sku (the dashboard maps them in
-- lib/client/column-aliases.ts).
--
-- Grants: every view is REVOKE ALL from PUBLIC, anon, and authenticated first; the four
-- ledlenser.canvas_ai_api_* views then GRANT SELECT to anon and authenticated only. The
-- ledlenser_private views get no grant to anon or authenticated.
--
-- Undo (drops only what this file adds):
--   DROP VIEW IF EXISTS ledlenser.canvas_ai_api_citations;
--   DROP VIEW IF EXISTS ledlenser.canvas_ai_api_probes;
--   DROP VIEW IF EXISTS ledlenser.canvas_ai_api_calls;
--   DROP VIEW IF EXISTS ledlenser.canvas_ai_api_runs;
--   DROP VIEW IF EXISTS ledlenser_private.ai_api_calls;
--   DROP VIEW IF EXISTS ledlenser_private.ai_api_runs;
--   NOTIFY pgrst, 'reload schema';
--
-- Additive. Applied to production only after Brian Magazu approves (AGENTS.md, Database changes).
-- Approved: Brian Magazu (per Brian Watson, 11 Nov 2026).
-- Applied: production only, 11 Nov 2026 22:27 UTC, by Claude Code for Brian Watson, recorded as version
-- 20261111222737 (this file was 20261111220000 in the pull request). The mirror and claude copies have no
-- ledlenser schema. Verified: 5 runs counted by the view (the dashboard leaves out the 4 Nov 5-question
-- test run), 1,748 API calls, and the anon key reads ledlenser.canvas_ai_api_runs.

CREATE VIEW ledlenser_private.ai_api_runs AS
WITH api_calls AS (
  SELECT s.audit_run_id, s.engine::text AS engine, s.call_status, s.repeat_no,
         coalesce(s.prompt_key, '') || E'\x1f' || coalesce(s.prompt_text, '') AS question,
         s.prompt_key, s.prompt_text
    FROM ledlenser.ai_simulations s
   WHERE s.engine IN ('openai_api', 'gemini_api', 'claude_api', 'grok_api', 'crescent_api')
     AND s.audit_run_id IS NOT NULL
     AND s.record_origin IS DISTINCT FROM 'historical_backfill'
     AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'
),
battery_questions AS (
  SELECT DISTINCT b.prompt_key, b.prompt_text
    FROM ledlenser.ai_simulations b
    JOIN ledlenser_private.ai_history_runs h ON h.id = b.audit_run_id
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
             SELECT 1 FROM ledlenser_private.ai_history_runs h
              WHERE r.prompt_set_hash IS NOT NULL AND h.prompt_set_hash = r.prompt_set_hash
           )
         ) AS question_set_match
    FROM per_run p
    JOIN ledlenser.audit_runs r ON r.id = p.audit_run_id
)
SELECT j.*,
       (j.run_state IN ('completed', 'partial') AND j.question_set_match AND j.answered_calls > 0) AS counted
  FROM judged j;

CREATE VIEW ledlenser_private.ai_api_calls AS
 SELECT s.id, s.audit_run_id, s.sim_id, s.category, s.prompt_key, s.prompt_text, s.prompt_kind,
    s.engine, s.model, s.repeat_no, s.attempt_no, s.call_status, s.outcome, s.primary_brand,
    s.winner, s.material_hallucination, s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause, rem.remediation_text, s.error_message,
    s.answer_text, s.citation_urls, s.created_at, r.run_state, r.published_at,
    s.probe_asin, s.probe_asins, s.probe_brand_sku, s.probe_category, s.probe_series,
    s.probe_spec_field, s.probe_expected_value, s.probe_source_url, s.probe_amazon_value,
    s.probe_is_anchor
   FROM ledlenser.ai_simulations s
     JOIN ledlenser_private.ai_api_runs r ON r.id = s.audit_run_id AND r.counted
     LEFT JOIN ledlenser.ai_remediations rem ON rem.simulation_id = s.id
  WHERE s.engine IN ('openai_api', 'gemini_api', 'claude_api', 'grok_api', 'crescent_api')
    AND s.record_origin IS DISTINCT FROM 'historical_backfill'::text
    AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text;

CREATE VIEW ledlenser.canvas_ai_api_runs WITH (security_invoker = false) AS
 SELECT id AS audit_run_id, run_kind, run_state, collector_version, prompt_set_hash, expected_calls,
        attempted_calls, answered_calls, error_calls, is_published, published_at, started_at,
        completed_at, (expected_calls - answered_calls) AS missing_calls,
        'api'::text AS engine_group, engines, repeats, questions_asked, questions_matched,
        question_set_match, counted
   FROM ledlenser_private.ai_api_runs;

CREATE VIEW ledlenser.canvas_ai_api_calls WITH (security_invoker = false) AS
 SELECT id, audit_run_id, 'api_run'::text AS source_table, sim_id, engine, repeat_no, category,
        prompt_text AS prompt, winner,
        (outcome IN ('brand_win', 'competitor_win')) AS is_resolved,
        (material_hallucination = 'confirmed') AS hallucination_flag,
        root_cause, remediation_text AS remediation_patch, answer_text, citation_urls, created_at,
        prompt_key, prompt_kind, model, call_status, outcome, primary_brand, material_hallucination,
        hallucination_evidence, attempt_no, error_message, run_state, published_at,
        'api'::text AS engine_group
   FROM ledlenser_private.ai_api_calls;

CREATE VIEW ledlenser.canvas_ai_api_probes WITH (security_invoker = false) AS
 SELECT c.audit_run_id, c.sim_id, c.prompt_key, c.prompt_text AS prompt, c.engine, c.model,
    c.call_status, c.material_hallucination, c.hallucination_evidence, c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at, c.answer_text, c.created_at,
    c.probe_asin, c.probe_asins, c.probe_brand_sku, c.probe_category, c.probe_series,
    c.probe_spec_field, c.probe_expected_value, c.probe_source_url, c.probe_amazon_value,
    c.probe_is_anchor,
    'api'::text AS engine_group
   FROM ledlenser_private.ai_api_calls c
     LEFT JOIN ledlenser.ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;

CREATE VIEW ledlenser.canvas_ai_api_citations WITH (security_invoker = false) AS
 SELECT ci.audit_run_id, ci.sim_id, ci.simulation_id, s.prompt_key, s.prompt_kind, s.category,
        ci.engine, ci.position, ci.url, ci.domain, ci.title,
        'api'::text AS engine_group
   FROM ledlenser.ai_citations ci
   JOIN ledlenser_private.ai_api_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

DO $$ DECLARE v text; BEGIN
  FOREACH v IN ARRAY ARRAY['ai_api_runs', 'ai_api_calls'] LOOP
    EXECUTE format('ALTER VIEW ledlenser_private.%I OWNER TO postgres', v);
    EXECUTE format('REVOKE ALL ON TABLE ledlenser_private.%I FROM PUBLIC, anon, authenticated', v);
  END LOOP;
  FOREACH v IN ARRAY ARRAY['canvas_ai_api_runs', 'canvas_ai_api_calls', 'canvas_ai_api_probes', 'canvas_ai_api_citations'] LOOP
    EXECUTE format('ALTER VIEW ledlenser.%I OWNER TO postgres', v);
    EXECUTE format('REVOKE ALL ON TABLE ledlenser.%I FROM PUBLIC, anon, authenticated', v);
    EXECUTE format('GRANT SELECT ON TABLE ledlenser.%I TO anon, authenticated', v);
  END LOOP;
END $$;

COMMENT ON VIEW ledlenser.canvas_ai_api_runs IS 'AI Search API-engine runs (openai_api, gemini_api, claude_api, grok_api, crescent_api) with counts and the battery run rule. Read only.';
COMMENT ON VIEW ledlenser.canvas_ai_api_calls IS 'API-engine calls of counted runs, in the columns of canvas_ai_history_calls plus engine_group. Read only.';
COMMENT ON VIEW ledlenser.canvas_ai_api_probes IS 'API-engine product fact checks of counted runs, in the columns of canvas_ai_history_probes plus engine_group. Read only.';
COMMENT ON VIEW ledlenser.canvas_ai_api_citations IS 'Citations on API-engine calls of counted runs, in the columns of canvas_ai_history_citations plus engine_group. Read only.';

NOTIFY pgrst, 'reload schema';
