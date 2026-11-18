-- ledlenser.canvas_ai_history_outcome_counts (view) — live definition snapshot, do not apply
--   audit_run_id: uuid
--   engine: character varying
--   prompt_kind: text
--   prompt_key: text
--   prompt_text: text
--   category: character varying(60)
--   call_status: text
--   outcome: text
--   material_hallucination: text
--   primary_brand: text
--   calls: bigint
CREATE OR REPLACE VIEW ledlenser.canvas_ai_history_outcome_counts AS
 SELECT audit_run_id,
    engine,
    prompt_kind,
    prompt_key,
    prompt AS prompt_text,
    category,
    call_status,
    outcome,
    material_hallucination,
    primary_brand,
    count(*) AS calls
   FROM ledlenser.canvas_ai_history_calls
  GROUP BY audit_run_id, engine, prompt_kind, prompt_key, prompt, category, call_status, outcome, material_hallucination, primary_brand;
