-- ledlenser.canvas_competitor_sov (view) — live definition snapshot, do not apply
--   category: character varying
--   competitor: character varying(100)
--   wins: bigint
--   category_resolved: bigint
--   sov_pct: numeric
CREATE OR REPLACE VIEW ledlenser.canvas_competitor_sov AS
 WITH r AS (
         SELECT ai_current_calls.category,
                CASE
                    WHEN ai_current_calls.outcome = 'brand_win'::text THEN ( SELECT client_config.display_name
                       FROM ledlenser.client_config
                     LIMIT 1)
                    ELSE ai_current_calls.primary_brand
                END::character varying(100) AS winner
           FROM ledlenser_private.ai_current_calls
          WHERE ai_current_calls.prompt_kind = 'commercial'::text AND (ai_current_calls.outcome = ANY (ARRAY['brand_win'::text, 'competitor_win'::text]))
        ), g AS (
         SELECT COALESCE(r.category, 'all'::character varying) AS category,
            r.winner AS competitor,
            count(*) AS wins
           FROM r
          GROUP BY GROUPING SETS ((r.category, r.winner), (r.winner))
        ), t AS (
         SELECT COALESCE(r.category, 'all'::character varying) AS category,
            count(*) AS resolved
           FROM r
          GROUP BY GROUPING SETS ((r.category), ())
        )
 SELECT g.category,
    g.competitor,
    g.wins,
    t.resolved AS category_resolved,
    round(100.0 * g.wins::numeric / NULLIF(t.resolved, 0)::numeric, 1) AS sov_pct
   FROM g
     JOIN t USING (category);
