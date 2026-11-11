# Brian Magazu's decisions for the PM23 build (9 Nov 2026)

These are the rules for the views built under PM23. The FDD wins where it
already says something; these fill the gaps. They go into the FDD at the
closeout of each view. Open items are marked OPEN and are not built.

## Cross-dashboard (foundation)

1. Tables (new FDD row X-33). Every data table sorts on every column, has a
   filter or search, and downloads what is shown as CSV, with the filter,
   the sort, and the as-of time.
2. Export (X-10). CSV only for launch, built on the server from the same
   query as the screen, with the population sentence. Excel and a PDF of
   the view are LATER.
3. Type (X-27). Geist for all text: 400 for body, 600 for headlines and
   hero figures, never heavier than 600. Geist Mono only for eyebrows,
   labels, sources, and table numbers. Sizes stay on the dashboard scale
   of X-31 (10px floor, 12 to 13px sentences).
4. Partial figures (X-25). An asterisk when a filter narrows the figure,
   it covers part of its population, an input read failed, or its data is
   older than twice its normal check schedule. The tooltip names what is
   missing, the coverage, the source, the last check, and the effect.
   Normal check schedules (Brian, 9 Nov 2026, for now): AI Search every 2 to
   3 days (the Sun, Tue, Thu runs); Buy Box and Keepa daily; MAP prices
   daily; spec and Findability checks weekly.
5. Renames (X-18, D-03). One name per figure:
   - "Unbranded SOV" becomes "Unbranded Discovery".
   - "Splintered bundles" becomes "Splintered Listings" everywhere
     (splintered listings may apply to more than bundles for other clients).
   - The Catalog Health tab "MAP" becomes "MAP Leakage".
   - "Brand Consideration" becomes "Branded Consideration".
   - The roadmap is "Roadmap", and its tab is "30-60-90 Days" (where the
     user looks to understand activity over the coming quarter).
   - "Acoustics · Yamaha" style radar labels read "Yamaha leads Acoustics".
   Nothing else is renamed.
6. Satellite click (X-02). A satellite opens its tab.
7. Same figure, same number. Summary Briefing, the Roadmap, and Action
   Items use the map's population for AI figures (the published run plus
   its matching API run). The AI Search and Competitive Radar tabs follow
   the date pill.
23. Bubble pulse (X-24) is LATER.
25. Foundation review. Done: Brian approved the foundation alone and it
    merged first (PR 148, 9 Nov 2026). Views build on it.

## Brand book (docs/brand/IntoFocus_AI_Brand_Book_V2.pdf)

26. Colors. Page #070B14, cards #0B1220, hover #141E33. One accent, ice
    blue #A7D8F0. Text #F8FAFC, #AEB8C7, #8B95A7. Borders #64748B. The
    light theme uses the book's light colors.
27. Status colors. Oxblood #CC5B63 bad, Champagne #D4B66F okay, Pine
    #6AB792 good, each with a mark (x, dash, check) and a word. Status
    colors only on data; never on buttons, links, or tabs. Pies and charts
    use ice blue for the measured slice and gray for the rest, at most two
    blue series. Status words: Poor, Fair, Good wherever a figure has no
    word of its own; the FDD's own words stay where they exist (for example
    On track, Tied, Behind on Category Battlecards).
28. Map effects. A flat map in brand style: rings, no glows, halos, or
    moving dots.
29. Voice. Client copy has no contractions, emojis, or em dashes, and none
    of: premium, luxury, best-in-class, delve, seamless, unlock,
    game-changer. Buttons are verb plus object.
30. The brand book is a standard below the FDD. A conflict goes to Brian.

## Summary

8. Score targets (H-07). 70 for AI Consensus, AI Foundation, and AI
   Commerce, shown as "41 vs target 70". H-07 stays REFINE until AI
   Actuation exists.

## Catalog Health

9. Seller model (R-02). The seller-type label is final for launch.
10. MAP exposure (R-09). Build violations N of M, price gap, estimated
    monthly units (SmartScout), and discounted retail value (gap times
    units), labeled analyst estimate, never "lost revenue". Duration waits
    for Brian Watson's MAP history.
11. Upload (R-16) is LATER.
12. Per-client seller list (R-19) waits for the first real Partner-led
    client, with X-16.

## AI Search Visibility

13. Fact checks (A-05). Every engine choice, All included, counts the
    rotating catalog questions, and leads with "N of M catalog products
    checked". Only ChatGPT, Gemini, and Perplexity ask the rotating
    questions; the tooltip says which engines a figure covers.
14. Prompt history (A-08). Approved: one additive read for the prompt edit
    history, applied by the FenderTest agent. Ledlenser's prompt list stays
    read-only.

## AI Readiness

15. Required specs (D-05). Fender uses the guitar and instrument list;
    Ledlenser uses the lighting fields Brian Watson loaded. Both stay marked
    placeholder, and Amazon Specs names the list it used.
16. A+ content (D-06). OPEN. Sales data exists (SmartScout revenue per
    listing). What is missing is the lift: how much more a listing sells
    with A+ than without, which is an assumption, not data. PM23
    recommended: close D-06 on the content shares and move the A+ dollar
    figure to LATER. Fender: 345 listings with A+, 574 without.

## Competitive Radar

17. Story pack (C-01). OPEN. PM23's reading: a deck an IntoFocus seller
    or the client's sponsor takes into a meeting, built from live data, in
    the brand book's dark sales-deck style, about six slides: where the
    brand stands against top rivals; where it loses (categories, engines,
    rivals); why (Buy Box, MAP, splintered listings, official pages,
    specs); two or three captured AI answers with platform and date; the
    sites AI cites most; the 30-60-90 plan. PM22's version only repeated
    the Briefing on a page. Questions for Brian: is the audience a prospect
    or a client sponsor, and is it needed for launch? PM23 recommended
    building it last, after the Roadmap rules.

## Action Items and Roadmap

18. Client-editable assumptions (N-03) are LATER.
20. The Roadmap stays, with one tab, "30-60-90 Days". A Progress tab is
    LATER.
21. How the plan is built (S-02), and what Action Items recommends beyond
    the five findings. OPEN. Brian asked for recommendations drawn from
    intelligence that is not a hero figure (for example, cited community
    sites and publications) and for questions to set those rules. Fender,
    Nov 8, of 201 shopping answers with sources: Guitar World 96 (48%),
    Guitar Player 48 (24%), fender.com 44 (22%), MusicRadar 31, Guitar
    Center 30, Reddit 27 (13%). Ledlenser, Nov 6: 1Lumen 10%, CleverHiker
    9%, GearJunkie and REI 8%, Olight (competitor) 6%. Questions sent at
    12:00 PM ET, each with PM23's recommendation:
    a. Site types: brand-owned, retailer, publication or review, community
       or forum, video, competitor brand, reference, other. Kept as data
       (an additive table, needs approval); unlisted sites read Unclassified.
    b. Consistently: cited in at least 10% of shopping answers with sources,
       in at least 2 of the last 3 published runs.
    c. Action per type (Brian approves wording): publication, PR and review
       outreach into buying guides; community, a plan to keep the brand's
       presence accurate; retailer, listings match brand facts; video,
       creator outreach; competitor site, comparison content on the brand
       site; reference, correct the entry; brand-owned cited rarely,
       official-page work.
    d. Other signals as actions, where the client has the figure: rival-led
       categories, weakest engine, fact-check contradictions, products with
       no official page, missing specs, out-of-stock listings.
    e. Wording: the stored fact, then the action, no promised result; the
       evidence opens the cited links.
    f. Ranking: the ecommerce fixes keep their order; source and competitor
       actions follow, by share of answers affected.
    g. Phases: Days 1 to 30 listing fixes; 31 to 60 catalog and site
       content; 61 to 90 outreach programs.
    h. Refresh with each published run; an action leaves when its trigger
       drops below the threshold or it is Done or Set aside.
    i. AI Actuation: a Done PR or community action with name, evidence
       link, and date counts toward SC-03 in principle, built after launch.
    j. Each source action names the categories where that site is cited most.
22. Owner sentence (S-04): "IntoFocus's recommended plan for {brand}".

## Minimal

19. Ask IntoFocus (N-09) and Deep dive are LATER. X-21 closes.

## Auditor

24. Every Auditor runs on GPT-5.6 Sol High. Until an OpenAI option is
    connected in Claude Code, Auditors run on Fable (Brian, 9 Nov 2026).
    See docs/auditor-brief.md.

## How the work runs (Brian, 9 Nov 2026, evening)

31. PM24. PM23 paused after worker 23.1, when the build moved from Cursor
    to Claude Code. The Project Manager is now PM24 and the remaining
    workers are 24.2 to 24.7 (briefs in docs/pm24-worker-briefs.md). Work
    already merged keeps its PM23 and 23.1 labels. These decisions keep
    their numbers and this file keeps its name.
32. Batch mode. Several view workers run at once. Brian gets one combined
    review per batch. The docs close out once per batch, with one
    header-label pull request per closeout. Detail: "Batch mode" in
    docs/pm-handoff.md.
33. Worker branches. Each worker pushes only to its own branch,
    `worker/<number>-<short-name>` (for example `worker/24.4-ai-search`),
    and opens one pull request to main.
34. PM24 test. The first batch is two views, 24.4 AI Search and 24.3
    Catalog Health. It runs with no audit. Decision 24 applies again when
    Brian says so.
35. Brian's answers (9 Nov 2026, evening):
    - Item 21 (Roadmap and Action Items rules a to j): approved for now,
      as written, to see how they play out in use. Worker 24.7 may build
      on them. Expect changes after his review.
    - Item 17 (C-01 story pack): the audience is both a prospect and a
      client sponsor. The idea: once a potential client's data is in the
      dashboard, pull its key findings into a sales-pitch view, with
      formatting guidance from Presentation-Assistant on Toolbelt. Earlier
      attempts were poor. It is not needed before launch.
    - Item 16 (D-06 A+ dollar figure): no A+ dollar figure for now. D-06
      closes on the content shares. The lift assumptions (how much more a
      listing sells with A+) must be worked out later and be defensible:
      they are essential to the value of combining ecommerce and AEO
      insight. Tracked with the parked dollar formulas.
    - Workers stay on the PM's model for now.
    - When a database change needs his approval, explain it in plain
      language.
    - He may miss a request in a long message, or answer out of order.
      Keep a short list of what is still waiting on him and remind him
      after a while, each with a terse, plain-language explanation.

## PM24 test batch (Brian, 10 Nov 2026)

36. Ledlenser AI Search questions use the roles stored with its own
    question set (ledlenser.ai_prompts.analytical_intent). Its map bubble
    moved from 12.3% to 1.4% on the 7 Nov run.
37. AI Search data is stale after 6 days (AI_SEARCH_STALE_AFTER_DAYS in
    lib/ai-search/stale.ts). Approved by no objection.
38. MAP discounted retail value is Amazon's price gap times Amazon's unit
    estimates. Approved by no objection.
39. Netlify's secrets scan is off in netlify.toml. The read-only function
    public.ai_prompt_edits_list was applied to production with his
    approval (migration 20261109233000_ai_prompt_edits_list.sql, PR 151).
    PRs 151 and 152 approved and merged.
40. PM24-2, option A: the Competitive Radar map bubble reads the same rows
    as the Category Battlecards tab (the date-pill window) with the tab's
    category-lead function, so the two cannot disagree. Fender now reads
    "Taylor leads Acoustics". This bubble only; every other bubble stays on
    the published run plus its matching API run. PR 158.
41. The Radar bubble's longer load (about 32 s for Fender on the preview,
    16 s for Ledlenser, showing "Loading run" until then) is accepted for
    now. Speeding up the AI Search reads is a follow-up.
42. PM24-3 correction: the Product Fact Checks lead is one row: catalog
    figure, accuracy, then the question, its sentence and the
    contradictions badge. No lower box. PR 158.
43. Workers run in parallel when they do not edit the same files.
    Failing e2e tests: one cleanup worker clears them (option B, 24.9).

## PM25 (Brian, 10 Nov 2026)

44. Decision 21 (Roadmap and Action Items rules a to j) stands as written
    for worker 24.7.
45. D-06 is CURRENT, closed on the content shares. No A+ dollar figure for
    now.
46. X-15, X-16, and R-19 stay in launch scope but are held until the rest
    of the launch build is complete; they add steps that slow development.
47. lint:brand: the components/sdk flags are not fixed. Those pages are not
    linked from any route.
48. AI Search read performance: waiting on Brian Watson's diagnosis. A
    read-only log review by a worker (option 2) only if he asks for it.
49. Go ahead on the parallel batch 24.5 AI Readiness, 24.2 Summary, and
    24.6 Competitive Radar.
50. X-31: nothing on the client dashboard is smaller than 11px (was 10px).
51. No "placeholder" label ships at launch. The required-spec lists (D-05)
    need a rule that works for 20 or more future clients; Brian decides it
    later. R-19 versus the R-18 placeholder seller list and the C-01 deck
    are also open; the deck needs values we can defend.
52. Catalog Health's AI Commerce card shows "vs target 70", as Summary does.
53. Ledlenser's "Work_lights" reads "Work lights" everywhere, the map
    bubble included.
54. PRs 165, 166, and 167 approved and merged on 11 Nov 2026. The
    Competitor Wins hero keeps the status color and word (approved as
    built). Follow-ups: Engine Comparison puts engine names on the bar
    rows; MAP Leakage puts the per-retailer list to the right of the
    Discounted retail value card.
55. 21a site types: an AI job classifies each cited site from its page and
    stores type and confidence; staff overrides win; confidence under 0.7
    goes to a staff-only Needs review list; "other" reads Unclassified; no
    staff override screen before launch. Table applied to production 11 Nov
    (PR 174, migration site_types); Toolbelt job "Site type classifier
    (IntoFocus dashboard, decision 21a)" runs daily, up to 100 sites,
    skipping subdomains whose main domain is classified.
56. 21c own product pages: urgent when any brand-controlled factor (brand-
    site page found, completeness when found, machine-readable specs, Amazon
    attribute completeness, A+) is red or yellow; low priority in Days 61 to
    90 when all are green but the brand site is cited in under 30% of
    shopping answers; none when all green and cited 30% or more.
57. 21d always a focus: weakest engine ("{Brand} is named in N of M answers
    on {engine}, the lowest of the engines checked.", Days 31 to 60), the 5
    weakest questions, and the cited sites rising or falling fastest over 3
    runs. Guardrails: a gap of 10 points or more, and at least 30 answers.
58. The plan rolls: always a current 90 days, re-dated each refresh, with a
    client-chosen focus that can shift between segments.
59. Map bubbles: hero figure plus a 1 to 2 word label; status words only on
    the tabs (option B). Rail figures stay as they are.
60. Competitor Wins color is the inverse of the unbranded rule: red above
    70%, amber 35% to 70%, green below 35%, on the satellite and the tab.
61. The Roadmap bubble is static for every client: title Roadmap, then
    30-60-90 in the muted label grey.
62. Retail stale asterisk uses Watson's recheck intervals (11 Nov), counted
    per row: Buy Box, Amazon MAP, Splintered Listings 1 day; Walmart 1 day
    (Ledlenser 2); Musician's Friend 3 days; SmartScout units, Amazon specs,
    A+ 7 days. Stale is twice the interval. Findability counts rows checked
    in the last 14 days.
63. Refer to Brian Watson as "Watson" and Brian Magazu as "Brian" in all
    messages, docs, and briefs.
64. PRs 169, 170, 171, 172, and 174 approved and merged on 11 Nov 2026.
65. 21d figures count answers over the last 30 days ending on the published
    run, never one run. The 30-answer floor applies to the window. Defaults:
    "10 citations" means 10 answers citing the site; both 30-day windows
    need 30 answers with sources; an engine is named only when two or more
    pass the floor.
66. Two tiers: the weakest engine and weakest questions always show once
    they pass the floor. A gap of 10 points or more is a priority (Days 31
    to 60); under 10 is a Watch line ranked last (Days 61 to 90).
67. Moving sites: sites with 3% or more of shopping answers and 10 or more
    citations; flagged on a 10% relative change against the previous 30
    days. Brand-owned and Unclassified sites are left out.
68. Freshness on every view: each canvas view should expose a per-row check
    time for every source it uses, built into the tenant-split redesign.
    Asked of Watson 11 Nov, with three gaps: catalog.extracted_at on
    canvas_retail_listings, keepa_daily.day, and the anon read of
    canvas_listing_channel_price.
69. Topic focus is set by IntoFocus staff per client (roadmapFocusCategory
    in lib/client/active-client.ts); no client control.
70. Out of Stock wording: "N of M out-of-stock listings have no sales
    estimate yet, so they are left out of the total." Parked with the
    dollar formulas: whether listings SmartScout reports as zero sales
    should count as $0 rather than awaiting inputs.
71. AI Actuation (SC-03, after launch): IntoFocus staff confirm the client
    has an active, scheduled strategy for its most-cited sites; the moving
    sites list feeds it.
72. PRs 176, 177, and 178 approved and merged on 11 Nov 2026. PM25 hands off
    to PM26 after this closeout.
73. Watson, 11 Nov: canvas_listing_channel_price is empty for both clients
    (built for Sweetwater and Reverb, never checked); Walmart and Musician's
    Friend prices come from canvas_retail_listings, which stays correct.
    Open for Brian: retire the "Other retailers" read. Watson's freshness
    proposal for X-16: every canvas view exposes <source>_checked_at
    columns (keepa_, catalog_, featured_offer_, wmt_, mf_, smartscout_,
    spec_, content_, findability_), present from the start in each new
    client schema. Accepted by Brian on 11 Nov 2026. Retiring "Other
    retailers" is left for PM26 to raise.

