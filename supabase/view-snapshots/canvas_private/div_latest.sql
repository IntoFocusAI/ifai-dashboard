-- canvas_private.div_latest (view) — live definition snapshot, do not apply
--   id: uuid
--   audit_run_id: uuid
--   division: character varying(80)
--   monitored_skus: integer
--   buybox_pct: numeric(5,2)
--   splinter_bundles: integer
--   schema_sync_pct: numeric(5,2)
--   primary_threat: character varying(255)
--   strategic_action: text
--   created_at: timestamp with time zone
--   updated_at: timestamp with time zone
CREATE OR REPLACE VIEW canvas_private.div_latest AS
 SELECT DISTINCT ON (division) id,
    audit_run_id,
    division,
    monitored_skus,
    buybox_pct,
    splinter_bundles,
    schema_sync_pct,
    primary_threat,
    strategic_action,
    created_at,
    updated_at
   FROM command.fmic_division_metrics
  WHERE audit_run_id = (( SELECT d.audit_run_id
           FROM command.fmic_division_metrics d
          ORDER BY d.created_at DESC
         LIMIT 1))
  ORDER BY division, created_at DESC;
