# Project Manager briefing

This note is for Brian Magazu. It is the rule for starting a Project Manager and for leaving it running. A Project Manager that opens this file is reading the briefing rule. This file assigns no worker label and replaces no handoff.

Written Monday, October 26, 2026 (America/New_York), after PM9 and PM10. Revised the same day so the Project Manager chooses the next small batch from the Functional Design Document.

## What you do

You approve work, and you occasionally hand off to a new Project Manager. You do not edit the handoff between batches.

Two approvals, each one sentence:

- **"Go ahead"** accepts the batch the Project Manager just proposed. It then delegates that batch to workers.
- **"I approve," "publish," or "ship it"** accepts the preview. The Project Manager updates the Functional Design Document and the Technical Design Document before it does anything else.

**"Hand off"** starts a fresh Project Manager. The outgoing one rewrites the State section. You send the new one this sentence:

> Continue as Project Manager. Read `docs/pm-handoff.md` and do the first job.

`docs/pm-handoff.md` is the live card. It was copied once on October 26, 2026, after PM10 finished, without a handoff from PM10. After that, only a Project Manager writes the file, and only the State section changes.

`docs/pm8-handoff.md`, `docs/pm9-handoff.md`, and `docs/pm10-handoff.md` open with: Archive. Do not follow. The live handoff is `docs/pm-handoff.md`.

## Why the card stays standing

PM9 and PM10 each received the previous handoff as a long paste (about 10,000 and 21,000 characters). Both labeled their own commits as workers. Neither started a separate worker agent. Both left the docs on **Documentation version: 8.7**. At 1:35 PM ET on October 26, 2026, the public text export of both Google Docs still opened on 8.7.

A card that lists the next batch, the status table, and the last build log has to be rewritten every time you approve something. The Project Manager then follows that paste and implements it. The standing card below gives it the job of reading the FDD, proposing a small batch, and writing the doc closeout when you approve the preview.

## The role card

The block below matches `docs/pm-handoff.md`. State is still the 3:18 PM ET October 26, 2026 snapshot, when both Google Docs were on documentation version 10.5. A new Project Manager follows Your number: one greater than the whole number in the live documentation version. On October 27, 2026 that makes the next Project Manager PM12, because PM11B used 11.5 through 11.7 while the docs stayed on 11.4. The Project Manager replaces State only when you say to hand off.

```
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
The client portal says nothing about IntoFocus fees.

Held, until he says otherwise: A-06, A-02, R-06, R-11, A-04, A-07, N-07,
LATER items, and the dollar formulas. Detail lives in the FDD.

- FDD: https://docs.google.com/document/d/1PoeiXKR2twOaz_JcRN0e4ZQkUCuDD5qnnyrlt6ygkeU/edit
- TDD: https://docs.google.com/document/d/1K6-ghhSnJZcrch81DDhmHXXYU0pSF7tOGR9S9jiCUjk/edit

## State

Replace this whole section on handoff. Keep it under 25 lines. The Google
Docs win if this block is stale.

- The "You are PM11" line below is the October 26 snapshot. A new Project
  Manager follows Your number, not this line.
- You are PM11. Next feature workers are 11.1, 11.2, 11.3.
- Confirmed at 3:18 PM ET on October 26, 2026. Both docs open on
  Documentation version: 10.5. Workers 9.1 through 10.5 are written there.
  X-22 stays TARGET. Do not redo that closeout.
- Approved code is on main at d9911c9. Pull request 46 is merged.
  Production: https://ifai-dashboard.netlify.app/dashboard
- Nothing is in flight. First job is the next small batch from the FDD.
  Propose it and wait for "go ahead."
```

## Worker brief

The brief is what a worker receives. It is the only place a slice's implementation detail goes. The Project Manager writes a new one for each worker. You do not.

```
Worker 11.1

Area: <the one part of the dashboard this worker owns>

Changes (each one is approved or rejected on its own):
- <FDD id>: <what a person will see>. Status if approved: <CURRENT or REFINE>
- <FDD id>: <what a person will see>. Status if approved: <CURRENT or REFINE>

Acceptance:
- <FDD id>: <check a person can see>
- <FDD id>: <check>

Out of scope: <the neighboring work, the docs, and cleanup>

Branch from: main

Do not edit: <files another worker in this batch or another contributor's
open pull request changes>

Constraints for this slice:
- <one>
- <two>

Report the preview URL, the commit, and any acceptance check that failed.
```

Durable copy rules already live in `AGENTS.md` and `.cursor/rules/`. Workers inherit them: no em dash in client UI, definition tooltips use `ifai-term` data attributes, dollar figures stay analyst estimates, the client portal says nothing about fees. Repeat one of those in the brief only when this slice can break it.

## What stays out of the handoff

The State section is a pointer. It stays under 25 lines because a longer one becomes the next build log. Leave these out of `docs/pm-handoff.md`:

- Component names, CSS classes, pixel widths, and the story of a bug already fixed
- Run UUIDs, scoring-method notes, and the dev-server port
- The unit-test command and the list of known end-to-end failures
- A link to every tab
- The previous handoff, pasted again
- The red/yellow/green bands and any other build spec for a later bubble

The worker who extends the 9.5 hero-value pattern reads that commit. The Project Manager proposes the batch and names the FDD id. PM10 turned a preloaded 10.1 into its own commit labels when later feedback was a different batch.

## Before the first kickoff

PM10's session is finished. The live card and the archive lines are in this branch. Merge it to `main` before starting PM11. A new Project Manager reads `main`, and the older handoffs there still open with "You are Project Manager 9" and "You are Project Manager 10" until this branch lands.

After the merge, the chat paste is the one kickoff sentence.
