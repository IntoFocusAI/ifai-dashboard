-- public.canvas_ai_api_citations (view) — live definition snapshot, do not apply
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
--   engine_group: text
CREATE OR REPLACE VIEW public.canvas_ai_api_citations AS
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
    ci.title,
    'api'::text AS engine_group
   FROM command.fmic_ai_citations ci
     JOIN canvas_private.ai_api_calls s ON s.id = ci.simulation_id AND s.audit_run_id = ci.audit_run_id;
