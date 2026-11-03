import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  OCTOBER_11_RUN_ID,
  PUBLISHED_OCTOBER_12_RUN_ID,
} from "../lib/ai-search/review-runs.ts";
import type { AiCallRow, AiCurrentRun, AiSearchSnapshot } from "../lib/ai-search/types.ts";
import {
  callDaySpan,
  distinctCallRunIds,
  hasMixedScoringMethods,
  isWindowHistoryKind,
  MIXED_SCORING_NOTE,
  MIXED_SCORING_TITLE,
  scoringMethodsInSnapshot,
} from "../lib/ai-search/window-display.ts";
import { applyExplorerFilter, filterFromEvidence } from "../lib/ai-search/explorer-filter.ts";
import { driftRead } from "../lib/ai-search/drift.ts";
import { aiSpokeHeaderChips } from "../lib/ai-search/canvas-surfaces.ts";

const root = new URL("..", import.meta.url).pathname;
const AI_DIR = "components/v3/live/ai-search";
const source = (path: string) => readFileSync(join(root, path), "utf8");

function run(id: string, completedAt: string): AiCurrentRun {
  return {
    audit_run_id: id,
    run_state: "completed",
    collector_version: "v11",
    prompt_set_hash: null,
    expected_calls: 10,
    attempted_calls: 10,
    answered_calls: 10,
    error_calls: 0,
    started_at: completedAt,
    completed_at: completedAt,
    published_at: completedAt,
    missing_calls: 0,
    is_published: true,
  };
}

function call(id: string, auditRunId: string, createdAt: string, simId = 1): AiCallRow {
  return {
    id,
    audit_run_id: auditRunId,
    sim_id: simId,
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
    created_at: createdAt,
  };
}

test("window history kinds", () => {
  assert.equal(isWindowHistoryKind("month"), true);
  assert.equal(isWindowHistoryKind("range"), true);
  assert.equal(isWindowHistoryKind("all"), true);
  assert.equal(isWindowHistoryKind("run"), false);
  assert.equal(isWindowHistoryKind("legacy"), false);
});

test("pooled window helpers name run ids and day span", () => {
  const snapshot: AiSearchSnapshot = {
    run: run(PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z"),
    calls: [
      call("a", OCTOBER_11_RUN_ID, "2026-10-11T06:00:00Z"),
      call("b", PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z"),
    ],
    probes: [],
    citations: [],
  };
  assert.deepEqual(distinctCallRunIds(snapshot), [OCTOBER_11_RUN_ID, PUBLISHED_OCTOBER_12_RUN_ID].sort());
  assert.deepEqual(callDaySpan(snapshot), { from: "2026-10-11", to: "2026-10-12" });
});

test("mixed scoring methods across October 11 and later runs", () => {
  const mixed: AiSearchSnapshot = {
    run: run(PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z"),
    calls: [
      call("a", OCTOBER_11_RUN_ID, "2026-10-11T06:00:00Z"),
      call("b", PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z"),
    ],
    probes: [],
    citations: [],
  };
  assert.deepEqual(scoringMethodsInSnapshot(mixed), ["mention_share", "original_winner"]);
  assert.equal(hasMixedScoringMethods(mixed), true);

  const single: AiSearchSnapshot = {
    ...mixed,
    calls: [call("b", PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z")],
  };
  assert.equal(hasMixedScoringMethods(single), false);
});

test("the mixed scoring note is a tooltip on the lead figure, never a line on screen", () => {
  assert.equal(MIXED_SCORING_TITLE, "Mixed scoring");
  assert.match(MIXED_SCORING_NOTE, /named the leader in different ways/);
  const tip = source(`${AI_DIR}/MixedScoringTip.tsx`).replace(/\s+/g, " ");
  assert.match(tip, /<CopyTip label=\{MIXED_SCORING_TITLE\} description=\{MIXED_SCORING_NOTE\}> \{children\} <\/CopyTip>/);
  assert.doesNotMatch(tip, /\btitle=/);

  // Run Details and Category Battlecards both lead with RunDetailsLead.
  for (const file of ["RunDetailsLead.tsx", "EngineComparisonLead.tsx", "RunSummaryPanel.tsx", "CompetitorWinsHero.tsx"]) {
    assert.match(source(`${AI_DIR}/${file}`), /<MixedScoringTip mixed=\{mixed\}>/, file);
  }
  assert.match(source(`${AI_DIR}/RunDetailsLead.tsx`), /<MixedScoringTip mixed=\{mixed\}>\{lead\.rate\}<\/MixedScoringTip>/);
  assert.match(source(`${AI_DIR}/EngineComparisonPanel.tsx`), /<EngineComparisonLead engines=\{engines\} mixed=\{mixed\} \/>/);

  const onScreen = readdirSync(join(root, AI_DIR))
    .filter((name) => name.endsWith(".tsx") && name !== "MixedScoringTip.tsx")
    .filter((name) => /MIXED_SCORING_NOTE/.test(source(`${AI_DIR}/${name}`)));
  assert.deepEqual(onScreen, []);
});

test("header chips omit single-run state on window modes and do not restate the pill", () => {
  const snapshot: AiSearchSnapshot = {
    run: run(PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z"),
    calls: [
      call("a", OCTOBER_11_RUN_ID, "2026-10-11T06:00:00Z"),
      call("b", PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z"),
    ],
    probes: [],
    citations: [],
  };
  const ready = { phase: "ready" as const, snapshot };
  const windowChips = aiSpokeHeaderChips(ready, { modeKind: "month" });
  assert.ok(!windowChips.some((chip) => chip.id === "window" || chip.id === "state" || chip.id === "completed" || chip.id === "answered"));
  assert.ok(windowChips.some((chip) => chip.id === "unbranded"));
  assert.ok(windowChips.some((chip) => chip.id === "branded"));
  assert.equal(windowChips.some((chip) => /Last 30 days/.test(chip.value)), false);

  const runChips = aiSpokeHeaderChips(ready, { modeKind: "run" });
  assert.ok(runChips.some((chip) => chip.id === "state"));
  assert.ok(runChips.some((chip) => chip.id === "answered"));

  const historicalChips = aiSpokeHeaderChips(
    { phase: "ready", snapshot: { ...snapshot, run: { ...snapshot.run, run_state: "historical" } } },
    { modeKind: "run" },
  );
  assert.ok(!historicalChips.some((chip) => chip.id === "state"));
  assert.ok(historicalChips.some((chip) => chip.id === "completed" || chip.id === "answered"));
});

test("evidence call id opens the pooled row; bare sim id still works", () => {
  const pooledId = `${PUBLISHED_OCTOBER_12_RUN_ID}:uuid-b`;
  const rows = [
    call(`${OCTOBER_11_RUN_ID}:uuid-a`, OCTOBER_11_RUN_ID, "2026-10-11T06:00:00Z", 42),
    { ...call(pooledId, PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z", 42) },
  ];
  const byCall = applyExplorerFilter(rows, filterFromEvidence({ field: "sim", value: pooledId }));
  assert.deepEqual(byCall.map((row) => row.id), [pooledId]);
  const bySim = applyExplorerFilter(rows, filterFromEvidence({ field: "sim", value: "42" }));
  assert.equal(bySim.length, 2);
});

test("drift joins probes on audit_run_id and sim_id", () => {
  const calls = [
    call(`${OCTOBER_11_RUN_ID}:c1`, OCTOBER_11_RUN_ID, "2026-10-11T06:00:00Z", 7),
    call(`${PUBLISHED_OCTOBER_12_RUN_ID}:c2`, PUBLISHED_OCTOBER_12_RUN_ID, "2026-10-12T17:00:00Z", 7),
  ];
  const probes = [
    {
      audit_run_id: OCTOBER_11_RUN_ID,
      sim_id: 7,
      prompt_key: "pc",
      prompt: "Fact?",
      engine: "chatgpt",
      model: null,
      call_status: "answered",
      material_hallucination: "none" as const,
      hallucination_evidence: null,
      verified_claim: "Claim",
      verified_source_url: "https://www.fender.com/",
      verified_at: "2026-10-11T06:00:00Z",
      created_at: "2026-10-11T06:00:00Z",
    },
    {
      audit_run_id: PUBLISHED_OCTOBER_12_RUN_ID,
      sim_id: 7,
      prompt_key: "pc",
      prompt: "Fact?",
      engine: "chatgpt",
      model: null,
      call_status: "answered",
      material_hallucination: "none" as const,
      hallucination_evidence: null,
      verified_claim: "Claim",
      verified_source_url: "https://www.fender.com/",
      verified_at: "2026-10-12T17:00:00Z",
      created_at: "2026-10-12T17:00:00Z",
    },
  ];
  const drift = driftRead(calls, probes);
  assert.equal(drift.probes.length, 2);
  assert.equal(drift.probes[0].callId, `${OCTOBER_11_RUN_ID}:c1`);
  assert.equal(drift.probes[1].callId, `${PUBLISHED_OCTOBER_12_RUN_ID}:c2`);
  assert.equal(drift.probes[0].auditRunId, OCTOBER_11_RUN_ID);
});
