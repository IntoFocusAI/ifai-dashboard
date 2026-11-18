-- 01 Schemas and owners (application schemas)
select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(n.nspowner),'comment',obj_description(n.oid,'pg_namespace')) order by n.nspname),'[]') as result
from pg_namespace n where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data');
