# Database writers inventory (Phase 0, 18 Nov 2026)

Every job, role, function and trigger that writes to the production database (project qftczrlksczfimnzfiov). In Phase 4 each one is changed to take a `tenant_id` instead of a schema name and to dual-write to `core`. Sources: `cron.job`, `pg_class`/`pg_proc` ACLs, `pg_trigger`, Toolbelt workflows and scheduled tasks (Fender workspace "AEO_Product_Research-FenderTest" and the Ledlenser workspace), and a scan of this repo.

## 1. Toolbelt: Fender (`command.*`)

Workflows run the wrench directly with no LLM. Prompt tasks are run by an LLM agent following written instructions, which makes them the hardest to port.

| Job | How it runs | Schedule (UTC) | Wrench | Writes |
|---|---|---|---|---|
| Catalog harvester | workflow 8d3b06ee | 02,08,14,20:00 | c4174648 fender_catalog_harvester | fmic_electric_catalog, fmic_job_state |
| Buy Box seller harvester | workflow 0a17de3b | 02,08,14,20:30 | 892063d0 | fmic_electric_catalog buybox cols, fmic_sellers, fmic_job_state |
| Findability weekly recheck | workflow 1bb03a5c | :17, :47 | ac814a8b | fmic_spec_findability_attempt/_current (via record_spec_findability_attempt) |
| Omnichannel Brand Intelligence | workflow 10e1bbed (manual, LLM step) | manual | 5be13583 + 964a76a0 | KPI, division metrics |
| Cost report | workflow 0e8ca226 | :05 | 5b104f82 | storage only, no DB writes |
| Slack watchdog | workflow e2212998 | :25 | ba72bbdd | storage only, no DB writes |
| Spec Readiness auditor | task 72287fdd (wrench) | hourly | db3c834c | fmic_spec_readiness |
| Live catalog metrics recompute | task fe89922a (wrench) | hourly | 5be13583 fender_omnichannel_audit_sync | fmic_brand_kpi_summary, fmic_division_metrics, fmic_retail_buybox_map |
| Off-Amazon MAP leakage checker | task 37afeb74 (wrench) | hourly | 1ecc6b76 | fmic_retail_buybox_map wmt_* |
| Musician's Friend MAP checker | task f75da59f (prompt) | hourly | a4c64ed0 | fmic_retail_buybox_map mf_*, listing_channel_price |
| Keepa history | task f8306707 (wrench) | every 2h | 3eb4e871 | fmic_keepa_daily, fmic_keepa_stats |
| Keepa listing content | task 5b3e8ab7 (prompt) | daily | 5310a0c4 | fmic_listing_content |
| SmartScout snapshot | task 5c1eabf2 (prompt) | Mon weekly | 46730735 | fmic_smartscout_products |
| AI battery start ×3 | tasks cb8b49c5, b31ad442, 38758ecb (prompt) | Sun/Tue/Thu 06:00 | 34d68651 | fmic_audit_runs |
| AI battery worker | task 2c847070 (prompt) | every 30 min | 34d68651 | fmic_ai_simulations, fmic_ai_citations, fmic_audit_runs (publish) |
| AI sub-chat lane | task 2451bb7a (wrench) | every 15 min | 63f7c160 | fmic_ai_simulations, fmic_audit_runs |
| Site type classifier | task 5566cef8 (prompt, owner Brian M) | daily 11:40 | a2bdfbe5 | public.site_type_classifications |
| Copy upkeep: prompt sync + dual-write replay | task bae7ec4b (prompt) | hourly | (several) | the three copies (sandbox, mirror, claude); reads prod |
| Drift checks ×3 | tasks 376fd89b, 2915ab58, 971d9321 (prompt) | every 6h | 75859a8f | copies only, autoRepair off |
| Dashboard metrics sync | task 7d61cb86 (wrench) | hourly | 964a76a0 | storage file fender-v3-spec.json, no DB writes |
| Read-only checks | tasks 5628f294, 3c289d5a (owner Brian M) | weekly / 2h | a7e26aad | none |

Paused (still defined): 4c698d86, 1eca6301 (replaced by workflows), e3895fe8, 1f43a777, sub-chat lanes d08c8f0c, 1a9276f2, 8df75355, 4edb6319, b2096395. Delete these before Phase 4 so nobody turns one back on and writes to old tables.

## 2. Toolbelt: Ledlenser (`ledlenser.*`)

All are workflows with a wrench step and no LLM. The workspace has no scheduled tasks.

| Workflow | Schedule (UTC) | Wrench | Writes |
|---|---|---|---|
| ledlenser_wf_catalog_harvester 653feccf | daily 15:00 | c9086050 | catalog |
| ledlenser_wf_buybox_sellers 1e6afe61 | daily 15:15 | cd9cb626 | catalog buybox cols, sellers |
| ledlenser_wf_omnichannel_sync 3e0870e4 | 03,09,15,21:30 | 0b870a0d | brand_kpi_summary, division_metrics, retail_buybox_map (+ featured offer) |
| ledlenser_wf_walmart_prices 6526704f | 02,10,18:20 | c9e882ff | retail_buybox_map wmt_*, listing_channel_price |
| ledlenser_wf_spec_readiness 9118d36a | every 3h :40 | 74cb4763 | spec_readiness, spec_findability_* |
| ledlenser_wf_keepa_history 2b7f3916 | odd hours :10 | 1ce2e69b | keepa_daily, keepa_stats |
| ledlenser_wf_keepa_content 5a0cce6f | daily 19:20 | e95ed157 | listing_content |
| ledlenser_wf_smartscout_snapshot 08479466 | Tue 16:30 | cf36be66 | smartscout_products |
| ledlenser_wf_ai_battery_start c9e9f84e | Mon/Wed/Fri 08:00 | 4858570e | audit_runs |
| ledlenser_wf_ai_battery_worker eca21fd9 | :00, :30 | 4858570e | ai_simulations, ai_citations, audit_runs |
| ledlenser_wf_ai_subchat 89c6f7a0 | :15, :45 | d6c36609 | ai_simulations, audit_runs |
| zz_tmp_ledlenser_probe_workflow 87436630 | manual, retired | 582c58d2 | none |

The "Writes" columns come from job descriptions and table names. Confirm them against each wrench's source (`wrench_get`) before Phase 4.

## 3. Inside the database

| Writer | Schedule / trigger | Writes |
|---|---|---|
| pg_cron `refresh_stock_loss_v2` | :37 hourly | REFRESH command.mv_listing_sales_loss_v2, mv_listing_offer_state_v2 |
| pg_cron `ledlenser_refresh_stock_loss_v2` | :47 hourly | REFRESH ledlenser.mv_listing_sales_loss_v2, mv_listing_offer_state_v2 |
| pg_cron `sandbox_reload_readings` | daily 14:00 | `sandbox.reload_readings('cl_fender')` rebuilds sandbox from command |
| pg_cron `refresh_stock_loss` | inactive | v1 MVs; drop |
| History triggers | on write | `fmic_capture_history` / `capture_history` → `*_history` on catalog, listing_content, retail_buybox_map, sellers (both brands) |
| Leakage triggers | on write | `fmic_enforce_channel_leakage` / `enforce_channel_leakage` compute stored leakage on retail_buybox_map. D-plan: leakage becomes computed, so these go. |
| Published-run guard | on write | `fmic_ai_block_published_edit` / `block_published_edit` stop edits to published AI rows. Port to core.llm_answer. |
| Prompt guards | on write | four `fmic_ai_prompt_*_guard` triggers on prompt revisions, sets, members. Port with core.prompt_revision. |
| Audit triggers | on write | `write_audit_log` on public org and work tables, `write_set_aside_audit` on issue_set_asides. Out of scope (public stays). |
| `sandbox.action_item` trigger | on write | `tg_action_item_refresh` refreshes sandbox metrics |

## 4. Database roles and grants

| Role | Can write | Notes |
|---|---|---|
| service_role / postgres | everything | Used by Toolbelt wrenches and server code |
| `cursor_map_writer` (login, **BYPASSRLS**) | UPDATE `command.fmic_retail_buybox_map` (map_price, mf_leakage, wmt_leakage) | MAP editor. In core, this moves to INSERT on `core.product_price_rule`. Drop BYPASSRLS when you do. |
| `score_snapshot_writer` (login) | EXECUTE `canvas_score_snapshot_save`, `actuation_expiry_reminder_*`, `actuation_lapse_reminder_candidates` | GitHub Actions secret `SCORE_SNAPSHOT_DB_URL` |
| `cursor_schema_reader` (login) | none | read-only |
| `authenticated` | INSERT/UPDATE/DELETE on 9 `command` tables, 25 `public` tables (all with RLS on) + SECURITY DEFINER RPCs below | dashboard users |
| `anon` | INSERT/UPDATE/DELETE/TRUNCATE on 25 `public` tables (RLS on all; TRUNCATE is Supabase's default grant and isn't reachable through PostgREST) + RPCs below | guest dashboard. Revisit when login ships (X-15) |

SECURITY DEFINER write RPCs that `anon` can call: `ai_prompt_save`, `ai_prompt_set_active`, `mark_issue_done`, `set_aside_issue`, `reopen_set_aside`. **`ai_prompt_save` and `ai_prompt_set_active` do not check who is calling** (they only validate input and the run lock), so anyone with the public anon key, which ships in the browser bundle, can change or switch off Fender's AI battery prompts. The set-aside functions read `auth.uid()` but take the actor's name as an input.

Same RPCs for `authenticated` only: `fmic_ai_prompt_save_draft`, `fmic_ai_prompt_approve_revision`, `fmic_ai_prompt_publish_set`, `actuation_item_save`, `actuation_item_remove`, `actuation_program_save`, `site_type_override`.

## 5. This repo

No `app/api` routes and no `supabase/functions` directory. Nearly every app write goes through an RPC.

| Writer | Trigger | Writes | Credentials |
|---|---|---|---|
| `.github/workflows/score-snapshots.yml` → `scripts/save-score-snapshots.ts` | Mon 18:17 UTC + manual | `canvas_score_snapshot_save` → `public.canvas_score_snapshots` | `SCORE_SNAPSHOT_DB_URL` (`score_snapshot_writer`) |
| `.github/workflows/actuation-reminders.yml` → `scripts/send-actuation-reminders.ts` | daily 19:41 UTC + manual | `actuation_expiry_reminder_claim` / `_release` → `public.actuation_expiry_reminders_sent` | same secret, as `ACTUATION_REMINDER_DB_URL` |
| `components/staff/actuation-actions.ts` | staff save/remove | `actuation_program_save`, `actuation_item_save`, `actuation_item_remove` | `authenticated` session |
| `components/staff/site-review-actions.ts` | staff override | `site_type_override` → `public.site_type_overrides` | `authenticated` |
| `app/auth/organization-actions.ts` | switching organization | direct upsert on `command.user_profiles` (the only direct table write) | `authenticated`, RLS |
| `lib/set-aside/set-aside.ts` (browser) | set aside / done / reopen | `set_aside_issue`, `mark_issue_done`, `reopen_set_aside` → `public.issue_set_asides` (+ audit trigger) | anon key |
| `lib/ai-search/prompt-editor.ts` (browser) | prompt edit / toggle | `ai_prompt_save`, `ai_prompt_set_active` → `command.fmic_ai_prompts`, `fmic_ai_prompt_edits` | anon key |

`ledlenser.ai_publish_run` updates `ledlenser.audit_runs`. Nothing in the app calls it; the Ledlenser battery wrench probably does.

## 6. What this means for Phase 4

- **About 33 active writers:** 16 Fender Toolbelt jobs, 11 Ledlenser workflows, 3 pg_cron jobs, 2 GitHub workflows and the app's RPCs. The same job exists per brand in different shapes: Fender uses prompt tasks and older wrenches, Ledlenser uses wrench-only workflows. Port Ledlenser's pattern and retire Fender's prompt tasks as each job moves over.
- **Seven Fender jobs are LLM prompt tasks** (MF checker, Keepa content, SmartScout, three battery starts, battery worker, plus site types and copy upkeep). Turn each into a workflow wrench step first; an LLM following written steps can't be made to dual-write reliably.
- **Copy upkeep and the drift checks exist only because there are three copies of prod.** Stopping them is part of D-plan rule 3 (one freshness story, no copies).
- **The `cursor_map_writer` and `score_snapshot_writer` roles keep their narrow grants;** only their targets move to `core`.
