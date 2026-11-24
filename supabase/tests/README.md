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
| `write_rpcs_no_anon.test.sql` | 1.6 Step 0a: anon and PUBLIC cannot execute the five write functions; signed-in users reach the function body. |
| `catalog_guard.test.sql` | 1.6: nothing with client data is selectable by anon; every view over client data has `security_invoker`; every client table has RLS and a membership policy and no literal `true` policy; materialized views are not selectable by signed-in users; every SECURITY DEFINER function over client data that signed-in users can call checks membership; signed-in users reach only the listed `private` helpers; no default privileges for anon in client schemas. Read-only, so it can also be run against staging after applying. |
| `client_isolation.test.sql` | 1.6: every relation with client data (found from the catalog) for 7 actors in the command sign-in model: anon is refused; org A (fender) Leads and Users see exactly org A's data and none of org B's (ledlenser), and the reverse; staff (`intofocus_admin`) see both; a removed member and a signed-in user with no org see nothing; backend-only relations are refused to every signed-in user. Also materialized view readers, `canvas_score_snapshots` by name, and set-aside write and reopen across orgs. |
| `read_functions.test.sql` | 1.6: the read functions that return client data give rows to members and staff only, and refuse anon; the three unchecked `command.fmic_ai_*` functions are refused to signed-in users. |
| `r10_retailer_rows.test.sql` | R-10 step 1 (20261123170000): retailer seeds (Fender 4, Ledlenser Walmart only); staff read both clients' retailer lists, observations and views, a Fender member only Fender, a Ledlenser member only Ledlenser, a signed-in user with no org nothing, anon is refused; canvas_retail_prices keeps the last priced check over a later failed one and computes leakage = price − MAP; observations are append-only (signed-in users cannot write, service_role inserts but cannot update, delete or truncate, and the trigger refuses a non-owner even with a grant); grants are explicit and views run as the caller. |
| `r15_price_matches.test.sql` | R-15 (20261123190000): staff read both clients' price-match searches, results and views, each member only their client, anon nothing; the views show the latest completed search over a later failed one, flag a changed benchmark, keep an unlisted seller under its domain and compute landed = item + shipping; the tables are append-only; grants explicit and views run as the caller; a member can ignore (set aside on `price_match` with `keep_amazon_price`) and restore through the existing functions, and another client's member cannot. |
| `withheld_offer_seller.test.sql` | R-15 (a) (20261123210000): staff read both clients' `canvas_withheld_offer_sellers`, each member only their client, anon nothing; only listings whose offers were read show; seller_names follows seller_ids with null where unknown; today's Featured Offer state rides along; grants explicit and the views run as the caller. |
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
- `90_test_accounts.sql`: made-up memberships and rows, loaded after the migrations. Org A is the
  command org `fender` (`command`, sandbox client `cl_fender`, set-aside client `fmic`); org B is
  `ledlenser` (`ledlenser`, `cl_ledlenser`, `ledlenser`); a staff user (`intofocus_admin` on the
  platform org) belongs to neither. It puts at least one row in
  every client table (a generic filler that reads column types and defaults; ledlenser_private.retail_price_observations gets an explicit row), and drops CHECK
  constraints on the tables it fills so made-up values need not match URL patterns (checks do not
  affect grants, policies or views).


`load-order.txt` also loads `20261118160000_prompt_rpcs_staff_only.sql`, which predates the 2026-11-18
snapshot's structure.

On macOS, set `PG_BIN` to a Homebrew Postgres, for example
`PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash supabase/tests/run.sh`.
