# Database tests

`bash supabase/tests/run.sh` starts a throwaway local Postgres cluster, loads the files listed in
`load-order.txt` (the hosted structure, pending repo migrations, the migrations under test, then
made-up rows), and runs every `*.test.sql` here. A test fails by raising an error. It never
connects to the hosted project. CI runs it on every pull request that touches `supabase/`
(`.github/workflows/db-tests.yml`).

Needs Postgres 15 or later server binaries (`initdb`, `pg_ctl`, `psql`); set `PG_BIN` if they are
not on `PATH`.

## Tests

| File | Checks |
| --- | --- |
| `login_roles.test.sql` | Login roles: `command.client_organizations` is seeded from `data/clients/*.json` (client_key = org slug) and closed to anon and signed-in users; `command.my_clients()` and the `can_read_*` helpers give staff every client and Org Leads / Org Users only their org's client (removed members, inactive orgs and users with no org get nothing); Org Leads can add, edit and remove only `org_viewer` rows in their own org; staff `org_admin` rows on client orgs are removed; the guarded Brian Magazu staff insert works once his auth user exists. |

Each actor runs the way PostgREST runs a request: session user `authenticator`, then
`SET ROLE anon` or `authenticated`, with `request.jwt.claims` set.

## Fixtures

- `00_supabase_roles.sql`: the Supabase pieces the hosted snapshot does not include: `anon`,
  `authenticated`, `service_role` and `authenticator`, a one-column `auth.users`, and
  `auth.uid()` / `auth.jwt()` / `auth.role()` reading `request.jwt.claims` as PostgREST sets them.
- `30_hosted_structure.sql`: **generated** by `build_hosted_fixture.py` from the read-only hosted
  catalog snapshot of 2026-11-18 (client-portal-pm `docs/schema-snapshot/2026-11-18/out`). It
  recreates the hosted schemas, types, 115 tables, constraints, indexes, 69 functions, 100 views,
  6 materialized views, triggers, RLS flags, 99 policies and every grant. Structure only; the
  snapshot has no rows. Regenerate with:

      python3 -I supabase/tests/fixtures/build_hosted_fixture.py <snapshot>/out \
          > supabase/tests/fixtures/30_hosted_structure.sql

  Checked by running the snapshot's own catalog queries against the local copy: types, indexes,
  triggers, policies, column, routine and schema grants match exactly; relation grants match
  except `MAINTAIN` (Postgres 17 only). Differences that do not affect these tests: foreign keys
  are added `NOT VALID`, schema comments are not copied, Postgres 16 prints some view definitions
  differently, Supabase platform roles are plain roles, extensions other than pgcrypto and
  uuid-ossp are left out, and pg_cron jobs are listed as comments only.
- `40_command_accounts.sql`: made-up command sign-in rows shaped like production on 2026-11-23
  (platform org with two staff who also hold `org_admin` on fender and ledlenser, plus Leads,
  Users and a removed member). Loaded before the login-roles migrations so their seed and
  clean-up run against realistic rows.

`load-order.txt` also loads `20261118160000_prompt_rpcs_staff_only.sql`, which is in the repo but
not yet on hosted.

On macOS, set `PG_BIN` to a Homebrew Postgres, for example
`PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash supabase/tests/run.sh`.
