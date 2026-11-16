// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-window-everywhere.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TRUSTED_COLLECTOR_VERSION, type HistoryRunSummary } from "../lib/ai-search/history-eligibility.ts";
import { windowQuestionSetChange } from "../lib/ai-search/history-trends.ts";
import { aiSearchStale, aiWindowPartial, questionSetMixed } from "../lib/ai-search/stale.ts";
import type { AiCallRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import { PARTIAL_TITLE, partialFigureTip } from "../lib/fender-canvas/canvas-reads.ts";
import { latestRunTip, withLatestRunTips } from "../lib/fender-canvas/roadmap-latest.ts";
import type { PlanItem } from "../lib/fender-canvas/roadmap-plan.ts";

/* Brian Magazu, 12 Nov 2026 (replaces decision 7): every AI figure follows the date pill. A window
   that spans a question-set change marks each AI rate with the X-25 asterisk, and Action Items
   names the newest run's count in each AI row's tooltip. */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function run(id: string, day: string): HistoryRunSummary {
  return {
    audit_run_id: id,
    run_kind: "ai_simulation",
    run_state: "completed",
    collector_version: TRUSTED_COLLECTOR_VERSION,
    prompt_set_hash: "hash",
    expected_calls: 10,
    attempted_calls: 10,
    answered_calls: 10,
    error_calls: 0,
    is_published: true,
    published_at: `${day}T12:00:00Z`,
    completed_at: `${day}T11:00:00Z`,
  };
}

function call(runId: string, i: number, win: boolean): AiCallRow {
  return {
    id: `${runId}-c${i}`,
    audit_run_id: runId,
    sim_id: i,
    engine: "chatgpt",
    model: null,
    category: "electric",
    prompt: `What is the best electric guitar ${i}?`,
    prompt_key: `q${i}`,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: win ? "fender_win" : "competitor_win",
    primary_brand: win ? "Fender" : "Gibson",
    material_hallucination: null,
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: null,
  };
}

function snapshot(id: string, day: string, questions: number, wins: number): AiSearchSnapshot {
  const calls = Array.from({ length: questions }, (_, i) => call(id, i + 1, i < wins));
  return { run: run(id, day) as unknown as AiSearchSnapshot["run"], calls, probes: [], citations: [] };
}

test("a window that spans a question-set change names the day the new set began", () => {
  const before = [snapshot("a", "2026-11-05", 4, 1), snapshot("b", "2026-11-08", 4, 2)];
  assert.equal(windowQuestionSetChange(before), null, "one question set: no mark");
  const after = [...before, snapshot("c", "2026-11-12", 6, 3)];
  assert.equal(windowQuestionSetChange(after), "2026-11-12");
  // Order in does not matter; the trend's run order decides.
  assert.equal(windowQuestionSetChange([...after].reverse()), "2026-11-12");
});

test("the mixed mark is the X-25 asterisk with its reason in a custom tooltip, no on-screen words", () => {
  assert.equal(questionSetMixed(null), null);
  const mixed = questionSetMixed("2026-11-12")!;
  assert.equal(mixed.reason, "mixed");
  assert.equal(PARTIAL_TITLE.mixed, "Question set changed");
  assert.equal(
    partialFigureTip(mixed),
    "This window mixes runs before and after the question set changed on Nov 12; rates are not fully comparable across that date.",
  );
  assert.doesNotMatch(partialFigureTip(mixed), /—|n't\b/);
  const stale = aiSearchStale({ published_at: "2026-10-01T00:00:00Z", completed_at: null }, Date.parse("2026-11-12T00:00:00Z"))!;
  const both = aiWindowPartial(stale, mixed)!;
  assert.equal(both.reason, "stale");
  assert.match(partialFigureTip(both), /6 days\.\nThis window mixes runs/);
  assert.equal(aiWindowPartial(null, mixed), mixed);
  assert.equal(aiWindowPartial(null, null), null);
});

test("Action Items names the newest run's count on each AI row", () => {
  const latest = snapshot("c", "2026-11-12", 6, 4);
  const item = (id: string, kind: PlanItem["kind"], label = "Unbranded Discovery") => ({ id, kind, label }) as PlanItem;
  assert.equal(latestRunTip(item("finding:unbranded_discovery", "finding"), latest, new Map()), "Latest run (Nov 12): 4 of 6");
  const rivals = new Map([["signal:rival:electric", "Gibson"]]);
  assert.equal(latestRunTip(item("signal:rival:electric", "signal"), latest, rivals), "Latest run (Nov 12): 2 of 6");
  assert.equal(latestRunTip(item("finding:buy_box", "finding"), latest, new Map()), null, "an ecommerce row has no AI run");
  const plan = withLatestRunTips([item("finding:unbranded_discovery", "finding"), item("finding:buy_box", "finding")], latest, []);
  assert.deepEqual(plan.map((row) => row.tip ?? null), ["Latest run (Nov 12): 4 of 6", null]);
  assert.equal(withLatestRunTips(plan, null, [])[0]!.tip, plan[0]!.tip);
});

test("every AI figure reads the window: Summary, the plan, the deck, and the CSV", () => {
  assert.match(read("components/v3/live/useSummaryAiRead.ts"), /return useMapAiSearch\(useAiHistory\(\)\.current\);/);
  assert.match(read("components/v3/live/useSummaryAiRead.ts"), /const partial = useAiStale\(\);/);
  assert.match(read("components/v3/live/deck/useDeckModel.ts"), /const aiStale = useSummaryAiStale\(tabRead\);/);
  assert.doesNotMatch(read("lib/deck/deck-types.ts"), /mapAi\b/);
  assert.doesNotMatch(read("components/v3/live/deck/DeckSlideView.tsx"), /Published run/);
  assert.match(read("lib/export/action-items-export.ts"), /parseAiSelectionScope\(scope\?\.ai\) \?\? DEFAULT_SCOPE/);
  assert.match(read("lib/export/action-items-export.ts"), /loadAiSelection\(/);
});
