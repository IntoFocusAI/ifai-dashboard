-- public.canvas_ai_history_probes (view) — live definition snapshot, do not apply
--   audit_run_id: uuid
--   sim_id: integer
--   prompt_key: text
--   prompt: text
--   engine: character varying
--   model: text
--   call_status: text
--   material_hallucination: text
--   hallucination_evidence: text
--   root_cause: text
--   remediation_text: text
--   verified_claim: text
--   verified_source_url: text
--   verified_at: timestamp with time zone
--   answer_text: text
--   created_at: timestamp with time zone
--   probe_asin: text
--   probe_asins: text[]
--   probe_fender_sku: text
--   probe_category: text
--   probe_series: text
--   probe_spec_field: text
--   probe_expected_value: text
--   probe_source_url: text
--   probe_amazon_value: text
--   probe_is_anchor: boolean
CREATE OR REPLACE VIEW public.canvas_ai_history_probes AS
 SELECT c.audit_run_id,
    c.sim_id,
    c.prompt_key,
    c.prompt_text AS prompt,
    c.engine,
    c.model,
    c.call_status,
    c.material_hallucination,
    c.hallucination_evidence,
    c.root_cause,
    c.remediation_text,
    COALESCE(c.probe_expected_value, f.claim) AS verified_claim,
    COALESCE(c.probe_source_url, f.source_url) AS verified_source_url,
    f.verified_at,
    c.answer_text,
    c.created_at,
    c.probe_asin,
    c.probe_asins,
    c.probe_fender_sku,
    c.probe_category,
    c.probe_series,
    c.probe_spec_field,
    c.probe_expected_value,
    c.probe_source_url,
    c.probe_amazon_value,
    c.probe_is_anchor
   FROM canvas_private.ai_history_calls c
     LEFT JOIN command.fmic_ai_probe_facts f ON f.prompt_key = c.prompt_key
  WHERE c.prompt_kind = 'probe'::text;
