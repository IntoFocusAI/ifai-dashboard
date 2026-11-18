-- public.canvas_set_aside_events (view) — live definition snapshot, do not apply
--   event_id: bigint
--   set_aside_id: uuid
--   occurred_at: timestamp with time zone
--   client_key: text
--   check_key: text
--   entity_key: text
--   status: text
--   actor_name: text
--   reason_code: text
--   note: text
--   outcome: text
CREATE OR REPLACE VIEW public.canvas_set_aside_events AS
 SELECT id AS event_id,
    entity_id AS set_aside_id,
    occurred_at,
    new_value ->> 'client_key'::text AS client_key,
    new_value ->> 'check_key'::text AS check_key,
    new_value ->> 'entity_key'::text AS entity_key,
    new_value ->> 'status'::text AS status,
        CASE
            WHEN (new_value ->> 'status'::text) = 'reopened'::text THEN new_value ->> 'reopened_by_name'::text
            ELSE new_value ->> 'set_by_name'::text
        END AS actor_name,
    new_value ->> 'reason_code'::text AS reason_code,
        CASE
            WHEN (new_value ->> 'status'::text) = 'reopened'::text THEN new_value ->> 'reopen_note'::text
            ELSE new_value ->> 'note'::text
        END AS note,
    COALESCE(new_value ->> 'outcome'::text, 'set_aside'::text) AS outcome
   FROM audit_log a
  WHERE entity_table = 'issue_set_asides'::text;
