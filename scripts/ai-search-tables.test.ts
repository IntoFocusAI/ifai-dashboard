// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-search-tables.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { historyFixtureSnapshot, historyFixtureSummaries } from "../lib/ai-search/history-fixtures.ts";
import { keyColor, sliceColors, sliceTones } from "../lib/ai-search/pie-tones.ts";
import { PUBLISHED_OCTOBER_12_RUN_ID } from "../lib/ai-search/review-runs.ts";
import {
  parseAiSelectionScope,
  runsInSelection,
  selectionFilterLabel,
} from "../lib/ai-search/selection.ts";
import {
  CITATION_EVIDENCE_HEADER,
  RUN_ENGINE_HEADER,
  SIMULATION_HEADER,
  citationCategoryTable,
  citationEngineTable,
  citationEvidenceTable,
  explorerFilterSentence,
  factCheckTable,
  parseCitationParams,
  parseExplorerFilter,
  runCategoryTable,
  runEngineTable,
  simulationTable,
} from "../lib/ai-search/tables.ts";
import { DEFAULT_FILTER } from "../lib/ai-search/explorer-filter.ts";
import { EXPORT_TABLE_IDS, isExportTable } from "../lib/export/tables.ts";
import { parseShownRequest, shownCsv } from "../lib/export/shown.ts";

/* X-10 and X-33 for AI Search: every table downloads what it shows, built on the server from
   the same row and cell functions as the screen, for the selection the date pill names. */

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const snapshot = historyFixtureSnapshot(PUBLISHED_OCTOBER_12_RUN_ID)!;

test("a download request carries the date pill and the engine switch, and nothing malformed passes", () => {
  const ready = { enginesReady: true };
  assert.deepEqual(parseAiSelectionScope({ mode: { kind: "month" }, windowEnd: "2026-11-08", engines: "all", ...ready }), {
    mode: { kind: "month" },
    windowEnd: "2026-11-08",
    engines: "all",
    enginesReady: true,
  });
  assert.deepEqual(
    parseAiSelectionScope({ mode: { kind: "range", from: "2026-11-05", to: "2026-10-20" }, engines: "search", enginesReady: false }),
    { mode: { kind: "range", from: "2026-10-20", to: "2026-11-05" }, windowEnd: null, engines: "search", enginesReady: false },
  );
  assert.deepEqual(
    parseAiSelectionScope({ mode: { kind: "run", runId: PUBLISHED_OCTOBER_12_RUN_ID }, engines: "api", ...ready })?.mode,
    { kind: "run", runId: PUBLISHED_OCTOBER_12_RUN_ID },
  );
  assert.equal(parseAiSelectionScope(null), null);
  assert.equal(parseAiSelectionScope({ mode: { kind: "legacy", runId: "x" }, engines: "all", ...ready }), null);
  assert.equal(parseAiSelectionScope({ mode: { kind: "run", runId: "1; drop table" }, engines: "all", ...ready }), null);
  assert.equal(parseAiSelectionScope({ mode: { kind: "range", from: "Nov 5", to: "2026-11-08" }, engines: "all", ...ready }), null);
  assert.equal(parseAiSelectionScope({ mode: { kind: "month" }, engines: "everything", ...ready }), null);
  assert.equal(parseAiSelectionScope({ mode: { kind: "month" }, engines: "all" }), null, "the switch state is required");
  assert.equal(parseAiSelectionScope({ mode: { kind: "month" }, windowEnd: "soon", engines: "all", ...ready })?.windowEnd, null);
  // A download never drops the API engines the screen showed: it fails and says so.
  const load = read("lib/ai-search/selection-load.ts");
  assert.match(load, /if \(scope\.enginesReady && engineSwitchState\(load, scope\.engines\)\.kind !== "ready"\) \{\s+return \{ ok: false, message: API_ENGINES_FAILED \};/);
  assert.equal(
    selectionFilterLabel({ pillLabel: "Last 30 days · Oct 10 to Nov 8, 2026", engines: "search", enginesReady: true }),
    "Last 30 days · Oct 10 to Nov 8, 2026. Engines: Without API",
  );
  assert.match(
    selectionFilterLabel({ pillLabel: "All time", engines: "all", enginesReady: false }),
    /^All time\. Engines: Search engines \(API engines not available\)$/,
  );
});

test("the server reads the same runs the pill names", () => {
  const runs = historyFixtureSummaries();
  assert.deepEqual(
    runsInSelection(runs, { kind: "month" }, "2026-10-12").map((run) => run.audit_run_id),
    [PUBLISHED_OCTOBER_12_RUN_ID],
  );
  assert.equal(runsInSelection(runs, { kind: "all" }, null).length, 3);
  assert.equal(runsInSelection(runs, { kind: "range", from: "2026-10-12", to: "2026-10-12" }, null).length, 2);
  assert.deepEqual(runsInSelection(runs, { kind: "run", runId: PUBLISHED_OCTOBER_12_RUN_ID }, null), []);
  const context = read("components/v3/live/ai-search/AiHistoryContext.tsx");
  assert.match(context, /runsInSelection\(catalog\.runs, mode, windowEnd\)/);
  const steps = read("lib/ai-search/selection-load.ts");
  for (const step of ["runsInSelection(", "clientWindowSnapshots(", "displayedAiRead(", "engineGroupRead(", "engineGroupTrend(", "apiRunsCoveringBattery(", "apiRunsInScope("]) {
    assert.ok(steps.includes(step), `the server selection uses ${step}`);
  }
});

test("Run Summary rows are one engine or category each, in the cells the screen shows", () => {
  const engines = runEngineTable(snapshot, true);
  assert.deepEqual(engines.header, RUN_ENGINE_HEADER);
  assert.deepEqual(engines.header, ["Engine", "Model", "Unbranded discovery", "Branded consideration", "No leader", "Errors"]);
  assert.ok(engines.rows.length > 0);
  for (const row of engines.rows) {
    assert.equal(row.cells.length, engines.header.length);
    assert.match(row.cells[2], /^\d+\.\d% \(\d+ of \d+\)( Small sample)?$|^No resolved answers$/);
  }
  assert.deepEqual(new Set(engines.rows.map((row) => row.key)).size, engines.rows.length);
  // A pooled window does not mark a small sample.
  assert.ok(runEngineTable(snapshot, false).rows.every((row) => !row.cells.join(" ").includes("Small sample")));
  const categories = runCategoryTable(snapshot, true);
  assert.equal(categories.header[0], "Category");
  assert.deepEqual(
    categories.rows.map((row) => row.cells[0]),
    [...categories.rows.map((row) => row.cells[0])].sort(),
  );
});

test("Run Details rows follow the tab's filter, and the filter is named in plain words", () => {
  const all = simulationTable(snapshot, { ...DEFAULT_FILTER, scope: "all" });
  assert.deepEqual(all.header, SIMULATION_HEADER);
  assert.equal(all.rows.length, snapshot.calls.length);
  assert.equal(all.filter, "Every call");
  const shopping = simulationTable(snapshot, DEFAULT_FILTER);
  assert.equal(shopping.rows.length, snapshot.calls.filter((call) => call.prompt_kind === "commercial").length);
  assert.equal(shopping.filter, "Shopping prompts");
  const probes = simulationTable(snapshot, { ...DEFAULT_FILTER, scope: "probe" });
  assert.ok(probes.rows.every((row) => row.cells[4] === "Product fact check"));
  assert.ok(shopping.rows.every((row) => row.cells[5] === "n/a"), "a shopping row is not a fact check");
  assert.equal(
    explorerFilterSentence({ ...DEFAULT_FILTER, engine: "gemini", outcome: "resolved", role: "unbranded_discovery" }),
    "Shopping prompts. Unbranded discovery. Engine: Gemini. Outcome: A clear leader",
  );
  assert.deepEqual(parseExplorerFilter({ scope: "probe", engine: "chatgpt", role: "nonsense", simId: "7" }), {
    ...DEFAULT_FILTER,
    scope: "probe",
    engine: "chatgpt",
  });
  assert.deepEqual(parseExplorerFilter(null), DEFAULT_FILTER);
});

test("Product Fact Checks and the citation tables list every row they show", () => {
  const facts = factCheckTable(snapshot);
  assert.equal(facts.rows.length, snapshot.probes.length);
  assert.equal(facts.header[0], "Question checked");
  assert.match(facts.header[4], /^Verified Fender fact$/);
  const params = parseCitationParams({ scope: "commercial", category: null });
  const evidence = citationEvidenceTable(snapshot, params);
  assert.deepEqual(evidence.header, CITATION_EVIDENCE_HEADER);
  assert.ok(evidence.rows.length > 0);
  assert.equal(new Set(evidence.rows.map((row) => row.key)).size, evidence.rows.length);
  assert.equal(evidence.filter, "All shopping");
  const byEngine = citationEngineTable(snapshot, params);
  assert.deepEqual(byEngine.header, ["Engine", "Cited answers", "Links", "Fender-owned"]);
  assert.match(byEngine.rows[0].cells[1], /^\d+ of \d+$/);
  const links = byEngine.rows.reduce((sum, row) => sum + Number(row.cells[2].replace(/,/g, "")), 0);
  assert.equal(links, evidence.rows.length, "links by engine add up to the cited links");
  assert.equal(citationCategoryTable(snapshot, params).header[0], "Category");
  assert.deepEqual(parseCitationParams({ scope: "everything", category: 4 }), {
    scope: "commercial",
    category: null,
    question: "shopping",
    engines: null,
  });
  // Decision 86: the question control and a custom chip set ride with the download.
  const engines = [...new Set(snapshot.calls.map((call) => (call.engine ?? "").toLowerCase()))].sort();
  const one = engines[0];
  const custom = parseCitationParams({ question: "unbranded", engines: [one, "bad engine!"], category: null });
  assert.deepEqual(custom, { scope: "commercial", category: null, question: "unbranded", engines: [one] });
  const narrowed = citationEngineTable(snapshot, custom);
  assert.ok(narrowed.rows.every((row) => row.key === one), "only the chosen engine's row");
  assert.match(narrowed.filter, /^Unbranded shopping\. Engines: .+ \(search\)$/);
  assert.equal(parseCitationParams({ scope: "probe" }).question, "probe", "a download sent before decision 86 still reads");
});

test("a download writes the filter, sort, as-of time, and population ahead of the rows the screen sent", () => {
  const built = runEngineTable(snapshot, true);
  const keys = [...built.rows.map((row) => row.key)].reverse();
  const csv = shownCsv(
    {
      table: "ai-run-engines",
      header: built.header,
      rows: built.rows,
      filter: "Last 30 days · Oct 5 to Nov 3, 2026. Engines: All",
      sort: built.sort,
      population: "102 calls from 1 run in this selection",
      asOf: "Oct 12, 2026, 5:02 PM UTC",
    },
    parseShownRequest({ keys, search: "", sort: "Engine, Z to A", scope: { ai: {} } }),
    null,
  );
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], 'Filter,"Last 30 days · Oct 5 to Nov 3, 2026. Engines: All."');
  assert.equal(lines[1], 'Sort,"Engine, Z to A."');
  assert.equal(lines[2], 'As of,"Oct 12, 2026, 5:02 PM UTC"');
  assert.equal(lines[3], "Population,102 calls from 1 run in this selection.");
  assert.equal(lines[4], built.header.join(","));
  assert.ok(lines[5].startsWith(built.rows.find((row) => row.key === keys[0])!.cells[0]));
  assert.equal(lines.length, 5 + built.rows.length);
});

test("every AI Search table on screen has a server download", () => {
  const ids = [
    "ai-run-engines",
    "ai-run-categories",
    "ai-simulations",
    "product-fact-checks",
    "catalog-coverage",
    "ai-history-trend",
    "ai-trend-point",
    "citation-engines",
    "citation-categories",
    "citation-evidence",
    "prompt-history",
  ];
  for (const id of ids) {
    assert.ok(isExportTable(id), id);
    assert.ok(read("lib/export/load-table.ts").includes(`"${id}":`), `${id} has a loader`);
  }
  assert.equal(new Set(EXPORT_TABLE_IDS).size, EXPORT_TABLE_IDS.length);
  const files = {
    "ai-run-engines": "RunSummaryPanel.tsx",
    "ai-run-categories": "RunSummaryPanel.tsx",
    "ai-simulations": "SimulationsExplorer.tsx",
    "product-fact-checks": "FactCheckTable.tsx",
    "catalog-coverage": "CatalogCoverageTable.tsx",
    "ai-history-trend": "HistoryTrendTable.tsx",
    "ai-trend-point": "HistoryPointDetail.tsx",
    "citation-engines": "CitationEcosystemPanel.tsx",
    "citation-categories": "CitationEcosystemPanel.tsx",
    "citation-evidence": "CitationEvidenceTable.tsx",
  };
  for (const [id, file] of Object.entries(files)) {
    const source = read(`components/v3/live/ai-search/${file}`);
    assert.ok(source.includes(`tableId="${id}"`), `${file} draws ${id}`);
    assert.match(source, /exportScope=\{exportScope\}/, `${file} sends its selection with the download`);
  }
  // Cited links pages its own rows, so it hands the toolbar its sort hook's controls.
  assert.match(read("components/v3/live/ai-search/CitationEvidenceTable.tsx"), /controls=\{sorted\.controls\}/);
  // The sample copy and a legacy run have no server read, so they show no download.
  assert.match(read("components/v3/live/ai-search/useAiExport.ts"), /source !== "live" \|\| mode\.kind === "legacy"\) return null;/);
  assert.match(read("components/v3/live/TableToolbar.tsx"), /isExportTable\(tableId\) && exportScope !== null/);
});

test("pies use the chart tokens: one ice-blue measured slice, one second blue at most, gray for the rest", () => {
  assert.deepEqual(sliceTones([{ key: "fender" }, { key: "other" }]), ["measured", "rest"]);
  assert.deepEqual(sliceTones([{ key: "fender" }, { key: "competitor_brand" }, { key: "other" }, { key: "none" }]), [
    "measured",
    "second",
    "rest",
    "rest",
  ]);
  // The matched and contradicted pair is used in either polarity: the slice listed first is the figure.
  assert.deepEqual(sliceTones([{ key: "matched" }, { key: "contradicted" }]), ["measured", "rest"]);
  assert.deepEqual(sliceTones([{ key: "contradicted" }, { key: "matched", label: "Rest of this population" }]), ["measured", "rest"]);
  assert.deepEqual(sliceTones([{ key: "matched", label: "Rest of this population" }]), ["rest"]);
  // An explicit tone wins over the key.
  assert.deepEqual(sliceTones([{ key: "contradicted", tone: "rest" }]), ["rest"]);
  assert.deepEqual(sliceTones([{ key: "checked", tone: "measured" }, { key: "unchecked", tone: "rest" }]), ["measured", "rest"]);
  const colors = sliceColors([{ key: "fender_owned" }, { key: "retailer" }, { key: "editorial" }, { key: "competitor_brand" }]);
  assert.equal(colors[0], "var(--chart-measured)");
  assert.equal(colors[3], "var(--chart-second)");
  assert.notEqual(colors[1], colors[2], "neighboring gray slices stay distinct");
  for (const color of colors) assert.doesNotMatch(color, /#[0-9a-f]{3,6}/i, "no raw hex in a chart");
  assert.equal(keyColor("yamaha"), "var(--chart-rest)");
  const disc = read("components/v3/live/ai-search/CitationPieDisc.tsx");
  assert.doesNotMatch(disc, /#[0-9a-fA-F]{6}/, "the pie disc holds no hex color");
  for (const status of ["--danger-red", "--warning-amber", "--success-green", "--status-"]) {
    assert.ok(!read("lib/ai-search/pie-tones.ts").includes(status), `a chart slice never uses ${status}`);
  }
});
