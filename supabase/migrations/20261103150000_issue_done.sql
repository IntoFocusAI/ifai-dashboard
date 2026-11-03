-- Worker 18.5: Done is its own status beside Set aside.
--
-- Done      = the issue was fixed or handled. Needs a name; the note is optional.
-- Set aside = come back to review it later, or ignore it on purpose for a stated
--             reason. Needs a reason and a name.
--
-- Both live in the same row per (client, check, entity), so an item is either
-- open, done, or set aside on one check, never two at once. Reopen works on
-- both and is logged the same way.

alter table public.issue_set_asides
  add column if not exists outcome text not null default 'set_aside'
    check (outcome in ('set_aside', 'done'));

alter table public.issue_set_asides alter column reason_code drop not null;

alter table public.issue_set_asides drop constraint if exists issue_set_asides_reason_needed;
alter table public.issue_set_asides
  add constraint issue_set_asides_reason_needed
  check (outcome = 'done' or reason_code is not null);

insert into public.set_aside_reasons (reason_code, label, description, check_keys, requires_note, sort_order) values
  ('review_later', 'Come back to review', 'Not ready to decide. Someone needs to look at this again.', null, false, 5)
on conflict (reason_code) do nothing;

-- Audit ---------------------------------------------------------------------

create or replace function private.write_set_aside_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  why text;
begin
  select c.organization_id into org_id
  from public.set_aside_clients c
  where c.client_key = new.client_key;

  if new.status = 'reopened' then
    why := 'reopened' || coalesce(': ' || new.reopen_note, '');
  elsif new.outcome = 'done' then
    why := 'done' || coalesce(': ' || new.note, '');
  else
    why := 'set aside: ' || new.reason_code || coalesce(' · ' || new.note, '');
  end if;

  insert into public.audit_log
    (organization_id, actor_user_id, entity_table, entity_id, action, previous_value, new_value, reason)
  values
    (org_id, auth.uid(), 'issue_set_asides', new.id, tg_op,
     case when tg_op = 'UPDATE' then to_jsonb(old) end,
     to_jsonb(new),
     why);
  return new;
end;
$$;

-- Shared checks for both writes ----------------------------------------------

create or replace function private.check_issue_input(
  p_client_key text,
  p_check_key text,
  p_entity_key text,
  p_name text,
  p_note text
)
returns public.set_aside_checks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check public.set_aside_checks;
  v_key text := btrim(coalesce(p_entity_key, ''));
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not exists (select 1 from public.set_aside_clients where client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  select * into v_check from public.set_aside_checks where check_key = p_check_key;
  if not found then
    raise exception 'Unknown check.' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your name (2 to 80 characters).' using errcode = '22023';
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;
  if (v_check.entity_type = 'asin' and v_key !~ '^[A-Z0-9]{10}$')
     or (v_check.entity_type = 'queue_item' and v_key !~ '^[a-z0-9-]{2,60}$')
     or (v_check.entity_type = 'url' and (v_key !~ '^https?://' or char_length(v_key) > 500)) then
    raise exception 'That item id does not fit this check.' using errcode = '22023';
  end if;
  return v_check;
end;
$$;

revoke all on function private.check_issue_input(text, text, text, text, text) from public;

-- Set aside -----------------------------------------------------------------

create or replace function public.set_aside_issue(
  p_client_key text,
  p_check_key text,
  p_entity_key text,
  p_reason_code text,
  p_name text,
  p_note text default null,
  p_entity_label text default null
)
returns public.issue_set_asides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check public.set_aside_checks;
  v_reason public.set_aside_reasons;
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_key text := btrim(coalesce(p_entity_key, ''));
  v_label text := nullif(left(btrim(coalesce(p_entity_label, '')), 300), '');
  v_row public.issue_set_asides;
begin
  v_check := private.check_issue_input(p_client_key, p_check_key, v_key, v_name, v_note);

  select * into v_reason from public.set_aside_reasons
  where reason_code = p_reason_code and is_active;
  if not found or (v_reason.check_keys is not null and not (p_check_key = any (v_reason.check_keys))) then
    raise exception 'Pick a reason from the list.' using errcode = '22023';
  end if;
  if v_reason.requires_note and v_note is null then
    raise exception 'This reason needs a note.' using errcode = '22023';
  end if;

  insert into public.issue_set_asides as s
    (client_key, check_key, entity_type, entity_key, entity_label, status, outcome,
     reason_code, note, set_by_name, set_by_user_id, set_at)
  values
    (p_client_key, p_check_key, v_check.entity_type, v_key, v_label, 'active', 'set_aside',
     p_reason_code, v_note, v_name, auth.uid(), now())
  on conflict (client_key, check_key, entity_key) do update
    set status = 'active',
        outcome = 'set_aside',
        entity_label = coalesce(excluded.entity_label, s.entity_label),
        reason_code = excluded.reason_code,
        note = excluded.note,
        set_by_name = excluded.set_by_name,
        set_by_user_id = excluded.set_by_user_id,
        set_at = excluded.set_at,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- Done ----------------------------------------------------------------------

create or replace function public.mark_issue_done(
  p_client_key text,
  p_check_key text,
  p_entity_key text,
  p_name text,
  p_note text default null,
  p_entity_label text default null
)
returns public.issue_set_asides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check public.set_aside_checks;
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_key text := btrim(coalesce(p_entity_key, ''));
  v_label text := nullif(left(btrim(coalesce(p_entity_label, '')), 300), '');
  v_row public.issue_set_asides;
begin
  v_check := private.check_issue_input(p_client_key, p_check_key, v_key, v_name, v_note);

  insert into public.issue_set_asides as s
    (client_key, check_key, entity_type, entity_key, entity_label, status, outcome,
     reason_code, note, set_by_name, set_by_user_id, set_at)
  values
    (p_client_key, p_check_key, v_check.entity_type, v_key, v_label, 'active', 'done',
     null, v_note, v_name, auth.uid(), now())
  on conflict (client_key, check_key, entity_key) do update
    set status = 'active',
        outcome = 'done',
        entity_label = coalesce(excluded.entity_label, s.entity_label),
        reason_code = null,
        note = excluded.note,
        set_by_name = excluded.set_by_name,
        set_by_user_id = excluded.set_by_user_id,
        set_at = excluded.set_at,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.mark_issue_done(text, text, text, text, text, text) from public;
grant execute on function public.mark_issue_done(text, text, text, text, text, text) to anon, authenticated;

-- Reopen: same function, message covers both outcomes ------------------------

create or replace function public.reopen_set_aside(
  p_id uuid,
  p_name text,
  p_note text default null
)
returns public.issue_set_asides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_row public.issue_set_asides;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your name (2 to 80 characters).' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;

  update public.issue_set_asides
     set status = 'reopened',
         reopened_by_name = v_name,
         reopened_by_user_id = auth.uid(),
         reopened_at = now(),
         reopen_note = v_note,
         updated_at = now()
   where id = p_id and status = 'active'
  returning * into v_row;

  if not found then
    raise exception 'That item is not done or set aside.' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

-- Reads: outcome added at the end; Done rows have no reason ------------------

create or replace view public.canvas_issue_set_asides
with (security_invoker = false) as
select
  s.id, s.client_key, s.check_key, k.label as check_label, s.entity_type, s.entity_key,
  s.entity_label, s.status, s.reason_code, r.label as reason_label, s.note,
  s.set_by_name, s.set_at, s.reopened_by_name, s.reopened_at, s.reopen_note, s.updated_at,
  s.outcome
from public.issue_set_asides s
join public.set_aside_checks k on k.check_key = s.check_key
left join public.set_aside_reasons r on r.reason_code = s.reason_code;

create or replace view public.canvas_set_aside_events
with (security_invoker = false) as
select
  a.id as event_id,
  a.entity_id as set_aside_id,
  a.occurred_at,
  a.new_value ->> 'client_key' as client_key,
  a.new_value ->> 'check_key' as check_key,
  a.new_value ->> 'entity_key' as entity_key,
  a.new_value ->> 'status' as status,
  case when a.new_value ->> 'status' = 'reopened'
       then a.new_value ->> 'reopened_by_name'
       else a.new_value ->> 'set_by_name' end as actor_name,
  a.new_value ->> 'reason_code' as reason_code,
  case when a.new_value ->> 'status' = 'reopened'
       then a.new_value ->> 'reopen_note'
       else a.new_value ->> 'note' end as note,
  coalesce(a.new_value ->> 'outcome', 'set_aside') as outcome
from public.audit_log a
where a.entity_table = 'issue_set_asides';

grant select on public.canvas_issue_set_asides, public.canvas_set_aside_events to anon, authenticated;

notify pgrst, 'reload schema';
