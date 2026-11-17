-- Worker 27.6: weekly score history for Summary -> Performance (decision 94, FDD H-07).
--
-- What it changes
--   Adds one table and one function. Nothing existing is altered or deleted; no table, view,
--   column, or grant on an existing object changes.
--
--   public.canvas_score_snapshots
--     One row per client per week: client_key ('fmic', 'ledlenser'), week_start (the Monday of
--     the saved week, UTC), saved_at, consensus_score, foundation_score, commerce_score,
--     actuation_score (numeric 0 to 100, null when that score had no figure; AI Actuation stays
--     null until it is scored), and inputs (jsonb: the shares, weights, coverage, and reads each
--     score was computed from, with the commit that computed them). unique (client_key,
--     week_start), so a second save in the same week replaces that week's row.
--     RLS is on. anon and authenticated may SELECT (one select policy, using true) and nothing
--     else: every default grant is revoked first and SELECT granted back, as
--     20261104215427_canvas_set_aside_views_select_only does for the set-aside views. The
--     dashboard reads it with the publishable key, filtered by client_key.
--
--   public.canvas_score_snapshot_save(p_client_key text, p_week_start date,
--       p_consensus numeric, p_foundation numeric, p_commerce numeric, p_actuation numeric,
--       p_inputs jsonb) returns public.canvas_score_snapshots
--     Insert or update of one (client_key, week_start) row of that table, and nothing else.
--     SECURITY DEFINER with an empty search_path. EXECUTE is revoked from public, anon, and
--     authenticated and granted to service_role. The weekly GitHub Actions job
--     (.github/workflows/score-snapshots.yml) calls it through the repository secret
--     SCORE_SNAPSHOT_DB_URL; the role in that URL needs EXECUTE (the owner has it).
--
-- How to undo
--   DROP FUNCTION public.canvas_score_snapshot_save(text, date, numeric, numeric, numeric, numeric, jsonb);
--   DROP TABLE public.canvas_score_snapshots;
--   NOTIFY pgrst, 'reload schema';
--   Dropping the table deletes every saved week. The dashboard then reads the history as absent
--   and the chart section shows nothing; the score cards are unchanged.
--
-- Status: APPLIED to production 16 Nov 2026 by PM27 (Brian Magazu approved).

create table if not exists public.canvas_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_key text not null check (client_key ~ '^[a-z0-9-]{2,40}$'),
  week_start date not null check (extract(isodow from week_start) = 1),
  saved_at timestamptz not null default now(),
  consensus_score numeric(6, 2) check (consensus_score between 0 and 100),
  foundation_score numeric(6, 2) check (foundation_score between 0 and 100),
  commerce_score numeric(6, 2) check (commerce_score between 0 and 100),
  actuation_score numeric(6, 2) check (actuation_score between 0 and 100),
  inputs jsonb not null default '{}'::jsonb,
  unique (client_key, week_start)
);

comment on table public.canvas_score_snapshots is
  'Weekly AI Consensus, Foundation, Commerce, and Actuation scores per client (decision 94). Written only by public.canvas_score_snapshot_save.';

alter table public.canvas_score_snapshots enable row level security;

create policy canvas_score_snapshots_read
  on public.canvas_score_snapshots
  for select
  to anon, authenticated
  using (true);

revoke all on public.canvas_score_snapshots from anon, authenticated;
grant select on public.canvas_score_snapshots to anon, authenticated;

create or replace function public.canvas_score_snapshot_save(
  p_client_key text,
  p_week_start date,
  p_consensus numeric,
  p_foundation numeric,
  p_commerce numeric,
  p_actuation numeric,
  p_inputs jsonb
)
returns public.canvas_score_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.canvas_score_snapshots;
begin
  insert into public.canvas_score_snapshots as s (
    client_key, week_start, saved_at,
    consensus_score, foundation_score, commerce_score, actuation_score, inputs
  )
  values (
    p_client_key, p_week_start, now(),
    p_consensus, p_foundation, p_commerce, p_actuation, coalesce(p_inputs, '{}'::jsonb)
  )
  on conflict (client_key, week_start) do update set
    saved_at = excluded.saved_at,
    consensus_score = excluded.consensus_score,
    foundation_score = excluded.foundation_score,
    commerce_score = excluded.commerce_score,
    actuation_score = excluded.actuation_score,
    inputs = excluded.inputs
  returning s.* into saved;
  return saved;
end;
$$;

revoke all on function public.canvas_score_snapshot_save(text, date, numeric, numeric, numeric, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.canvas_score_snapshot_save(text, date, numeric, numeric, numeric, numeric, jsonb)
  to service_role;

notify pgrst, 'reload schema';
