-- 11 Non-system roles (attributes only, never passwords)
select coalesce(jsonb_agg(jsonb_build_object('name',r.rolname,'super',r.rolsuper,'inherit',r.rolinherit,'createrole',r.rolcreaterole,'createdb',r.rolcreatedb,'login',r.rolcanlogin,'replication',r.rolreplication,'bypassrls',r.rolbypassrls,'connlimit',r.rolconnlimit,
  'member_of',(select jsonb_agg(pg_get_userbyid(m.roleid) order by pg_get_userbyid(m.roleid)) from pg_auth_members m where m.member=r.oid),
  'config',r.rolconfig) order by r.rolname),'[]') as result
from pg_roles r where r.rolname !~ '^pg_';
