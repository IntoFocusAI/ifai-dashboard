# IntoFocus v3

The v3 dashboard is a Fender brand-intelligence canvas at `/`. It shows how Fender Musical Instruments Corporation (FMIC) is discovered and recommended in AI search, and how catalog, retail, and product-data problems on the open web change that outcome.

It is built as an executive briefing for portfolio health, not a live operations console. Figures are authored in the source files listed under [Writing dashboard copy](#writing-dashboard-copy) and will move to daily data feeds, so this README describes what each area covers rather than repeating its numbers.

## How it works

The canvas is a zoomable map. A center hub, **Summary**, connects to six spokes. Each node shows a status (critical, at risk, or on track), a headline metric, and a short tooltip. Clicking a node opens a side panel with tabs of briefing copy, tables, and recommended actions.

Tickers across the top surface the headline alerts and jump to the matching spoke. Configurable metric widgets let each viewer pin the signals they care about. A guided tour walks through every area of the briefing.

## What each area covers

**Summary (hub).** Briefing, Performance, and Opportunity for the pilot and the full enterprise portfolio.

**Catalog Health.** Who holds the Amazon Buy Box (Amazon also calls it the Featured Offer), partner bundle ASINs that split reviews, Brand Registry consolidation, and MAP price leakage across marketplaces. Fender's seller type is Partner-led. The five types are in `docs/client-seller-models.md`. How each type is drawn on the dashboard is not decided.

**AI Search Visibility.** How AI assistants name and cite Fender. The published audit run stays on `canvas_ai_current_run` (contract in `docs/ai-search-truth-contract.md`) and the map stays on that run. The tabs default to the latest month: the published runs with answered calls in the UTC calendar month of the published run. The pill keeps that choice across tabs, and its menu opens the latest run in one click. Tabs: **Run Summary** (selection or run completeness, and the same two Fender-lead rates, unbranded discovery and branded consideration, for the selection, for each engine, and for each category), **Run Details** (every call in the selection, with shopping prompts, product fact checks, provider errors, and unresolved answers filtered apart, and an evidence drawer per call), **Product Fact Checks** (answers compared with facts IntoFocus verified on official Fender pages, leading with what was checked rather than a zero), and **Citation Ecosystem** (how many shopping answers cited a Fender-owned page, then the links, domains, and source classes those answers contained). Pooled `canvas_metrics.sim_*` fields are not used. Rates add numerators and denominators. Remediation and root cause appear only when the run stores real text. The panel header can open one stored review run, a date range, or All time. `?ai-history=fixture` reviews a labeled copy of the October 11 run and the two October 12 runs. The history contract is in `docs/ai-search-history.md`. Old tab slugs such as `simulations` and `executive-briefing` still open the renamed tabs through `TAB_SLUG_ALIASES` in `lib/canvas-sdk/canvas-url-state.ts`.

**AI Readiness.** Whether Fender's product data is ready for AI engines to read. The bubble and its two satellites keep their names. The tabs are **Findability** (whether each catalog listing resolves to an exact official product page, an official family page, a finished search with no defensible page, an ambiguous match, or unchecked), **AI Readiness** for the catalog-level spec view, **Machine Readability** for Schema.org JSON-LD on the older spec read, and **Amazon A+ Matrix** for Amazon A+ comparison content. A family page is not an exact product page. The guided tour introduces this area as **Product Readiness**.

**Competitive Radar.** Which brands AI engines name over Fender/Squier in the same AI Search selection. **Category Battlecards** and **Engine Comparison** show the same two Fender-lead rates as Run Summary, unbranded discovery and branded consideration, and their competitor counts include only wins inside those two roles. **Competitor Wins** lists each losing answer with its engine, model, and cited pages. Brand-associated discovery, shopping guidance, product-fact questions, product fact checks, provider errors, answers with no clear leader, and retail-channel coverage stay out of those two rates.

**Action Items.** Prioritized interventions with estimated impact. The ROI tab switches between the pilot model and the full enterprise model.

**90-Day Roadmap.** A phased plan with baseline and target KPIs, plus a resourcing toggle between an IntoFocus-managed sprint and an in-house co-pilot model.

## Command center

The panel opens on **What do I need to worry about?**, a ranked queue of the highest-value moves. Each item has a plain-language reason, the commercial consequence, an owner toggle (IntoFocus AI, client team, or done), and a link into the spoke tab that holds the evidence. The header's **Priorities** button returns to it from anywhere.

Panel content is written for an operator, not an engineer. Jargon is marked with a dotted underline and explains itself on hover (see `components/v3/glossary.ts`), and every **Explanation** block can be hidden once read.

Per-viewer state (owners, starred prompts, hidden explanations) currently lives in `localStorage`. `lib/canvas-sdk/local-store.ts` is the single read/write seam to replace when this moves to per-user Supabase rows.

## Writing dashboard copy

Follow these rules for every visible string: titles, labels, tooltips, tour steps, panel copy, and glossary definitions.

**Where copy lives**

| File | Contains |
| --- | --- |
| `components/v3/fender-canvas-spec.tsx` | Brand header, tickers, legend, node titles, stats, and tooltips |
| `components/v3/spoke-data.ts` | Spoke titles, descriptions, tabs, panel HTML, and guided tour steps |
| `components/v3/command-center-data.ts` | Command center heading, summary, and priority items |
| `components/v3/fender-metrics.ts` | Metric widget labels and values |
| `components/v3/glossary.ts` | Hover definitions for jargon |

**Area names.** Use these names exactly in visible copy:

- **Summary**: the center hub (Briefing, Performance, and Opportunity tabs).
- **Catalog Health**: Amazon Buy Box, MAP, and catalog nesting for retail listings.
- **AI Search Visibility**: how AI assistants recommend and cite Fender. Tabs include **Run Summary** and **Run Details**.
- **AI Readiness**: whether product data is ready for AI engines to read.
- **Machine Readability**: the Schema.org JSON-LD view inside AI Readiness, named for the bubble's satellite.
- **Amazon A+ Matrix**: the A+ comparison-content view inside AI Readiness, named for the bubble's other satellite.
- **Product Readiness**: the product-page view of the same area, used as its guided tour title.
- **Action Items**: the prioritized interventions. Use it for the area and as the count noun ("18 Action Items").

Don't bring back the retired labels Brand Portfolio, Portfolio Retail, Retail Portfolio, Brand AEO, Brand Fixes, Spec Readiness, Suggestion Engine, Catalog Readiness, Commercial Sizing (as a tab title), Simulations (as a tab title), Schema.org (as an area or tab name), or A+ Tables. Schema.org still names the standard itself, as in "Schema.org JSON-LD". The primary client name for Amazon's purchasing button is **Buy Box**; tooltips may note that Amazon also calls it the Featured Offer.

**AEO.** Use AEO (Answer Engine Optimization) only for the technical discipline, as in "AEO schemas" or "AEO execution". Never use it as the name of an area, tab, or metric.

**Internal keys stay put.** The spoke IDs `aeo`, `specs`, and `suggestions`, along with storage keys, are code identifiers. Don't rename them when visible copy changes. Deep links (`subTab` in the spec and `data-ifai-tab` in panel HTML) match tab names by case-insensitive substring, so a renamed tab must keep the matched word, or the link must change with it. A tab slug already shared in a copied URL keeps working through `TAB_SLUG_ALIASES` in `lib/canvas-sdk/canvas-url-state.ts`: add the old slug there whenever you rename a tab.

**Punctuation and style**

- Don't use em dashes. Use a comma, colon, semicolon, parentheses, or a new sentence instead.
- Prefer the shorter form when it's just as clear, such as "30-60-90", "$600–$1,200", "7/19", and "$50+". The en dash in a range isn't an em dash.
- Use the serial comma and US spelling.
- Write callout questions in sentence case ("What is MAP, and how does price leakage work?").
- Don't use exclamation marks or hype words such as "staggering" or "Real" as a label prefix.

**Voice.** Write for an e-commerce or marketing operator. Use plain language, active voice, contractions, and short sentences. Command center items speak to the reader as "you". Explain any unavoidable jargon in `glossary.ts`.

**Let the data speak.** Don't put qualifiers on screen that say what a figure is not ("not a random sample," "not proof of cause"). Show the figure with its N of M. If a caveat is truly needed, put it in the tooltip. Required labels stay visible: "analyst estimate," "Not available*," and the asterisk on a partial or filtered figure.

**Figures.** Keep numbers in the source files above, not in documentation. Label analyst estimates and targets at the point of use ("est.", "analyst estimate", "not yet measured"), and give a rate's sample or denominator next to it.

**IntoFocus fees.** Client-facing copy never mentions IntoFocus fees, retainers, monthly charges, or whether the estimated lift justifies IntoFocus's price. Do not show a service-fee multiple. Opening an estimate to its inputs is a later pass. Until then, label the figure as an analyst estimate and do not invent the formula.

**Tests.** End-to-end specs select some elements by visible text. When you rename a visible label, update the matching specs in `e2e/`.

## Authoring panel content

Spoke panels are authored as HTML strings in `components/v3/spoke-data.ts` and injected into the drilldown. They are wired by delegation in `lib/canvas-sdk/panel-interactions.ts` rather than by inline `onclick` handlers, so a missing handler is impossible rather than a silent runtime error. Supported attributes:

| Attribute | Effect |
| --- | --- |
| `data-ifai-open="<spokeId>"` + optional `data-ifai-tab="<tab substring>"` | Turns the element into a drill-down into another spoke and tab |
| `data-ifai-filter="<value>"` inside `data-ifai-filter-group="<listId>"` | Segmented filter over list children matching `data-category`; `all` and `starred` are built in |
| `data-ifai-star="<stable id>"` | Adds a star toggle and remembers the row in this viewer's watchlist |

`.ceo-callout` blocks get their Hide/Show toggle automatically, with no markup needed.

## Tests

End-to-end coverage lives in `e2e/`, run with Playwright against the dev server:

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # interactive runner
npm run test:e2e:report   # last HTML report
```

The suite drives the Chrome installed on the machine, so a fresh clone needs no browser download. Without Chrome (CI, Linux):

```bash
npx playwright install --with-deps chromium
E2E_BROWSER=chromium npm run test:e2e
```

`E2E_BASE_URL` points the suite at an already-running server and skips spawning one. Specs are grouped by the behavior they protect: `guided-tour`, `command-center`, `panel-layout` (including header fit and light-theme contrast), and `panel-interactions` (filters, watchlist, collapsible explanations, drill-downs, glossary). Every test also asserts the page logged no errors.
