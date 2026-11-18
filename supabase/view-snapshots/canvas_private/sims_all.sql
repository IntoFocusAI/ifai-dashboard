-- canvas_private.sims_all (view) — live definition snapshot, do not apply
--   id: uuid
--   audit_run_id: uuid
--   sim_id: integer
--   category: character varying(60)
--   prompt: text
--   winner: character varying(100)
--   hallucination_flag: boolean
--   root_cause: text
--   remediation_patch: text
--   created_at: timestamp with time zone
--   answer_text: text
--   citation_urls: text
--   engine: character varying
--   repeat_no: integer
--   source_table: text
CREATE OR REPLACE VIEW canvas_private.sims_all AS
 SELECT l.id,
    l.audit_run_id,
    l.sim_id,
    l.category,
    l.prompt,
    l.winner,
    l.hallucination_flag,
    l.root_cause,
    l.remediation_patch,
    l.created_at,
    l.answer_text,
    l.citation_urls,
    l.engine,
    l.repeat_no,
    'live'::text AS source_table
   FROM command.fmic_ai_simulations l
UNION ALL
 SELECT a.id,
    a.audit_run_id,
    a.sim_id,
    a.category,
    a.prompt,
    a.winner,
    a.hallucination_flag,
    a.root_cause,
    a.remediation_patch,
    a.created_at,
    NULL::text AS answer_text,
    NULL::text AS citation_urls,
    a.engine,
    a.repeat_no,
    'run1_archive'::text AS source_table
   FROM command.fmic_ai_simulations_run1_archive a
  WHERE NOT (EXISTS ( SELECT 1
           FROM command.fmic_ai_simulations l
          WHERE l.audit_run_id = a.audit_run_id AND l.sim_id = a.sim_id));
