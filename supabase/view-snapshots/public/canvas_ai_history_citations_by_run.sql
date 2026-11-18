-- public.canvas_ai_history_citations_by_run (view) — live definition snapshot, do not apply
--   audit_run_id: uuid
--   sim_id: integer
--   simulation_id: uuid
--   prompt_key: text
--   prompt_kind: text
--   category: character varying(60)
--   engine: text
--   position: integer
--   url: text
--   domain: text
--   title: text
CREATE OR REPLACE VIEW public.canvas_ai_history_citations_by_run AS
 SELECT ci.audit_run_id,
    ci.sim_id,
    ci.simulation_id,
    s.prompt_key,
    s.prompt_kind,
    s.category,
    ci.engine,
    ci."position",
    ci.url,
    ci.domain,
    ci.title
   FROM command.fmic_ai_citations ci
     JOIN canvas_private.ai_history_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;
