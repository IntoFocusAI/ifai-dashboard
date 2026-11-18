-- ledlenser_private.ai_history_runs (view) — live definition snapshot, do not apply
--   id: uuid
--   run_kind: text
--   run_state: text
--   collector_version: text
--   prompt_set_hash: text
--   expected_calls: integer
--   attempted_calls: integer
--   answered_calls: integer
--   error_calls: integer
--   is_published: boolean
--   published_at: timestamp with time zone
--   started_at: timestamp with time zone
--   completed_at: timestamp with time zone
CREATE OR REPLACE VIEW ledlenser_private.ai_history_runs AS
 SELECT r.id,
    r.run_kind,
    r.run_state,
    r.collector_version,
    r.prompt_set_hash,
    r.expected_calls,
    c.attempted AS attempted_calls,
    c.answered AS answered_calls,
    c.errors AS error_calls,
    r.is_published,
    r.published_at,
    r.started_at,
    r.completed_at
   FROM ledlenser.audit_runs r
     JOIN LATERAL ( SELECT count(*)::integer AS attempted,
            count(*) FILTER (WHERE s.call_status = 'answered'::text)::integer AS answered,
            count(*) FILTER (WHERE s.call_status = 'error'::text)::integer AS errors
           FROM ledlenser.ai_simulations s
          WHERE s.audit_run_id = r.id) c ON true
  WHERE r.run_kind = 'ai_simulation'::text AND r.is_published AND (r.run_state = ANY (ARRAY['completed'::text, 'partial'::text])) AND r.prompt_set_hash IS NOT NULL AND r.expected_calls IS NOT NULL AND r.attempted_calls = r.expected_calls AND r.published_at IS NOT NULL AND NOT (EXISTS ( SELECT 1
           FROM ledlenser.ai_simulations s
          WHERE s.audit_run_id = r.id AND (s.record_origin = 'historical_backfill'::text OR s.material_hallucination = 'historical_unverified'::text)));
