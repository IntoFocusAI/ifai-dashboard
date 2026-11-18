# Demo readiness: Fender (FMIC), then Ledlenser USA

Worker 29.17 for PM29, 18 Nov 2026. Read-only review of origin/main @ 5db749c (PR #242), built with `next build` and served with `next start` on production data using the publishable key. Playwright Chromium at 1280x720, DPR 1. I visited the map, every bubble (7 main bubbles and 11 satellites), every tab, Priorities, the Minimal view, the deck (14 slides) and the guided tour (7 steps), for both clients.

Screenshots are in `/tmp/claude-0/-home-user-ifai-dashboard/c1d49e9d-b3dd-5986-9c20-7d761ebcfcdb/scratchpad/demo/`. Fender files have no prefix and Ledlenser files start with `ll-`. Tab files are named `a-|b-<bubble>-<n>-<tab>.png`.

Script checks, both clients:
- **Console errors and 500s.** Fender had none. Ledlenser logs a 404 on every load (see L-15).
- **Sideways page scroll.** None at 1280.
- **"Not available*" on headline cards.** None.
- **Stale hard-coded figures** ("+$680K", "$38M", "62M"). None on screen.
- **Figures stuck on Loading.** None after the wait. The slow first loads are listed in item 13.

## Fender: ranked issues

| # | Sev | Where (bubble > tab > what) | Screenshot | Likely file / cause | Fix |
|---|---|---|---|---|---|
| 1 | Blocker | Catalog Health > Out of Stock: two different 12-month lost-sales figures on one tab: **$1,229,366.23*** ("Est. lost sales, 12 months", in cents) and **$541K*** ("Out of stock, per year"). In the deck, slide 13 puts $1,229,366.23 directly under "Phase 1 lift +$1.23M". The two numbers look identical but mean different things. Slide 5 repeats the cents figure. | a-spoke-retail-4-Out_of_Stock.png, deck-13-b4.png, deck-5-s5.png | Out of Stock header (SmartScout raw lost sales) and the R-08 estimate line are both shown. The deck's backstage b4 and s5 pull the raw figure. | M |
| 2 | Blocker | Summary > Briefing and Opportunity: "Buy Box withheld or suppressed: **745 listings**" (estimate covers 683 of 745). Every card, the map, Priorities and the deck say Buy Box withheld = **60 of 1,170**. Same words, a 12x different count. | a-hub-0-Briefing.png, a-hub-2-Opportunity.png | `lib/estimates/availability.ts` (line title "Buy Box withheld or suppressed" counts any listing with at least 1 no-Buy-Box day in 12 months, from Keepa). Briefing "What Fender controls" uses the same title. | S (rename to "Days without a Buy Box, last 12 months") |
| 3 | Blocker | AI Search Visibility > Product Fact Checks (also Priorities #2 "CRITICAL", tour step 3, deck slide 14): the "answer said" quotes start mid-word ("nny feel of…", "r a guitar amp…"). At least 2 of the 4 "contradictions" read as false positives: ChatGPT asks a clarifying question with an emoji, and Grok says "this is the standard Player II". A guitar CMO will spot this. | a-spoke-aeo-2-Product_Fact_Checks.png, deck-14-b5.png, priorities.png | Snippet windowing in the fact-check row and deck b5. The contradiction verdicts need a human pass before the demo. | M |
| 4 | Major | The "do this first" order disagrees across views. Priorities #1 is Buy Box Withheld (60) and #2 is fact contradictions (both Critical). Action Items #1 and deck slide 9 ("in the order the dashboard ranks them") start with exact fender.com pages. Roadmap schedules that #1 item in Days 31 to 60. | priorities.png, b-spoke-fixes-0-Urgent_Interventions.png, deck-9-s9.png, b-spoke-roadmap-0-30_60_90_Days.png | Command-center queue vs action-items ranking vs `lib/fender-canvas/roadmap-plan.ts` phase rules | M |
| 5 | Major | Roadmap > 30-60-90 numbering does not match Action Items. Roadmap "8. fender.com page found" is Action Item #9, and "12. sweetwater" is #13. Action Items #5 (Unbranded Discovery) and #8 (A+ content) are missing from Roadmap. Roadmap shows 29 items and Action Items 30. | b-spoke-roadmap-0-30_60_90_Days.png | `lib/fender-canvas/roadmap-plan.ts` renumbers after filtering | S |
| 6 | Major | Header > Client dropdown lists **Ledlenser** during the Fender demo, and Fender during the Ledlenser demo. That shows one client's name to another. | map-a.png | Client switcher is always shown for guest sessions | S (hide for the meeting, or lock the URL) |
| 7 | Major | Header > **Minimal** toggle shows six empty "ADD METRIC" slots. One stray click ends up on a blank screen. | map-minimal.png | Minimal view has no default metrics | S (default slots, or avoid the toggle) |
| 8 | Major | Competitive Radar > map bubble shows **51.1%** in amber with "Taylor leads Acoustics". That is Taylor's share, but it reads as Fender's score. Action Items #15 and Roadmap show the same Taylor fact as "12.3% 611 of 4,978" next to text saying "611 of 1,196 (51.1%)". | map-a.png, b-spoke-fixes-0-Urgent_Interventions.png | `lib/fender-canvas/nodes-from-live.ts` competitors hero; action-item finding uses the all-category denominator | S |
| 9 | Major | ChatGPT "lowest engine" is **55.3% (596 of 1,077)** in Action Items #19 and Roadmap. Run Summary, Engine Comparison and the map satellite show ChatGPT at **54.9% (643 of 1,172)**. | b-spoke-fixes-0-…, b-spoke-competitors-2-Engine_Comparison.png | Action items read a different run window than the 30-day tabs | S |
| 10 | Major | Owned-page citation rate: Citation Ecosystem shows "134 of 4978 (2.7%)". Performance > Actuation shows "5.0% … (134 of 2,697)". Same 134, two denominators and two rates. | a-spoke-aeo-3-Citation_Ecosystem.png, a-hub-1-Performance.png | Actuation "owned answers" uses only shopping-guidance answers; Citation tab uses all unbranded answers | S |
| 11 | Major | AI Readiness > guided tour step 4 says "**14** missing-field rows are on Amazon Specs". Action Items say **524 of 1,080** listings miss a spec field, and estimates say 519. Amazon Specs headline shows "90.3% … Poor". | tour-4.png, a-spoke-specs-1-Amazon_Specs.png | `lib/fender-canvas/tour-from-live.ts` counts a different row set. 519 vs 524 is estimate coverage vs finding. | S |
| 12 | Major | Active-offer counts differ by view. Briefing: 1,006 active and 164 with no offer. Retail Overview: 944 + 60 = 1,004 with an offer and 166 with none. A+ tab: 1,005 live. A+ action item: "604 of 1,123". | a-hub-0-Briefing.png, a-spoke-retail-0-Retail_Overview.png, a-spoke-specs-3-Amazon_A_Matrix.png | Briefing reads `bb_*` from canvas metrics. Retail reads the Buy Box audit. A+ reads the content table. | M |
| 13 | Major | Load times on a cold open. The map shows "Loading run" on AI Search, Competitive Radar and 5 satellites for about 12 s. Action Items > Urgent Interventions shows Loading for about 20 s on first open. Competitor Wins renders all 1,980 answers (about 360 KB of text) in about 9 s. | a-*, b-spoke-fixes-0-… | AI run read; full answer list rendered eagerly | Prep: open every tab once before the meeting. M to fix. |
| 14 | Major | AI Search Visibility > Run Summary history: every run is tagged "Partial · Mention-based scoring" and many say "Small sample". The Perplexity row shows **1,832 errors** next to 157 of 283. Tour step 3 opens with "Partial run: 767 of 819 calls answered". An exec reads this as "the tool is broken". | a-spoke-aeo-0-Run_Summary.png, tour-3.png | Run-quality labels shown on the client surface | S (move to tooltip) |
| 15 | Major | "Done / Set aside" buttons sit on every table row, and Priorities shows owner chips ("3 on IntoFocus AI / 3 on client team"). Delegation is parked. A click in the meeting writes to the live set-aside log. | priorities.png, a-spoke-retail-*.png | Set-aside controls are always on for guest users | S (hide for guest, or don't click) |
| 16 | Minor | MAP Leakage tab: "$64.2K per year" next to "$4,281.06 a month" (about $51K a year). Text says "Covers 31 of 182 … 151 awaiting inputs" but Estimates say "142 of 151 listings". MAP is Critical (Days 1 to 30) yet is not inside Phase 1 lift. | a-spoke-retail-2-MAP_Leakage.png | Two estimate bases on one tab | S |
| 17 | Minor | Priority vs dollars: Out of stock ($541K, the largest line) is "Recommended". MAP ($64.2K) is "Critical". An exec will ask why. | b-spoke-fixes-0-… | Status rules ignore estimate size | Talking point |
| 18 | Minor | Full Enterprise Potential range is $1.85M to $26.1M (14x spread). | a-hub-2-Opportunity.png | Honest range, but it invites challenge | Talking point |
| 19 | Minor | Missing thousands separators: "4 of 2301" (Fact Checks, Priorities #2, tour 3); "1114 of 1196" (Priorities #5); "2506 answered product fact checks" (Run Summary, Battlecards, Engine Comparison); "134 of 4978", "2885 of 4844", "748 of 3211" (Citation Ecosystem); map hover cards "1110 Not suppressed / 1110 Outside the gap". | priorities.png, hover-spoke-retail.png | Raw template interpolation, not `formatInt` | S |
| 20 | Minor | Priorities #4 ends "This is not a final count." That is a qualifier on screen, which breaks "Let the data speak". | priorities.png | Command-center MAP item copy | S |
| 21 | Minor | Map satellite "Brand-Site Specs **100.0%** Specs missing" reads as a perfect score at a glance. AI Readiness bubble "64.3% Page found" (of 1,080) sits next to Findability "8.5% exact page" (of 1,090): two "page found" rates and two denominators. | hover-spoke-specs.png | Satellite hero choice | S |
| 22 | Minor | High percentages graded Poor: "Amazon attribute completeness 90.3% Poor", "fender.com completeness 87.5% (Poor)". | a-spoke-specs-1-…, b-spoke-fixes-0-… | Thresholds are not shown | S (tooltip) |
| 23 | Minor | Two Buy Box percentages on the map: satellite "Suppressed Listings 4.4% confirmed high-price" and spoke "5.1% Buy Box Withheld". The tab is named "Suppressed Listings" but its headline is "Buy Box Withheld". | hover-spoke-retail.png | Naming | S |
| 24 | Minor | Exec-unfriendly wording: Action Items subtitle "Phase 1 pilot … full-enterprise **GMV**"; Summary subtitle "Overview of Fender's catalog health" (Summary covers more than catalog); "Live retail read."; "at 10% or more in 3 of the last 3 published runs". | b-spoke-fixes-0-…, a-hub-0-Briefing.png | `data/canvas-narrative.json` | S |
| 25 | Minor | Briefing hero is "Monthly potential lost brand revenue $103K", while every other view is annual ($1.23M). The Opportunity cards do not say "a year". | a-hub-0-Briefing.png, a-hub-2-Opportunity.png | Unit switch | S |
| 26 | Minor | Performance: AI Actuation Score is 10/100, driven by IntoFocus programs "Not in place". This can read as a sales pitch. "Scores over time" has a single point (Nov 16). | a-hub-1-Performance.png | Expected for now | Talking point |
| 27 | Minor | Rising/falling citation items (Roadmap 24 to 29) are based on "0 of 105" answers in the prior 30 days. The base is tiny. | b-spoke-roadmap-0-… | Small prior window | S |
| 28 | Minor | Urgent Interventions table scrolls 29 px sideways, so "Open Catalog Governance →" is clipped at the right edge. The map hover card's third card is cut off by the Guided tour button. Time zones mix: "Data as of 5:02 PM" (local) vs "4:41 PM UTC". | b-spoke-fixes-0-…, hover-spoke-retail.png | Table width; hover-card height | S |

## Fender: strongest moments to show

1. **AI Search Visibility > Citation Ecosystem, "Fender-owned pages by question type".** When an unbranded answer cites a Fender page, Fender leads 113 of 134. When it does not, Fender leads 2,885 of 4,844. This is the clearest owned-content-to-AI-win link.
2. **Competitive Radar > Category Battlecards / deck slide 3.** Acoustics is the gap: Taylor leads 611 and Yamaha 466 of 1,196, and Fender leads 82. Action Items #20 to #23 show acoustic questions where Fender leads 0 of 56.
3. **Catalog Health > Suppressed Listings.** 51 of 60 withheld listings are priced above Amazon's own outside price. Example: Custom Shop Clapton Strat at $4,925 vs $1,999.99. This is a direct ecommerce-to-AI path with the listing as evidence.
4. **AI Readiness > Brand-Site Specs + Findability.** 193 of 193 fender.com pages lack a spec block, so one template change fixes all of them. Only 93 of 1,090 Amazon listings have an exact fender.com page.
5. **Summary > Opportunity / Revenue Estimates.** Phase 1 is $1.23M analyst estimate, with each line split into measured vs estimated sales and listing coverage, and each line opens to its inputs. Show this only after item 1 is fixed or avoided.

---

## Ledlenser USA: ranked issues

Issues shared with Fender also apply here: client dropdown (F-6), Minimal view (F-7), Done/Set aside (F-15), Partial-run labels (F-14), Buy Box "withheld or suppressed" 123 listings vs 11 of 204 (F-2), and Roadmap numbering (F-5: Roadmap "8." = Action Item #9; #4 and #8 missing).

| # | Sev | Where (bubble > tab > what) | Screenshot | Likely file / cause | Fix |
|---|---|---|---|---|---|
| L-1 | Blocker | All AI Readiness tabs, Action Items, deck slide 8, tour step 4: the brand site is called **"ledlenser.com"** but every page found is **ledlenserusa.com**. To Ledlenser USA's owners, ledlenser.com is the German parent's site. | ll-a-spoke-specs-2-Brand_Site_Specs.png, ll-deck-8-s8.png | `data/clients/ledlenser.json` `brand_site_label: "ledlenser.com"` | S |
| L-2 | Major | Summary > Briefing: "Amazon holds the Buy Box on 0 of 122. A **third-party seller** holds it on 111 of 122 (91%)", directly under "Brand-led: Ledlenser's own seller accounts are meant to hold the Buy Box". The brand's own account (A1A8DQ0I1V6KE5) is counted as third-party, and the owners will object. | ll-a-hub-0-Briefing.png | `lib/fender-canvas/offer-clarity.ts` has no brand-seller split (`bb_3p`) | M |
| L-3 | Major | Listing counts: Briefing shows 122 active + 14 with no offer = 136. Retail Overview shows 204 monitored and 190 checked. Elsewhere: A+ 202 live, out of stock "167 of 216", specs 189 (or 186), Findability 191. That is six denominators for one catalog. | ll-a-hub-0-Briefing.png, ll-a-spoke-retail-0-Retail_Overview.png | Different source tables | M |
| L-4 | Major | Opportunity: MAP Leakage **$79.7K** is larger than Phase 1 Quick-Win **$56.7K** and is not in it. The MAP figure has no asterisk (Fender's has one). Full Enterprise is $2.84M (range $0.40M to $9.93M), 50x Phase 1. Owners will ask what they are buying. | ll-a-hub-2-Opportunity.png | Phase 1 excludes MAP by rule; asterisk rule differs by client | S |
| L-5 | Major | Catalog Health > Out of Stock: **$29,046.29** "12 months" vs **$42.5K** "per year" on the same tab. The deck b4 shows $29,046.29. | ll-a-spoke-retail-4-Out_of_Stock.png, ll-deck-13-b4.png | Same cause as F-1 | M |
| L-6 | Major | Action Items #14 "Gemini names Ledlenser least, 1.6% (2 of 129)". Engine Comparison shows Gemini at 2.4% (4 of 165) and Perplexity lowest at 1.6% (1 of 63). | ll-b-spoke-fixes-0-…, ll-b-spoke-competitors-2-Engine_Comparison.png | Same as F-9 (different run window) | S |
| L-7 | Major | Tour step 4: "17 missing-field rows are on Amazon Specs" vs Action Items "186 of 186 listings missing a spec field". | ll-tour-4.png | `tour-from-live.ts` | S |
| L-8 | Major | AI Search Visibility headline 31.6% mixes API engines (Grok 74.2%, Claude 62.1%) with the consumer apps shoppers use (ChatGPT 5.4%, Gemini 2.4%, Perplexity 1.6%). Owners will ask which number is real. Prep the answer, or default the toggle to "Without API". | ll-b-spoke-competitors-2-Engine_Comparison.png | All-engines default | Talking point / S |
| L-9 | Minor | Catalog Governance and deck slide 7: "Amazon specs complete **0.0%** (0 of 186)" next to Amazon Specs "71.3%". This is correct (beam distance is missing on 186 of 189) but jarring without that line. | ll-a-spoke-retail-3-Catalog_Governance.png, ll-deck-7-s7.png | Copy | S |
| L-10 | Minor | Action Items #2 "Splintered Listings" is Critical for **1 bundle**, ranked above Buy Box, with estimate "Not available*". | ll-b-spoke-fixes-0-… | Status rules | S |
| L-11 | Minor | Fact Checks / Run Details: ChatGPT model shows "Not available*" on every row. Some rows say "NO ANSWER RETURNED". Shopping guidance: "1 of 22 resolved, 224 with no clear leader". | ll-a-spoke-aeo-2-…, ll-a-spoke-aeo-0-… | Model not stored for consumer ChatGPT | S |
| L-12 | Minor | Missing separators on Citation Ecosystem ("8 of 1348", "418 of 1340", "1109", "3443"). | ll-a-spoke-aeo-3-Citation_Ecosystem.png | Same as F-19 | S |
| L-13 | Minor | Brand-Site Specs page names come from URL slugs ("Hf4rcore", "Hf6r Core", "Af2r Work"). | ll-a-spoke-specs-2-… | Title derived from slug | S |
| L-14 | Minor | Competitor Wins "68.4% Fair" and map "Competitive Radar 31.1% Fenix leads Flashlights" are rival shares that read like Ledlenser scores. | ll-map-a.png | Same as F-8 | S |
| L-15 | Minor | The console logs a 404 for `rpc/canvas_ai_history_run_rows` on every Ledlenser load (not seen on Fender). Viewers do not see it. | (console) | `lib/ai-search/history-queries.ts` calls an RPC that is absent in production | S |

## Ledlenser: strongest moments to show

1. **Competitive Radar > Engine Comparison.** In the consumer assistants shoppers use, Ledlenser is named most in 9 of 167 ChatGPT, 4 of 165 Gemini and 1 of 63 Perplexity answers. This is the clearest "you're invisible" moment.
2. **Competitive Radar > Category Battlecards.** Fenix leads Flashlights (141 of 453; Ledlenser 56). Petzl leads Headlamps (141 of 315) and Kids. Ledlenser leads Work lights and Lanterns.
3. **Catalog Health > Suppressed Listings.** Withheld listings include imported/grey-market titles (German "Arbeitsleuchte" AF12R at $612.89 vs $249.99 outside price; "Genuine Japanese Product" H7R). This is a brand-control story with the evidence row.
4. **Catalog Health > MAP Leakage.** 35 of 103 below MAP. MH10 is $79.99 on Amazon and $79.95 on Walmart vs $99.95 MAP, with 121 est. monthly units.
5. **AI Readiness > Findability.** 75 of 191 listings have an exact page, each matched by UPC or SKU with the reason shown. Fix L-1 first so the site name says ledlenserusa.com.

## Pre-meeting checklist (no code)

- Open each client once and click every tab about 2 minutes before presenting, so the AI reads are warm.
- Do not click Minimal, Done or Set aside.
- Do not open the client dropdown.
- Skip Product Fact Checks and deck slide 14 unless F-3 is fixed.
- On Fender, avoid Out of Stock's header and deck slide 13 unless F-1 is fixed.

Cleanup: scratch worktree removed and server stopped. The `.env.local` was only in the removed worktree. Screenshots kept in `scratchpad/demo/`.
