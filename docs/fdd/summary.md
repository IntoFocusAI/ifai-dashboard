# 6. Summary (hub) requirements

Former name: Brand Portfolio. Approved rename: Summary.

**H-01 CURRENT** · Launch

**Status source:** Inferred

- **Current:** Hub-and-spoke map is live.
- **Desired:** Keep as the Balanced primary view.
- **User value:** The meeting starts from one picture.
- **Acceptance:** Six bubbles remain reachable in one click.
- **Evidence:** Verified Oct 20; structure confirmed in source Oct 21.
- **Open decision:** None.

**H-06 CURRENT** · Launch

**Status source:** Explicit meeting (was DECISION)

- **Current:** Center node title is Summary. The Fender wordmark sits above that title.
- **Desired:** Rename to Summary.
- **User value:** The room uses one name.
- **Acceptance:** No client-visible Brand Portfolio string.
- **Evidence:** Desktop-verified 21 Oct 2026 on local production build commit 1fdbfc0 (PR 43). Published GitHub Pages still serves main cfd45de until that branch deploys. No client-visible Brand Portfolio on that build.
- **Open decision:** None.

**H-07 REFINE** · Launch

**Status source:** Explicit meeting

- **Current:** Summary tabs are Briefing, Performance, and Opportunity. Performance leads with AI Consensus, then AI Foundation and AI Commerce. AI Actuation reads Not included. Each score is shown against target 70 with a status mark and word, for example "AI Consensus 56* Fair" (worker 25.1, pull request 166). The Briefing's AI figures use the map's population.
- **Desired:** Summary tabs: Briefing, Performance, Opportunity. Briefing = why it matters + AI Consensus Score + one sentence. Performance = actual vs target with AI Foundation, AI Commerce, AI Actuation side by side. Opportunity = value achieved, near-term upside, full potential with drill-downs to inputs/assumptions/formulas.
- **User value:** Executives get story, scores, and upside without hunting.
- **Acceptance:** Three tabs only under Summary; Commercial Sizing label gone.
- **Evidence:** Score layout approved by Brian Magazu on 29 Oct 2026. Pull request 92, commits 7bf55cf and b5c6ce2. Published on main at 65e2c79. Tab labels were desktop-verified on 21 Oct 2026, commit 1fdbfc0. A target comparison and AI Actuation remain open, so this stays REFINE.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: each score is shown against a target of 70, for example 41 vs target 70. H-07 stays REFINE until AI Actuation (SC-03) exists.

**H-05 CURRENT** · Launch

**Status source:** Explicit meeting (was DECISION)

- **Current:** The third Summary tab is Opportunity. Dollar figures remain labeled analyst estimates.
- **Desired:** Rename unclear heading Commercial Sizing → Opportunity. Keep estimate labels until formula trails exist. Score/opportunity frameworks below are TARGET.
- **User value:** Upside is named clearly.
- **Acceptance:** No client string says Commercial Sizing.
- **Evidence:** Desktop-verified 21 Oct 2026 on local production build commit 1fdbfc0 (PR 43). Published GitHub Pages still serves main cfd45de until that branch deploys. Commercial Sizing is not a tab title. Score frameworks in section 7 stay TARGET.
- **Open decision:** None.

**H-02 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Main bubbles have no hover text. The visible result carries the meaning.
- **Desired:** Purpose-first tooltips until X-23 removes main-bubble hover text; then visible results carry the meaning.
- **User value:** Tooltips teach the area.
- **Acceptance:** No duplicated headline stats in hover once X-23 ships.
- **Evidence:** Acceptance met when X-23 shipped. Approved 26 Oct 2026, PR 46.
- **Open decision:** None.

**H-03 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Summary Briefing opens with one row of equal bubbles. AI Consensus is first and shows the live score. The result sentence is the tooltip on that title. With a score it reads AI Consensus is {score}, from {n} of {m} pillars. When the score is missing it reads AI Consensus is not available. The other finding explainers are tooltips on those titles. Buy Box stays the word on the bubble. The division table stays on Performance. H-07 stays REFINE.
- **Desired:** Briefing follows H-07; Buy Box language per X-19.
- **User value:** Briefing is short and current.
- **Acceptance:** One Consensus sentence + score when SC-04 is live.
- **Evidence:** Live. Brian Magazu approved worker 19.5 on 3 Nov 2026. Pull request 98, commits a95dfa8 and fcfe6ad, main 9b8fdc4. The consensus sentence is the tooltip on the AI Consensus title, and the score is the figure in that bubble.
- **Open decision:** None.

**H-04 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Each division row shows bundle listings and the Buy Box share as N of M, with one next-step link. Schema Sync, the n/a threat column, and the division-count badge are gone. Rows are not clickable; only the link is.
- **Desired:** Performance visuals replace unclear matrices; rows obey X-28.
- **User value:** Leadership can sniff-test the catalog story.
- **Acceptance:** Division figures have clear populations and actions.
- **Evidence:** Worker 21.4, pull request 121 (main e715570), approved by Brian Magazu on 4 Nov 2026.
- **Open decision:** None.

**H-08 CURRENT** · Launch

**Status source:** Addendum ADD-14 inferred

- **Current:** Guided-tour Client Value and Executive Intelligence boxes exist. Each bullet is one line built from live figures, and the card sits on the side that keeps the lit bubble clear.
- **Desired:** Keep, shortened to short bullets.
- **User value:** Sales can explain why each bubble matters.
- **Acceptance:** Boxes remain and stay brief.
- **Evidence:** Verified Oct 20 pattern. Worker 21.1, pull request 127 (main d6f502f), approved by Brian Magazu on 4 Nov 2026: the card never covers its lit area at 1280x720, 1440x900, or 1920x1080, and no card scrolls.
- **Open decision:** None.

# 7. Score model (approved design; TARGET until live)

These are approved design formulas. AI Foundation, AI Commerce, and AI Consensus are 🟢 CURRENT. AI Actuation stays 🔵 TARGET until owner, evidence, and dates exist. Brian Magazu approves every later weight change. Each component is 0–100 against its target. Insufficient coverage drops out and remaining weights rescale. Coverage appears beside the score. Missing data is never a zero. On screen, a score under 40 is red, 40 through 70 is amber, and above 70 is green. Higher is better.

**SC-01 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** AI Foundation is on Summary → Performance. Exact official pages, machine-readable brand-site specs, required marketplace specs, and unbranded answers that name the brand are included when the read has them. Fact checks are included only where a verified fact exists. The required marketplace spec list is a guitar and instrument placeholder, marked on screen. A missing component is omitted and the remaining weights rescale. It is never shown as zero.
- **Desired:** AI Foundation (same for every seller type): Exact pages among active in-scope products 25%; machine-readable brand-site specs among found pages 25%; required marketplace specs filled 20%; resolved unbranded answers naming the brand 20%; fact checks matching a verified fact 10% only where a verified fact exists. Required specs are category-specific. Show on AI Readiness and Summary → Performance.
- **User value:** Foundation readiness is one number with coverage.
- **Acceptance:** Coverage shown; missing components omitted and weights rescaled.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 92, commits 7bf55cf and b5c6ce2. Published on main at 65e2c79.
- **Open decision:** None.

**SC-02 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** AI Commerce is on Summary → Performance and on Catalog Health → Retail Overview. Controlled Buy Box, not suppressed, not splintered, and no current MAP violation are included when the read has them. Active products available is omitted because that share is not stored, and it is not shown as zero. For this Partner-led pilot, controlled means Amazon Retail or a named authorized partner. The authorized names on screen are a placeholder: Amazon Retail, Austin Bazaar, and GearTree. MAP contributes exposure, not lost revenue.
- **Desired:** AI Commerce: Controlled Buy Box 35%; Not suppressed 25%; Active products available 15%; Not splintered 15%; No current MAP violation 10%. Controlled means by seller type (Partner-led: Amazon Retail or authorized partner; Brand-led: brand seller; Amazon Retail only: Amazon Retail; Hybrid: assigned seller). No managed Amazon presence: omit Controlled component and show risk rather than failure. Brand Registry only with evidence. MAP contributes exposure, not lost revenue. Show on Catalog Health and Summary → Performance.
- **User value:** Ecommerce control is one number with coverage.
- **Acceptance:** Seller-type rules applied; MAP not treated as lost revenue.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 92, commits 7bf55cf and b5c6ce2. Published on main at 65e2c79. Who counts as an authorized partner when the brand is Partner-led is R-18 TARGET. Worker 24.3, pull request 152 (main ca22e8a): the seller-type label opens a plain definition and the Controlled Buy Box rule (R-02).
- **Open decision:** None.

**SC-03 TARGET** · Launch

**Status source:** Explicit meeting

- **Current:** AI Actuation is on Summary → Performance as Not included. The reason on screen is that there is no owner, evidence, or dated record yet. It is not scored as zero, and its weight is left out of AI Consensus.
- **Desired:** AI Actuation: Active response program for cited social/community sources 50%; active outreach to publications/influencers cited for the brand’s questions 50%. Points require owner, evidence, verification date, and unexpired date. IntoFocus sees record controls; client sees score and basis. Show on Citation Ecosystem and Summary → Performance.
- **User value:** Actuation is evidenced work, not vibes.
- **Acceptance:** No points without owner + evidence + dates.
- **Evidence:** Not live.
- **Open decision:** None.

**SC-04 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** AI Consensus is the lead figure on Summary → Performance. It combines AI Foundation and AI Commerce. AI Actuation is not included, and the remaining weights rescale. Coverage shows how many of the three pillars are in the number. A score under 40 is red, 40 through 70 is amber, and above 70 is green.
- **Desired:** AI Consensus = Foundation 40% + Commerce 40% + Actuation 20%, weighted by coverage. With no managed Amazon presence, split Commerce’s weight evenly between the other two. Bubble hover may include its relevant score.
- **User value:** One Consensus Truth number for the room.
- **Acceptance:** Coverage displayed; seller-type weight split respected.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 92, commits 7bf55cf and b5c6ce2. Published on main at 65e2c79.
- **Open decision:** None.

*Whether seller type itself should change a score is LATER. Until validated, score performance against the assigned model rather than ranking models as inherently superior.*
