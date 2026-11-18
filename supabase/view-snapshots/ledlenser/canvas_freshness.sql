-- ledlenser.canvas_freshness (view) — live definition snapshot, do not apply
--   job_key: character varying
--   last_run_at: timestamp with time zone
--   cursor_offset: integer
--   updated_at: timestamp with time zone
CREATE OR REPLACE VIEW ledlenser.canvas_freshness AS
 SELECT job_state.job_key,
    job_state.last_run_at,
    job_state.cursor_offset,
    job_state.updated_at
   FROM ledlenser.job_state
UNION ALL
 SELECT 'kpi_recompute'::character varying AS job_key,
    max(brand_kpi_summary.created_at) AS last_run_at,
    NULL::integer AS cursor_offset,
    max(brand_kpi_summary.created_at) AS updated_at
   FROM ledlenser.brand_kpi_summary
UNION ALL
 SELECT 'ai_simulations'::character varying AS job_key,
    c.completed_at AS last_run_at,
    NULL::integer AS cursor_offset,
    c.published_at AS updated_at
   FROM ledlenser_private.ai_current_run c;
