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
