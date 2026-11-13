-- Worker 26.12: staff "Sites to review" list for flagged site types (decision 21a).
--
-- What it changes
--   Adds two functions. Nothing existing is altered or deleted; no table, view, column, or grant
--   on an existing object changes.
--
--   public.site_types_to_review(p_client_key text)
--     Read. The rows of public.canvas_site_types for one client that read needs_review = true,
--     with the classifier's one-line reason (site_type_classifications.reason, which the read
--     view does not expose) and is_global (true when the flagged answer is the global row,
--     client_key NULL). Returns no rows unless command.is_intofocus_admin() is true for the
--     caller, so a client user or the publishable key alone reads nothing.
--
--   public.site_type_override(p_domain text, p_client_key text, p_site_type text, p_note text)
--     Write. Inserts or updates one row of public.site_type_overrides for (domain, client),
--     and nothing else. p_client_key NULL writes the global override (every client), a client
--     key writes that client's override. Raises 42501 unless command.is_intofocus_admin() is
--     true for the caller. set_by_name is the caller's profile display name, else their email;
--     set_by_user_id is auth.uid(). The table's own checks still apply (domain form, the eight
--     types, note length). The classifier never writes this table, so the answer sticks.
--
--   Both run as their owner (SECURITY DEFINER, fixed search_path), because RLS on the two
--   site-type tables has no policies. EXECUTE is revoked from public and anon and granted to
--   authenticated only. The browser key gets no table grant.
--
-- How to undo
--   DROP FUNCTION public.site_type_override(text, text, text, text);
--   DROP FUNCTION public.site_types_to_review(text);
--   NOTIFY pgrst, 'reload schema';
--   Override rows already written stay in public.site_type_overrides; delete them by set_at if
--   they should go too (that part is a data change and waits for Brian Watson).
--   The page falls back to the read-only list (canvas_site_types, no reason, no saving).
--
-- Status: NOT APPLIED. Additive, so it needs Brian Magazu's approval before it is applied, and
-- the pull request records when and by whom. Until then the page lists the flagged rows from
-- public.canvas_site_types read only.

create or replace function public.site_types_to_review(p_client_key text)
returns table (
  domain text,
  site_type text,
  confidence numeric,
  reason text,
  model text,
  classified_at timestamptz,
  is_global boolean
)
language sql
stable
security definer
set search_path = public, command, auth
as $$
  select v.domain, v.site_type, v.confidence, k.reason, v.model, v.classified_at, k.client_key is null
  from public.canvas_site_types v
  join lateral (
    select c.reason, c.client_key
    from public.site_type_classifications c
    where c.domain = v.domain
      and c.origin = 'ai'
      and (c.client_key = v.client_key or c.client_key is null)
    order by c.client_key nulls last
    limit 1
  ) k on true
  where command.is_intofocus_admin()
    and v.client_key = p_client_key
    and v.needs_review
  order by v.confidence, v.domain;
$$;

create or replace function public.site_type_override(
  p_domain text,
  p_client_key text,
  p_site_type text,
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
begin
  if not command.is_intofocus_admin() then
    raise exception 'Only IntoFocus staff can set a site type.' using errcode = '42501';
  end if;

  if p_client_key is not null
     and not exists (select 1 from public.set_aside_clients s where s.client_key = p_client_key) then
    raise exception 'Unknown client.' using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(p.display_name), ''), u.email)
    into v_name
  from auth.users u
  left join command.user_profiles p on p.id = u.id
  where u.id = auth.uid();

  insert into public.site_type_overrides (domain, client_key, site_type, set_by_name, set_by_user_id, note)
  values (
    lower(btrim(p_domain)),
    p_client_key,
    p_site_type,
    left(coalesce(v_name, 'IntoFocus staff'), 80),
    auth.uid(),
    nullif(btrim(p_note), '')
  )
  on conflict (domain, (coalesce(client_key, ''))) do update
    set site_type = excluded.site_type,
        set_by_name = excluded.set_by_name,
        set_by_user_id = excluded.set_by_user_id,
        set_at = now(),
        note = excluded.note;
end;
$$;

revoke all on function public.site_types_to_review(text) from public, anon;
revoke all on function public.site_type_override(text, text, text, text) from public, anon;
grant execute on function public.site_types_to_review(text) to authenticated;
grant execute on function public.site_type_override(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
