-- Worker 18.5: server-side set-aside for dashboard checks.
--
-- A set-aside says "we looked at this issue and it should not count against the
-- client" for one check on one entity (a queue item, an ASIN, or a page URL).
-- One row per (client, check, entity). Reopen flips the same row back; setting
-- it aside again flips it forward. Every change lands in public.audit_log.
--
-- The dashboard has no login yet, so the person is a typed name. When a session
-- exists, auth.uid() is recorded beside it.
--
-- Writes go only through the two SECURITY DEFINER functions below. The tables
-- have RLS on and no policies, so the publishable key cannot write them directly.

-- Clients -------------------------------------------------------------------

create table if not exists public.set_aside_clients (
  client_key text primary key check (client_key ~ '^[a-z0-9-]{2,40}$'),
  label text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.set_aside_clients (client_key, label)
values ('fmic', 'Fender Musical Instruments Corporation')
on conflict (client_key) do nothing;

-- Checks (the "tag" a set-aside applies to) ---------------------------------

create table if not exists public.set_aside_checks (
  check_key text primary key check (check_key ~ '^[a-z0-9_]{2,60}$'),
  label text not null,
  entity_type text not null check (entity_type in ('queue_item', 'asin', 'url')),
  surface text not null,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

insert into public.set_aside_checks (check_key, label, entity_type, surface, sort_order) values
  ('command_center_queue', 'Command Center priority', 'queue_item', 'Command Center', 10),
  ('amazon_specs', 'Amazon Specs: missing Amazon fields', 'asin', 'AI Readiness · Amazon Specs', 20),
  ('brand_site_specs', 'Brand-Site Specs: missing page fields', 'url', 'AI Readiness · Brand-Site Specs', 30),
  ('listing_content', 'Listing content gaps', 'asin', 'AI Readiness · Listing Content', 40),
  ('buybox_suppression', 'Buy Box suppression', 'asin', 'Ecommerce · Suppressed', 50),
  ('map_pricing', 'MAP pricing below floor', 'asin', 'Ecommerce · MAP', 60),
  ('out_of_stock', 'Out of stock', 'asin', 'Ecommerce · Out of Stock', 70)
on conflict (check_key) do nothing;

-- Reasons (placeholder list; edit rows, not code) ----------------------------

create table if not exists public.set_aside_reasons (
  reason_code text primary key check (reason_code ~ '^[a-z0-9_]{2,60}$'),
  label text not null,
  description text,
  -- NULL = offered on every check.
  check_keys text[],
  requires_note boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 100
);

insert into public.set_aside_reasons (reason_code, label, description, check_keys, requires_note, sort_order) values
  ('discontinued', 'Discontinued', 'The product is discontinued or being phased out.', null, false, 10),
  ('no_better_category', 'No better category exists', 'The marketplace has no closer category or field for this product.', null, false, 20),
  ('approved_exception', 'Approved exception', 'The brand approved this case, for example a MAP promotion.', null, true, 30),
  ('not_sold_on_channel', 'Not sold on this channel', 'The brand does not sell this item here on purpose.', null, false, 40),
  ('fix_in_progress', 'Fix already in progress', 'Someone is already working on it outside the dashboard.', null, true, 50),
  ('other', 'Other', 'Anything else. Say why in the note.', null, true, 90)
on conflict (reason_code) do nothing;

-- Set-asides ----------------------------------------------------------------

create table if not exists public.issue_set_asides (
  id uuid primary key default gen_random_uuid(),
  client_key text not null references public.set_aside_clients(client_key),
  check_key text not null references public.set_aside_checks(check_key),
  entity_type text not null check (entity_type in ('queue_item', 'asin', 'url')),
  entity_key text not null check (char_length(entity_key) between 1 and 500),
  entity_label text check (entity_label is null or char_length(entity_label) <= 300),
  status text not null default 'active' check (status in ('active', 'reopened')),
  reason_code text not null references public.set_aside_reasons(reason_code),
  note text check (note is null or char_length(note) <= 500),
  set_by_name text not null check (char_length(set_by_name) between 2 and 80),
  set_by_user_id uuid references auth.users(id) on delete set null,
  set_at timestamptz not null default now(),
  reopened_by_name text check (reopened_by_name is null or char_length(reopened_by_name) between 2 and 80),
  reopened_by_user_id uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  reopen_note text check (reopen_note is null or char_length(reopen_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_key, check_key, entity_key)
);

create index if not exists issue_set_asides_check_idx
  on public.issue_set_asides (client_key, check_key, status);

alter table public.issue_set_asides enable row level security;
alter table public.set_aside_clients enable row level security;
alter table public.set_aside_checks enable row level security;
alter table public.set_aside_reasons enable row level security;

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

drop trigger if exists issue_set_asides_audit on public.issue_set_asides;
create trigger issue_set_asides_audit
  after insert or update on public.issue_set_asides
  for each row execute function private.write_set_aside_audit();

-- Writes --------------------------------------------------------------------

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
  if not exists (select 1 from public.set_aside_clients where client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;

  select * into v_check from public.set_aside_checks where check_key = p_check_key;
  if not found then
    raise exception 'Unknown check.' using errcode = '22023';
  end if;

  select * into v_reason from public.set_aside_reasons
  where reason_code = p_reason_code and is_active;
  if not found or (v_reason.check_keys is not null and not (p_check_key = any (v_reason.check_keys))) then
    raise exception 'Pick a reason from the list.' using errcode = '22023';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Enter your name (2 to 80 characters).' using errcode = '22023';
  end if;
  if v_reason.requires_note and v_note is null then
    raise exception 'This reason needs a note.' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Keep the note under 500 characters.' using errcode = '22023';
  end if;

  if (v_check.entity_type = 'asin' and v_key !~ '^[A-Z0-9]{10}$')
     or (v_check.entity_type = 'queue_item' and v_key !~ '^[a-z0-9-]{2,60}$')
     or (v_check.entity_type = 'url' and (v_key !~ '^https?://' or char_length(v_key) > 500)) then
    raise exception 'That item id does not fit this check.' using errcode = '22023';
  end if;

  insert into public.issue_set_asides as s
    (client_key, check_key, entity_type, entity_key, entity_label, status,
     reason_code, note, set_by_name, set_by_user_id, set_at)
  values
    (p_client_key, p_check_key, v_check.entity_type, v_key, v_label, 'active',
     p_reason_code, v_note, v_name, auth.uid(), now())
  on conflict (client_key, check_key, entity_key) do update
    set status = 'active',
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
    raise exception 'That set-aside is not active.' using errcode = '22023';
  end if;
  return v_row;
end;
$$;

revoke all on function public.set_aside_issue(text, text, text, text, text, text, text) from public;
revoke all on function public.reopen_set_aside(uuid, text, text) from public;
grant execute on function public.set_aside_issue(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.reopen_set_aside(uuid, text, text) to anon, authenticated;
revoke all on function private.write_set_aside_audit() from public;

-- Reads ---------------------------------------------------------------------

create or replace view public.canvas_issue_set_asides
with (security_invoker = false) as
select
  s.id, s.client_key, s.check_key, k.label as check_label, s.entity_type, s.entity_key,
  s.entity_label, s.status, s.reason_code, r.label as reason_label, s.note,
  s.set_by_name, s.set_at, s.reopened_by_name, s.reopened_at, s.reopen_note, s.updated_at
from public.issue_set_asides s
join public.set_aside_checks k on k.check_key = s.check_key
join public.set_aside_reasons r on r.reason_code = s.reason_code;

create or replace view public.canvas_set_aside_reasons
with (security_invoker = false) as
select reason_code, label, description, check_keys, requires_note, sort_order
from public.set_aside_reasons
where is_active;

-- Who did what, oldest first, from the audit log. Names only; no user ids.
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
       else a.new_value ->> 'note' end as note
from public.audit_log a
where a.entity_table = 'issue_set_asides';

grant select on public.canvas_issue_set_asides, public.canvas_set_aside_reasons,
  public.canvas_set_aside_events to anon, authenticated;

notify pgrst, 'reload schema';
