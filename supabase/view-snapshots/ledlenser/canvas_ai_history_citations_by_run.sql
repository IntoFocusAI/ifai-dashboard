-- ledlenser.canvas_ai_history_citations_by_run (view) — live definition snapshot, do not apply
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
CREATE OR REPLACE VIEW ledlenser.canvas_ai_history_citations_by_run AS
 SELECT audit_run_id,
    sim_id,
    simulation_id,
    prompt_key,
    prompt_kind,
    category,
    engine,
    "position",
    url,
    domain,
    title
   FROM ledlenser.canvas_ai_history_citations;
