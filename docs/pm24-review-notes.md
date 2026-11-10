# Brian's review notes on the PM24 test batch (10 Nov 2026)

Recorded in the FDD as decision rows PM24-1 to PM24-3 (docs/fdd/launch-and-registers.md). The docs closeout below is done.

From the previews of PR 151 (AI Search) and PR 152 (Catalog Health). He
approved merging both as they are. These are for a later session; none is
built. Put them into the FDD at the next docs closeout.

1. No tooltips on the main map bubbles. The AI Search Visibility and
   Competitive Radar bubbles show a hover tooltip saying they include API
   engines. Remove it: the data speaks for itself, and that detail is clear
   once the user opens the view.
2. Competitive Radar disagrees with itself. The map bubble says "Yamaha
   leads Acoustics" while the Category Battlecards tab shows Taylor as the
   top rival for Acoustics. Find out why (likely two populations or two
   rules for "leads") before changing anything.
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
