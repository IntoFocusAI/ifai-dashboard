-- 1.6 Step 1: read functions that return client data check the caller's membership first.
--
-- Alters existing functions and permissions, so Brian Watson applies it, with 20261118200100.
-- Each body is unchanged from its last migration except for the membership condition marked
-- "1.6"; a caller who may not read the client gets no rows (or null), not an error, so pages show
-- their usual empty state.
--   public.ai_prompts_list()             (20261027183846)  FMIC prompts: can_read_schema('command')
--   public.ai_prompts_status()           (20261027183846)  same
--   public.ai_prompt_edits_list(text)    (20261109233000)  same
--   public.actuation_basis(text)         (20261116220000)  can_read_set_aside_client(p_client_key)
-- EXECUTE on these and on public.canvas_ai_history_run_rows(uuid) (SECURITY INVOKER: it reads
-- the canvas_ai_history_* views as the caller, which 20261118200100 already filters) is revoked
-- from anon and PUBLIC and kept for authenticated and service_role.
-- Staff keep the prompt list through can_read_schema (staff and FMIC entitled), and the prompt
-- write functions still require command.is_intofocus_admin().
--
-- Check after applying (as anon: permission denied; as a signed-in non-member: zero rows):
--   select count(*) from public.ai_prompts_list();
--
-- Also: EXECUTE on command.fmic_ai_current_published_prompts(uuid),
-- command.fmic_ai_prompt_validation_failures(uuid,uuid[],integer) and
-- command.fmic_ai_published_set_status(uuid) is revoked from authenticated (no membership check;
-- not called by the dashboard); service_role keeps it. The view command.fmic_ai_published_prompts,
-- which reads them, is no longer granted to authenticated.
--
-- Undo: re-run the four CREATE OR REPLACE statements from the migrations named above, then
--   grant execute on function public.ai_prompts_list(), public.ai_prompts_status(),
--     public.ai_prompt_edits_list(text), public.actuation_basis(text),
--     public.canvas_ai_history_run_rows(uuid) to anon;
--   grant execute on function command.fmic_ai_current_published_prompts(uuid),
--     command.fmic_ai_prompt_validation_failures(uuid,uuid[],integer),
--     command.fmic_ai_published_set_status(uuid) to authenticated;
--   grant select on command.fmic_ai_published_prompts to authenticated;

begin;

create or replace function public.ai_prompts_list()
returns table (prompt_key text, prompt_text text, category text, prompt_kind text, active boolean, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path to ''
as $$
  select p.prompt_key, p.prompt_text, p.category::text, p.prompt_kind, p.active, p.created_at, p.updated_at
  from command.fmic_ai_prompts p
  where private.can_read_schema('command')  -- 1.6
  order by p.prompt_key;
$$;

create or replace function public.ai_prompts_status()
returns jsonb
language sql stable security definer set search_path to ''
as $$
  select jsonb_build_object(
    'locked', l.locked,
    'run_id', l.run_id,
    'run_started_at', l.run_started_at,
    'active_count', (select count(*) from command.fmic_ai_prompts where active),
    'max_active', 99,
    'engines', 3,
    'repeats', coalesce((select (metadata->>'repeats')::int from command.fmic_audit_runs
                         where run_kind = 'ai_simulation' and collector_version = 'v11'
                         order by started_at desc limit 1), 20),
    'categories', (select coalesce(jsonb_agg(distinct category order by category), '[]'::jsonb) from command.fmic_ai_prompts)
  )
  from command.fmic_ai_prompt_lock() l
  where private.can_read_schema('command');  -- 1.6
$$;

create or replace function public.ai_prompt_edits_list(p_prompt_key text)
returns table (
  id uuid,
  edited_at timestamptz,
  action text,
  prompt_key text,
  before jsonb,
  after jsonb
)
language sql
stable
security definer
set search_path to ''
as $$
  select e.id, e.edited_at, e.action, e.prompt_key, e.before, e.after
  from command.fmic_ai_prompt_edits e
  where (p_prompt_key is null or e.prompt_key = p_prompt_key)
    and private.can_read_schema('command')  -- 1.6
  order by e.edited_at desc, e.id desc;
$$;

create or replace function public.actuation_basis(p_client_key text)
returns table (
  factor text,
  in_place boolean,
  verified_on date,
  expires_on date,
  target_domain_count integer,
  cadence_per_30_days integer,
  target_count integer,
  items_in_window integer
)
language sql
stable
security definer
set search_path = public
as $$
  with known as (
    select s.client_key from public.set_aside_clients s
    where s.client_key = p_client_key
      and private.can_read_set_aside_client(p_client_key)  -- 1.6
  ),
  programs as (
    select p.factor,
      (nullif(btrim(p.owner_name), '') is not null
        and nullif(btrim(p.evidence_url), '') is not null
        and p.verified_on is not null
        and p.expires_on > current_date) as ok,
      p.verified_on, p.expires_on, cardinality(p.target_domains) as domains,
      p.cadence_per_30_days, p.target_count
    from public.actuation_programs p
    where p.client_key = p_client_key
  ),
  items as (
    select i.factor, count(*)::integer as n
    from public.actuation_items i
    where i.client_key = p_client_key
      and i.posted_on > current_date - 90
      and i.posted_on <= current_date
    group by i.factor
  )
  select f.factor,
    case when f.factor in ('E2', 'E3') then coalesce(i.n, 0) > 0 else coalesce(p.ok, false) end,
    case when p.ok then p.verified_on end,
    case when p.ok then p.expires_on end,
    case when p.ok then p.domains end,
    case when p.ok then p.cadence_per_30_days end,
    case when p.ok then p.target_count end,
    case when f.factor in ('E2', 'E3') then coalesce(i.n, 0) end
  from known
  cross join (values (1, 'P1'), (2, 'P2'), (3, 'E2'), (4, 'E3')) as f(ord, factor)
  left join programs p on p.factor = f.factor
  left join items i on i.factor = f.factor
  order by f.ord;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.ai_prompts_list()', 'public.ai_prompts_status()',
      'public.ai_prompt_edits_list(text)', 'public.actuation_basis(text)',
      'public.canvas_ai_history_run_rows(uuid)'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
      raise notice '1.6 function %: anon revoked, authenticated and service_role kept', f;
    end if;
  end loop;
end $$;

-- Three SECURITY DEFINER functions in command return FMIC prompt data for any organization id
-- passed in, with no membership check, and are executable by authenticated. Nothing in the
-- dashboard calls them; the prompt workflow functions call them internally (as the owner), and
-- the pipelines use service_role. Signed-in users lose EXECUTE; service_role keeps it.
do $$
declare f text;
begin
  foreach f in array array['command.fmic_ai_current_published_prompts(uuid)',
      'command.fmic_ai_prompt_validation_failures(uuid,uuid[],integer)',
      'command.fmic_ai_published_set_status(uuid)'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
      raise notice '1.6 function %: authenticated and anon revoked, service_role kept', f;
    end if;
  end loop;
  -- The one view that reads them (not used by the dashboard) becomes backend only too.
  if to_regclass('command.fmic_ai_published_prompts') is not null then
    revoke all on command.fmic_ai_published_prompts from anon, authenticated;
    raise notice '1.6 view command.fmic_ai_published_prompts: backend only (service_role)';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
