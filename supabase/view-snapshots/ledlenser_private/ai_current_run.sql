-- ledlenser_private.ai_current_run (view) — live definition snapshot, do not apply
--   id: uuid
--   run_state: text
--   collector_version: text
--   prompt_set_hash: text
--   expected_calls: integer
--   attempted_calls: integer
--   answered_calls: integer
--   error_calls: integer
--   started_at: timestamp with time zone
--   completed_at: timestamp with time zone
--   published_at: timestamp with time zone
CREATE OR REPLACE VIEW ledlenser_private.ai_current_run AS
 SELECT id,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    started_at,
    completed_at,
    published_at
   FROM ledlenser.audit_runs r
  WHERE is_published AND run_kind = 'ai_simulation'::text
  ORDER BY published_at DESC, id DESC
 LIMIT 1;
