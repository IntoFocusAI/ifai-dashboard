-- Not applied. Requires Brian Watson.
--
-- Worker 20.9. This file sits in docs/pending-migrations/, not supabase/migrations/, because the
-- Supabase CLI (supabase db push) and Supabase's GitHub integration apply every file in
-- supabase/migrations. If Brian Watson approves, move it there unchanged and record who applied it
-- and when.
--
-- Changes: replaces the definition of the existing view public.canvas_ai_history_citations so the
-- join also matches on audit_run_id. Columns, owner, and grants stay the same. This alters an
-- existing view, so under the database rule in AGENTS.md it waits for Brian Watson.
--
-- Why: the current join is ON s.id = ci.simulation_id only. A run filter therefore narrows only the
-- citations side, and the join reads every simulation in every history run. One run's page took
-- 183 ms and 26,641 buffers. With the run filter on both sides it took 26 ms and 2,619 buffers.
-- Same rows: on 3 Nov 2026 a read-only check found 0 citations whose run differs from their
-- simulation's run and 0 citations without a simulation.
-- Without this change the dashboard can read public.canvas_ai_history_citations_by_run instead
-- (supabase/migrations/20261103214459_ai_history_citations_by_run.sql).
--
-- Undo (restores the current definition from 20261014190000_ai_search_history_views.sql):
--   CREATE OR REPLACE VIEW public.canvas_ai_history_citations WITH (security_invoker = false) AS
--    SELECT ci.audit_run_id, ci.sim_id, ci.simulation_id, s.prompt_key, s.prompt_kind, s.category, ci.engine, ci.position, ci.url, ci.domain, ci.title
--      FROM command.fmic_ai_citations ci
--      JOIN canvas_private.ai_history_calls s ON s.id = ci.simulation_id;
--   NOTIFY pgrst, 'reload schema';
--
-- Applied: not yet

CREATE OR REPLACE VIEW public.canvas_ai_history_citations WITH (security_invoker = false) AS
 SELECT ci.audit_run_id, ci.sim_id, ci.simulation_id, s.prompt_key, s.prompt_kind, s.category, ci.engine, ci.position, ci.url, ci.domain, ci.title
   FROM command.fmic_ai_citations ci
   JOIN canvas_private.ai_history_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

NOTIFY pgrst, 'reload schema';
