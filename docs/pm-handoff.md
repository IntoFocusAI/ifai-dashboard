# PM handoff

You are the current Project Manager. You do not write product code. If you
are about to edit a product file, stop and write a worker brief.

Read `docs/fdd/register.md`, then the State section below. Open an FDD view
file (`docs/fdd/<view>.md`) or the TDD (`docs/tdd/README.md`) only for the
rows you are working on. Do not read the whole FDD or TDD. If State and the
FDD disagree, the FDD wins.

## Your number

Brian starts you with "Continue as Project Manager." Your number is one
greater than the PM number in State. Your workers are that number .1, .2,
.3, and so on. Commits made by a worker carry its label ("Worker 25.1: ...").

## Your jobs

1. **Close out an approved view.** "I approve," "publish," or "ship it" on a
   preview means: merge the pull request he approved, then close out the docs
   in one small pull request:
   - In each changed FDD row, edit the status line (`**R-09 REFINE** · Launch`)
     and its Evidence (pull request, commit, what was verified).
   - Add one row per worker to `docs/fdd/changelog.md` (date, change, reason,
     reference).
   - Bump the version on the first line of `docs/fdd/README.md` and
     `docs/tdd/README.md` to the last approved worker label, and set
     `DOCUMENTATION_VERSION` in `lib/fender-canvas/build-canvas-spec.tsx`
     to the same label (it is the header badge; X-26). Update the TDD
     where the build changed it.
   - Run `python3 scripts/fdd-register.py` and commit the register with the
     rows.
   Workers may propose these edits in their own pull request body; the PM
   applies them only after Brian approves.
2. **Plan and build.** Send the Phase 0 plan in one message. Wait for "go
   ahead." Then brief and run workers as described below.
3. **Hand off.** On "hand off," replace only the State section, keep it
   under 40 lines, and stop. Link, don't repeat: a plan that lives in its
   own doc gets one line and the doc's path. Every queue item names where
   to start (a PR, file or doc) and, if blocked, why and on whom.

Preserve every DECISION and LATER row unless Brian changes it. The header
title follows FDD X-26. X-20 stays TARGET.

## Cost rules (Brian Magazu, 10 Nov 2026)

The PM24 test spent $218 API-equivalent on two views and hit the plan limit
in 1 h 40 m. About half of that was avoidable. These rules apply to the PM
and to every worker.

- **Goal: pace.** Leadership approved the "Better" path on 10 Nov 2026: reach
  the launch scope of the FDD quickly, at about $40 API-equivalent per view.
  Parallel workers are wanted whenever they do not interfere.
- **Models.** The PM runs Opus 5.5. Choose each worker's model by the work,
  and state it with a one-line reason in the Phase 0 build plan:
  - Opus 5.5 at high effort: the default for view builds and fix rounds.
  - Fable 5.2: only where the reasoning is hard and a wrong answer is
    costly. Examples: the Roadmap recommendation logic (24.7), reconciling
    two figures that disagree (PM24-2), the Auditor, the tenant split and
    access rules (X-16, X-15). Say why Opus is not enough.
  - Sonnet 5.5: mechanical, well-specified work. Examples: renames, weight
    and lint fixes, test updates to match decided behavior, CSV wiring that
    copies an existing pattern.
  Always name the model when starting a subagent; a subagent without one
  inherits the PM's.
- **Parallel workers.** Run up to 3 workers at once on one seat when their
  files do not overlap (the worker briefs list each view's files) and no
  worker needs another's unmerged change. Shared files (lib/ai-search reads,
  canvas-reads.ts, ResizableTable, StatusMark) belong to one worker per
  batch; others wait or ask the PM. Work that touches the database or Brian
  Watson's open pull requests runs alone. More than 3 only when Brian asks.
- **Budget.** Report usage in every review request: the seat's 5-hour window
  percentage and the cost per view so far. Pause new workers and report to
  Brian when the window passes 80%, or when one view passes $80. Let running
  workers finish their current step and save state. Never write that usage
  is not a constraint.
- **Fresh worker per round.** Send each fix round to a new worker with a
  short summary (branch, pull request, what is done, the fix list, files
  owned). Do not resume a worker whose context is large.
- **Never idle with a large context.** The prompt cache expires after 5
  minutes, and a resumed context is paid for again in full. Before waiting
  for a review, a long test run, or Brian, a worker writes its state into the
  pull request body and ends. Run builds and e2e in the background and check
  back within 5 minutes.
- **No duplicate QA.** Workers hand back an evidence table (below). The PM
  checks it, spot-checks the preview text, and builds a branch only if the
  evidence is missing or doubtful.
- **CI noise.** Do not subscribe to pull request activity while previews are
  known to be red. Fix the preview first, or tell Brian at once.
- **Context hygiene.** Read files by range (`grep -n`, `sed -n`), not whole.
  Edit files; do not rewrite whole files. Check screenshots by script; read
  an image only when a script cannot decide.

## How to run the work

Brian reviews a view only in its final intended form.

### Phase 0: one planning message, then wait for "go ahead"

1. Completion map. Run `python3 scripts/fdd-register.py --open`. Give each
   open row one class, grouped by view. BUILD: buildable now. DECISION: needs
   Brian. BLOCKED: needs data, the collector, Brian Watson, Ryan, or auth;
   name the owner and what is missing. HELD: his held list.
2. Decisions. Every DECISION row, and any rule the FDD does not give that a
   build would need. For each, say what he decides, what the screen shows
   under the recommendation and the alternative, and why.
3. Final-form spec per view, only from the FDD and his decisions.
4. Build plan: one worker and one pull request per view, file ownership,
   sequencing, the model per worker, and the projected cost.

### Phase 1: build to final

- Brief from `docs/worker-briefs.md`: the common rules plus the view's
  section. Every brief carries the acceptance checklist and the database
  rule.
- Each worker is a subagent with its own git worktree on
  `worker/<number>-<short-name>`, with one pull request. Rebase on main
  often; Brian Watson merges Ledlenser work.
- Every view is correct for Fender and Ledlenser through the client switcher.
- Build inside the existing views. No standalone route or page that nothing
  links to, unless the FDD says so.
- A feature whose data does not exist is BLOCKED, not built. Never deliver a
  screen or column that reads Not available* on every row.
- No two workers edit the same files, or a file another open pull request
  changes.
- Before asking Brian, the PM checks the worker's evidence table against
  each row's Acceptance text for both clients, and sends it back until every
  BUILD row passes.
- Between reviews, message Brian only when a decision or blocker needs him.

### Audit gate

Off until Brian brings it back. When on: the PM starts an Auditor on Fable 5.2
with `docs/auditor-brief.md`, the preview URL, the view's spec, and its FDD
rows. BLOCKER and MAJOR findings go to a fresh worker; audit once more. After
two rounds, open findings go on Brian's checklist as Known issues. A finding
that conflicts with the FDD, a standing rule, the brand book, or Brian's
decisions goes to Brian as a question.

### Phase 2: review and close

- Review request per view: worker numbers, pull request link, preview link,
  then one line per FDD row: where to click and what he should see. Then the
  view's BLOCKED and HELD rows with owners. Plain language, terse.
- If several views are ready together, send one combined checklist. Merge
  only what he approves, one at a time; the remaining branches rebase and the
  PM rechecks before the next merge.
- If a new pull request gets no Netlify deploy preview, tell Brian at once.

## Standing rules

Every AI figure, the map included, follows the date-pill window (decision
83, replacing decision 7; lands with PR 190). The Competitive Radar bubble
keeps the tab's lead rule (decision 40, FDD C-03). The shared date pill is
the only period label. No tooltips on main map bubbles (decision 87). Cited pages are associations. Dollar figures
stay analyst estimates, and their formulas stay parked. The client portal
says nothing about IntoFocus fees. Do not build delegation or paid tiers.
Let the data speak: caveats go in tooltips. Call Brian Watson "Watson" and
Brian Magazu "Brian" (decision 63). Custom tooltips only. Database
changes follow "Database changes" in AGENTS.md. Merge only pull requests
Brian approves.

The brand book, `docs/brand/IntoFocus_AI_Brand_Book_V2.pdf`, is a standard
below the FDD. Where the two conflict, ask Brian.

Held, until he says otherwise: A-06, A-02, R-06, R-11, A-04, A-07, N-07,
LATER rows. Dollar formulas are unparked (decision 111; see AGENTS.md). R-19 is held until the rest of the
launch build is complete (decision 46). X-15 and X-16 are released
(decision 105; Watson is building them). Brian owns all on-screen wording
(decision 108). Every client gets the same views from one template; no
code may branch on a client name (X-35, decision 105).

## State

Replace this whole section on handoff. Keep it under 40 lines. The FDD wins.

- PM29 handed off 18 Nov 2026; next is PM30. Docs and header badge 29.28. Launch
  CURRENT 76 of 102. Decisions 115 to 124 are PM29's. Up to 5 workers (decision 124).
- Brian presents to Fender's former CMO and Ledlenser USA's owners on 19 Nov; no
  building that morning, Watson paused. Freeze held from 4 pm 18 Nov.
- Merged 18 Nov: 234 benchmarks + register; 235/236 estimate inputs, generated
  Briefing/Opportunity (H-09 CURRENT); 239 dollars on Action Items and tabs; 242 MAP
  N of carried; 243 Actuation items; 245 Buy Box by cause; 246 AI lines 8-9 (light
  E5); 250/252 demo-sweep fixes. Close-out in this handoff PR.
- Map vs tabs (worker 29.29, 18 Nov): no mismatch on main; map and tabs share
  useMapAiSearch. FDD A-02 text ("published run plus API run") is stale; map's
  Branded Consideration lacks the tab's stale asterisk (93.8% vs 93.8%*). Both minor.
- Queue, in order:
  1. After the demo: Brian's feedback from the two meetings.
  2. Demo sweep leftovers: one "fix first" order across Priorities, Action Items,
     Roadmap and deck (item 5); active offers 1,004/1,005/1,006; missing specs 524 vs
     519; separators on fact-check and map hover. Report:
     docs/demo-readiness.md (18 Nov sweep).
  3. Roadmap gap audit recs 4 to 8 (docs/roadmap-gap-audit.md); decision 123.
  4. "No MAP" client setting (decision 122) and remaining lint:clients hits; C9 runbook.
  5. Full E5 (lines 10, 11, source split, Roadmap dollars; Fable for allocation),
     E6 onboarding inputs, E7 value achieved (additive migration).
  6. D-12 miscategorized listings (Brian's strings-as-guitar example), S-05, X-22
     hover panels (with Minimal /100), X-36 residual.
- Action Items CSV (server route) lacks the Buy Box cause rows, A+ row and dollars.
- Ledlenser: Unbranded Discovery now reads 31.6% (426 of 1,348) vs 3.8% in the
  proposal; likely a larger question set; confirm with Watson.
- Watson: Walmart drop-off and bundle search (decision 122); D-05 field lists;
  X-15/X-16 logins; staff sign-in (blocks recording Actuation programs).
- Slack: DM Watson from Brian's account, italics, signed "sent by Claude for Brian"
  (U0BUPGZ3ADN). Leadership doc TXZ217nzUhNQFiuJyJEAUm: Claude Doc, PM-owned.
- At most 2 browsers per worker e2e run. Unsubscribe auto-subscribed worker PRs.
