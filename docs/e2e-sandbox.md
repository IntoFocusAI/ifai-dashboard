# Browser tests on the sandbox copy

The Playwright suite can read the **sandbox** Supabase project (`ltkotsvnkslewecaicvv`) instead of production (`qftczrlksczfimnzfiov`). Set up 17 Nov 2026, approved by Brian Watson. Production was only read.

## Run the suite on sandbox

```bash
URL=$(grep '^SANDBOX_SUPABASE_URL=' .env.local | cut -d= -f2-)
KEY=$(grep '^SANDBOX_ANON_KEY=' .env.local | cut -d= -f2-)
E2E_SUPABASE_URL="$URL" E2E_SUPABASE_ANON_KEY="$KEY" \
NEXT_PUBLIC_SUPABASE_URL="$URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$KEY" \
E2E_PORT=3123 npx playwright test           # any free port except 3111
```

Set `NEXT_PUBLIC_SUPABASE_URL` to sandbox in the shell too. The session tests (Actuation records, Sites to review, Security) name their login cookie after the project in that variable; pointed at production, the sandbox dev server ignores the cookie and those tests fail. Do not `source .env.local` for the run, which sets it to production.

Two workers by default (`E2E_WORKERS` changes it). Runs on sandbox put no load on production.

**Sandbox is a smaller database than production** and has the same 3 s limit on public reads. With two workers, pages that start many reads at once (the AI Search run-rows function, `canvas_metrics`, the spec views) sometimes pass 3 s and return 500, which the tests count as page errors. See the results below.

## What sandbox has

- **Fender (`public`, `command`).** Fender data reaches sandbox from the Fender jobs, so it stays current. Fender figures on sandbox can still differ slightly from production, for example during an AI run that is open on one and not the other.
- **Ledlenser (`ledlenser`, `ledlenser_private`).** Created from the migration files. **Ledlenser jobs do not write to sandbox**, so its Ledlenser data is a snapshot of production taken **17 Nov 2026**. Ledlenser freshness dates on sandbox stop at that day. Refresh it as below when tests need newer data.
- **Exposed to the API:** `public, graphql_public, command, sandbox, ledlenser`. Set in the database with `ALTER ROLE authenticator SET pgrst.db_schemas = ...`. If anyone edits **Settings > API > Exposed schemas** in the Supabase dashboard for sandbox, keep `ledlenser` in the list, or the dashboard setting can overwrite this one.
- **Grants:** `anon` and `authenticated` have the same grants as production on `public`, `command` and `ledlenser` (checked 17 Nov). Sandbox had wider grants before; they were narrowed to match.

### Migrations applied on 17 Nov

Every file in `supabase/migrations` from `20261014190000` to `20261116233000` that sandbox lacked, in order, recorded in sandbox `supabase_migrations.schema_migrations`. Exceptions:

| File | What happened |
|---|---|
| `20261111205426_fender_battery_wave2` | Not applied: sandbox had an AI run in progress, which the file refuses. Its prompts were already on sandbox from the Fender jobs. |
| `20261111222745_check_times_retail_and_stock` | Applied after the Ledlenser data load. Its check that `public.canvas_retail_listings` rows are unchanged was turned into a notice for this one run, because sandbox's old view was out of date. |
| `20261116210000_score_snapshot_writer_role`, `20261116234000_actuation_reminder_grants` | Not applied: production-only login for the weekly score job. |

Ten functions and `public.canvas_metrics` had been changed on production outside migration files. They were copied from production's definitions, with their grants.

## Refresh the Ledlenser snapshot

Use the Toolbelt wrench **`sandbox_copy_prod_table_readonly`** (Fender Toolbelt workspace). It checks both project URLs, reads production with `SELECT` only, and inserts into the same table on sandbox with triggers off (so history tables are not doubled).

1. Empty the Ledlenser tables on sandbox (sandbox only):
   ```sql
   SELECT 'TRUNCATE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' CASCADE'
   FROM pg_tables WHERE schemaname = 'ledlenser';   -- run the statement this returns
   ```
2. Run the wrench once per `ledlenser` table with inputs `table`, `cols` (all columns except generated ones, such as `retail_buybox_map.leakage_amount`), `orderBy` (the primary key) and `chunk` (rows per read; keep each read under about 1 MB: 300 for `ai_simulations`, 4000 for `keepa_daily`). It returns `done: false` and `nextOffset` if it stops early; rerun with that `offset`.
3. Refresh the two materialized views on sandbox:
   ```sql
   REFRESH MATERIALIZED VIEW ledlenser.mv_listing_sales_loss_v2;
   REFRESH MATERIALIZED VIEW ledlenser.mv_listing_offer_state_v2;
   ```
4. Check row counts against production and update the snapshot date above.

17 Nov row counts: ai_citations 10,850; ai_simulations 4,805; ai_probe_plan 207; ai_prompts 32; audit_runs 66; brand_catalog 97; brand_kpi_summary 424; catalog 922; catalog_history 6,453; client_config 1; division_metrics 477; job_state 18; keepa_daily 66,539; keepa_stats 922; listing_content 922; listing_content_history 2,735; retail_buybox_map 201; retail_buybox_map_history 5,159; sellers 37; sellers_history 37; smartscout_products 224; spec_findability_attempt 2,888; spec_findability_current 195; spec_readiness 2,888. Empty on production too: ai_probe_facts, ai_remediations, listing_channel_price.

Also copied from production on 17 Nov: `public.site_type_classifications` (575), `public.canvas_score_snapshots` (2), `public.issue_set_asides` (1), and 96 `command.fmic_ai_probe_plan` rows for the open Fender run.

## Check the API after a change

With the sandbox anon key, every `canvas_*` view the dashboard reads should return 200 (206 with a `Range` header), for both `Accept-Profile: public` and `Accept-Profile: ledlenser`. `public.canvas_ai_prompts` and `rpc/canvas_ai_history_run_rows` under `ledlenser` return 404 on production as well: Fender's prompt list comes from `rpc/ai_prompts_list`, and the AI Search history screen falls back when a schema has no run-rows function.

## Results on 17 Nov

364 tests. Taking the full run and a rerun of its failures together, with the command above and two workers: 336 passed, 19 failed, 9 skipped.

| Why it fails | Tests |
|---|---|
| Sandbox is slower. Reads pass 3 s and return 500 when many run at once; most of these pass on a rerun. | figure-first audit tabs, AI Search final form download, Roadmap plan, Action Items list layout |
| Does not depend on the database: mocked reads or map motion. Expected to fail on production too. | spec-tables-one-home (`100.0%*`), page-found-findability-link (Reason filter), map-interaction at 1440 (2), metric-destinations (bubble covers the slot) |
| Depends on current data, which matches production | action-items-fix-list (`29.4%*`), table-toolbar Fender (row count changes while the list loads), C-01 deck Ledlenser slide b1 overflows |

Raising the sandbox `anon` read limit to 8 s made things worse: slow reads queued up and the API began refusing requests. It was set back to 3 s. For a clean run, either give sandbox more compute or run with `E2E_WORKERS=1`. One worker still left 15 failures, the same groups as above.
