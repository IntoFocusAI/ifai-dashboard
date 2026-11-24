# Toolbelt wrench drafts

Source for Toolbelt wrench versions that are written but **not yet active**. Toolbelt keeps the live
code; these files exist so a reviewer can read a change before it ships and so the draft isn't lost.
Once a version is activated in Toolbelt, delete its file here in the same PR that records it.

None pending. The last drafts (Fender Walmart v15, Fender MF v18, Ledlenser Walmart v7, PR #244) were
activated on 23 Nov 2026 and removed from here.

Activate with `wrench_update` (scriptContent = the file, setActive true), then run each once with `dryRun: true` on a few ASINs.

## Rollback copies: connect retry (24 Nov 2026)

Twice on 23 Nov a scheduled run failed in 0.3 s with `MCP server "…" (Supabase (IntoFocus AI)) could not
be connected` (Findability workflow `1bb03a5c`, execution `1b96cbd4`; earlier the MF checker). Toolbelt
connects a wrench's MCP servers once, when the run starts; `callTool` only looks the connection up, so
retrying `callTool` in the same run cannot help. A new execution does connect again.

Each wrench below now starts with the block in `connect-retry-guard.js`: before any work it calls
`listTools` on each required server; if one "could not be connected", it waits 10 s (then 20 s) and runs
itself again through `workspace` `wrench_execute` with the same inputs. Nothing has been read or written
at that point, so no write can run twice. Other errors are not retried. The original code follows
unchanged, with `run()` renamed `__runMain()`.

The `<name>.v<N>.js` files here are the versions that were active before the change. Roll back by
re-saving a file with `wrench_update` (scriptContent = the file, setActive true).

| Workspace | Wrench | ID | Old → new |
|---|---|---|---|
| Fender | fender_findability_recheck | ac814a8b | v3 → v4 |
| Fender | fender_catalog_harvester | c4174648 | v16 → v17 |
| Fender | fender_daily_cost_report | 5b104f82 | v5 → v6 |
| Fender | fender_slack_watchdog | ba72bbdd | v12 → v13 |
| Ledlenser | ledlenser_walmart_price_audit | c9e882ff | v8 → v9 |
| Ledlenser | ledlenser_spec_readiness_audit | 74cb4763 | v4 → v6 (v5 is the inactive D-05 draft) |
| Ledlenser | ledlenser_ai_subchat_collector | d6c36609 | v2 → v3 |
| Ledlenser | ledlenser_ai_search_battery | 4858570e | v2 → v3 |
| Ledlenser | ledlenser_smartscout_snapshot | cf36be66 | v1 → v2 |
| Ledlenser | ledlenser_keepa_content_enrich | e95ed157 | v1 → v2 |
| Ledlenser | ledlenser_keepa_history_harvester | 1ce2e69b | v1 → v2 |
| Ledlenser | ledlenser_omnichannel_audit_sync | 0b870a0d | v2 → v3 |
| Ledlenser | ledlenser_catalog_harvester | c9086050 | v2 → v3 |

Second pass, same day: wrenches run by Toolbelt scheduled tasks (all in the Fender workspace; the
Ledlenser workspace has no scheduled tasks). For prompt tasks the assistant calls `wrench_execute`
with the task's timeout; `stepMs` is that timeout (per action for the battery).

| Workspace | Wrench | ID | Old → new | Task / timeout |
|---|---|---|---|---|
| Fender | fender_map_checker_musiciansfriend | a4c64ed0 | v19 → v20 | f75da59f prompt, 240 s |
| Fender | fender_retail_buybox_map_audit | 1ecc6b76 | v16 → v17 | 37afeb74 wrench, 420 s |
| Fender | fender_spec_readiness_audit | db3c834c | v13 → v15 (v14 is the inactive D-05 draft) | 72287fdd wrench, 420 s |
| Fender | fender_dashboard_metrics_sync | 964a76a0 | v6 → v7 | 7d61cb86 wrench, 120 s |
| Fender | fender_omnichannel_audit_sync | 5be13583 | v15 → v16 | fe89922a wrench, 600 s |
| Fender | fender_keepa_history_harvester | 3eb4e871 | v2 → v3 | f8306707 wrench, 330 s |
| Fender | fender_ai_subchat_collector | 63f7c160 | v13 → v14 | 2451bb7a wrench, 600 s |
| Fender | fender_ai_simulation_battery_v11 | 34d68651 | v18 → v19 | battery start/worker prompts, 120 s (chunk 540 s) |
| Fender | fender_keepa_content_enrich | 5310a0c4 | v2 → v3 | 5b3e8ab7 prompt, 330 s |
| Fender | fender_smartscout_snapshot | 46730735 | v3 → v4 | 5c1eabf2 prompt, 280 s |
| Fender | fmic_sandbox_drift_check | 75859a8f | v9 → v10 | 3 drift-check prompts, 180 s |
| Fender | fmic_ai_prompts_sync | 98d15382 | v1 → v2 | bae7ec4b prompt, 120 s |
| Fender | fmic_dual_write_replay | d24cb6e6 | v3 → v4 | bae7ec4b prompt, 180 s |
| Fender | fender_ai_battery_stall_alert | a7e26aad | v1 → v2 | 3c289d5a prompt, 120 s |

Not changed: R-15 search (558a63f3, 1a08597d) and Buy Box harvesters (892063d0, cd9cb626), updated
earlier on 23 Nov; and site_type_classifier_21a (a2bdfbe5), whose task (5566cef8, approved by Brian M)
says never to retry it. To add the guard to another wrench, prepend the block, fill `__CR` (`self` =
wrench id, `servers` = its requiredMcpServers, `stepMs` = the calling step's timeout), and rename its
`run(` to `__runMain(`.
