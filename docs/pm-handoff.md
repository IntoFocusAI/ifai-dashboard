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
2. Choose the next batch from the FDD, using the rules below. Propose it
   in a few sentences. Wait for "go ahead." Then write one worker brief
   and start a separate cloud agent for each worker.
3. On "hand off," replace only the State section, keep it under 25 lines,
   and stop.

"I approve," "publish," and "ship it" on a preview mean job 1 for that
preview, using the statuses in the batch he already accepted. The header
title follows FDD X-26. Preserve every DECISION and LATER item unless he
changes it. X-20 stays TARGET.

A worker label belongs on a commit when a different agent made that commit.
If you are about to edit a product file, stop and write the brief.

## How to update the Google Docs

Edit the .docx on this machine. This is the only publish path.

1. Run `python3 scripts/stage-design-docx.py path/to/the.docx`.
   It prints one https URL. The download matches the local file. The URL
   lasts about an hour. Do not put that URL in a reply.
2. Call google_drive-update-file once. filePath is that URL.
   keepRevisionForever is true. Leave mimeType unset.
   FDD file id: 1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU
   TDD file id: 1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk
3. Run `python3 scripts/check-design-doc.py FILE_ID path/to/the.docx`.
   Reply with the new first line only after it exits 0. The check compares
   paragraph text, the header, and the footer. A byte hash of the export
   will not match.
4. If the Drive file description still names the previous documentation
   version, set description in a second google_drive-update-file call that
   has no filePath.

Do not paste the .docx, its base64, or a data URL into a tool call. Do not
send the file through assistant storage. Do not create a second Google Doc.

## How to choose the next batch

Read the FDD after the doc closeout. A batch is as many workers as the
open work supports, run in parallel. Each worker owns one area of the
dashboard and may make several changes there. Its pull request has one
preview and lists each change on its own line with its FDD id, so he can
approve or reject each change separately. A rejected change comes out
before the merge.

No two workers in a batch edit the same files. No worker edits a file
that another contributor's open pull request changes.

Send follow-up work in an area to the worker that already built there.
It goes on that worker's pull request as a separate commit, after the
worker reports its preview.

Prefer, in order:

1. An open REFINE item whose acceptance is already partly met on screen.
2. A TARGET item that continues the last approved screen.
3. A TARGET item he named in this thread.

Skip DECISION items until he decides. Skip LATER items. Skip the held list.
If he names a change himself, that change is the batch. Propose the worker
split and wait. If nothing is a clear next step, ask him one question.

The proposal names each worker label and its area, each change with its
FDD id and what will be visible, the status each row moves to if he
approves the preview, and what you are leaving out. Worker labels use the number from Your number.

## Standing rules

The map stays on the published run. The shared date pill is the only period
label. Cited pages are associations. Dollar figures stay analyst estimates.
The client portal says nothing about IntoFocus fees. Database changes
follow "Database changes" in AGENTS.md: a migration file first; additive
changes applied after his approval; anything else waits for Brian Watson.
Every worker brief repeats that rule.

Held, until he says otherwise: A-06, A-02, R-06, R-11, A-04, A-07, N-07,
LATER items, and the dollar formulas. Detail lives in the FDD.

- FDD: https://docs.google.com/document/d/1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU/edit
- TDD: https://docs.google.com/document/d/1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk/edit

## State

Replace this whole section on handoff. Keep it under 25 lines. The Google
Docs win if this block is stale.

- PM20 wrote this at 6:55 PM ET on 3 Nov 2026. Both docs open on
  Documentation version: 20.9 (workers 20.1, 20.2, 20.4 to 20.9; Watson's
  18.5 and 18.6). Do not redo that closeout. Next is PM21.
- Main is e99e0d9 (header label 20.9); every PR runs a "Unit tests" check.
- Held: PR 110 (worker 20.3, hover slots, X-22 TARGET); Brian will rework it.
- Collector: the FenderTest Toolbelt agent (AEO_Product_Research-FenderTest,
  via Lux_Connector manage_delegations) runs it. v15 Step 1 is live (3
  repeats, Perplexity fix, empty probe columns). PM20 asked it to switch the
  catalog rotation on (dlg_e98b9df8-c4a4-4d81-af17-470f8dbc9820). First job:
  confirm p35 to p37 are active before 5 Nov 06:00 UTC. If that delegation
  is stuck, Brian presses Resume. If the rotation is off, nothing breaks.
- Waiting on Brian Watson: review of pull request 115 (four replaced views,
  two data writes), canvas_ai_probe_coverage grants, the claude database
  copy, docs/pending-migrations, the drift-check load, and three answers on
  publishing his API job (engine slugs, same scoring, which runs count).
- Next batch: hover lag and cursor glitches (Brian's top concern); the All /
  Without API / API only switch after Watson answers; the tour card over its
  lit area; one failed read blanking the map; page-found reasons linked to
  Findability rows. Ask Brian: edge tab to reopen a spoke? Priorities open?
