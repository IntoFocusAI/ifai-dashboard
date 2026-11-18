-- TEST FIXTURE ONLY. Never apply to a hosted project.
-- Run as a superuser (supabase_admin): the auth schema belongs to supabase_auth_admin.
-- The supabase/postgres image ships an old auth.uid() that reads request.jwt.claim.sub.
-- PostgREST 12 and later set request.jwt.claims (json) instead; hosted Supabase's current
-- auth.uid() reads both. This makes the local stack match hosted.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;
