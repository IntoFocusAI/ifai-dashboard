-- Worker 27.8: AI Actuation records (SC-03; decisions 77, 78, 84, 96).
--
-- What it adds
--   Two tables and six functions. Nothing existing is altered or deleted; no table, view, column,
--   or grant on an existing object changes.
--
--   public.actuation_programs   One row per client and planned factor (P1 community response
--                               program, P2 publication and reviewer outreach program): IntoFocus
--                               owner, target domains, P1 cadence (responses per 30 days) or P2
--                               target count (placements per 90 days), evidence link, verified_on,
--                               expires_on (generated: verified_on + 90 days), who verified it, a
--                               staff note.
--   public.actuation_items      Logged execution items: E2 community responses posted and E3
--                               placements earned. Link, domain (from the link), posted_on,
--                               verified_on, who verified it, a staff note. One row per client,
--                               factor and link.
--
--   Both tables have RLS on with no policies, and no grant to anon or authenticated: nobody reads
--   or writes them directly. Every read and write goes through these functions, which run as
--   their owner (SECURITY DEFINER, fixed search_path) and filter to the one client asked for.
--   EXECUTE on each is first revoked from public, anon and authenticated (Postgres grants new
--   functions to PUBLIC by default), then granted only to the roles named below:
--
--   public.actuation_basis(p_client_key text)                                 anon, authenticated
--     Client read. Four rows (P1, P2, E2, E3) for one client: whether the factor is in place
--     (for E2 and E3: at least one verified item posted in the last 90 days),
--     its verified and expiry dates, counts (target domains, cadence, target count, verified
--     items posted in the last 90 days). No names, notes, or links. A program is in place only
--     with an owner, an evidence link, a verification date, and an expiry after today; otherwise
--     every field but the factor reads null, so a lapsed program looks like one never recorded
--     (decision 78).
--   public.actuation_programs_for_staff(p_client_key text)                    authenticated
--   public.actuation_items_for_staff(p_client_key text)                       authenticated
--     Staff reads with names, notes and links. No rows unless command.is_intofocus_admin().
--   public.actuation_program_save(p_client_key, p_factor, p_owner_name, p_target_domains,
--     p_cadence_per_30_days, p_target_count, p_evidence_url, p_verified_on, p_note)
--                                                                             authenticated
--     Inserts or updates the client's P1 or P2 record.
--   public.actuation_item_save(p_client_key, p_factor, p_url, p_posted_on, p_verified_on, p_note)
--                                                                             authenticated
--     Logs (or corrects) one E2 or E3 item; returns its id.
--   public.actuation_item_remove(p_id uuid)                                   authenticated
--     Removes one logged item that staff entered by mistake.
--   The three writes raise 42501 unless command.is_intofocus_admin() is true for the caller (the
--   same check as public.site_type_override). verified_by_name / updated_by_name is the caller's
--   profile display name, else their email.
--
-- How to undo
--   DROP FUNCTION public.actuation_item_remove(uuid);
--   DROP FUNCTION public.actuation_item_save(text, text, text, date, date, text);
--   DROP FUNCTION public.actuation_program_save(text, text, text, text[], integer, integer, text, date, text);
--   DROP FUNCTION public.actuation_items_for_staff(text);
--   DROP FUNCTION public.actuation_programs_for_staff(text);
--   DROP FUNCTION public.actuation_basis(text);
--   DROP TABLE public.actuation_items;
--   DROP TABLE public.actuation_programs;
--   NOTIFY pgrst, 'reload schema';
--   Dropping the tables deletes any records staff entered (a data change: Brian Watson).
--   The staff page then reads as not set up, and no client figure reads the basis yet.
--
-- Status: APPLIED to production 16 Nov 2026 by PM27 (Brian Magazu approved).

create table if not exists public.actuation_programs (
  client_key text not null references public.set_aside_clients(client_key),
  factor text not null check (factor in ('P1', 'P2')),
  owner_name text check (owner_name is null or char_length(owner_name) between 1 and 80),
  target_domains text[] not null default '{}'
    check (cardinality(target_domains) <= 50),
  cadence_per_30_days integer check (cadence_per_30_days is null or cadence_per_30_days between 1 and 1000),
  target_count integer check (target_count is null or target_count between 1 and 1000),
  evidence_url text check (
    evidence_url is null or (char_length(evidence_url) <= 2000 and evidence_url ~* '^https?://[^[:space:]]+$')
  ),
  verified_on date,
  expires_on date generated always as (verified_on + 90) stored,
  verified_by_name text check (verified_by_name is null or char_length(verified_by_name) <= 80),
  verified_by_user_id uuid,
  note text check (note is null or char_length(note) <= 500),
  updated_by_name text check (updated_by_name is null or char_length(updated_by_name) <= 80),
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_key, factor),
  -- P1 sets a cadence (E2's target), P2 a target count (E3's target).
  check (
    (factor = 'P1' and cadence_per_30_days is not null and target_count is null)
    or (factor = 'P2' and target_count is not null and cadence_per_30_days is null)
  )
);

create table if not exists public.actuation_items (
  id uuid primary key default gen_random_uuid(),
  client_key text not null references public.set_aside_clients(client_key),
  factor text not null check (factor in ('E2', 'E3')),
  url text not null check (char_length(url) <= 2000 and url ~* '^https?://[^[:space:]/]+[^[:space:]]*$'),
  domain text not null check (domain ~ '^[a-z0-9.-]{1,253}$'),
  posted_on date not null,
  verified_on date not null check (verified_on >= posted_on),
  verified_by_name text not null check (char_length(verified_by_name) <= 80),
  verified_by_user_id uuid,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_key, factor, url)
);

create index if not exists actuation_items_client_posted_idx
  on public.actuation_items (client_key, factor, posted_on desc);

alter table public.actuation_programs enable row level security;
alter table public.actuation_items enable row level security;
revoke all on table public.actuation_programs from public, anon, authenticated;
revoke all on table public.actuation_items from public, anon, authenticated;

-- Client read ------------------------------------------------------------------------------------

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
    select s.client_key from public.set_aside_clients s where s.client_key = p_client_key
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

-- Staff reads ------------------------------------------------------------------------------------

create or replace function public.actuation_programs_for_staff(p_client_key text)
returns table (
  factor text,
  owner_name text,
  target_domains text[],
  cadence_per_30_days integer,
  target_count integer,
  evidence_url text,
  verified_on date,
  expires_on date,
  verified_by_name text,
  note text,
  updated_by_name text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, command, auth
as $$
  select p.factor, p.owner_name, p.target_domains, p.cadence_per_30_days, p.target_count,
    p.evidence_url, p.verified_on, p.expires_on, p.verified_by_name, p.note, p.updated_by_name,
    p.updated_at
  from public.actuation_programs p
  where command.is_intofocus_admin()
    and p.client_key = p_client_key
  order by p.factor;
$$;

create or replace function public.actuation_items_for_staff(p_client_key text)
returns table (
  id uuid,
  factor text,
  url text,
  domain text,
  posted_on date,
  verified_on date,
  verified_by_name text,
  note text
)
language sql
stable
security definer
set search_path = public, command, auth
as $$
  select i.id, i.factor, i.url, i.domain, i.posted_on, i.verified_on, i.verified_by_name, i.note
  from public.actuation_items i
  where command.is_intofocus_admin()
    and i.client_key = p_client_key
  order by i.posted_on desc, i.domain;
$$;

-- Staff writes -----------------------------------------------------------------------------------

create or replace function public.actuation_program_save(
  p_client_key text,
  p_factor text,
  p_owner_name text,
  p_target_domains text[],
  p_cadence_per_30_days integer,
  p_target_count integer,
  p_evidence_url text,
  p_verified_on date,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, command, auth
as $$
declare
  v_name text;
  v_domains text[];
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can save Actuation records.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.set_aside_clients s where s.client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  if p_verified_on is not null and p_verified_on > current_date then
    raise exception 'The verification date cannot be in the future.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct d order by d), '{}')
    into v_domains
  from (
    select lower(regexp_replace(btrim(x), '^(https?://)?(www\.)?([^/]+).*$', '\3', 'i')) as d
    from unnest(coalesce(p_target_domains, '{}')) as x
  ) t
  where d ~ '^[a-z0-9.-]{1,253}$';

  select left(coalesce(nullif(btrim(p.display_name), ''), u.email, 'IntoFocus staff'), 80)
    into v_name
  from auth.users u
  left join command.user_profiles p on p.id = u.id
  where u.id = auth.uid();
  v_name := coalesce(v_name, 'IntoFocus staff');

  insert into public.actuation_programs (
    client_key, factor, owner_name, target_domains, cadence_per_30_days, target_count,
    evidence_url, verified_on, verified_by_name, verified_by_user_id, note,
    updated_by_name, updated_by_user_id
  )
  values (
    p_client_key,
    p_factor,
    nullif(btrim(p_owner_name), ''),
    v_domains,
    case when p_factor = 'P1' then p_cadence_per_30_days end,
    case when p_factor = 'P2' then p_target_count end,
    nullif(btrim(p_evidence_url), ''),
    p_verified_on,
    case when p_verified_on is not null then v_name end,
    case when p_verified_on is not null then auth.uid() end,
    nullif(btrim(p_note), ''),
    v_name,
    auth.uid()
  )
  on conflict (client_key, factor) do update
    set owner_name = excluded.owner_name,
        target_domains = excluded.target_domains,
        cadence_per_30_days = excluded.cadence_per_30_days,
        target_count = excluded.target_count,
        evidence_url = excluded.evidence_url,
        verified_on = excluded.verified_on,
        -- Who verified changes only when the date does; an edit to other fields keeps it.
        verified_by_name = case
          when excluded.verified_on is distinct from public.actuation_programs.verified_on
            then excluded.verified_by_name
          else public.actuation_programs.verified_by_name end,
        verified_by_user_id = case
          when excluded.verified_on is distinct from public.actuation_programs.verified_on
            then excluded.verified_by_user_id
          else public.actuation_programs.verified_by_user_id end,
        note = excluded.note,
        updated_by_name = excluded.updated_by_name,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now();
end;
$$;

create or replace function public.actuation_item_save(
  p_client_key text,
  p_factor text,
  p_url text,
  p_posted_on date,
  p_verified_on date,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, command, auth
as $$
declare
  v_name text;
  v_url text := btrim(p_url);
  v_domain text;
  v_id uuid;
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can log Actuation items.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.set_aside_clients s where s.client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;
  if p_posted_on is null or p_verified_on is null
     or p_posted_on > current_date or p_verified_on > current_date then
    raise exception 'Posted and verified dates are required and cannot be in the future.' using errcode = '22023';
  end if;

  v_domain := lower(regexp_replace(substring(v_url from '^[A-Za-z]+://([^/:?#]+)'), '^www\.', ''));

  select left(coalesce(nullif(btrim(p.display_name), ''), u.email, 'IntoFocus staff'), 80)
    into v_name
  from auth.users u
  left join command.user_profiles p on p.id = u.id
  where u.id = auth.uid();
  v_name := coalesce(v_name, 'IntoFocus staff');

  insert into public.actuation_items (
    client_key, factor, url, domain, posted_on, verified_on, verified_by_name, verified_by_user_id, note
  )
  values (
    p_client_key, p_factor, v_url, v_domain, p_posted_on, p_verified_on, v_name, auth.uid(),
    nullif(btrim(p_note), '')
  )
  on conflict (client_key, factor, url) do update
    set posted_on = excluded.posted_on,
        verified_on = excluded.verified_on,
        verified_by_name = excluded.verified_by_name,
        verified_by_user_id = excluded.verified_by_user_id,
        note = excluded.note,
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.actuation_item_remove(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, command, auth
as $$
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can remove Actuation items.' using errcode = '42501';
  end if;
  delete from public.actuation_items where id = p_id;
end;
$$;

revoke execute on function public.actuation_basis(text) from public, anon, authenticated;
revoke execute on function public.actuation_programs_for_staff(text) from public, anon, authenticated;
revoke execute on function public.actuation_items_for_staff(text) from public, anon, authenticated;
revoke execute on function public.actuation_program_save(text, text, text, text[], integer, integer, text, date, text) from public, anon, authenticated;
revoke execute on function public.actuation_item_save(text, text, text, date, date, text) from public, anon, authenticated;
revoke execute on function public.actuation_item_remove(uuid) from public, anon, authenticated;

grant execute on function public.actuation_basis(text) to anon, authenticated;
grant execute on function public.actuation_programs_for_staff(text) to authenticated;
grant execute on function public.actuation_items_for_staff(text) to authenticated;
grant execute on function public.actuation_program_save(text, text, text, text[], integer, integer, text, date, text) to authenticated;
grant execute on function public.actuation_item_save(text, text, text, date, date, text) to authenticated;
grant execute on function public.actuation_item_remove(uuid) to authenticated;

notify pgrst, 'reload schema';
