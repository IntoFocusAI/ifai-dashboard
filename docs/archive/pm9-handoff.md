Archive. Do not follow. The live handoff is `docs/pm-handoff.md`.

# PM9 handoff

You are Project Manager 9. Written Thursday, October 22, 2026 (America/New_York) after Brian Magazu approved PM8's preview and the documentation closeout.

Read the current Functional Design Document and Technical Design Document before you propose anything. Report the first-line documentation version. If that line is still 7.5, this closeout failed and must be fixed before any new feature work.

- FDD: https://docs.google.com/document/d/1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU/edit
- TDD: https://docs.google.com/document/d/1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk/edit
- Addendum (historical context only): https://docs.google.com/document/d/18NVO3vuUbf6Ob9rNJTjYnMnhI1EAXSKPGCu7G262GLI/edit

The first line of both docs is **Documentation version: 8.7**. That was confirmed from the public text export on October 22, 2026.

## How to number work

Project Manager N's workers are N.1, N.2, N.3 in delegation order. The FDD and TDD first line uses that same label. PM7 ended at 7.5. PM8's approved line is 8.7. You start at 9.1. Do not continue 8.x. Do not resume 7.x. Do not insert a 7.6.

Three labels stay separate:

- Documentation version (8.7 now, then 9.1, 9.2, ...)
- Product title version (FDD X-26)
- Feature status (CURRENT, REFINE, TARGET, DECISION, LATER)

Change a feature status only after the running desktop preview is verified and Brian approves. Source or a passing test does not establish CURRENT. A change-log row cites the worker label, the pull request, and the commit. Preserve every DECISION and LATER item unless Brian explicitly changes it. Restoring a whole Google Doc requires approval. X-20 stays TARGET.

## Where the code lives

- Branch: `cursor/visual-pilot-8c53` (do not open a competing history branch)
- Draft pull request: https://github.com/brianw-ifai/ifai-dashboard/pull/45 (base `main`, stays draft until Brian asks)
- Latest code commit: `ee88dcd` ("Remove the MAP tab definition box.")
- Preview: https://deploy-preview-45--ifai-dashboard.netlify.app
- Guest path: Skip Login, or cookie `ifai_guest_fender=1` on that Netlify host

New feature work branches from this head until PR 45 merges, then from `main`. A cloud agent uses its own `cursor/<description>-<suffix>` branch name. Do not start 9.1 on a second copy of the history work.

## Approved behavior to inherit

Do not redo these. They were desktop-verified on the PR 45 preview and approved by Brian Magazu on October 22, 2026.

| Worker | Commit | What shipped |
| --- | --- | --- |
| 8.1 | `844d117` | One pill selects the last 30 UTC days on AI Search and Competitive Radar. The map stays on the published run. |
| 8.2 | `fb2fbcb` | Citation totals add each usable run in the selection once. A run with no stored citations stays out. |
| 8.3 | `5bf81d8` | A pooled window names mixed lead-rate methods beside the rate and hides the small-sample mark. |
| 8.4 | `b5ec559`, `6d529bd`, `c6eb12c` | The pill is the only selection label. Period-restating banners are gone. `f146c5f` is part of that window-copy work. |
| 8.5 | `931cc3f`, `8248f5b` | Competitor wins use unbranded resolved answers. The Competitive Radar sentence reads the same snapshot as the tables. |
| 8.6 | `931cc3f` | A shown Walmart, Musician's Friend, or extra-channel price opens its stored page, or says Not available*. |
| 8.7 | `ee88dcd` | The MAP tab no longer opens with a "What is MAP?" callout. The MAP tooltip stays. |

Verified preview, last 30 days (Sep 19, 2026 to Oct 18, 2026): competitors led 38 of 94 beside Fender/Squier leads 56 of 94. The map stays Unbranded 13 of 21 and Branded 22 of 23. October 18 alone is 8 of 21 beside 13 of 21. The map must not show 38 of 94 or 56 of 94.

The selected period is represented only by the shared date pill. Tabs render the data for that selection. Do not add banners, notices, subtitles, reset buttons, or historical/current/window qualifiers that merely restate the selection. Persistent banners are for loading, errors, empty, or stale data. Method caveats sit beside the affected metric.

## Status after this closeout

- C-02 is CURRENT.
- X-11, R-11, and X-03 stay REFINE. Checked-page links shipped. Formula trails stay blocked by R-06. Many Musician's Friend checks still have no stored URL. The first screenful of each tab still does not lead with the figure everywhere.
- X-09, A-02, and A-06 are unchanged. Do not mark X-09 CURRENT. Do not add an A-06 versus X-09 open decision. A-06 still says citation visuals use the published run only. X-09 still wants a latest-month default. The shipped control is a rolling 30 UTC days on AI Search and Competitive Radar, not a calendar month. A-02 still gates a month default on trustworthy recurring runs (live battery 102 calls; target 306).
- The header title follows FDD X-26.

## Preview links

Same deploy. Guest Skip Login, or cookie `ifai_guest_fender=1`.

- Map (published run): https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard
- Run Summary: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=run-summary
- Run Details: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=run-details
- Product Fact Checks: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=product-fact-checks
- Citation Ecosystem: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=citation-ecosystem
- Category Battlecards: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=competitors&tab=category-battlecards
- Competitor Wins: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=competitors&tab=competitor-wins
- Engine Comparison: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=competitors&tab=engine-comparison
- MAP: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=ecommerce&tab=map

## Recommended first batch, not started

Do not start this until Brian asks. If he does, these are 9.1 and 9.2.

1. **9.1 C-04 "Why not Fender?"** Use stored answers and cited pages only. Label the link an association. Do not invent a cause. Follow the date pill. The map stays on the published run.
2. **9.2 X-03 slice.** On Run Summary and Competitive Radar, the N-of-M figure is the first thing on the screen. The approved sentence stays, because it is that figure. Longer explainers sit under it. No new banners and no period restatements.

## Held until Brian chooses or a later pass

- A-06 versus X-09
- A-02 month gate
- R-06 formulas, and the formula half of X-11
- R-11 storing missing Musician's Friend URLs
- A-04 raw/canonical drawer
- A-07 model-column hover
- N-07 and delegation tiers (DIY, Done-with-You, Done-for-You)
- Client fees, retainers, and any service-fee multiple
- LATER items, including C-05, C-06, X-06, X-30, N-06, and the deep dive
- Phase 1 and full-enterprise dollar formulas. Keep those figures labeled as analyst estimates. Do not invent the formula.

## Rules that already bit this batch

- No em dash (U+2014) in client UI. The month pill uses a middle dot.
- Definition tooltips: class `ifai-term`, `data-ifai-tooltip-title`, `data-ifai-tooltip-desc`, `tabIndex={0}`, `aria-label`. No native `title` on dotted terms.
- Red figures are paired with words.
- `CanvasShell` has a pre-existing ESLint baseline of 8 errors and 4 warnings. Do not grow it, and do not "fix" that baseline in passing.
- TSX files stay at or under 400 lines.
- Do not restart hub bubble slots.
- Do not average rates. Namespace evidence ids as `${audit_run_id}:${call.id}`. A citation enters a total only when `citationSnapshotUsable` says so. Do not feed an already-pooled snapshot back into the pool.
- October 11 (`7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7`) used `original_winner`. October 12 and later v11 runs use `mention_share`. `MIXED_SCORING_NOTE` stays inline next to lead rates. Do not invent a blended rate.
- The published October 12 run is `b28d6086-65f3-4d12-a775-ea724ea58f22`. The earlier October 12 run `e775ee16-ec5b-45b0-8918-579181b44aff` stays out of citation totals. The live published run as of October 22, 2026 is the October 18 partial run, id starting `2d55ca62`.
- `viewRun` must not collapse to month when the chosen id is the published run.
- Competitor win numerator is competitor-led answers where `questionRole === "unbranded_discovery"`. The Competitive Radar sentence is `CompetitorsSpokeDescription`, which reads `useAiSearch()` through `descSlot`. Do not bake that sentence from the published snapshot in `FenderBrandCanvas`.
- Musician's Friend links come from `canvas_listing_channel_price.url` for the ASIN and channel slug `musicians-friend`. `storedHttpUrl` accepts only http(s). Never invent a search URL.
- The MAP glossary tooltip stays. Do not put the "What is MAP?" callout back. Other `ceo-callout` boxes were not part of 8.7.
- `fender-brand-canvas-v3.html` is a static export. The live MAP panel is `components/v3/live/MapChannelPanel.tsx`.

## Tests and the dev server

Unit tests:

```
node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test <files>
```

Local dashboard: `E2E_AUTH_BYPASS=1 npm run dev -- --port 3118`. Do not use 3111 or 3112. `E2E_PORT=3118`. Playwright channel `chrome`. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` inside the server session or the e2e page-error check fails. Do not print Supabase keys. A prior server used tmux session `ai-search-dev` with config `/exec-daemon/tmux.portal.conf`.

Known e2e failures. Do not rewrite them unless Brian asks:

- Map bubble expects Unbranded 13 of 23. Live published is 13 of 21, branded 22 of 23.
- Command center expects "13 of 23 resolved answers (56.5%)".
- All-time trend expects 3 overall rows. Live data has 4.
- The MAP e2e still opens the priority "Fender MAP prices have not been stored", which is no longer a live priority. Worker 8.7 removed only the `toContainText("Minimum Advertised Price")` assertion. Do not invent a new entry path.

Do not commit `test-results/` or screenshot scripts. This is Next.js 16 App Router. Read `node_modules/next/dist/docs/` before writing Next code. The `AGENTS.md` Next.js block is regenerated by `next dev`.

`docs/pm8-handoff.md` is the note PM8 received. It stops at commit `38c0953` and says to leave the docs at 7.5. Leave that file as history. This file is the handoff for PM9.
