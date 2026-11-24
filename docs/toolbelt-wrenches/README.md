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

Not changed: R-15 search (558a63f3, 1a08597d) and Buy Box harvesters (892063d0, cd9cb626), updated
earlier on 23 Nov, and wrenches run by Toolbelt scheduled tasks rather than workflows (for example the
MF checker a4c64ed0 and Walmart checker 1ecc6b76). To add the guard to one later, prepend the block,
fill `__CR` (`self` = wrench id, `servers` = its requiredMcpServers, `stepMs` = the calling step's
timeout), and rename its `run(` to `__runMain(`.
