-- 06 Views and materialized views. Output is SQL text, one block per view.
select string_agg(format(E'-- %s.%s  kind=%s  owner=%s  reloptions=%s\ncreate %s %I.%I as\n%s\n', n.nspname, c.relname,
   case c.relkind when 'v' then 'view' else 'materialized view' end, pg_get_userbyid(c.relowner), coalesce(c.reloptions::text,'{}'),
   case c.relkind when 'v' then 'view' else 'materialized view' end, n.nspname, c.relname, pg_get_viewdef(c.oid, true)), E'\n' order by n.nspname, c.relname) as result
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data') and c.relkind in ('v','m');
