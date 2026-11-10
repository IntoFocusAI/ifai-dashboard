# 9. AI Search Visibility requirements

**A-01 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Partial-run disclosure exists.
- **Desired:** Keep disclosure for internal/pilot; client-visible failed/empty runs move to A-09.
- **User value:** Partial is not mistaken for complete.
- **Acceptance:** Partial state labeled when shown.
- **Evidence:** Verified Oct 20/21 run still partial.
- **Open decision:** None.

**A-09 CURRENT** · Launch

**Status source:** Meeting / ADD-16

- **Current:** An engine that failed every call is left out of the win rate, the bar, and the result tile. The provider-error count stays. There is no IntoFocus alert.
- **Desired:** An engine that failed every call is not a client result. The provider-error count may stay. There is no IntoFocus alert.
- **User value:** Clients never see a broken engine as a score.
- **Acceptance:** No client tile for an all-error engine run.
- **Evidence:** Approved by Brian Magazu on 29 Oct 2026. Pull request 79, commit 021ba89. Published on main at 60afa6f.
- **Open decision:** None.

**A-02 TARGET** · Launch

**Status source:** Explicit meeting

- **Current:** Collector v15 (3 Nov 2026): 3 repeats per question per engine on ChatGPT, Gemini, and Perplexity, which is 306 calls per run with fixed fact checks and 549 with the catalog rotation. Perplexity requests go one question at a time to stop its timeouts. ChatGPT model is still blank. Brian Watson's API job (openai_api, gemini_api, claude_api, grok_api, crescent_api) is published beside the search engines with an All · Without API · API only switch, All by default, on every AI Search tab. The map's AI Search figures are the published run plus its matching API run. An API run counts when it finished completed or partial, asked the battery's fixed questions, and has answers; only repeats 1 to 3 count. Rotating fact checks stay battery-only. Perplexity has been effectively down since about 8 AM ET on 3 Nov 2026.
- **Desired:** TARGET run volume: 3 calls per question per engine = 306 calls/run on current questions, ChatGPT, Gemini, Perplexity, one language. Record ChatGPT model. Add engines only with a cap: the question set times 3 repeats. Default month only after trustworthy recurring runs. Run Details compares like with like. Brian Magazu set 3 repeats on 3 Nov 2026. Results from Brian Watson’s API job (ChatGPT API, Gemini API, Claude API, Grok API, Crescent) are to be published beside the search engines, all shown by default with an All, Without API, and API only switch.
- **User value:** Consensus is stable enough to sell.
- **Acceptance:** Published runs meet volume or are marked below target; model always recorded or “not recorded”.
- **Evidence:** Applied on production on 3 Nov 2026 (22:13 UTC) after run 8d6746f6 published; logged in pull request 115. Runs before it made 2,040 calls (20 repeats). Worker 21.8: pull request 129 (main 4fdcf7e) and pull request 134 (main 875cfd7), approved by Brian Magazu on 4 Nov 2026. The views come from migration 20261104160000, applied on production at 21:30 UTC on 4 Nov 2026 by the FenderTest agent after Brian's approval. The catalog rotation was switched on at 13:27 UTC on 4 Nov 2026 (log: pull request 126). A-02 stays TARGET until the ChatGPT model is recorded.
- **Open decision:** None.

**A-03 CURRENT** · Launch

**Status source:** Explicit meeting

- **Current:** Tab title is Run Details. The old simulations slug opens it. An empty model cell is exactly “not recorded”. Non-fact-check rows show “n/a” in the Fact check column, and Checked rows begin with the date rather than the word “checked”. The AI summary tab stays Run Summary.
- **Desired:** Rename Simulations → Run Details. Keep model column; show “not recorded” when absent. Use “n/a” when a Run Details row was not a fact check. Keep the main AI summary tab named Run Summary.
- **User value:** Operators know they are reading run evidence.
- **Acceptance:** No client-visible Simulations tab title.
- **Evidence:** Run Details and the simulations alias were desktop-verified 21 Oct 2026, commit 1fdbfc0 (PR 43). The Fact check and Checked cell cleanup was desktop-verified 22 Oct 2026 on commits 031d89c and 10ede0c (PR 44): shopping rows and their drawer show “n/a”; fact-check rows keep their actual result; timestamps have no “checked” prefix; sorting and row opening still work. “not recorded” is unit-tested; these passes did not open a live row whose stored model was blank. Model-column hover remains A-07 and was not decided. Run Summary was not renamed to Summary, so it does not collide with the hub.
- **Open decision:** None.

**A-04 REFINE** · Launch

**Status source:** Explicit

- **Current:** Citation tables dense; raw/canonical inline.
- **Desired:** More table space; consider drawer for raw/canonical (still open).
- **User value:** Evidence is readable.
- **Acceptance:** Primary columns fit without horizontal noise.
- **Evidence:** Verified Oct 20.
- **Open decision:** Raw/canonical inline or drawer only?

**A-05 CURRENT** · Launch

**Status source:** Explicit meeting (was DECISION)

- **Current:** Product Fact Checks leads Accuracy with one line, “5 products checked · 4 with a verified fact”; how the products were chosen sits in its tooltip. Every non-fact-check question reads n/a. Fact checks count by catalog product once the collector’s rotation fills the probe columns; until then the counts are unchanged. On 3 Nov 2026 the collector (v15) moved to 3 repeats and a rotation across 180 in-scope guitar and bass models, 90 per run, with anchors p17 and p33.
- **Desired:** Keep Product Fact Checks. Reject the handful method. Results need defensible catalog coverage or a stated representative sample. In Fact Check, show “n/a” when the question was not a fact check.
- **User value:** Consensus checks are credible.
- **Acceptance:** Method statement on screen; n/a for non-fact-check rows.
- **Evidence:** Approved by Brian Magazu on 3 Nov 2026. Worker 20.4, pull request 106, main fff5dd2. Worker 24.4, pull request 151 (main f1df1f5), merged 10 Nov 2026: every engine choice keeps the rotating catalog fact checks its engines asked, Product Fact Checks leads with N of M catalog products checked, and tooltips name the engines covered.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: every engine choice, All included, counts the rotating catalog questions and leads with N of M catalog products checked. Only ChatGPT, Gemini, and Perplexity ask the rotating questions; the tooltip says which engines a figure covers.

**A-06 TARGET** · Launch

**Status source:** Explicit

- **Current:** Owned vs earned citation share partially shown.
- **Desired:** Owned vs earned visuals; citation pies TARGET. IntoFocus-only checkboxes DECISION.
- **User value:** Citation quality is obvious.
- **Acceptance:** Visuals use the published run only.
- **Evidence:** Partial satellite share CURRENT.
- **Open decision:** None.

**A-10 CURRENT** · Launch

**Status source:** Meeting / ADD-18

- **Current:** Citation Ecosystem opens on a chain: shopping answers, answers that showed sources (with the no-sources remainder), links, and links to Fender-owned sites, each a share of the step before. A top cited sites chart ranks sites by answers citing them, with a toggle to cited links, and each row opens that site’s links. A category filter narrows the chain, the chart, and the tables, and filtered figures carry an asterisk.
- **Desired:** Lead with the few sources that matter most; filter by category.
- **User value:** Effort goes where it pays.
- **Acceptance:** Top sources first; category filter works.
- **Evidence:** Approved by Brian Magazu on 3 Nov 2026. Worker 20.6, pull request 107, main a1080b4.
- **Open decision:** None.

**A-07 DECISION** · Launch

**Status source:** Inferred

- **Current:** Simulations title and model-column hover unsettled.
- **Desired:** Superseded in part by A-03 Run Details. Remaining: model-column hover copy.
- **User value:** Clarity in Run Details.
- **Acceptance:** Hover copy approved or omitted.
- **Evidence:** Open.
- **Open decision:** Model-column hover text?

**A-08 CURRENT** · Launch

**Status source:** Explicit

- **Current:** Prompt set not client-editable.
- **Desired:** Versioned client-editable prompt library (governed).
- **User value:** Questions stay controlled and current.
- **Acceptance:** Edits versioned; history compares like with like.
- **Evidence:** Worker 24.4, pull request 151 (main f1df1f5): the Prompts screen shows each prompt's stored change history through the read-only function public.ai_prompt_edits_list (migration 20261109233000), applied to production on 10 Nov 2026 with Brian Magazu's approval and checked live that day.
- **Open decision:** None. Decided by Brian Magazu on 9 Nov 2026: the Prompts screen shows each prompt's change history through one additive database read, applied after approval. Ledlenser's prompt list stays read-only.
