# Fender in AI search: what the listings are costing
**Audience:** Fender (FMIC) ecommerce and brand executive, prospect or client sponsor · **Goal:** agree the first five fixes · **Format:** live, also sent to read alone · **Length:** 9 slides, about 12 min
**One-sentence argument:** AI assistants already name Fender in 6 of 10 open guitar questions, and the gaps in Fender's own listings (no buy button, prices below MAP, split reviews, missing fender.com product data) are the parts of the record those assistants repeat, so fixing them is how Fender protects and grows that position.

All figures read from the live dashboard (deploy-preview-164, main as of 10 Nov 2026, "Data as of Nov 10, 2026, 9:32 PM"). Each figure is shown with its N of M and the tab it came from.

## Look and feel
- Theme: `ember` (dark-first, matches "Dark is the brand"), with every token overridden from the IntoFocus Brand Book V2: page `#070B14`, cards `#0B1220`, hover `#141E33`, headlines `#F8FAFC`, body `#AEB8C7`, captions `#8B95A7`, borders `#64748B`. Accent and highlight `#A7D8F0` (ice-300) on dark; accentStrong `#307191` (ice-600). Light slides only if a table needs it, then accent becomes ice-800 `#194257`, body `#334155`.
- Colour rules: one ice-blue accent per slide (the key number or one headline phrase). Charts: at most two blue series (`#4E97BC`, `#307191`), everything else gray `#64748B`. Status colours only for good/okay/bad data, always with a word: Oxblood `#CC5B63`, Champagne `#D4B66F`, Pine `#6AB792`. No shadows, glows or gradients.
- Type: Geist 600 for headlines (never heavier), Geist 400 body, Geist Mono for eyebrows, labels, sources and table numbers. Load from Google Fonts.
- Wordmark: "IntoFocus AI" · Progress: plain dot · Badge: none
- Transition: `fade` · Grain: no · Motion: restrained. Reveals 350 to 600 ms, count-ups on hero numbers only, no set pieces beyond the one diagram on s4. Respects reduced motion.
- Imagery: proof over pictures. One proof visual per slide (brand book, sales decks). No stock photos, no robots, no Fender logo or Fender brand styling; Fender appears by name in text only.
- Features: edit mode on, navigation guide on, source tips on (every figure carries a `data-src` tip naming its dashboard tab).
- Voice: no contractions, no emojis, no em dashes. Short sentences, operator language. No fees, retainers, pricing or service tiers anywhere.

## Flow
Act 1 · Where Fender stands in AI answers: s1 → s2 → s3
Act 2 · Why the listings decide it: s4 → s5 → s6 → s7 → s8
Act 3 · What to fix first: s9
Backstage (↓): b1 full rival table by category and engine, b2 Buy Box readings detail, b3 out-of-stock top listings, b4 analyst estimates and their four lines each, b5 the 3 AI answers that contradicted a Fender fact

## Slides

### s1 · title · "AI assistants recommend Fender in 6 of 10 open guitar questions. Rivals take the other 4."
- Why this type: the opening claim; one number carries the tension.
- Headline: AI assistants recommend Fender in 6 of 10 open guitar questions. Rivals take the other 4.
- Why it matters to Fender: shoppers now ask an assistant what to buy before they reach a product page. Every answer that names a rival is a sale Fender never gets the chance to win.
- On screen: kicker "Fender · AI search and ecommerce briefing"; figure "1,624 of 2,676 answers (60.7%)"; meta "Data as of 10 Nov 2026 · source: AI Search, Run Summary".
- Animation: typed headline, figure counts up, meta fades in at 0.2 s.
- Interaction: none.
- Visual idea: near-black field, headline left, the single figure in ice blue right. Focal-point rings (flat rings around an ice-blue dot) sit faintly behind the figure, used once in the deck.
- Speaker note: "Unbranded" means the shopper did not say Fender. For example, "best first electric guitar for a total beginner". Across 2,676 resolved answers from ChatGPT, Gemini, Perplexity, Claude and others, Fender or Squier was the brand named most in 1,624.

### s2 · stats · "When a shopper names Fender, AI backs it. When they do not, Fender has to earn it."
- Why this type: three headline numbers that only make sense side by side.
- Headline: When a shopper names Fender, AI backs it. When they do not, Fender has to earn it.
- Why it matters to Fender: loyal buyers are safe. New buyers, who start with an open question, are where Fender wins or loses share.
- On screen (three stats, count up):
  - Unbranded discovery 60.7% · 1,624 of 2,676 resolved answers · Fair (Champagne) · AI Search, Run Summary
  - Branded consideration 93.5% · 2,387 of 2,553 resolved answers · Good (Pine) · AI Search, Run Summary
  - Product fact accuracy 99.8% · 3 of 1,572 answers contradicted a Fender fact · Good (Pine) · AI Search, Product Fact Checks
- Animation: numbers count up left to right, 200 ms stagger.
- Interaction: hover tip on each stat shows its source tab and engines.
- Visual idea: three cards on `#0B1220`; only the 60.7% is in ice blue, the other two in white with a Pine status word.
- Speaker note: the facts AI repeats about Fender are almost always right today (185 facts checked, 181 of 181 catalog products). The gap is not accuracy. It is whether Fender is the name that comes up at all.

### s3 · chart (hbar) · "Yamaha and Taylor own the acoustic answer. Taylor leads 315 of 707."
- Why this type: rank five rivals on one measure.
- Headline: Yamaha and Taylor own the acoustic answer. Taylor leads 315 of 707.
- Why it matters to Fender: in acoustics, an assistant asked for a recommendation names Taylor or Yamaha first far more often than Fender. That category is being decided before the shopper sees a Fender listing.
- On screen: Competitors led 1,052 of 2,676 resolved unbranded answers. Bars: Yamaha 406, Taylor 315, Ibanez 112, Gibson 108, PRS 98 (each "of 2,676"). Side callout: "Acoustics: Taylor 315 of 707, Yamaha 301 of 707 answers led." Source: Competitive Radar, Competitor Wins.
- Chart: categories Yamaha, Taylor, Ibanez, Gibson, PRS; series "Answers led" 406, 315, 112, 108, 98; format integer; Taylor and Yamaha in the two ice blues, the rest gray.
- Animation: bars grow from the baseline, 150 ms stagger.
- Interaction: hover shows each rival's categories (for example Gibson: Electrics 108 of 1,018).
- Speaker note: the map shows this as "44.6% · Taylor leads Acoustics" (315 of 707). Boss (10) and Sire (3) are in backstage b1. One stored answer to read aloud if asked: "Best travel acoustic guitar for intermediate players" on ChatGPT named Taylor most; Fender was not mentioned and none of its 5 cited pages was a Fender page.

### s4 · pipeline · "AI answers are built from Fender's listings. Four gaps in those listings show up in the answer."
- Why this type: a flow between stages, shopper question to answer to purchase, with the four break points named. This is the turn of the deck and the plain-language bridge from ecommerce to AI search.
- Headline: AI answers are built from Fender's listings. Four gaps in those listings show up in the answer.
- Why it matters to Fender: an assistant can only recommend and link what the record supports. A missing buy button, a lower price, split reviews or a guessed spec weakens Fender's case in the answer, and the shopper's path to buy.
- On screen: nodes "Shopper asks" → "Assistant reads listings, prices, reviews, fender.com" → "Assistant names a product" → "Shopper buys in one click". Four markers on the arrows, each a plain sentence taken from the dashboard's own explanations:
  1. No buy button: "A withheld Buy Box removes the one-click path shoppers and AI assistants use."
  2. Price below MAP: "publishes a lower number than the brand agreed to advertise."
  3. Split bundles: "keeps its reviews off the listing those assistants treat as the product."
  4. No machine-readable specs: "A spec that only appears as page text has to be guessed."
- Figure: none on this slide (the next four slides carry them). Source of wording: Catalog Health, Retail Overview; AI Readiness, Brand-Site Specs.
- Animation: nodes rise, arrows animate; the four markers appear one per press.
- Interaction: presenter presses through the four markers.
- Visual idea: thin 1.5 px line icons in ice-300, nodes as dark cards; markers in Oxblood with the word "gap".
- Speaker note: this is how the two halves connect. The dashboard does not claim a measured effect of each gap on each answer; it shows the gaps and the AI position side by side.

### s5 · stats · "59 Fender listings have no buy button on Amazon, and 583 went out of stock this year."
- Why this type: two to three headline numbers, one of them a dollar estimate.
- Headline: 59 Fender listings have no buy button on Amazon, and 583 went out of stock this year.
- Why it matters to Fender: when an assistant names one of these guitars, the shopper lands on a page with no one-click offer or nothing to buy. The recommendation turns into a lost sale.
- On screen:
  - Buy Box withheld 5.3% · 59 of 1,114 monitored listings · Poor (Oxblood) · Catalog Health, Suppressed Listings
  - Priced above Amazon's outside price · 48 of 59 withheld listings · Catalog Health, Suppressed Listings
  - Est. lost sales from out of stock, 12 months: $1,217,328.74* · analyst estimate · covers 242 of 583 out-of-stock listings · Catalog Health, Out of Stock
- Animation: count-ups, 200 ms stagger; the asterisk and "analyst estimate" label appear with the number, never after.
- Interaction: source tips.
- Visual idea: three cards; the $ card carries a Geist Mono "ANALYST ESTIMATE" eyebrow.
- Speaker note: Amazon withholds the Buy Box when the offer is above the lowest price it found outside Amazon. Amazon does not name that retailer. 11 of the 59 have no outside price to compare, so their cause is not confirmed. Third-party sellers hold the Buy Box on 844 of 976 active offers (86.5%); Amazon itself on 73 of 976 (7.5%).

### s6 · stats · "117 Fender offers are advertised below MAP, by $166.52 on average."
- Why this type: one headline figure with a breakdown by retailer.
- Headline: 117 Fender offers are advertised below MAP, by $166.52 on average.
- Why it matters to Fender: a price below MAP puts a lower number on the public record than Fender agreed to advertise. That is the number shoppers and assistants see, and a lower outside price is what Amazon compares against when it withholds a Buy Box.
- On screen:
  - MAP leakage 18.5% · 117 of 633 · Poor (Oxblood) · Catalog Health, MAP Leakage
  - Average price gap -$166.52 · Catalog Health, MAP Leakage
  - Where: Amazon 76, Musician's Friend 35, Walmart 12* listings below MAP
- Animation: count-up on 117; the three retailer counts build per press.
- Interaction: source tips.
- Visual idea: one large figure left; a short three-row tally right (Geist Mono numbers, gray bars, Amazon in ice blue).
- Speaker note: the link between a low price elsewhere and a withheld Buy Box on Amazon is how Amazon's rule works, not a measured match for these listings; Amazon does not name the outside retailer. Discounted retail value is $2,316.76* a month, analyst estimate, covering only 18 of 117 listings; keep that in backstage unless asked.

### s7 · stats · "38 Fender bundles sit on their own listings, so their reviews are split from the main product."
- Why this type: one headline figure plus one supporting figure from the same tab group.
- Headline: 38 Fender bundles sit on their own listings, so their reviews are split from the main product.
- Why it matters to Fender: assistants and Amazon judge a product by its review record. Split reviews make a strong Fender guitar look weaker than it is next to a rival with one consolidated page.
- On screen:
  - Splintered listings 11.1% · 38 of 342 bundles with a live offer · Poor (Oxblood) · Catalog Health, Catalog Governance
  - Electric Guitar Kits are bundle listings in 196 of 227 SKUs (86.3%) · Summary, Performance
  - Amazon specs complete 51.2% · 532 of 1,040 listings · Catalog Health, Catalog Governance
- Animation: count-ups, 200 ms stagger.
- Interaction: source tips.
- Visual idea: a simple before/after line drawing in ice-300: five small listing cards each with a few stars, then the same five nested under one parent with the stars pooled. Not to scale; labelled "illustration".
- Speaker note: examples are authorized dealer bundles (for example Austin Bazaar Affinity Telecaster packs). Nesting them under the official parent pools the reviews.

### s8 · stats · "Only 82 of 1,043 Fender Amazon listings have an exact fender.com page, and no fender.com page publishes its specs in a form AI reads."
- Why this type: two headline figures that tell one story.
- Headline: Only 82 of 1,043 Fender Amazon listings have an exact fender.com page, and no fender.com page publishes its specs in a form AI reads.
- Why it matters to Fender: AI engines take a brand's own product data as fact. Where that page is missing, or covers a whole family, the assistant has to guess the specs or borrow them from a reseller.
- On screen:
  - Exact official product page 7.9% · 82 of 1,043 · Poor (Oxblood) · AI Readiness, Findability (last checked 12 Oct 2026)
  - Pages missing machine-readable specs 100.0% · 184 of 184 · Poor (Oxblood) · AI Readiness, Brand-Site Specs
  - Supporting line: fender.com page found for 634 of 1,040 SKUs (61.0%); 540 of 1,043 listings match only a family page.
- Animation: count-ups.
- Interaction: source tips.
- Visual idea: a 1,043-square unit grid is tempting but showy; keep two cards, with a one-line note in Geist Mono: "Same gap on every page: one template change."
- Speaker note: the dashboard reads this as a shared template gap: all 184 checked pages have the seven product basics and none has the spec block, so one change to fender.com's product template fixes all of them. Today AI still gets the facts right (s2, 99.8%); this is about keeping it that way as answers lean on structured data.

### s9 · bullets (num) · "Five fixes, in the order the dashboard ranks them."
- Why this type: an ordered list of decisions.
- Headline: Five fixes, in the order the dashboard ranks them.
- Why it matters to Fender: each fix closes one of the gaps an assistant repeats, and together they are the Phase 1 work the analyst estimate is based on.
- On screen (one per press, each with its figure and source Action Items, Urgent Interventions):
  1. Publish one fender.com page for each exact product · 82 of 1,043 have one today · Critical
  2. Raise offers below MAP back to the floor · 117 of 633 · Critical
  3. Nest each bundle under the official parent listing · 38 of 342 · Critical
  4. Correct each offer so the Buy Box returns · 59 of 1,114 · Critical
  5. Track unbranded discovery as the result · 60.7%, 130 of 214 questions · At risk
- Meta line under the list: "Phase 1 lift: +$680K est. a year · analyst estimate" (Action Items, Revenue Estimates).
- Animation: one item per press, 350 ms reveal.
- Interaction: none.
- Visual idea: numbered list, Critical as an Oxblood word, At risk as a Champagne word; the $680K line in Geist Mono with its label.
- Speaker note: the order is the dashboard's own priority list. The full-portfolio figure (+$38M to $62M est. a year, analyst estimate, across Fender, Squier, Jackson, EVH and Gretsch) is in backstage b4 if the sponsor asks about scale. Close by agreeing who owns fix 1 and fix 4.

## Data and sources
| Value | Shown on | Source (dashboard tab) | Status |
|---|---|---|---|
| Unbranded discovery 60.7%, 1,624 of 2,676 resolved answers | s1, s2 | AI Search Visibility › Run Summary | confirmed |
| Unbranded discovery 60.7%, 130 of 214 | s9 | Action Items › Urgent Interventions | confirmed (different denominator, see Q2) |
| Branded consideration 93.5%, 2,387 of 2,553 resolved answers | s2 | AI Search Visibility › Run Summary | confirmed (map bubble shows 92.8%, see Q1) |
| Fact accuracy 99.8%, 3 of 1,572 answers contradicted; 185 facts; 181 of 181 products | s2, s8 | AI Search Visibility › Product Fact Checks | confirmed (map shows 100.0%, see Q1) |
| Competitors led 1,052 of 2,676 resolved unbranded answers | s3 | Competitive Radar › Competitor Wins | confirmed |
| Yamaha 406, Taylor 315, Ibanez 112, Gibson 108, PRS 98, Boss 10, Sire 3 (of 2,676) | s3, b1 | Competitive Radar › Competitor Wins | confirmed |
| Acoustics: Taylor 315 of 707, Yamaha 301 of 707 | s3 | Competitive Radar › Competitor Wins | confirmed |
| Taylor leads Acoustics 44.6% | s3 note | Map bubble, Competitive Radar | confirmed |
| Buy Box withheld 5.3%, 59 of 1,114 | s5, s9 | Catalog Health › Suppressed Listings / Retail Overview | confirmed |
| 48 of 59 withheld priced above Amazon outside price; 11 without comparison | s5 | Catalog Health › Suppressed Listings | confirmed |
| Amazon holds Buy Box 73 of 976 (7.5%); third party 844 of 976 (86.5%) | s5 note | Summary › Briefing | confirmed |
| Est. lost sales, out of stock, 12 months $1,217,328.74*, covers 242 of 583 | s5 | Catalog Health › Out of Stock | analyst estimate, partial |
| MAP leakage 18.5%, 117 of 633; average gap -$166.52 | s6, s9 | Catalog Health › MAP Leakage | confirmed |
| Below MAP by retailer: Amazon 76, Musician's Friend 35, Walmart 12* | s6 | Catalog Health › MAP Leakage | confirmed (Walmart asterisked on screen) |
| Discounted retail value $2,316.76* a month, covers 18 of 117 | s6 note | Catalog Health › MAP Leakage | analyst estimate, partial |
| Splintered listings 11.1%, 38 of 342 bundles with a live offer | s7, s9 | Catalog Health › Catalog Governance | confirmed |
| Amazon specs complete 51.2%, 532 of 1,040 | s7 | Catalog Health › Catalog Governance | confirmed |
| Electric Guitar Kits bundle listings 86.3%, 196 of 227 SKUs | s7 | Summary › Performance | confirmed |
| Exact official product page 7.9%, 82 of 1,043; family page 540 of 1,043 | s8, s9 | AI Readiness › Findability (checked 12 Oct 2026) | confirmed |
| fender.com page found 61.0%, 634 of 1,040 | s8 | AI Readiness › Brand-Site Specs | confirmed |
| Pages missing machine-readable specs 100.0%, 184 of 184 | s8 | AI Readiness › Brand-Site Specs | confirmed |
| Phase 1 lift +$680K est. a year | s9 | Action Items › Revenue Estimates | analyst estimate |
| Full portfolio +$38M to $62M est. a year ($50M midpoint) | b4 | Action Items › Revenue Estimates | analyst estimate |

## Open questions
1. **Map bubbles and tabs disagree on two AI figures.** Branded Consideration shows 92.8% on the map and 93.5% (2,387 of 2,553) on Run Summary; Fact Checks shows 100.0% on the map and 99.8% (3 of 1,572) on the tab. Default: use the tab figures, which carry N of M, and flag the mismatch to the dashboard team.
2. **Unbranded discovery has two denominators.** 1,624 of 2,676 resolved answers (Run Summary) and 130 of 214 (Action Items, which looks like questions). Both read 60.7%. Briefing and Roadmap show it as "Not available*". Default: answers on s1 and s2, questions on s9, with the unit named each time.
3. **No figure ties a listing gap to a lost AI answer.** The dashboard shows the gaps and the AI position side by side; it does not measure the effect of one on the other. Default: s4 states the mechanism in the dashboard's own words and claims no measured effect.
4. **No named outside retailer behind a withheld Buy Box.** Amazon does not name the retailer, so the deck cannot link a suppressed Amazon listing to a specific Walmart or Musician's Friend listing. Default: keep this as the rule Amazon applies (s6 note), never as a confirmed cause.
5. **Fender's own share in acoustics is not shown.** Only rival leads (Taylor 315, Yamaha 301 of 707). Default: show the rival figures; do not derive a Fender acoustic figure.
6. **Category Battlecards did not load** ("The selected period did not load"). Default: use Competitor Wins, which loaded in full.
7. **Map figures without N of M were left out:** Citations 17.5% Fender-owned links, Engine Comparison 42.9% ChatGPT unbranded, Amazon A+ Matrix 73.3% five bullets filled, AI Commerce 78% (4 of 5). Default: leave out; add Citations if the tab gives N of M.
8. **Out of stock denominator.** 583 out-of-stock listings over 12 months, but the tab does not show the total monitored set. Default: state "583 went out of stock this year" with no rate.
9. **Findability is a month older** (checked 12 Oct 2026) than the other reads (10 Nov 2026). Default: show the check date on s8.
10. **Live, read-alone or both.** Default: both; every figure has a source tip so the deck reads alone.
11. **Full-portfolio figure (+$38M to $62M est.).** Default: backstage only, analyst estimate label, shown if the sponsor asks about scale.
