-- Worker 20.9. Run this file on its own, outside a transaction.
-- CREATE INDEX CONCURRENTLY cannot run inside BEGIN/COMMIT, so do not combine it with other
-- statements or apply it through a runner that wraps the file in a transaction.
--
-- Changes: adds one partial index on command.fmic_ai_simulations (audit_run_id), covering only the
-- historical_backfill and historical_unverified rows. Add-only. No rows, views, or grants change.
--
-- Why: canvas_private.ai_history_runs checks every run for backfill rows (NOT EXISTS ... WHERE
-- s.audit_run_id = r.id AND (record_origin = 'historical_backfill' OR material_hallucination =
-- 'historical_unverified')). That check scans about 2,000 buffers per run on each AI Search history
-- read, and those reads hit the anon role's 3-second statement timeout. The index predicate matches
-- that check exactly, so the planner can answer it from the index.
--
-- Undo: DROP INDEX CONCURRENTLY IF EXISTS command.fmic_ai_simulations_hist_excl_idx;
-- If the build is interrupted it leaves an invalid index that IF NOT EXISTS will then skip. Run the
-- undo and apply this file again.
--
-- Approved: Brian Magazu, 3 Nov 2026.
-- Applied: not yet

CREATE INDEX CONCURRENTLY IF NOT EXISTS fmic_ai_simulations_hist_excl_idx
  ON command.fmic_ai_simulations (audit_run_id)
  WHERE record_origin = 'historical_backfill' OR material_hallucination = 'historical_unverified';
