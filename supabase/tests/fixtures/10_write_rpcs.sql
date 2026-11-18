-- Test-only stand-ins for the five write functions, with the hosted signatures and the hosted
-- grants before 1.6 Step 0a (EXECUTE to PUBLIC, anon and authenticated). Bodies only record the
-- call; the real bodies live in their own migrations and need tables these tests do not build.

create table public.test_write_calls (fn text not null, called_by text not null default current_user);
grant select on public.test_write_calls to anon, authenticated, service_role;

create function public.ai_prompt_save(p_prompt_key text, p_prompt_text text, p_category text)
returns text language plpgsql security definer set search_path = '' as $$
begin insert into public.test_write_calls (fn) values ('ai_prompt_save'); return 'p01'; end $$;

create function public.ai_prompt_set_active(p_prompt_key text, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin insert into public.test_write_calls (fn) values ('ai_prompt_set_active'); end $$;

create function public.mark_issue_done(p_client_key text, p_check_key text, p_entity_key text,
  p_name text, p_note text default null, p_entity_label text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin insert into public.test_write_calls (fn) values ('mark_issue_done'); end $$;

create function public.set_aside_issue(p_client_key text, p_check_key text, p_entity_key text,
  p_reason_code text, p_name text, p_note text default null, p_entity_label text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin insert into public.test_write_calls (fn) values ('set_aside_issue'); end $$;

create function public.reopen_set_aside(p_id uuid, p_name text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin insert into public.test_write_calls (fn) values ('reopen_set_aside'); end $$;

grant execute on function public.ai_prompt_save(text, text, text) to anon, authenticated;
grant execute on function public.ai_prompt_set_active(text, boolean) to anon, authenticated;
grant execute on function public.mark_issue_done(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.set_aside_issue(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.reopen_set_aside(uuid, text, text) to anon, authenticated;
