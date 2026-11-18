# Database tests

`bash supabase/tests/run.sh` starts a throwaway local Postgres cluster, loads the files listed in
`load-order.txt` (fixtures first, then the migrations under test), and runs every `*.test.sql`
here. A test fails by raising an error. It never connects to the hosted project. CI runs it on
every pull request that touches `supabase/` (`.github/workflows/db-tests.yml`).

Needs Postgres 15 or later server binaries (`initdb`, `pg_ctl`, `psql`); set `PG_BIN` if they are
not on `PATH`.

## How the fixtures differ from hosted

The repo's migrations do not build the hosted schemas from scratch (many tables were created
before migrations were kept), so tests load test-only fixtures from `fixtures/`. They hold
structure and made-up rows only, never client data.

- `00_supabase_roles.sql`: the `anon`, `authenticated` and `service_role` roles and `auth.uid()` /
  `auth.jwt()` reading `request.jwt.claims`, as PostgREST sets them. Hosted Supabase has many more
  roles, extensions and the real `auth` schema.
- `10_write_rpcs.sql`: the five write functions with their hosted signatures and pre-1.6 grants,
  but bodies that only record the call. The real bodies are in their own migrations.
