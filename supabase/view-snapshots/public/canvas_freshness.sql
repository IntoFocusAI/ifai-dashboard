-- public.canvas_freshness (view) — live definition snapshot, do not apply
--   job_key: character varying
--   last_run_at: timestamp with time zone
--   cursor_offset: integer
--   updated_at: timestamp with time zone
CREATE OR REPLACE VIEW public.canvas_freshness AS
 SELECT fmic_job_state.job_key,
    fmic_job_state.last_run_at,
    fmic_job_state.cursor_offset,
    fmic_job_state.updated_at
   FROM command.fmic_job_state
UNION ALL
 SELECT 'kpi_recompute'::character varying AS job_key,
    max(fmic_brand_kpi_summary.created_at) AS last_run_at,
    NULL::integer AS cursor_offset,
    max(fmic_brand_kpi_summary.created_at) AS updated_at
   FROM command.fmic_brand_kpi_summary
UNION ALL
 SELECT 'ai_simulations'::character varying AS job_key,
    c.completed_at AS last_run_at,
    NULL::integer AS cursor_offset,
    c.published_at AS updated_at
   FROM canvas_private.ai_current_run c;
