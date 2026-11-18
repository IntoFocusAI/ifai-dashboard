-- Test-only stand-in for the Supabase platform pieces the migrations use. Not a migration.
-- Hosted Supabase creates these itself; locally we create the minimum: the three API roles,
-- auth.uid() / auth.jwt() reading the request claims the way PostgREST sets them, and the
-- default EXECUTE-to-PUBLIC behavior Postgres has for new functions (left as is).

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
-- PostgREST logs in as authenticator and switches to anon / authenticated / service_role.
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;

create schema auth;
create table auth.users (id uuid primary key, email text);
create schema private;
create schema extensions;
grant usage on schema public, auth to anon, authenticated, service_role;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;
grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

-- Test helper: act as a role and user, the way PostgREST does per request (session user
-- authenticator, then SET ROLE). Undo with: reset role; reset session authorization;
create or replace function public.test_act_as(p_role text, p_user uuid default null) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('role', p_role, 'sub', coalesce(p_user::text, ''))::text, false);
  set session authorization authenticator;
  execute format('set role %I', p_role);
end $$;
grant execute on function public.test_act_as(text, uuid) to anon, authenticated, service_role;
