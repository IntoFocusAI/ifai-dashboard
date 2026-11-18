-- 09 RLS policies
select coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname),'[]') as result
from pg_policies p join pg_namespace n on n.nspname=p.schemaname where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data');
