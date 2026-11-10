# 12. Action Items requirements

**N-01 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Urgent Interventions opens on Fixes in priority order: a full-width list of the current findings, each as N of M with a status word and color, its action, and a link to its evidence. The priority rule is in the title's tooltip. Dollar recovery per item is a later pass and appears only where the dashboard already computes an analyst estimate.
- **Desired:** Each Urgent Interventions item is one current finding and states the action for that finding. No stale demo.
- **User value:** The queue is the work list.
- **Acceptance:** Every item traces to a current finding id.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 84, commits 6d87cee and a189b3f. Published on main at d91bffa. Worker 21.5, pull request 122 (main 9e83004), approved by Brian Magazu on 4 Nov 2026.
- **Open decision:** None.

**N-07 TARGET** · Launch

**Status source:** Explicit meeting (replaces DIY/DWY/DFY)

- **Current:** Local owner chips on Priorities; no tier system.
- **Desired:** Done-Together replaces Done-for-You and Done-with-You. Brand inputs always required. Ownership is contractual. Each action has “Need help?” requesting a conversation. No in-product assignment toggle.
- **User value:** Help is available without fake ownership switches.
- **Acceptance:** Need help? opens a conversation request; no DIY/DWY/DFY toggles.
- **Evidence:** Not live.
- **Open decision:** None.

**N-02 CURRENT** · Launch aid only

**Status source:** Explicit

- **Current:** Local owner chips on Priorities.
- **Desired:** May remain as a local aid until N-07 ships; not a system of record.
- **User value:** Pilot triage still works.
- **Acceptance:** Chips do not claim contractual ownership.
- **Evidence:** Verified Oct 20.
- **Open decision:** None.

**N-08 CURRENT** · Launch

**Status source:** Meeting / ADD-15. Set-aside direction from the 2 Nov 2026 meeting. Done kept as its own status by Brian Watson on 3 Nov 2026.

- **Current:** Priorities and six checks have Done and Set aside, stored per client with an audit row (worker 18.5).
- **Desired:** Done and Set aside are separate statuses. Done means the issue was fixed or handled. It needs the person’s name, and a note on what was done is optional. Set aside means come back to review it later, or leave it on purpose for a stated reason. It needs a reason from an editable list, starting with Come back to review, and the person’s name. Both record the date and apply to one check on one item: a priority, an Amazon listing, or a fender.com page. Neither clears a listing on every check. Both are stored per client and written to the audit log. Reopen updates the same record. Each check lists its done, set-aside, and reopened items. Until login ships, the person types a name that the browser remembers. Done and set-aside rows stay in the counts and are marked. The same record holds R-12 approved MAP exceptions.
- **User value:** Reviewed work is auditable and shared across viewers.
- **Acceptance:** No Done without a name, and no set-aside without a reason and a name. Reopen changes the same record. Every Done, set-aside, and reopen is in the audit log.
- **Evidence:** Worker 18.5, pull request 101 (commits 48ef87e, 80afb62, and 7bad907), merged to main on 3 Nov 2026 (merge a4560fe). Done was added beside Set aside in 7bad907. Built on Priorities, Amazon Specs, Brand-Site Specs, Listing Content, Suppressed Listings, and MAP. Out of Stock is registered and not yet wired.
- **Open decision:** The reason list is a placeholder: Discontinued, No better category exists, Approved exception, Not sold on this channel, Fix already in progress, and Other. Approved exception and Other need a note. It is edited as data, not code.

**N-03 LATER** · Launch

**Status source:** Explicit

- **Current:** No per-item recovery dollar with editable assumptions.
- **Desired:** Per-item dollars only after approved formulas (R-06/R-09/SC). User-editable assumptions are LATER. Brian approves formulas; anyone may view versions.
- **User value:** Upside is defensible.
- **Acceptance:** No client-editable assumptions in launch.
- **Evidence:** Open for which assumptions later.
- **Open decision:** None. Moved to LATER on 9 Nov 2026 by Brian Magazu: no client-editable assumptions in launch.

**N-04 TARGET** · Launch

**Status source:** Explicit

- **Current:** Authored maintenance list.
- **Desired:** Always a true maintenance item or explicit empty state.
- **User value:** The spoke never looks abandoned.
- **Acceptance:** Empty state copy when no maintenance items.
- **Evidence:** Not live as generator.
- **Open decision:** None.

**N-05 CURRENT** · Launch

**Status source:** Explicit meeting (was DECISION omit)

- **Current:** Action Items tabs are Urgent Interventions and Revenue Estimates. The Current findings tab is removed because it repeated Summary Briefing; old links land on Urgent Interventions. Revenue Estimates opens on its figures, then a table of how the estimates were reached, with Not available\* where a step is not documented. Interactive ROI is gone.
- **Desired:** Action Items tells the client exactly what to fix, in priority order, later with dollar recovery estimates where they apply.
- **User value:** Recent change is visible without a fake model.
- **Acceptance:** No Interactive ROI tab. Current findings shows the five Summary Briefing shares as the current N of M.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 80, commit 457f790. Published on main at b2aa735. Rewritten 4 Nov 2026: worker 21.5, pull request 122 (main 9e83004), approved by Brian Magazu. A chart of how much of the estimated gap has closed since tracking began is LATER.
- **Open decision:** None.

**N-06 LATER** · After launch

**Status source:** Explicit

- **Current:** No gamification layer.
- **Desired:** Gamification and old delegation-tier workflows stay parked. Done-Together is N-07, not a game layer.
- **User value:** Launch stays a briefing.
- **Acceptance:** No points/badges/quotas in launch.
- **Evidence:** Verified absent.
- **Open decision:** None.

**N-09 LATER** · Launch

**Status source:** Meeting

- **Current:** Ask IntoFocus prompt mentioned for Minimal view.
- **Desired:** Include the Ask IntoFocus prompt in Minimal placeholders. Do not invent its capabilities.
- **User value:** Sales has a natural question box without overclaiming.
- **Acceptance:** Prompt present; capabilities list only what is approved.
- **Evidence:** Open.
- **Open decision:** None. Moved to LATER on 9 Nov 2026 by Brian Magazu: no Ask IntoFocus capabilities are approved.
