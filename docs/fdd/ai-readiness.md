# 10. AI Readiness requirements

**D-01 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Findability does not say JSON-LD or older spec read. The five outcome tooltips use the approved sentences. The visible labels are unchanged. The Schema.org pointer stays.
- **Desired:** Plain client copy; Findability stays separate from specs tabs.
- **User value:** Operators understand official-page outcomes.
- **Acceptance:** No “older spec read” / JSON-LD in Findability headlines.
- **Evidence:** Workers 12.4 and 12.6 removed the header count paragraph. The JSON-LD and older-spec note is gone from Findability. Worker 17.3, pull request 82, commit 429ed30, published on main at 4cb03ee, set the five outcome tooltips. Approved by Brian Magazu on 29 Oct 2026.
- **Open decision:** None.

**D-07 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** Amazon Specs shows Amazon attribute completeness, the missing Amazon fields, and the per-listing table. No brand-site percentage is on this tab. The completeness hero and Top missing Amazon fields share one row. The hero shows the average percent and filled fields over expected fields. The pie sits beside the figures. The fields box is the wider one. Missing-field rows are a share of the checked listings.
- **Desired:** Amazon Specs: Amazon attribute completeness, missing Amazon fields, per-listing table.
- **User value:** Amazon gaps are actionable.
- **Acceptance:** No brand-site percentage appears on Amazon Specs.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 91, commits b5c44d0 and 482b92d. Published on main at eb1d9a4.
- **Open decision:** None.

**D-08 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** Brand-Site Specs shows found fender.com pages and leads with how many are missing machine-readable specs. additionalProperty stays in the evidence, not the headline. No Amazon percentage is on this tab. The hero cards and the explainer share one top band. fender.com page found sits beside those heroes with N of M checked SKUs (644 of 1,036 on 3 Nov 2026) and an evidence table: found rows link to the fender.com page, and not-found rows show the Findability result as the reason. The AI Readiness bubble opens that table. Not-found reasons are plain-language groups chosen from one dropdown (Reason: All reasons, with counts), mapped from the fender.com product check's stored codes; the pages it tried are never shown as text. A not-found row's Findability result opens that listing's row on the Findability tab. The AI Readiness tooltips use plain client language.
- **Desired:** Brand-Site Specs: found brand pages; lead with count and percentage missing machine-readable specs; name missing specs (e.g. scale length). Keep additionalProperty in evidence, not headlines. Do not send an Amazon percentage to this tab.
- **User value:** Brand-site work is obvious.
- **Acceptance:** Headline uses brand-site denominator only.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 91, commits b5c44d0 and 482b92d. Published on main at eb1d9a4. Page found was added by worker 20.8, pull request 112 (main f048e45), and wired from the bubble by worker 20.2, pull request 114 (main 403b307). On 3 Nov 2026 the spec check re-read 36 SKUs that Findability matched, so found rose from 608 to 644. Worker 21.3, pull request 119 (main 796ebd2), approved by Brian Magazu on 4 Nov 2026.
- **Open decision:** None.

**D-02 TARGET** · Launch

**Status source:** Explicit

- **Current:** Findability not on a cheap recurring schedule in product.
- **Desired:** Weekly low-cost recheck; action lists for no-page / discontinued / unsellable bundle; explain why unmatched. No approved 80% goal.
- **User value:** Official pages improve over time.
- **Acceptance:** Schedule + explanations live; no false goal %.
- **Evidence:** Not live.
- **Open decision:** None.

**D-03 TARGET** · Launch

**Status source:** Explicit

- **Current:** AI Readiness vs Machine Readability naming.
- **Desired:** Superseded in direction by D-07/D-08 split. Residual: final tab labels Brian has not renamed.
- **User value:** Tabs explain themselves.
- **Acceptance:** Final labels approved.
- **Evidence:** Open.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: the X-18 rename list is final; no AI Readiness heading is renamed.

**D-04 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Amazon Specs missing-field rows show N of M and a percent of the checked listings, and the bar matches that share. If the checked total is missing, or the count is larger than that total, the row keeps the count and the share reads Not available\*, with an empty bar. The completeness hero shows the average percent and the share of filled Amazon attribute fields over expected fields. The checked-listing count is in the tooltip. The hero and Top missing Amazon fields sit on one row, the pie sits beside the figures, and the fields box is the wider one. Amazon Specs shows Last checked under its heroes before any box is opened: the newest stored check time among checked listings, in UTC, or Last checked Not available\*.
- **Desired:** Always show denominators (“89 of 989 (9%)”, never “89 pages” readable as 89%). Show last-checked.
- **User value:** Counts are not mistaken for rates.
- **Acceptance:** Every count has an of-total and % where meaningful.
- **Evidence:** Brian Magazu approved the preview on 2 Nov 2026. Pull request 94, commits 2bda570 and 42475c9, published on main at 984739b. Worker 21.3 added Last checked, pull request 119 (main 796ebd2), approved by Brian Magazu on 4 Nov 2026. D-04 is CURRENT.
- **Open decision:** None.

**D-05 TARGET** · Launch

**Status source:** Explicit

- **Current:** additionalProperty cross-category; scoring components.
- **Desired:** Score components now approved in SC-01; additionalProperty stays in evidence. Cross-category required-spec lists still need Brian.
- **User value:** Foundation score stays honest by category.
- **Acceptance:** Category required-spec lists approved.
- **Evidence:** Open for category lists.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: Fender uses the guitar and instrument list; Ledlenser uses the lighting spec fields loaded by Brian Watson. Both stay marked placeholder, and Amazon Specs names the list it used.

**D-06 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Amazon A+ Matrix opens on the content shares. The sales effect of missing A+ content is not estimated.
- **Desired:** Measure A+ as content shares. No dollar figure for now; the lift assumptions are worked out later with the parked dollar formulas.
- **User value:** Content gap the brand controls becomes visible.
- **Acceptance:** A+ leaves “Not measured yet” only until measured.
- **Evidence:** Figure-first layout approved by Brian Magazu on 29 Oct 2026. Pull request 90, commits 7eecc0c and 295bcc0. Published on main at 86a5d91. Closed on the content shares by Brian Magazu on 10 Nov 2026 (decisions 35 and 45).
- **Open decision:** None. Decided by Brian Magazu on 9 and 10 Nov 2026: no A+ dollar figure for now. The lift assumptions (how much more a listing sells with A+) must be defensible and are tracked with the parked dollar formulas.

**D-09 REFINE** · Launch

**Status source:** Explicit

- **Current:** The Unchecked table leads with Reason after ASIN and Listing. The reason is the first stored flag: blocked, timeout, parse failure, or unsupported. Otherwise it is the stored explanation, or Reason not recorded. Official page, HTTP status, Checked, Outcome, Variant SKU, Confidence, and How it was matched are off that table only. Category, Product kind, Explanation, and Dealer bundle stay. The definition says the listing was not checked and should be opened for that reason, and that a blank result is not a missing page. The count is whatever the read returns. It is not generally zero.
- **Desired:** Allow the check cycle time to finish. After that time, Unchecked should generally be zero. A listing that is still unchecked has a reason worth exploring. The Unchecked definition says the listing was not checked and should be opened for that reason. It does not say the current pass is still running. The Unchecked table leads with the stored reason: blocked, timeout, parse failure, unsupported, or the stored explanation. If nothing is stored, the cell says Reason not recorded. Columns that only repeat that the row was not checked are left off this table. The other outcome tables keep their columns.
- **User value:** A remaining unchecked listing is an exception to investigate.
- **Acceptance:** Once the cycle has had its time, Unchecked is generally zero. Each remaining row names a stored reason, or Reason not recorded. The Unchecked table does not fill several columns with not-checked wording.
- **Evidence:** Live, and short of the zero count. Brian Magazu approved worker 19.1 on 3 Nov 2026. Pull request 97, commits b124a27 and 4fa1258, main 716e910.
- **Open decision:** None.

**D-10 CURRENT** · Launch

**Status source:** Explicit

- **Current:** A 10-character Findability ASIN, letters and digits, opens https://www.amazon.com/dp/{asin} in a new tab. Any other value stays plain text. Variant SKU stays the brand variant code and is not a link. The Unchecked table has no Variant SKU column. This is true on every Findability outcome table.
- **Desired:** A 10-character Findability ASIN opens that listing on Amazon at https://www.amazon.com/dp/{asin}. A value that is not a 10-character ASIN stays text.
- **User value:** The operator can open the Amazon listing behind the row.
- **Acceptance:** Each 10-character ASIN in the Findability table is a link to that Amazon page.
- **Evidence:** Live. Brian Magazu approved worker 19.2 on 3 Nov 2026. Pull request 102, commit 8d2518c, main f37a856.
- **Open decision:** None.

**D-11 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Findability opens with the Exact official product page count selected and that listings table on screen. Choosing another outcome replaces that table. One outcome table is visible at a time. An empty Exact outcome stays selected.
- **Desired:** When Findability opens, the Exact official product page table is open. Choosing another outcome shows that outcome's table.
- **User value:** The lead outcome's listings are on screen without a first click.
- **Acceptance:** The first view of Findability includes the Exact official product page listings.
- **Evidence:** Live. Brian Magazu approved worker 19.3 on 3 Nov 2026. Pull request 103, commit 2f163be, main 32f8a47.
- **Open decision:** None.
