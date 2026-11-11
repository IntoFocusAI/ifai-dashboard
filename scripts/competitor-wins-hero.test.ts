// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/competitor-wins-hero.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { competitorsSpokeLead } from "../lib/ai-search/canvas-surfaces.ts";
import {
  competitorLeadPie,
  competitorWinsFigure,
} from "../lib/ai-search/competitor-wins-lead.ts";
import { competitorTallies } from "../lib/ai-search/competitors.ts";
import { headlineCompetitorWins } from "../lib/ai-search/question-role.ts";
import { summarizeRun } from "../lib/ai-search/summary.ts";
import type { AiCallRow, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function call(partial: Partial<AiCallRow> & Pick<AiCallRow, "id" | "sim_id">): AiCallRow {
  return {
    audit_run_id: "run-a",
    engine: "chatgpt",
    model: "gpt",
    category: "electric_guitar",
    prompt: "best beginner electric guitar",
    prompt_key: "u1",
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "competitor_win",
    primary_brand: "Yamaha",
    material_hallucination: "none",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2025-10-20T00:00:00Z",
    ...partial,
  };
}

function snapshot(calls: AiCallRow[]): AiSearchSnapshot {
  return {
    run: {
      audit_run_id: "run-a",
      run_state: "completed",
      collector_version: "v11",
      prompt_set_hash: null,
      expected_calls: calls.length,
      attempted_calls: calls.length,
      answered_calls: calls.length,
      error_calls: 0,
      started_at: "2025-10-20T00:00:00Z",
      completed_at: "2025-10-20T01:00:00Z",
      published_at: "2025-10-20T01:00:00Z",
      missing_calls: 0,
    },
    calls,
    probes: [],
    citations: [],
  };
}

test("hero figure matches the Competitive Radar spoke sentence", () => {
  const snap = snapshot([
    call({ id: "c1", sim_id: 1, outcome: "competitor_win", primary_brand: "Yamaha" }),
    call({ id: "c2", sim_id: 2, outcome: "fender_win", primary_brand: "Fender" }),
    call({ id: "c3", sim_id: 3, outcome: "competitor_win", primary_brand: "Taylor" }),
  ]);
  const summary = summarizeRun(snap);
  const figure = competitorWinsFigure(summary.competitorWins, summary.roles.unbranded.resolved);
  assert.equal(figure, competitorsSpokeLead({ phase: "ready", snapshot: snap }).figure);
  assert.equal(figure, "Competitors led 2 of 3 resolved unbranded discovery answers.");
  assert.equal(summary.competitorWins, competitorTallies(snap.calls).reduce((n, t) => n + t.wins, 0));
});

test("lead disc splits competitor-led versus Fender/Squier-led", () => {
  const pie = competitorLeadPie(2, 5);
  assert.ok(pie);
  assert.equal(pie.total, 5);
  assert.deepEqual(
    pie.slices.map((s) => [s.key, s.count, s.label]),
    [
      ["competitor_brand", 2, "Competitor led"],
      ["fender", 3, "Fender/Squier led"],
    ],
  );
});

test("zero resolved draws no disc; zero competitor wins draws no graph marks", () => {
  assert.equal(competitorLeadPie(0, 0), null);
  const empty = snapshot([
    call({ id: "c1", sim_id: 1, outcome: "fender_win", primary_brand: "Fender" }),
  ]);
  const summary = summarizeRun(empty);
  assert.equal(summary.competitorWins, 0);
  assert.deepEqual(headlineCompetitorWins(empty.calls), []);
  const pie = competitorLeadPie(summary.competitorWins, summary.roles.unbranded.resolved);
  assert.ok(pie);
  assert.deepEqual(
    pie.slices.map((s) => s.key),
    ["fender"],
  );
});

test("graph marks are largest win count first from headlineCompetitorWins", () => {
  const snap = snapshot([
    call({ id: "c1", sim_id: 1, primary_brand: "Taylor" }),
    call({ id: "c2", sim_id: 2, primary_brand: "Yamaha" }),
    call({ id: "c3", sim_id: 3, primary_brand: "Yamaha" }),
    call({ id: "c4", sim_id: 4, primary_brand: "Gibson" }),
  ]);
  const marks = headlineCompetitorWins(snap.calls);
  assert.deepEqual(
    marks.map((m) => [m.brand, m.wins]),
    [
      ["Yamaha", 2],
      ["Gibson", 1],
      ["Taylor", 1],
    ],
  );
  assert.deepEqual(
    marks.map((m) => m.brand),
    competitorTallies(snap.calls).map((t) => t.brand),
  );
});

test("Competitor Wins panel leads with the hero before the table title", () => {
  const panel = read("components/v3/live/ai-search/CompetitorWinsPanel.tsx");
  const hero = read("components/v3/live/ai-search/CompetitorWinsHero.tsx");
  assert.match(panel, /CompetitorWinsHero/);
  assert.match(hero, /ai-lead-figure/);
  assert.match(hero, /CitationPieDisc/);
  assert.match(hero, /headlineCompetitorWins/);
  assert.match(hero, /data-ai-competitor-graph/);
  assert.match(hero, /competitorWins > 0/);
  const titleAt = panel.indexOf("Competitors named more than {leadBrand()}");
  const barsAt = panel.indexOf("<CompetitorWinsBars");
  assert.ok(barsAt >= 0 && titleAt > barsAt, "title stays under the bars");
  assert.match(panel, /trailing=\{<CompetitorWinsHero \/>\}/, "hero rides the Engines switch row");
  assert.match(panel, /No competitor was named most/);
  assert.doesNotMatch(panel, /\u2014/);
  assert.doesNotMatch(hero, /\u2014/);
  assert.doesNotMatch(hero, /\stitle=/);
  assert.doesNotMatch(read("lib/ai-search/competitor-wins-lead.ts"), /\u2014/);
});
