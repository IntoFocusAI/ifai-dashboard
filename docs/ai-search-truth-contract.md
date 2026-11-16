# AI Search Truth: data contract

Status: FINAL for Phase 2. Backend only. Do not read any table directly from the UI. Read the `public.canvas_ai_*` views and `canvas_freshness`.

## 1. Current-run rule

The current run is the latest explicitly PUBLISHED run (`is_published`, ordered by `published_at` then `id`), with `run_state` in (`completed`, `partial`), a prompt set hash that matches, and counts that reconcile. It is never the newest timestamp and never a union of runs. A published run is immutable (a trigger raises "is published and immutable" on edit). Publishing is done only by `command.fmic_ai_publish_run(uuid)`. The collector never publishes.

The AI Search tabs also have a separate selection. Their default is the stored review runs from the last 30 UTC days ending on the published run's day. A date range, All time, or one chosen run replaces that window on every tab in the bubble. That selection does not replace `canvas_ai_current_run`. The map stays on the published run.

Current published run at the time of this contract: `b28d6086-65f3-4d12-a775-ea724ea58f22`, `partial`, 75 of 102 answered, 27 errors (all Perplexity, provider failures).

## 2. Views (all `security_invoker = false`, SELECT only for anon and authenticated)

| View | Grain | Use |
|---|---|---|
| `canvas_ai_current_run` | 1 row | audit_run_id, run_state, collector_version, prompt_set_hash, expected_calls, attempted_calls, answered_calls, error_calls, started_at, completed_at, published_at, missing_calls |
| `canvas_ai_simulations` | 1 row per call (102) | existing columns kept in name, order and type, with new columns appended (see section 3) |
| `canvas_ai_category` | per category, commercial prompts only | total_sims, resolved, fender_wins, fender_win_pct, top_competitor, top_competitor_wins, top_competitor_pct, sov_gap_pts, unclear, errors, hallucinations |
| `canvas_ai_engine` | per engine, commercial only | total_sims, resolved, fender_wins, fender_win_pct, hallucinations |
| `canvas_competitor_sov` | per category plus an `all` rollup | competitor, wins, category_resolved, sov_pct |
| `canvas_ai_probes` | 1 row per probe call (15) | verified_claim, verified_source_url, verified_at, material_hallucination, hallucination_evidence |
| `canvas_ai_citations` | 1 row per citation | audit_run_id, sim_id, simulation_id, prompt_key, prompt_kind, category, engine, position, url, domain, title |
| `canvas_ai_run_history` | 1 row per AI run | run_kind, run_state, is_published, counts, timestamps (shows historical and unpublished runs) |
| `canvas_freshness` | job rows plus `ai_simulations` | for `ai_simulations`: last_run_at is the run completed_at, updated_at is published_at |

## 3. Outcome vocabulary

`call_status`: `answered` or `error`. An error row exists for every failed call, with `error_message`. Errors are never dropped and never counted as wins or losses.

`outcome`:
- `fender_win`: commercial prompt, Fender/Squier family named more than any competitor (word-boundary mention share).
- `competitor_win`: a competitor was named more. `primary_brand` holds the brand.
- `unresolved`: no clear leader.
- `error`: call failed.
- `not_scored`: probe prompts (fact checks, not share of voice).

`material_hallucination` (probes only): `confirmed` (answer contradicts a verified fact in `fmic_ai_probe_facts`, with `hallucination_evidence`), `none` (checked against a fact, no contradiction), `not_evaluated` (no verified fact, or call failed). Never show a hallucination as confirmed without evidence.

`prompt_kind`: `commercial` (87 calls) or `probe` (15 calls: p17, p18, p19, p33, p34 times 3 engines).

## 4. Metric definitions

- Win % = `fender_win` with no confirmed hallucination, divided by resolved (`fender_win` plus `competitor_win`), commercial rows only.
- Errors, unresolved rows and probes are separate buckets. Do not fold them into the denominator.
- The raw `winner` column is for audit only. Use `outcome` and `primary_brand`.
- Completeness: show `answered_calls` of `expected_calls` and `missing_calls` from `canvas_ai_current_run`. When `run_state = 'partial'`, the UI must say so and name the engines with errors.
- Historical rows are labeled `record_origin = 'historical_backfill'` and are not in the current-run views. Legacy flags became `historical_unverified`.

## 5. Remediation and root cause

`remediation_patch` and `root_cause` are null unless a real row exists in `fmic_ai_remediations`. Legacy snippets were deliberately not copied. The UI must show no remediation when the value is null, and must not invent one.

## 6. Probe facts (pending Brian sign-off)

| Prompt | Verified claim | Source |
|---|---|---|
| p17 | Player II Strat radius 9.5 in | https://www.fender.com/products/player-ii-stratocaster |
| p19 | Mustang Micro is digital, no tubes | https://www.fender.com/products/mustang-micro |
| p33 | Jaguar scale length 24 in | https://www.fender.com/articles/behind-the-scenes/from-surf-to-shoegaze-a-history-of-the-jaguar |
| p34 | Player Plus Strat uses Player Plus Noiseless pickups | https://au.fender.com/products/player-plus-stratocaster-left-handed (US page returned 404) |

p18 (Telecaster body wood) has no fact, so it is always `not_evaluated`.

## 7. Citations

Parsed from the engine response into `fmic_ai_citations`, one row per unique URL per call, with the domain extracted. ChatGPT only returns citations when asked with search on, so the collector sets `search: true` for ChatGPT. Current run: 243 citation rows across 93 domains. Perplexity has citations on only its 7 answered calls.

## 8. Writer and schedule

Collector: wrench `fender_ai_simulation_battery_v11` (actions start, chunk, finalize, status). The wrench never publishes by itself.

Weekly schedule `cb8b49c5-c605-4098-a6bd-4e2ac53479a1` on assistant `AEO_Product_Research-FenderTest` is active. Recurrence is Weekly, anchored at 2026-10-04 06:00 UTC. The last v10 execution observed in run history was 2026-10-11 06:02 UTC, so the next fire is 2026-10-18 06:00 UTC. On 2026-10-14 the schedule prompt was switched from v10 `fender_ai_simulation_battery_real` to v11. It collects one run, finalizes it, and calls `command.fmic_ai_publish_run` when every expected call is stored and the run reconciles. There is no minimum answer rate, overall or per engine. Provider errors stay on the published run and stay visible. A run that is still going, failed before every cell was stored, or whose counts do not reconcile remains unpublished, and the prior published run stays current. On 2026-10-26 the per-engine 70% floor was removed from `command.fmic_ai_publish_run` because it had left the finished October 25 run unpublished.

## 9. Known limits

- Perplexity returned "Provider failed the job" for about 80 percent of calls on 2026-10-12 even when called directly, so the current run is `partial`. Engine comparisons must show the sample size per engine (ChatGPT 28 resolved, Gemini 28, Perplexity 7).
- Probe patterns are regexes and can miss paraphrases. `none` means no contradiction was matched, not a guarantee of accuracy.