-- Worker 20.9. Changes: adds a new read-only view, public.canvas_ai_history_citations_by_run, with
-- the same columns as public.canvas_ai_history_citations. Add-only. The existing view, its grants,
-- and all stored rows stay as they are.
--
-- Why: public.canvas_ai_history_citations joins citations to simulations on the simulation id alone.
-- A run filter therefore narrows only the citations side, and the join reads every simulation in
-- every history run. One run's page took 183 ms and 26,641 buffers. With the run filter on both
-- sides it took 26 ms and 2,619 buffers. This view also joins on audit_run_id, so a filter on
-- audit_run_id reaches both sides. The AI Search tabs were hitting the anon role's 3-second
-- statement timeout.
--
-- Same rows: on 3 Nov 2026 a read-only check found 0 citations whose run differs from their
-- simulation's run and 0 citations without a simulation, so the extra join condition removes nothing.
--
-- Grants match public.canvas_ai_history_citations: SELECT for anon and authenticated, nothing else.
-- The REVOKE clears the write rights Supabase grants by default on new public views.
--
-- Undo (switch the dashboard read back to canvas_ai_history_citations first):
--   DROP VIEW IF EXISTS public.canvas_ai_history_citations_by_run;
--   NOTIFY pgrst, 'reload schema';
--
-- Approved: Brian Magazu, 3 Nov 2026.
-- Applied: not yet

CREATE VIEW public.canvas_ai_history_citations_by_run AS
 SELECT ci.audit_run_id, ci.sim_id, ci.simulation_id, s.prompt_key, s.prompt_kind, s.category,
        ci.engine, ci."position", ci.url, ci.domain, ci.title
   FROM command.fmic_ai_citations ci
   JOIN canvas_private.ai_history_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;

ALTER VIEW public.canvas_ai_history_citations_by_run OWNER TO postgres;

COMMENT ON VIEW public.canvas_ai_history_citations_by_run IS
  'AI Search history citations for per-run reads. Filter on audit_run_id: the join matches citations '
  'to simulations on both simulation id and run, so the filter narrows both sides. Returns the same '
  'rows and columns as public.canvas_ai_history_citations (checked 3 Nov 2026: 0 citations whose run '
  'differs from their simulation''s run, 0 citations without a simulation).';

REVOKE ALL ON public.canvas_ai_history_citations_by_run FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.canvas_ai_history_citations_by_run TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
