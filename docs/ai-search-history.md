# AI Search history

Status: applied. The read-only views in `supabase/migrations/20261014190000_ai_search_history_views.sql` were created on production on 2026-10-14. An anonymous read of `public.canvas_ai_history_runs` returned exactly three runs. Call rows are 304 (100 + 102 + 102). Citation rows are 713 (468 + 243 + 2). The October 11 run and the earlier October 12 run stayed unpublished. The current published run is still `b28d6086-65f3-4d12-a775-ea724ea58f22`. No stored rows were updated, and no new collection was started.

The public site does not include this history screen until a deploy of this branch is approved. Open the pull-request preview, then AI Search, and use the run control. Do not add `?ai-history=fixture` for the Loom. That flag still opens a labeled copy instead of the database.

The published-run record below was queried on 2026-10-14. A later publish replaced it. As of the 2026-10-22 review, the live published run is the October 18 partial run (id starts `2d55ca62`). This file's row table is still the October 14 review set.

## What the dashboard reads

Opening AI Search Visibility lands every tab on the last 30 days: the 30 UTC days ending on the day of the published run the map shows. The pill names that window, for example "Last 30 days · Oct 5 to Nov 3, 2026". The window counts only published review runs with answered calls. Unpublished review runs, failed or fragment runs, and runs whose calls were all provider errors stay out of it. The two named unpublished review runs still appear in Date range and All time. When the window has no such run, the tabs say "No published run in the last 30 days" and offer the latest run. The pill's menu has Last 30 days and Latest run as one-click choices. Run Summary, Run Details, Product Fact Checks, Citation Ecosystem, and the Competitive Radar rates that read the same calls all follow the pill. Choosing one run, a date range, or All time updates those tabs and stays in place until the pill changes. Rates add numerators and denominators. Citation totals skip a run whose cited URLs were not stored. The map stays on the published run.

The `?ai-history=fixture` copy ends its window on its own latest published run, Oct 12, 2026, so the copy reads the same whatever the live run's day is.

The run control lists the stored review runs from the live views. Choosing one run loads that run's calls, probes, and citations. All time and a date range draw the trend and the pooled figures from the runs in that selection. A later published v11 run that attempted its full battery is included the same way. Fragment runs stay out. After the questions change, the old points stay on the wording that was asked, and the new wording starts its own series once new runs exist.

`?ai-history=fixture` remains available as a labeled copy. It is not the Loom path.

## Review set

Re-queried from `public.canvas_ai_run_history` on 2026-10-14: 468 rows. Collectors: 396 v8, 1 v9, 1 v10, 2 v11, and 68 with no collector. The history calendar offers only these three. October 11 is the only run that day. October 12 has these two and no other fragment.

| Day | Run | What the rows say |
| --- | --- | --- |
| 2026-10-11 | `7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7` | v10, unpublished, historical. 100 answered calls and no error rows. Two calls were not stored: p15 on Perplexity, “What is the best first electric guitar for a total beginner?”, and p24 on ChatGPT, “Best 5-string bass guitar for gigging musicians” Those stay gaps. Six rows are `historical_unverified`. Outcomes were backfilled from the original winner label. 468 citation rows. The copy records the count and does not list each URL. |
| 2026-10-12 earlier | `e775ee16-ec5b-45b0-8918-579181b44aff` | v11, unpublished, partial. Same 102 question-engine pairs and the same prompt text as the published run. Simulation rows: 73 answered, 29 errors. The audit-run counter still says 72 and 30; the history view counts the rows and does not update that counter. 2 citation rows. The panel says those citations were mostly not stored and are not evidence that the citation ecosystem changed. |
| 2026-10-12 published | `b28d6086-65f3-4d12-a775-ea724ea58f22` | The current dashboard run. Partial v11, same prompt text, 75 answered, 27 errors, 243 citation rows. Published 2026-10-12. |

October 11 is labeled “Original winner labels.” Both October 12 runs are labeled “Mention-based scoring.” The trend may connect them. The scoring change is marked and does not break the line. A later change to the stored question wording still breaks the line. This review set does not need that boundary: the stored wording matches the current prompt set.

The earlier October 12 run can contribute to both rate trends. It is not published and it is not the current run.

Every other historical or fragment run stays out of the calendar and the trend.

## Later runs

A future published run is readable when it is published, `completed` or `partial`, collector `v11`, has a prompt-set hash, attempted every expected call, and has no `historical_backfill` or `historical_unverified` row. The two runs named in the migration are readable in addition to that rule. The client uses the same `questionRole()` classifier, denominators, small-sample labels, and drill-downs as the current run. The SQL views do not store a second role.

`prompt_key` is the logical question. The query version is that key plus the exact stored prompt text. Matching wording is one question set even when the older run has no prompt-set hash.

## Authentication

The history views grant `SELECT` to `anon` and `authenticated`, the same as the existing canvas views. They do not grant insert, update, or delete. They do not change stored rows or `canvas_ai_current_run`.
