-- 1.6 Step 0a: anon cannot execute the five write functions; signed-in users and service_role can.
\set ON_ERROR_STOP 1

do $$
declare
  fns text[] := array[
    'public.ai_prompt_save(text,text,text)',
    'public.ai_prompt_set_active(text,boolean)',
    'public.mark_issue_done(text,text,text,text,text,text)',
    'public.set_aside_issue(text,text,text,text,text,text,text)',
    'public.reopen_set_aside(uuid,text,text)'];
  f text;
begin
  foreach f in array fns loop
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'anon can still execute %', f;
    end if;
    if not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'authenticated lost execute on %', f;
    end if;
    if not has_function_privilege('service_role', f, 'execute') then
      raise exception 'service_role lost execute on %', f;
    end if;
    -- PUBLIC must not hold EXECUTE either (a new role would inherit it).
    if exists (
      select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = f::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
      raise exception 'PUBLIC can still execute %', f;
    end if;
  end loop;
end $$;

-- Calls as anon are refused with 42501.
select public.test_act_as('anon');
do $$
declare calls text[] := array[
  $q$select public.ai_prompt_save('p01', 'text text text', 'cat')$q$,
  $q$select public.ai_prompt_set_active('p01', false)$q$,
  $q$select public.mark_issue_done('fender', 'chk', 'e1', 'Ann')$q$,
  $q$select public.set_aside_issue('fender', 'chk', 'e1', 'r1', 'Ann')$q$,
  $q$select public.reopen_set_aside(gen_random_uuid(), 'Ann')$q$];
  c text;
begin
  foreach c in array calls loop
    begin
      execute c;
      raise exception 'anon call succeeded: %', c;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;
reset session authorization;

-- Calls as a signed-in user reach the function body: the prompt functions then refuse
-- non-staff themselves (20261118160000), which is not the "permission denied" anon gets.
select public.test_act_as('authenticated', gen_random_uuid());
do $$ begin
  begin
    perform public.ai_prompt_set_active('p01', false);
    raise exception 'non-staff edited a prompt';
  exception when insufficient_privilege then
    if sqlerrm like 'permission denied%' then
      raise exception 'authenticated cannot execute ai_prompt_set_active: %', sqlerrm;
    end if;
  end;
end $$;
reset role;
reset session authorization;
