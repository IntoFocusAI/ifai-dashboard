-- Worker 20.9. Collector v15 Step 1: two partial indexes for probe reads.
-- Record only; already applied.
-- Applied at 22:14:15 UTC, each statement on its own outside a transaction, because CREATE INDEX
-- CONCURRENTLY can't run inside one. They are not in prod's migration history. The SQL below is
-- copied word for word from section 4 of docs/pending-migrations/collector-v15-step1-applied.md.
--
-- This file is in docs/pending-migrations/, not supabase/migrations/, so supabase db push won't run
-- it. While it stays here no migration repair is needed. If it is moved into supabase/migrations,
-- run this before the next supabase db push:
--   supabase migration repair --status applied 20261103221415
--
-- Changes: adds two partial indexes on command.fmic_ai_simulations. Add-only.
--   idx_fmic_ai_simulations_probe_asin  on probe_asin, only where it is not null
--   idx_fmic_ai_simulations_probe_kind  on audit_run_id, only where prompt_kind = 'probe'
--
-- Why: collector v15 Step 1. The probe views read each run's calls where prompt_kind = 'probe', and
-- probe calls can now be looked up by the listing they checked (probe_asin). Approved by Brian
-- Magazu, 3 Nov 2026, in the collector plan.
--
-- Undo (section 5 of the report). After undoing migration 2's views and before undoing migration 1,
-- run each line on its own, outside a transaction:
--   DROP INDEX CONCURRENTLY IF EXISTS command.idx_fmic_ai_simulations_probe_asin;
--   DROP INDEX CONCURRENTLY IF EXISTS command.idx_fmic_ai_simulations_probe_kind;
--
-- Applied: 3 Nov 2026 22:14:15 UTC on production by Schema-Architect, verified by AEO_Product_Research-FenderTest
-- Record only; already applied.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fmic_ai_simulations_probe_asin
  ON command.fmic_ai_simulations (probe_asin) WHERE probe_asin IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fmic_ai_simulations_probe_kind
  ON command.fmic_ai_simulations (audit_run_id) WHERE prompt_kind = 'probe';
