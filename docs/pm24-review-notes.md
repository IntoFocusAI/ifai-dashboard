# Brian's review notes on the PM24 test batch (10 Nov 2026)

Recorded in the FDD as decision rows PM24-1 to PM24-3 (docs/fdd/launch-and-registers.md). The docs closeout below is done.

From the previews of PR 151 (AI Search) and PR 152 (Catalog Health). He
approved merging both as they are. All three were built in PR 158
(worker 24.8, merged 10 Nov 2026). Put them into the FDD at the next docs closeout.

1. No tooltips on the main map bubbles. The AI Search Visibility and
   Competitive Radar bubbles show a hover tooltip saying they include API
   engines. Remove it: the data speaks for itself, and that detail is clear
   once the user opens the view.
2. Competitive Radar disagrees with itself. The map bubble says "Yamaha
   leads Acoustics" while the Category Battlecards tab shows Taylor as the
   top rival for Acoustics. Find out why (likely two populations or two
   rules for "leads") before changing anything.
   Finding (worker 24.8, 10 Nov): both places use the same rule for
   "leads" (the other brand named most in resolved unbranded-discovery
   answers, per category) but count different answers. The map bubble read
   only the published run plus its matching API run (Nov 8: Yamaha 34,
   Taylor 24 of 74). Battlecards reads the date-pill window, Last 30 days
   (Taylor 286 of 648; Taylor about 305 vs Yamaha 293 in a rebuild from raw
   rows). Ledlenser had no disagreement (Fenix leads Flashlights in both).
   Resolved: Brian chose option A. The Radar bubble now reads the
   Battlecards rows with the tab's category-lead function
   (lib/ai-search/radar-bubble.ts, wired in useApiEngineLoad.ts), so the
   two cannot disagree. Fender reads "44.1% Taylor leads Acoustics". Cost:
   the bubble shows "Loading run" until the 30-day read lands (about 32 s
   Fender, 16 s Ledlenser on the preview), accepted for now. PR 158.
3. Product Fact Checks wastes horizontal space. Put the accuracy figure to
   the right of the "catalog products checked" figure, not below it.

Also open from this batch:
- The docs closeout for 24.3 and 24.4 has not been done (FDD and TDD are
  still on 23.1), and there is no header-label pull request yet.
- The stale-data asterisk is not on the map bubbles or the Minimal view
  (needs lib/fender-canvas/minimal-metrics-ai.ts, the Summary worker's file).
- Netlify's secrets scan is off (netlify.toml), at Brian's request.
- 28 of 244 end-to-end tests fail on main; they are not part of the checks
  on a pull request. Decide whether to fix or retire them.
- Fender's AI Search takes about 14 seconds to show data.
- Usage: two workers plus the PM on the same model used the 5-hour limit
  in one evening. Plan worker count and model with that in mind.
