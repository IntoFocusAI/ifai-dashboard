-- canvas_private.ai_current_calls (view) — live definition snapshot, do not apply
--   id: uuid
--   audit_run_id: uuid
--   sim_id: integer
--   category: character varying(60)
--   prompt_key: text
--   prompt_text: text
--   prompt_kind: text
--   engine: character varying
--   model: text
--   repeat_no: integer
--   attempt_no: integer
--   call_status: text
--   outcome: text
--   primary_brand: text
--   winner: character varying(100)
--   material_hallucination: text
--   hallucination_evidence: text
--   root_cause: text
--   remediation_text: text
--   error_message: text
--   answer_text: text
--   citation_urls: text
--   created_at: timestamp with time zone
--   run_state: text
--   published_at: timestamp with time zone
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
CREATE OR REPLACE VIEW canvas_private.ai_current_calls AS
 SELECT s.id,
    s.audit_run_id,
    s.sim_id,
    s.category,
    s.prompt_key,
    s.prompt_text,
    s.prompt_kind,
    s.engine,
    s.model,
    s.repeat_no,
    s.attempt_no,
    s.call_status,
    s.outcome,
    s.primary_brand,
    s.winner,
    s.material_hallucination,
    s.hallucination_evidence,
    NULLIF(s.root_cause, ''::text) AS root_cause,
    rem.remediation_text,
    s.error_message,
    s.answer_text,
    s.citation_urls,
    s.created_at,
    c.run_state,
    c.published_at,
    s.probe_asin,
    s.probe_asins,
    s.probe_fender_sku,
    s.probe_category,
    s.probe_series,
    s.probe_spec_field,
    s.probe_expected_value,
    s.probe_source_url,
    s.probe_amazon_value,
    s.probe_is_anchor
   FROM command.fmic_ai_simulations s
     JOIN canvas_private.ai_current_run c ON c.id = s.audit_run_id
     LEFT JOIN command.fmic_ai_remediations rem ON rem.simulation_id = s.id;
