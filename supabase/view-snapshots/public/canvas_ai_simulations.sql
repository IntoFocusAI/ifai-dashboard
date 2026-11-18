-- public.canvas_ai_simulations (view) — live definition snapshot, do not apply
--   id: uuid
--   audit_run_id: uuid
--   source_table: text
--   sim_id: integer
--   engine: character varying
--   repeat_no: integer
--   category: character varying(60)
--   prompt: text
--   winner: character varying(100)
--   is_resolved: boolean
--   hallucination_flag: boolean
--   root_cause: text
--   remediation_patch: text
--   answer_text: text
--   citation_urls: text
--   created_at: timestamp with time zone
--   prompt_key: text
--   prompt_kind: text
--   model: text
--   call_status: text
--   outcome: text
--   primary_brand: text
--   material_hallucination: text
--   hallucination_evidence: text
--   attempt_no: integer
--   error_message: text
--   run_state: text
--   published_at: timestamp with time zone
CREATE OR REPLACE VIEW public.canvas_ai_simulations AS
 SELECT id,
    audit_run_id,
    'current_run'::text AS source_table,
    sim_id,
    engine,
    repeat_no,
    category,
    prompt_text AS prompt,
    winner,
    outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]) AS is_resolved,
    material_hallucination = 'confirmed'::text AS hallucination_flag,
    root_cause,
    remediation_text AS remediation_patch,
    answer_text,
    citation_urls,
    created_at,
    prompt_key,
    prompt_kind,
    model,
    call_status,
    outcome,
    primary_brand,
    material_hallucination,
    hallucination_evidence,
    attempt_no,
    error_message,
    run_state,
    published_at
   FROM canvas_private.ai_current_calls;
