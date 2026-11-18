-- 03 Enums, composite (standalone) and domain types
select coalesce(jsonb_agg(x order by x->>'schema', x->>'name'),'[]') as result from (
 select jsonb_build_object('schema',n.nspname,'name',t.typname,'kind',
   case t.typtype when 'e' then 'enum' when 'd' then 'domain' when 'c' then 'composite' end,
   'owner',pg_get_userbyid(t.typowner),
   'enum_labels',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid),
   'domain_base',case when t.typtype='d' then format_type(t.typbasetype,t.typtypmod) end,
   'domain_notnull',case when t.typtype='d' then t.typnotnull end,
   'domain_default',t.typdefault,
   'domain_constraints',(select jsonb_agg(pg_get_constraintdef(c.oid) order by c.conname) from pg_constraint c where c.contypid=t.oid),
   'composite_attrs',case when t.typtype='c' then (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) order by a.attnum) from pg_attribute a where a.attrelid=t.typrelid and a.attnum>0 and not a.attisdropped) end,
   'comment',obj_description(t.oid,'pg_type')) x
 from pg_type t join pg_namespace n on n.oid=t.typnamespace
 where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data') and (t.typtype in ('e','d') or (t.typtype='c' and (select relkind from pg_class where oid=t.typrelid)='c'))
) s;
