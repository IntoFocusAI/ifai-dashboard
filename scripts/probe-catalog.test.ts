// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/probe-catalog.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { driftRead } from "../lib/ai-search/drift.ts";
import {
  ANCHOR_TIP,
  ANCHOR_TITLE,
  CATALOG_COVERAGE_TITLE,
  amazonDiffersTip,
  amazonMismatchNote,
  catalogCoverageTip,
  factCheckMethodLine,
  factCheckPendingNote,
} from "../lib/ai-search/fact-check-copy.ts";
import { historyFixtureSnapshot } from "../lib/ai-search/history-fixtures.ts";
import { buildHistoryTrend, questionsInRun } from "../lib/ai-search/history-trends.ts";
import {
  CATALOG_ROTATION_RULE,
  PROBE_CATALOG_COLUMNS,
  PROBE_COVERAGE_COLUMNS,
  PROBE_COVERAGE_VIEW,
  catalogCoverage,
  catalogCycles,
  catalogModelKey,
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
  const line = factCheckMethodLine(after.coverage, false, [3]);
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
  assert.match(panel, /row\.catalog && row\.sourceUrl \? .*<ExternalLink href=\{row\.sourceUrl\}>\{brandSite\(\)\} spec page<\/ExternalLink>/);
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

/** One more chatgpt row on the rotating key p17, shaped like a catalog check. */
function catalogRow(sim: number, patch: Partial<AiProbeRow>): AiProbeRow {
  return { ...rotationShape()[0], sim_id: sim, probe_is_anchor: false, ...patch };
}

test("one run counts catalog models by spec page, then SKU, against its models in scope; fixed questions stay out", () => {
  const rows = [
    ...rotationShape(),
    // A second ASIN on the Telecaster's spec page is the same model.
    catalogRow(201, { probe_asin: "B0C2TELE99", probe_asins: ["B0C2TELE99"], probe_fender_sku: TELE.sku, probe_source_url: TELE.url }),
    // Two acoustic ASINs with no spec page and one SKU are one model. A provider error counts, as in the view.
    catalogRow(202, {
      probe_asin: "B0C4ACOUS1",
      probe_category: "acoustics",
      probe_source_url: null,
      probe_fender_sku: "0970150022",
      call_status: "error",
      material_hallucination: "not_evaluated",
    }),
    catalogRow(203, { probe_asin: "B0C4ACOUS2", probe_category: "acoustics", probe_source_url: null, probe_fender_sku: "0970150022" }),
    // A fixed question in the same run, which the view counts under its own category.
    probe({ ...EMPTY_CATALOG, sim_id: 204, prompt_key: "p34", engine: "chatgpt" }),
  ];
  const coverage = [
    coverageRow({ engine: "chatgpt", models_checked: 3 }),
    coverageRow({ engine: "gemini", models_checked: 3 }),
    coverageRow({ category: "acoustics", engine: "chatgpt", models_checked: 1 }),
    coverageRow({ category: "hallucinations", engine: "chatgpt", models_checked: 1, asins_covered: 1 }),
  ];
  const read = catalogCoverage(snapshot(rows, coverage), false);
  assert.ok(read && read.phase === "ready");
  assert.equal(read.basis, "run");
  assert.equal(read.inScope, 180);
  assert.deepEqual(read.engines, ["chatgpt", "gemini"]);
  assert.deepEqual(read.rows, [
    { category: "Acoustics", cells: { chatgpt: { checked: 1, inScope: 180 }, gemini: { checked: 0, inScope: 180 } } },
    { category: "Electrics", cells: { chatgpt: { checked: 3, inScope: 180 }, gemini: { checked: 3, inScope: 180 } } },
  ]);
  assert.equal(catalogModelKey({ probe_source_url: STRAT.url, probe_fender_sku: STRAT.sku, probe_asin: STRAT.asin }), STRAT.url);
  assert.equal(catalogModelKey({ probe_source_url: " ", probe_fender_sku: STRAT.sku, probe_asin: STRAT.asin }), STRAT.sku);
  assert.equal(catalogModelKey({ probe_source_url: null, probe_fender_sku: null, probe_asin: STRAT.asin }), STRAT.asin);

  const table = readFileSync("components/v3/live/ai-search/CatalogCoverageTable.tsx", "utf8").replace(/\s+/g, " ");
  assert.match(
    table,
    /<CopyTip label=\{CATALOG_COVERAGE_TITLE\} description=\{catalogCoverageTip\(coverage\.basis, cell\.inScope\)\}> \{formatInt\(cell\.checked\)\} of \{formatInt\(cell\.inScope\)\} <\/CopyTip>/,
  );
  assert.doesNotMatch(table, /"None"/);
  assert.equal(CATALOG_COVERAGE_TITLE, "Catalog models checked");
  assert.equal(
    catalogCoverageTip("run", 180),
    "Distinct catalog models checked in this run, counted by fender.com spec page, then SKU, of the 180 models in scope.",
  );
  assert.equal(
    catalogCoverageTip("selection", 1250),
    "Distinct catalog models checked across the runs in this selection, counted by fender.com spec page, then SKU, of the 1,250 models in scope in the newest run.",
  );
});

test("a selection counts distinct models across its runs against the newest run's models in scope", () => {
  const older = rotationShape("r0")
    .filter((row) => row.probe_asin !== JAGUAR.asin)
    .map((row) => ({ ...row, created_at: "2026-11-01T06:00:00Z" }));
  const newer = rotationShape("r1")
    .filter((row) => row.probe_asin !== TELE.asin)
    .map((row, index) => ({ ...row, sim_id: 100 + index, created_at: "2026-11-02T06:00:00Z" }));
  // Pooled order is not run order: the newest run is read from its fact-check times.
  const coverage = [
    coverageRow({ audit_run_id: "r1", models_in_scope: 182, cycle_no: 4 }),
    coverageRow({ audit_run_id: "r0", models_in_scope: 180, cycle_no: 3 }),
  ];
  for (const order of [coverage, [...coverage].reverse()]) {
    const read = catalogCoverage(snapshot([...older, ...newer], order), true);
    assert.ok(read && read.phase === "ready");
    assert.equal(read.basis, "selection");
    assert.equal(read.inScope, 182);
    assert.deepEqual(read.rows, [
      { category: "Electrics", cells: { chatgpt: { checked: 3, inScope: 182 }, gemini: { checked: 3, inScope: 182 } } },
    ]);
  }
  const oneRun = catalogCoverage(snapshot(older, coverage), true);
  assert.ok(oneRun && oneRun.phase === "ready");
  assert.equal(oneRun.inScope, 180, "a run outside the selection's fact checks does not set the scope");
  assert.deepEqual(oneRun.rows[0].cells.chatgpt, { checked: 2, inScope: 180 });
});

test("a failed coverage read shows Not available, never zero", () => {
  assert.deepEqual(catalogCoverage(snapshot(rotationShape(), null), false), { phase: "unavailable" });
  assert.deepEqual(catalogCoverage(snapshot(rotationShape()), false), { phase: "unavailable" });
  assert.deepEqual(catalogCoverage(snapshot(rotationShape(), [coverageRow({ audit_run_id: "r9" })]), false), { phase: "unavailable" });
  assert.deepEqual(catalogCoverage(snapshot(rotationShape(), [coverageRow({ models_in_scope: null })]), false), { phase: "unavailable" });
  const table = readFileSync("components/v3/live/ai-search/CatalogCoverageTable.tsx", "utf8");
  assert.match(table, /Not available\*/);
  assert.match(table, /<CopyTip label="Catalog coverage"/);
});

test("an anchor that names a catalog product carries an Anchor mark; a fixed question never does", () => {
  const rows = [...rotationShape(), probe({ ...EMPTY_CATALOG, sim_id: 99, prompt_key: "p33", engine: "chatgpt", probe_is_anchor: true })];
  const drift = driftRead([], rows);
  assert.deepEqual(new Set(drift.probes.filter((row) => row.anchor).map((row) => row.asin)), new Set([STRAT.asin]));
  assert.equal(drift.probes.find((row) => row.promptKey === "p33")?.anchor, false);
  for (const row of driftRead([], publishedShape(true)).probes) assert.equal(row.anchor, false);
  assert.equal(ANCHOR_TITLE, "Anchor");
  assert.equal(ANCHOR_TIP, "IntoFocus asks this product in every run, on top of the rotating catalog models.");
  const table = readFileSync("components/v3/live/ai-search/FactCheckTable.tsx", "utf8").replace(/\s+/g, " ");
  assert.match(
    table,
    /\{row\.anchor \? \( <div data-ai-anchor=""> <span className="tag-badge tag-neutral"> <CopyTip label=\{ANCHOR_TITLE\} description=\{ANCHOR_TIP\}> \{ANCHOR_TITLE\} <\/CopyTip>/,
  );
});

test("pooled coverage stays undefined, fails as a whole, or concatenates", () => {
  const a = snapshot(publishedShape(true));
  const b = snapshot(rotationShape(), [coverageRow({})]);
  const failed = snapshot(rotationShape(), null);
  assert.equal(poolProbeCoverage([a, a]), undefined);
  assert.equal(poolProbeCoverage([b, failed]), null);
  assert.deepEqual(poolProbeCoverage([a, b, b]), [coverageRow({}), coverageRow({})]);
});

test("the method line leads with the cycle from the coverage view and keeps the approved rule in the tooltip", () => {
  assert.equal(
    CATALOG_ROTATION_RULE,
    "about 90 catalog models per run, each asked once per engine, all 180 in-scope guitar and bass models every 2 runs, plus anchors p17 and p33",
  );
  const snap = snapshot(rotationShape(), [coverageRow({ cycle_no: 3 }), coverageRow({ engine: "gemini", cycle_no: 3 })]);
  assert.deepEqual(catalogCycles(snap), [3]);
  const { coverage } = driftRead([], snap.probes);
  const line = factCheckMethodLine(coverage, false, catalogCycles(snap));
  assert.ok(line);
  assert.equal(line.rotation, "Catalog rotation, cycle 3");
  assert.equal(`${line.rotation} · ${line.products} · ${line.verified}`, "Catalog rotation, cycle 3 · 3 products checked · 3 with a verified fact");
  assert.equal(
    line.tip,
    "IntoFocus picked these products by its catalog rotation rule: about 90 catalog models per run, each asked once per engine, all 180 in-scope guitar and bass models every 2 runs, plus anchors p17 and p33. This run is cycle 3. 3 catalog products were checked, counted by ASIN. 3 of 3 were compared with the product's own fender.com spec value in this run.",
  );

  // No recorded cycle: the rule still leads, with no cycle named.
  const uncycled = factCheckMethodLine(coverage);
  assert.equal(uncycled?.rotation, "Catalog rotation");
  assert.match(uncycled?.tip ?? "", /^IntoFocus picked these products by its catalog rotation rule: about 90 .+ p33\. 3 catalog products/);
  const selection = factCheckMethodLine(coverage, true, [3, 4]);
  assert.equal(selection?.rotation, "Catalog rotation, cycles 3 to 4");
  assert.match(selection?.tip ?? "", /p33\. This selection covers cycles 3 to 4\. .+ in this selection\.$/);
  assert.equal(rotationSummary([4], true).tip.endsWith("This selection covers cycle 4."), true);

  // Cycles come only from runs whose fact checks name a catalog product; a NULL cycle_no is skipped.
  const fixedRun = publishedShape(true).map((row) => ({ ...row, audit_run_id: "r2" }));
  const mixed = snapshot([...rotationShape("r1"), ...fixedRun], [
    coverageRow({ audit_run_id: "r1", cycle_no: 4 }),
    coverageRow({ audit_run_id: "r1", engine: "gemini", cycle_no: null }),
    coverageRow({ audit_run_id: "r2", category: "hallucinations", cycle_no: 9 }),
  ]);
  assert.deepEqual(catalogCycles(mixed), [4]);
  assert.deepEqual(catalogCycles(snapshot(rotationShape(), null)), []);
  assert.deepEqual(catalogCycles(snapshot(publishedShape(true), [coverageRow({ cycle_no: 2 })])), []);

  for (const text of [line.rotation, line.products, line.verified, line.tip, uncycled?.tip ?? "", selection?.tip ?? ""]) {
    assert.doesNotMatch(text, /\u2014|representative|random|regex|collector|probe|not recorded/i);
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
  for (const label of ["{brandName()} SKU", "Spec checked", "Amazon value"]) assert.ok(drawer.includes(`<td>${label}</td>`), label);
  assert.match(drawer, /catalog\?\.amazonDiffers \?/);
  assert.match(drawer, /IntoFocus sends to every engine on purpose\./, "the fixed-question intro stays for rows without a product");
  assert.doesNotMatch(drawer, /\stitle=/);
});
