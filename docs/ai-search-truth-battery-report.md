# AI search battery report

Date: 2026-10-12. Collector: `fender_ai_simulation_battery_v11` version 2. Prompt set: 34 prompts (p01 to p34), hash `7336a48b5f1b2e7be7136319aee3d454`. Engines: ChatGPT (search on), Perplexity, Gemini.

## Result: PARTIAL, published

Run `b28d6086-65f3-4d12-a775-ea724ea58f22`: expected 102, attempted 102, answered 75, errors 27. Published (`is_published = true`) as the current run. The state is `partial` because of provider failures, not missing attempts.

| Engine | Answered | Errors | fender_win | competitor_win | unresolved | Probes answered | Citation rows |
|---|---|---|---|---|---|---|---|
| ChatGPT | 34 of 34 | 0 | 24 | 4 | 1 | 5 | 125 |
| Gemini | 34 of 34 | 0 | 21 | 7 | 1 | 5 | 62 |
| Perplexity | 7 of 34 | 27 | 6 | 1 | 0 | 0 | 56 |
| Total | 75 of 102 | 27 | 51 | 12 | 2 | 10 | 243 |

Commercial win rate (resolved only, no confirmed hallucination): ChatGPT 85.7 percent of 28, Gemini 75.0 percent of 28, Perplexity 85.7 percent of 7. Perplexity has too small a sample to compare.

Probes: 10 answered. 8 were checked against a verified fact and none contradicted it. 2 (p18, ChatGPT and Gemini) are `not_evaluated` because no fact exists. 0 confirmed hallucinations.

## Why it is partial

All 27 errors are Perplexity ("empty answer" in the collector). Calling Perplexity directly through the AI-Search tool returned "Provider failed the job. Retry at no charge." on every direct test that day, so this is a provider-side failure, not a parser fault. Each cell was retried across several chunks. ChatGPT and Gemini had a few 80 and 120 second timeouts, and all of those succeeded on retry. Retrying later may fill the Perplexity cells.

## Validation checks done

- Sandbox and prod migrations 1 to 4 applied and compared. Part 1 was run twice (idempotent). The backfill matched prod with no rows lost.
- Publishing a run worked, editing a published run raised "is published and immutable", and `error` rows are kept.
- Current views on prod return 1 run, 102 calls, 15 probes, 27 errors, 243 citations across 93 domains.
- Grants on the 9 canvas AI views: anon and authenticated SELECT only, service_role full.
- An earlier run `e775ee16-ec5b-45b0-8918-579181b44aff` (72 of 102, 0 citations, collector v1) is left unpublished. The earlier proof run `7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7` is labeled `historical`.
- Citation gap found and fixed: ChatGPT returns citations only with search on.

## Open items

- Probe facts p17, p19, p33 and p34 are pending Brian review. p18 has no fact.
- Weekly schedule `cb8b49c5-c605-4098-a6bd-4e2ac53479a1` was switched to v11 on 2026-10-14. It stays weekly. A reconciled run with every expected call stored is published, including when an engine returned errors. There is no per-engine or overall answer-rate floor. A run that did not store every cell does not replace the current dashboard.
- Re-run Perplexity cells when the provider recovers, then publish a new run (it becomes current, the old one stays as history).