// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-truth.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  aiMetrics,
  aiNodeFaces,
  aiPriorityItems,
  aiSpokeDesc,
  aiSpokeFullDesc,
  aiSpokeHeaderChips,
} from "../lib/ai-search/canvas-surfaces.ts";
import { canonicalUrl, citationEvidence, classifySource, groupCitations, isValidCitationUrl } from "../lib/ai-search/citations.ts";
import { categoryBattles, competitorTallies } from "../lib/ai-search/competitors.ts";
import { driftRead, PROBE_STATE_LABELS } from "../lib/ai-search/drift.ts";
import {
  FACT_CHECK_SCOPE,
  FACT_CHECK_SHOPPING_SCOPE,
  factCheckCoverageNote,
  factCheckHeadline,
  factCheckPendingNote,
  factCheckShortLine,
  factsCheckedLine,
} from "../lib/ai-search/fact-check-copy.ts";
import { parseEvidence } from "../lib/ai-search/evidence-focus.ts";
import { applyExplorerFilter, DEFAULT_FILTER, filterFromEvidence } from "../lib/ai-search/explorer-filter.ts";
import { loadAiSearchRead, type AiReadClient } from "../lib/ai-search/queries.ts";
import { genuineGuidance } from "../lib/ai-search/remediation.ts";
import {
  cleanPrompt,
  engineTallies,
  enginesAndModels,
  isSmallSample,
  modelLabel,
  tallyCommercial,
} from "../lib/ai-search/run-metrics.ts";
import { AI_DEFINITIONS } from "../lib/ai-search/definitions.ts";
import {
  categoryRoleTallies,
  engineRoleTallies,
  headlineCompetitorWins,
  questionRole,
  roleTally,
  sumRoleTallies,
  type QuestionRole,
  type RoleGroupTally,
} from "../lib/ai-search/question-role.ts";
import { formatObservedRate, headlineLine, roleRatePlainText, roleRateSort, summarizeRun } from "../lib/ai-search/summary.ts";
import type { AiCallRow, AiCitationRow, AiCurrentRun, AiProbeRow, AiSearchRead, AiSearchSnapshot } from "../lib/ai-search/types.ts";

const RUN = "run-current";
const OLD = "run-archived";

const run: AiCurrentRun = {
  audit_run_id: RUN,
  run_state: "partial",
  collector_version: "v11",
  prompt_set_hash: "hash",
  expected_calls: 9,
  attempted_calls: 9,
  answered_calls: 7,
  error_calls: 2,
  started_at: "2026-10-12T16:29:33Z",
  completed_at: "2026-10-12T17:02:10Z",
  published_at: "2026-10-12T17:02:36Z",
  missing_calls: 2,
};

function call(id: string, patch: Partial<AiCallRow>): AiCallRow {
  return {
    id,
    audit_run_id: RUN,
    sim_id: Number(id.replace(/\D/g, "")),
    engine: "chatgpt",
    model: null,
    category: "electrics",
    prompt: `Prompt ${id}`,
    prompt_key: `p${id}`,
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "fender_win",
    primary_brand: "Fender/Squier",
    material_hallucination: "not_evaluated",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-10-12T16:40:00Z",
    ...patch,
  };
}

const calls: AiCallRow[] = [
  call("c1", {}),
  call("c2", { category: "acoustics", outcome: "competitor_win", primary_brand: "Yamaha" }),
  call("c3", { engine: "gemini", model: "3.6 Flash", category: "acoustics", material_hallucination: "confirmed", hallucination_evidence: "Said 12 inch radius" }),
  call("c4", { engine: "gemini", model: "3.6 Flash", category: "basses", outcome: "unresolved", primary_brand: null }),
  call("c5", { engine: "perplexity", call_status: "error", outcome: "error", primary_brand: null, error_message: "empty answer" }),
  call("c6", { prompt_kind: "probe", category: "hallucinations", outcome: "not_scored", material_hallucination: "none" }),
  call("c7", { engine: "perplexity", prompt_kind: "probe", category: "hallucinations", call_status: "error", outcome: "error" }),
  call("c8", { engine: "gemini", model: "3.6 Flash", category: "acoustics", outcome: "competitor_win", primary_brand: "Taylor", prompt: "Best travel acoustic [gemini]" }),
  call("c9", { engine: "perplexity", model: "turbo", outcome: "fender_win" }),
];

const archived = call("c99", { audit_run_id: OLD, outcome: "fender_win" });

function cite(simulationId: string, position: number, url: string | null, domain: string | null): AiCitationRow {
  const row = calls.find((c) => c.id === simulationId) ?? archived;
  return {
    audit_run_id: row.audit_run_id,
    sim_id: row.sim_id,
    simulation_id: simulationId,
    prompt_key: row.prompt_key,
    prompt_kind: row.prompt_kind,
    category: row.category,
    engine: row.engine,
    position,
    url,
    domain,
    title: null,
  };
}

const citations: AiCitationRow[] = [
  cite("c1", 1, "https://www.fender.com/products/player-ii?utm_source=chatgpt", "www.fender.com"),
  cite("c1", 2, "https://fender.com/products/player-ii#:~:text=radius", "fender.com"),
  cite("c1", 3, "null", "null"),
  cite("c2", 1, "https://www.reddit.com/r/Guitar/comments/abc", "reddit.com"),
  cite("c8", 1, "https://www.sweetwater.com/store/detail/GSMini", "sweetwater.com"),
  cite("c8", 2, "", ""),
  cite("c6", 1, "https://www.fender.com/products/mustang-micro", "fender.com"),
];

const probes: AiProbeRow[] = [
  { audit_run_id: RUN, sim_id: 6, prompt_key: "pc6", prompt: "Mustang Micro tubes? (chatgpt)", engine: "chatgpt", model: null, call_status: "answered", material_hallucination: "none", hallucination_evidence: null, verified_claim: "No tubes.", verified_source_url: "https://www.fender.com/products/mustang-micro", verified_at: "2026-10-12T15:37:00Z", created_at: "2026-10-12T16:47:00Z" },
  { audit_run_id: RUN, sim_id: 7, prompt_key: "pc7", prompt: "Telecaster wood?", engine: "perplexity", model: null, call_status: "error", material_hallucination: "not_evaluated", hallucination_evidence: null, verified_claim: null, verified_source_url: null, verified_at: null, created_at: "2026-10-12T16:47:00Z" },
];

const snapshot: AiSearchSnapshot = { run, calls, probes, citations };
const ready: AiSearchRead = { phase: "ready", snapshot };

type Rows = Record<string, unknown[]>;
function fakeClient(rows: Rows, failing?: string): AiReadClient {
  return {
    from(view: string) {
      const result = () => Promise.resolve(failing === view ? { data: null, error: { message: `${view} failed` } } : { data: rows[view] ?? [], error: null });
      const ordered = Object.assign(result(), { range: () => result(), order: (): unknown => ordered });
      return { select: () => Object.assign(result(), { order: () => ordered }) };
    },
  } as AiReadClient;
}

test("one explicit published run: none, many, and other-run rows", async () => {
  assert.deepEqual(await loadAiSearchRead(fakeClient({ canvas_ai_current_run: [] })), { phase: "no-run" });
  const many = await loadAiSearchRead(fakeClient({ canvas_ai_current_run: [run, { ...run, audit_run_id: OLD }] }));
  assert.equal(many.phase, "error");
  const read = await loadAiSearchRead(
    fakeClient({ canvas_ai_current_run: [run], canvas_ai_simulations: [...calls, archived], canvas_ai_probes: probes, canvas_ai_citations: [...citations, cite("c99", 1, "https://x.com/a", "x.com")] }),
  );
  assert.equal(read.phase, "ready");
  if (read.phase !== "ready") return;
  assert.equal(read.snapshot.calls.length, calls.length);
  assert.ok(read.snapshot.calls.every((row) => row.audit_run_id === RUN));
  assert.ok(read.snapshot.citations.every((row) => row.audit_run_id === RUN));
});

test("a failed view is an error state, not zeros", async () => {
  const read = await loadAiSearchRead(fakeClient({ canvas_ai_current_run: [run] }, "canvas_ai_citations"));
  assert.equal(read.phase, "error");
  for (const phase of [{ phase: "loading" }, { phase: "error", message: "boom" }, { phase: "no-run" }] as AiSearchRead[]) {
    const faces = aiNodeFaces(phase);
    const text = Object.values(faces).flatMap((f) => [f.title, ...f.stats, f.meta ?? ""]).join(" ");
    assert.doesNotMatch(text, /\d/, `${phase.phase} faces show no count`);
    const metrics = Object.values(aiMetrics(phase));
    assert.ok(metrics.every((m) => !/^\d/.test(m.value)), `${phase.phase} metrics show no count`);
    assert.deepEqual(aiPriorityItems(phase), []);
  }
});

test("commercial win rate: exact numerator and denominator, probes and errors apart", () => {
  const t = tallyCommercial(calls);
  assert.equal(t.calls, 7);
  assert.equal(t.fenderWins, 2, "c1 and c9; c3 is disqualified");
  assert.equal(t.disqualified, 1);
  assert.equal(t.competitorWins, 2);
  assert.equal(t.resolved, 5, "disqualified stays in the denominator");
  assert.equal(t.unresolved, 1);
  assert.equal(t.errors, 1);
  assert.equal(t.winPct, 40);
  const s = summarizeRun(snapshot);
  assert.equal(s.probesAnswered, 1);
  // The line sits above all four tabs, so it names the area, not the Citation Ecosystem alone.
  assert.equal(aiSpokeDesc(ready), "How AI assistants name and cite Fender.");
  assert.doesNotMatch(aiSpokeDesc(ready), /Partial/);
  assert.doesNotMatch(aiSpokeDesc(ready), /2 of 5/);
  assert.match(aiSpokeFullDesc(ready), /Unbranded discovery: Fender\/Squier named most in 0 of 1 resolved answers \(0\.0%\)/);
  assert.match(aiSpokeFullDesc(ready), /Branded consideration: no resolved answers/);
  const chips = aiSpokeHeaderChips(ready);
  assert.ok(chips.some((chip) => chip.id === "unbranded" && /0 of 1/.test(chip.value)));
  assert.ok(chips.some((chip) => chip.id === "errors" && /provider errors/i.test(chip.value)));
});

test("probes never appear as a commercial category or competitor", () => {
  assert.ok(categoryBattles(calls).every((b) => b.category !== "hallucinations"));
  // Only unbranded discovery competitor wins: c8 (Taylor). c2 Yamaha is not unbranded discovery.
  assert.deepEqual(competitorTallies(calls).map((t) => t.brand), ["Taylor"]);
  assert.equal(competitorTallies(calls)[0]?.wins, 1);
  assert.equal(competitorTallies(calls)[0]?.resolved, 1);
  assert.ok(summarizeRun(snapshot).categories.every((c) => c.key !== "hallucinations"));
});

test("engine and model provenance, with small samples flagged", () => {
  assert.deepEqual(enginesAndModels(calls), [
    { engine: "chatgpt", models: [] },
    { engine: "gemini", models: ["3.6 Flash"] },
    { engine: "perplexity", models: ["turbo"] },
  ]);
  assert.equal(modelLabel(null), "not recorded");
  const engines = engineTallies(calls);
  assert.deepEqual(engines.map((e) => [e.key, e.resolved]), [["chatgpt", 2], ["gemini", 2], ["perplexity", 1]]);
  assert.equal(isSmallSample(7, 28), true);
  assert.equal(isSmallSample(28, 28), false);
});

test("engine tags never reach visible prompts", () => {
  assert.equal(cleanPrompt("Best travel acoustic [gemini]"), "Best travel acoustic");
  assert.equal(cleanPrompt("Mustang Micro tubes? (chatgpt)"), "Mustang Micro tubes?");
  assert.equal(cleanPrompt("Best amp | Perplexity"), "Best amp");
  assert.equal(cleanPrompt("Fender vs PRS"), "Fender vs PRS");
});

test("citations: canonical URLs, literal null dropped, Fender-owned apart from third party", () => {
  assert.equal(isValidCitationUrl("null"), false);
  assert.equal(isValidCitationUrl(""), false);
  assert.equal(canonicalUrl("https://www.fender.com/a/?utm_source=x#frag"), "https://fender.com/a");
  const read = citationEvidence(calls, citations, "commercial");
  assert.equal(read.stored, 6);
  assert.equal(read.invalid, 2);
  assert.equal(read.duplicates, 1);
  assert.deepEqual(read.rows.map((r) => r.domain), ["fender.com", "reddit.com", "sweetwater.com"]);
  assert.equal(read.answersWithCitation, 3);
  assert.equal(read.answered, 6);
  assert.equal(classifySource("uk.fender.com"), "fender_owned");
  assert.equal(classifySource("reddit.com"), "community");
  const domains = groupCitations(read.rows, (r) => r.domain);
  assert.equal(domains.find((d) => d.key === "fender.com")?.fenderOwnedRows, 1);
  assert.equal(citationEvidence(calls, citations, "probe").rows.length, 1);
});

test("remediation shows only when genuine", () => {
  assert.equal(genuineGuidance(null), null);
  assert.equal(genuineGuidance("  "), null);
  assert.equal(genuineGuidance("null"), null);
  const answer = "The Player II has a 9.5 inch radius and modern C neck profile.";
  assert.equal(genuineGuidance("The Player II has a 9.5 inch radius", answer), null);
  assert.equal(genuineGuidance("Add fingerboardRadius to the Player II JSON-LD", answer), "Add fingerboardRadius to the Player II JSON-LD");
});

test("AI Drift uses verified probe evidence only", () => {
  const d = driftRead(calls, probes);
  assert.equal(d.checked, 1);
  assert.equal(d.confirmed, 0);
  assert.equal(d.errors, 1);
  assert.equal(d.commercialConfirmed, 1);
  assert.equal(d.probes[0].prompt, "Mustang Micro tubes?");
  const confirmedNoEvidence = driftRead(calls, [{ ...probes[0], material_hallucination: "confirmed" }]);
  assert.equal(confirmedNoEvidence.confirmed, 0, "confirmed without evidence is never shown as confirmed");
  assert.equal(confirmedNoEvidence.unverified, 1);
});

test("AI freshness is the run's completion time, and partial runs say so", () => {
  const faces = aiNodeFaces(ready);
  assert.match(faces.satPrompts.meta ?? "", /Completed Oct 12, 2026, 5:02 PM UTC/);
  assert.match(faces.spokeAeo.meta ?? "", /Partial run · 7 of 9 answered/);
  assert.equal(faces.satPrompts.tooltip.desc, "");
  assert.ok(faces.satPrompts.heroValue?.value);
  assert.equal(faces.satCitations.tooltip.desc, "");
  assert.equal(faces.satDrift.tooltip.desc, "");
  assert.equal(faces.satGap.tooltip.desc, "");
  assert.equal(faces.satLead.tooltip.desc, "");
  assert.match(aiSpokeFullDesc(ready), /provider errors/);
  assert.ok(aiSpokeHeaderChips(ready).some((chip) => /provider errors/i.test(chip.value)));
});

test("client priorities come from run evidence, never pipeline work", () => {
  const items = aiPriorityItems(ready);
  assert.deepEqual(items.map((i) => i.id), ["ai-confirmed-contradiction", "ai-competitor-gap"]);
  const gap = items[1];
  assert.match(
    gap.title,
    /Taylor out-mention Fender\/Squier in 1 of 1 resolved unbranded discovery acoustics answers/,
  );
  assert.match(gap.why, /unbranded discovery/);
  assert.doesNotMatch(gap.title + gap.why, /commercial prompts/i);
  assert.equal(gap.subTab, "Competitor Wins");
  const text = items.map((i) => `${i.title} ${i.why} ${i.impact}`).join(" ");
  assert.doesNotMatch(text, /collector|battery|normaliz|parse|schema column|database|retry/i);
});

test("drill-down links map to explorer filters", () => {
  assert.deepEqual(parseEvidence("sim:1161"), { field: "sim", value: "1161" });
  assert.equal(parseEvidence("bogus:1"), null);
  const errors = applyExplorerFilter(calls, filterFromEvidence({ field: "outcome", value: "error" }));
  assert.deepEqual(errors.map((r) => r.id), ["c5", "c7"]);
  const resolved = applyExplorerFilter(calls, filterFromEvidence({ field: "outcome", value: "resolved" }));
  assert.equal(resolved.length, 5);
  const unbranded = applyExplorerFilter(calls, filterFromEvidence({ field: "role", value: "unbranded_discovery/resolved" }));
  assert.deepEqual(unbranded.map((r) => r.id), ["c8"]);
  const yamaha = applyExplorerFilter(calls, filterFromEvidence({ field: "competitor", value: "Yamaha" }));
  assert.deepEqual(yamaha.map((r) => r.id), ["c2"]);
  assert.ok(applyExplorerFilter(calls, DEFAULT_FILTER).every((r) => r.prompt_kind === "commercial"));
  assert.deepEqual(applyExplorerFilter(calls, filterFromEvidence({ field: "kind", value: "probe" })).map((r) => r.id), ["c6", "c7"]);
});

/* The published run shape: 5 product questions times 3 engines, 4 of them with a
   verified Fender fact, Perplexity failing every call. */
function factCheckRun(): AiProbeRow[] {
  const facts: Record<string, string | null> = {
    p17: "Player II Stratocaster fingerboard radius is 9.5 inches.",
    p18: null,
    p19: "Mustang Micro is a digital headphone amp with no tube section.",
    p33: "Jaguar scale length is 24 inches.",
    p34: "Player Plus Stratocaster uses Player Plus Noiseless pickups.",
  };
  const rows: AiProbeRow[] = [];
  let simId = 1160;
  for (const [key, claim] of Object.entries(facts)) {
    for (const engine of ["chatgpt", "perplexity", "gemini"]) {
      simId += 1;
      const failed = engine === "perplexity";
      rows.push({
        audit_run_id: RUN,
        sim_id: simId,
        prompt_key: key,
        prompt: `Question ${key}`,
        engine,
        model: engine === "gemini" ? "3.6 Flash" : null,
        call_status: failed ? "error" : "answered",
        material_hallucination: failed ? "not_evaluated" : claim ? "none" : "not_evaluated",
        hallucination_evidence: null,
        verified_claim: claim,
        verified_source_url: claim ? `https://www.fender.com/products/${key}` : null,
        verified_at: "2026-10-12T15:37:00Z",
        created_at: "2026-10-12T16:47:00Z",
      });
    }
  }
  return rows;
}

test("fact-check coverage counts questions, facts, answers, and failures apart", () => {
  const c = driftRead([], factCheckRun()).coverage;
  assert.equal(c.questionsSent, 5);
  assert.equal(c.questionsWithFact, 4);
  assert.equal(c.factsChecked, 4);
  assert.equal(c.answersChecked, 8);
  assert.equal(c.contradictions, 0);
  assert.deepEqual(c.checkedEngines, ["ChatGPT", "Gemini"]);
  assert.deepEqual(c.questionsWithoutFact, ["p18"]);
  assert.equal(c.answersWithoutFact, 2);
  assert.equal(c.failedCalls, 5);
  assert.deepEqual(c.failedEngines, ["Perplexity"]);
});

test("the fact-check headline leads with four facts and eight answers", () => {
  const c = driftRead([], factCheckRun()).coverage;
  assert.equal(
    factCheckHeadline(c),
    "4 Fender product facts were checked across ChatGPT and Gemini. No contradictions were found in 8 answers.",
  );
  assert.equal(factsCheckedLine(c), "4 facts checked");
  assert.equal(factCheckShortLine(c), "No contradictions in 8 answers");
  // Never a zero-led commercial coverage claim.
  assert.doesNotMatch(factCheckHeadline(c), /\b0\b|of 65|commercial/i);
  assert.match(FACT_CHECK_SCOPE, /do not prove every statement/);
  assert.match(FACT_CHECK_SHOPPING_SCOPE, /not every factual claim in the shopping answers/);
});

test("a contradiction changes the headline instead of hiding it", () => {
  const rows = factCheckRun().map((row) =>
    row.sim_id === 1161
      ? { ...row, material_hallucination: "confirmed", hallucination_evidence: "Said 12 inch radius" }
      : row,
  );
  const c = driftRead([], rows).coverage;
  assert.equal(c.contradictions, 1);
  assert.match(factCheckHeadline(c), /1 of 8 answers contradicted the verified fact/);
});

test("provider failures and pending facts are secondary notes", () => {
  const c = driftRead([], factCheckRun()).coverage;
  assert.equal(factCheckCoverageNote(c), "Perplexity did not return answers for 5 fact-check calls.");
  assert.match(factCheckPendingNote(c) ?? "", /1 question has no verified Fender fact yet, so 2 answers were not evaluated/);
  const clean = factCheckRun().filter((row) => row.engine !== "perplexity");
  assert.equal(factCheckCoverageNote(driftRead([], clean).coverage), null);
});

test("fact-check results read in client language", () => {
  assert.equal(PROBE_STATE_LABELS.no_contradiction, "No contradiction found for this fact");
  assert.equal(PROBE_STATE_LABELS.no_fact, "No verified fact available");
  assert.equal(PROBE_STATE_LABELS.provider_error, "No answer returned");
  const rows = driftRead([], factCheckRun()).probes;
  const p18 = rows.filter((row) => row.promptKey === "p18" && row.state !== "provider_error");
  assert.equal(p18.length, 2);
  for (const row of p18) assert.equal(PROBE_STATE_LABELS[row.state], "No verified fact available");
});

test("no empty read reports a fact-check result", () => {
  const empty = driftRead([], []).coverage;
  assert.equal(factCheckHeadline(empty), "This run sent no product fact checks.");
  assert.equal(factCheckCoverageNote(empty), null);
  assert.equal(factCheckPendingNote(empty), null);
  const allFailed = factCheckRun().map((row) => ({ ...row, call_status: "error", material_hallucination: "not_evaluated" }));
  assert.match(factCheckHeadline(driftRead([], allFailed).coverage), /No product fact check completed/);
});

test("the four new client definitions exist with their own wording", () => {
  const expected: Array<[string, RegExp]> = [
    ["shopping answer", /one AI engine to one shopping prompt/],
    ["cited link", /does not prove that the source caused or endorsed/],
    ["Fender-owned", /controlled by Fender or another FMIC brand/],
    ["source class", /brand-owned, retailer, editorial, community, video, or other/],
  ];
  for (const [term, pattern] of expected) {
    const definition = (AI_DEFINITIONS as Record<string, string>)[term];
    assert.ok(definition, `${term} is defined`);
    assert.match(definition, pattern, term);
  }
  for (const definition of Object.values(AI_DEFINITIONS)) {
    assert.doesNotMatch(definition, /caused the recommendation\b(?! )/);
  }
});

test("citation reads keep answers and links as separate denominators", () => {
  // One answer citing three pages must not read as three cited answers.
  const many = [
    cite("c1", 1, "https://www.fender.com/products/player-ii", "fender.com"),
    cite("c1", 2, "https://www.guitarworld.com/review", "guitarworld.com"),
    cite("c1", 3, "https://www.sweetwater.com/store/detail/p", "sweetwater.com"),
    cite("c2", 1, "https://www.reddit.com/r/Guitar/comments/abc", "reddit.com"),
  ];
  const read = citationEvidence(calls, many, "commercial");
  assert.equal(read.rows.length, 4, "cited links");
  assert.equal(read.answersWithCitation, 2, "answers that cited anything");
  assert.equal(read.answered, 6, "answered shopping calls");
  const fender = read.rows.filter((row) => row.sourceClass === "fender_owned");
  assert.equal(fender.length, 1);
  assert.equal(new Set(fender.map((row) => row.simulationId)).size, 1);
});

/** Stored prompt text from the published run, with each engine's outcome. */
const PUBLISHED_PROMPTS: Array<[string, string, string, Array<AiCallRow["outcome"]>]> = [
  ["p01", "commercial", "Best electric guitar under $900 for versatile tones", ["fender_win", "fender_win", "error"]],
  ["p02", "commercial", "Fender American Professional II Stratocaster vs PRS Silver Sky SE", ["fender_win", "fender_win", "error"]],
  ["p03", "commercial", "Is the Fender Player II Stratocaster good for beginners?", ["fender_win", "fender_win", "error"]],
  ["p04", "commercial", "What are the pickup types on a Fender Player II Stratocaster?", ["fender_win", "fender_win", "error"]],
  ["p05", "commercial", "Best guitar for indie rock under $1000", ["fender_win", "fender_win", "error"]],
  ["p06", "commercial", "Best travel acoustic guitar for intermediate players", ["competitor_win", "competitor_win", "error"]],
  ["p07", "commercial", "Best beginner acoustic guitar under $250 with solid top", ["competitor_win", "competitor_win", "error"]],
  ["p08", "commercial", "Fender Acoustasonic Player Telecaster pickup types and sounds", ["fender_win", "fender_win", "fender_win"]],
  ["p09", "commercial", "Best headphone guitar amp with bluetooth for quiet practice", ["fender_win", "fender_win", "error"]],
  ["p10", "commercial", "Fender Tone Master Deluxe Reverb tube types and biasing instructions", ["fender_win", "fender_win", "fender_win"]],
  ["p11", "commercial", "Best professional bass guitar for recording and gigging under $1000", ["fender_win", "error", "competitor_win"]],
  ["p12", "commercial", "Fender Player Precision Bass vs Sire Marcus Miller P5", ["fender_win", "fender_win", "unresolved"]],
  ["p13", "commercial", "Best budget Stratocaster alternative for upgrading mod platform", ["fender_win", "fender_win", "error"]],
  ["p14", "commercial", "Is Squier Classic Vibe 60s Stratocaster good quality?", ["fender_win", "fender_win", "fender_win"]],
  ["p15", "commercial", "What is the best first electric guitar for a total beginner?", ["fender_win", "fender_win", "error"]],
  ["p16", "commercial", "Fender vs Yamaha for a beginner guitarist", ["fender_win", "fender_win", "fender_win"]],
  ["p17", "probe", "Fender Player II Stratocaster neck radius and fret size", ["not_scored", "not_scored", "error"]],
  ["p20", "commercial", "Fender Telecaster vs Gibson Les Paul for rock music", ["fender_win", "fender_win", "error"]],
  ["p21", "commercial", "Best semi-hollow electric guitar under $1500", ["competitor_win", "competitor_win", "competitor_win"]],
  ["p22", "commercial", "Fender CD-60S vs Yamaha FG800 for a beginner", ["fender_win", "error", "competitor_win"]],
  ["p23", "commercial", "Boss Katana vs Fender Mustang for home practice", ["fender_win", "fender_win", "error"]],
  ["p24", "commercial", "Best 5-string bass guitar for gigging musicians", ["competitor_win", "competitor_win", "error"]],
  ["p25", "commercial", "Squier Affinity vs Squier Bullet Stratocaster differences", ["fender_win", "fender_win", "error"]],
  ["p26", "commercial", "How much should a beginner spend on their first guitar", ["unresolved", "error", "competitor_win"]],
  ["p27", "commercial", "What makes the Fender American Ultra II different from American Professional II", ["fender_win", "fender_win", "error"]],
  ["p28", "commercial", "Best guitar for playing blues under $800", ["fender_win", "fender_win", "error"]],
  ["p29", "commercial", "Best parlor acoustic guitar for small hands", ["fender_win", "fender_win", "error"]],
  ["p30", "commercial", "Positive Grid Spark vs Fender Mustang Micro comparison", ["fender_win", "fender_win", "fender_win"]],
  ["p31", "commercial", "Fender Jazz Bass vs Precision Bass tonal differences", ["fender_win", "fender_win", "error"]],
  ["p32", "commercial", "Is Squier a good brand or just a cheap knockoff", ["fender_win", "fender_win", "error"]],
];

const PUBLISHED_ENGINES = ["chatgpt", "gemini", "perplexity"] as const;
const PUBLISHED_CATEGORIES = ["electrics", "acoustics", "basses", "amps"] as const;

function publishedRows(): AiCallRow[] {
  return PUBLISHED_PROMPTS.flatMap(([key, kind, prompt, outcomes], promptIndex) =>
    outcomes.map((outcome, index) =>
      call(`p${promptIndex}-${index}`, {
        prompt_key: key,
        prompt_kind: kind,
        prompt,
        engine: PUBLISHED_ENGINES[index] ?? "chatgpt",
        category: kind === "probe" ? "hallucinations" : PUBLISHED_CATEGORIES[promptIndex % PUBLISHED_CATEGORIES.length],
        call_status: outcome === "error" ? "error" : "answered",
        outcome,
        primary_brand: outcome === "fender_win" ? "Fender/Squier" : outcome === "competitor_win" ? "Yamaha" : null,
      }),
    ),
  );
}

function assertRoleSums(groups: RoleGroupTally[]) {
  const summed = (role: QuestionRole) => sumRoleTallies(groups, role);
  assert.equal(summed("unbranded_discovery").fenderWins, 13);
  assert.equal(summed("unbranded_discovery").resolved, 23);
  assert.equal(summed("branded_consideration").fenderWins, 22);
  assert.equal(summed("branded_consideration").resolved, 23);
  assert.equal(summed("brand_associated_discovery").fenderWins, 2);
  assert.equal(summed("brand_associated_discovery").resolved, 2);
  const guidance = summed("shopping_guidance");
  assert.equal(guidance.fenderWins, 0);
  assert.equal(guidance.resolved, 1);
  assert.equal(guidance.unresolved, 1);
  assert.equal(guidance.errors, 1);
  assert.equal(summed("product_fact").fenderWins, 14);
  assert.equal(summed("product_fact").resolved, 14);
  assert.equal(summed("other").calls, 0);
  assert.equal(summed("other").resolved, 0);
}

test("shopping questions split into the audited discovery and consideration rates", () => {
  const rows = publishedRows();
  const unbranded = roleTally(rows, "unbranded_discovery");
  const branded = roleTally(rows, "branded_consideration");
  const associated = roleTally(rows, "brand_associated_discovery");
  const guidance = roleTally(rows, "shopping_guidance");
  const facts = roleTally(rows, "product_fact");

  assert.equal(unbranded.fenderWins, 13);
  assert.equal(unbranded.resolved, 23);
  assert.equal(branded.fenderWins, 22);
  assert.equal(branded.resolved, 23);
  assert.equal(associated.fenderWins, 2);
  assert.equal(associated.resolved, 2);
  assert.equal(guidance.resolved, 1);
  assert.equal(guidance.unresolved, 1);
  assert.equal(guidance.errors, 1);
  assert.equal(facts.resolved, 14);
  assert.equal(unbranded.resolved + branded.resolved + associated.resolved + guidance.resolved + facts.resolved, 63);
  assert.equal(rows.filter((row) => questionRole(row) === "other").length, 0);

  const summary = summarizeRun({ ...snapshot, calls: rows });
  assert.equal(
    headlineLine(summary),
    "Unbranded discovery: Fender/Squier named most in 13 of 23 resolved answers (56.5%). Branded consideration: 22 of 23 resolved answers (95.7%).",
  );
  const opened = applyExplorerFilter(rows, filterFromEvidence({ field: "role", value: "unbranded_discovery/resolved" }));
  assert.equal(opened.length, 23);
  assert.ok(opened.every((row) => questionRole(row) === "unbranded_discovery"));
  assert.equal(opened.filter((row) => row.outcome === "unresolved" || row.outcome === "error").length, 0);

  const engines = engineRoleTallies(rows);
  const categories = categoryRoleTallies(rows);
  assert.ok(engines.length > 1);
  assert.ok(categories.length > 1);
  assertRoleSums(engines);
  assertRoleSums(categories);
  for (const role of ["unbranded_discovery", "branded_consideration", "brand_associated_discovery", "shopping_guidance", "product_fact", "other"] as const) {
    const direct = roleTally(rows, role);
    assert.equal(sumRoleTallies(engines, role).fenderWins, direct.fenderWins, role);
    assert.equal(sumRoleTallies(engines, role).resolved, direct.resolved, role);
    assert.equal(sumRoleTallies(engines, role).unresolved, direct.unresolved, role);
    assert.equal(sumRoleTallies(engines, role).errors, direct.errors, role);
    assert.equal(sumRoleTallies(categories, role).calls, direct.calls, role);
    assert.equal(sumRoleTallies(categories, role).competitorWins, direct.competitorWins, role);
  }
  assert.ok(categories.every((group) => group.key !== "hallucinations"));
  assert.equal(rows.filter((row) => questionRole(row) === "other").length, 0);

  const unbrandedCompetitorWins = roleTally(rows, "unbranded_discovery").competitorWins;
  const brandedCompetitorWins = roleTally(rows, "branded_consideration").competitorWins;
  const headlineWins = headlineCompetitorWins(rows).reduce((sum, brand) => sum + brand.wins, 0);
  const keptOutWins = (
    ["branded_consideration", "brand_associated_discovery", "shopping_guidance", "product_fact", "other"] as const
  ).reduce((sum, role) => sum + roleTally(rows, role).competitorWins, 0);
  assert.ok(keptOutWins > 0, "a kept-out question has a competitor win");
  assert.ok(brandedCompetitorWins > 0, "branded consideration still has competitor wins outside the rate");
  assert.equal(headlineWins, unbrandedCompetitorWins);
  assert.notEqual(headlineWins, unbrandedCompetitorWins + brandedCompetitorWins);
  assert.equal(headlineWins + keptOutWins, tallyCommercial(rows).competitorWins);

  const tallies = competitorTallies(rows);
  assert.equal(
    tallies.reduce((sum, row) => sum + row.wins, 0),
    unbrandedCompetitorWins,
  );
  assert.ok(tallies.every((row) => row.resolved === unbranded.resolved));
  assert.equal(summary.competitorWins, unbrandedCompetitorWins);
  assert.equal(summary.topCompetitor?.resolved, unbranded.resolved);

  assert.equal(formatObservedRate(unbranded.fenderWins, unbranded.resolved), "56.5% (13 of 23)");
  assert.equal(formatObservedRate(branded.fenderWins, branded.resolved), "95.7% (22 of 23)");
  assert.equal(roleRatePlainText(unbranded.fenderWins, unbranded.resolved, unbranded.resolved), "56.5% (13 of 23)");
  assert.equal(roleRatePlainText(branded.fenderWins, branded.resolved, branded.resolved), "95.7% (22 of 23)");
});

test("a small sample shows its exact percentage and stays unranked", () => {
  assert.equal(roleRatePlainText(1, 4, 4), "25.0% (1 of 4) Small sample");
  assert.equal(formatObservedRate(1, 4), "25.0% (1 of 4)");
  assert.equal(isSmallSample(4, 4), true);
  assert.equal(roleRateSort({ fenderWins: 1, resolved: 4 }, 4), null);
  assert.equal(roleRateSort({ fenderWins: 1, resolved: 4 }, 23), null);

  assert.equal(roleRatePlainText(0, 0, 23), "No resolved answers");
  assert.equal(formatObservedRate(0, 0), null);
  assert.equal(roleRateSort({ fenderWins: 0, resolved: 0 }, 23), null);
  assert.doesNotMatch(roleRatePlainText(0, 0, 23), /%|Small sample/);

  assert.equal(roleRatePlainText(13, 23, 23), "56.5% (13 of 23)");
  assert.equal(roleRatePlainText(22, 23, 23), "95.7% (22 of 23)");
  assert.equal(roleRateSort({ fenderWins: 13, resolved: 23 }, 23), 13 / 23);
  assert.equal(roleRateSort({ fenderWins: 22, resolved: 23 }, 23), 22 / 23);
  assert.equal(
    AI_DEFINITIONS["small sample"],
    "The percentage describes this run exactly, but it is based on relatively few answers or substantially fewer answers than another row beside it. A few additional answers could move it sharply, so do not treat it as a stable ranking.",
  );
});

test("publishing a finished run does not require an engine answer rate", () => {
  const sql = readFileSync("supabase/migrations/20261026160000_publish_without_engine_floor.sql", "utf8");
  const body = sql.slice(sql.indexOf("AS $f$"));
  assert.match(sql, /CREATE OR REPLACE FUNCTION command\.fmic_ai_publish_run/);
  assert.match(body, /attempted_calls IS DISTINCT FROM n/);
  assert.doesNotMatch(body, /ceil\(0\.7|engine below 70/);
});
