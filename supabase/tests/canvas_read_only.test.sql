-- Build Audit C3: every canvas_* relation, in any schema, gives anon and authenticated SELECT at
-- most; and postgres's default grants for new tables and views in public give them nothing.
\set ON_ERROR_STOP 1

do $$
declare bad text;
begin
  select string_agg(format('%I.%I %s %s', n.nspname, c.relname, a.grantee::regrole, a.privilege_type), ', ')
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace,
       aclexplode(c.relacl) a
  where c.relname like 'canvas\_%'
    and c.relkind in ('r', 'v', 'm', 'p', 'f')
    and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
    and a.privilege_type <> 'SELECT';
  if bad is not null then raise exception 'canvas relations not read-only: %', bad; end if;
end $$;

-- The views the dashboard reads keep SELECT for signed-in users.
do $$
declare v text;
begin
  foreach v in array array[
    'public.canvas_amazon_product_types', 'public.canvas_site_types', 'public.canvas_ai_citations',
    'public.canvas_ai_current_run', 'public.canvas_ai_probes', 'public.canvas_ai_run_history'] loop
    if to_regclass(v) is not null and not has_table_privilege('authenticated', v, 'select') then
      raise exception 'authenticated lost SELECT on %', v;
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 'public'::regnamespace
      and d.defaclobjtype = 'r' and a.grantee in ('anon'::regrole, 'authenticated'::regrole)) then
    raise exception 'default privileges in public still grant anon or authenticated on new tables';
  end if;
end $$;
