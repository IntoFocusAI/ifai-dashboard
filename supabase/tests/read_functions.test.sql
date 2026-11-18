-- 1.6: read functions that return client data give rows only to members of the owning account
-- (and entitled staff); anon cannot call them.
\set ON_ERROR_STOP 1

create function pg_temp.as_user(p_who text, p_sql text) returns text language plpgsql as $$
declare v text; uid uuid;
begin
  uid := case p_who
    when 'a' then '00000000-0000-0000-0000-0000000000a1'
    when 'b' then '00000000-0000-0000-0000-0000000000b1'
    when 'staff' then '00000000-0000-0000-0000-0000000000c1'
    when 'none' then '00000000-0000-0000-0000-0000000000d1' end;
  if p_who = 'anon' then perform public.test_act_as('anon');
  else perform public.test_act_as('authenticated', uid); end if;
  begin
    execute p_sql into v;
  exception when insufficient_privilege then v := 'denied';
  end;
  reset role;
  reset session authorization;
  return v;
end $$;

do $$
declare
  q text; who text; got text; want text;
  cases text[][] := array[
    -- query, anon, org A, org B, staff, no account
    array['select count(*) from public.ai_prompts_list()', 'denied', '2', '0', '2', '0'],
    array['select count(*) from public.ai_prompt_edits_list(null)', 'denied', '1', '0', '1', '0'],
    array['select (public.ai_prompts_status() ->> ''active_count'')', 'denied', '2', null, '2', null],
    array['select count(*) from public.actuation_basis(''fmic'')', 'denied', '4', '0', '4', '0'],
    array['select count(*) from public.actuation_basis(''ledlenser'')', 'denied', '0', '4', '0', '0']];
  whos text[] := array['anon', 'a', 'b', 'staff', 'none'];
  i int; j int; errors text[] := '{}';
begin
  for i in 1 .. array_length(cases, 1) loop
    for j in 1 .. 5 loop
      got := pg_temp.as_user(whos[j], cases[i][1]);
      want := cases[i][j + 1];
      if got is distinct from want then
        errors := errors || format('%s as %s: got %s, want %s', cases[i][1], whos[j], coalesce(got, 'null'), coalesce(want, 'null'));
      end if;
    end loop;
  end loop;
  if array_length(errors, 1) > 0 then
    raise exception E'read function failures:\n%', array_to_string(errors, E'\n');
  end if;
end $$;
