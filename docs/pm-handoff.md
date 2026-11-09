# PM handoff

You are the current Project Manager. You do not write product code.

Read the Functional Design Document and the Technical Design Document,
then the State section below. If State and the Google Docs disagree, the
Google Docs win. Report the documentation version, then do the first job
that applies.

## Your number

Brian starts you with "Continue as Project Manager." You are a new Project
Manager. Take the next whole number. Read the live documentation version.
Your number is one greater than the whole number in that version. Your
workers are that number .1, .2, .3, and so on. If workers already exist
at that number, add one again. State may name an older Project Manager. Do not keep
that number, and do not continue its decimals.

On October 27, 2026 the live docs are on 11.4. PM11B already used 11.5,
11.6, and 11.7. You are PM12. Your workers are 12.1, 12.2, and 12.3. If the
live documentation version is already 12 or higher, add one to that whole
number instead.

1. Close the docs. If work you can see on the approved preview is missing
   from the docs, propose the closeout in one short table: worker, FDD id,
   status you will set, one sentence. Wait for "go ahead." Then update both
   docs using the steps below. Set the first line to the last approved
   worker label. Add a changelog row with the worker, the pull request, and
   the commit. Reply with the new first line of each doc.
2. Plan and build to final form, using "How to run the work" below.
   Send the Phase 0 plan in one message. Wait for "go ahead." Then write
   one worker brief per view and start a separate cloud agent for each.
3. On "hand off," replace only the State section, keep it under 25 lines,
   and stop.

"I approve," "publish," and "ship it" on a preview mean job 1 for that
preview, using the statuses in the batch he already accepted. The header
title follows FDD X-26. Preserve every DECISION and LATER item unless he
changes it. X-20 stays TARGET.

A worker label belongs on a commit when a different agent made that commit.
If you are about to edit a product file, stop and write the brief.

## How to update the Google Docs

Edit a copy of each doc on this machine, then make the same edits in the
live doc with the Google-docs plugin. This is the only publish path.

FDD file id: 1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU (`fdd`)
TDD file id: 1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk (`tdd`)

1. Download. Run
   `python3 scripts/design-doc-edit.py download fdd fdd-live.docx`
   (or `tdd`). It reads the public export URL and prints the first line.
   Copy it to a working file, such as fdd-21.9.docx.
2. Edit the copy with `python3 scripts/design-doc-edit.py COMMAND FILE ...`.
   It installs python-docx if it is missing. Do not hand-edit
   word/document.xml. Each command saves in place, and saves nothing if it
   fails.
   - `set-version FILE 21.9` sets the first line, the Version and Date
     rows, and the footer. `--date "November 5, 2026"` overrides today.
   - `set-status FILE X-21 CURRENT` sets the status word and its color.
   - `get`, `set`, `append`, `replace FILE X-21 Evidence ...` edit one
     field in either row layout (table or label paragraphs).
   - `clone FILE X-21 X-31 X-32 --status TARGET` copies X-21 to a new
     X-32 after X-31. Then set each field.
   - `changelog FILE CHANGE REASON REFERENCE` appends a change-log row.
   - `add-row FILE decision|later|trace|tdd-trace VALUES...` and
     `set-cell FILE trace X-21 Status CURRENT` edit the registers. Add
     rows at the bottom (no `--after`): the plugin cannot add a row
     inside a table.
   - `replace-all FILE OLD NEW`, and `rows` or `show FILE X-21` to read.
   Then run `python3 scripts/design-doc-edit.py diff fdd-live.docx
   fdd-21.9.docx` and read every changed line.
3. Plan. Run `python3 scripts/design-doc-edit.py plan fdd-live.docx
   fdd-21.9.docx > plan.txt`. Read its Self-check line first. Go on only
   when it says OK. If it says MISMATCH, or lists anything under Skipped
   or Warnings, fix the copy and plan again. Published change-log rows
   stay as they are unless Brian asks; then add `--no-keep-history`.
4. Apply plan.txt with the Google-docs plugin, one call at a time, in
   the order listed. documentId is the file id. The plan uses
   replace_text, find_text, read_document, delete_content, insert_text,
   insert_table, apply_text_style, apply_paragraph_style,
   set_paragraph_format, and set_header_footer. Take every index from the
   find_text or read_document call in the same step. If a replace_text
   reports a different occurrencesChanged than its step expects, stop,
   put back what it changed, and tell Brian. If the Google-docs namespace
   says needsAuth, or a call fails with an authentication error, call its
   mcp_auth, then ask Brian to reconnect Google Docs under Integrations in
   the Cursor web dashboard (not the desktop app). In Claude Code the
   plugin's tools do not exist: follow "Step 4 in Claude Code" below.
   find_text returns at most 20
   matches: for a step that names a later occurrence, find a unique line
   in the same row and read_document forward to it. After filling a new
   table, read it back before the check.
5. Check. Run the two lines at the end of plan.txt:
   `python3 scripts/design-doc-edit.py pub fdd-21.9.docx pub.docx --split ...`
   and `python3 scripts/check-design-doc.py FILE_ID pub.docx`. pub puts
   each appended row in its own table, the way insert_table leaves it
   live. Reply with the new first line only after the check exits 0. If
   it reports a paragraph, fix that paragraph in the live doc with the
   plugin and check again.

Do not create a second Google Doc. Do not paste the .docx, its base64, a
data URL, or its text into a tool call, and do not upload it.
`scripts/stage-design-docx.py` stays in the repo but is not part of the
publish path.

### Step 4 in Claude Code

Claude Code's Google Docs connector has two calls: read_doc and update_doc
(a Docs batchUpdate). Load the google-workspace skill before the first
edit. Steps 1 to 3 and 5 are unchanged. Apply plan.txt with update_doc.
Steps that only use replaceAllText may go together in one update_doc call.
Index-based steps go one per call, in order. Translate each plan call:

- replace_text: replaceAllText. Check occurrencesChanged against the step.
- find_text and read_document: read_doc, then find the index in the saved
  result with the google-workspace skill's `docs_index.py find`.
- insert_text: insertText. delete_content: deleteContentRange.
- insert_table: insertTable, then fill the cells one call at a time and
  read the table back.
- apply_text_style: updateTextStyle. apply_paragraph_style and
  set_paragraph_format: updateParagraphStyle.
- set_header_footer: insertText or replaceAllText in the header or footer
  segment.

Every update_doc call that uses an index carries
writeControl.requiredRevisionId from a read_doc taken after your last
write. If Google rejects it, read again and rebuild the step. If a
replaceAllText changes a different count than the plan expects, stop, put
back what it changed, and tell Brian. If a Google call fails with an
authentication error, ask Brian to reconnect Google Docs in his claude.ai
connector settings.

## How to run the work

Brian Magazu set this model on 9 Nov 2026. He reviews a view only when it
is in its final intended form, so he never wonders whether a missing FDD
item is still unassigned.

### Phase 0: one planning message, then wait for "go ahead"

1. Completion map. Every FDD row that is not CURRENT or LATER, grouped by
   view: Summary, Catalog Health, AI Search Visibility, AI Readiness,
   Competitive Radar, Action Items, Strategy Roadmap, Minimal, and
   cross-dashboard. Give each row one class. BUILD: buildable now.
   DECISION: needs Brian. BLOCKED: needs data, the collector, Brian Watson,
   Ryan, or auth; name the owner and what is missing. HELD: his held list,
   PR 110 (X-22), and the dollar formulas. Leave no row unclassified.
2. Decisions. Every DECISION row, and any rule the FDD does not specify
   that a build would need. For each, say what he is deciding, what the
   screen shows under the recommendation and under the alternative, and
   why. He replies to the ones he disagrees with and approves the rest.
3. Final-form spec per view. What opens first, what each tab shows, which
   rows it closes, and which rows stay BLOCKED or HELD. Specs come only
   from the FDD and his decisions. Never invent rules.
4. Build plan. A foundation step first for cross-cutting rows (type scale,
   asterisk rule, renames, table rule). Then one lead worker and one pull
   request per view, with file ownership, sequencing, at most 7 workers at
   once, and projected completion.

### Phase 1: build to final

- One pull request per view. A big view runs as sequential workers on the
  same branch and pull request. Follow-ups go to the same worker. Rebase
  on main often; Brian Watson merges Ledlenser work.
- Every view is correct for both clients, Fender and Ledlenser, through
  the client switcher.
- Build inside the existing dashboard views. Add no standalone route or
  page that nothing links to, unless the FDD says so.
- A feature whose data does not exist is BLOCKED, not built. Never deliver
  a screen or column that reads Not available* on every row as the work.
- No two workers edit the same files. No worker edits a file that another
  contributor's open pull request changes.
- Before asking Brian, the PM checks the preview at 1280x720 for both
  clients against each row's FDD acceptance text, and sends the worker
  back until every BUILD row in the view passes.
- Between reviews, message Brian only when a decision or blocker needs him.

### Batch mode (Brian Magazu, 9 Nov 2026)

This overrides any per-view wording in this file.

- Run several view workers at once. In Claude Code each worker is a
  subagent with its own git worktree, on its own branch
  `worker/<number>-<short-name>` (for example `worker/24.4-ai-search`),
  with one pull request. Continue a worker with a message to the same
  agent, not a new agent.
- When every pull request in the batch passes the PM's preview check, send
  Brian one combined review checklist, with a link to each pull request
  and its preview.
- Merge only the pull requests he approves, one at a time. After each
  merge, the remaining workers rebase on main and the PM rechecks their
  previews before the next merge.
- Close out the docs once per batch: one version bump, every row status
  and evidence change for the batch, one change-log row per pull request,
  and one header-label pull request for the new version.
- If a new pull request gets no Netlify deploy preview, tell Brian at
  once. Every review depends on it.

### Audit gate (before any view reaches Brian)

For the PM24 test batch (24.4 and 24.3), Brian skipped the audit
(9 Nov 2026). The PM's own preview check still applies. The rest of this
section applies again when he says so.

When the PM believes a view is final, it starts a separate Auditor agent
with `docs/auditor-brief.md`, the preview URL, the view's final-form spec,
and its FDD rows. Every Auditor runs on GPT-5.6 Sol High
(`gpt-5.6-sol-high`). Until an OpenAI option is connected in Claude Code,
Auditors run on Fable (Brian Magazu, 9 Nov 2026). If the chosen model is
unavailable, do not substitute another: tell Brian and wait. Workers that
build stay on the PM's model.

The Auditor never edits code, merges, or contacts Brian. Send its BLOCKER
and MAJOR findings to the view's worker as follow-ups, then audit once
more. After two audit rounds, anything still open goes on Brian's review
checklist as Known issues, with the Auditor's evidence. Any finding that
conflicts with the FDD, a standing rule, the brand book, or one of
Brian's decisions goes to Brian as a question, never to a worker as a fix.

### Phase 2: review and close

- Review request per view: worker numbers, pull request link, preview
  link, then a checklist with one line per FDD row: where to click from
  the map, and what he should see. Then the view's BLOCKED and HELD rows
  with owners. Plain language, terse.
- On his approval, merge the pull request. Then close out the docs with
  the publish path above: first line is the last approved worker label,
  one change-log row per worker with pull request and commit, and a header
  label pull request. Reply with the new first lines only after
  check-design-doc.py exits 0 for both docs.

## Standing rules

The map shows the published run plus its matching API run. The shared date
pill is the only period label. Cited pages are associations. Dollar figures
stay analyst estimates, and their formulas stay parked. The client portal
says nothing about IntoFocus fees. Do not build delegation or paid tiers.
Let the data speak: caveats go in tooltips. Custom tooltips only. Database
changes follow "Database changes" in AGENTS.md: a migration file first;
additive changes applied only after his approval (the FenderTest agent can
apply them); anything that alters or deletes waits for Brian Watson. Every
worker brief repeats that rule. Merge only pull requests he approves.

The brand book, `docs/brand/IntoFocus_AI_Brand_Book_V2.pdf`, is a standard
below the FDD. Where the two conflict, ask Brian.

Held, until he says otherwise: A-06, A-02, R-06, R-11, A-04, A-07, N-07,
LATER items, and the dollar formulas. Detail lives in the FDD.

- FDD: https://docs.google.com/document/d/1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU/edit
- TDD: https://docs.google.com/document/d/1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk/edit

## State

Replace this whole section on handoff. Keep it under 25 lines. The Google
Docs win if this block is stale.

- PM24 wrote this at 6:30 PM ET on 9 Nov 2026, in Claude Code. PM23
  paused after worker 23.1. Brian renumbered the remaining workers 24.2 to
  24.7 (the Cursor agents for 23.2 to 23.6 pushed nothing). Briefs:
  docs/pm24-worker-briefs.md. Decisions: docs/pm23-decisions.md.
- Repo: IntoFocusAI/ifai-dashboard (moved from brianw-ifai on 9 Nov).
- Docs: both on 23.1. Worker 23.1 is closed out (X-02 CURRENT; X-34, X-25,
  X-33, X-10, X-18 REFINE until the views adopt them). Launch rows
  CURRENT: 56 of 91.
- Main has PRs 147, 148, and 150 (header label 23.1) and commit a74878c
  (the Claude Code permission allowlist in .claude/settings.json).
- Now: a two-view test batch in batch mode, with no audit: 24.4 AI Search
  and 24.3 Catalog Health. Then, as Brian directs: 24.5 AI Readiness, 24.2
  Summary (24.4's Ledlenser window fix may fix its defect; check first),
  24.6 Competitive Radar, 24.7 Roadmap and Action Items (after item 21).
- Open with Brian: D-06, C-01, and the Roadmap and Action Items
  recommendation rules (docs/pm23-decisions.md items 16, 17, 21).
- Known: PR 110's hub-slots.ts still says "30-60-90 Day Milestones", so
  metric-destinations.spec fails until it is rebased. The stale-data
  asterisk is not built; its check schedules are decided (decision 4).
- Data: battery Sun, Tue, Thu 06:00 UTC; Nov 8 run 431 of 549 (ChatGPT 82
  errors, model still not recorded; Perplexity 147 of 183), for Ryan.
  Ledlenser runs published 5 and 7 Nov UTC, but its AI Search says no
  published run (24.4 fixes).
- Watson: PRs 125, 131, 139 (migrations only).
