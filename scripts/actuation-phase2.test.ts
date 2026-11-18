// SC-03 phase 2 (Worker 27.14): Actuation in AI Consensus at 40/40/20, 0 at launch, lapsed equals
// never, E1 from the Citation Ecosystem data with the engine rule, and the chart marker.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AiCallRow, AiCitationRow, AiSearchRead } from "../lib/ai-search/types.ts";
import { runWithClient } from "../lib/client/server-client.ts";
import { actuationFactorRows, actuationPartial, e1FactorTip } from "../lib/fender-canvas/actuation-display.ts";
import { engineOwnedAnswers, ownedAnswersFromAi } from "../lib/fender-canvas/actuation-e1.ts";
import { clientBasis, type ClientBasisRow } from "../lib/fender-canvas/actuation-records.ts";
import { addDays, e1Tooltip, scoreActuation } from "../lib/fender-canvas/actuation-score.ts";
import {
  CONSENSUS_PILLAR_WEIGHTS,
  consensusScore,
  type CommerceInputs,
  type FoundationInputs,
} from "../lib/fender-canvas/consensus-scores.ts";
import { actuationFromLive } from "../lib/fender-canvas/consensus-scores-from-live.ts";
import {
  ACTUATION_ADDED_NOTE,
  scoreHistoryModel,
  scorePointTip,
  type ScoreSnapshotRow,
} from "../lib/fender-canvas/score-history.ts";
import { weakestScoreCard } from "../lib/fender-canvas/weakest-score-card.ts";

const ASOF = "2026-11-16";

/** Foundation 50 and Commerce 60: one component each, so the pillar score is that share. */
const FOUNDATION: FoundationInputs = {
  exactOfficialPages: { numerator: 50, denominator: 100 },
  machineReadableSpecs: null,
  requiredMarketplaceSpecs: null,
  unbrandedNamedMost: null,
  factCheckMatch: null,
};
const COMMERCE: CommerceInputs = {
  controlledBuyBox: null,
  notSuppressed: { numerator: 60, denominator: 100 },
  activeProductsAvailable: null,
  notSplintered: null,
  noMapViolation: null,
};

/** public.actuation_basis for a client with no records, exactly as production returns it today. */
const LAUNCH_ROWS: ClientBasisRow[] = [
  { factor: "P1", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: null },
  { factor: "P2", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: null },
  { factor: "E2", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: 0 },
  { factor: "E3", in_place: false, verified_on: null, expires_on: null, target_domain_count: null, cadence_per_30_days: null, target_count: null, items_in_window: 0 },
];

function call(patch: Partial<AiCallRow>): AiCallRow {
  return {
    id: "row",
    audit_run_id: "run",
    sim_id: 1,
    engine: "perplexity",
    model: null,
    category: "beginner",
    prompt: "Best guitar under $300",
    prompt_key: "p",
    prompt_kind: "commercial",
    call_status: "answered",
    outcome: "competitor_win",
    primary_brand: "Yamaha",
    material_hallucination: "not_evaluated",
    hallucination_evidence: null,
    root_cause: null,
    remediation_patch: null,
    error_message: null,
    attempt_no: 1,
    repeat_no: 1,
    created_at: "2026-11-10T12:00:00.000Z",
    ...patch,
  };
}

function cite(simulationId: string, engine: string, url: string, domain: string): AiCitationRow {
  return {
    audit_run_id: "run",
    sim_id: 1,
    simulation_id: simulationId,
    prompt_key: "p",
    prompt_kind: "commercial",
    category: "beginner",
    engine,
    position: 1,
    url,
    domain,
    title: null,
  };
}

/**
 * Perplexity (search): 4 unbranded answers, 1 cites fender.com. Gemini (search): 2 unbranded answers,
 * cites only a retailer. ChatGPT (API): 4 unbranded answers, no citation at all, so E1 leaves it out.
 */
function windowRead(apiCites = false): AiSearchRead {
  const calls = [
    ...[1, 2, 3, 4].map((n) => call({ id: `p${n}`, sim_id: n, engine: "perplexity" })),
    ...[5, 6].map((n) => call({ id: `g${n}`, sim_id: n, engine: "gemini" })),
    ...[7, 8, 9, 10].map((n) => call({ id: `a${n}`, sim_id: n, engine: "openai_api" })),
  ];
  const citations = [
    cite("p1", "perplexity", "https://www.fender.com/en-US/electric-guitars/", "fender.com"),
    cite("p2", "perplexity", "https://www.sweetwater.com/guitars", "sweetwater.com"),
    cite("g5", "gemini", "https://www.guitarcenter.com/guitars", "guitarcenter.com"),
    ...(apiCites ? [cite("a7", "openai_api", "https://www.fender.com/en-US/squier/", "fender.com")] : []),
  ];
  return {
    phase: "ready",
    snapshot: { run: { audit_run_id: "run" } as never, calls, probes: [], citations, storedCitationCount: citations.length },
  } as AiSearchRead;
}

test("AI Consensus weights are 40% Foundation, 40% Commerce, 20% Actuation (decisions 77, 78)", () => {
  assert.deepEqual(CONSENSUS_PILLAR_WEIGHTS, { foundation: 40, commerce: 40, actuation: 20 });
  const actuation = scoreActuation({ asOf: ASOF, programs: [], items: { E2: 0, E3: 0 }, ownedAnswers: { withOwned: 3, resolved: 100 } });
  assert.equal(actuation.score, 6, "E1 3% of a 15% target is 6 of 30 points");
  const consensus = consensusScore(FOUNDATION, COMMERCE, { actuation });
  assert.equal(consensus.foundation.weight, 40);
  assert.equal(consensus.commerce.weight, 40);
  assert.equal(consensus.actuation.weight, 20);
  assert.equal(consensus.score, 0.4 * 50 + 0.4 * 60 + 0.2 * 6);
  assert.deepEqual(consensus.coverage, { numerator: 3, denominator: 3 });
});

test("Actuation counts 0 at launch: the pillar is in, never Not included (decisions 78, 97)", () => {
  const basis = clientBasis(LAUNCH_ROWS);
  const notReady: AiSearchRead = { phase: "loading" };
  const actuation = actuationFromLive({ ai: notReady, actuation: basis, asOf: ASOF });
  assert.ok(actuation);
  assert.equal(actuation.score, 0);
  for (const id of ["P1", "P2", "E1", "E2", "E3"] as const) assert.equal(actuation.factors[id].points, 0, id);
  const consensus = consensusScore(FOUNDATION, COMMERCE, { actuation });
  assert.equal(consensus.actuation.included, true);
  assert.equal(consensus.actuation.score, 0);
  assert.equal(consensus.actuation.weight, 20);
  assert.equal(consensus.score, 0.4 * 50 + 0.4 * 60, "0 counts at its 20% weight, not rescaled away");
  assert.equal(actuationPartial(consensus.actuation), null, "a scored pillar carries no asterisk");
  assert.equal(weakestScoreCard(consensus), "actuation", "the weakest card, Actuation at 0, opens by default");
  const source = readFileSync("components/v3/live/ConsensusScoreView.tsx", "utf8");
  assert.doesNotMatch(source, /Not included|Awaiting confirmation/);
  const rows = actuationFactorRows(actuation, null, "Fender");
  for (const row of rows) assert.doesNotMatch(row.basis, /Awaiting|Not included|confirm/i, row.id);
  assert.equal(rows[0].basis, "Not in place.");
  assert.equal(rows[3].basis, "0 community responses posted in the last 90 days. No target: the community response program is not in place.");
});

test("Only a failed Actuation read leaves the pillar out, with Not available* and the 50/50 rescale", () => {
  const consensus = consensusScore(FOUNDATION, COMMERCE, { actuation: actuationFromLive({ ai: windowRead(), actuation: null }) });
  assert.equal(consensus.actuation.included, false);
  assert.equal(consensus.foundation.weight, 50);
  assert.equal(consensus.score, 55);
  const partial = actuationPartial(consensus.actuation);
  assert.equal(partial?.reason, "read-failed");
});

test("A lapsed factor scores and reads exactly like one never in place (decision 78)", () => {
  const lapsedRows: ClientBasisRow[] = LAUNCH_ROWS.map((row) =>
    // The database returns nulls for a program past its expiry; a stale client row with dates but
    // in_place false must still read as never recorded.
    row.factor === "P1" ? { ...row, in_place: false, verified_on: addDays(ASOF, -100), expires_on: addDays(ASOF, -10), target_domain_count: 5, cadence_per_30_days: 4 } : row,
  );
  const ai = windowRead();
  const lapsed = actuationFromLive({ ai, actuation: clientBasis(lapsedRows), asOf: ASOF });
  const never = actuationFromLive({ ai, actuation: clientBasis(LAUNCH_ROWS), asOf: ASOF });
  assert.deepEqual(lapsed, never);
  const program = { factor: "P1" as const, hasOwner: true, hasEvidence: true, verifiedOn: addDays(ASOF, -91), targetDomainCount: 5, cadencePer30Days: 4, targetCount: null };
  const expired = scoreActuation({ asOf: ASOF, programs: [program], items: { E2: 3, E3: 0 }, ownedAnswers: null });
  const absent = scoreActuation({ asOf: ASOF, programs: [], items: { E2: 3, E3: 0 }, ownedAnswers: null });
  assert.deepEqual(expired, absent);
  assert.deepEqual(actuationFactorRows(expired, null, "Fender"), actuationFactorRows(absent, null, "Fender"));
  const inPlace = scoreActuation({ asOf: ASOF, programs: [{ ...program, verifiedOn: addDays(ASOF, -10) }], items: { E2: 3, E3: 0 }, ownedAnswers: null });
  assert.equal(inPlace.factors.P1.points, 20);
  assert.equal(
    actuationFactorRows(inPlace, null, "Fender")[0].basis,
    "In place. Verified Nov 6, 2026, counts until Feb 4, 2027. 5 target communities. 4 responses every 30 days.",
  );
});

test("E1 reads the Citation Ecosystem data and counts only engines that returned a citation (decision 97)", () => {
  const engines = engineOwnedAnswers((windowRead() as Extract<AiSearchRead, { phase: "ready" }>).snapshot);
  const byEngine = Object.fromEntries(engines.map((row) => [row.engine, row]));
  assert.deepEqual(byEngine.perplexity, { engine: "perplexity", citations: 2, withOwned: 1, resolved: 4 });
  assert.deepEqual(byEngine.gemini, { engine: "gemini", citations: 1, withOwned: 0, resolved: 2 });
  assert.deepEqual(byEngine.openai_api, { engine: "openai_api", citations: 0, withOwned: 0, resolved: 4 });

  const owned = ownedAnswersFromAi(windowRead());
  assert.deepEqual(owned?.basis, { withOwned: 1, resolved: 6 }, "the API engine with no citation is left out");
  assert.equal(owned?.leftOut.length, 1);
  const score = actuationFromLive({ ai: windowRead(), actuation: clientBasis(LAUNCH_ROWS), asOf: ASOF });
  // 1 of 6 is 16.7%, over the 15% target, so E1 is capped at 30.
  assert.equal(score?.factors.E1.points, 30);
  assert.equal(score?.score, 30);

  // The API engine joins once its answers return citations, decided from the data.
  const joined = ownedAnswersFromAi(windowRead(true));
  assert.deepEqual(joined?.basis, { withOwned: 2, resolved: 10 });
  assert.equal(joined?.leftOut.length, 0);
  const rows = actuationFactorRows(actuationFromLive({ ai: windowRead(true), actuation: clientBasis(LAUNCH_ROWS), asOf: ASOF })!, joined, "Fender");
  assert.equal(rows[2].basis, "20.0% of unbranded shopping answers cite a Fender page (2 of 10). Target 15%.");
  assert.equal(rows[2].pointsLabel, "30 of 30 points");
});

test("E1 carries the decision 98 tooltip in the client's brand name, then the engines counted", () => {
  const owned = ownedAnswersFromAi(windowRead());
  const tip = e1FactorTip("Ledlenser", owned);
  assert.ok(tip.startsWith(e1Tooltip("Ledlenser")));
  assert.match(tip, /Target: 15%, about what the strongest competitor brands reach in their best product category\./);
  assert.match(tip, /Counted in this period: .*\(search\)/);
  assert.match(tip, /Left out, no citations returned: .*\(API\)/);
});

test("Both clients score Actuation with the same function (decision 89)", async () => {
  for (const key of ["fender", "ledlenser"] as const) {
    const score = await runWithClient(key, async () => actuationFromLive({ ai: { phase: "loading" }, actuation: clientBasis(LAUNCH_ROWS), asOf: ASOF }));
    assert.equal(score?.score, 0, key);
  }
});

test("Scores over time marks the first week scoring included AI Actuation (decision 97)", () => {
  const row = (week: string, actuation: number | null): ScoreSnapshotRow => ({
    client_key: "fmic",
    week_start: week,
    saved_at: `${week}T18:17:00Z`,
    consensus_score: 42,
    foundation_score: 50,
    commerce_score: 40,
    actuation_score: actuation,
  });
  const before = scoreHistoryModel([row("2026-11-09", null), row("2026-11-02", null)]);
  assert.equal(before?.actuationAdded, null);
  const model = scoreHistoryModel([row("2026-11-09", null), row("2026-11-16", 9), row("2026-11-23", 9)]);
  assert.ok(model);
  assert.equal(model.actuationAdded, "2026-11-16");
  assert.equal(scorePointTip(model, "2026-11-16", "36/100, target 70"), `36/100, target 70. ${ACTUATION_ADDED_NOTE}`);
  assert.equal(scorePointTip(model, "2026-11-23", "36/100, target 70"), "36/100, target 70.");
  assert.equal(ACTUATION_ADDED_NOTE, "Scoring now includes AI Actuation.");
  const chart = readFileSync("components/v3/live/ScoreHistoryChart.tsx", "utf8");
  assert.match(chart, /data-score-history-actuation-marker/);
});

test("The weekly save stores actuation_score from the same function, with citations read", () => {
  const reads = readFileSync("lib/fender-canvas/score-snapshot-reads.ts", "utf8");
  assert.match(reads, /citations: true/);
  assert.doesNotMatch(reads, /citations: false/);
  assert.match(reads, /loadActuationBasis\(\)/);
  const snapshot = readFileSync("lib/fender-canvas/score-snapshot.ts", "utf8");
  assert.match(snapshot, /actuation: reads\.actuation/);
});

test("Every Consensus figure passes the Actuation basis to the one shared function", () => {
  for (const file of [
    "components/v3/live/ConsensusScoresPanel.tsx",
    "components/v3/live/BriefingConsensusLead.tsx",
    "lib/fender-canvas/minimal-metrics-summary.ts",
    "lib/fender-canvas/score-snapshot.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /consensusFromLive\(/, file);
    assert.match(source, /actuation: (bundle|ctx\.bundle|reads)\.actuation/, file);
  }
  const live = readFileSync("lib/fender-canvas/consensus-scores-from-live.ts", "utf8");
  assert.equal((live.match(/consensusScore\(/g) ?? []).length, 1, "no second formula");
});

test("Citation Ecosystem shows the Actuation basis below the tab, not above its owned-pages figure (decision 86)", () => {
  const panel = readFileSync("components/v3/live/ai-search/CitationEcosystemPanel.tsx", "utf8");
  const scope = panel.indexOf("</EngineGroupScope>");
  const basis = panel.indexOf("<CitationActuationBasis />");
  assert.ok(scope > 0 && basis > scope, "after the tab body");
  const card = readFileSync("components/v3/live/ai-search/CitationActuationBasis.tsx", "utf8");
  assert.doesNotMatch(card, /owner_name|note|verified_by/);
});
