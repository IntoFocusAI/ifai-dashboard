-- 07 Functions and procedures. Output is SQL text, one block per routine.
select string_agg(format(E'-- %s.%s(%s)  kind=%s  security_definer=%s  config=%s  owner=%s\n%s\n', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
   p.prokind, p.prosecdef, coalesce(p.proconfig::text,'{}'), pg_get_userbyid(p.proowner),
   case when p.prokind='a' then '-- aggregate, no functiondef' else pg_get_functiondef(p.oid) end), E'\n' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as result
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data') and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e');
