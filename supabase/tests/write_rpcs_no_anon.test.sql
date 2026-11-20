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

-- Calls as a signed-in user go through.
select public.test_act_as('authenticated', gen_random_uuid());
select public.mark_issue_done('fender', 'chk', 'e1', 'Ann');
select public.set_aside_issue('fender', 'chk', 'e1', 'r1', 'Ann');
select public.reopen_set_aside(gen_random_uuid(), 'Ann');
reset role;

do $$ begin
  if (select count(*) from public.test_write_calls) <> 3 then
    raise exception 'expected 3 signed-in calls, got %', (select count(*) from public.test_write_calls);
  end if;
end $$;
