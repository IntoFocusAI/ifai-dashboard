# Collector v15 Step 1, as applied to production on 3 Nov 2026

Report from AEO_Product_Research-FenderTest (applied by Schema-Architect, verified by AEO_Product_Research-FenderTest), relayed by PM20. Source for the migration log files Worker 20.9 commits. Approved by Brian Magazu on 3 Nov 2026 (collector plan 2:44 PM ET, 3 repeats 3:22 PM ET, split order 3:28 PM ET).

Step 1 is live on prod. Schema-Architect applied it, and I checked the results against prod myself.

## 1. Time applied (UTC, 2026-11-03)
| Part | Time |
|---|---|
| Schema migration | 22:13:22 |
| Views migration | 22:13:53 |
| Two indexes (run separately, outside a transaction) | 22:14:15 |

Run 8d6746f6 is still the current published run. Step 1 was applied after it published at 21:31:28.

## What I checked on prod
| Check | Result |
|---|---|
| Migration history | Both new versions are recorded, right after `20261103214459` |
| Indexes | Both new indexes are valid. `fmic_ai_simulations_hist_excl_idx` (from earlier today) is still valid |
| Probes | p17, p18, p19, p33 and p34 are on, with `probe_mode = 'fixed'` |
| p35 to p37 | Not activated. They don't exist in `fmic_ai_prompts` yet, so nothing can turn them on by accident |
| Battery config (`ai_battery_config`) | rotation = off, repeats = 3, collector_version = v11, collector_build = v15 |
| New columns and views | All 10 probe columns exist on `fmic_ai_simulations`. All 5 views exist |
| History view filter | Unchanged |

Expected calls per run with 3 engines: 306 (261 shopping, 45 probes). The approved ceiling is 1,470.

Perplexity settings: batch size 1, concurrency 1, backoff of 30, 60 and 120 seconds, and a 90-second minimum budget.

## 2. Names as created
**New columns on `command.fmic_ai_simulations`:**
- `probe_asin` (text)
- `probe_asins` (text[])
- `probe_fender_sku` (text)
- `probe_category` (text)
- `probe_series` (text)
- `probe_spec_field` (text)
- `probe_expected_value` (text)
- `probe_source_url` (text)
- `probe_amazon_value` (text)
- `probe_is_anchor` (boolean)

**New columns on `command.fmic_ai_prompts`:**
- `probe_mode` (text, default 'fixed')
- `probe_slots` (integer)

**New table:** `command.fmic_ai_probe_plan`. Row-level security is on, and only service_role can read or write it. It has no rows yet.

**Views updated** (the probe columns were added at the end; no existing column was renamed or retyped):
- `canvas_private.ai_current_calls`
- `canvas_private.ai_history_calls`
- `public.canvas_ai_probes`
- `public.canvas_ai_history_probes`

**New view:** `public.canvas_ai_probe_coverage`. Read access is granted to anon and authenticated.

**New indexes:**
- `command.idx_fmic_ai_simulations_probe_asin`: on `probe_asin`, only where it is not null
- `command.idx_fmic_ai_simulations_probe_kind`: on `audit_run_id`, only where `prompt_kind = 'probe'`

## 3. Sample queries and rows
```sql
SELECT audit_run_id, prompt_key, prompt, verified_claim, verified_source_url,
       probe_asin, probe_expected_value, probe_is_anchor
FROM public.canvas_ai_probes LIMIT 1;
```
Result:

```
8d6746f6-687a-4ea6-8bda-a92a49971d18 | p33 | What is the scale length of a Fender Jaguar | Fender Jaguar scale length is 24 inches (610 mm), shorter than the 25.5 inch Fender standard. | https://www.fender.com/articles/behind-the-scenes/from-surf-to-shoegaze-a-history-of-the-jaguar | null | null | null
```

The `probe_*` values are null because run 8d6746f6 ran before the v15 build. When they're empty, `verified_claim` and `verified_source_url` come from `fmic_ai_probe_facts` instead.

```sql
SELECT audit_run_id, cycle_no, category, engine, models_in_scope,
       models_checked, asins_covered, wrong_answers
FROM public.canvas_ai_probe_coverage LIMIT 1;
```
Result:

```
00eb8680-5c36-48d3-9c6d-2c73e1977508 | null | hallucinations | chatgpt | 180 | 2 | 2 | 0
```

## 4. Exact SQL applied to prod
**Migration 1: `20261103221322_ai_search_v15_probe_schema.sql`**
```sql
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
```

**Migration 2: `20261103221353_ai_search_v15_probe_views.sql`**
```sql
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
```

**Indexes, run on their own outside a transaction** (not in the migration history):
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fmic_ai_simulations_probe_asin
  ON command.fmic_ai_simulations (probe_asin) WHERE probe_asin IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fmic_ai_simulations_probe_kind
  ON command.fmic_ai_simulations (audit_run_id) WHERE prompt_kind = 'probe';
```

## 5. Undo notes
Undo in this order: views first, then indexes, then schema. The new columns can't be dropped while the views still use them.

1. **Views:**
   - Run `DROP VIEW IF EXISTS public.canvas_ai_probe_coverage;`
   - Recreate the other four views with their definitions from before today. To change a view's columns you have to drop it and recreate it; `CREATE OR REPLACE` won't do it.
   - Finish with `NOTIFY pgrst, 'reload schema';`
   - The older definitions are in migrations `20261103214459` and earlier.
2. **Indexes:** run each line on its own, outside a transaction:
   - `DROP INDEX CONCURRENTLY IF EXISTS command.idx_fmic_ai_simulations_probe_asin;`
   - `DROP INDEX CONCURRENTLY IF EXISTS command.idx_fmic_ai_simulations_probe_kind;`
3. **Schema:**
   - Run `DROP TABLE IF EXISTS command.fmic_ai_probe_plan;`
   - Drop `probe_mode` and `probe_slots` from `fmic_ai_prompts`.
   - Drop the 10 `probe_*` columns from `fmic_ai_simulations`.
4. **Data:**
   - In `fmic_ai_probe_facts`, set `verified_by` for p17 and p33 back to `'Worker 15 from the fender.com product page; pending Brian review'`.
   - Put the `ai_battery_config` row in `fmic_job_state` back to its earlier staged values. Schema-Architect didn't record the exact earlier JSON; I can rebuild it from the plan delegation if you need it.

## 6. Migration-history versions on prod
These are the two files for the dashboard worker to commit to `supabase/migrations`:

| File | Version |
|---|---|
| `20261103221322_ai_search_v15_probe_schema.sql` | `20261103221322` |
| `20261103221353_ai_search_v15_probe_views.sql` | `20261103221353` |

The two indexes aren't in the migration history because they ran outside a transaction, the same way `fmic_ai_simulations_hist_excl_idx` did. If you want the repo files to match prod exactly, commit them as a separate note or file that Supabase won't run as a migration.

**Not yet confirmed:** the `probe_*` columns will stay empty until the collector actually writes `metadata.collector_build = v15` and fills them on the next run. Checking the first v15 run is the way to confirm the collector side.