# 8. Catalog Health requirements

Former name: Portfolio Retail / Retail Portfolio. Approved rename: Catalog Health. Overview shows seller type in a small label; Fender is Partner-led.

**R-01 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** Visible name is Catalog Health. Overview shows Seller type: Partner-led.
- **Desired:** Rename to Catalog Health. Overview shows seller type (Fender: Partner-led).
- **User value:** The name matches the work.
- **Acceptance:** No client-visible Portfolio Retail or Retail Portfolio string.
- **Evidence:** Desktop-verified 21 Oct 2026 on local production build commit 1fdbfc0 (PR 43). Published GitHub Pages still serves main cfd45de until that branch deploys. No client-visible Portfolio Retail or Retail Portfolio on that build. How seller models are drawn remains R-02.
- **Open decision:** None.

**R-02 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Seller-model docs exist; drawing not decided.
- **Desired:** Seller-model config drives Controlled Buy Box rules (SC-02). How each type is drawn remains open.
- **User value:** Different Amazon postures read correctly.
- **Acceptance:** Fender shows Partner-led without implying other models are inferior.
- **Evidence:** Worker 24.3, pull request 152 (main ca22e8a): the seller-type label opens a plain definition and the Controlled Buy Box rule for that type.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: the seller-type label (Partner-led or Brand-led) is final for launch; no picture per seller model.

**R-04 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Suppression count/split/freshness/Amazon links live.
- **Desired:** Keep. Use Buy Box language (X-19). Feed SC-02 and R-06.
- **User value:** Operators see withheld offers today.
- **Acceptance:** Full-pass freshness and state split remain visible.
- **Evidence:** Verified Oct 20; Oct 21 API: 62 withheld of 1,076.
- **Open decision:** None.

**R-06 TARGET** · Launch

**Status source:** Explicit meeting (was DECISION). Revenue source order decided by Brian Magazu on 2 Nov 2026.

- **Current:** No defensible suppression dollar on screen. The Out of Stock lost-sales estimate (R-17) is a different figure and is not this 80% model.
- **Desired:** Monthly opportunity = revenue during the most recent 30 unsuppressed days × 80%. Keep this figure off the Out of Stock tab (R-17). The 80% is an IntoFocus assumption and is labeled as one on screen: it assumes about 80% of a suppressed listing’s recent sales come back once the Buy Box returns. Revenue source, per listing: the brand’s reported Amazon sales for a brand-led client when we have them, otherwise SmartScout. A partner-led brand uses SmartScout, because the brand is not the seller. Keepa is not a revenue source. Each dollar is named by its source, and dollars from different sources are never added together. A listing with neither source stays in a separate awaiting-inputs count and is never treated as \$0.
- **User value:** Suppression has a commercial number executives can audit.
- **Acceptance:** 80% labeled as an assumption; each dollar named by its source; sources never summed; awaiting-inputs count visible.
- **Evidence:** Not live. Build deferred on 2 Nov 2026. The same source order is built into the Out of Stock views (R-17, worker 18.6).
- **Open decision:** None. The fallback hierarchy was decided on 2 Nov 2026: brand-reported Amazon sales for a brand-led client, then SmartScout, otherwise awaiting inputs.

**R-15 TARGET** · Launch

**Status source:** Meeting / ADD-23 confirmed TARGET

- **Current:** No assistant for suppressed listings.
- **Desired:** Suppressed-listing assistant searches the product at the benchmark price and links likely external pages, labeled as price matches rather than Amazon-confirmed sources.
- **User value:** Operators get a starting point for the outside price.
- **Acceptance:** Links labeled price matches, not confirmed causes.
- **Evidence:** Not live.
- **Open decision:** None.

**R-05 CURRENT** · Launch

**Status source:** Explicit

- **Current:** No duplicate constant columns. Catalog Governance's splintered-listings table shows the Buy Box holder once, with the third-party seller id under it. Suppressed Listings has no Buy Box or Source column.
- **Desired:** Drop identical columns; tighten table (X-08).
- **User value:** More listings fit.
- **Acceptance:** No duplicate constant columns.
- **Evidence:** Worker 21.4, pull request 121 (main e715570), approved by Brian Magazu on 4 Nov 2026.
- **Open decision:** None.

**R-07 TARGET** · Launch

**Status source:** Explicit

- **Current:** No period toggle on suppression dollars.
- **Desired:** Period toggle after R-06 is live.
- **User value:** Opportunity can be discussed by month.
- **Acceptance:** Toggle uses the same 30-day logic.
- **Evidence:** Blocked on R-06.
- **Open decision:** None.

**R-08 CURRENT** · Launch

**Status source:** Explicit

- **Current:** MAP is explained once, on the lead label. Which listings have a stored MAP price is in the ratio tooltip. The Walmart and Musician's Friend caveats sit behind an asterisk tooltip.
- **Desired:** One clear MAP story; coverage caveat one click away.
- **User value:** MAP is understandable.
- **Acceptance:** Single explainer path.
- **Evidence:** Worker 21.4, pull request 121 (main e715570), approved by Brian Magazu on 4 Nov 2026.
- **Open decision:** None.

**R-09 REFINE** · Launch

**Status source:** Explicit meeting (was DECISION)

- **Current:** MAP shows price gap; no revenue leak formula.
- **Desired:** MAP is exposure: violations, price gap, duration, products, estimated units. Discounted retail value = MAP gap × estimated units and is never called lost revenue. Use suppression model only when a lower external price is credibly tied to suppression. Never count one event as both MAP loss and Buy Box loss.
- **User value:** MAP is commercial without false precision.
- **Acceptance:** No “lost revenue” label on MAP exposure.
- **Evidence:** Worker 24.3, pull request 152 (main ca22e8a), merged 10 Nov 2026: MAP Leakage shows violations as N of M, average gap, SmartScout monthly units, and discounted retail value a month, labeled analyst estimate (Amazon price gap x Amazon unit estimates, Brian, 10 Nov); rows without inputs read Awaiting inputs. Violation duration is BLOCKED on MAP history (Brian Watson).
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: build MAP exposure now: violations as N of M, price gap, estimated monthly units from SmartScout, and discounted retail value (gap times units), labeled analyst estimate and never lost revenue. Violation duration waits for MAP history from Brian Watson.

**R-10 TARGET** · Launch

**Status source:** Explicit

- **Current:** Hard-coded retailer columns.
- **Desired:** Retailer observation rows; client retailer list.
- **User value:** New retailers do not require schema forks.
- **Acceptance:** No new wmt\_\*/mf\_\* prefixes.
- **Evidence:** Verified hard-coded today.
- **Open decision:** None.

**R-11 REFINE** · Launch

**Status source:** Explicit

- **Current:** A Musician’s Friend price with a stored page opens that page. A price with no stored page says Not available\*. Many checks still have no stored URL.
- **Desired:** Store and publish URL when policy allows; else show why not.
- **User value:** Operators can open the checked source.
- **Acceptance:** MF rows either link or explain absence.
- **Evidence:** The screen explains a missing page (Worker 8.6, PR 45, commit 931cc3f). Storing the URL on the check is still open.
- **Open decision:** None.

**R-12 CURRENT** · Launch

**Status source:** Explicit

- **Current:** A MAP listing set aside as Approved exception leaves every MAP figure: the MAP tab, Retail Overview, Summary Briefing, the Catalog Health satellite, and the Minimal slot. The tooltip says how many were excluded. Reopening puts the row back; Done does not remove it.
- **Desired:** Ignore approved promo in MAP exposure.
- **User value:** True violations stay visible.
- **Acceptance:** Approved exceptions excluded from violation counts.
- **Evidence:** Not live. Worker 18.5 (pull request 101, on main) lets a MAP row be set aside with the reason Approved exception and a required note (N-08). Violation counts do not exclude those rows yet. Worker 21.4, pull request 121 (main e715570), approved by Brian Magazu on 4 Nov 2026. Production had no MAP set-asides that day. Worker 24.3, pull request 152 (main ca22e8a): rechecked with the Catalog Health changes; status stays CURRENT.
- **Open decision:** None.

**R-13 CURRENT** · Launch

**Status source:** Explicit

- **Current:** The splintered-bundles figure counts bundles with a live offer (37 of 353 on 4 Nov 2026) everywhere it appears and says so on screen. The tooltip gives the rule, the 451 bundles in the retail read, and the 945 bundles the catalog flags.
- **Desired:** Clearer copy; decide live-offer-only vs all title matches.
- **User value:** Bundle work is actionable.
- **Acceptance:** Screen states which population is shown.
- **Evidence:** Brian Magazu chose live-offer bundles on 4 Nov 2026. Worker 21.4, pull request 121 (main e715570).
- **Open decision:** None. Decided 4 Nov 2026: bundles with a live offer.

**R-03 TARGET** · Launch

**Status source:** Explicit

- **Current:** Amazon listing health incomplete; A+ not measured.
- **Desired:** Amazon listing health with explicit unchecked; other marketplaces DECISION/LATER.
- **User value:** Listing quality is visible.
- **Acceptance:** Unchecked ≠ fail.
- **Evidence:** A+ still Not measured.
- **Open decision:** None.

**R-14 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Catalog Governance's Specs complete figure opens Amazon Specs. Findability points machine-readable page work to Brand-Site Specs. The AI Readiness satellites open Findability, Brand-Site Specs, and Amazon A+ Matrix.
- **Desired:** Clear jump to Amazon Specs / Brand-Site Specs after split (D-07/D-08).
- **User value:** Operators reach the right fix list.
- **Acceptance:** Jump lands on the matching population.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 91, commits b5c44d0 and 482b92d. Published on main at eb1d9a4.
- **Open decision:** None.

**R-16 LATER** · Launch

**Status source:** Explicit meeting

- **Current:** No catalog/MAP admin upload in product.
- **Desired:** Administrator upload: multiple formats, duplicate prevention, approval. Placement DECISION (lean: top of Action Items until loaded and approved).
- **User value:** Clients can correct foundation data.
- **Acceptance:** Duplicates prevented; approval required before publish.
- **Evidence:** Not live.
- **Open decision:** None. Moved to LATER on 9 Nov 2026 by Brian Magazu: publishing an approved file changes live catalog data, which Brian Watson applies.

**R-17 CURRENT** · Launch

**Status source:** Explicit

**Current**

Catalog Health has an Out of Stock tab after Catalog Governance. It lists each live Amazon listing that was out of stock or without a Buy Box on at least one day in the last 12 months. Out of stock means no seller had a new unit for sale on Amazon that day. No Buy Box means a new unit was for sale and the Buy Box was empty. Those day counts are Keepa. Estimated lost sales is an analyst estimate. It takes SmartScout revenue, divides by the Keepa days the listing was in stock, and multiplies by the out-of-stock days. The rate uses 12-month revenue when at least 30 of those days were in stock. Otherwise it uses revenue from the last 30 days when at least 7 of those days were in stock. A listing without that rate reads Not estimated, never \$0. No Buy Box days have a separate upper bound, because sales can still happen without a Buy Box, and that bound is not added to the estimate. A row opens the inputs, the dated stretches, a link to the Keepa chart, and a link to the Amazon listing. The tab and the panel title are marked New. The reading shows that a listing ran out. It does not show whether Fender or a dealer was the one who ran out. The tab opens on the summed estimated lost sales beside what an out-of-stock day costs. The Estimate pill tooltip holds how many listings are in the sum, how many read Not estimated, and the rate rule above. Worker 18.3, pull request 90, commits 7eecc0c and 295bcc0, published on main at 86a5d91.

**Desired**

For each listing, sales per in-stock day × out-of-stock days, shown for the last 30 days, the last 90 days, and the last 12 months. Each window is also the estimate for the next period of the same length if the sales rate and the out-of-stock pattern hold. No 80% and no separate projection. Include listings with no active offer and tag them No active offer. The sales source follows the R-06 order: the brand’s reported Amazon sales for a brand-led client, otherwise SmartScout. Each total is named by its source, and totals from different sources are never added together. A listing with neither reads Awaiting inputs with a reason and is never \$0. Drop the no-Buy-Box dollar and keep no-Buy-Box days as a reference column. Keepa sales-rank drops are an activity signal, not dollars. Keep this figure separate from the R-06 suppression opportunity.

**User value**

Operators can see which listings ran out, for how many days, and a sniff-testable estimate of the sales those days represent.

**Acceptance**

Every column names Keepa, SmartScout, or Estimate. Totals are shown per sales source. A listing without a source reads Awaiting inputs with its reason. Opening a row shows the inputs and the math for all three windows.

**Evidence**

On main at commit 95ed0de (28 Oct 2026), recorded in documentation version 15.3 at Brian Magazu's request. The screen reads public.canvas_listing_sales_loss and public.canvas_listing_stock_episodes. Those views refresh hourly from Keepa daily history and the latest SmartScout snapshot. This closeout read the shipped code. It was not a separate preview.

Worker 18.6, pull request 100 (commit 4f7e346), builds the Desired reading on new views and was merged to main on 3 Nov 2026 (merge 799bc1b). On 2 Nov 2026 data it shows \$1.234M over 12 months from SmartScout, \$198.5K over 90 days, and \$57.7K over 30 days. 243 of 578 affected listings are estimated and 335 are awaiting inputs. 43 of 116 listings with no active offer are now estimated. SmartScout returned none of the other 51 when looked up one by one, so they stay awaiting inputs. Worker 24.3, pull request 152 (main ca22e8a): rechecked with the Catalog Health changes; status stays CURRENT.

**Open decision**

None.

**R-18 CURRENT** · Launch

**Status source: Explicit**

**Current**

When seller type is Partner-led, Retail Overview has an Authorized sellers bubble. It starts closed. Closed, the label and the chevron sit together. Open, the user marks sellers already in the Buy Box read. Amazon Retail always counts and is not a checkbox. Until this browser saves, Controlled Buy Box uses the placeholder Amazon Retail, Austin Bazaar, and GearTree, and the screen marks that list as a placeholder. After a save, the placeholder mark comes off and Controlled Buy Box counts Amazon Retail plus the saved sellers. A save with no partners checked counts Amazon Retail only. The list is kept in this browser. Another browser keeps the placeholder until someone saves there.

**Desired**

When the brand is Partner-led, the user decides which sellers are authorized and thus controllable. Those sellers, together with Amazon Retail, count toward Controlled Buy Box. Other seller types keep the seller-type rule already in SC-02. A later per-client list in the database (R-19) takes precedence over this browser list. Until that list is stored, this control is the list.

**User value**

A partner-led brand can say who is allowed to hold the Buy Box.

**Acceptance**

The control is available only when seller type is Partner-led. The screen names the sellers the user has marked authorized. Until the user saves a list, the placeholder stays marked as a placeholder.

**Evidence**

Live. Brian Magazu approved worker 19.4 on 3 Nov 2026. Pull request 99, commits 957f768, 0a413cb, and 13d021f, main aa6f29c.

**Open decision**

None.

**R-19 TARGET** · Launch

**Status source: Explicit**

**Current**

No per-client authorized-seller list is stored in the database. Controlled Buy Box uses the R-18 placeholder, or the list saved in that browser.

**Desired**

Each client can have an authorized-seller list loaded into the database. When that list is stored, it is the list that counts, and the per-user browser checkboxes do not override it. When no database list is stored, R-18 applies: the placeholder until that user saves, then the list saved in that browser. A sales presentation can proceed before the client's list is known.

**User value**

A real client is scored on the sellers they named. A first showing still works without that list.

**Acceptance**

A stored client list replaces the browser list for Controlled Buy Box. With no stored list, the browser control and the placeholder behave as R-18.

**Evidence**

Not live. Brian Magazu asked for this on 2 Nov 2026. Worker 19.4 builds only the browser control.

**Open decision**

None. Decided by Brian Magazu on 9 Nov 2026: wait for the first real Partner-led client, with X-16. Who loads the list and its file format are decided then.
