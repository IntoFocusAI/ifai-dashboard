// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/selection-read-failure.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { aiSpokeDesc, competitorsSpokeLead } from "../lib/ai-search/canvas-surfaces.ts";
import { displayedAiRead, EMPTY_SELECTION_MESSAGE, selectionLine } from "../lib/ai-search/displayed-read.ts";
import { historyControlLabel, historySpokeDescription } from "../lib/ai-search/history-mode.ts";
import type { AiCallRow, AiSearchRead, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const root = new URL("..", import.meta.url).pathname;
const flat = (path: string) => readFileSync(join(root, path), "utf8").replace(/\s+/g, " ");

const PUBLISHED = "e7ebb838-0000-4000-8000-000000000001";
const TIMEOUT = "canceling statement due to statement timeout";

function snapshot(runId: string, day: string): AiSearchSnapshot {
  const call: AiCallRow = {
    id: `${runId}:c1`,
    audit_run_id: runId,
    sim_id: 1,
    engine: "chatgpt",
    model: null,
    category: "electrics",
    prompt: "Best electric",
    prompt_key: "p01",
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender/Squier",
    material_hallucination: "none",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: `${day}T12:00:00Z`,
  };
  return {
    run: {
      audit_run_id: runId,
      run_state: "completed",
      collector_version: "v11",
      prompt_set_hash: null,
      expected_calls: 1,
      attempted_calls: 1,
      answered_calls: 1,
      error_calls: 0,
      started_at: `${day}T12:00:00Z`,
      completed_at: `${day}T12:00:00Z`,
      published_at: `${day}T12:00:00Z`,
      missing_calls: 0,
      is_published: true,
    },
    calls: [call],
    probes: [],
    citations: [],
  };
}

const published: AiSearchRead = { phase: "ready", snapshot: snapshot(PUBLISHED, "2026-11-02") };
const idle = { phase: "idle" } as const;

test("a failed 30-day read is the selection's failure when the published run loaded", () => {
  const read = displayedAiRead({ kind: "month" }, idle, { phase: "error", message: TIMEOUT }, published);
  assert.deepEqual(read, { phase: "error", message: TIMEOUT, selection: "failed" });
  const unavailable = displayedAiRead({ kind: "all" }, idle, { phase: "unavailable", message: "Views missing." }, published);
  assert.deepEqual(unavailable, { phase: "error", message: "Views missing.", selection: "failed" });
});

test("the published-run failure keeps its own message", () => {
  const failed: AiSearchRead = { phase: "error", message: "canvas_ai_current_run timed out" };
  assert.equal(displayedAiRead({ kind: "month" }, idle, { phase: "ready", snapshots: [] }, failed), failed);
  assert.equal(displayedAiRead({ kind: "month" }, idle, { phase: "error", message: TIMEOUT }, failed), failed);
  const none: AiSearchRead = { phase: "no-run" };
  assert.equal(displayedAiRead({ kind: "month" }, idle, { phase: "ready", snapshots: [] }, none), none);
  assert.deepEqual(displayedAiRead({ kind: "month" }, idle, { phase: "loading" }, { phase: "loading" }), { phase: "loading" });
});

test("a date range or a single run names its own failure, whatever the published run did", () => {
  const failed: AiSearchRead = { phase: "error", message: "down" };
  const range = displayedAiRead({ kind: "range", from: "2026-10-11", to: "2026-10-18" }, idle, { phase: "error", message: TIMEOUT }, failed);
  assert.deepEqual(range, { phase: "error", message: TIMEOUT, selection: "failed" });
  const run = displayedAiRead({ kind: "run", runId: "r1" }, { phase: "error", message: TIMEOUT }, idle, published);
  assert.deepEqual(run, { phase: "error", message: TIMEOUT, selection: "failed" });
  assert.equal(displayedAiRead({ kind: "run", runId: "r1" }, { phase: "unavailable", message: "Not stored." }, idle, published), published);
});

test("an empty selection is marked empty, and loaded runs pool", () => {
  const empty = displayedAiRead({ kind: "all" }, idle, { phase: "ready", snapshots: [] }, published);
  assert.deepEqual(empty, { phase: "error", message: EMPTY_SELECTION_MESSAGE, selection: "empty" });
  const pooled = displayedAiRead(
    { kind: "all" },
    idle,
    { phase: "ready", snapshots: [snapshot("r1", "2026-10-12"), snapshot("r2", "2026-10-18")] },
    published,
  );
  assert.equal(pooled.phase, "ready");
  assert.equal(pooled.phase === "ready" ? pooled.snapshot.calls.length : 0, 2);
});

test("the selection line names the run or the period, and never carries the database error", () => {
  assert.equal(selectionLine("failed", false), "The selected period did not load");
  assert.equal(selectionLine("failed", true), "The selected run did not load");
  assert.equal(selectionLine("empty", false), "The selected period has no stored calls");
  const failed: AiSearchRead = { phase: "error", message: TIMEOUT, selection: "failed" };
  assert.equal(aiSpokeDesc(failed), "The selected period did not load.");
  assert.equal(competitorsSpokeLead(failed).figure, "The selected period did not load.");
  assert.equal(aiSpokeDesc({ phase: "error", message: TIMEOUT }), `The published AI run did not load: ${TIMEOUT}`);
  const desc = historySpokeDescription({
    mode: "run",
    source: "live",
    selectedPhase: "error",
    selectedMessage: TIMEOUT,
    runDescription: null,
  });
  assert.equal(desc, "The selected run did not load.");

  const radar = flat("components/v3/live/ai-search/CompetitorsSpokeDescription.tsx");
  assert.match(
    radar,
    /if \(read\.phase === "error" && read\.selection\) \{ return <span data-ai-competitor-desc="">\{selectionLine\(read\.selection, single\)\}\.<\/span>; \}/,
  );
});

test("the date menu names the published run when it is the one shown", () => {
  const mode = { kind: "run" as const, runId: PUBLISHED };
  assert.equal(historyControlLabel(mode, "2026-11-02", null, PUBLISHED), "Published run · Nov 2, 2026");
  assert.equal(historyControlLabel(mode, "2026-11-02", "2026-11-02", PUBLISHED), "Published run · Nov 2, 2026");
  assert.equal(historyControlLabel({ kind: "run", runId: "r1" }, "2026-11-02", "2026-10-11", PUBLISHED), "Historical run · Oct 11, 2026");
  assert.equal(historyControlLabel({ kind: "run", runId: "r1" }, "2026-11-02", "2026-10-11"), "Historical run · Oct 11, 2026");
});

test("the panels say the selection did not load, keep the database error in a tooltip, and offer the published run", () => {
  const gate = flat("components/v3/live/ai-search/AiReadGate.tsx");
  assert.ok(
    gate.indexOf('if (read.phase === "error" && read.selection) return <SelectionNotice read={read} />;') <
      gate.indexOf("The published AI run did not load, so no AI Search figure is shown."),
    "the selection notice comes before the published-run failure",
  );
  assert.match(
    gate,
    /<span> The \{selectionSubject\(single\)\}\{" "\} <CopyTip label=\{READ_ERROR_TITLE\} description=\{read\.message\}> did not load <\/CopyTip> <\/span>/,
  );
  assert.match(gate, /ready: `The published run loaded\. Show it here, or pick another \$\{single \? "run" : "period"\} from the date menu above\.`/);
  assert.match(
    gate,
    /<button type="button" className="segmented-btn" data-ai-show-published onClick=\{history\?\.viewPublished\}> Show the published run <\/button>/,
  );
  assert.equal((gate.match(/[^=]\{read\.message\}/g) ?? []).length, 1, "only the published-run failure prints the error");
  assert.doesNotMatch(gate, /\btitle=/);

  const context = flat("components/v3/live/ai-search/AiHistoryContext.tsx");
  assert.match(
    context,
    /const viewPublished = useCallback\(\(\) => \{ if \(current\.phase !== "ready"\) return; setMode\(\{ kind: "run", runId: current\.snapshot\.run\.audit_run_id \}\); setSelected\(\{ phase: "ready", snapshot: current\.snapshot \}\); \}, \[current\]\);/,
  );

  for (const path of ["components/v3/live/ai-search/HistoryTrendsPanel.tsx", "components/v3/live/ai-search/RunHistoryControl.tsx"]) {
    const view = flat(path);
    assert.doesNotMatch(view, /did not load\. \{history\.catalog\.message\}/, path);
    assert.match(view, /<CopyTip label=\{READ_ERROR_TITLE\} description=\{history\.catalog\.message\}> did not load <\/CopyTip>/, path);
  }
});
