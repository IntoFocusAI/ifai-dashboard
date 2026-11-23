-- 1.6 Step 0a: the five write functions are no longer callable with the anon key.
--
-- Problem: public.ai_prompt_save, ai_prompt_set_active, mark_issue_done, set_aside_issue and
-- reopen_set_aside are SECURITY DEFINER and change data. EXECUTE was granted to anon (and, by
-- Postgres default, to PUBLIC), so anyone holding the public anon key could write.
-- 20261118160000 already closed the two prompt functions; this file closes the other three and
-- repeats the revoke for the prompt functions so the end state is stated in one place.
--
-- Change (alters existing permissions, so Brian Watson applies it):
--   revoke EXECUTE from PUBLIC and anon on all five; grant EXECUTE to authenticated and
--   service_role. Function bodies are not changed. A membership check inside each function
--   follows in 1.6 Step 1.
--
-- App change in the same PR: lib/set-aside/set-aside.ts calls the three set-aside functions with
-- the signed-in browser session (lib/supabase/session-client.ts) instead of the anon client.
-- Signed-out visitors see "Sign in to mark issues Done or set them aside." instead of saving.
--
-- Check after applying (first row all false, second all true):
--   select has_function_privilege('anon', 'public.set_aside_issue(text,text,text,text,text,text,text)', 'execute'),
--          has_function_privilege('anon', 'public.mark_issue_done(text,text,text,text,text,text)', 'execute'),
--          has_function_privilege('anon', 'public.reopen_set_aside(uuid,text,text)', 'execute'),
--          has_function_privilege('anon', 'public.ai_prompt_save(text,text,text)', 'execute'),
--          has_function_privilege('anon', 'public.ai_prompt_set_active(text,boolean)', 'execute');
--   (repeat with 'authenticated')
--
-- Undo (restores the earlier anon access; only if the dashboard must write while signed out):
--   grant execute on function public.set_aside_issue(text, text, text, text, text, text, text) to anon;
--   grant execute on function public.mark_issue_done(text, text, text, text, text, text) to anon;
--   grant execute on function public.reopen_set_aside(uuid, text, text) to anon;
--   (the prompt functions stay closed; their undo is in 20261118160000)

begin;

revoke execute on function public.ai_prompt_save(text, text, text) from public, anon;
revoke execute on function public.ai_prompt_set_active(text, boolean) from public, anon;
revoke execute on function public.mark_issue_done(text, text, text, text, text, text) from public, anon;
revoke execute on function public.set_aside_issue(text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.reopen_set_aside(uuid, text, text) from public, anon;

grant execute on function public.ai_prompt_save(text, text, text) to authenticated, service_role;
grant execute on function public.ai_prompt_set_active(text, boolean) to authenticated, service_role;
grant execute on function public.mark_issue_done(text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.set_aside_issue(text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.reopen_set_aside(uuid, text, text) to authenticated, service_role;

commit;
