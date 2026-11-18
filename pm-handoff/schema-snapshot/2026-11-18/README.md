# Hosted schema catalog snapshot, 2026-11-18

**What this is.** A read-only, schema-only catalog snapshot of the hosted Supabase main project "IntoFocusAI Portal" (ref `qftczrlksczfimnzfiov`). Taken 2026-11-18 by the client-portal-pm PM session, on the user's approval of a read-only structure pull. It is **not a pg_dump**: it is the output of SELECT queries against system catalogs (`pg_catalog`, `pg_indexes`, `pg_policies`, `cron.job`, `supabase_migrations.schema_migrations` version list). No application rows were read, nothing was written, no DDL or migrations were run.

**Purpose.** Lets a builder reconcile repo migrations against what is actually on hosted, without a dump.

## Scope

Application schemas only: `canvas_private`, `command`, `ledlenser`, `ledlenser_private`, `private`, `public`, `sandbox`. Excluded: `auth`, `storage`, `realtime`, `extensions`, `graphql`, `graphql_public`, `vault`, `pgsodium`, `cron` (except the job list), `pgbouncer`, `supabase_*` (except the migration version list), `pg_*`, `information_schema`. The exact filter is in `queries/00-filter.txt`. Extensions and roles are database-wide. Default privileges are listed for every schema (they include Supabase-managed schemas).

## Layout

| Query | Output | Contents |
|---|---|---|
| `queries/01-schemas.sql` | `out/01-schemas.json` | Schemas, owners, comments |
| `queries/02-extensions.sql` | `out/02-extensions.json` | Extensions (name, version, schema) |
| `queries/03-types.sql` | `out/03-types.json` | Enums with labels, domains with checks, standalone composite types |
| `queries/04-tables.sql` | `out/04-tables.json` | Tables: owner, RLS enabled/forced, comment, columns (format_type, not null, default, identity, generated, comment), constraints (pg_get_constraintdef) |
| `queries/05-indexes.sql` | `out/05-indexes.json` | Index definitions (includes indexes on materialized views) |
| `queries/06-views.sql` | `out/06-views.sql` | Views and materialized views: owner, reloptions (security_invoker etc.), pg_get_viewdef |
| `queries/07-functions.sql` | `out/07-functions.sql` | Functions and procedures (not extension-owned): pg_get_functiondef, security definer, proconfig (search_path), owner |
| `queries/08-triggers.sql` | `out/08-triggers.json` | Non-internal triggers (pg_get_triggerdef) |
| `queries/09-policies.sql` | `out/09-policies.json` | Full pg_policies rows |
| `queries/10-grants.sql` | `out/10-grants.json` | Relation grants (aclexplode on relacl, owner excluded; `*` = WITH GRANT OPTION), column grants, routine grants (proacl, NULL acl expanded to the default), schema USAGE/CREATE grants, pg_default_acl |
| `queries/11-roles.sql` | `out/11-roles.json` | Non-`pg_` roles: attributes, memberships, role config. No passwords |
| `queries/12-cron-jobs.sql` | `out/12-cron-jobs.json` | pg_cron jobs (jobname, schedule, database, user, active, command) |
| `queries/13-migrations.sql` | `out/13-migrations.json` | supabase_migrations.schema_migrations version and name only |

Every result is ordered deterministically (schema, then object name, then sub-key). JSON files are pretty-printed with sorted keys so they diff cleanly.

## How to regenerate locally and diff

```bash
supabase start            # local stack, migrations applied
cd docs/schema-snapshot/2026-11-18/queries
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres ./run-local.sh
diff -ru ../out ../out-local
```

`run-local.sh` runs each `NN-*.sql` with psql in a read-only transaction and writes `../out-local/` in the same format (JSON re-serialized with sorted keys, views and functions as plain SQL text). Do not commit `out-local/`.

Transport note: on hosted, the queries were sent through the Supabase MCP `execute_sql` tool. For 05, 09 and 10 a constant padding column (`repeat('x',150000) as pad`) was appended to the outer SELECT so the tool saved the result to a file instead of returning it inline; 01, 02, 03, 08, 11, 12 and 13 were run together as columns of one SELECT. The padding and grouping do not change the result; the `.sql` files here are the canonical queries.

## Counts (hosted, 2026-11-18)

| Kind | canvas_private | command | ledlenser | ledlenser_private | private | public | sandbox | Total |
|---|---|---|---|---|---|---|---|---|
| Tables | 0 | 40 | 27 | 0 | 0 | 29 | 19 | 115 |
| Columns | 0 | 635 | 531 | 0 | 0 | 252 | 226 | 1644 |
| Constraints | 0 | 100 | 71 | 0 | 0 | 156 | 86 | 413 |
| Indexes | 0 | 81 | 55 | 0 | 0 | 64 | 30 | 230 |
| Views | 9 | 9 | 33 | 8 | 0 | 37 | 4 | 100 |
| Materialized views | 0 | 4 | 2 | 0 | 0 | 0 | 0 | 6 |
| Functions | 0 | 30 | 6 | 0 | 4 | 26 | 3 | 69 |
| Triggers | 0 | 18 | 10 | 0 | 0 | 28 | 1 | 57 |
| Policies | 0 | 53 | 0 | 0 | 0 | 28 | 18 | 99 |
| Enums / domains | 0 | 2 | 2 | 0 | 0 | 15 | 0 | 19 |
| Relation grant rows | 0 | 112 | 124 | 6 | 0 | 236 | 67 | 545 |
| Routine grant rows | 0 | 37 | 6 | 0 | 4 | 65 | 3 | 115 |
| Schema grant rows | 0 | 5 | 3 | 1 | 1 | 7 | 3 | 20 |

Database-wide: 6 extensions (pg_cron 1.6.4, pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1), 19 non-`pg_` roles, 3 column grants, 29 default-privilege rows, 4 pg_cron jobs (3 active).

**Migration versions recorded on hosted: 79** (first `20260804140224`, last `20261117140850`).

## Secrets found and redacted

None. Function bodies, column defaults, view definitions, policy expressions, trigger definitions and cron commands were scanned for JWTs (`eyJ`), Stripe keys (`sk_`), `Bearer ` tokens, `password`, `apikey`, URLs with credentials, and any 40+ character token-like strings. The only URLs are domain regex patterns inside CHECK constraints (fender.com, ledlenser.com). The cron jobs only refresh materialized views or call `sandbox.reload_readings`. No `<REDACTED_SECRET>` placeholders were needed.

## Oddities and notes for the reconcile

1. **`private.has_org_role` exists on hosted** (`private.has_org_role(target_organization_id uuid, allowed_roles organization_role[])`, security definer, `search_path=public`), together with `private.is_active_org_member`, `private.check_issue_input` and `private.write_set_aside_audit`. Policies reference `private.has_org_role`, `private.is_active_org_member`, `command.user_has_org_role`, `command.is_intofocus_admin` and `auth.uid`; all referenced functions are present on hosted.
2. **Migration history does not line up with the repos.** Of the 19 files in the local `intofocus-portal/supabase/migrations` checkout, 4 match a hosted version and 5 match a hosted name; the 14 portal migrations dated 2026-11-16 to 2026-11-18 (billing, entitlements, invitations, CRM, team management, onboarding) are not on hosted. Of 63 files in the local `ifai-dashboard` checkout, 25 match by version and 51 by name: most hosted versions were recorded with a different timestamp than the repo filename (applied via MCP, which stamps its own version). Hosted also has entries with no repo file in either checkout (for example `fender_organization`, `sandbox_load`, `security_advisor_fixes_20261021`). Builders should match on name and on object definitions, not on version numbers.
3. **Two parallel org models.** `public` has `organizations` / `organization_memberships` with enum `public.organization_role` (platform_admin, org_admin, leader, member, recruiting_manager, viewer); `command` has its own `organizations` / `organization_memberships` with enum `command.organization_role` (intofocus_admin, org_admin, org_viewer). Both have a `membership_status` enum.
4. **RLS is enabled on all 115 tables; none force RLS.** 56 tables have RLS enabled but no policies (all 27 `ledlenser` tables, 14 in `command`, 14 in `public`, 1 in `sandbox`), so only bypass-RLS roles (postgres, service_role) see rows there.
5. **92 of 100 views do not set `security_invoker`**, including the `public.canvas_*` and `ledlenser.canvas_*` views the dashboard reads. Those run with the owner's (postgres) rights and bypass RLS on base tables. Relevant to the client data isolation rule before any client login reads them.
6. **`sandbox` policies are `USING (true)` for `anon` and `authenticated`** on all 18 policied tables. Several `command` tables also have `USING (true)` SELECT policies for `authenticated`.
7. **`anon` holds INSERT/UPDATE/DELETE table grants** on 32 `public` objects (Supabase default privileges grant `arwdDxtm` to anon and authenticated on `public`); RLS policies are what actually restrict writes.
8. `cursor_map_writer` has `bypassrls` and column-level UPDATE on `command.fmic_retail_buybox_map` (`map_price`, `mf_leakage`, `wmt_leakage`). `score_snapshot_writer` is a login role with connection limit 2.
9. pg_cron job `refresh_stock_loss` (command v1 materialized views) is inactive; `refresh_stock_loss_v2`, `ledlenser_refresh_stock_loss_v2` and `sandbox_reload_readings` are active.

## Not captured

- Sequences as objects (only their grants appear in `10-grants.json`), event triggers, publications, foreign data wrappers, casts and operators: not requested.
- Edge Functions, Auth settings, storage buckets: not part of the database catalog.
- Function bodies of extension-owned functions are excluded by design.
