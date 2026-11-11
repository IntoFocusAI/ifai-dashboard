Archive. Do not follow. The live handoff is `docs/pm-handoff.md`.

# PM8 handoff

Internal note for the next product manager. Written Thursday, October 22, 2026 (America/New_York) after Brian Magazu reviewed the Citation Ecosystem preview and asked to stop before the next batch.

## Where the work lives

- Branch: `cursor/visual-pilot-8c53`
- Draft pull request: https://github.com/brianw-ifai/ifai-dashboard/pull/45 (base `main`)
- Preview: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=citation-ecosystem
- Latest code commit already pushed: `38c0953`: "Add the last 30 days of citations instead of one run."
- Working tree was clean when this handoff was written. This file is the only new commit on top of `38c0953`.

Parent commits on the same branch, oldest first:

| Commit | What it is |
| --- | --- |
| `1fdbfc0` | Approved FDD labels (terminology batch) |
| `031d89c`, `10ede0c` | Run Details fact-check column cleanup |
| `edaa5a5` | Hub bubble slots |
| `1a78ab6` | First Citation Ecosystem redesign |
| `2b54143` | Split confounded rates, light theme, em dash |
| `b94be7b` | One-run glance. Superseded in behavior by the next commit. |
| `38c0953` | Month, range, and all-time citation totals |

Documentation stays at 7.5. Leave FDD and TDD status as they are until Brian reviews the Netlify preview. Do not mark them CURRENT. Do not bump the docs to 7.7 in the same change as the next code batch.

## What already shipped

### Hub

Hover or keyboard-focus a main bubble. The three cards on the left follow that bubble: Performance gap, Opportunity, and Next action. Each card has a status word and a large figure. A chart appears only when the count has a real denominator. Clicking a card opens its evidence tab. The Phase 1 dollar figure stays labeled as an analyst estimate. Laptop overlap of the slots was fixed in `edaa5a5`. Leave that layout alone.

### Citation Ecosystem, current behavior

The tab adds stored review runs together. It no longer shows one snapshot by default.

Verified on live data Thursday, October 22, 2026:

- Default window is the last 30 UTC days ending on the published run's day. October 18 yields September 19 through October 18. Usable runs in that window are October 11, the published October 12 run, and October 18.
- Hero: **10 of 74** unbranded discovery answers cited a Fender-owned page. **13.5%** is red (`#e11d48`). The words "cited a Fender-owned page" sit beside the percent so red is not the only signal.
- The first pie (`data-citation-pie="unbranded"`) is that same 10 of 74 split. Its total equals the hero denominator.
- Middle card: source-class mix of **799** cited links, then question-type bars shown by default (not inside a disclosure). Unbranded bar is 10 of 74.
- Right card: brand websites cited in unbranded discovery (links, not answers). On this window: Fender 12, Yamaha 6, Gibson 2, Taylor 2, Sire 1.
- Second row: top cited domains and the largest gaps (categories where a competitor led and no Fender page was cited).
- Date range October 11 to October 12: **8 of 53**, **15.1%**, **574** cited links, 2 runs added, 1 left out. Pill reads "Oct 11, 2026 to Oct 12, 2026".
- All time on current live data is the same three usable runs as the month: 10 of 74.
- The earlier October 12 run (`e775ee16-ec5b-45b0-8918-579181b44aff`) is left out. It stored 2 citation rows. The window line says so.
- Small-sample text is hidden on an aggregate window. A single selected historical run still shows it.
- Chart slices and the terms Unbranded discovery and Branded consideration use `.ifai-term` plus `data-ifai-tooltip-title` and `data-ifai-tooltip-desc`. They do not use a native `title`.
- Header stat chips are hidden only when the active tab title is Citation Ecosystem. Run freshness is hidden only on that tab's single-run gate. Other tabs still show freshness.
- No "Partial run" line on the citation panel. The spoke description no longer starts with "Partial published run."

Single-run October 18 facts are still true of that run. They are no longer the citation default: unbranded Fender led 13 of 21 (61.9%); branded 22 of 23 (95.7%); any shopping citation 55 of 64 (85.9%) across 225 links; Fender-owned pages on that run alone were 2 of 21 unbranded and 6 of 23 branded.

## The pill and the citation numbers disagree on purpose

On the default view the pill says **Current run · Oct 18, 2026**. Citation Ecosystem reports the last 30 days (10 of 74). Run Summary, Run Details, Product Fact Checks, and Competitive Radar still follow the published October 18 run. A date range still draws a trend on Run Summary and banners the other non-citation tabs with "This tab shows the current published run."

Brian named this on October 22 and asked to move on without fixing it on this tab. His read was correct: the mismatch is the dashboard-wide history model, not a citation-only wiring bug.

Leave the mismatch in place. Two local patches would make the next batch worse:

- Changing Citation Ecosystem back so it matches today's "Current run · Oct 18" pill undoes the month total he asked for.
- Changing only the pill label to "Last 30 days" while the other tabs stay on October 18 makes the pill lie about those tabs.

The selection has to live on the shared pill (`RunHistoryControl`, `HistoryMode` in `lib/ai-search/history-mode.ts`). Today `kind: "current"` means the published run, and `historyControlLabel` prints `Current run · {day}`.

`useDisplayedAiSearch` returns a historical snapshot only when `mode.kind === "run"`. For `range` and `all` it still returns the published run to every tab except Citation Ecosystem, which opts into `followsRange` and then aggregates. `AiSearchSurface`'s comment that Citation Ecosystem follows the range one snapshot at a time is stale. The code aggregates.

## PM8's job

Apply one history selection to every tab inside the AI Search Visibility bubble.

Brian's words, October 22, 2026:

> The main theme needs to be that the default view for any tab in the AI Search Visibility bubble contains all runs from the last 30 days. Then if, on any tab, the user chooses a different set of runs from within the pill bubble, the tabs update their results accordingly and stick with that range throughout the tabs unless changes.

Acceptance for the next batch:

1. Opening AI Search Visibility lands every tab on the stored review runs from the last 30 days. The pill says that same window. It does not say "Current run" while the cards add a month.
2. Choosing another set in the pill (one run, a date range, or All time) updates every tab in the bubble: Run Summary, Run Details, Product Fact Checks, Citation Ecosystem, and the Competitive Radar rates that read the same calls.
3. Switching tabs keeps that selection until the pill changes.
4. The map stays on the published run unless Brian expands that scope. `docs/ai-search-history.md` still says the map stays there. `historySpokeDescription` says the same for range and all.
5. Evidence drawers open the rows behind the number on screen. A pooled total opens the pooled, namespaced rows. A single selected run opens that run.

Plan the slice. Do not start by relabeling the citation pill.

## Rules to carry into every tab

These already hold on Citation Ecosystem. The other tabs need the same discipline once they share the window.

- Add numerators and denominators. Do not average rates.
- A run enters a citation total only when its cited URLs were stored. `citationSnapshotUsable` rejects `citationStorageCaution`, an empty call list, an empty citation list, and a list shorter than `storedCitationCount`. `loadHistorySnapshot` does not set `storedCitationCount`. When that field is missing, the stored length is the list length, so a non-empty list is usable.
- Pooling namespaces call ids as `${audit_run_id}:${call.id}` and remaps each citation's `simulation_id`. Drill-downs must use those ids. Reusing a raw simulation id across runs collides.
- October 11 (`7c3e9f52-4b1a-4d8e-9a6f-2e5d81b0c4a7`) named the leader with `original_winner`. Both October 12 runs and later collector v11 runs use `mention_share`. Citation URL counts may include October 11. Lead rates and gaps may include it too. When more than one method is in the window, the copy says lead rates and gaps add runs that named the leader in different ways. Do not invent a blended rate that hides the difference.
- Hide the small-sample label when the window denominator is large (`showSmallSample` is true only for a single run on the citation bars). `isSmallSample` is resolved under 10, or resolved times 2 under the largest group.
- Product-fact and shopping-guidance questions stay out of the two headline rates (`HEADLINE_ROLES`: unbranded discovery and branded consideration).
- The 85.9% "any citation" line stays under the executive row. It only proves an evidence trail exists.
- Association of a citation with a win is labeled as an association. It is not proof of cause. Keep the sample context in the caveat.
- Custom definition tooltips only. Class `ifai-term`, `data-ifai-tooltip-title`, `data-ifai-tooltip-desc`, `tabIndex={0}`, `aria-label`. No native `title` on dotted terms. Any `.ifai-term` inside `.ai-search-panel` needs a description longer than 20 characters.
- No em dash (U+2014) in client UI. `sanitizeUiText` strips it. Write the copy without one.
- Red is never the only status signal. Pair a red figure with words.
- Client portal never mentions IntoFocus fees, retainers, or a service-fee multiple.
- Phase 1 and full-enterprise dollar figures stay labeled as analyst estimates. Do not invent the formula that opens them.
- Delegation and paid tiers (DIY, Done-with-You, Done-for-You) stay parked.

## Docs that are now stale

Leave them stale in this handoff. Rewrite them when the spoke-wide window ships, and still wait for Brian's preview review before any CURRENT mark.

- `docs/ai-search-truth-contract.md` section 1: the current run is never a union of runs. That rule still governs the published-run record. A 30-day view is a separate selection. It does not replace `canvas_ai_current_run`.
- `docs/ai-search-history.md` lines 9 to 11: the default screen stays on the published run, and All time draws a trend. The citation tab already departs from the first sentence.
- `README.md` AI Search paragraph: one published run, default still described as the October 12 run. Live published run is now the October 18 partial run (`2d55ca62…`, completed 6:45 AM UTC, 2:45 AM America/New_York). The history doc's "current published run is `b28d6086…`" is the October 12 run and is out of date.
- `AiSearchSurface` comment that citation follows the range one snapshot at a time.

Do not change the global glossary definition of "published run" to mean a month. Other tabs still use one run until PM8's batch lands.

## Files

Citation aggregation:

- `lib/ai-search/citation-aggregate.ts`: `CITATION_MONTH_DAYS` (30), `citationMonthBounds`, `runsInCitationWindow`, `citationSnapshotUsable`, `poolCitationSnapshots`, `citationAggregateCopy`
- `components/v3/live/ai-search/useCitationAggregate.ts`: month on `current`, pool of `history.trend` on range and all, single snapshot on `run`
- `components/v3/live/ai-search/CitationEcosystemPanel.tsx`: aggregate body for every mode except `run`; `run` still uses `AiReadGate` with `showFreshness={false}`
- `components/v3/live/ai-search/CitationHero.tsx`, `CitationExecutiveGrid.tsx`, `CitationPieDisc.tsx`, `CitationDomainsMix.tsx`, `CitationControlsStrip.tsx`
- `lib/ai-search/citation-pies.ts`, `lib/ai-search/citation-insights.ts`
- `lib/canvas-sdk/canvas-sdk.css` citation section (hero, red percent, disc sizes, 12-column row, laptop reset of the span-5 gaps card)

Shared history, which PM8 will change:

- `lib/ai-search/history-mode.ts`: mode kinds `current | run | legacy | range | all`, pill label
- `components/v3/live/ai-search/AiHistoryContext.tsx`: `useDisplayedAiSearch` around line 219
- `components/v3/live/ai-search/AiSearchSurface.tsx`: `followsRange`, history banner
- `components/v3/build-live-spokes.tsx`: citation is the only tab with `followsRange`; pill is `RunHistoryControl` as `headerAccessory`
- `lib/ai-search/review-runs.ts`: review-run filter, scoring method, citation caution
- `lib/ai-search/canvas-surfaces.ts`: `aiSpokeDesc`. An unused `const c = s.commercial` in `aiMetrics` is pre-existing. Leave it unless that function is already open.
- `lib/canvas-sdk/CanvasShell.tsx`: header stats skipped for Citation Ecosystem. CanvasShell has a pre-existing ESLint baseline of 8 errors and 4 warnings. Do not add to it.

## Tests and known drift

Unit tests:

```bash
node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/citation-insights.test.ts scripts/ai-search-truth.test.ts
```

`citationMonthBounds("2026-10-18")` is `{ from: "2026-09-19", to: "2026-10-18" }`. The pool test uses two different run ids so namespaced ids do not collide. `aiSpokeDesc` matches `/whether Fender-owned pages show up/` and does not match `/Partial/`.

Type check: `npx tsc --noEmit --pretty false`.

Browser, with the dev server on port 3118 (`E2E_AUTH_BYPASS=1 npm run dev -- --port 3118`). Do not use 3111 or 3112. Guest cookie `ifai_guest_fender=1`.

```bash
E2E_PORT=3118 npx playwright test e2e/ai-search.spec.ts e2e/ai-search-history.spec.ts --reporter=line
```

Playwright uses system Chrome (`channel: "chrome"`). Screenshot scripts belong under `/workspace` so `playwright` resolves, then get deleted. Do not commit them.

`e2e/ai-search.spec.ts` citation test passed after the aggregate: hero regex, window line, red percent, unbranded pie total equals the hero denominator, class and brand slices sum to their own totals, mix disc and brand disc are different classes (`.citation-pie-disc-mix` and `.citation-pie-disc-brands`), role `data-role-n` sums to `data-role-resolved` without a second hidden copy.

`e2e/ai-search-history.spec.ts` fixture path expects the citation aggregate "Figures add 1 run" and hero **4 of 23** (published October 12 only; October 11's fixture copy has 0 of 468 URLs, and the earlier October 12 run is the caution). Single-run October 11 still expects "468 citation rows" and "not read as a change". The earlier October 12 run still expects the 2-citation caution. Keep `mode.kind === "run"` on that single-run path.

Known failures that this work did not cause. Do not rewrite the expected rates unless Brian asks:

- History tests still expect unbranded 56.5% (13 of 23). The live published run is October 18 at 61.9% (13 of 21). Fixture mode's "current" is that live run.
- "All time draws the three stored runs" expects 3 trend rows (October 11, October 12, October 12). Live All time now has 4 rows (October 11, two October 12s, October 18).
- Competitive Radar can trip on domain names such as sweetwater.

CI on this repo is the Netlify deploy. Playwright is not in `.github/workflows/deploy.yml`. Checks on `2b54143` succeeded. Re-check the deploy on the handoff commit before calling the preview current.

## Starter prompt for the next worker

Use this as the brief. Fill the acceptance checks after you decide the shared mode shape.

```
Branch: cursor/visual-pilot-8c53. Draft PR 45. Do not open a new branch.
Do not mark FDD or TDD CURRENT. Do not bump docs to 7.7.

The pill and Citation Ecosystem disagree on purpose. The pill says
"Current run · Oct 18, 2026". Citation Ecosystem adds the last 30 days
(10 of 74 unbranded discovery answers cited a Fender-owned page).
Leave that citation aggregate in place. Do not make the citation cards
match the current pill, and do not relabel only the pill.

Change the shared history selection so every tab in AI Search Visibility
uses one window:

- Default: all stored review runs whose UTC day falls in the last 30 days
  ending on the published run's day. The pill names that window.
- A different choice in the pill (one run, a date range, or All time)
  updates Run Summary, Run Details, Product Fact Checks, Citation Ecosystem,
  and Competitive Radar, and that choice sticks across tab switches.
- The map stays on the published run.

Add numerators and denominators. Exclude runs whose citations were not
stored from citation totals. When a window mixes original_winner (October 11)
and mention_share (October 12 and later v11), say so next to lead rates
and gaps. Do not invent a blended rate. Evidence drawers open the pooled
rows, with call ids namespaced as `${audit_run_id}:${call.id}`.
Hide small-sample labels when the window denominator is large.
Keep a single selected run on the existing single-run path, including the
468-row note and the 2-citation caution.

Client copy: no em dash, no IntoFocus fees, dollar figures stay analyst
estimates, definition tooltips use ifai-term data attributes.
CanvasShell's existing ESLint errors must not grow.
```

## Preview links for Brian

- Map and bubble slots: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard
- Citation Ecosystem: https://deploy-preview-45--ifai-dashboard.netlify.app/dashboard?spoke=aeo&tab=citation-ecosystem

Screenshots from the October 22 pass: `citation-month-dark-1600.png`, `citation-month-light-1600.png`, `citation-range-aggregate-1600.png`, and `hub-slots-desktop.png` in the agent artifacts.
