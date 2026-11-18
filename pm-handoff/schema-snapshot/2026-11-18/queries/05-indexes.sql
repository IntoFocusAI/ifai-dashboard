-- 05 Indexes
select coalesce(jsonb_agg(jsonb_build_object('schema',i.schemaname,'table',i.tablename,'index',i.indexname,'def',i.indexdef) order by i.schemaname,i.tablename,i.indexname),'[]') as result
from pg_indexes i join pg_namespace n on n.nspname=i.schemaname where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data');
