# Client parity gaps: the to-do list for rounds 2 and 3

Written by worker 28.16 (parity chunk C8, X-35, decisions 84 and 105). The parity test and the lint
start red on purpose. This file lists what they report today so round 2 and round 3 workers can pick
items up. Audit P-numbers are from `docs/client-parity-audit.md` (file:line there are on main `ea93e8e`;
the lint file:line below are current). Delete a line here when its fix lands and the check stops reporting it.

## How to run the checks

| Check | Command | Needs |
|---|---|---|
| Layout and foreign-content test | build with `NEXT_PUBLIC_TEST_CLIENT_FILES="$(node scripts/test-client-files.mjs)" npm run build`, run `E2E_AUTH_BYPASS=1 npx next start -p 3199`, then `E2E_BASE_URL=http://localhost:3199 npx playwright test --project=parity-compare --workers=2 --trace off` | about 7 minutes; reads production, so one suite at a time |
| Re-compare saved captures only | `npx playwright test --project=parity-compare --no-deps` | a finished collect run in `e2e-parity-out/` (set `PARITY_DIR` to move it) |
| Lint | `npm run lint:clients` (exit 1 on a finding), `node scripts/lint-client-branches.mjs --report` (always exit 0, for CI) | none |
| Unit tests for both | `npm test` (`scripts/client-parity.test.ts`) | none |

The run writes `e2e-parity-out/layout-gaps.json`, `layout-gaps-with-data.json` and `foreign-<client>.json`.
Neither check is in the unit-test workflow, and neither blocks a pull request yet. The fixture client
(`e2e/fixtures/clients/fishingrods.json`, "Northline Rods") is registered only in a build that sets
`NEXT_PUBLIC_TEST_CLIENT_FILES` (`lib/client/registry.ts`, `scripts/test-client-files.mjs`); a normal build does not contain it.
The test answers every read for the fixture's schema with an empty list, which is what a new client looks
like before its data is loaded.

## Counts (main `7ce2a29`, run of 17 Nov 2026)

| Check | Count | Notes |
|---|---|---|
| Layout differences, Fender and Ledlenser only | 23 | hub 11, Action Items 6, Catalog Health 2, AI Search 1, deck 3 |
| Layout differences, all three clients | 120 | the 23 plus 97 more where the fishing client differs: by bubble, AI Search 40, deck 34, Competitive Radar 19, Summary 12, Action Items 6, Catalog Health 4, minimal view 2, map 2, AI Readiness 1 |
| Foreign-content hits | 0 | no other client's brand, domain, product-type or vertical word on any screen, for all three clients. See "Foreign content" |
| Lint hits (`lint:clients`) | 19 in 14 files | by area below (C6, worker 28.21, removed the 11 Catalog Health and AI Readiness hits) |

Layout lines are written with the client's own brand, numbers and question categories normalized away
(decision 106: category columns and battlecard figures come from the client's questions, so they count by
kind, not by name). A deck slide counts its id, column headers and number of headings.

## Layout differences by bubble and tab

### Summary (hub): 11 between Fender and Ledlenser

| Tab | Difference | Where | Audit |
|---|---|---|---|
| Briefing, Performance, Opportunity | The description under the title reads "Overview of Fender's electric catalog health" for Fender and "Overview of <Brand>'s Amazon catalog health" for the others (3 tabs, 2 lines each). | `data/fender-v3-spec.json` hub.desc; `lib/fender-canvas/spoke-narrative.ts` 92-96 | P-01 |
| Briefing | "Portfolio at a glance" box exists for Fender only. | `data/fender-v3-spec.json` hub.tabTemplates[0]; `spoke-narrative.ts` 38-62, 98 | P-03 |
| Opportunity | Fender: "How we arrived at these estimates", "Enterprise estimate: main drivers" and the Phase 1 and enterprise table (STEP, PHASE 1 QUICK-WIN LIFT, FULL ENTERPRISE POTENTIAL). Others: a "Revenue Estimates" heading with two Not available* cards. One layout is needed (decision 105: "Analyst estimate not prepared yet for <Brand>"). | `data/fender-v3-spec.json` hub.tabTemplates[2]; `spoke-narrative.ts` 19-35, 98; `lib/fender-canvas/analyst-estimates.ts` 8-19 | P-04, P-05 |

### Action Items: 6

| Tab | Difference | Where | Audit |
|---|---|---|---|
| Urgent Interventions, Revenue Estimates | Description names the Phase 1 pilot and enterprise estimate for Fender, plain for others (2 tabs, 2 lines each). | `data/fender-v3-spec.json` suggestions.desc; `spoke-narrative.ts` 101-104 | P-34 |
| Revenue Estimates | Fender's "How we arrived at these estimates" heading and table (STEP, PHASE 1 QUICK-WIN LIFT, FULL ENTERPRISE POTENTIAL); others have none. | `data/fender-v3-spec.json` suggestions.tabTemplates[1]; `spoke-narrative.ts` 103 | P-35 |

### Catalog Health: 2

| Tab | Difference | Where | Audit |
|---|---|---|---|
| MAP Leakage | Fender's table has a Musician's Friend column that the others do not. Allowed as an additive retailer column (decision 89), so the test needs an allowance for a column named in the client's `retailers` setting; until then it reports. | `lib/fender-canvas/map-channels.ts` 41, 149-180, 318; `components/v3/live/MapListingsTable.tsx` 109, 215; `lib/client/column-aliases.ts` 34-41 | P-12 |

### AI Search: 1

| Tab | Difference | Where | Audit |
|---|---|---|---|
| Product Fact Checks | "Answers that contradict a <Brand> fact" heading appears only for Fender. It follows the data (Fender has contradictions, Ledlenser has none), so decide whether the section should always draw and read Not available* or "None found". | `components/v3/live/ai-search/` Product Fact Checks panel | not in audit |

### Deck: 3

| Slide | Difference | Audit |
|---|---|---|
| b5 | The backstage slide "The AI answers that contradicted a <Brand> fact" (and its columns Question, Engine, <Brand> publishes, The answer said) exists for Fender only. Same cause as the Product Fact Checks row. | not in audit |

The deck has no client branch in code (P-38); the estimate rows and the Phase 1 line are dropped for a client
with no estimate, so its slides and backstage table are shorter. That clears with C3.

### Competitive Radar, AI Readiness, Roadmap, minimal view

No difference between Fender and Ledlenser once categories count by kind. The Beginner figure (P-07) is
handled by decision 106 and does not show as a layout difference.

## What the fishing client (no data) adds: 97 more differences

With every read answering an empty list, the third client should draw the same layout with Not available*.
It does not. Fix these with the empty-state rules in C3 and C4 (one layout, Not available* in place of a
missing figure), not by adding a special case for the fixture.

| Bubble and tab | Kind | What differs |
|---|---|---|
| Map | 2 | Summary bubble shows the brand name as text (no logo set), the others show the logo image. Expected until a logo is added; the test should treat a null `logo_src` as allowed. |
| AI Search, Run Summary, Run Details, Product Fact Checks, Citation Ecosystem | 39: 22 headings and 9 column sets lacking, 8 empty-state headings extra | The panel draws "No published AI run" and "No AI run has been published yet, so no AI Search figure is shown" instead of the headings and tables (By category, By engine, Top cited sites, Cited links, Run details). X-35 and decision 105: same layout, Not available*. |
| Competitive Radar, all 3 tabs | 19 | Same: "No published AI run" replaces Category Battlecards, Competitor Wins and Engine Comparison headings and columns. |
| Catalog Health | 2 | MAP Leakage has no Amazon or Walmart column (the data sources are off in settings); Suppressed Listings has no table. |
| AI Readiness | 1 | Amazon Specs lacks "Top missing Amazon fields". |
| Summary | 1 | The Performance tab lacks one heading the other two show. |
| Minimal view | 2 | The metric picker lacks the battlecard figures and "Stock loss, 12 months" (no data for them). |
| Deck | 31 | The deck does not open for a client with no data (`[data-deck-open]` click leaves no deck), so every slide is missing. It should open and show Not available*. |

Also seen on the fishing client (not counted): "Northline Rods's own seller accounts" (a possessive of a name
that ends in s), and the screen reads "Could not load live canvas data ... Invalid schema: fishingrods" when
the views do not exist at all (no `fishingrods` schema). The test avoids that case by answering empty lists;
Watson's per-client views remove it for real clients.

## Foreign content: 0 hits

The scan looks for the other clients' brand names, owned domains, competitor names and domains, product line
terms, Amazon product types, and a short vertical-word list (guitar, Stratocaster, flashlight, headlamp,
lumens, lantern, fishing rod, angler and similar), and it skips the client's own words. A client's own data
may use its own vertical words (a Fender catalog row names a Stratocaster; a Ledlenser row says Headlamp), so
vertical words are keyed by the `vertical` setting. Names that are also ordinary words (Coast, Boss, Spark,
Martin, Taylor) count only when capitalized.

Today no screen shows another client's wording, because the fishing client has no data and the code
that would leak (the music lists for Fender and the lighting lists for every other client) only runs when
data is present. Those leaks are in the lint list below. The scan will start reporting them when a third
client has data.

## Lint hits: 19 in 14 files (`npm run lint:clients`)

Each is code that branches on the client name. Move the difference into `data/clients/<key>.json` and read it
through `lib/client`.

| Area | file:line | Audit |
|---|---|---|
| Summary | `lib/fender-canvas/analyst-estimates.ts:9`, `lib/fender-canvas/spoke-narrative.ts:74` | P-05, P-02 |
| AI Search | `lib/brand-copy.ts:7` (the `isFenderClient` helper); `lib/ai-search/citations.ts:113`, `:123`, `:230`; `lib/ai-search/citation-insights.ts:359`, `:360`; `lib/ai-search/definitions.ts:10`, `:12`, `:30`; `lib/ai-search/why-not-fender.ts:17`; `lib/ai-search/probe-catalog.ts:220`; `components/v3/live/ai-search/CitationEcosystemPanel.tsx:60` | P-18 to P-22, P-25 |
| Competitive Radar | `components/v3/live/ai-search/CategoryBattlecardsPanel.tsx:213`; `lib/ai-search/category-on-track.ts:244`; `lib/ai-search/radar-tables.ts:227` (the lead filter value is the string "fender"; rename it to the lead brand) | P-32, P-07 |
| Exports | `lib/export/tables.ts:66` | P-40 |
| Data layer | `lib/supabase/canvas-client.ts:41` (column naming "fender") | P-42 |

The audit's P-23 and P-24 (question roles and lists typed into code), P-26 and
P-27 (history filter and fast read) do not compare a client to a literal, so the lint does not see them. Round
3 chunk C4 removes them with the question data move.

## Notes for the next workers

- The check is structure only. If a round 2 fix changes a heading for every client at once, nothing reports.
- Allowances the checks still need: a retailer column named in `retailers` (MAP Leakage), a null `logo_src`,
  and sections that follow the data (Product Fact Checks contradictions). Add them as settings-driven rules,
  not as client names in the test.
- `lib/client/settings-schema.ts` no longer has `spotlight_category` (decision 106 replaced it with categories
  from each client's loaded questions). `roadmap_focus_category` stays: `lib/client/active-client.ts` reads it.
