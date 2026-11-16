Archive. Do not follow. The live handoff is `docs/pm-handoff.md`.

# PM10 handoff

You are Project Manager 10. Written Friday, October 23, 2026 (America/New_York) after Brian Magazu asked to stop at the AI Search Visibility example and hand the next batch to a new PM.

This handoff is written before Brian approves the 9.1 through 9.5 preview. The code is on the pull request below and was checked on a local desktop preview. It is not approved, and it is not in the Functional Design Document yet.

Read the current Functional Design Document and Technical Design Document before you propose anything. Report the first-line documentation version.

- FDD: https://docs.google.com/document/d/1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU/edit
- TDD: https://docs.google.com/document/d/1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk/edit
- Addendum (historical context only): https://docs.google.com/document/d/18NVO3vuUbf6Ob9rNJTjYnMnhI1EAXSKPGCu7G262GLI/edit

The first line of both docs is **Documentation version: 8.7**. That was confirmed from the public text export on October 23, 2026. Seeing 8.7 is expected. The 9.x documentation closeout has not happened. Do not treat 8.7 as a failed closeout, and do not bump the docs until Brian approves the running PR 46 preview.

## How to number work

Project Manager N's workers are N.1, N.2, N.3 in delegation order. The FDD and TDD first line uses that same label. PM8's approved line is 8.7. PM9 built 9.1 through 9.5 and stopped there. You start at 10.1. Do not continue 9.x. Do not resume 8.x. Do not insert a 9.6.

Three labels stay separate:

- Documentation version (8.7 now; 9.5 only after Brian approves this preview; then 10.1, 10.2, ...)
- Product title version (FDD X-26)
- Feature status (CURRENT, REFINE, TARGET, DECISION, LATER)

Change a feature status only after the running desktop preview is verified and Brian approves. Source or a passing test does not establish CURRENT. A change-log row cites the worker label, the pull request, and the commit. Preserve every DECISION and LATER item unless Brian explicitly changes it. Restoring a whole Google Doc requires approval. X-20 stays TARGET.

When Brian does approve PR 46, the closeout line is 9.5, not 10.0. That closeout is a documentation pass over work already built. It is not a new feature.

## Where the code lives

- Branch: `cursor/why-not-fender-lead-figure-2ff4`
- Pull request: https://github.com/brianw-ifai/ifai-dashboard/pull/46 (base `main`, open, not draft)
- Latest feature commit: `ce1bba9` ("AI Search Visibility bubble group: one hero percentage per bubble, red/yellow/green")
- The commits after `ce1bba9` on this branch are this handoff. Branch new work from the head of `cursor/why-not-fender-lead-figure-2ff4`.
- Preview: https://deploy-preview-46--ifai-dashboard.netlify.app
- Guest path: Skip Login, or cookie `ifai_guest_fender=1` on that Netlify host

PR 46 contains the already approved 8.1 through 8.7 work because PR 45 has not merged. A diff against `main` shows both. PR 45 stays the draft for that earlier batch: https://github.com/brianw-ifai/ifai-dashboard/pull/45 on `cursor/visual-pilot-8c53`. Do not open a third copy of that history.

New feature work branches from the head of `cursor/why-not-fender-lead-figure-2ff4` until PR 46 merges, then from `main`. A cloud agent uses its own `cursor/<description>-<suffix>` branch name. Do not start 10.1 from PR 45.

`docs/pm9-handoff.md` is the note PM9 received. It stops at the 8.7 closeout and recommends 9.1 and 9.2 only. Leave that file as history. This file is the handoff for PM10.

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

Verified on that approved preview, last 30 UTC days (Sep 19, 2026 to Oct 18, 2026): competitors led 38 of 94 beside Fender/Squier leads 56 of 94. The map stays Unbranded 13 of 21 and Branded 22 of 23. October 18 alone is 8 of 21 beside 13 of 21. The map must not show 38 of 94 or 56 of 94.

The selected period is represented only by the shared date pill. Tabs render the data for that selection. Do not add banners, notices, subtitles, reset buttons, or historical/current/window qualifiers that merely restate the selection. Persistent banners are for loading, errors, empty, or stale data. Method caveats sit beside the affected metric.

## Built on PR 46, checked locally, not yet approved

Brian has not approved this preview. Leave the FDD statuses where they are until he does. Local check was the guest-bypass dev server (Chrome) on October 23, 2026, against the live stored runs.

| Worker | Commit | What shipped | FDD until Brian approves |
| --- | --- | --- | --- |
| 9.1 | `5a2b030` | C-04 Why not Fender, from stored answers and cited pages only. | C-04 stays TARGET |
| 9.2 | `5a2b030` | X-03 slice on Run Summary and Competitive Radar. The N-of-M figure leads. | X-03 stays REFINE |
| 9.3 | `ee4d228`, `456af66` | X-23 / H-02. The six main bubbles have no hover explainer. N-of-M stats include the percentage. | X-23 stays TARGET. H-02 stays REFINE |
| 9.4 | `0cfb089`, `455579b` | Signal slots show on bubble hover or focus and close on an outside click. | X-22 stays TARGET |
| 9.5 | `ce1bba9` | AI Search Visibility and its three satellites each show one hero percentage. | No FDD id yet. Do not invent one |

`04d7028` only retriggered the Netlify preview. It is not a feature.

### 9.1 Why not Fender

On Competitor Wins, each competitor-led unbranded answer shows the stored answer and the pages that answer cited. The label is Association. The note is exactly: "Each cited page is an association with the stored answer. It does not show that the page caused the engine to name another brand." No cause text is added. The block follows the date pill.

Code: `lib/ai-search/why-not-fender.ts`, `components/v3/live/ai-search/WhyNotFender.tsx`, glossary term `association` in `lib/ai-search/definitions.ts`. A pooled evidence id is `${audit_run_id}:${call.id}`. `answerLookupId` returns null for those ids so they are not queried on the current-run answer view. Tests: `scripts/why-not-fender.test.ts`.

### 9.2 Lead with the figure (one slice)

On Run Summary the large figures for the last 30 UTC days (Sep 19, 2026 to Oct 18, 2026) are 56 of 94 and 92 of 94. The longer explanation and the trend chart sit under those figures.

On Competitive Radar the sentence leads with "Competitors led 38 of 94 resolved unbranded discovery answers." The rest of that sentence sits under the figure. `competitorsSpokeLead` in `lib/ai-search/canvas-surfaces.ts` returns `{ figure, explainer }`. Category Battlecards opens on Fender/Squier leads 56 of 94.

The map still reads Unbranded 13 of 21 and Branded 22 of 23. The first screenful of every other tab was not part of this slice. That is why X-03 stays REFINE.

### 9.3 Hover explainers removed from the six main bubbles

AI Search Visibility, Catalog Health, AI Readiness, Competitive Radar, Action Items, and Strategy Roadmap do not show a popup on hover. `CanvasGraphNode` skips the tooltip box when `tooltip.desc` is empty. Satellites still have explainers, because they are reached by a deliberate hover.

Wherever a pill bubble still shows an N-of-M figure, the percentage is beside it (for example `PRS 3 wins (14.3%)`).

Action Items and Strategy Roadmap no longer say their figures are a visual example. The dollar figures stay labeled as analyst estimates. Do not invent the formula.

### 9.4 Signal slots

The left-side slots (Performance gap, Opportunity, Next action) mount only while a main bubble is hovered or keyboard-focused, and they swap to the latest hovered bubble. Leaving the bubble does not hide them. A click outside every bubble and outside the slot panel closes them. Opening or closing a spoke panel also clears them.

At `max-width: 1500px`, `.ifai-canvas.panel-hidden:has(.hub-slots) .viewport-container` shifts to `left: 302px`. That shift has `transition: left 180ms ease` on `.viewport-container`. The first 9.4 commit hid the slots on mouse-leave. Combined with the shift, the hovered bubble moved out from under the cursor and the slots flickered. `455579b` removed the mouse-leave and blur close. Do not put that close back.

`e2e/metric-widgets.spec.ts` asserts hover-only visibility, that leaving the bubble does not close the panel, and that an outside click does.

### 9.5 Hero values, AI Search Visibility only

The stat pills on this group overflowed the circle. A pill's max width used the full diameter, and a circle is narrower away from its vertical center. This pass did not fix that geometry for every bubble. It gave this one group a different face: one status-colored percentage and a short label.

Brian locked the values and the bands on October 23, 2026, and said a later PM should use this group as the example for the others. He asked to stop there.

| Bubble | Title on the map | Hero | Red | Yellow | Green | Opens |
| --- | --- | --- | --- | --- | --- | --- |
| `spoke-aeo` | AI Search Visibility | Unbranded SOV | below 30% | 30% through 65% | above 65% | Run Summary |
| `sat-prompts` | Run Details | Brand Consideration | below 70% | 70% through 90% | above 90% | Run Details |
| `sat-citations` | Citations | Fender-Owned Links | below 15% | 15% through 35% | above 35% | Citation Ecosystem |
| `sat-drift` | Fact Checks | Accuracy | below 95% | 95% through 98% | above 98% | Product Fact Checks |

Boundary rule in `heroPctFace`: red when the rate is below the low bound, green when the rate is above the high bound, yellow on the closed interval including both bounds. A zero denominator is neutral, and `pct()` renders "No resolved answers". Do not turn that empty state into a fake 100%.

Fact-check accuracy is `(answersChecked - contradictions) / answersChecked` on `drift.coverage`. That is probe answers compared with a verified fact. It is not `drift.totalChecked`, which also includes commercial answers.

On the local preview of the published run, the map read: AI Search Visibility 61.9% yellow (Unbranded SOV), Run Details 95.7% green (Brand Consideration), Citations 19.1% yellow (Fender-Owned Links), Fact Checks 100.0% green (Accuracy). Those two lead rates are the approved map figures: 13 of 21 is 61.9%, and 22 of 23 is 95.7%.

The map title "Fact Checks" is shorter than the tab "Product Fact Checks". The map title "Run Details" matches its tab. `AI_TABS` in `lib/ai-search/canvas-surfaces.ts` must stay `Run Summary`, `Run Details`, `Product Fact Checks`, `Citation Ecosystem`. Tests and old slugs use those tab strings. Bubble titles and tab names are different fields.

`CanvasNode.heroValue` is `{ value: string; label: string }`, optional. `NodeFace` includes it. `CanvasGraphNode` passes it through. `HeroValue` in `lib/canvas-sdk/GraphPrimitives.tsx` draws it on the centered non-hub face. The number scales down to the circle's width. If the label wraps, the number and the label shrink together until the stack clears the bottom edge. The hub face and the curved-header face ignore `heroValue`. Nodes without `heroValue` still use the stacked pills.

The label on the Run Details satellite is "Brand Consideration", not "Branded Consideration". The longer phrase wrapped to two lines inside the radius-52 circle and crossed the ring. "Branded consideration" remains the phrase in the tooltip and in the panels. Keep satellite labels short enough for one line at radius 52.

Brand Consideration sits on Run Details only because Unbranded SOV is the main bubble's hero. Brian was explicit: if a later brand's main hero is some other metric, the unbranded rate moves to the satellite. Each satellite should eventually carry the most useful discovery for that tab. Run Details does not yet have a headline number of its own. Brand Consideration is the accepted placeholder. Do not build a per-brand hero chooser in passing.

Loading, error, and no-run faces do not set `heroValue`. Their titles are AI Search Visibility, Run Details, Citations, and Fact Checks, and their stats contain no digits. `scripts/ai-search-truth.test.ts` asserts that. The same test requires `satPrompts.meta` to stay `Completed ${completedAt}` and `spokeAeo.meta` to stay `${state} run · ${answered} of ${expected} answered`.

Colors reuse the existing status variables: `.node-hero-value.status-danger`, `.status-warning`, `.status-success` in `lib/canvas-sdk/canvas-sdk.css`.

## Preview links

Same deploy. Guest Skip Login, or cookie `ifai_guest_fender=1`.

- Map (published run): https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard
- Run Summary: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=run-summary
- Run Details: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=run-details
- Product Fact Checks: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=product-fact-checks
- Citation Ecosystem: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=citation-ecosystem
- Category Battlecards: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=competitors&tab=category-battlecards
- Competitor Wins: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=competitors&tab=competitor-wins
- Engine Comparison: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=competitors&tab=engine-comparison
- MAP: https://deploy-preview-46--ifai-dashboard.netlify.app/dashboard?spoke=ecommerce&tab=map

## What to do first

Do not start feature work until Brian asks. If he asks, do these in order.

1. If he has approved the PR 46 preview, write the 9.5 documentation closeout before any 10.x feature. C-04 can move toward CURRENT. X-23 can move toward CURRENT. H-02's acceptance (no duplicated headline stats in the main-bubble hover) is met because those hovers are gone. X-03 stays REFINE. X-22 stays TARGET unless he says the slot behavior matches the desired hover/focus contract. Cite PR 46 and the commits above. The header title follows FDD X-26.
2. **10.1 Hero values, next bubble, proposal only.** Use the 9.5 table as the template. Propose one hero value and red/yellow/green bounds for one next main bubble and its satellites. Wait for Brian to lock them before writing the face. Do not roll the pattern onto Catalog Health, AI Readiness, Competitive Radar, Action Items, Strategy Roadmap, or the hub in the same pass, and do not improvise their bounds.
3. **10.2 X-03 remainder.** The first screenful of each tab that 9.2 did not cover shows the figure before the essay. Run Summary and Competitive Radar already do. No new banners and no period restatements.

## Held until Brian chooses or a later pass

- A-06 versus X-09. A-06 still says citation visuals use the published run only. X-09 still wants a latest-month default. The shipped control is a rolling 30 UTC days on AI Search and Competitive Radar, not a calendar month. Do not mark X-09 CURRENT. Do not add an A-06 versus X-09 open decision.
- A-02 month gate. A-02 still gates a month default on trustworthy recurring runs (live battery 102 calls; target 306).
- R-06 formulas, and the formula half of X-11
- R-11 storing missing Musician's Friend URLs
- A-04 raw/canonical drawer
- A-07 model-column hover
- N-07 and delegation tiers (DIY, Done-with-You, Done-for-You)
- Client fees, retainers, and any service-fee multiple
- LATER items, including C-05, C-06, X-06, X-30, N-06, and the deep dive
- Phase 1 and full-enterprise dollar formulas. Keep those figures labeled as analyst estimates. Do not invent the formula.
- A per-brand chooser for which metric is the main-bubble hero. The AI Search template is fixed: Unbranded SOV on the main bubble, Brand Consideration on Run Details.

## Rules that already bit this batch

- No em dash (U+2014) in client UI. The month pill and the run meta line use a middle dot.
- Definition tooltips: class `ifai-term`, `data-ifai-tooltip-title`, `data-ifai-tooltip-desc`, `tabIndex={0}`, `aria-label`. No native `title` on dotted terms. `title` on an icon-only control is fine.
- Red figures are paired with words. The hero percentage sits under a title, and the bubble ring uses the same status color.
- `CanvasShell` has a pre-existing ESLint baseline of 8 errors and 4 warnings. Do not grow it, and do not "fix" that baseline in passing.
- TSX files stay at or under 400 lines.
- Do not hide the signal slots on mouse-leave or blur. An outside click closes them. Keep the `left` transition on `.viewport-container`.
- Do not average rates. Namespace evidence ids as `${audit_run_id}:${call.id}`. A citation enters a total only when `citationSnapshotUsable` says so. Do not feed an already-pooled snapshot back into the pool.
- October 11 (`7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7`) used `original_winner`. October 12 and later v11 runs use `mention_share`. `MIXED_SCORING_NOTE` stays inline next to lead rates. Do not invent a blended rate.
- The published October 12 run is `b28d6086-65f3-4d12-a775-ea724ea58f22`. The earlier October 12 run `e775ee16-ec5b-45b0-8918-579181b44aff` stays out of citation totals. The live published run as of October 22, 2026 is the October 18 partial run, id starting `2d55ca62`.
- `viewRun` must not collapse to month when the chosen id is the published run.
- Competitor win numerator is competitor-led answers where `questionRole === "unbranded_discovery"`. The Competitive Radar sentence is `competitorsSpokeLead`, read through `descSlot`. Do not bake that sentence from the published snapshot in `FenderBrandCanvas`.
- Musician's Friend links come from `canvas_listing_channel_price.url` for the ASIN and channel slug `musicians-friend`. `storedHttpUrl` accepts only http(s). Never invent a search URL.
- The MAP glossary tooltip stays. Do not put the "What is MAP?" callout back. Other `ceo-callout` boxes were not part of 8.7.
- `fender-brand-canvas-v3.html` is a static export. The live MAP panel is `components/v3/live/MapChannelPanel.tsx`.
- Bubble `title` and tab name are different. Changing a satellite title does not change `AI_TABS`. The Fact Checks bubble opens the Product Fact Checks tab.
- A hero label has to fit one line inside a radius-52 satellite. `HeroValue` shrinks a wrapping label, and the copy should still be short enough that shrinking is a fallback.
- Pending, error, and no-run AI faces must not contain a digit in `title`, `stats`, or `meta`.
- `scripts/ai-search-surfaces.test.ts` has two failures on this branch: "every headline figure opens its evidence" and "citation copy separates answers from links and avoids causal claims". They already failed at `455579b`, before the hero-value commit. Do not rewrite them unless Brian asks, and do not count them as a 9.5 regression.

## Tests and the dev server

Unit tests:

```
node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test <files>
```

The full unit sweep is `scripts/*.test.ts`. On October 23, 2026 it was 229 passing and the 2 failures named above.

Local dashboard: `E2E_AUTH_BYPASS=1 npm run dev -- --port 3118`. Do not use 3111 or 3112. `E2E_PORT=3118`. Playwright channel `chrome`. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` inside the server session or the e2e page-error check fails. Do not print Supabase keys. A prior server used tmux session `ai-search-dev` with config `/exec-daemon/tmux.portal.conf`.

Known e2e failures. Do not rewrite them unless Brian asks:

- Map bubble expects Unbranded 13 of 23. Live published is 13 of 21, branded 22 of 23.
- Command center expects "13 of 23 resolved answers (56.5%)".
- All-time trend expects 3 overall rows. Live data has 4.
- The MAP e2e still opens the priority "Fender MAP prices have not been stored", which is no longer a live priority. Worker 8.7 removed only the `toContainText("Minimum Advertised Price")` assertion. Do not invent a new entry path.

Do not commit `test-results/` or screenshot scripts. This is Next.js 16 App Router. Read `node_modules/next/dist/docs/` before writing Next code. The `AGENTS.md` Next.js block is regenerated by `next dev`. Leave that generated block in place if `next dev` rewrites it; do not delete it as drive-by cleanup.
