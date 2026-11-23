# Action Items and Roadmap: gap audit

For Brian Magazu. Worker 29.13 for PM29, 18 Nov 2026. Read-only audit of main at 06eb15e, plus open PR 239 (branch worker/29.3-estimate-rows). Nothing was built or changed.

## How the list is built today (one paragraph)

Action Items (Urgent Interventions) and the Roadmap (30-60-90 Days) come from one plan (`lib/fender-canvas/roadmap-plan.ts`, decision 21). In order, it holds:

1. The five Briefing findings: Buy Box Withheld, MAP Leakage, Splintered bundles, Exact official product pages, and Unbranded Discovery.
2. Two ecommerce signals: out-of-stock listings and missing Amazon spec fields.
3. One combined brand-pages row. It appears when page found, page completeness, machine-readable specs, Amazon attribute completeness or A+ reads below Good. If all of those are Good and the brand site is cited in under 30% of answers, the row instead asks to word the pages to match shopper questions.
4. Answer actions, ordered by the share of answers each affects:
   - fact-check contradictions
   - a rival that leads a category
   - each cited site at 10% or more of shopping answers in 2 of the last 3 runs, worded by site type (publication: PR outreach; community: "set a plan to keep presence accurate"; retailer; video; competitor brand; reference)
5. The "always a focus" items: the weakest engine, the five weakest Unbranded Discovery questions, and sites whose share moved by 10% or more. Each is a priority item when it trails the best by 10 points or more, and a Watch item otherwise.

Phases are set by type of work. Only items that need action reach a phase. Nothing in the plan reads AI Actuation.

PR 239 adds a dollar to the Buy Box, MAP, Splintered, Out-of-stock, Missing-specs and brand-pages rows. The brand-pages row carries the A+ line. It adds no new rows.

## 1. Inventory: what the dashboard shows, and whether it reaches the lists

"Both" means it is an Action Items row and a Roadmap item, since the two lists share one plan.

| View · tab | What it measures | Data source | Reaches | Why it matters to a brand (if Neither) · proposed action line |
|---|---|---|---|---|
| Catalog Health · Suppressed Listings | Buy Box withheld (no one-click offer) | `canvas_retail_listings.featured_offer_state` | Both (finding) | Partly covered. The row says only "correct each offer". The stored cause is not used: Fender has 49 of 58 withheld listings priced above Amazon's benchmark price (R-15 plan). · "Lower these 49 offers to Amazon's benchmark price, or find the outside price that sets it." |
| Catalog Health · Retail Overview | Controlled Buy Box: share of Buy Boxes held by Amazon Retail or an authorized partner | Seller tally in retail read; authorized list is a browser-local placeholder | Neither (only feeds the AI Commerce score) | When an unauthorized seller holds the Buy Box, it sets the price and condition that assistants repeat. · "N of M Buy Boxes are held by sellers outside your authorized list. Enforce or authorize them." |
| Catalog Health · MAP Leakage | Offers below MAP | MAP checks (Amazon, Walmart, Musician's Friend) | Both (finding); PR 239 adds dollars | — |
| Catalog Health · Catalog Governance | Splintered bundles | Retail read | Both (finding) | — |
| Catalog Health · Out of Stock | Listings out of stock at least one day in the last 12 months; lost-sales estimate (R-17) | `canvas_listing_sales_loss_v2`, `canvas_listing_offer_state_v2` | Both (signal) | Partly covered. The 12-month window keeps a restocked listing on the list for up to a year, so the row looks stuck. · Split into "out of stock now" (urgent) and "out of stock in the last 12 months" (watch). |
| AI Readiness · Findability | Exact official product page found | `canvas_spec_findability` | Both (finding) | — |
| AI Readiness · Findability · Unchecked | Listings the checker could not read (blocked, timeout) | Same | Neither | This is IntoFocus's own work, not the brand's. Keep it off the client list. It belongs in staff freshness checks. |
| AI Readiness · Amazon Specs | Missing Amazon spec fields | `canvas_spec_readiness` | Both (signal) | — |
| AI Readiness · Amazon Specs | Listing filed under the wrong product type (D-12) | Not built (TARGET) | Neither | It inflates the missing-field count and hides the listing from category answers. · Once D-12 ships: "Move these N listings to the right Amazon category." Estimate line 6 is already reserved for it. |
| AI Readiness · Brand-Site Specs | Page found, completeness, machine-readable specs | Spec read | Both, inside the one brand-pages row, only when below Good | — |
| AI Readiness · Amazon A+ Matrix | A+ content share | `canvas_listing_content` | Both (brand-pages factor); PR 239 adds the A+ dollar | — |
| AI Readiness · Amazon A+ Matrix | Five bullets filled; product video | `canvas_listing_content` (Keepa) | Neither | Bullets are the text assistants quote most often from a listing. Video only counts where confirmed, because "none reported" is unknown. · "Fill all five bullets on these N listings." Video stays off until absence can be confirmed. |
| AI Search · Run Summary / Engine Comparison | Unbranded Discovery win rate; weakest engine | AI runs | Both (finding + focus) | — |
| AI Search · Run Summary / Battlecards | Branded Consideration: whether assistants recommend the brand when asked about it by name | AI runs | Neither | A shopper who already names the brand can still be steered to a rival. · "In N of M branded answers on {engine} the assistant recommends a rival. Answer that comparison on {brand site}." |
| AI Search · Product Fact Checks | Contradictions of verified facts | Fact-check probes | Both (signal) | — |
| AI Search · Product Fact Checks | Products with no verified fact, so they are never checked | Fact-check probes | Neither | Wrong specs on unchecked products go unseen. · "Confirm the official facts for these N products so IntoFocus can check them." This is an onboarding input. |
| AI Search · Citation Ecosystem | Sites cited at 10% or more in 2 of 3 runs | AI runs + site-type table | Both (source actions) | Covered only for large sites. Ledlenser's top sites sit near 10% (1Lumen 10%, CleverHiker 9%), so it gets few source actions and its days 61 to 90 are thin (S-05: 1 item). |
| AI Search · Citation Ecosystem | Owned answers (E1): share of unbranded answers citing a brand page, target 15% | Citation read | Neither as its own item; indirectly through the brand-site wording row | This is 30 of AI Actuation's 100 points. · "{brand} pages are cited in X% of unbranded answers (target 15%). Start with the questions where {brand} is named but not cited." |
| AI Search · Citation Ecosystem | Sites with unsure or Unclassified type (A-11) | Classifier | Neither | IntoFocus's own work: an Unclassified site gets no action until staff classify it. Staff queue, not client. |
| Competitive Radar · Category Battlecards | Rival-led categories | AI runs | Both (signal) | Tied categories are not on the list. · Tied: "{rival} ties {brand} in {category}. Add comparison content before it pulls ahead." Watch tier. |
| Competitive Radar · Competitor Wins | Competitor-led answers and why (C-04) | AI runs | Partly, through the rival-category signal | — |
| Summary · Performance | AI Foundation, AI Commerce, AI Consensus vs target 70; weekly score history | Score snapshots | Neither directly | Nothing on the list says which component moved a score down. · "AI Commerce fell X points since {date}, mostly from {component}." Triggered by a drop of 5 points or more week over week. |
| Summary · Performance / Citation Ecosystem | **AI Actuation** (P1, P2, E1, E2, E3) | `actuation_basis`, staff records | **Neither** | See section 2. It is 20% of AI Consensus, and the brand can only raise it through work it is never asked to do. |
| Listing tables | Review count and rating | `reviews_count` is never written (unread) | Neither, **not collected** | Ratings shape which product an assistant picks. · Blocked until a job writes review counts. |
| Action Items · Revenue Estimates / Summary · Opportunity | Dollar estimates | `lib/estimates` | Rows get dollars in PR 239. AI lines (8 to 11, including Actuation) wait for chunk E5 | — |

## 2. AI Actuation

**What it counts today** (`lib/fender-canvas/actuation-score.ts`, decisions 77, 78, 96 to 98). There are 100 points:

| Factor | Points | Basis |
|---|---|---|
| P1 Community response program | 20 | Recorded by staff with an owner, target communities, responses per 30 days, an evidence link and a verification date. Counts for 90 days from verification. |
| P2 Publication and reviewer outreach program | 20 | Recorded by staff with an owner, target publications, placements per 90 days, an evidence link and a verification date. Counts for 90 days. |
| E1 Owned answers | 30 | Measured. The share of unbranded shopping answers that cite a brand page, scaled to a 15% target. |
| E2 Community responses posted | 15 | Links verified by staff over the last 90 days, against the P1 cadence × 3. Scores 0 with no P1. |
| E3 Placements earned | 15 | Links verified by staff over the last 90 days, against the P2 target. Scores 0 with no P2. |

The client sees the score and the counts and dates behind it. Only staff can record anything. Reminders go to #operations at 30, 14 and 3 days before expiry. Two things are still open: staff sign-in (Brian Watson) and the webhook secret (Marc).

**How a brand raises it.** Without P1 and P2 recorded, the most a brand can score is 30 (E1 only), because E2 and E3 have no target. Confirming both programs is worth up to 40 points at once. Posting at the agreed cadence adds up to 30 more. Each program expires after 90 days unless it is verified again.

**Gap.** Action Items and the Roadmap never mention any of this. The nearest items are the community and publication source actions ("Set a plan to keep presence accurate", "PR and review outreach…"). They are tied to single sites, appear only for sites over the 10% threshold, and a Done on them does not reach Actuation. Decision 21i says a Done PR or community action should count toward Actuation in principle, built after launch.

**Proposed items.** They are recurring by design. Each is driven by the stored Actuation basis, so it appears and clears on its own.

| Trigger (stored) | Action line (draft for Brian's wording) | Phase |
|---|---|---|
| P1 not in place | "Confirm your community response program to IntoFocus: who owns it, which communities, and how many responses every 30 days. Suggested communities: {community sites from Citation Ecosystem}." | Days 1 to 30 (confirmation is quick and worth 20 points) |
| P2 not in place | "Confirm your PR and reviewer outreach program to IntoFocus: who owns it, the target publications, and placements every 90 days. Suggested: {publication sites cited most}." | Days 1 to 30 |
| P1 in place, E2 under target | "{n} of {target} community responses verified in the last 90 days. Send IntoFocus the links to responses posted on {target communities}." | Days 61 to 90, rolling |
| P2 in place, E3 under target | "{n} of {target} placements verified in the last 90 days. Send IntoFocus links to new coverage in {target publications}." | Days 61 to 90, rolling |
| P1 or P2 expires within 30 days | "Your {program} verification ends {date}. Send IntoFocus current evidence to keep its 20 points." | Phase that holds the expiry date |
| E1 under 15% | "{brand} pages are cited in X% of unbranded answers (target 15%)." This joins the brand-site wording row instead of adding a duplicate. | Days 31 to 60 |

**What IntoFocus needs to collect or record to verify it:**

- **Program confirmation (P1, P2):** owner name, target domains, cadence or target count, an evidence link (a written plan, brief or agency scope, or the brand's account on the community), and the date staff verified it. This already fits `actuation_programs`. The step that is missing is how a brand tells IntoFocus.
  - Simplest: an onboarding question, then staff record it.
  - Later: the N-07 "Need help?" conversation request (TARGET) could carry "I have a program to confirm".
  - Do not add a client-editable toggle. Points require staff verification (decision 78).
- **Activity evidence (E2, E3):** for each item, the URL, the domain, the date posted and the date staff verified it. This already fits `actuation_items`. Optional later: link a Done on a community or publication source action to an E2 or E3 record (21i). That needs an additive column, which Brian Magazu must approve before it is applied.
- **Blocked:** staff sign-in to the records page (Brian Watson). Until then nothing can be recorded in production, and every client reads P1 and P2 "Not in place".

**Parked.** This proposes plan rows and verification only. It does not design DIY, Done-with-You or Done-for-You workflows, or who performs the activity (AGENTS.md; N-06 LATER). The Actuation dollar line (estimate line 11) waits for chunk E5.

## 3. Durability: what refills and what runs dry

**Refills on its own** (re-evaluated on every published run or retail read):

- AI focus items: the weakest engine, the 5 weakest questions, and moving sites. Watch lines appear whenever there are enough answers, so days 61 to 90 never empty while runs continue.
- Source actions, rival-led categories and fact-check contradictions. These come and go with each run.
- Buy Box withheld, MAP below floor and out of stock. These come back as new listings, prices and stock change.
- Missing specs. This refills as new listings arrive.

**One-off** (once fixed, it stays fixed unless the catalog changes):

- Splintered bundles
- Exact official pages
- A+ content, bullets, machine-readable specs
- Brand-site wording

**Why the lists thin out:**

- On-track findings drop out of the phases, because `phaseItems` keeps only items that need action.
- Done and Set aside remove items (21h).
- Source actions need 10% in 2 of 3 runs, which smaller brands rarely reach.
- The outreach phase depends only on cited publication, community and video sites.

**How to keep them populated without filler:**

1. **Actuation items.** These are the one category with a built-in cycle: 90-day expiry, rolling 90-day counts and a cadence target. They stay on the plan as long as the brand has a program, and that is what Brian Magazu asked for.
2. **Score-movement items.** A drop in a pillar score names the component that moved it.
3. **Cause splits and tiers** on existing findings: price above the benchmark vs other causes; out of stock now vs in the last 12 months; tied categories as Watch.
4. **Lower the bar for outreach suggestions.** Do this inside the Actuation P1 and P2 suggestions, by listing the top cited community and publication sites even under 10%, rather than adding more single-site rows.
5. Keep N-04's empty-state line for the true case.

## 4. Ranked recommendations

| # | Recommendation | FDD rows | Data now vs blocked (owner) | Size |
|---|---|---|---|---|
| 1 | **Actuation items in the plan.** Confirm P1 and P2, post activity against the targets, renew before expiry (section 2). | SC-03, S-02, N-01, S-05; new row (e.g. N-10) | Basis view and score exist now. Recording needs staff sign-in (Brian Watson). Wording needs Brian Magazu. | Medium: one new plan source like `roadmap-signals.ts`, about 150 lines plus tests |
| 2 | **Suggested target lists for P1 and P2** from Citation Ecosystem (community and publication sites, top 5 even under 10%). Shown in the Actuation items and on the staff page. | SC-03, A-10 | Now | Small |
| 3 | **Buy Box withheld split by cause.** Price above Amazon's benchmark vs other causes, with the R-15 price matches when built. | N-01, R-15, R-04 | The cause is stored now (`competitive_offer_suppressed`). Price-match links wait for R-15. | Small (split), Medium (R-15) |
| 4 | **Unauthorized Buy Box holders** as a row. | N-01, SC-02, R-02 | The seller tally is there now. The authorized list must move from browser storage to client settings (onboarding input). | Small to Medium |
| 5 | **Branded Consideration and tied categories** as focus or Watch items. | S-02, C-03, A-xx | Now | Small to Medium |
| 6 | **Score-movement items.** A pillar down 5 or more points week over week names its component. | SC-01, SC-02, SC-04, H-07 | Weekly snapshots exist now. The threshold needs Brian Magazu. | Medium |
| 7 | **Listing content.** Add "five bullets filled" to the brand-pages factors, and add a separate "out of stock now" tier to Out of Stock. | D-06, R-03, R-17, S-02 (21c) | Now. Video waits until absence can be confirmed. | Small |
| 8 | **Feed future checks into the plan as they ship:** D-12 miscategorized listings (estimate line 6), verified facts for unchecked products, review counts. | D-12, A-05, R-03 | Blocked: D-12 build; brand facts at onboarding; no job writes review counts (Brian Watson). | Small each, once the data exists |

Recommendations 1 and 2 answer Brian Magazu's Actuation point directly. They also give days 61 to 90 durable, recurring content for every client, including Ledlenser. Any status change is proposed in the pull request, and Brian Magazu approves it.
