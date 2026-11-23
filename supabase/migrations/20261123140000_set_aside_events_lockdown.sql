-- 1.6 follow-up: public.canvas_set_aside_events is readable only by staff and members of the
-- client the event belongs to. Anonymous callers read nothing.
--
-- ALTERING (changes an existing view and its permissions), so Brian Watson applies it.
--
-- Found after 20261123130100_client_data_lockdown was applied on 23 Nov 2026: this view reads
-- public.audit_log (a portal table the lockdown leaves alone), so the lockdown did not pick it up,
-- and anon could still read every client's set-aside history (who, when, note). The view runs as
-- its owner, so it bypasses audit_log's portal policy; the filter below is what limits rows.
-- The dashboard does not read this view today (no reference in app/, lib/ or components/).
--
-- Change:
--   1. Same columns and rows as before, plus a filter: staff, or a member of the client whose
--      set_aside_key is the event's client_key (private.can_read_set_aside_client, which includes
--      staff through command.can_read_organization).
--   2. REVOKE ALL from anon and PUBLIC; SELECT for authenticated only.
--
-- Check after applying (first false, second true):
--   select has_table_privilege('anon', 'public.canvas_set_aside_events', 'select'),
--          has_table_privilege('authenticated', 'public.canvas_set_aside_events', 'select');
--
-- Undo: re-create the view without the final "and private.can_read_set_aside_client(...)" line,
--   then: grant select on public.canvas_set_aside_events to anon;

begin;

create or replace view public.canvas_set_aside_events as
  select a.id as event_id,
    a.entity_id as set_aside_id,
    a.occurred_at,
    (a.new_value ->> 'client_key') as client_key,
    (a.new_value ->> 'check_key') as check_key,
    (a.new_value ->> 'entity_key') as entity_key,
    (a.new_value ->> 'status') as status,
    case
      when (a.new_value ->> 'status') = 'reopened' then (a.new_value ->> 'reopened_by_name')
      else (a.new_value ->> 'set_by_name')
    end as actor_name,
    (a.new_value ->> 'reason_code') as reason_code,
    case
      when (a.new_value ->> 'status') = 'reopened' then (a.new_value ->> 'reopen_note')
      else (a.new_value ->> 'note')
    end as note,
    coalesce((a.new_value ->> 'outcome'), 'set_aside') as outcome
  from public.audit_log a
  where a.entity_table = 'issue_set_asides'
    and private.can_read_set_aside_client(a.new_value ->> 'client_key');

revoke all on public.canvas_set_aside_events from anon, public;
grant select on public.canvas_set_aside_events to authenticated;

commit;
