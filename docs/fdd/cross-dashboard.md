# 5. Cross-dashboard requirements

## 5.1 Navigation, views, and drill-down

**X-01 CURRENT** · Launch

**Status source:** Explicit

- **Current:** One click opens spokes, tabs, and hide/show inside a panel.
- **Desired:** Keep. Chevrons mean more content or sort direction.
- **User value:** Operators never hunt for the next layer.
- **Acceptance:** Every spoke and tab opens in one click on desktop.
- **Evidence:** Verified Oct 20 desktop. Oct 21 browser pass In review (local HMR hang).
- **Open decision:** None.

**X-21 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** The header has a Minimal / Balanced switch. Balanced is the default and is unchanged. Minimal hides the map and opens on six “+” slots, three small and three larger. The picker offers 53 figures grouped by area, including one per category and an Other group for figures no tab shows yet, and each opens its tab. Slots show the published run, as the map does. Deep dive and the Ask IntoFocus prompt are not built.
- **Desired:** Three views share data, period, and evidence: Minimal (empty + placeholders), Balanced (primary), Deep dive (Durvet-style; depth LATER).
- **User value:** Sales, executives, and deep readers use one truth at different density.
- **Acceptance:** View switch does not change numbers for the same period.
- **Evidence:** Approved by Brian Magazu on 3 Nov 2026. Worker 20.2, pull request 111 (main 2d68687) and pull request 114 (main 403b307). REFINE until Deep dive and the Ask IntoFocus prompt (N-09) exist. On 9 Nov 2026 Brian Magazu moved Deep dive and the Ask IntoFocus prompt (N-09) to LATER, so X-21 is CURRENT.
- **Open decision:** None.

**X-22 TARGET** · Launch

**Status source:** Explicit meeting

- **Current:** Hover or focus on a main bubble opens three signal slots. They stay up until a click outside the bubbles and the slots. The map slides so the hovered bubble and its satellites sit clear of those slots.
- **Desired:** On Balanced, remove those widgets. Hover/focus a main bubble fills three slots: largest performance gap, largest defensible opportunity, highest-priority action — large figure, short label, target, compact chart. Red never alone.
- **User value:** The hub answers without opening every bubble.
- **Acceptance:** Slots use live data, denominator, freshness, and evidence trail.
- **Evidence:** Live on production main d9911c9, approved 26 Oct 2026 (workers 9.4 and 10.3). Status stays TARGET until the slots are confirmed as the largest gap, the largest opportunity, and the highest-priority action. Worker 20.3 (pull request 110) added a target, N of M, a last-checked date, an evidence link, and a one-line rule to each slot. Brian Magazu did not approve the picks on 3 Nov 2026; the pull request stays open for rework.
- **Open decision:** None.

**X-23 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** The six main bubbles and the satellites do not show explanatory hover text. Names and visible results stand alone. Panels keep custom definition tooltips.
- **Desired:** Remove explanatory hover text from the six main bubbles. Names and visible results stand alone. Inside panels, keep custom definition tooltips.
- **User value:** The map is scannable.
- **Acceptance:** No native title tooltips on dotted definitions; custom .ifai-term pattern only.
- **Evidence:** Approved 26 Oct 2026, PR 46, commits ee4d228 and 456af66. Worker 9.3. Workers 16.1 through 16.4 extended this to every satellite on 28 Oct 2026, pull request 76, main 677f077.
- **Open decision:** None.

**X-32 CURRENT** · Launch

**Status source:** Explicit (Brian Magazu, 3 and 4 Nov 2026)

- **Current:** Hovering or focusing a main bubble opens its signal slots in the same frame, and the map no longer re-renders on every pointer move. The dashboard uses the computer's own cursor; the custom reticle is off. A tab click right after a panel opens always lands. The pointer glow, blur, bubble glow, and halos use lighter equivalents with the same look, the panel slides in 0.45 seconds, and the reduced-motion setting stills the glow and the slide.
- **Desired:** The map answers hover and clicks without lag on a typical laptop, and the cursor never trails, freezes, flickers, or shows twice. Keep the look.
- **User value:** The dashboard feels fast in a client meeting.
- **Acceptance:** Slots open within one frame of hover. No cursor lag. The first tab click after a panel opens lands. Lighter effects keep the look.
- **Evidence:** Approved by Brian Magazu on 4 Nov 2026. Worker 21.1: pull request 127 (main d6f502f) cut map renders during a pointer sweep from 533 to 46 and fixed nine cursor glitches and the dropped tab clicks; pull request 132 (main 08663ef) switched to the native cursor after a live laptop still lagged; pull request 135 (main e0f91e3) lightened the map effects and cut raster time by about two thirds. The always-running map animations (halos, motes, line glow) are the largest remaining load. Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): the map is flat in brand style; hover to slots 34 ms before and 33 ms after, paint 1137 ms to 646 ms, GPU 8351 ms to 3807 ms (medians at 1280x720).
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026, following the brand book: the map goes flat, with rings and no glows, halos, gradients, blur, or moving dots. Hover speed stays as it is.

**X-24 LATER** · Post-core

**Status source:** Explicit meeting

- **Current:** No pulse when a bubble changed since last view.
- **Desired:** A bubble subtly pulses when it changed since that user last viewed it.
- **User value:** Return visits show what moved.
- **Acceptance:** Pulse is per viewer; not a demo animation loop.
- **Evidence:** Not live.
- **Open decision:** None. Moved to LATER on 9 Nov 2026 by Brian Magazu: a per-viewer pulse needs login (X-15).

**X-02 CURRENT** · Launch

**Status source:** Inferred

- **Current:** Satellite click behavior varies.
- **Desired:** Suggested default: open the related tab. Keep type readable.
- **User value:** Smaller bubbles stay useful on a laptop.
- **Acceptance:** Documented choice before launch polish.
- **Evidence:** In review. Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): every satellite opens its tab in one click for Fender and Ledlenser (e2e/satellite-click.spec.ts).
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: a satellite opens its tab in one click.

## 5.2 Visual hierarchy, tables, definitions

**X-03 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Run Summary and Competitive Radar lead with the figure. Run Summary opens on Unbranded Discovery and Branded Consideration, with the collapsible trend below. Run Details leads with Unbranded Discovery and Branded Consideration, each a colored percentage beside a disc. Product Fact Checks leads with Accuracy, a colored percentage and a disc, in the same height as the explainer beside them. Citation Ecosystem leads with the Fender-owned link share. Category Battlecards opens with those two rates and a graph of which categories another brand leads. Competitor Wins opens with competitors led N of M and a graph of which brands took those answers. Engine Comparison opens with those two rates and a graph of unbranded discovery by engine, weakest Fender lead first. Retail Overview opens with three share pies: Buy Box withheld of current readings, MAP leakage of listings with a stored MAP price, and splintered bundles of the bundles in this read. Findability opens with a hero percentage, ratio, and disc for each official-page outcome, led by exact official product pages. Summary Briefing opens with five findings, each as N of M and a percentage: Buy Box withheld, MAP leakage, splintered bundles, exact official product pages, and unbranded discovery. Suppressed Listings leads with the Buy Box withheld share. MAP leads with the MAP leakage share, and the average price gap sits under that pie. Catalog Governance on that tab leads with Splintered listings, the unnested-bundle share, beside Specs complete, the share of checked listings with every Amazon spec field filled. 98% and up is green, 95% up to 98% is yellow, and under 95% is red. Splintered listings is open. Its chevron closes that table. The Specs complete chevron opens the listings that are missing a spec field and closes the other table. Filters are the top three missing fields, plus One field, Two fields, and Most of the spec. A third-party offer shows the Amazon seller id. AI Readiness opens with four heroes, each a percentage, an N of M ratio, and a pie: fender.com page found, Amazon attribute completeness, fender.com completeness when a page is found, and found pages missing additionalProperty. Page found is red under 85%, yellow from 85% through 95%, and green above 95%. Completeness when a page is found is red under 95%, yellow from 95% through 98%, and green above 98%. The missing-fields chart opens from a chevron beside its title. A found row with a stored fender.com URL links Yes to that page. Catalog Health has an Out of Stock tab (R-17). It opens on the cost callout and the listing table, not on a share hero. Action Items is exempt by design: Urgent Interventions opens on the fix list in priority order, and Revenue Estimates and Summary Opportunity open on their figures, then how the estimates were reached. On the map, each main bubble and each satellite leads with one hero figure and a short label. The Summary bubble shows the logo and the title only. Out of Stock opens on the summed estimated lost sales, with the daily cost callout beside that figure. The Estimate pill tooltip carries the population and the rate rule. Amazon A+ Matrix opens on its content shares. The Strategy Roadmap first tab opens on the five current findings. Worker 18.3, pull request 90, commits 7eecc0c and 295bcc0, published on main at 86a5d91.
- **Desired:** Lead with the number; reduce qualifying prose on main data views.
- **User value:** Position is obvious before the preface.
- **Acceptance:** First screenful of each tab shows the figure before the essay.
- **Evidence:** Workers 11.1 through 11.3 were approved on 27 Oct 2026 and published on main at 874c9cb. Workers 11.5 (8f41e90, PR 56), 11.6 (d84ba6a, PR 57), and 11.7 (41468dd and 810ccd8, PR 55) were approved the same day and published on main at 345a755 (PR 58). Workers 12.1 through 12.8 were approved the same day on pull request 67 (fe4c0c4) and published on main at dd32396. Retail Overview, Findability, Summary Briefing, Suppressed Listings, MAP, and Catalog Governance now lead with the figure. Workers 13.1 through 14.4 were approved on 28 Oct 2026 on pull request 71, commit 8e70ae5, and published on main at 3b333ae. Worker 15.2 was approved on 28 Oct 2026 on pull request 72, commits 588be5b, 8a71fa3, and 48814d1, and published on main at 7af49b0. AI Readiness now leads with the figure. Documentation version 15.3 records the Out of Stock tab from commit 95ed0de. X-03 stays REFINE. Catalog Health has an Out of Stock tab (R-17). It opens on the cost callout and the listing table, not on a share hero. Action Items, the roadmap, Machine Readability, Amazon A+ Matrix, and Out of Stock still do not lead with the figure. Workers 16.1 through 16.4 were approved on 28 Oct 2026 on pull request 76 and published on main at 677f077. The map bubbles lead with one hero figure. The client dashboard does not present the catalog SKU count. X-03 stays REFINE. Worker 21.5, pull request 122 (main 9e83004), approved by Brian Magazu on 4 Nov 2026: the figure-first audit (e2e/figure-first-audit.spec.ts) passes on every tab at 1280x720, with Urgent Interventions, Revenue Estimates, and Opportunity as stated exemptions. Worker 21.6 put the Run Summary rates above its trend (pull request 120). X-03 is CURRENT.
- **Open decision:** None.

**X-04 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Each main tab has a primary visual before long copy. Urgent Interventions, Revenue Estimates, and Summary Opportunity are exempt: they lead with the fix list or with the estimates and how they were reached.
- **Desired:** Graphs first on main data views. Fix lists and estimate views spend the space on what to fix and how the estimates were reached.
- **User value:** Executives read position visually.
- **Acceptance:** Each main tab has a primary visual before long copy.
- **Evidence:** Audit at 1280x720 by worker 21.5, pull request 122 (main 9e83004), approved by Brian Magazu on 4 Nov 2026. Brian rejected the hero card and the estimate bar chart on Action Items the same day.
- **Open decision:** None.

**X-05 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Inactive tabs are outline pills. The selected tab stays the filled pill.
- **Desired:** Tabs must look clickable.
- **User value:** People see that more than one view exists.
- **Acceptance:** Inactive tabs are visibly interactive.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 81, commit b25aeb8. Published on main at 85e076b.
- **Open decision:** None.

**X-27 REFINE** · Launch

**Status source:** Addendum ADD-11 / meeting

- **Current:** Font families and sizes vary.
- **Desired:** Set one type scale and one font family across the dashboard.
- **User value:** The brand feels intentional.
- **Acceptance:** No mixed display stacks on client surfaces.
- **Evidence:** Verified in source/CSS variance Oct 20. Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): all dashboard text is Geist (400 body, 600 headings) with Geist Mono for labels and table numbers; Playfair and the system monospace are gone from shared CSS. REFINE until the view stylesheets that still use weights of 700 or more, and prompts-editor.css, follow. Worker 24.3 (PR 152, main ca22e8a) and worker 24.4 (PR 151, main f1df1f5): Catalog Health and AI Search follow the type rules; other views to follow.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026, following the IntoFocus AI Brand Book V2 (docs/brand in the repo): Geist for all text, 400 for body and 600 for headlines and hero figures, never heavier than 600. Geist Mono only for eyebrows, labels, sources, and table numbers. Sizes stay on the X-31 dashboard scale.

**X-31 REFINE** · Launch

**Status source:** Explicit

**Current**

Nothing on the client dashboard is smaller than 10px. The version label is 10px. Labels and table chrome may sit at 10px. Sentences use the nearby body size. Hero numbers stay large.

**Desired**

Nothing on the client dashboard is smaller than 11px (Brian Magazu, 11 Nov 2026, decision 50). Labels, uppercase marks, and table chrome may sit at 11px. A sentence uses the body size already used nearby, 12px or 13px. Hero numbers stay the large metric size. One type scale. After the change, the raised type causes no overlaps, wraps, or collisions.

**User value**

Operators can read every figure and note, and nothing collides.

**Acceptance**

No client-dashboard text is under 10px. Sentence-length notes use body size. Raised type causes no overlaps, wraps, or collisions. Marketing pages and the portal are outside this scale.

**Evidence**

Approved by Brian Magazu on 29 Oct 2026. Pull request 88, commit 921c81e. Published on main at d91bffa.

**Open decision**

None.

**X-33 REFINE** · Launch

**Status source:** Explicit (Brian Magazu, 9 Nov 2026)

**Current**

Some table columns sort. Tables have no search, and nothing exports.

**Desired**

Every data table sorts on every column, has a filter or search, and downloads what is shown as CSV, with the filter, the sort, and the as-of time.

**User value**

Operators find and take the rows they need without leaving the dashboard.

**Acceptance**

Every client data table sorts on every column, searches or filters, and downloads its shown rows as CSV with filter, sort, and as-of time. Row counts read N of M.

**Evidence**

Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): every ResizableTable has Search this table, an N of M rows count, a no-match row, and Download CSV. REFINE until five tables with their own sort handler and the tables outside ResizableTable follow. Worker 24.3 (PR 152, main ca22e8a) and worker 24.4 (PR 151, main f1df1f5): the Catalog Health and AI Search views now follow the table rules; other views to follow.

**Open decision**

None.

**X-34 REFINE** · Launch

**Status source:** Explicit (Brian Magazu, 9 Nov 2026), IntoFocus AI Brand Book V2

**Current**

Colors, status colors, and map effects predate the brand book: sky blue and indigo accents, red, amber, and green status colors, and a glowing map.

**Desired**

The client dashboard follows the brand book. Page \#070B14, cards \#0B1220, hover \#141E33, one ice-blue accent \#A7D8F0, text \#F8FAFC, \#AEB8C7, and \#8B95A7, borders \#64748B. Status colors Oxblood \#CC5B63 (bad), Champagne \#D4B66F (okay), and Pine \#6AB792 (good), each with a mark and a word, only on data. Charts use ice blue for the measured slice and gray for the rest. The map is flat. The brand book is a standard below this document; a conflict goes to Brian Magazu.

**User value**

The dashboard looks like IntoFocus, and status reads the same everywhere.

**Acceptance**

Client surfaces use only brand book colors. Every status color carries a mark and a word. No glows, gradients, or moving dots on the map.

**Evidence**

Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): the brand palette in dark and light themes, one ice-blue accent, Oxblood, Champagne, and Pine with a mark and a word (StatusMark), status colors off buttons, links, tabs, the version badge, and channel chips, and a flat map. REFINE until view pies and charts use the chart tokens and every status figure uses StatusMark. Worker 24.3 (PR 152, main ca22e8a) and worker 24.4 (PR 151, main f1df1f5): Catalog Health and AI Search follow the chart and status rules; other views to follow.

**Open decision**

None. Status words are Poor, Fair, and Good where a figure has no word of its own; the FDD's own words stay where they exist.

**X-07 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Custom tooltips for dotted definitions.
- **Desired:** Keep. Never native title on definition marks.
- **User value:** Jargon is explainable without a glossary page.
- **Acceptance:** MAP and similar terms use data-ifai-tooltip-\* attributes.
- **Evidence:** Verified Oct 20 (Figure 2).
- **Open decision:** None.

**X-08 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Resizable tables use directional sort chevrons. Suppressed Listings does not show Buy Box or Source, because every withheld row is an Amazon listing read. Tables still fill the panel on a first visit. Short cells stay on one line. A saved column drag still wins.
- **Desired:** Tables use available width, tighter rows, directional chevrons; drop columns that never vary.
- **User value:** More listings fit; sort is obvious.
- **Acceptance:** Sort direction changes row order; unused constant columns removed.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 89, commit 39a79c0. Published on main at 48875fe. Worker 11.4, commit 8c84c5b, and worker 11.2, commit 83a105c, remain the earlier width and drag work.
- **Open decision:** None.

**X-28 CURRENT** · Launch

**Status source:** Addendum ADD-22

- **Current:** Division rows and MAP listing rows do not look clickable. MAP sort buttons and stored price links stay. Other tables keep their hover.
- **Desired:** Rows that look clickable must open a useful action or stop looking clickable.
- **User value:** Operators are not stranded.
- **Acceptance:** No dead click affordances on Division or MAP rows.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 85, commit b0c368e. Published on main at d91bffa.
- **Open decision:** None.

## 5.3 Time, exports, evidence, freshness

**X-09 CURRENT** · Launch

**Status source:** Explicit + meeting

- **Current:** AI Search opens on the last 30 days ending on the date of the published run the map shows, counting only published review runs with answered calls. The shared date pill names it, for example Last 30 days · Oct 5 to Nov 3, 2026. Latest run, previous run, a date range, and all time stay in the same pill. An empty window reads No published run in the last 30 days and offers the latest run.
- **Desired:** AI Search defaults to the last 30 days ending on the published run, with the latest run selectable. A shared period across every spoke remains the longer-term target.
- **User value:** Trends are comparable.
- **Acceptance:** Default month does not include failed/empty runs as client results.
- **Evidence:** Approved by Brian Magazu on 4 Nov 2026. Worker 21.6, pull request 120 (main 3828b41). Brian chose a rolling 30 days over a calendar month, anchored on the published run. Worker 24.4, pull request 151 (main f1df1f5): the Ledlenser AI Search window is fixed, and Ledlenser question roles follow ledlenser.ai_prompts.analytical_intent (Brian, 10 Nov 2026).
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: Summary Briefing, the Roadmap, and Action Items use the map's population for AI figures (the published run plus its matching API run), so one figure shows one number. The AI Search and Competitive Radar tabs follow the date pill. Exception (decision 40, 10 Nov 2026): the Competitive Radar map bubble follows the Category Battlecards date-pill window and lead rule (C-03).

**X-10 REFINE** · Launch

**Status source:** Explicit

- **Current:** No CSV/Excel/PDF on the live canvas.
- **Desired:** Server-side exports from the same published query as the screen.
- **User value:** Operators take evidence to partners.
- **Acceptance:** Export includes filters, sort, as-of, and population sentence.
- **Evidence:** Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): Download CSV is built on the server from the same query as the screen, keeps the on-screen order, and starts with Filter, Sort, As of, and the population sentence, for 9 tables: MAP listings, Out of Stock, Suppressed Listings, bundles, catalog spec gaps, spec readiness, page readability, page found, and A+ content. REFINE until the AI Search tables have server loaders that follow the date pill. Worker 24.3, pull request 152 (main ca22e8a) and worker 24.4, pull request 151 (main f1df1f5): Catalog Health and AI Search tables now follow the date pill with server loaders.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: CSV only for launch, built on the server from the same query as the screen, with the filter, sort, as-of time, and population sentence. Excel and a PDF of the view are LATER.

**X-11 REFINE** · Launch

**Status source:** Explicit

- **Current:** A shown Walmart, Musician’s Friend, or extra-channel price opens its stored page, or says Not available\* when no page was stored. Estimate formulas are still closed.
- **Desired:** External findings link to the checked source. Estimates open inputs and formulas.
- **User value:** Nobody trusts a closed number.
- **Acceptance:** Every headline opportunity has a drill-down or is marked Not available\*.
- **Evidence:** Checked-page links desktop-verified 22 Oct 2026 on preview PR 45, commit 931cc3f, Worker 8.6, and approved by Brian Magazu. Formula trails remain blocked by R-06.
- **Open decision:** None.

**X-25 REFINE** · Launch

**Status source:** Explicit meeting

- **Current:** Partial coverage is easy to misread as complete.
- **Desired:** Partial figure → asterisk + tooltip (missing inputs, coverage, source, last check, effect). Absent inputs → “Not available\*”.
- **User value:** Incomplete data cannot pose as full intelligence.
- **Acceptance:** No silent mix of actual and modeled amounts.
- **Evidence:** Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): a shared partial-figure helper and asterisk tooltip naming what is missing, the coverage, the source, the last check, and the effect; a map figure whose read failed reads Not available\* and names the read. REFINE until the stale-data trigger is built on the decided schedules and the views use the helper. Worker 24.4, pull request 151 (main f1df1f5): AI Search applies the stale-data limit of 6 days (AI_SEARCH_STALE_AFTER_DAYS in lib/ai-search/stale.ts). It is not yet on the map bubbles or Minimal.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: a figure gets an asterisk when a filter narrows it, it covers part of its population, an input read failed, or its data is older than twice its normal check schedule. Normal schedules, for now: AI Search every 2 to 3 days; Buy Box, Keepa, and MAP prices daily; spec and Findability checks weekly.

**X-12 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Findability shows Last checked beside the outcome heroes, before a box is opened. The time is the newest stored check among listings that were checked, in UTC. Unchecked listings do not set that time. When no checked listing has a time, the line reads Last checked Not available\*. Other tabs were not in this closeout.
- **Desired:** Findability shows last-checked even before a recheck schedule exists.
- **User value:** Stale reads are obvious.
- **Acceptance:** Findability shows last-checked even before schedule exists.
- **Evidence:** Brian Magazu approved the preview on 2 Nov 2026. Pull request 95, commit 2be6065, published on main at 424d572.
- **Open decision:** None.

**X-13 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Null is not shown as zero in designed paths. One failed canvas read no longer blanks the map: each read settles on its own, and each figure that depends on a failed read reads Not available\* with the failed source named in its tooltip. A read that takes longer than 20 seconds counts as failed.
- **Desired:** Keep.
- **User value:** Missing is not failure-as-zero.
- **Acceptance:** Null ≠ 0 in client copy.
- **Evidence:** Happy path Verified. Failure path Verified: worker 21.2, pull request 118 (main 5c11d76), approved by Brian Magazu on 4 Nov 2026, with each read forced to fail in unit and browser tests. Workers 21.4 (pull request 121) and 21.3 (pull request 119) covered the retail and AI Readiness figures. The header's Data as of line still reads n/a on a failed freshness read.
- **Open decision:** None.

## 5.4 Desktop, access, security, governance

**X-14 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Desktop web dashboard.
- **Desired:** Desktop remains the launch surface. Mobile LATER (X-06).
- **User value:** Executive meetings use a laptop or monitor.
- **Acceptance:** No mobile launch work.
- **Evidence:** Verified.
- **Open decision:** None.

**X-15 TARGET** · Launch

**Status source:** Explicit

- **Current:** Guest/login gate can be off.
- **Desired:** Watson’s access plan: required auth before non-IntoFocus users. Not a deploy blocker for internal pilots.
- **User value:** Client data is not casually open.
- **Acceptance:** Unsigned access disabled for external client tenants.
- **Evidence:** Verified current guest path.
- **Open decision:** None.

**X-16 TARGET** · Launch

**Status source:** Explicit

- **Current:** Single-brand pilot.
- **Desired:** Tenant partition before the first real client.
- **User value:** Client data stays isolated.
- **Acceptance:** No cross-tenant rows in browser-selectable views.
- **Evidence:** Verified single brand. On 4 Nov 2026 Brian Magazu confirmed Fender and Ledlenser are beta dashboards on real catalogs, not clients yet, so separation waits for the first real client and the dashboards stay open without a login.
- **Open decision:** None.

**X-17 CURRENT** · Launch

**Status source:** Explicit

- **Current:** No IntoFocus fees in the client portal.
- **Desired:** Keep. Internal commercial notes never appear in evidence drill-downs.
- **User value:** The portal is not a pricing discussion.
- **Acceptance:** No fee, retainer, or fee-multiple fields in client views or exports.
- **Evidence:** Verified absent on opened tabs Oct 20.
- **Open decision:** None.

**X-18 REFINE** · Launch

**Status source:** Explicit

- **Current:** Some labels still paraphrased or unclear.
- **Desired:** Canonical phrases designated by Brian are not paraphrased by assistants.
- **User value:** The room hears one name.
- **Acceptance:** Rename pass follows Brian’s confirmed list; unclear headings get self-explanatory names.
- **Evidence:** Approved by Brian Magazu on 9 Nov 2026. Worker 23.1, pull request 148 (main c8561cb): the map reads Splintered Listings, the Roadmap bubble and breadcrumb read Roadmap, and its tab reads 30-60-90 Days. REFINE until each view's panels use the decided names. Worker 24.3 (PR 152, main ca22e8a) and worker 24.4 (PR 151, main f1df1f5): Catalog Health and AI Search panel names follow the decided list; other views to follow.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: Unbranded SOV becomes Unbranded Discovery; Splintered bundles becomes Splintered Listings everywhere, since splintering may apply to more than bundles for other clients; the MAP tab becomes MAP Leakage; Brand Consideration becomes Branded Consideration; the roadmap is Roadmap and its tab is 30-60-90 Days; a radar label reads like Yamaha leads Acoustics. Nothing else is renamed. Client copy follows the brand book voice: no contractions, emojis, or em dashes; buttons are a verb plus an object.

**X-19 CURRENT** · Launch

**Status source:** Explicit meeting (was DECISION)

- **Current:** Primary client copy says Buy Box. The dotted tooltip begins “Amazon also calls it the Featured Offer.” Internal columns such as featured_offer_state are unchanged.
- **Desired:** Use Buy Box in primary copy. Tooltip: Amazon also calls it the Featured Offer.
- **User value:** Clients are not asked to translate the same button.
- **Acceptance:** No primary client headline says only Featured Offer.
- **Evidence:** Desktop-verified 21 Oct 2026 on local production build commit 1fdbfc0 (PR 43). Published GitHub Pages still serves main cfd45de until that branch deploys. The glossary keeps a secondary Featured Offer alias. It is not a primary headline.
- **Open decision:** None.

**X-26 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** Header title: IntoFocus AI Consensus Control. The version label is 23.1.
- **Desired:** Product title: “IntoFocus AI Consensus Control” plus the documentation version (current label 23.1). The label updates when a pull request merges to main. Removing versioning is LATER.
- **User value:** Operators know which agent build they are looking at.
- **Acceptance:** The header reads IntoFocus AI Consensus Control, and the version label matches the documentation version.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 78, commits d2cb887 and 43d7b59. Published on main at 2cb2a5a. The version label was 17.5 on commit de85d24, published on main at 27c0109. The version label was 17.9 on commit 29441ce, published on main at d91bffa, then 18.4 on commit 193ca85 and 18.8 on commit de5be2b. The version label is 20.1 on worker 20.1, pull request 105, commits 4ae1cce and a51c107, approved by Brian Magazu on 3 Nov 2026. The version label is 20.9 on worker 20.1, pull request 116, commit 9cb465f, approved with the batch. The version label is 21.8 on worker 21.2, pull request 136, approved with the batch. The version label is 23.1 on worker 23.1, pull request 150, approved with the closeout on 9 Nov 2026.
- **Open decision:** None.

**X-29 REFINE** · Launch

**Status source:** Explicit meeting

- **Current:** A Security page at /dashboard/security, linked from the user menu, lists what is in place now (no secret keys ship in the browser bundle; IntoFocus internal notes never appear in evidence views), what is planned (separating client data by brand), and what is not decided (single sign-on, audit export, data-processing agreement wording).
- **Desired:** Publish a client-data security protocol that lists only real constraints and open controls, and never mentions IntoFocus fees or commercial terms. Ryan and Brian Watson review it before launch.
- **User value:** Sales and clients can see the baseline.
- **Acceptance:** Protocol lists only real constraints + open controls.
- **Evidence:** Approved for now by Brian Magazu on 4 Nov 2026; it needs Ryan and Brian Watson's review before launch. Worker 21.7, pull request 124 (main 617ef7b). Two draft lines were left off because checks showed they were not true: Fender data is in the public browser files, and two set-aside views accepted writes from the public key. Brian Watson applied the grant fix on 4 Nov 2026 (pull request 125).
- **Open decision:** None. Decided 4 Nov 2026: list only real constraints, mark single sign-on, audit export, and agreement wording as not decided, and say nothing about fees.

**X-20 TARGET** · Operating

**Status source:** Explicit meeting

- **Current:** Tracker kept in sync with FDD/TDD updates.
- **Desired:** Project Manager agents own the current FDD, TDD, and supporting Sheets. They read them before delegating and update affected sections after verified work. They distinguish proposed, approved, implemented, and verified. Each document keeps a change log with date, change, reason, and task/PR/commit. At the beginning of every affected FDD/TDD update, set a plain-text first line: “Documentation version: \<approved PM/Worker version\>” (example: Documentation version 8.7 for work approved by Project Manager 8 from Worker 8.7). Project Manager N's workers are N.1, N.2, N.3 in delegation order. The documentation version is that worker label. PM7 ended at 7.5. The approved documentation line is 16.4, covering workers 16.1 through 16.4. The prior lines are 15.3, covering the Out of Stock tab (R-17) from commit 95ed0de, 15.2, covering worker 15.2, 14.4, covering workers 13.1 through 14.4, 12.8, covering workers 12.1 through 12.8, 11.7, covering workers 11.5 through 11.7, 11.4, covering workers 11.1 through 11.4, and 10.5, covering workers 9.1 through 10.5. Do not continue 7.x after 7.5, and do not continue another Project Manager's sequence. Increment that visible line on every approved update. Google history remains for recovery; restoring a whole file requires approval. Named Google versions are optional, not required. Flag Git only if documentation must follow code branches.
- **User value:** Documentation stays the source of truth.
- **Acceptance:** Every affected update changes the first-line documentation version and adds a change-log row. The version matches the approved PM/Worker release label when one exists.
- **Evidence:** Documentation version 16.4 records workers 16.1 through 16.4, approved by Brian Magazu on 28 Oct 2026 on pull request 76 and published on main at 677f077. Documentation version 15.3 records the Out of Stock tab (R-17) from commit 95ed0de, at Brian Magazu's request on 28 Oct 2026. There is no worker label on that commit. Documentation version 12.8 records workers 12.1 through 12.8, approved by Brian Magazu on 27 Oct 2026. Documentation version 15.2 records worker 15.2, approved by Brian Magazu on 28 Oct 2026 on pull request 72. Documentation version 14.4 records workers 13.1 through 14.4, approved by Brian Magazu on 28 Oct 2026 on pull request 71. Workers 11.5 through 11.7 remain the prior line. Named Google versions remain optional. Confirmed done in Build by Marc Savy on 2026-10-28. From 9 Nov 2026, Project Manager agents follow How to run the work in docs/pm-handoff.md: one planning message, each view built to its final form in one pull request, an Auditor on GPT-5.6 Sol High before Brian Magazu reviews, then the closeout. Brian's decisions for the PM23 build are in docs/pm23-decisions.md (pull request 147, main 026f3be).
- **Open decision:** None.

**X-06 LATER** · After launch

**Status source:** Explicit

- **Current:** Desktop web page.
- **Desired:** Fullscreen/native app and mobile deferred.
- **User value:** Launch does not wait on a new shell.
- **Acceptance:** No mobile/native in launch build.
- **Evidence:** Verified absent.
- **Open decision:** None.

**X-30 LATER** · After launch

**Status source:** Meeting (high priority)

- **Current:** Amazon-centered commerce sources; Musician’s Friend client-specific.
- **Desired:** Google and TikTok Shop are intended default commerce sources with Amazon. Large clients may add industry sources.
- **User value:** Commerce coverage matches the market.
- **Acceptance:** Not in launch build; tracked as high-priority LATER.
- **Evidence:** Not live.
- **Open decision:** None.
