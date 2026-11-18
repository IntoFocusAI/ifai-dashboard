# Core multi-tenant migration

Plan documents (shared Drive, 17 Nov 2026): `rm-multi-tenant-migration-plan.md`, `rm-schema-mapping-old-to-new.md`, `rm-core-schema-diagrams.md` (and `.html`), `rm-frontend-effort-assessment.md`.

## Decisions (18 Nov 2026, Brian Watson)

| ID | Decision | Effect on the plan |
|---|---|---|
| D0 | Move to one `core` schema with `tenant_id` on every table. | No new per-brand schemas or brand-named columns, including for Ledlenser. Brand #3 onboards straight into `core`. |
| D1 | Identity stays on `public.organizations` and its memberships (the plan's default, not yet confirmed). | `core.tenant.org_id` points to it. The duplicate org tables in `command` are dropped in Phase 6. |
| D2 | External and dealer users will log in later. | Build `core.member_scope` in Phase 0 so access rules aren't retrofitted. Login and permission UI come later. |
| D3 | Keep 13 months of raw observations in **monthly** partitions, keep daily rollups forever, and move raw data older than 13 months to cold Parquet storage. | Replaces the "30 days, daily partitions" wording in the plan. Revisit if one tenant's monthly partition passes about 10M rows. |
| D4 | Sandbox data is backfilled into `core` through the same crosswalk. | Not thrown away. |
| D5 | Brian Watson approves database changes. Each change gets a Slack FYI drafted to Brian Magazu. | AGENTS.md "Database changes" updated. |

## Phase 0 checklist

- [x] Snapshot every live `canvas_*`, `canvas_private.*` and `ledlenser_private.*` view into `supabase/view-snapshots/` with `scripts/snapshot-canvas-views.sh` (87 views on 18 Nov 2026). This becomes the contract the `core`-backed read layer must match. If the CLI has no project access, run the query in the script in the Supabase SQL Editor, copy the JSON result, and pass that file to `scripts/snapshot-canvas-views.py`.
- [ ] Contract tests: same fixtures, same column names, types and meaning for each view.
- [ ] List every job that writes to the database (workflows, workers, edge functions, Toolbelt wrenches), including the MAP writer role `cursor_map_writer`.
- [ ] Write the `core` DDL, RLS and partitions as migration files. They only add objects.
- [ ] Finish the cut-off §9 (crosswalk keys) of the mapping document.

## What the snapshot shows (things the core read layer must settle)

- **Fender and Ledlenser count AI wins differently.** `public.canvas_metrics` takes `sim_*` from `canvas_private.sims_all`, which includes the run-1 archive and matches on the winner text 'Fender/Squier'. `ledlenser.canvas_metrics` reads `ledlenser.ai_simulations` by outcome. Pick one definition before porting.
- **Hard-coded values.** `canvas_private.ai_history_runs`/`ai_history_calls` force two Fender run ids into history and pin `collector_version = 'v11'`. `public.canvas_ai_probe_coverage` defaults models in scope to 180, while Ledlenser counts its brand sheet. `public.canvas_competitor_sov` hard-codes 'Fender/Squier'.
- **Brand-named columns across 9 views.** `fender_*` vs `brand_site_*`, `fender_win` vs `brand_win`, `probe_fender_sku` vs `probe_brand_sku`, plus `mf_*` columns that exist only for Fender. The core read layer keeps the old names as aliases until the frontend rename (Path 3).
- **Extra or legacy views.** Fender has `canvas_listing_sales_loss` (v1), `canvas_listing_stock_episodes`, the set-aside and site-type views, and no `canvas_client_config` or `canvas_ai_prompts`. Ledlenser has `canvas_client_config` and `canvas_ai_prompts`. Check which ones the frontend still reads before porting them.

## Can be done now, separate from the migration

- Index the 52 foreign keys that have no index (additive).
- Fix the RLS initplan warnings from the Supabase advisor.
- Delete `fender-brand-canvas-v3.html` (1.7 MB) from the repo root.
