-- 13 Migration version list (version and name only)
select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]') as result
from supabase_migrations.schema_migrations;
