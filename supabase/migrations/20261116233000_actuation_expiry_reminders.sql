-- Worker 28.1: SC-03 Actuation expiry reminders to Slack #operations (decisions 77, 78, 96).
--
-- What it adds
--   One table and three functions for the daily reminder job (.github/workflows/actuation-reminders.yml,
--   scripts/send-actuation-reminders.ts). Nothing existing is altered or deleted; no table, view,
--   column, or grant on an existing object changes.
--
--   public.actuation_expiry_reminders_sent   The sent-log: one row per client, factor, expiry date and
--                                            reminder threshold (30, 14 or 3 days) already posted,
--                                            with the days left at the time and when. Keyed on the
--                                            expiry date, so a program verified again (a new expiry)
--                                            gets a fresh set of reminders, and a re-run or a late
--                                            run never posts the same reminder twice.
--
--   RLS on with no policies, and no grant to anon or authenticated: nobody reads or writes it
--   directly. Every read and write goes through these functions, which run as their owner
--   (SECURITY DEFINER, fixed search_path). EXECUTE on each is revoked from public, anon and
--   authenticated, and granted to nobody here. The job's login gets EXECUTE in a separate file,
--   20261116234000_actuation_reminder_grants.sql, which is a permissions change (Brian Watson).
--
--   public.actuation_expiry_reminder_candidates()
--     Every in-place P1 and P2 program (owner, evidence link, verification date, expiry after
--     today: the same test as public.actuation_basis) with client key, factor, owner name, expiry
--     date, and the thresholds already sent for that expiry date. No links, notes or domains.
--     The job decides in code which reminder is due (lib/fender-canvas/actuation-reminders.ts).
--   public.actuation_expiry_reminder_claim(p_client_key, p_factor, p_expires_on, p_threshold_days,
--     p_days_left) returns boolean
--     Records a reminder before it is posted. True when this call recorded it, false when a row was
--     already there (an earlier run sent it), so two runs at once cannot both post it.
--   public.actuation_expiry_reminder_release(p_client_key, p_factor, p_expires_on, p_threshold_days)
--     Removes that one claim when Slack refused the post, so the next run tries again. Only rows
--     claimed in the last hour can be removed, so a sent reminder's record stays.
--
-- How to undo
--   DROP FUNCTION public.actuation_expiry_reminder_release(text, text, date, integer);
--   DROP FUNCTION public.actuation_expiry_reminder_claim(text, text, date, integer, integer);
--   DROP FUNCTION public.actuation_expiry_reminder_candidates();
--   DROP TABLE public.actuation_expiry_reminders_sent;
--   Undo 20261116234000_actuation_reminder_grants.sql first if it was applied. Dropping the table
--   deletes the record of reminders already sent (a data change: Brian Watson); the next run would
--   then post the current reminder for each program once more.
--
-- Requires: 20261116220000_actuation_records (public.actuation_programs).
--
-- Status: NOT APPLIED. Additive; waits for Brian Magazu's approval, then the PM applies it, and the
-- pull request records when and by whom.

create table if not exists public.actuation_expiry_reminders_sent (
  client_key text not null references public.set_aside_clients(client_key),
  factor text not null check (factor in ('P1', 'P2')),
  expires_on date not null,
  threshold_days integer not null check (threshold_days in (30, 14, 3)),
  days_left integer not null check (days_left between 1 and 30),
  sent_at timestamptz not null default now(),
  primary key (client_key, factor, expires_on, threshold_days)
);

alter table public.actuation_expiry_reminders_sent enable row level security;
revoke all on table public.actuation_expiry_reminders_sent from public, anon, authenticated;

create or replace function public.actuation_expiry_reminder_candidates()
returns table (
  client_key text,
  factor text,
  owner_name text,
  expires_on date,
  sent_thresholds integer[]
)
language sql
stable
security definer
set search_path = public
as $$
  select p.client_key, p.factor, btrim(p.owner_name), p.expires_on,
    coalesce(
      (select array_agg(s.threshold_days order by s.threshold_days)
       from public.actuation_expiry_reminders_sent s
       where s.client_key = p.client_key and s.factor = p.factor and s.expires_on = p.expires_on),
      '{}'::integer[]
    )
  from public.actuation_programs p
  where nullif(btrim(p.owner_name), '') is not null
    and nullif(btrim(p.evidence_url), '') is not null
    and p.verified_on is not null
    and p.expires_on > current_date
  order by p.expires_on, p.client_key, p.factor;
$$;

create or replace function public.actuation_expiry_reminder_claim(
  p_client_key text,
  p_factor text,
  p_expires_on date,
  p_threshold_days integer,
  p_days_left integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.actuation_expiry_reminders_sent (client_key, factor, expires_on, threshold_days, days_left)
  values (p_client_key, p_factor, p_expires_on, p_threshold_days, p_days_left)
  on conflict do nothing;
  return found;
end;
$$;

create or replace function public.actuation_expiry_reminder_release(
  p_client_key text,
  p_factor text,
  p_expires_on date,
  p_threshold_days integer
)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.actuation_expiry_reminders_sent s
  where s.client_key = p_client_key
    and s.factor = p_factor
    and s.expires_on = p_expires_on
    and s.threshold_days = p_threshold_days
    and s.sent_at > now() - interval '1 hour';
$$;

revoke execute on function public.actuation_expiry_reminder_candidates() from public, anon, authenticated;
revoke execute on function public.actuation_expiry_reminder_claim(text, text, date, integer, integer) from public, anon, authenticated;
revoke execute on function public.actuation_expiry_reminder_release(text, text, date, integer) from public, anon, authenticated;
