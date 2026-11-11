**Documentation version: 25.20**

> **Source of truth.** This TDD moved from Google Docs into the repo on 10 Nov 2026 at version 24.4. History: [changelog.md](changelog.md). FDD: [../fdd/README.md](../fdd/README.md).

**INTOFOCUS AI**

**Technical Design Document**

Implementation guide for the Functional Design Document.

| **Field** | **Value** |
|---|---|
| Version | 24.4 |
| Date | November 10, 2026 |
| Companion | Functional Design Document 23.1. Feature IDs match. |
| Code verified | Worker 23.1 was approved by Brian Magazu on 9 Nov 2026 and merged to main by PM23 (pull request 148, main c8561cb; DOCUMENTATION_VERSION 23.1 on pull request 150). Workers 21.1 through 21.8 were approved by Brian Magazu on 4 Nov 2026 and merged to main by PM21 (last merge e0f91e3; DOCUMENTATION_VERSION 21.8 on pull request 136). Workers 20.2 and 20.4 through 20.9 were approved on 3 Nov 2026 and merged to main by PM20 (main fff5dd2; DOCUMENTATION_VERSION 20.9 on pull request 116, commit 9cb465f). Worker 20.3 (pull request 110) is open. Worker 20.1 was approved on 3 Nov 2026 on pull request 105, commits 4ae1cce and a51c107. DOCUMENTATION_VERSION is 20.1. Workers 19.1 through 19.5 were approved on 3 Nov 2026 and published on main at aa6f29c. Workers 18.1 through 18.4 were approved on 29 Oct 2026 and published on main at 167de76. Worker 18.1 is pull request 89, commit 39a79c0, main 48875fe. Worker 18.2 is pull request 91, commits b5c44d0 and 482b92d, main eb1d9a4. Worker 18.3 is pull request 90, commits 7eecc0c and 295bcc0, main 86a5d91. Worker 18.4 is pull request 92, commits 7bf55cf and b5c6ce2, main 65e2c79. Header label commit 193ca85, main 167de76. Documentation version 18.4. X-08, D-07, D-08, R-14, SC-01, SC-02, and SC-04 are CURRENT. SC-03 stays TARGET. R-18 is TARGET. Workers 17.6 through 17.9 were approved on 29 Oct 2026 and published on main at d91bffa. Worker 17.6 is pull request 84, commits 6d87cee and a189b3f. Worker 17.7 is pull request 88, commit 921c81e. Worker 17.8 is pull request 86, commit ed72d84. Worker 17.9 is pull request 85, commit b0c368e. Header label commit 29441ce. Documentation version 17.9. N-01, X-31, S-01, and X-28 are CURRENT. S-02 stays TARGET. Workers 17.2 through 17.5 were approved on 29 Oct 2026. Worker 17.2 is pull request 79, commit 021ba89, main 60afa6f. Worker 17.3 is pull request 82, commit 429ed30, main 4cb03ee. Worker 17.4 is pull request 81, commit b25aeb8, main 85e076b. Worker 17.5 is pull request 80, commit 457f790, main b2aa735. Header label commit de85d24, main 27c0109. Documentation version 17.5. A-09, D-01, X-05, and N-05 are CURRENT. Worker 17.1 is pull request 78, commits d2cb887 and 43d7b59, published on main at 2cb2a5a on 29 Oct 2026. Documentation version 17.1. Header title IntoFocus AI Consensus Control. Version label 17.1. X-26 CURRENT. Workers 16.1 through 16.4 are pull request 76, published on main at 677f077 on 28 Oct 2026. Pull requests 74, 75, and 77 merged with that pull request. Documentation version 16.4. Out of Stock (R-17) is commit 95ed0de on main, recorded as documentation version 15.3 on 28 Oct 2026. No worker label. Prior line: main commit 7af49b0, PR 72 merged 28 Oct 2026 (preview commit 48814d1). Worker 15.2. Prior line: main commit 3b333ae, PR 71 merged 28 Oct 2026 (preview commit 8e70ae5). Workers 13.1 through 14.4. Prior line: main commit dd32396, PR 67 merged 27 Oct 2026 (worker commit fe4c0c4). Production https://ifai-dashboard.netlify.app/dashboard. Workers 12.1 through 12.8. Next.js 16 App Router. Route /dashboard. Prior line: main 345a755, PR 58, workers 11.5 through 11.7. Earlier line: main 874c9cb, workers 11.1 through 11.4, PRs 50, 51, 52, and 53. Earlier line: PR 46, commit d9911c9, workers 9.1 through 10.5, approved 26 Oct 2026. |
| Data verified | Retail Overview, Findability, and Summary Briefing leads were checked on the approved preview on 27 Oct 2026. Run Details, Product Fact Checks, and Citation Ecosystem leads, and the shared table fit, were checked on the approved previews the same day. The map shows the published run and its matching API run. AI Search and Competitive Radar use the last 30 UTC days. Catalog Health detail tabs were checked on the approved preview on 28 Oct 2026. AI Readiness heroes, the missing-fields chevron, and the fender.com Yes link were checked on the approved preview the same day. The Out of Stock tab (R-17) was recorded from commit 95ed0de and the hourly stock views on 28 Oct 2026. This closeout did not open a new preview. |
| Purpose | Tell implementers what is true now, what the target architecture is, and which FDD decisions block formulas or schema. |

# 1. Scope and FDD IDs

| **If the FDD says** | **Engineering does** |
|---|---|
| CURRENT | Keep the behavior. Add a test if not pinned. |
| REFINE | Change copy, layout, links, or labels. Do not invent a metric. |
| TARGET | Build behind flags or as a vertical slice; no demo values as intelligence. |
| DECISION | Do not implement the contested part; keep a stub only if harmless. |
| LATER | Leave a note. Do not scaffold the workflow. |

**Documentation governance (FDD X-20) applies to this TDD: PM agents read current docs before delegating, update after verified work, set the first line to “Documentation version: \<approved PM/Worker version\>” for every affected update, and add a change-log row. Project Manager N's workers are N.1, N.2, N.3 in delegation order. The documentation version is that label. PM7 ended at 7.5. The approved documentation line is 16.4, covering workers 16.1 through 16.4. The prior lines are 15.3, covering the Out of Stock tab (R-17) from commit 95ed0de, 15.2, covering worker 15.2, 14.4, covering workers 13.1 through 14.4, and 12.8, covering workers 12.1 through 12.8. The earlier lines are 11.7, covering workers 11.5 through 11.7, 11.4, covering workers 11.1 through 11.4, and 10.5, covering workers 9.1 through 10.5. Do not continue 7.x after 7.5, and do not continue another Project Manager's sequence. Named Google versions are optional; Google history is for recovery.**

# 2. Current architecture and verified constraints

> • Next.js App Router canvas at /dashboard; browser reads public.canvas\_\* via anon/publishable key; service role never in browser.
>
> • Guest dashboard path exists; DASHBOARD_LOGIN_REQUIRED can be false (X-15 TARGET before external clients).
>
> • Hard-coded retailer channels remain (amazon/walmart/musicians-friend).
>
> • AI run immutable once published. The battery asks 3 repeats per question per engine (306 calls, 549 with the catalog rotation, on since 13:27 UTC 4 Nov 2026). Wave 2 (migration 20261111205426, applied 11 Nov 2026) makes 64 active prompts, 61 fixed: 819 calls with the rotation from the 12 Nov run. Ledlenser's API job (ledlenser_subchat_v1) is read through ledlenser.canvas_ai_api_* (20261111222737). Brian Watson's API job asks the active fixed prompts (fender_ai_subchat_collector v13), so it goes from 465 calls (31 questions) to 915 (61 questions) at 3 repeats on 5 engines. ChatGPT model often blank.
>
> • Estimate fallbacks for Phase 1 / enterprise dollars still in templates — must stay labeled estimates.
>
> • No fee fields in client views (X-17).
>
> • Why not Fender is one sentence from the stored answer and cited pages: who was named most, whether Fender/Squier was mentioned, and how many cited pages are Fender pages (C-04 CURRENT, workers 9.1 and 10.2).
>
> • The six main bubbles and every satellite have no explanatory hover text (X-23 CURRENT, H-02 CURRENT). Panels keep custom definition tooltips. Workers 16.1 through 16.4, pull request 76, main 677f077.
>
> • Hover or focus on a main bubble opens three signal slots and slides the map clear of them. Slots stay until a click outside. X-22 stays TARGET until those slots are confirmed as the largest gap, the largest opportunity, and the highest-priority action.
>
> • Every main bubble and every satellite shows one hero figure and a short label, sized to fit inside its circle. The Summary bubble shows the logo and the title only. AI Readiness satellites open Findability, Machine Readability, and Amazon A+ Matrix. Competitive Radar satellites open Competitor Wins and Engine Comparison. A satellite repeats its main bubble's figure only when that tab has no next-best figure. The client dashboard does not present the catalog SKU count or the division count. Workers 16.1 through 16.4, pull request 76. The Run Summary trend chart is at the top and can be collapsed. Spoke panels keep the one-line description and do not render the badge, the duplicate title, or the AI Search header stat boxes (workers 9.5, 10.1, and 10.5).
>
> • Run Details leads with Unbranded Discovery and Branded Consideration. Product Fact Checks leads with Accuracy beside its explainer. Citation Ecosystem leads with the Fender-owned link share. Category Battlecards, Competitor Wins, and Engine Comparison each open with a bold hero and a graph of the issue on that tab. Retail Overview opens with three share pies: Buy Box withheld of current readings, MAP leakage of listings with a stored MAP price, and splintered bundles of the bundles in this read. Findability opens with a hero percentage, ratio, and disc for each outcome, led by exact official product pages. Summary Briefing opens with those shares plus unbranded discovery, each as N of M and a percentage, and a monthly potential lost brand revenue placeholder that reads Not available\* until a stored field exists. Resizable tables fill the panel on a first visit and keep short cells on one line. A saved drag still wins. X-03 and X-08 stay REFINE. D-01 stays REFINE (workers 11.1 through 12.8). Suppressed Listings, MAP, and Catalog Governance each lead with their share. On Catalog Governance the bundle share is labeled Splintered listings, and Specs complete sits beside it. A chevron on each hero switches the table underneath. The specs table filters by the top three missing fields and by how many fields are missing. A third-party offer shows the Amazon seller id. Workers 13.1 through 14.4, pull request 71, commit 8e70ae5. AI Readiness opens with four heroes: fender.com page found, Amazon attribute completeness, fender.com completeness when a page is found, and found pages missing additionalProperty. Page found is red under 85%, yellow from 85% through 95%, and green above 95%. Completeness when a page is found is red under 95%, yellow from 95% through 98%, and green above 98%. The missing-fields chart opens from a chevron. A found row with a stored URL links Yes to that page. Worker 15.2, pull request 72, commit 48814d1.
>
> • Catalog Health tabs are Retail Overview, Suppressed Listings, MAP Leakage, Catalog Governance, and Out of Stock (R-17, commit 95ed0de). Out of Stock reads public.canvas_listing_sales_loss and public.canvas_listing_stock_episodes. Those views read command.mv_listing_sales_loss and command.mv_listing_stock_episodes. pg_cron job refresh_stock_loss refreshes both at minute 17 of every hour. Day windows count back from that refresh, so a row can be up to an hour behind. The browser reads the public views with the anon key. The materialized views are not granted to anon. A live listing is an electric-catalog row with a current price above zero. The table includes a live listing with at least one out-of-stock day or no-Buy-Box day in the last 365 Keepa days. Out of stock is a Keepa day with no new price. No Buy Box is a Keepa day with a new price and no Buy Box price. A day with no Keepa row is unknown, is not counted, and ends a stretch. The sales rate prefers SmartScout 12-month revenue divided by in-stock days in that year when revenue is above zero and in-stock days are at least 30. Otherwise it uses SmartScout revenue for the last 30 days divided by in-stock days in those 30 when that revenue is above zero and in-stock days are at least 7. Estimated lost sales is that rate times out-of-stock days in the last 365 days, rounded to the cent. The no-Buy-Box upper bound is the same rate times no-Buy-Box days and is not added to lost sales. A null rate is shown as Not estimated, never zero. Rows sort by estimated lost sales, then by out-of-stock days. Opening a row lists the inputs, the dated stretches, and links to the Keepa chart and the Amazon listing. This figure is not the R-06 80% suppression model. Phase 1 and enterprise dollar figures stay analyst estimates with their formulas still unopened.
>
> • Documentation version 18.4. ResizableTable sort marks are directional chevrons. Suppressed Listings omits the Buy Box column and the Source column. AI Readiness tabs are Findability, Amazon Specs, Brand-Site Specs, and Amazon A+ Matrix. Amazon Specs does not show a brand-site percentage. Brand-Site Specs does not show an Amazon percentage. Catalog Governance Specs complete opens Amazon Specs. consensus-scores.ts scores AI Foundation, AI Commerce, and AI Consensus. A missing component is dropped and the remaining weights rescale. It is never zero. Active products available and AI Actuation are omitted. The Partner-led authorized names on screen are a placeholder: Amazon Retail, Austin Bazaar, and GearTree. A score under 40 is danger, 40 through 70 is warning, and above 70 is success. Out of Stock leads with the summed estimated lost sales. The Estimate tooltip holds the population and the rate rule. DOCUMENTATION_VERSION is 18.4. R-18 is not built.
>
> • On main (worker 18.6, pull request 100, merged 3 Nov 2026): Out of Stock moves to public.canvas_listing_sales_loss_v2 and public.canvas_listing_offer_state_v2, over command.mv_listing_sales_loss_v2 and command.mv_listing_offer_state_v2, refreshed by pg_cron job refresh_stock_loss_v2 at minute 37 of every hour. The population is electric-catalog rows with a current price above zero or a retail-map row, so listings with no active offer are included. The rate is SmartScout 12-month revenue over in-stock days in the last 365 when revenue is above zero and in-stock days are at least 30, otherwise last-30-day revenue over in-stock days in the last 30 when at least 7. Estimated lost sales is that rate times out-of-stock days in the last 30, 90, and 365 days. Each row carries revenue_source, baseline_method, currency, the revenue window dates, and in_stock_days_used. A row without a rate carries awaiting_inputs_reason: no_keepa_history, no_sales_source, smartscout_reports_no_sales, or too_few_in_stock_days. There is no no-Buy-Box dollar and no 80%. Offer-state stretches carry Keepa sales-rank drops as activity only. The v1 views stay in place.
>
> • On main (worker 18.5, pull request 101, merged 3 Nov 2026): Done and Set aside live in public.issue_set_asides, one row per client_key, check_key, and entity_key, with outcome done or set_aside, and registries public.set_aside_clients, public.set_aside_checks, and public.set_aside_reasons. A done row has no reason. RLS is on with no policies, so the public key cannot write the tables. The browser writes only through the SECURITY DEFINER functions public.mark_issue_done, public.set_aside_issue, and public.reopen_set_aside, which share private.check_issue_input. They validate the client, check, reason (set-aside only), note, name, and entity id, and record auth.uid() when a session exists. A trigger writes each insert and update to public.audit_log. The browser reads public.canvas_issue_set_asides, public.canvas_set_aside_reasons, and public.canvas_set_aside_events, each with an outcome column. Reopen updates the same row. Wired checks: command_center_queue, amazon_specs, brand_site_specs, listing_content, buybox_suppression, and map_pricing. out_of_stock is registered and not yet wired.
>
> • Failed reads (X-13, worker 21.2, PR 118): lib/canvasData.ts settles each bundle read on its own with a 20-second limit. bundle.unavailable names each failed view, and failedReadTip(bundle, key) in lib/fender-canvas/canvas-reads.ts gives the Not available\* tooltip. A piece that loaded before keeps its last good value and the Stale badge shows. The full error shows only when every read fails.
>
> • Map interaction (X-32, worker 21.1, PRs 127, 132, 135): inspecting a bubble no longer re-renders the graph. IOM_CUSTOM_CURSOR is false in lib/canvas-sdk/IomCursor.tsx, so the native cursor shows; the cursor: none rules in iom-theme.css apply only under html.iom-custom-cursor-active. The pointer glow is one composited layer moved by transform, SVG blur filters are pre-rendered gradients, the panel slides by transform in 0.45 s, and prefers-reduced-motion stills both. The tour card picks its side per step, and tour-from-live builds one-line bullets.
>
> • Catalog Health (worker 21.4, PR 121): usePortfolioRetailSnapshot excludes Approved exception set-asides from MAP figures once (R-12). The bundle population is bundle-flagged retail rows with a live offer (R-13). Division rows come from divisionRowModels with N of M and one next-step link (H-04).
>
> • AI Readiness (worker 21.3, PR 119): page-found-evidence maps the spec check's stored codes (search_results_no_matching_model, search_candidate_page_missing, findability_page_not_read, search_page_lacks_this_sku, search_page_lacks_part_number) to plain reasons, grouped in one select. A reason opens Findability with evidence=asin:\<ASIN\>. newestCheckTime is shared by Findability and Amazon Specs; page found uses the spec_readiness job time from canvas_freshness.
>
> • Action Items (worker 21.5, PR 122): urgent-interventions-html renders Fixes in priority order. Revenue Estimates and Opportunity show a method table with Not available\* for undocumented steps. The Current findings tab is removed and aliased to Urgent Interventions in canvas-url-state. e2e/figure-first-audit.spec.ts lists stated exemptions and no known gaps. generate-fender-v3-spec no longer emits {division_count}.

# 3. Proposed target architecture

> • Three density shells (Minimal / Balanced / Deep) over one published snapshot + period (X-21).
>
> • Balanced hub: bubble hover slots from computed gap/opportunity/action feed (X-22); no top-left widgets.
>
> • Summary IA: Briefing / Performance / Opportunity (H-07).
>
> • Catalog Health spoke with seller-type label (R-01/R-02).
>
> Actuation records (SC-03) stay TARGET. The Partner-led authorized-seller list saved in this browser is R-18 CURRENT. A per-client database list is R-19 TARGET, before a second client, and takes precedence when it is stored.
>
> • Observation rows for retailers (R-10); calculation container for R-06/R-09.
>
> • Done-Together actions with Need help? conversation request (N-07); no ownership toggle.

# 4. Client / tenant configuration

| **Setting** | **Uses** | **FDD** |
|---|---|---|
| Seller model | Controlled Buy Box rules; Overview label | R-02, SC-02 |
| Authorized sellers | User chooses who is controllable when seller type is Partner-led | R-18 |
| Retailer list | Observation rows | R-10, X-30 later |
| Catalog + MAP uploads | Approved foundation data | R-16 |
| Prompt set version | Questions, roles, locale | A-08 |
| Engine allow-list + cap | Three search engines and five API engines; cap is the question set times 3 repeats | A-02 |
| Staff assignment | Who may open the client | X-15 |
| Actuation programs | Evidence + dates for SC-03 | SC-03 |

# 5. Data flow

Source → collection jobs → observation storage → published snapshot → canvas views → UI. New writes from the browser only for allowed preferences and approved uploads after server validation. The Partner-led authorized-seller list is one of those browser preferences (R-18).

# 6. Provenance, freshness, nulls

> • Every published figure carries population, coverage, source, checked_at, job id.
>
> • Partial → asterisk semantics (X-25). Null ≠ 0 (X-13).
>
> • Keepa labeled observed vs modeled when used under R-06.
>
> • Raw payloads retained server-side for evidence; not dumped into client bundles.

# 7. Retailer extensibility

One row per client, listing, retailer, check. Do not add Sweetwater/Reverb as another column prefix. Google/TikTok Shop are LATER (X-30) but must use the same observation model.

# 8. AI-search run model

> • Prompt set versioned; run immutable when published.
>
> • Call stores engine AND model; missing model → “not recorded” (A-03).
>
> • 3 calls × question × engine since 3 Nov 2026 (A-02). The cap for any added engine is the question set times 3 repeats. API engines count repeats 1 to 3 only (API_REPEAT_CAP).
>
> • An engine that failed every call is omitted from result tallies. Provider errors stay on errorLine. No IntoFocus alert (A-09 CURRENT).
>
> • AI Search and Competitive Radar default to the last 30 days ending on the published run's date, counting published review runs with answered calls only (defaultWindowBounds and defaultWindowRuns, X-09 CURRENT, worker 21.6, PR 120). One run, the previous run, a range, or all time come from the same pill. The map shows the published run and its matching API run, except the Competitive Radar bubble: it reads the Battlecards rows for the 30-day window at map load with the tab's category-lead function (lib/ai-search/radar-bubble.ts, canvas-surfaces.ts; decision 40, worker 24.8, PR 158). A period shared by every spoke remains TARGET. History compares like prompt-set versions.
>
> • Fact checks require coverage or stated sample (A-05). In Run Details, factCheckColumnLabel returns the stored accuracy label for probe rows and exactly “n/a” for non-fact-check rows. The same helper drives display, sorting, and the shopping drawer (A-03; implemented in 7.5).
>
> • API engines (A-02, worker 21.8, PRs 129 and 134): migration 20261104160000 adds canvas_private.ai_api_runs and ai_api_calls and public.canvas_ai_api_runs, \_calls, \_probes, and \_citations (SELECT only for anon and authenticated), applied on production at 21:30:42 UTC on 4 Nov 2026 (recorded version 20261104213042) by the FenderTest agent after Brian Magazu's approval. A run counts when it finished completed or partial, matches the battery's questions, and has answers; the dashboard also requires the battery's fixed questions, so one-question smoke runs stay out. The All · Without API · API only switch drives every AI Search tab; with API engines included, fact checks count fixed questions only; Brian Magazu decided on 9 Nov 2026 that every engine choice will count the rotating catalog questions (A-05), which ChatGPT, Gemini, and Perplexity ask. mapAiSearch pairs the published run with the nearest counted API run for the map. NEXT_PUBLIC_AI_API_ENGINE_VIEWS is on by default; '0' turns the reads off.

# 9. Identity model

Client SKU (active/discontinued/replaced); marketplace listing (ASIN/parent/variation); offer; bundle (brand vs dealer); official page outcome; seller identity for Controlled Buy Box. Hub SKUs and retail monitored populations must not share one label. The client dashboard does not present the catalog SKU count or the division count.

# 10. Calculation framework

> • Versioned assumption sets; Brian approves weight changes (SC-\*).
>
> • Suppression monthly opportunity = revenue(last 30 unsuppressed days) × 0.80 with labeled assumption (R-06). Not shown on Out of Stock.
>
> • Out of stock lost sales = sales per in-stock day × out-of-stock days, for the last 30, 90, and 365 days. No 0.80 and no projection (R-17).
>
> • MAP exposure = gap × estimated units; never “lost revenue”; no double count with Buy Box (R-09).
>
> • Coverage-aware rescale; missing ≠ zero.
>
> • No silent fallback dollars; no fee multiples.
>
> • Revenue source order for R-06 and R-17, decided 2 Nov 2026: brand-reported Amazon sales for a brand-led client, otherwise SmartScout. Keepa is not a revenue source. Each dollar names its source, and sources are never summed. No source means awaiting inputs, never zero.

# 11. Deterministic vs assisted

Deterministic: counts, joins, freshness, publication, score arithmetic, suppression/MAP math. Assisted: classifications beside stored text; suppressed-listing price-match suggestions (R-15) labeled; roadmap text only after finding ids. Models must not move collector payloads or invent units/MAP/recovery.

# 12. Jobs, failures, monitoring

| **Job** | **Oct 21 observation** | **Target** |
|---|---|---|
| featured_offer_keepa | 20:41 UTC; 1076 cursor | Keep full-pass claims honest |
| buybox_seller_harvester | 20:46 UTC | Seller identity for SC-02 |
| spec_readiness | 20:04 UTC | Feed D-07 |
| map_parity_musiciansfriend | 07:35 UTC | URL publish R-11 |
| map_leakage_walmart | 20:54 UTC | Keep links |
| ai_simulations | Oct 18 partial | 306-call recurring before month default |
| findability | Not a named freshness job. The screen last-checked time is the newest stored attempt among checked listings (X-12). | Weekly batches D-02 |

# 13. Auth, tenancy, secrets, audit

> • Auth on before non-IntoFocus users (X-15).
>
> • Tenant predicate in views or signed requests (X-16).
>
> • One intentional public key; service role server-only.
>
> • Writes before login (Done and set-aside, N-08) go through SECURITY DEFINER functions that validate every input. The tables stay closed to the public key. Require a session once auth is on (X-15). Every new public view revokes all from anon and authenticated, then grants SELECT (20261104145317, 20261104152213, 20261104160000); the set-aside views were writable until Brian Watson applied 20261104152213 on 4 Nov 2026.
>
> • Audit: prompt edits, publication, MAP exceptions, Done, set-aside, and reopen (N-08), uploads, exports, Need help? requests.
>
> • Security protocol content is documentation of real controls only (X-29 REFINE). The page is /dashboard/security, linked from UserMenuDropdown, and states nothing about fees. Ryan and Brian Watson review it before launch.

# 14. Export architecture

Server-side from the same published query as the screen; CSV for rows at launch, with filter, sort, as-of time, and population sentence; Excel and a PDF of the view are LATER (decided 9 Nov 2026); cap and audit (X-10).

# 15. Performance and accessibility

> • Desktop-first (X-14). Custom tooltips keyboardable (X-07).
>
> • One type scale and one font family (X-27 REFINE). Decided 9 Nov 2026: Geist and Geist Mono, weights up to 600, colors and status colors from the IntoFocus AI Brand Book V2 in docs/brand (X-34), a flat map, and every data table sorting, searching, and downloading CSV (X-33). Nothing on the client dashboard smaller than 10px; labels and table chrome may sit at 10px; a sentence uses nearby body size; raised type causes no overlaps, wraps, or collisions (X-31 CURRENT). Inactive tabs are outline pills; the selected tab stays the filled pill (X-05 CURRENT).
>
> • Bubble pulse per viewer (X-24) must not harm accessibility (prefer motion-safe).
>
> • Map effects stay light on slower laptops (X-32): measure with scripts/measure-map-hover.mjs at 4x and 6x CPU throttle before adding an always-running effect.

# 16. Migration from stale/demo fields

| **Item** | **Move** |
|---|---|
| Brand Portfolio strings | → Summary (H-06). Client copy done in 7.4. Spoke id hub unchanged. |
| Portfolio Retail strings | → Catalog Health (R-01). Client copy done in 7.4. Spoke id ecommerce unchanged. |
| Commercial Sizing | → Opportunity (H-05). Client copy done in 7.4. Estimate labels kept. |
| Featured Offer primary copy | → Buy Box + tooltip “Amazon also calls it the Featured Offer.” (X-19). Client copy done in 7.4. Do not rename featured_offer\_\* columns or the featured_offer_keepa job key. |
| Simulations tab | → Run Details (A-03). Tab title done in 7.4. Empty model string is “not recorded”. File name SimulationsExplorer unchanged. |
| Interactive ROI tab | → removed. Current findings was removed on 4 Nov 2026; Action Items is Urgent Interventions and Revenue Estimates (N-05). |
| Example action/roadmap HTML | Urgent Interventions is Fixes in priority order (N-01 CURRENT). The roadmap has one tab, the five current findings (S-01 CURRENT). A plan of activity stays S-02 TARGET. |
| Estimate template fallbacks | Keep labels; never look measured |
| Owner chips as ownership | Replace with Done-Together / Need help? (N-07) |
| Title AEO Consensus Control | → IntoFocus AI Consensus Control + documentation version 23.1 (X-26 CURRENT) |

# 17. Test strategy

> • Renames R-01, H-06, A-03, and X-19 are covered by unit tests and updated e2e labels. The 7.5 A-03 regression pins non-probe “n/a”, preserved probe labels, the Checked header, and date-only Checked cells; the production desktop pass also covered sorting, row opening, the drawer, and the simulations alias. Fee absence X-17 still applies.
>
> • Score tests: coverage rescale; missing ≠ 0; no-managed-Amazon weight split.
>
> • R-06 and R-17: 80% labeled on R-06 only; each dollar named by its source; sources never summed; awaiting-inputs count; awaiting never \$0.
>
> • N-08: Done needs a name; set-aside needs a reason and a name; reopen keeps one row; e2e mocks the Done and set-aside endpoints so tests never write the live audit log.
>
> • A-09: failed run not renderable in client fixture.
>
> • Brand and layout checks (Tooling Worker, PR 161): `npm run lint:brand` (scripts/lint-brand.mjs) flags font weights, native title tooltips, TSX files over 400 lines, and em dashes in client copy; 73 issues on main at 10 Nov 2026. e2e/overflow-1280.spec.ts checks that no page scrolls sideways at 1280 px and reports tables that scroll inside their panels.
>
> • e2e cleanup (worker 24.9, PR 159): AI Search tests wait up to AI_READ_MS (90 s) in e2e/fixtures. Temporarily loosened: the Battlecards pies 720 px height check and the history test's Scoring method changed marker; restore both, and lower AI_READ_MS, once the AI Search reads are faster.
>
> • Do not freeze Oct 21 counts as product copy. Consensus score tests cover rescale, a dropped input is not zero, and the Partner-led placeholder sellers. Do not freeze a live score percentage as product copy.

# 18. Risks and open decisions

| **Risk** | **Why it matters** | **Hold** |
|---|---|---|
| Four populations, one glance | Executives add 3,682 and 1,076 | Labeled denominators D-04 |
| 80% without revenue inputs | False precision | Awaiting-inputs lane; source order decided 2 Nov 2026 |
| Scores before coverage | Zeros look like failures | Rescale rule SC-\* |
| HMR/local env hang | next dev HMR can block hydration. next start verified the 7.4 terminology pass. | Prefer API + e2e in CI |
| Roadmap omit undecided | Wasted build | S-03 |

# 19. FDD-to-TDD traceability

| **FDD** | **Technical home** |
|---|---|
| X-21/X-22/X-23 | Canvas shells + hub slot feed + tooltip removal |
| H-06/H-07/H-05 | Summary IA + Opportunity drill-downs. H-03 is CURRENT: Summary Briefing shows the AI Consensus score in the findings row, and the result sentence is the tooltip on that title. H-07 stays REFINE. |
| SC-01 / SC-02 / SC-04 / SC-03 / R-18 | Score service is live for Foundation, Commerce, and Consensus. Actuation records stay TARGET. The Partner-led authorized-seller control saved in this browser is R-18 CURRENT. A per-client database list is R-19 TARGET. |
| R-01/R-06/R-09/R-15/R-16/R-17 | Catalog Health + calc + assistant + uploads + out-of-stock estimate |
| A-02/A-03/A-05/A-09/A-10 | Run pipeline + API engine views and switch + Run Details + fact-check method + alerts + citation rank |
| D-07/D-08/D-01/D-02 | Amazon Specs and Brand-Site Specs are live. Findability last-checked is X-12 CURRENT. The Amazon Specs hero share uses stored field totals. D-04 is CURRENT. The findability schedule stays D-02 TARGET. D-10 and D-11 are CURRENT. D-09 is REFINE: the Unchecked table leads with a stored reason, and the count is not generally zero. |
| N-07/N-05/N-08 | Done-Together + digest + Done and set-aside history |
| X-20/X-29 | Docs governance + security protocol content |
| S-03 | No build until decision |

| X-32 | Map interaction: hover isolation, native cursor, light effects, measure-map-hover script |
|---|---|
| X-13 | Per-read settle in canvasData, bundle.unavailable, failedReadTip |
