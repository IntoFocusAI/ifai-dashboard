# PM23 worker briefs

Each remaining view is one worker and one pull request. Send a worker the
common rules, then its view section. Decisions are in
`docs/pm23-decisions.md`; the audit is `docs/auditor-brief.md`; the brand
book is `docs/brand/IntoFocus_AI_Brand_Book_V2.pdf`. FDD rows: download
with `python3 scripts/design-doc-edit.py download fdd /tmp/fdd.docx`, then
`show /tmp/fdd.docx <ID>`. Workers never edit the Google Docs.

## Common rules (every worker)

- You are Worker 23.N for PM23 on the IntoFocus AI client dashboard. Read
  AGENTS.md, CLAUDE.md, .cursor/rules/*.mdc, and README.md first. You build
  one view to its final intended form for launch. Brian Magazu reviews only
  finished views. You report to PM23, not to Brian.
- One branch from the latest main, one pull request, base main. Title
  "Worker 23.N: <View> final form (<row IDs>)". The body lists each change
  on its own line with its FDD id and the status it moves to if Brian
  approves, then the rows the view leaves open. Rebase on main often (Brian
  Watson merges Ledlenser work). Commit messages start "Worker 23.N:".
- In Claude Code, run in your own git worktree so parallel workers do not
  share a checkout.
- Both clients: correct for Fender (/dashboard) and Ledlenser
  (/dashboard?client=ledlenser). Ledlenser has no API-engine views and no
  set-aside views; handle that as the code already does.
- Build inside the existing view. No standalone routes or pages that
  nothing links to (a server route for CSV is fine).
- A feature whose data does not exist is BLOCKED, not built. Never deliver
  a screen or column that reads Not available* on every row.
- Never invent rules, figures, or causes. If the FDD and the decisions do
  not say, ask PM23 in your report.
- Standing rules: the map shows the published run plus its matching API
  run; the shared date pill is the only period label; dollar figures stay
  labeled analyst estimate and their formulas stay parked; nothing about
  IntoFocus fees; no delegation or paid tiers; let the data speak (caveats
  in tooltips; "analyst estimate", "Not available*", and the asterisk stay
  visible); custom tooltips only; TSX files at or under 400 lines; brand
  voice in client copy (no contractions, emojis, or em dashes).
- Database changes follow AGENTS.md: every change starts as a migration
  file in supabase/migrations, committed with the pull request, saying what
  it changes and how to undo it. Additive changes are applied only after
  Brian Magazu approves (the FenderTest agent applies them; workers do
  not). Anything that alters or deletes existing data, tables, columns,
  views, or permissions waits for Brian Watson. Never run writes against
  production.
- Do not touch: PR 110's files (components/v3/FenderBrandCanvas.tsx,
  lib/canvas-sdk/HubSlots.tsx, lib/canvas-sdk/hub-slot-types.ts,
  lib/canvas-sdk/hub-slots.css, lib/fender-canvas/hub-slot-*.ts,
  lib/fender-canvas/hub-slots.ts); Brian Watson's open migration pull
  requests; docs/pm-handoff.md; other workers' files.
- Adopt the foundation (PR 148): `StatusMark` for every status-colored
  figure (color, mark, word: Poor, Fair, Good unless the FDD has its own
  word); chart tokens (measured slice ice blue, rest gray); the
  partial-figure helper in `lib/fender-canvas/canvas-reads.ts` and
  `FigureTip`; the table toolbar in `ResizableTable` (search, N of M rows,
  Download CSV); weights at or under 600; Geist Mono only for labels and
  table numbers.
- Verify: `npm test` passes; Playwright for your changes at 1280x720; look
  at every tab yourself at 1280x720 and 1920x1080 for both clients against
  each row's FDD Acceptance text.
- Final report: PR and preview URL
  (https://deploy-preview-<PR>--ifai-dashboard.netlify.app/dashboard), per
  row what you see for each client, screenshots, anything BLOCKED,
  questions, files changed.

## 23.2 Summary (/dashboard?spoke=hub: Briefing, Performance, Opportunity)

- Briefing: equal finding cards, each N of M with a percentage. Its AI
  figures use the map's population (decision 7), so the map and the
  Briefing match. Fender today: map 66.4%, Briefing 59.4%.
- Defect: Ledlenser Briefing reads unbranded discovery Not available* while
  the map shows 12.3%. It may share a cause with the 23.4 window defect.
- Performance (H-07): each score against target 70 ("41 vs target 70").
  AI Actuation stays Not included (SC-03 BLOCKED). H-07 stays REFINE.
- Opportunity: unchanged; estimates stay labeled; no formulas.
- "Splintered bundles" becomes "Splintered Listings" in
  `briefing-retail-lead.ts` (it also shows on the Roadmap card).
- Owns: Briefing*, ConsensusScores*, ConsensusScoreView,
  ConsensusComponentBars, FenderDivisionsTable (not on ResizableTable; add
  the table rule), and lib/fender-canvas briefing-*, consensus-*,
  division-*, analyst-estimates.

## 23.3 Catalog Health (/dashboard?spoke=ecommerce)

- Seller-type label final (R-02); verify Controlled Buy Box per SC-02 for
  Partner-led Fender and Brand-led Ledlenser.
- The MAP tab becomes "MAP Leakage". R-09 exposure: violations N of M,
  price gap, estimated monthly units (SmartScout `smartscout_monthly_units`
  in canvas_listing_sales_loss_v2 by ASIN, both schemas), discounted retail
  value = gap times units, labeled analyst estimate, never lost revenue.
  Dollars name their source and are never summed across sources; no units
  means an awaiting-inputs count, never $0. Approved MAP exceptions stay
  out (R-12). No duration column (BLOCKED on MAP history, Brian Watson).
  R-09 moves to REFINE.
- "Splintered listings" becomes "Splintered Listings"
  (CatalogGovernancePanel). Move on-screen qualifiers into tooltips (for
  example Ledlenser's "That is not a failed check and not a price of zero.").
- Table toolbar: `catalog-bundles` passes its own sort handler and needs
  the toolbar prop; the Out of Stock episodes detail table is not on
  ResizableTable; SetAsideTable's Status column does not sort.
  FeaturedOfferRow uses weight 700 or more.
- Leaves open: R-06, R-07, R-11 HELD; R-10, R-15 BLOCKED (Brian Watson).
- Owns: RetailOverview*, FeaturedOffer*, SuppressedListingsPanel,
  MapChannelPanel, MapListingsTable, ChannelPriceCell, CatalogGovernance*,
  StockLoss*, usePortfolioRetailSnapshot, AuthorizedSellersControl,
  CommerceConsensusPanel, FenderListingsTable, ExploreListings,
  SetAsideTable, RETAIL_PANEL_TABS, and lib/fender-canvas retail, MAP,
  featured-offer, catalog-governance, stock-loss, authorized-sellers files.

## 23.4 AI Search Visibility (/dashboard?spoke=aeo, and the Prompts screen)

- Defect first: Ledlenser AI Search says "No published run in the last 30
  days" though schema ledlenser has runs published 5 Nov 10:30 UTC
  (4a5eda65) and 7 Nov 02:30 UTC (807cea45). Fix the window code.
- A-05 (decision 13): every engine choice, All included, counts the
  rotating catalog questions and leads with "N of M catalog products
  checked" (M from canvas_ai_probe_coverage, about 181 for Fender). Only
  ChatGPT, Gemini, and Perplexity ask the rotating questions; the tooltip
  says which engines a figure covers. A-05 moves to CURRENT.
- A-08 (decision 14): the Prompts screen shows each prompt's change history
  from command.fmic_ai_prompt_edits through one additive read function in a
  new migration (closed PR 141 has a draft). Not applied by the worker.
  Ledlenser's prompt list stays read-only.
- Map faces in `lib/ai-search/canvas-surfaces.ts`: "Unbranded SOV" becomes
  "Unbranded Discovery"; "Brand Consideration" becomes "Branded
  Consideration"; the radar bubble reads like "Yamaha leads Acoustics".
  Fix the "Flashlights · Fenix" sidebar overflow at 1280.
- Server CSV loaders for the AI Search tables that follow the date pill
  (X-10). `citation-evidence` needs the toolbar prop. Not on ResizableTable:
  RunCompletenessCard (2 tables), HistoryTrendsPanel, FactCheckEvidence,
  CatalogCoverageTable, HistoryPointDetail, LegacyRunInspect,
  SimulationEvidenceDrawer.
- Normalize invisible characters in model names for display (Gemini).
- Weights 700+: citation-chain.css, citation-glance.css,
  citation-share-bars.css, engine-group.css, AiDriftPanel.tsx; system mono
  in prompts-editor.css. CitationPieDisc needs the chart tokens.
- Leaves open: A-02, A-04, A-06, A-07 HELD.
- Owns components/v3/live/ai-search/* and lib/ai-search/* except the 23.6
  files, and components/v3/prompts/*. Owns the shared AI reads.

## 23.5 AI Readiness (/dashboard?spoke=specs)

- Findability: move "Dealer bundle status comes from the retail read... That
  is a correlation, not a proven cause." into a tooltip. Last checked stays.
- Amazon Specs (D-05): name the required-spec list per category (Fender
  guitar list, Ledlenser lighting fields), both marked placeholder.
- A+ Matrix (R-03): unchecked shows as unchecked, never a fail. No A+
  dollar figure (D-06 OPEN).
- D-03: no renames; check the map's satellite names match the tabs.
- Defect: the Brand-Site Specs satellite reads "100.0% missing
  machine-readable specs" for both clients; verify against
  canvas_spec_readiness and fix or confirm with counts.
- Toolbar prop needed: `machine-readability-pages`, `aplus-matrix-listings`,
  `brand-site-page-found`. Weight 700+: page-found.css.
- Leaves open: D-02, D-09 BLOCKED (no weekly Findability recheck job,
  Brian Watson).
- Owns components/v3/live/findability/*, AiReadinessLead,
  AmazonSpecsLastChecked, AplusMatrixPanel, ListingContentTable,
  CatalogReadinessSpec, FenderSpec*, MachineReadability*, PageFound*,
  page-found.css, lib/findability/*, and lib/fender-canvas readiness,
  listing-content, machine-readability, page-found, spec files.

## 23.6 Competitive Radar (/dashboard?spoke=competitors)

- Leads unchanged (C-02, C-03, C-04). Verify Ledlenser's Engine Comparison
  ("0.0% Perplexity unbranded") and Competitor Wins ("64 of 73") against
  the ledlenser schema; no guitar wording for a lighting brand.
- Use "Yamaha leads Acoustics" wording inside panels to match the map.
- Weight 700+: category-battlecards.css. Tables follow the table rule.
- C-01 story pack is OPEN; do not build it until Brian decides.
- Owns CategoryBattle*, CategoryBattlecardsPanel, CategoryLeadPies,
  category-battlecards.css, CompetitorWins*, CompetitorsSpokeDescription,
  EngineComparison*, EngineUnbrandedGraph and engineUnbrandedGraph,
  WhyNotFender, and lib/ai-search category-on-track, competitors,
  competitor-wins-lead, why-not-fender.

## 23.7 Roadmap and Action Items (two pull requests, after the rules)

- Waits for Brian's answers on decision 21 (recommendation rules) in
  `docs/pm23-decisions.md`.
- Roadmap: one tab, "30-60-90 Days" (S-03), built per S-02 once the rules
  are set; owner sentence "IntoFocus's recommended plan for {brand}"
  (S-04). The bubble shows a live figure, not the fixed "90 Days / 3
  phases" in fender-static-nodes.ts and fender-metrics.ts. Its "Not
  available*" must not use the Champagne status color.
- Action Items: an explicit empty state when nothing needs action (N-04).
  The fix list (`action-items-fix-list.ts`) is not on ResizableTable and
  uses weight 700 or more; the Revenue Estimates method table lives in
  data/fender-v3-spec.json.
- Leaves open: N-07 HELD.
