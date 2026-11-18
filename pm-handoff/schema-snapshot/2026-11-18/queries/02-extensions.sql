-- 02 Extensions
select coalesce(jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)) order by e.extname),'[]') as result
from pg_extension e join pg_namespace n on n.oid=e.extnamespace;
