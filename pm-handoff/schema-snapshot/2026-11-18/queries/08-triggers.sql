-- 08 Triggers (non-internal)
select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'trigger',t.tgname,'enabled',t.tgenabled,'def',pg_get_triggerdef(t.oid,true)) order by n.nspname,c.relname,t.tgname),'[]') as result
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data') and not t.tgisinternal;
