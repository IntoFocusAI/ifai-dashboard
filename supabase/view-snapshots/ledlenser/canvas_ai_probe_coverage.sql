-- ledlenser.canvas_ai_probe_coverage (view) — live definition snapshot, do not apply
--   audit_run_id: uuid
--   cycle_no: integer
--   category: text
--   engine: text
--   models_in_scope: integer
--   models_checked: bigint
--   asins_covered: bigint
--   wrong_answers: bigint
CREATE OR REPLACE VIEW ledlenser.canvas_ai_probe_coverage AS
 SELECT s.audit_run_id,
    ((r.metadata -> 'probe_rotation'::text) ->> 'cycle_no'::text)::integer AS cycle_no,
    COALESCE(s.probe_category, s.category::text) AS category,
    s.engine::text AS engine,
    COALESCE(((r.metadata -> 'probe_rotation'::text) ->> 'in_scope_models'::text)::integer, ( SELECT count(*)::integer AS count
           FROM ledlenser.brand_catalog
          WHERE brand_catalog.sheet_status = 'Complete'::text)) AS models_in_scope,
    count(DISTINCT COALESCE(s.probe_source_url, s.probe_brand_sku, s.prompt_key)) AS models_checked,
    count(DISTINCT COALESCE(a.asin, s.probe_asin, s.prompt_key)) AS asins_covered,
    count(DISTINCT s.id) FILTER (WHERE s.material_hallucination = 'confirmed'::text) AS wrong_answers
   FROM ledlenser.ai_simulations s
     JOIN ledlenser.audit_runs r ON r.id = s.audit_run_id
     LEFT JOIN LATERAL unnest(s.probe_asins) a(asin) ON true
  WHERE s.prompt_kind = 'probe'::text
  GROUP BY s.audit_run_id, (((r.metadata -> 'probe_rotation'::text) ->> 'cycle_no'::text)::integer), (COALESCE(s.probe_category, s.category::text)), (s.engine::text), (COALESCE(((r.metadata -> 'probe_rotation'::text) ->> 'in_scope_models'::text)::integer, ( SELECT count(*)::integer AS count
           FROM ledlenser.brand_catalog
          WHERE brand_catalog.sheet_status = 'Complete'::text)));
