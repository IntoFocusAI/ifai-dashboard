-- ledlenser.canvas_ai_engine (view) — live definition snapshot, do not apply
--   engine: character varying
--   total_sims: bigint
--   resolved: bigint
--   brand_wins: bigint
--   brand_win_pct: numeric
--   hallucinations: bigint
CREATE OR REPLACE VIEW ledlenser.canvas_ai_engine AS
 SELECT COALESCE(engine, 'unknown'::character varying) AS engine,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text) AS total_sims,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]))) AS resolved,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'brand_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text) AS brand_wins,
    round(100.0 * count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'brand_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text)::numeric / NULLIF(count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]))), 0)::numeric, 1) AS brand_win_pct,
    count(*) FILTER (WHERE material_hallucination = 'confirmed'::text) AS hallucinations
   FROM ledlenser_private.ai_current_calls
  GROUP BY (COALESCE(engine, 'unknown'::character varying));
