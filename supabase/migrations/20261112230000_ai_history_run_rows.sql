-- Worker 26.13. Changes: adds one read-only function, public.canvas_ai_history_run_rows(uuid).
-- Add-only. No existing view, table, column, grant, or stored row changes.
--
-- What it returns: one JSON object for one AI Search history run, holding the rows the dashboard
-- already reads for that run from four existing views, with the same columns and the same order:
--   runs       public.canvas_ai_history_runs              (catalog columns plus missing_calls)
--   calls      public.canvas_ai_history_calls             ORDER BY sim_id, id   (no answer_text)
--   probes     public.canvas_ai_history_probes            ORDER BY sim_id       (no answer_text)
--   citations  public.canvas_ai_history_citations_by_run  ORDER BY sim_id, position
-- It reads only through those views, as the caller (SECURITY INVOKER), so it can return nothing the
-- anon role cannot already select. It writes nothing.
--
-- Why: the date-pill window (PR 190) makes every AI figure on the map and Summary read every run in
-- the last 30 days. For Fender that is 10 runs, about 10,000 calls and their citations, read as
-- about 75 pages of at most 1,000 rows, four at a time, each page waiting on the one before it.
-- The AI figures took 18 to 21 s to show on the PR 190 preview. One request per run removes the
-- page chains: the server builds each run's rows in one statement, with no 1,000-row page limit
-- because the result is a single JSON value.
--
-- Not pre-aggregated on purpose: every AI figure is computed in the browser from these rows (prompt
-- roles, brand matching, URL de-duplication, source classes), so returning the rows themselves keeps
-- every figure identical by construction. The answers stay on the server; a drawer reads one answer
-- when it opens. No table, no materialized view, and no refresh schedule.
--
-- Fender only (public schema). Ledlenser keeps its page reads; the dashboard falls back to them
-- whenever this function is not there, so the dashboard works before and after this is applied.
--
-- Cost: one statement per run. The heaviest Fender run has 2,040 calls; its citation pages took
-- about 26 ms of server time per 1,000 rows through canvas_ai_history_citations_by_run (Worker 20.9),
-- so a run should finish well inside the anon role's 3-second statement timeout. Dry-run check:
--   EXPLAIN ANALYZE SELECT public.canvas_ai_history_run_rows('8d6746f6-687a-4ea6-8bda-a92a49971d18');
-- and compare json_array_length of each key with the row counts of the four views for that run.
--
-- Undo (the dashboard falls back to its page reads by itself):
--   DROP FUNCTION IF EXISTS public.canvas_ai_history_run_rows(uuid);
--   NOTIFY pgrst, 'reload schema';
--
-- Approved: Brian Magazu, 12 Nov 2026 (additive, per PM26 brief for Worker 26.13).
-- Applied: not yet. The PM dry-runs and applies it; record the time and who applied it here.

CREATE FUNCTION public.canvas_ai_history_run_rows(p_run_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT json_build_object(
    'runs', COALESCE((
      SELECT json_agg(r)
        FROM (
          SELECT audit_run_id, run_kind, run_state, collector_version, prompt_set_hash, expected_calls,
                 attempted_calls, answered_calls, error_calls, is_published, published_at, started_at,
                 completed_at, missing_calls
            FROM public.canvas_ai_history_runs
           WHERE audit_run_id = p_run_id
        ) r
    ), '[]'::json),
    'calls', COALESCE((
      SELECT json_agg(c ORDER BY c.sim_id, c.id)
        FROM (
          SELECT id, audit_run_id, sim_id, engine, model, category, prompt, prompt_key, prompt_kind,
                 call_status, outcome, primary_brand, material_hallucination, hallucination_evidence,
                 root_cause, remediation_patch, error_message, attempt_no, repeat_no, created_at
            FROM public.canvas_ai_history_calls
           WHERE audit_run_id = p_run_id
        ) c
    ), '[]'::json),
    'probes', COALESCE((
      SELECT json_agg(p ORDER BY p.sim_id)
        FROM (
          SELECT audit_run_id, sim_id, prompt_key, prompt, engine, model, call_status,
                 material_hallucination, hallucination_evidence, verified_claim, verified_source_url,
                 verified_at, created_at, probe_asin, probe_asins, probe_fender_sku, probe_category,
                 probe_series, probe_spec_field, probe_expected_value, probe_source_url,
                 probe_amazon_value, probe_is_anchor
            FROM public.canvas_ai_history_probes
           WHERE audit_run_id = p_run_id
        ) p
    ), '[]'::json),
    'citations', COALESCE((
      SELECT json_agg(ci ORDER BY ci.sim_id, ci."position")
        FROM (
          SELECT audit_run_id, sim_id, simulation_id, prompt_key, prompt_kind, category, engine,
                 "position", url, domain, title
            FROM public.canvas_ai_history_citations_by_run
           WHERE audit_run_id = p_run_id
        ) ci
    ), '[]'::json)
  );
$$;

ALTER FUNCTION public.canvas_ai_history_run_rows(uuid) OWNER TO postgres;

COMMENT ON FUNCTION public.canvas_ai_history_run_rows(uuid) IS
  'One AI Search history run''s rows as one JSON object (runs, calls, probes, citations), read through '
  'the canvas_ai_history_* views as the caller, with the dashboard''s columns and order and without '
  'answer text. Lets the date-pill window read a run in one request instead of page chains.';

REVOKE ALL ON FUNCTION public.canvas_ai_history_run_rows(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_ai_history_run_rows(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
