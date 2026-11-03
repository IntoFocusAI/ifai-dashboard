-- Worker 20.9. Collector v15 Step 1, migration 1 of 2: probe schema, two fact rows, battery config.
-- Record only; already applied.
-- The SQL below is copied word for word from section 4 of
-- docs/pending-migrations/collector-v15-step1-applied.md. Prod's migration history has it as
-- version 20261103221322.
--
-- Changes:
--   command.fmic_ai_simulations  adds 10 columns: probe_asin, probe_asins, probe_fender_sku,
--                                probe_category, probe_series, probe_spec_field,
--                                probe_expected_value, probe_source_url, probe_amazon_value,
--                                probe_is_anchor
--   command.fmic_ai_prompts      adds probe_mode (default 'fixed') and probe_slots
--   command.fmic_ai_probe_plan   new table. Row-level security on, service_role only, no rows yet.
--   command.fmic_ai_probe_facts  updates verified_by and verified_at on the existing p17 and p33 rows
--   command.fmic_job_state       upserts the ai_battery_config row: repeats 3, rotation off, probes
--                                p17, p18, p19, p33, p34 on, collector_version v11, collector_build v15
--
-- Why: collector v15 Step 1. Each probe call can record the listing, SKU, spec field, and expected
-- value it checked, and the battery runs 3 repeats with rotation off. Approved by Brian Magazu,
-- 3 Nov 2026 (collector plan 2:44 PM ET, 3 repeats 3:22 PM ET, split order 3:28 PM ET).
--
-- Undo (section 5 of the report). Undo migration 2's views and then the two probe indexes first;
-- the columns can't be dropped while the views use them.
--   DROP TABLE IF EXISTS command.fmic_ai_probe_plan;
--   Drop probe_mode and probe_slots from command.fmic_ai_prompts.
--   Drop the 10 probe_* columns from command.fmic_ai_simulations.
--   In command.fmic_ai_probe_facts, set verified_by for p17 and p33 back to
--   'Worker 15 from the fender.com product page; pending Brian review'. The report does not give
--   the earlier verified_at values.
--   Put the ai_battery_config row in command.fmic_job_state back to its earlier staged values.
--   Schema-Architect did not record the earlier JSON. AEO_Product_Research-FenderTest can rebuild it
--   from the plan delegation.
--
-- Applied: 3 Nov 2026 22:13:22 UTC on production by Schema-Architect, verified by AEO_Product_Research-FenderTest
-- Record only; already applied.

ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_asin text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_asins text[];
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_fender_sku text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_category text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_series text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_spec_field text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_expected_value text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_source_url text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_amazon_value text;
ALTER TABLE command.fmic_ai_simulations ADD COLUMN IF NOT EXISTS probe_is_anchor boolean;

ALTER TABLE command.fmic_ai_prompts ADD COLUMN IF NOT EXISTS probe_mode text DEFAULT 'fixed';
ALTER TABLE command.fmic_ai_prompts ADD COLUMN IF NOT EXISTS probe_slots integer;

CREATE TABLE IF NOT EXISTS command.fmic_ai_probe_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id uuid REFERENCES command.fmic_audit_runs(id) ON DELETE CASCADE,
  prompt_key text NOT NULL,
  repeat_no integer NOT NULL,
  asin text,
  asins text[],
  sku text,
  category text,
  series text,
  spec_field text,
  question text,
  expected_value text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fmic_ai_probe_plan_run_prompt_repeat_uq UNIQUE (audit_run_id, prompt_key, repeat_no)
);
ALTER TABLE command.fmic_ai_probe_plan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON command.fmic_ai_probe_plan FROM anon, authenticated;
GRANT ALL ON command.fmic_ai_probe_plan TO service_role;

UPDATE command.fmic_ai_probe_facts
SET verified_by = 'Brian Magazu (reviewed 2026-11-03)', verified_at = now()
WHERE prompt_key IN ('p17', 'p33');

INSERT INTO command.fmic_job_state (job_key, cursor_offset, last_run_at, extra, updated_at)
VALUES ('ai_battery_config', 0, NULL, jsonb_build_object(
    'status', 'active_step1',
    'repeats', 3,
    'rotation', jsonb_build_object('active', false, 'status', 'off', 'asks_per_engine', 1,
      'in_scope_models', 180, 'products_per_run', 90, 'runs_per_full_cycle', 2),
    'perplexity_settings', jsonb_build_object('batch_size', 1, 'concurrency', 1,
      'backoff_seconds', jsonb_build_array(30, 60, 120), 'min_budget_seconds', 90,
      'error_pattern', 'Provider failed the job'),
    'related_plan', 'dlg_c094456d-0511-42ff-bc93-7cffbdecc073',
    'anchor_probes', jsonb_build_array('p17', 'p33'),
    'active_probes', jsonb_build_array('p17', 'p18', 'p19', 'p33', 'p34'),
    'repeats_scope', 'all 34 active prompts at 3 repeats per engine',
    'correlation_id', 'dlg_c094456d-0511-42ff-bc93-7cffbdecc073',
    'repeats_source', 'Brian Magazu via PM20, 2026-11-03 15:22 ET; confirmed in dlg_c094456d-0511-42ff-bc93-7cffbdecc073',
    'engines_current', jsonb_build_array('chatgpt', 'perplexity', 'gemini'),
    'collector_version', 'v11',
    'collector_build', 'v15',
    'rotation_apply_order', 'rotation OFF in Step 1; p17, p18, p19, p33, p34 stay on; p35-p37 inactive',
    'engines_planned_later', jsonb_build_array('claude', 'grok', 'crescent'),
    'shopping_prompt_count', 29,
    'probe_prompt_count', 5,
    'total_prompt_count', 34,
    'approved_ceiling_calls_per_run', 1470,
    'expected_calls_per_run_3_engines', jsonb_build_object('total', 306, 'shopping', 261, 'probes', 45)
  ), now())
ON CONFLICT (job_key) DO UPDATE SET extra = EXCLUDED.extra, updated_at = now();
