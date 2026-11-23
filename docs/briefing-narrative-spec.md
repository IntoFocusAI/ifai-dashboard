# Briefing narrative: "What this means for {brand}"

PM30 proposal for Brian Magazu, 19 Nov 2026. Replaces the Briefing box "What is
changing what AI assistants recommend for {brand}?" (`components/v3/live/BriefingAiLead.tsx`,
decision 110, FDD H-09). Brian approved the sentence table with the decisions recorded below on 23 Nov 2026.

## Purpose

Tell an executive who knows nothing about ecommerce or AI search what the dashboard's
figures mean for the business, in four short paragraphs. Every sentence is chosen from
live data by rule, so the box changes when the client's numbers change. No hand-written
prose per client, no code that branches on a client name (X-35).

## Placement and shape

Summary › Briefing, below the hero cards, where the current box sits. Title:
**What this means for {brand}**. Four blocks, each one bold lead sentence and at most two
plain sentences. One "→ Action Items" link at the end. Dollar figures keep "analyst
estimate" and open to their inputs. Caveats live in tooltips (standing rule).

The active-offers paragraph leaves the Briefing (it stays in Catalog Health). The selling-model
line stays in the box, one line, without naming sellers (decision 128).

## Inputs (all already computed)

| Input | Source | Fender today |
| --- | --- | --- |
| Unbranded wins / resolved | `summarizeRun(ai).roles.unbranded` | 2,998 of 4,978 (60.2%) |
| Branded wins / resolved | `summarizeRun(ai).roles.branded` | 3,012 of 3,211 (93.8%) |
| Owned cited links / all cited links | `citationOwnedLinksLead` | 6,404 of 36,289 (17.6%) |
| Exact official pages / listings | `countFindability` | 92 of 1,091 (8.4%) |
| Listings missing Amazon specs | `specHero(retail.snapshot)` (listings missing at least one field; same count as Action Items `signal:missing_specs`) | 524 |
| Buy Box withheld / listings | retail read | 60 of 1,173 (5.1%) |
| Splintered bundles / bundles | retail read | 38 of 330 (11.5%) |
| MAP leakage offers / offers | retail read | 187 of 633 (29.5%) |
| Monthly estimate and range | Phase 1 ÷ 12 (`lib/estimates/monthly.ts`) | $102K, $55.7K to $158K |
| Top action | `commandItems[0]` (Priorities order) | Publish one fender.com page per exact product |
| Bands | `UNBRANDED_RATE_BANDS` 30/65, `BRANDED_RATE_BANDS` 70/90, `EXACT_PAGE_SHARE_BANDS` 25/60, `AMAZON_SPEC_BANDS` 95/98 | |

## Sentence table

`N in 10` is the wins share rounded to the nearest tenth; "{brand}" is the brand name.

### Block 1: the answer shoppers get

| State | Lead sentence |
| --- | --- |
| Unbranded share above 65 | **When a shopper asks an AI assistant what to buy, {brand} is usually the answer: {N} times in 10.** |
| 30 to 65 | **When a shopper asks an AI assistant what to buy, {brand} is the answer {N} times in 10.** The other {10−N} times, a rival is named first. |
| Below 30 | **When a shopper asks an AI assistant what to buy, {brand} is rarely the answer: {N} times in 10.** A rival is named first the rest of the time. |
| No resolved answers | **No AI answers in this window yet.** (figure Not available*) |

Second sentence, from the branded share:

| Branded state | Sentence |
| --- | --- |
| Branded 90 or above and unbranded not above 65 | Shoppers who already ask about {brand} get confirmed {B}% of the time. The gap is being found; once found, {brand} is trusted. |
| Branded below 70 and unbranded above 65 | {brand} is found, but shoppers who ask about it directly get confirmed only {B}% of the time. The gap is trust, not discovery. |
| Branded 70 up to but not including 90 (any unbranded state) | Shoppers who already ask about {brand} get confirmed {B}% of the time: room to build trust. |
| Both low | Shoppers who ask about {brand} directly get confirmed {B}% of the time, and unbranded shoppers hear a rival first. Both need work. |
| Both high | Shoppers who ask about {brand} directly get confirmed {B}% of the time. Discovery and trust are both in good shape. |

### Block 2: what assistants rely on

Lead sentence is fixed: **Assistants decide by reading product pages, retailer listings and reviews.**
Then the owned-link share: *For {brand}, 1 page in {K} they read is {brand}'s own* (K = round(all ÷ owned)); below 10% owned: *Almost none of the pages they read ({pct}%) are {brand}'s own.*
Then the three largest listing gaps, chosen by the same severity order the Priorities use, each in plain words and each ending with why it changes what assistants recommend (decision 129):

| Gap | Plain sentence (status Poor or Fair only) |
| --- | --- |
| Exact official pages | {X} in 10 Amazon listings have no matching page on {site}. |
| Missing specs | {M} listings are missing the specs assistants compare, so assistants struggle to match them to shoppers' questions. |
| Buy Box withheld | {M} listings are not showing {brand}'s price at the moment of purchase, so assistants rarely point shoppers to them, and the sales and reviews they would earn often go to a competitor. |
| Splintered bundles | {M} bundles split their reviews across separate listings. |
| MAP leakage | {M} offers are advertised below the agreed floor price, so assistants can repeat a price below the one {brand} sets, and the discounting erodes {brand}'s retail value (partner-led) or revenue (brand-led), by the client's `seller_type`. |

If no gap is Poor or Fair: *{brand}'s listings on those pages are in good shape.*

### Block 3: what it is worth

| State | Sentence |
| --- | --- |
| Estimate prepared | **Fixing those listings is worth about {monthly} a month,** an analyst estimate (range {low} to {high}) from the Amazon sales those listings already make. |
| Not prepared or failed | **A dollar estimate is not available yet.** (Not available*, with the existing tooltip) |

### Block 4: the first move

**The first move:** {top action title}, {AI consequence clause}. → Action Items. The clause is chosen by the item's ranked kind (`RANKED_KIND_CLAUSES` in `briefing-narrative.ts`, one per `GAP_KINDS` entry; a test fails when a kind has none). If the queue is empty: *No open action; the queue is clear.*

## Tooltips (plain phrase on screen, term in the tooltip)

| On screen | Tooltip title | Tooltip text |
| --- | --- | --- |
| "what to buy" answers | Unbranded Discovery | Shopping questions that do not name a brand, asked of ChatGPT, Gemini and Perplexity three times each in the date-pill window. |
| "ask about {brand}" | Branded Consideration | Shopping questions that name {brand}. |
| "pages they read" | Cited pages | The links the assistants cited in their answers. Cited pages are associations, not proof of cause. |
| "price at the moment of purchase" | Buy Box | Amazon's buy button, also called the Featured Offer. |
| "agreed floor price" | MAP | Minimum advertised price. |
| "specs assistants compare" | Amazon required fields | The detail fields on the approved list for the product type. |

## Tests

One unit test per row of each table (state → sentence), the missing-data row for every
block, the three-gap selection order (decision 128), and a Ledlenser fixture that proves no client name is
in the code. A snapshot test guards the Fender and Ledlenser outputs so wording changes
are deliberate.

## Not in this change

- An AI-written paragraph on top of the facts (later, constrained to these inputs).
- Trend sentences ("up from 54% last month"); needs the history read wired to the Briefing.
- Any change to the hero cards, the deck, or the Summary template sentence.

## Decisions (Brian Magazu, 23 Nov 2026; decisions 128 and 129)

1. Title: **What this means for {brand}**.
2. Block 1 keeps the "N times in 10" line beside the hero card's figure. A little duplication is fine when the paragraph derives it from the values and phrases it plainly.
3. Block 2 names **three** gaps.
4. The selling-model line stays in the box, one line, and never lists sellers: *Partner-led: authorized sellers are meant to hold the Buy Box.* / *Brand-led: {brand}'s own seller accounts are meant to hold the Buy Box.*
5. **Amazon rule (decision 129).** The narrative must not be Amazon-centric. Any Amazon gap it names must say why that gap changes what AI assistants recommend, in the same sentence or the next; it may not simply restate a figure the brand already gets from a SmartScout-type subscription. Block 2's gap sentences therefore each carry an AI consequence, e.g. "{M} listings are missing the specs assistants compare, so assistants struggle to match them to shoppers' questions" and "{M} listings are not showing {brand}'s price at the moment of purchase, so assistants rarely point shoppers to them, and the sales and reviews they would earn often go to a competitor." The worker proposes the consequence clause per gap in the PR body for approval.

## Build plan

One worker on Opus 5.5 (sentence selection and fallbacks are judgment work), one PR.
Files: `components/v3/live/BriefingAiLead.tsx`, a new `lib/fender-canvas/briefing-narrative.ts`
(pure functions, no React), its test under `scripts/`, and the selling-model line in `BriefingAiLead.tsx` (no seller names). Projected cost about $45. FDD: H-09 Evidence
gains this PR; no status change.
