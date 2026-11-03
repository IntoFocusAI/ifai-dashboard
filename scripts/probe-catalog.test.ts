// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/probe-catalog.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { driftRead } from "../lib/ai-search/drift.ts";
import {
  amazonDiffersTip,
  amazonMismatchNote,
  factCheckMethodLine,
  factCheckPendingNote,
} from "../lib/ai-search/fact-check-copy.ts";
import { historyFixtureSnapshot } from "../lib/ai-search/history-fixtures.ts";
import { buildHistoryTrend, questionsInRun } from "../lib/ai-search/history-trends.ts";
import {
  PROBE_CATALOG_COLUMNS,
  PROBE_COVERAGE_COLUMNS,
  PROBE_COVERAGE_VIEW,
  catalogCoverage,
  poolProbeCoverage,
  rotationSummary,
} from "../lib/ai-search/probe-catalog.ts";
import { batteryGaps } from "../lib/ai-search/prompt-battery.ts";
import { EARLIER_OCTOBER_12_RUN_ID, OCTOBER_11_RUN_ID } from "../lib/ai-search/review-runs.ts";
import type {
  AiCurrentRun,
  AiProbeCoverageRow,
  AiProbeRow,
  AiSearchSnapshot,
  ProbeCatalogFields,
} from "../lib/ai-search/types.ts";

const EMPTY_CATALOG: ProbeCatalogFields = {
  probe_asin: null,
  probe_asins: null,
  probe_fender_sku: null,
  probe_category: null,
  probe_series: null,
  probe_spec_field: null,
  probe_expected_value: null,
  probe_source_url: null,
  probe_amazon_value: null,
  probe_is_anchor: null,
};

function probe(partial: Partial<AiProbeRow> & Pick<AiProbeRow, "sim_id" | "prompt_key" | "engine">): AiProbeRow {
  return {
    audit_run_id: "r1",
    prompt: `Question ${partial.prompt_key}`,
    model: null,
    call_status: "answered",
    material_hallucination: "none",
    hallucination_evidence: null,
    verified_claim: "Neck radius is 9.5 inches",
    verified_source_url: "https://www.fender.com/example",
    verified_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

/** Today's stored shape: five fixed questions, one with no verified fact, perplexity failing. */
function publishedShape(catalogColumns: boolean): AiProbeRow[] {
  const rows: AiProbeRow[] = [];
  let sim = 1;
  for (const key of ["p17", "p18", "p19", "p33", "p34"]) {
    const noFact = key === "p18";
    for (const engine of ["chatgpt", "gemini", "perplexity"]) {
      const failed = engine === "perplexity";
      rows.push(
        probe({
          ...(catalogColumns ? EMPTY_CATALOG : {}),
          sim_id: sim++,
          prompt_key: key,
          engine,
          call_status: failed ? "error" : "answered",
          material_hallucination: failed || noFact ? "not_evaluated" : "none",
          verified_claim: noFact ? null : `Fact for ${key}`,
        }),
      );
    }
  }
  return rows;
}

type Product = { asin: string; sku: string; series: string; field: string; value: string; url: string; amazon: string | null };

const STRAT: Product = {
  asin: "B0C1STRAT1",
  sku: "0140212500",
  series: "Player II",
  field: "neck_radius",
  value: "9.5 in",
  url: "https://www.fender.com/en-US/electric-guitars/stratocaster/player-ii-stratocaster/0140212500.html",
  amazon: "12 in",
};
const TELE: Product = {
  asin: "B0C2TELE22",
  sku: "0113942700",
  series: "American Professional II",
  field: "body_material",
  value: "Alder",
  url: "https://www.fender.com/en-US/electric-guitars/telecaster/american-professional-ii-telecaster/0113942700.html",
  amazon: "  alder ",
};
const JAGUAR: Product = {
  asin: "B0C3JAGUAR",
  sku: "0146600500",
  series: "Player",
  field: "scale_length",
  value: "24 in",
  url: "https://www.fender.com/en-US/electric-guitars/jaguar/player-jaguar/0146600500.html",
  amazon: null,
};

/** One rotating key (p17) asks a different catalog product in each repeat. */
function rotationShape(runId = "r1"): AiProbeRow[] {
  const rows: AiProbeRow[] = [];
  let sim = 1;
  for (const product of [STRAT, TELE, JAGUAR]) {
    for (const engine of ["chatgpt", "gemini"]) {
      rows.push(
        probe({
          audit_run_id: runId,
          sim_id: sim++,
          prompt_key: "p17",
          engine,
          prompt: `What is the ${product.field.replace("_", " ")} of the Fender ${product.series} (${product.sku})?`,
          material_hallucination: product === STRAT && engine === "gemini" ? "confirmed" : "none",
          hallucination_evidence: product === STRAT && engine === "gemini" ? "The neck radius is 12 inches." : null,
          verified_claim: "Fact for p17",
          verified_source_url: "https://www.fender.com/question-fact",
          probe_asin: product.asin,
          probe_asins: [product.asin],
          probe_fender_sku: product.sku,
          probe_category: "electrics",
          probe_series: product.series,
          probe_spec_field: product.field,
          probe_expected_value: product.value,
          probe_source_url: product.url,
          probe_amazon_value: product.amazon,
          probe_is_anchor: product === STRAT,
        }),
      );
    }
  }
  return rows;
}

const RUN: AiCurrentRun = {
  audit_run_id: "r1",
  run_state: "completed",
  collector_version: "v15",
  prompt_set_hash: null,
  expected_calls: null,
  attempted_calls: null,
  answered_calls: null,
  error_calls: null,
  started_at: "2026-11-02T06:00:00Z",
  completed_at: "2026-11-02T07:00:00Z",
  published_at: "2026-11-02T07:00:00Z",
};

function coverageRow(patch: Partial<AiProbeCoverageRow>): AiProbeCoverageRow {
  return {
    audit_run_id: "r1",
    cycle_no: 3,
    category: "electrics",
    engine: "chatgpt",
    models_in_scope: 180,
    models_checked: 3,
    asins_covered: 3,
    wrong_answers: 0,
    ...patch,
  };
}

function snapshot(probes: AiProbeRow[], probeCoverage?: AiProbeCoverageRow[] | null): AiSearchSnapshot {
  return { run: RUN, calls: [], probes, citations: [], ...(probeCoverage === undefined ? {} : { probeCoverage }) };
}

test("the coded column names match the views", () => {
  assert.equal(
    PROBE_CATALOG_COLUMNS,
    "probe_asin,probe_asins,probe_fender_sku,probe_category,probe_series,probe_spec_field,probe_expected_value,probe_source_url,probe_amazon_value,probe_is_anchor",
  );
  assert.equal(PROBE_COVERAGE_VIEW, "canvas_ai_probe_coverage");
  assert.equal(
    PROBE_COVERAGE_COLUMNS,
    "audit_run_id,cycle_no,category,engine,models_in_scope,models_checked,asins_covered,wrong_answers",
  );
  for (const path of ["lib/ai-search/queries.ts", "lib/ai-search/history-queries.ts"]) {
    assert.match(readFileSync(path, "utf8"), /\$\{PROBE_CATALOG_COLUMNS\}/, path);
  }
});

test("NULL catalog columns count exactly as today", () => {
  const before = driftRead([], publishedShape(false));
  const after = driftRead([], publishedShape(true));
  assert.deepEqual(after.coverage, before.coverage);
  assert.deepEqual(after.facts, before.facts);
  assert.equal(after.coverage.questionsSent, 5);
  assert.equal(after.coverage.factsChecked, 4);
  assert.equal(after.coverage.catalogProducts, 0);
  assert.equal(after.coverage.amazonMismatches, 0);
  for (const row of after.probes) {
    assert.equal(row.catalog, false);
    assert.equal(row.productKey, row.promptKey);
    assert.equal(row.amazonDiffers, false);
    assert.equal(row.claim, row.promptKey === "p18" ? null : `Fact for ${row.promptKey}`);
    assert.equal(row.sourceUrl, "https://www.fender.com/example");
  }
  const line = factCheckMethodLine(after.coverage, false, { rule: "least recently checked", cycle: 3 });
  assert.deepEqual(line, factCheckMethodLine(before.coverage));
  assert.equal(line?.rotation, null);
  assert.equal(`${line?.products} · ${line?.verified}`, "5 products checked · 4 with a verified fact");
  assert.match(line?.tip ?? "", /^Each fact-check question names one Fender product/);
  assert.equal(amazonMismatchNote(after.coverage), null);
  assert.match(factCheckPendingNote(after.coverage) ?? "", /^1 question has no verified Fender fact yet/);
});

test("NULL catalog columns show no catalog table, even when the coverage view has rows", () => {
  // The live view already returns rows for runs whose probe columns are all NULL.
  const live = [coverageRow({ category: "hallucinations", cycle_no: null, models_checked: 5, asins_covered: 5 })];
  assert.equal(catalogCoverage(snapshot(publishedShape(true), live), false), null);
  assert.equal(catalogCoverage(snapshot(publishedShape(true), null), false), null);
});

test("filled catalog columns count products by ASIN under one rotating key", () => {
  const drift = driftRead([], rotationShape());
  const { coverage } = drift;
  assert.equal(coverage.questionsSent, 3, "three products, not one key and not six wordings");
  assert.equal(coverage.catalogProducts, 3);
  assert.equal(coverage.factsChecked, 3);
  assert.equal(coverage.answersChecked, 6);
  assert.equal(coverage.contradictions, 1);
  assert.deepEqual(new Set(drift.probes.map((row) => row.promptKey)), new Set(["p17"]));
  assert.deepEqual(new Set(drift.probes.map((row) => row.productKey)), new Set([STRAT.asin, TELE.asin, JAGUAR.asin]));
});

test("each catalog row uses its own expected value and fender.com page as the verified fact", () => {
  const drift = driftRead([], rotationShape());
  const strat = drift.probes.find((row) => row.asin === STRAT.asin && row.engine === "gemini");
  assert.ok(strat);
  assert.equal(strat.claim, "Neck radius: 9.5 in");
  assert.equal(strat.sourceUrl, STRAT.url);
  assert.equal(strat.sku, STRAT.sku);
  assert.equal(strat.specField, "neck_radius");
  const jaguar = drift.probes.find((row) => row.asin === JAGUAR.asin);
  assert.equal(jaguar?.claim, "Scale length: 24 in");
  assert.equal(jaguar?.sourceUrl, JAGUAR.url);
  for (const row of drift.probes) {
    assert.notEqual(row.claim, "Fact for p17", "the question-level fact is not used for a catalog row");
    assert.notEqual(row.sourceUrl, "https://www.fender.com/question-fact");
  }
  assert.deepEqual(
    drift.facts.map((fact) => [fact.claim, fact.sourceUrl]),
    [
      ["Neck radius: 9.5 in", STRAT.url],
      ["Body material: Alder", TELE.url],
      ["Scale length: 24 in", JAGUAR.url],
    ],
  );
});

test("each wrong answer carries its fender.com spec page", () => {
  const wrong = driftRead([], rotationShape()).probes.filter((row) => row.state === "confirmed");
  assert.equal(wrong.length, 1);
  assert.equal(wrong[0].catalog, true);
  assert.equal(wrong[0].sourceUrl, STRAT.url);
  const panel = readFileSync("components/v3/live/ai-search/AiDriftPanel.tsx", "utf8").replace(/\s+/g, " ");
  assert.match(panel, /row\.catalog && row\.sourceUrl \? .*<ExternalLink href=\{row\.sourceUrl\}>fender\.com spec page<\/ExternalLink>/);
});

test("rows where Amazon disagrees with fender.com are flagged; spacing and case are not a disagreement", () => {
  const drift = driftRead([], rotationShape());
  const flagged = new Set(drift.probes.filter((row) => row.amazonDiffers).map((row) => row.asin));
  assert.deepEqual(flagged, new Set([STRAT.asin]));
  assert.equal(drift.coverage.amazonMismatches, 1);
  assert.equal(
    amazonMismatchNote(drift.coverage),
    "1 product's Amazon listing shows a different value than fender.com for the checked spec.",
  );
  assert.equal(amazonDiffersTip("12 in", "Neck radius: 9.5 in"), 'Amazon lists "12 in". The fender.com spec page lists "Neck radius: 9.5 in".');
  const table = readFileSync("components/v3/live/ai-search/FactCheckTable.tsx", "utf8");
  assert.match(table, /row\.amazonDiffers \?/);
  assert.match(table, /<CopyTip label=\{AMAZON_DIFFERS_TITLE\} description=\{amazonDiffersTip\(row\.amazonValue, row\.claim\)\}>/);
  assert.doesNotMatch(table, /\stitle=/);
});

test("one run reads N of M catalog products checked by category and engine from the coverage view", () => {
  const rows = [
    coverageRow({ engine: "chatgpt", models_checked: 3 }),
    coverageRow({ engine: "gemini", models_checked: 2 }),
    coverageRow({ category: "acoustics", engine: "chatgpt", models_in_scope: 64, models_checked: 1 }),
  ];
  const read = catalogCoverage(snapshot(rotationShape(), rows), false);
  assert.ok(read && read.phase === "ready");
  assert.equal(read.basis, "run");
  assert.deepEqual(read.engines, ["chatgpt", "gemini"]);
  assert.deepEqual(read.rows, [
    { category: "acoustics", cells: { chatgpt: { checked: 1, inScope: 64 } } },
    { category: "electrics", cells: { chatgpt: { checked: 3, inScope: 180 }, gemini: { checked: 2, inScope: 180 } } },
  ]);
  const table = readFileSync("components/v3/live/ai-search/CatalogCoverageTable.tsx", "utf8");
  assert.match(table, /\{formatInt\(cell\.checked\)\} of \{formatInt\(cell\.inScope\)\}/);
});

test("a selection counts distinct ASINs checked across runs against the newest run's scope", () => {
  const older = rotationShape("r0").filter((row) => row.probe_asin !== JAGUAR.asin);
  const newer = rotationShape("r1").map((row, index) => ({ ...row, sim_id: 100 + index }));
  newer[0] = { ...newer[0], call_status: "error", material_hallucination: "not_evaluated" };
  const coverage = [
    coverageRow({ audit_run_id: "r0", models_in_scope: 170 }),
    coverageRow({ audit_run_id: "r1", models_in_scope: 180 }),
    coverageRow({ audit_run_id: "r1", engine: "gemini", models_in_scope: 180 }),
  ];
  const read = catalogCoverage(snapshot([...older, ...newer], coverage), true);
  assert.ok(read && read.phase === "ready");
  assert.equal(read.basis, "selection");
  assert.deepEqual(read.rows, [
    { category: "electrics", cells: { chatgpt: { checked: 3, inScope: 180 }, gemini: { checked: 3, inScope: 180 } } },
  ]);
});

test("a failed coverage read shows Not available, never zero", () => {
  assert.deepEqual(catalogCoverage(snapshot(rotationShape(), null), false), { phase: "unavailable" });
  assert.deepEqual(catalogCoverage(snapshot(rotationShape()), false), { phase: "unavailable" });
  const table = readFileSync("components/v3/live/ai-search/CatalogCoverageTable.tsx", "utf8");
  assert.match(table, /Not available\*/);
  assert.match(table, /<CopyTip label="Catalog coverage"/);
});

test("pooled coverage stays undefined, fails as a whole, or concatenates", () => {
  const a = snapshot(publishedShape(true));
  const b = snapshot(rotationShape(), [coverageRow({})]);
  const failed = snapshot(rotationShape(), null);
  assert.equal(poolProbeCoverage([a, a]), undefined);
  assert.equal(poolProbeCoverage([b, failed]), null);
  assert.deepEqual(poolProbeCoverage([a, b, b]), [coverageRow({}), coverageRow({})]);
});

test("the method line leads with the run's rotation and keeps detail in the tooltip", () => {
  const { coverage } = driftRead([], rotationShape());
  const line = factCheckMethodLine(coverage, false, { rule: "least recently checked first", cycle: 3 });
  assert.ok(line);
  assert.equal(line.rotation, "Catalog rotation, cycle 3");
  assert.equal(`${line.rotation} · ${line.products} · ${line.verified}`, "Catalog rotation, cycle 3 · 3 products checked · 3 with a verified fact");
  assert.equal(
    line.tip,
    "IntoFocus picked these products by its catalog rotation rule: least recently checked first. This run is cycle 3. 3 catalog products were checked, counted by ASIN. 3 of 3 were compared with the product's own fender.com spec value in this run.",
  );
  assert.deepEqual(rotationSummary({ rule: null, cycle: null }), null);
  assert.deepEqual(rotationSummary({ cycle: "4" })?.label, "Catalog rotation, cycle 4");
  assert.deepEqual(rotationSummary({ rule: "by category" })?.label, "Catalog rotation");

  const unrecorded = factCheckMethodLine(coverage);
  assert.equal(unrecorded?.rotation, null);
  assert.match(unrecorded?.tip ?? "", /^How these products were picked is not recorded for this run\./);
  const selection = factCheckMethodLine(coverage, true, { rule: "least recently checked first", cycle: 3 });
  assert.equal(selection?.rotation, null, "a selection spans cycles, so no one cycle leads");
  assert.match(selection?.tip ?? "", /in this selection\.$/);

  for (const text of [line.rotation, line.products, line.verified, line.tip, unrecorded?.tip ?? ""]) {
    assert.doesNotMatch(text, /\u2014|representative|random|regex|collector|probe/i);
  }
  assert.doesNotMatch(`${line.products} · ${line.verified}`, /\bnot\b|\bno\b/i);
  assert.match(factCheckPendingNote({ ...coverage, answersWithoutFact: 2, questionsWithoutFact: [TELE.asin] }) ?? "", /^1 product has/);

  const panel = readFileSync("components/v3/live/ai-search/AiDriftPanel.tsx", "utf8");
  assert.match(panel, /method\.rotation \? `\$\{method\.rotation\} · \$\{method\.products\}` : method\.products/);
});

test("trend questions group a rotating fact-check key as one question", () => {
  const earlier = historyFixtureSnapshot(EARLIER_OCTOBER_12_RUN_ID);
  const october11 = historyFixtureSnapshot(OCTOBER_11_RUN_ID);
  assert.ok(earlier && october11);
  let repeat = 0;
  const rotated: AiSearchSnapshot = {
    ...earlier,
    calls: earlier.calls.map((call) =>
      call.prompt_kind === "probe" ? { ...call, prompt: `What is the neck radius of catalog product ${(repeat += 1)}?` } : call,
    ),
  };
  const probeKeys = (snap: AiSearchSnapshot) =>
    questionsInRun(snap.calls)
      .filter((question) => question.promptKind === "probe")
      .map((question) => question.promptKey);
  assert.deepEqual(probeKeys(rotated), probeKeys(earlier));
  assert.deepEqual(probeKeys(rotated), ["p17", "p18", "p19", "p33", "p34"]);
  assert.deepEqual(
    questionsInRun(rotated.calls).map((question) => question.versionKey),
    questionsInRun(earlier.calls).map((question) => question.versionKey),
  );

  const trend = (snapshots: AiSearchSnapshot[]) =>
    buildHistoryTrend({ snapshots, metric: "unbranded_discovery", breakdown: "overall", fromDay: null, toDay: null, query: { kind: "all" } });
  assert.deepEqual(
    trend([october11, rotated]).boundaries.map((boundary) => boundary.promptSetChanged),
    trend([october11, earlier]).boundaries.map((boundary) => boundary.promptSetChanged),
  );
  assert.equal(trend([october11, rotated]).boundaries.some((boundary) => boundary.promptSetChanged), false);

  // Shopping questions still break on wording.
  const reworded: AiSearchSnapshot = {
    ...earlier,
    calls: earlier.calls.map((call) => (call.prompt_key === "p15" ? { ...call, prompt: "Best first guitar for a classroom?" } : call)),
  };
  assert.equal(trend([october11, reworded]).boundaries.some((boundary) => boundary.promptSetChanged), true);
});

test("battery gaps match fact checks by key and shopping questions by wording", () => {
  const earlier = historyFixtureSnapshot(EARLIER_OCTOBER_12_RUN_ID);
  assert.ok(earlier);
  const missingOne = earlier.calls.filter((call) => !(call.prompt_key === "p17" && call.engine === "gemini"));
  const gaps = batteryGaps(missingOne);
  assert.deepEqual(gaps.map((gap) => `${gap.promptKey}|${gap.engine}`), ["p17|gemini"]);
  const rotated = missingOne.map((call, index) =>
    call.prompt_kind === "probe" ? { ...call, prompt: `Catalog product question ${index}` } : call,
  );
  assert.deepEqual(batteryGaps(rotated), gaps);
  const reworded = missingOne.map((call) => (call.prompt_key === "p15" ? { ...call, prompt: "Reworded" } : call));
  assert.deepEqual(batteryGaps(reworded), []);
});

test("the drawer names the catalog product and links its Amazon listing", () => {
  const drawer = readFileSync("components/v3/live/ai-search/FactCheckEvidence.tsx", "utf8").replace(/\s+/g, " ");
  assert.match(drawer, /catalog \? \( <p style=\{\{ \.\.\.mutedText, marginTop: 0 \}\} data-ai-fact-catalog-intro>/);
  assert.match(drawer, /<td>ASIN<\/td> <td>\{listing \? <ExternalLink href=\{listing\}>\{catalog\.asin\}<\/ExternalLink> : catalog\.asin\}<\/td>/);
  for (const label of ["Fender SKU", "Spec checked", "Amazon value"]) assert.ok(drawer.includes(`<td>${label}</td>`), label);
  assert.match(drawer, /catalog\?\.amazonDiffers \?/);
  assert.match(drawer, /IntoFocus sends to every engine on purpose\./, "the fixed-question intro stays for rows without a product");
  assert.doesNotMatch(drawer, /\stitle=/);
});
