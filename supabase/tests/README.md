# Database tests

`bash supabase/tests/run.sh` starts a throwaway local Postgres cluster, loads the files listed in
`load-order.txt` (fixtures, the repo migrations they build on, the migrations under test, then
test rows), and runs every `*.test.sql` here. A test fails by raising an error. It never connects
to the hosted project. CI runs it on every pull request that touches `supabase/`
(`.github/workflows/db-tests.yml`).

Needs Postgres 15 or later server binaries (`initdb`, `pg_ctl`, `psql`); set `PG_BIN` if they are
not on `PATH`.

## Tests

| File | Checks |
| --- | --- |
| `write_rpcs_no_anon.test.sql` | 1.6 Step 0a: anon and PUBLIC cannot execute the five write functions; signed-in users and service_role can. |
| `catalog_guard.test.sql` | 1.6: nothing with client data is selectable by anon; every view over client data has `security_invoker`; every client table has RLS and a membership policy and no literal `true` policy; materialized views are not selectable by signed-in users; every SECURITY DEFINER function over client data calls a membership helper; signed-in users reach only the listed `private` helpers; no default privileges for anon in client schemas. Read-only, so it can also be run against staging after applying. |
| `client_isolation.test.sql` | 1.6: for every relation with client data (found from the catalog), anon is refused; org A members see exactly org A's data; org B sees none of it (and the reverse); staff see entitled accounts only; a removed member and a signed-in user with no account see nothing; materialized view readers follow the same rule; set-aside writes and reopen work only for the caller's own client. |
| `read_functions.test.sql` | 1.6: the read functions that return client data give rows to members and entitled staff only, and refuse anon. |

Each actor runs the way PostgREST runs a request: session user `authenticator`, then
`SET ROLE anon` or `authenticated`, with `request.jwt.claims` set.

## How the fixtures differ from hosted

The repo's migrations do not build the hosted schemas from scratch (many tables were created
before migrations were kept), so tests load test-only fixtures from `fixtures/`. They hold
structure and made-up rows only, never client data.

- `00_supabase_roles.sql`: `anon`, `authenticated`, `service_role` and `authenticator`, a one-column
  `auth.users`, and `auth.uid()` / `auth.jwt()` / `auth.role()` reading `request.jwt.claims` as
  PostgREST sets them. Hosted Supabase has many more roles, extensions and the real `auth` schema.
- `20_portal_accounts.sql`: `public.organizations`, `public.organization_memberships`,
  `public.organization_modules`, `private.is_staff()` and `private.module_access(uuid, text)`,
  with only the columns the 1.6 helpers read. Hosted has the intofocus-portal versions; column
  names, membership status values and the module key `aeo_dashboard` are to be checked against
  the hosted catalog snapshot.
- `25_hosted_base.sql`: `public.audit_log` with the columns the set-aside trigger writes.
- `30_client_schemas.sql`: a model of the client schemas, not the full hosted set: one object of
  each kind the lockdown handles (a table with a read-all policy, a table with an anon policy and a
  literal-true write policy, a table without RLS, materialized views read with and without an
  alias, owner-rights views in public and in the client schemas, a view over a view, views through
  `canvas_private` and `ledlenser_private`), the FMIC prompt tables, and a stand-in
  `command.is_intofocus_admin()`. The sandbox schema, set-asides, prompt functions and actuation
  records are the real repo migrations.
- `90_test_accounts.sql`: org A (owns `command` and sandbox client `cl_fender`), org B (owns
  `ledlenser` and `cl_ledlenser`), an IntoFocus staff user entitled to org A only, and made-up rows
  in every client table (sandbox rows come from a generic filler that reads column types and check
  constraints). It also inserts the `private.client_schema_org` rows Brian Watson inserts at apply
  time.
