-- public.canvas_ai_api_runs (view) — live definition snapshot, do not apply
--   audit_run_id: uuid
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
--   missing_calls: integer
--   engine_group: text
--   engines: text[]
--   repeats: integer
--   questions_asked: integer
--   questions_matched: integer
--   question_set_match: boolean
--   counted: boolean
CREATE OR REPLACE VIEW public.canvas_ai_api_runs AS
 SELECT id AS audit_run_id,
    run_kind,
    run_state,
    collector_version,
    prompt_set_hash,
    expected_calls,
    attempted_calls,
    answered_calls,
    error_calls,
    is_published,
    published_at,
    started_at,
    completed_at,
    expected_calls - answered_calls AS missing_calls,
    'api'::text AS engine_group,
    engines,
    repeats,
    questions_asked,
    questions_matched,
    question_set_match,
    counted
   FROM canvas_private.ai_api_runs;
