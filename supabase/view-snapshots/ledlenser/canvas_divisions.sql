-- ledlenser.canvas_divisions (view) — live definition snapshot, do not apply
--   division: character varying(80)
--   monitored_skus: integer
--   buybox_pct: numeric(5,2)
--   splinter_bundles: integer
--   schema_sync_pct: numeric(5,2)
--   primary_threat: character varying(255)
--   strategic_action: text
--   created_at: timestamp with time zone
CREATE OR REPLACE VIEW ledlenser.canvas_divisions AS
 SELECT division,
    monitored_skus,
    buybox_pct,
    splinter_bundles,
    schema_sync_pct,
    primary_threat,
    strategic_action,
    created_at
   FROM ledlenser_private.div_latest;
