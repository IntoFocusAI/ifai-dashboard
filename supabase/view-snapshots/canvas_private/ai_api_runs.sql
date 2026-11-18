-- canvas_private.ai_api_runs (view) — live definition snapshot, do not apply
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
--   engines: text[]
--   repeats: integer
--   questions_asked: integer
--   questions_matched: integer
--   question_set_match: boolean
--   counted: boolean
CREATE OR REPLACE VIEW canvas_private.ai_api_runs AS
 WITH api_calls AS (
         SELECT s.audit_run_id,
            s.engine::text AS engine,
            s.call_status,
            s.repeat_no,
            (COALESCE(s.prompt_key, ''::text) || ''::text) || COALESCE(s.prompt_text, ''::text) AS question,
            s.prompt_key,
            s.prompt_text
           FROM command.fmic_ai_simulations s
          WHERE (s.engine::text = ANY (ARRAY['openai_api'::character varying, 'gemini_api'::character varying, 'claude_api'::character varying, 'grok_api'::character varying, 'crescent_api'::character varying]::text[])) AND s.audit_run_id IS NOT NULL AND s.record_origin IS DISTINCT FROM 'historical_backfill'::text AND s.material_hallucination IS DISTINCT FROM 'historical_unverified'::text
        ), battery_questions AS (
         SELECT DISTINCT b.prompt_key,
            b.prompt_text
           FROM command.fmic_ai_simulations b
             JOIN canvas_private.ai_history_runs h ON h.id = b.audit_run_id
          WHERE b.prompt_key IS NOT NULL
        ), per_run AS (
         SELECT c.audit_run_id,
            count(*)::integer AS attempted,
            count(*) FILTER (WHERE c.call_status = 'answered'::text)::integer AS answered,
            count(*) FILTER (WHERE c.call_status = 'error'::text)::integer AS errors,
            count(DISTINCT c.question)::integer AS questions_asked,
            count(DISTINCT c.question) FILTER (WHERE bq.prompt_key IS NOT NULL)::integer AS questions_matched,
            array_agg(DISTINCT c.engine ORDER BY c.engine) AS engines,
            max(c.repeat_no) AS repeats
           FROM api_calls c
             LEFT JOIN battery_questions bq ON bq.prompt_key = c.prompt_key AND bq.prompt_text = c.prompt_text
          GROUP BY c.audit_run_id
        ), judged AS (
         SELECT r.id,
            r.run_kind,
            r.run_state,
            r.collector_version,
            r.prompt_set_hash,
            r.expected_calls,
            p.attempted AS attempted_calls,
            p.answered AS answered_calls,
            p.errors AS error_calls,
            r.is_published,
            r.published_at,
            r.started_at,
            r.completed_at,
            p.engines,
            p.repeats,
            p.questions_asked,
            p.questions_matched,
            p.questions_asked > 0 AND p.questions_matched = p.questions_asked OR (EXISTS ( SELECT 1
                   FROM canvas_private.ai_history_runs h
                  WHERE r.prompt_set_hash IS NOT NULL AND h.prompt_set_hash = r.prompt_set_hash)) AS question_set_match
           FROM per_run p
             JOIN command.fmic_audit_runs r ON r.id = p.audit_run_id
        )
 SELECT id,
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
    engines,
    repeats,
    questions_asked,
    questions_matched,
    question_set_match,
    (run_state = ANY (ARRAY['completed'::text, 'partial'::text])) AND question_set_match AND answered_calls > 0 AS counted
   FROM judged j;
