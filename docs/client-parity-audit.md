# Client parity audit: Fender and Ledlenser, and what 10 clients take

Worker 28.8 for PM28, 17 Nov 2026. Read-only audit of main at `ea93e8e`. Goal from Brian
(decision 105): about 10 new client dashboards within a month, each with the same views as every
other client. Related rules: decision 89 (one dashboard for every client; only additive
differences), decision 84 (X-16 acceptance: an automated test that no client sees another's data),
decision 46 (X-15 and X-16 held until the rest of the launch build is done).

## Summary for Brian

**What differs today.** 42 places where Fender's and Ledlenser's dashboards differ. They come
from four causes:

| Cause | Count | What it means |
|---|---|---|
| (a) Hand-written client content | 11 | Fender has text and figures someone typed in: the Briefing's selling-model list (Austin Bazaar, GearTree), the "Portfolio at a glance" box, the Opportunity and Revenue Estimates breakdown ($680K, $38M to $62M), the question lists copied into code. Ledlenser gets a shorter fallback, and some tabs have a different layout. |
| (b) Code that checks which client it is | 17 | About 25 checks of the form "if Fender, do this, otherwise do that", spread over about 20 files. "Otherwise" always means "do what suits Ledlenser" (flashlight field lists, lighting websites, Brand-led wording). |
| (c) Data one client has and the other does not | 10 | Each client's data sits in its own database area with different names. Fender has Musician's Friend prices, analyst estimates and a faster history read. Ledlenser has a settings record and a product sheet that Fender does not. |
| (d) Different on purpose | 4 | Seller type (Fender Partner-led, Ledlenser Brand-led) and what follows from it: the Authorized sellers control, the Controlled Buy Box rule, the editable question list (Fender only, A-08). These were decided by Brian (R-02, R-18, SC-02, A-08). |

**What a third client takes today.** About 8 to 12 working days per client, most of it on
Watson's side: copying a 2,100-line database setup for the new client, setting up about 10 data
collectors, loading the catalog and the question list. On the dashboard side it takes code changes
in about 10 files. The new client would also be shown wrong things: Ledlenser's flashlight field
lists and lighting websites, and "Brand-led" wording even when the brand is Partner-led. Ten
clients done this way would be ten one-off builds.

**The plan.** One shared template. Every client difference comes from two places only: (i) a
**client settings record** (name, brand words, websites, seller type, product types,
competitors, retailers, which data sources are on, analyst figures) and (ii) the client's own
data. Where a client's data is missing, the screen keeps the same layout and shows Not available\*.
That takes **9 dashboard pull requests, about $325 in total**, run 3 at a time over 3 rounds (about
1 to 1.5 weeks with reviews), plus Watson's data work. After that, adding a client is a settings
file, a logo, and Watson's data setup, with no dashboard code.

**Top 5 blockers to 10 clients**
1. **Data setup per client is a hand copy** (Watson): a 2,100-line database setup and about 10
   collectors per client, with no template. The choice between "one database area per client"
   and "shared tables with a client column" is not made, and logins and data separation (X-15,
   X-16) are on hold under decision 46.
2. **Every client that is not Fender is treated as Ledlenser.** Lighting websites, flashlight
   spec fields, and Brand-led Briefing wording would all be wrong for client #3.
3. **Summary and Action Items layouts differ** because Fender's Briefing, Opportunity and Revenue
   Estimates are hand-written.
4. **The question lists and question roles are copied into code by hand.** Fender's roles use a
   guitar-brand word list, so a new client's "Unbranded discovery" headline would be miscounted.
5. **No client settings record and no parity test.** The client list is fixed in code. Login does
   not pick the client; a `?client=` link does. Nothing checks that every client has the same views
   (the decision 84 test is not built).

**Decisions needed from Brian** (details in section 5)
1. Where client settings live: a reviewed file in the repo now (recommended) or a database table now.
2. Lift the decision 46 hold on X-15 and X-16. Ten real clients within a month need logins and
   data separation first. X-16 itself says "before the first real client".
3. Summary Briefing: generated from settings and data for every client (recommended), or a
   hand-written note per client kept as an allowed additive.
4. "Beginner" figures: replace with a per-client spotlight category, or drop them.
5. Analyst estimates for new clients: same Opportunity layout with Not available\* until an
   analyst enters figures in settings (recommended).
6. Seller types beyond Partner-led and Brand-led: build now, or when a client needs one.
7. Database layout with Watson: one area per client (today's Ledlenser pattern), or shared
   tables with a client column.

---

## 1. Difference inventory

Line ranges are on main `ea93e8e`. "Fender" and "Ledlenser" columns say what each client sees.
How each (a) and (b) item converts is in section 3.

### 1.1 Summary (hub)

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-01 | Summary description: "Overview of Fender's electric catalog health" (hand-written) vs "Overview of Ledlenser's Amazon catalog health" (code). | `data/fender-v3-spec.json` hub.desc; `lib/fender-canvas/spoke-narrative.ts` 92-96 | (a) |
| P-02 | Briefing callout. Fender: hand-written "commercial selling model" list (1P Vendor Central, Austin Bazaar and GearTree, bundle nesting under the Fender parent ASIN). Ledlenser: one generic Brand-led bullet. Any client that is not Fender gets the Brand-led text, even a Partner-led one. | `data/fender-v3-spec.json` hub.tabTemplates[0] (lines 14-20); `lib/fender-canvas/spoke-narrative.ts` 38-62, 98; `components/v3/build-live-spokes.tsx` 51, 56-61 | (a) |
| P-03 | "Portfolio at a glance" box (main still says "Master Portfolio Quick-Look"; PR 208 renames it) with Buy Box card and Enterprise Potential: Fender only. Ledlenser has no box. Different layout. | same Fender template | (a) |
| P-04 | Opportunity tab. Fender: "How we arrived at these estimates" table, 4 + 4 analyst lines, FMIC brand list (Fender, Squier, Jackson, EVH, Gretsch), "$1B+ enterprise" text. Ledlenser: two cards reading Not available\*. Different layout. | `data/fender-v3-spec.json` hub.tabTemplates[2]; `spoke-narrative.ts` 19-35, 98 | (a) |
| P-05 | Analyst figures +$680K and +$38M to $62M are typed into code for Fender; every other client gets Not available\*. Feeds Summary, Action Items, tour, metric picker and deck. | `lib/fender-canvas/analyst-estimates.ts` 8-19; `lib/fender-canvas/template-vars.ts` 93-94 | (a) |
| P-06 | Performance tab, AI Commerce: Controlled Buy Box counts Amazon Retail and named partners (Partner-led) or the brand's seller accounts (Brand-led). Placeholder marking only for Partner-led. | `lib/fender-canvas/consensus-scores.ts` 290-300, 560-577 | (d) SC-02 |
| P-07 | "Beginner AI win rate" and "Beginner share-of-voice gap" are tied to the category key `beginner`, which only Fender's question list has. Ledlenser always gets "No beginner prompts" or a missing figure. | `lib/ai-search/canvas-surfaces.ts` 527-580; `lib/fender-canvas/minimal-metrics-other.ts` 148-170; `lib/fender-canvas/metrics-from-live.ts` 164, 186, 266-271, 319-325; `lib/fender-canvas/template-vars.ts` 30, 77-79; `lib/fender-canvas/beginner-sov.ts` 4-20 (also hard-codes "Yamaha"); `components/v3/fender-metrics.ts` 90, 150 | (b) |
| P-08 | Summary logo and wordmark: `/image.png` vs `/ledlenser-logo-white.png`. Already a profile field. | `lib/client/active-client.ts` 47, 60 | settings (no change) |

### 1.2 Catalog Health

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-09 | Seller type label: Partner-led vs Brand-led. | `components/v3/live/RetailOverview.tsx` 22-34 | (d) R-02 |
| P-10 | Authorized sellers control: Partner-led only. | `RetailOverview.tsx` 35-37; `lib/fender-canvas/authorized-sellers.ts` 8-21 | (d) R-18 |
| P-11 | Default partner list "Austin Bazaar", "GearTree": in the profile and again as a constant. | `active-client.ts` 52; `consensus-scores.ts` 56 | (a) (R-18 says the list waits for the first real Partner-led client) |
| P-12 | MAP Leakage: Musician's Friend column, channel, freshness row and CSV column appear for Fender only. Ledlenser's table has no `mf_*` columns, so the aliasing layer drops them. | `lib/fender-canvas/map-channels.ts` 41, 149-180, 318; `components/v3/live/MapListingsTable.tsx` 109, 215; `lib/export/map-export.ts` 114, 134; `lib/fender-canvas/map-reading-status.ts` 8, 89-116; `lib/fender-canvas/data-source-freshness.ts` 88-93; `lib/client/column-aliases.ts` 34-41; `components/v3/build-live-spokes.tsx` 70-74 | (c) (allowed additive retailer, decision 89; R-10) |
| P-13 | MAP "why" sentences name Amazon, Walmart and Musician's Friend for Fender and "retail prices" for others. Set when the file loads, not per request. | `lib/fender-canvas/command-center-from-live.ts` 19-25 | (b) |
| P-14 | Walmart recheck interval: 1 day for Fender, 2 for Ledlenser, picked by client key in three places. | `lib/fender-canvas/row-stale.ts` 14-25; `data-source-freshness.ts` 84; `map-reading-status.ts` 89; `lib/fender-canvas/portfolio-retail.ts` 752 | (b) |
| P-15 | Out of Stock tooltip: "Fender sells through dealers..." vs a neutral sentence. Keys on "is Fender", where it should key on seller type. | `components/v3/live/StockLossHero.tsx` 33-35 | (b) |
| P-16 | Catalog Governance bundle line labels shortened for guitar categories only ("Electric Guitar Kits" to "Kits"). | `portfolio-retail.ts` 453-459 | (b) minor |
| P-17 | Ledlenser's metrics row stores `bb_brand` and `bb_brand_pct` (brand-held Buy Boxes). The dashboard does not read them. | `supabase/migrations/20261104170000_ledlenser_schema.sql` 35, 1381-1384 | (c) unused |

### 1.3 AI Search

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-18 | Lead brand words: "Fender/Squier" and "Fender or Squier" vs the brand name. Answer brand matching uses `fender|squier` vs the brand name only (misses "LED Lenser", which Ledlenser's settings record lists). | `lib/brand-copy.ts` 5-17; `lib/ai-search/why-not-fender.ts` 16-20; `lib/ai-search/run-metrics.ts` 13 | (b) |
| P-19 | Glossary and copy name FMIC: "Fender or another FMIC brand", "names Fender, Squier,", "such as Stratocaster". | `lib/ai-search/definitions.ts` 10-12, 30; `components/v3/live/ai-search/CitationEcosystemPanel.tsx` 60 | (b) |
| P-20 | Brand-owned domains: FMIC list of 7 sites for Fender vs profile domains plus a regional-site rule for others. | `lib/ai-search/citations.ts` 108-125 | (b) |
| P-21 | Source class fallback lists (retailer, editorial, community, video, reference, competitor): music retail lists for Fender, lighting lists for every other client. Stored site types (`canvas_site_types`) answer first. | `citations.ts` 128-230 | (b) |
| P-22 | Competitor brand-site names: guitar brands for Fender, lighting brands for every other client. Ledlenser's database settings already hold a competitor set with domains, unread. | `lib/ai-search/citation-insights.ts` 337-362; `citations.ts` 158-192 | (b) |
| P-23 | Question roles. Fender: text rules with a guitar-brand word list. Ledlenser: roles typed into code from `ledlenser.ai_prompts.analytical_intent`, because the views do not return that column. | `lib/ai-search/question-role.ts` 46-77; `lib/ai-search/stored-question-roles.ts` 1-61 | (b), also (a) and (c) |
| P-24 | Question lists copied into code for gap checks: 60-odd Fender questions, 32 Ledlenser questions. | `lib/ai-search/prompt-battery.ts` 25-150 | (a) |
| P-25 | Product fact check tooltip states Fender's rotation rule ("180 in-scope guitar and bass models"); other clients get a shorter sentence. | `lib/ai-search/probe-catalog.ts` 201-225 | (a) |
| P-26 | History run filter pins collector `v11` for Fender only. | `lib/ai-search/history-eligibility.ts` 11-20 | (c) |
| P-27 | Fast history read `canvas_ai_history_run_rows` exists for Fender only (header says not yet applied on main; PR 213 updates headers). Ledlenser uses the slower page reads. | `supabase/migrations/20261112230000_ai_history_run_rows.sql` 25-26 | (c) |
| P-28 | Prompts screen and Battery builder: editable for Fender, view-only for Ledlenser. Builder presets are guitar-only. | `lib/prompts/prompt-list.ts` 54-64; `components/v3/battery-builder/BatteryBuilder.tsx` 188; `lib/battery-builder/presets.ts` 80-150 | (d) A-08; presets (a) |

### 1.4 AI Readiness

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-29 | Required spec fields and their tooltip: 13 guitar fields for Fender, 13 lighting fields for every other client. PR 212 (D-05) moves to lists per Amazon product type. | `lib/fender-canvas/consensus-scores.ts` 20-90 | (b) |
| P-30 | Schema.org tooltip: "neck, pickup, and hardware specs" vs "detailed product specs". | `components/v3/live/FenderSpecNarratives.tsx` 6 | (b) minor |
| P-31 | Findability groups listings by "on the brand's product sheet" for Ledlenser only (Plytix sheet in `ledlenser.brand_catalog`). | `lib/findability/queries.ts` 101-104; `lib/findability/outcomes.ts` 49-64 | (c) (additive, decision 89) |

### 1.5 Competitive Radar

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-32 | Battlecards explanation adds "Squier counts with Fender... against Yamaha and Ibanez" for Fender only. | `components/v3/live/ai-search/CategoryBattlecardsPanel.tsx` 211-215 | (b) |
| P-33 | Category share-of-voice labels come from each client's view: "Fender/Squier" vs "Ledlenser"; the competitor set is fixed in each view. | `public.canvas_competitor_sov`, `ledlenser.canvas_competitor_sov` (migration 20261104170000 header line 34) | (c) |

### 1.6 Action Items and Roadmap

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-34 | Action Items description names the two estimates for Fender; plain for others. | `data/fender-v3-spec.json` suggestions.desc; `spoke-narrative.ts` 101-104 | (a) |
| P-35 | Revenue Estimates tab: Fender's breakdown table (same as P-04) vs two Not available\* cards. Different layout. | `data/fender-v3-spec.json` suggestions.tabTemplates[1]; `spoke-narrative.ts` 103 | (a) (same source as P-04) |
| P-36 | Roadmap and Action Items focus category: a profile field (both null). | `active-client.ts` 37, 53, 66 | settings (no change) |

### 1.7 Minimal view, deck, tour, CSVs

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-37 | Minimal view: the Beginner gap figure (P-07) is always missing for Ledlenser. The rest of the minimal view has no client branch. | `minimal-metrics-other.ts` 148-170 | (b) (same cause as P-07) |
| P-38 | Deck: no client branch in code. The estimate rows and the Phase 1 line on the fixes slide are dropped for Ledlenser (no estimate), so its backstage table is shorter. | `components/v3/live/deck/useDeckModel.ts` 31-33, 64-65; `lib/deck/deck-model.ts` 92-125 | (c) |
| P-39 | Tour: the live tour is brand-neutral. The fallback tour shown before data loads is Fender's text for every client. | `data/fender-v3-tour.json`; `lib/fender-canvas/build-canvas-spec.tsx` 12, 40, 175 | (a) minor |
| P-40 | CSVs: MAP export adds the Musician's Friend column for Fender (P-12). Export links carry `?client=` for non-Fender clients. Otherwise identical. | `lib/export/map-export.ts` 114, 134; `lib/export/tables.ts` 64-67 | (c) |

### 1.8 Across the dashboard

| # | What differs | Files and lines | Class |
|---|---|---|---|
| P-41 | Client list is a closed code list: `ClientKey = "fender" \| "ledlenser"`, schema `"public" \| "ledlenser"`. Picked by `?client=`; no parameter means Fender. Login does not pick the client; the guest cookie is `ifai_guest_fender`. | `lib/client/active-client.ts` 10-104; `lib/auth/guest-dashboard.constants.ts` 5-8 | (b) (X-15, X-16) |
| P-42 | Data layout: Fender reads `public.canvas_*` over `command.fmic_*` tables (no client key; Fender names such as `fender_win`). Ledlenser reads `ledlenser.canvas_*` (neutral names such as `brand_win`). An aliasing layer renames Ledlenser columns back to Fender names. | `lib/supabase/canvas-client.ts` 33-48; `lib/client/column-aliases.ts` 1-122; migration 20261104170000 header 1-45 | (c) (decided with Watson, 4 Nov 2026) |
| P-43 | Settings record: `ledlenser.client_config` (seller type, brand words, Amazon brand names, brand seller ids, competitor set) exists with a `canvas_client_config` view. The dashboard never reads it. Fender has no settings record in the database; its settings live only in code. | migration 20261104170000 63-104, 1097-1100 | (c) |
| P-44 | Settings read when a file loads, not per page load or request: `HUB_BRIEFING_HTML` and `MAP_CHANNEL_WHY`. Works in the browser today, but would show Fender's copy in a server export for another client. | `components/v3/build-live-spokes.tsx` 51; `command-center-from-live.ts` 19 | (b) |
| (extra) | Page description "Fender brand intelligence canvas" for every client. | `app/(canvas)/layout.tsx` 5 | counted with P-39 |

**Counts (one primary class per row, 42 differences):** (a) 11: P-01 to P-05, P-11, P-24,
P-25, P-34, P-35, P-39. (b) 17: P-07, P-13 to P-16, P-18 to P-23, P-29, P-30, P-32, P-37, P-41,
P-44. (c) 10: P-12, P-17, P-26, P-27, P-31, P-33, P-38, P-40, P-42, P-43. (d) 4: P-06, P-09,
P-10, P-28. P-08 and P-36 are already settings and need no change. P-23 is also partly (a) and
(c) (roles typed into code because the views lack the column); P-28's guitar presets are partly
(a).

Not counted: internal code names with "fender" in them (`fenderWins`, `FenderListingsTable`,
`lib/fender-canvas/`). They show nowhere on screen. Rename later or never.
`components/intofocus-portal/*` (sample guitar copy) is imported by no route.

### 1.9 How open pull requests change this

- **PR 208** (status marks, renames; draft): rewrites the Fender Briefing headline to "What is
  changing what AI assistants recommend for Fender?" (the same question Ledlenser already gets)
  and renames "Master Portfolio Quick-Look" to "Portfolio at a glance" and "Enterprise GMV Growth
  Drivers" to "Enterprise estimate: main drivers". It touches about 60 files that the build plan
  also touches (`definitions.ts`, `question-role.ts`, `category-on-track.ts`, `canvas-surfaces.ts`,
  `metrics-from-live.ts`, `portfolio-retail.ts`, `data/fender-v3-spec.json`,
  `CategoryBattlecardsPanel.tsx`). **Every build chunk starts after 208 merges.** P-02 to P-04
  stay different after 208.
- **PR 212** (D-05 field lists, decision 100): lists per Amazon product type shared by every
  client (GUITARS, FLASHLIGHT). That is the target design for P-29. 6 ELECTRIC_LIGHT and 5
  ELECTRIC_LANTERN Ledlenser listings have no approved list. Chunk C6 waits for 212.
- **PR 213** (test cleanup, applied-migration headers): no change to findings. It records which
  migrations, including `ledlenser_canvas_ai_prompts`, are applied.
- **PR 211** (actuation reminders): no change to findings.

## 2. New-client checklist today (client #3)

Owner W = Watson (data), D = dashboard code, S = IntoFocus staff. Effort is working time for one
person or worker, today, without a template.

| Step | What | Owner | Effort |
|---|---|---|---|
| 1 | Decide database layout for the client. Today's pattern: own schema `<client>` and `<client>_private`. | W, Brian | decision |
| 2 | Copy `20261104170000_ledlenser_schema.sql` (1,532 lines: 27 tables with history triggers, 27 `canvas_*` views, `client_config` row, set-aside client row, organization row, hourly stock-loss cron) and rename. | W | 1 to 2 days |
| 3 | Copy the follow-on migrations: prompt list (`20261104170100`), brand seller (`20261104173005`), brand catalog (`20261104180000`, `20261104180100`), spec views (`20261104223000`), AI API views (`20261111222737`), prompt view (`20261116230000`), product-type view (as in `20261111230000`), select-only grants (pattern `20261104215427`). | W | 0.5 to 1 day |
| 4 | Add the schema to Supabase "Exposed schemas" (owner setting). | W | minutes |
| 5 | Load catalog (ASIN list), brand product sheet, MAP prices, brand seller ids, competitor set. | W, S | 0.5 to 1 day |
| 6 | Write the question list (about 30 questions) with roles, and the fact-check plan. | S, W | 1 day |
| 7 | Set up collectors for the client: Keepa history, Buy Box and offers, catalog harvester, SmartScout snapshot, Walmart MAP audit, any other retailer, Amazon specs, Findability, listing content (A+), AI Search runner (3 engines), API engines, fact checks; each writes its `job_state` freshness row. | W | 2 to 4 days |
| 8 | Score snapshot writer and actuation records include the client (shared tables, client-keyed). Site types: classify new cited domains (shared `canvas_site_types`). | W, S | 0.5 day |
| 9 | Add the client to `ClientKey`, `CLIENTS` and the schema type in `lib/client/active-client.ts`; add the logo to `public/`. | D | 0.5 hour |
| 10 | Copy the question list into `lib/ai-search/prompt-battery.ts`; copy roles into `stored-question-roles.ts`. | D | 1 to 2 hours |
| 11 | Every "is Fender" branch (P-07, P-13 to P-22, P-29, P-30, P-32): the new client gets Ledlenser's lighting choices. For a client outside lighting, add a third set of lists in about 8 files. | D | 1 to 2 days |
| 12 | Briefing (P-02): the new client gets Brand-led text whatever its seller type. A Partner-led, Amazon Retail only, Hybrid or no-presence client needs new code (`sellerModel` allows only two values). | D | 0.5 to 2 days |
| 13 | Column names: the aliasing layer works only if the new views use Ledlenser's neutral names. | W, D | check |
| 14 | Check every tab at both sizes for the new client; add the client to e2e. | D | 0.5 day |

**Total: about 6 to 9 days of Watson's time and 2 to 4 days of dashboard time per client.**
Ten clients this way is 60 to 90 Watson days, which does not fit in a month.

## 3. Target design

### 3.1 One template, two inputs

Every client sees the same bubbles, tabs, sections and table columns. A client differs only by:

1. **Its settings record** (below).
2. **Its data.** A figure whose data is missing shows the same card or column with Not available\*
   and a tooltip saying what is missing. Never a different layout, never a dropped section. The
   only exception is an additive one that settings switch on, such as an extra retailer column
   (decision 89).

The worker-brief rule "never deliver a screen that reads Not available\* on every row" still
holds for new features. For a client that lacks a data source, the layout stays, and the source
shows as not enabled in the data-source freshness list.

### 3.2 Proposed client settings record

One record per client. The field names follow `ledlenser.client_config` so Watson's table and the
dashboard file can be the same shape.

| Field | Example (Fender) | Replaces |
|---|---|---|
| `client_key` | `fender` | `ClientKey` union |
| `set_aside_key` | `fmic` | profile field |
| `display_name`, `legal_name` | Fender, Fender Musical Instruments Corporation | profile, P-01 |
| `data_schema` | `public` | profile `schema` |
| `column_naming` | `fender` or `neutral` | aliasing switch (P-42) |
| `logo_src` | `/image.png` | profile |
| `lead_brand_label`, `lead_brand_phrase` | Fender/Squier, Fender or Squier | `leadBrand`, `leadBrandOr` (P-18) |
| `brand_name_terms` | fender, squier | answer matching (P-18), question roles (P-23) |
| `portfolio_brands` | Fender, Squier, Jackson, EVH, Gretsch | P-04, P-19, P-32 |
| `owned_domains`, `brand_site_label`, `regional_site_rule` | 7 FMIC domains, fender.com, off | P-20 |
| `seller_type` | `partner_led` (5 values from `docs/client-seller-models.md`) | `sellerModel` (P-06, P-09, P-10, P-15, P-02) |
| `brand_seller_ids` | [] | Brand-led controlled rule |
| `default_authorized_partners` | Austin Bazaar, GearTree (placeholder) | P-11 |
| `amazon_brand_names` | Fender, Squier | catalog checks |
| `product_types` | GUITARS, ... | spec field lists via D-05 (P-29, P-30) |
| `vertical` | `music_instruments` | picks the shared reference lists (P-21) |
| `competitors` | [{name, terms, domains}] | P-22, P-23, P-33, P-07 rival |
| `retailers` | [{key: walmart, name, recheck_days: 1}, {key: musicians-friend, ...}] | P-12 to P-14 (R-10) |
| `data_sources` | {keepa, offers, smartscout, walmart, musicians_friend, specs, findability, listing_content, brand_sheet, ai_battery, ai_api, fact_checks, brand_reported_sales} on or off | freshness list, P-31, P-17 |
| `collector_version_pin` | v11 | P-26 |
| `prompts_editable` | true | A-08 (P-28) |
| `spotlight_category` | beginner (or null) | P-07, P-37 (Brian decision 4) |
| `roadmap_focus_category` | null | profile |
| `analyst_estimates` | {phase_one, enterprise, lines: [{label, value}]} or null | P-04, P-05, P-34, P-35, P-38 |
| `catalog_rotation_rule` | the sentence | P-25 |
| `category_short_labels` | {"Electric Guitar Kits": "Kits"} | P-16 |

Shared, not per client: reference domain lists per `vertical` (`data/reference/<vertical>.json`),
Amazon field lists per product type (`lib/findability/amazon-field-lists.ts`, PR 212), stored site
types (`canvas_site_types`).

### 3.3 How each (a) and (b) item converts

| Items | Becomes |
|---|---|
| P-01 to P-04, P-34, P-35 | One narrative template for all clients. Briefing sentences built from `seller_type`, `default_authorized_partners` and stored data (seller names on listings, bundle counts). "Portfolio at a glance" and the Opportunity table shown for every client; estimate cells and lines from `analyst_estimates`, else Not available\*. `data/fender-v3-spec.json` becomes a brand-free template. |
| P-05 | `analyst_estimates` in settings. Formulas stay parked. |
| P-07, P-37 | `spotlight_category` from settings; the figure reads Not available\* when null or absent. Rival read from data, not "Yamaha". |
| P-11 | `default_authorized_partners`; delete the duplicate constant. |
| P-13, P-14, P-12 | Retailer list and recheck days from `retailers`; copy names the retailers that have stored prices. MF stays an additive column switched on by settings until R-10 rows land. |
| P-15 | Key on `seller_type`, not on Fender. |
| P-16 | `category_short_labels`, else the stored label. |
| P-18 to P-20 | `lead_brand_*`, `brand_name_terms`, `owned_domains`. |
| P-21, P-22 | `vertical` reference lists plus `competitors[].domains`. |
| P-23, P-24 | Read the question list and each question's role from the database (`canvas_ai_prompts` with `analytical_intent`, both clients). Text rules use `brand_name_terms` and competitor terms instead of the guitar word list. Code copies deleted. Needs Watson (W2). |
| P-25 | `catalog_rotation_rule`. |
| P-29, P-30 | Field lists per Amazon product type (PR 212); tooltip names the product type. |
| P-32 | Sentence built from `portfolio_brands`, shown only when there is more than one. |
| P-39 | Fallback tour and page description use `display_name`. |
| P-41 | Client list read from the settings files; after X-15, the signed-in organization picks the client and `?client=` stays for staff only. |
| P-44 | Read settings per call, never when a file loads. |
| Guard | A lint check fails the build on any client-key comparison or brand name outside `lib/client/` and the settings files. |

### 3.4 Watson dependencies

- **W1 Settings in the database (optional at first).** A shared `public.client_settings` table (or
  a Fender `client_config` row) with the same shape. Additive. Until then the repo file is the
  source, and the Ledlenser row is checked against it.
- **W2 Question roles in the views.** Return `analytical_intent` in `canvas_ai_prompts` and the
  simulation views for both clients, and store roles for Fender's list. Additive.
- **W3 Database layout and separation (X-16, X-15).** Choose one area per client or shared tables
  with a client column and row rules. Either works for the dashboard, which reads
  `data_schema`. Fender's `command.fmic_*` tables carry no client key; moving Fender to neutral
  names removes the aliasing layer. This is the largest item and is on hold under decision 46.
- **W4 Collector template.** One set of collector jobs taking a client key, instead of one copy
  per client.
- **W5 R-10 retailer rows** (plan in `docs/r10-retailer-rows-plan.md`), so retailers come from
  settings instead of `wmt_*` and `mf_*` columns.
- **W6 Logins (X-15)** with organization-to-client mapping. `command.organizations` already has
  `fender` and `ledlenser` rows.

FDD rows: X-15 TARGET ("Unsigned access disabled for external client tenants"), X-16 TARGET ("No
cross-tenant rows in browser-selectable views... An automated test loads each client and checks
that no other client's domains, ASINs or prompts appear", decision 84; held by decision 46), X-26
CURRENT (header and version label, the same for every client, no change needed). The TDD section 4
"Client / tenant configuration" already lists seller model, authorized sellers, retailer list,
prompt set, engines, staff assignment and actuation programs as client settings; the record above
fits that section.

## 4. Build plan

Start after PR 208 merges. Up to 3 workers at a time; files owned per chunk do not overlap within a
round. Costs are API-equivalent estimates at the $40-per-view pace.

| Round | Chunk | What | Files owned | Model | Cost | Needs |
|---|---|---|---|---|---|---|
| 1 | C1 Settings record | Settings type with validation; `data/clients/fender.json`, `data/clients/ledlenser.json`; `active-client.ts` loads them; `ClientKey` becomes a validated string; per-call reads. | `lib/client/*`, `data/clients/*`, `lib/supabase/canvas-client.ts`, `lib/brand-copy.ts` | Opus 5.5 | $40 | Decision 1 |
| 1 | C8 Parity test and guard | e2e that opens every client in the settings list and compares bubbles, tabs, section headings and table columns; check that no other client's names or domains appear (decision 84). Lint that flags client-key comparisons. Starts red; it lists the gaps. | `e2e/client-parity.spec.ts`, `scripts/client-parity.test.ts`, `scripts/lint-client-branches.mjs`, `package.json` | Sonnet 5.5 | $25 | none |
| 1 | C5 Spotlight category | Replace `beginner` with `spotlight_category`; rival from data. | `lib/ai-search/canvas-surfaces.ts`, `lib/fender-canvas/minimal-metrics-other.ts`, `metrics-from-live.ts`, `template-vars.ts`, `beginner-sov.ts`, `components/v3/fender-metrics.ts` | Sonnet 5.5 | $20 | Decision 4; reads settings through a stub until C1 merges |
| 2 | C2 Brand words and domains | P-18 to P-22, P-32: brand words, owned domains, vertical reference lists, competitor sites, glossary copy. | `lib/ai-search/citations.ts`, `citation-insights.ts`, `why-not-fender.ts`, `definitions.ts`, `run-metrics.ts`, `data/reference/*`, `CitationEcosystemPanel.tsx`, `CategoryBattlecardsPanel.tsx` | Opus 5.5 | $50 | C1 |
| 2 | C3 One narrative template | P-01 to P-05, P-34, P-35, P-39, P-44: brand-free template, generated Briefing, same Opportunity and Revenue Estimates layout for all. | `lib/fender-canvas/spoke-narrative.ts`, `analyst-estimates.ts`, `data/fender-v3-spec.json` (renamed), `data/fender-v3-tour.json`, `components/v3/build-live-spokes.tsx`, `app/(canvas)/layout.tsx`, `components/v3/live/deck/useDeckModel.ts` | Opus 5.5 | $45 | C1, decisions 3 and 5 |
| 2 | C6 Catalog Health and Readiness constants | P-11, P-13 to P-16, P-29, P-30: retailer settings and recheck days, seller-type tooltip, short labels, product-type field lists. | `lib/fender-canvas/row-stale.ts`, `data-source-freshness.ts`, `map-reading-status.ts`, `command-center-from-live.ts`, `portfolio-retail.ts`, `consensus-scores.ts`, `components/v3/live/StockLossHero.tsx`, `FenderSpecNarratives.tsx`, `lib/findability/queries.ts` | Opus 5.5 | $35 | C1, PR 212 |
| 3 | C4 Question data from the database | P-23 to P-26: question list and roles read from views; text rules from settings; delete code copies. | `lib/ai-search/prompt-battery.ts`, `stored-question-roles.ts`, `question-role.ts`, `probe-catalog.ts`, `history-eligibility.ts`, `lib/prompts/prompt-list.ts` | Opus 5.5 | $50 | C1, W2 (Watson) |
| 3 | C7 Other seller types | `seller_type` with all 5 values; Controlled Buy Box per SC-02; label per R-02. | `consensus-scores.ts`, `authorized-sellers.ts`, `components/v3/live/RetailOverview.tsx`, `CommerceConsensusPanel` | Opus 5.5 | $40 | C6, decision 6 |
| 3 | C9 Runbook and scaffold | `docs/new-client-runbook.md` and `scripts/new-client.mjs` that writes a settings file and a migration skeleton for Watson to review. | those two files | Sonnet 5.5 | $20 | C1 to C3 |

**9 chunks, about $325 dashboard total**, 3 rounds. Watson's W1 to W6 run alongside. W3 and W6
(X-15, X-16) gate any real client login; W2 gates C4; W4 decides whether 10 clients fit in a
month.

After the plan, client #3 on the dashboard side is: write `data/clients/<key>.json`, add the
logo, run the parity test. About 2 hours. Watson's side drops to about 2 to 3 days with W4,
mostly loading and checking data.

## 5. Decisions for Brian

1. **Where settings live.** Recommended: a reviewed file in the repo now (fast, versioned with the
   pull request, no database change), mirrored to a database table with W1 later. Alternative: a
   database table first (needs Watson before C1).
2. **Lift the hold on X-15 and X-16** (decision 46). Real clients need logins and data
   separation, and X-16 says separation comes before the first real client.
3. **Briefing content.** Recommended: generated for every client from settings and data, so the
   Fender text on Austin Bazaar and GearTree becomes "Authorized partners named on listings in
   this read: ..." from stored seller names. Alternative: keep a hand-written note per client as
   an additive field. That brings back per-client writing for every new client.
4. **Beginner figures.** Replace with a per-client spotlight category set by staff, or drop them.
5. **Analyst estimates.** Recommended: every client shows the same Opportunity and Revenue
   Estimates layout. Cells read Not available\* until an analyst enters figures in settings.
   Formulas stay parked.
6. **Seller types.** Build Amazon Retail only, Hybrid and No managed presence now (SC-02 already
   gives the rules), or wait for a client that needs one.
7. **Database layout** (with Watson): one area per client (today's Ledlenser pattern, about 2,100
   lines copied each time) or shared tables with a client column and row rules (more work once,
   then cheaper for each client).
