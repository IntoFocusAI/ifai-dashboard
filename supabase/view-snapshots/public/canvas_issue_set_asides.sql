-- public.canvas_issue_set_asides (view) — live definition snapshot, do not apply
--   id: uuid
--   client_key: text
--   check_key: text
--   check_label: text
--   entity_type: text
--   entity_key: text
--   entity_label: text
--   status: text
--   reason_code: text
--   reason_label: text
--   note: text
--   set_by_name: text
--   set_at: timestamp with time zone
--   reopened_by_name: text
--   reopened_at: timestamp with time zone
--   reopen_note: text
--   updated_at: timestamp with time zone
--   outcome: text
CREATE OR REPLACE VIEW public.canvas_issue_set_asides AS
 SELECT s.id,
    s.client_key,
    s.check_key,
    k.label AS check_label,
    s.entity_type,
    s.entity_key,
    s.entity_label,
    s.status,
    s.reason_code,
    r.label AS reason_label,
    s.note,
    s.set_by_name,
    s.set_at,
    s.reopened_by_name,
    s.reopened_at,
    s.reopen_note,
    s.updated_at,
    s.outcome
   FROM issue_set_asides s
     JOIN set_aside_checks k ON k.check_key = s.check_key
     LEFT JOIN set_aside_reasons r ON r.reason_code = s.reason_code;
