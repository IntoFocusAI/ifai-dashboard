-- public.canvas_ai_engine (view) — live definition snapshot, do not apply
--   engine: character varying
--   total_sims: bigint
--   resolved: bigint
--   fender_wins: bigint
--   fender_win_pct: numeric
--   hallucinations: bigint
CREATE OR REPLACE VIEW public.canvas_ai_engine AS
 SELECT COALESCE(engine, 'unknown'::character varying) AS engine,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text) AS total_sims,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]))) AS resolved,
    count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'fender_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text) AS fender_wins,
    round(100.0 * count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND outcome = 'fender_win'::text AND material_hallucination IS DISTINCT FROM 'confirmed'::text)::numeric / NULLIF(count(*) FILTER (WHERE prompt_kind = 'commercial'::text AND (outcome = ANY (ARRAY['fender_win'::text, 'competitor_win'::text]))), 0)::numeric, 1) AS fender_win_pct,
    count(*) FILTER (WHERE material_hallucination = 'confirmed'::text) AS hallucinations
   FROM canvas_private.ai_current_calls
  GROUP BY (COALESCE(engine, 'unknown'::character varying));
