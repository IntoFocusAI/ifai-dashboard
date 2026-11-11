# Worker briefs

Each remaining view is one worker and one pull request. Send a worker the
common rules, then its view section. Decisions are in
`docs/pm23-decisions.md`; the audit is `docs/auditor-brief.md`; the brand
book is `docs/brand/IntoFocus_AI_Brand_Book_V2.pdf`. FDD rows are in
`docs/fdd/<view>.md`; find a row with `grep -n '^\*\*R-09 ' docs/fdd/*.md`
and read from that line. Workers never change an FDD status line; they
propose status changes in the pull request body.

## Common rules (every worker)

- You are Worker N.M for the PM on the IntoFocus AI client dashboard,
  running on the model the PM named. AGENTS.md and CLAUDE.md are already
  loaded; do not reread them. Read only the FDD rows and files your view
  needs. Read the Next.js docs in node_modules only for an API you have not
  used in this repo. You build one view to its final intended form for
  launch. You report to the PM, not to Brian.
- One branch from the latest main, named `worker/N.M-<short-name>`, one
  pull request, base main. Push only to that branch. Title
  "Worker N.M: <View> final form (<row IDs>)". The body lists each change
  on its own line with its FDD id and the status it moves to if Brian
  approves, then the rows the view leaves open. Rebase on main often (Brian
  Watson merges Ledlenser work). Commit messages start "Worker N.M:".
- Run in your own git worktree so parallel workers do not share a checkout.
- Both clients: correct for Fender (/dashboard) and Ledlenser
  (/dashboard?client=ledlenser). Ledlenser has no API-engine views. The set-aside
  tables and views are shared in `public` and client-keyed (`fmic`, `ledlenser`), so
  set-asides work for both clients; handle the rest as the code already does.
- Build inside the existing view. No standalone routes or pages that
  nothing links to (a server route for CSV is fine).
- A feature whose data does not exist is BLOCKED, not built. Never deliver
  a screen or column that reads Not available* on every row.
- Never invent rules, figures, or causes. If the FDD and the decisions do
  not say, ask the PM in your report.
- Standing rules: the map shows the published run plus its matching API
  run, except the Competitive Radar bubble, which reads the Category
  Battlecards rows for the date-pill window (decision 40; do not change it); the shared date pill is the only period label; dollar figures stay
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

### Cost rules

- Read files by range (`grep -n`, `sed -n`), never `cat` a whole large
  file. Edit files; do not rewrite whole files.
- Check screenshots with a script (overflow, text present); look at an image
  only when the script cannot decide.
- Run `npm test`, builds, and e2e in the background and check back within 5
  minutes. Compare e2e results with the baseline on main the PM gives you;
  do not re-baseline main yourself.
- Before any wait longer than 5 minutes (a review, Brian, a long run), write
  your state into the pull request body and end. A fresh worker continues
  from it.

### Acceptance checklist (check every item before you hand back)

- Every tab at 1280x720 and 1920x1080, both clients: no sideways scroll, no
  clipped or overlapping text.
- "analyst estimate" on every dollar figure; the asterisk and its tooltip on
  every partial or stale figure (X-25); `StatusMark` on every status color.
- No new tooltips on the map bubbles; no on-screen qualifiers (they go in
  tooltips); no internal terms in client copy.
- `npm test` passes; e2e for your view passes, with no new failures against
  the main baseline; `npm run lint:brand` reports no issue in the files you own or touch
  (main has 73 issues elsewhere; do not fix files you do not own).
- Each row's FDD Acceptance text holds for both clients.

### Hand back

Pull request and preview URL
(https://deploy-preview-<PR>--ifai-dashboard.netlify.app/dashboard), then an
evidence table: one line per FDD row with what you see for Fender and for
Ledlenser, the test counts (unit and e2e, against the main baseline), the
proposed status change, and anything BLOCKED or a question. Attach
screenshots by path only. List the files changed.

## 24.2 Summary (/dashboard?spoke=hub: Briefing, Performance, Opportunity)

- Briefing: equal finding cards, each N of M with a percentage. Its AI
  figures use the map's population (decision 7), so the map and the
  Briefing match. Fender today: map 66.4%, Briefing 59.4%.
- Defect: Ledlenser Briefing reads unbranded discovery Not available* while
  the map shows 12.3%. It may share a cause with the 24.4 window defect.
- Performance (H-07): each score against target 70 ("41 vs target 70").
  AI Actuation stays Not included (SC-03 BLOCKED). H-07 stays REFINE.
- Opportunity: unchanged; estimates stay labeled; no formulas.
- "Splintered bundles" becomes "Splintered Listings" in
  `briefing-retail-lead.ts` (it also shows on the Roadmap card).
- Owns: Briefing*, ConsensusScores*, ConsensusScoreView,
  ConsensusComponentBars, FenderDivisionsTable (not on ResizableTable; add
  the table rule), and lib/fender-canvas briefing-*, consensus-*,
  division-*, analyst-estimates.

## 24.5 AI Readiness (/dashboard?spoke=specs)

- Findability: move "Dealer bundle status comes from the retail read... That
  is a correlation, not a proven cause." into a tooltip. Last checked stays.
- Amazon Specs (D-05): name the required-spec list per category (Fender
  guitar list, Ledlenser lighting fields), both marked placeholder.
- A+ Matrix (R-03): unchecked shows as unchecked, never a fail. No A+
  dollar figure (D-06 closed on the content shares, decisions 35 and 45).
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

## 24.6 Competitive Radar (/dashboard?spoke=competitors)

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

## 24.7 Roadmap and Action Items (two pull requests, after the rules)

- Decision 21 (recommendation rules) stands as written (decisions 35 and 44) in
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
