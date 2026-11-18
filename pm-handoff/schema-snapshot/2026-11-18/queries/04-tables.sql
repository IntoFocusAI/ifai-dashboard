-- 04 Tables (ordinary and partitioned): owner, RLS flags, comment, columns, constraints
select coalesce(jsonb_agg(x order by x->>'schema', x->>'name'),'[]') as result from (
 select jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
  'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity,'reloptions',c.reloptions,
  'comment',obj_description(c.oid,'pg_class'),
  'columns',(select jsonb_agg(jsonb_build_object('n',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',nullif(a.attidentity,''),'generated',nullif(a.attgenerated,''),
      'comment',col_description(c.oid,a.attnum)) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
  'constraints',(select jsonb_agg(jsonb_build_object('name',co.conname,'type',co.contype,'def',pg_get_constraintdef(co.oid)) order by co.conname)
    from pg_constraint co where co.conrelid=c.oid)) x
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname !~ '^pg_' and n.nspname !~ '^supabase_' and n.nspname not in ('information_schema','auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','cron','pgbouncer','net','supabase_functions','_realtime','_analytics','pgtle','topology','tiger','tiger_data') and c.relkind in ('r','p')
) s;
