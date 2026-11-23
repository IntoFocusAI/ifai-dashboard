// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/fix-list-estimates.test.ts
//
// E4: the dollar on each Action Items fix-list row and each tab's yearly line, added from the
// shared per-listing estimates (lib/estimates/live-inputs byListing). For the fixture catalogs,
// the rows for the Phase 1 lines add up to Phase 1, MAP sits beside it, and line 6 has no row.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildClientEstimates } from "../lib/estimates/live-inputs.ts";
import { PHASE_1_LINES } from "../lib/estimates/rollup.ts";
import { aplusActionText, aplusPlanItem, planWithAplus } from "../lib/fender-canvas/action-items-aplus-row.ts";
import { APLUS_ROW_ID, FIX_ROW_LINES, fixRowEstimate, lineFromListings } from "../lib/fender-canvas/action-items-fix-list.ts";
import { MAP_ESTIMATE_LINE } from "../lib/fender-canvas/map-exposure.ts";
import { STOCK_LOSS_ESTIMATE_LINE } from "../lib/fender-canvas/stock-loss.ts";
import { loadEstimatesFixture } from "./fixtures/estimates/load.ts";

const CLIENTS = ["fender", "ledlenser"] as const;

function estimatesFor(client: (typeof CLIENTS)[number]) {
  const fx = loadEstimatesFixture(client);
  return buildClientEstimates(fx.listings, { rankCategory: fx.rankCategory, dataAsOf: fx.readOn });
}

for (const client of CLIENTS) {
  const est = estimatesFor(client);

  test(`${client}: the fix-list rows for the Phase 1 lines add up to Phase 1`, () => {
    const rows = Object.keys(FIX_ROW_LINES)
      .map((id) => fixRowEstimate(id, est))
      .filter((row) => row?.inPhase1);
    assert.deepEqual(rows.map((row) => row!.lineId).sort(), [...PHASE_1_LINES].sort(), "one row per Phase 1 line");
    const sum = rows.reduce(
      (total, row) => ({
        low: total.low + (row!.range?.low ?? 0),
        mid: total.mid + (row!.range?.mid ?? 0),
        high: total.high + (row!.range?.high ?? 0),
      }),
      { low: 0, mid: 0, high: 0 },
    );
    assert.ok(est.phase1.range, "Phase 1 is priced");
    // Phase 1 rounds each line to the dollar: one dollar per line at most.
    for (const key of ["low", "mid", "high"] as const) {
      assert.ok(Math.abs(sum[key] - est.phase1.range![key]) <= PHASE_1_LINES.length, `${key}: rows ${sum[key]} vs Phase 1 ${est.phase1.range![key]}`);
    }
  });

  test(`${client}: Phase 1 rows add up to Phase 1 with or without the own-pages row; A+ is on its own row`, () => {
    assert.equal(FIX_ROW_LINES["own:pages"], undefined, "the own-pages row carries no dollar");
    assert.equal(FIX_ROW_LINES[APLUS_ROW_ID], "aplus");
    for (const ownPagesShows of [true, false]) {
      const ids = Object.keys(FIX_ROW_LINES).filter((id) => ownPagesShows || id !== "own:pages");
      if (ownPagesShows) ids.push("own:pages");
      const rows = ids.map((id) => fixRowEstimate(id, est)).filter((row) => row?.inPhase1);
      const mid = rows.reduce((total, row) => total + (row!.range?.mid ?? 0), 0);
      assert.ok(Math.abs(mid - est.phase1.range!.mid) <= PHASE_1_LINES.length, `own pages ${ownPagesShows}: ${mid} vs ${est.phase1.range!.mid}`);
    }
    const aplus = lineFromListings(est, "aplus")!;
    const item = aplusPlanItem(est);
    const applies = aplus.status !== "none" && ((aplus.range?.mid ?? 0) > 0 || aplus.priced < aplus.listings);
    assert.equal(item !== null, applies);
    if (item) assert.equal(item.action, aplusActionText(aplus.listings));
  });

  test(`${client}: each row equals its line, MAP is beside Phase 1, line 6 has no row`, () => {
    for (const [id, lineId] of Object.entries(FIX_ROW_LINES)) {
      const row = fixRowEstimate(id, est)!;
      const line = est.lines.find((entry) => entry.lineId === lineId)!;
      assert.equal(row.line, line);
      assert.equal(row.listings, line.trail.coverage.total, `${lineId} listings`);
      if (line.range) assert.ok(Math.abs(row.range!.mid - line.range.mid) <= 1, `${lineId} mid`);
      else assert.equal(row.range, null);
    }
    assert.equal(fixRowEstimate("finding:map_leakage", est)!.inPhase1, false);
    assert.ok(!Object.values(FIX_ROW_LINES).includes("miscategorized"));
    assert.equal(fixRowEstimate("finding:exact_official_product", est), null);
    assert.equal(fixRowEstimate("finding:unbranded_discovery", est), null);
  });
}

test("a row whose listings all lack a sales figure reads Not available*, never $0", () => {
  const est = buildClientEstimates(
    [{ asin: "A1", oosDays365: 20, inStockDays365: 300, observedDays365: 320 }],
    { rankCategory: null, dataAsOf: "2026-11-18" },
  );
  const row = lineFromListings(est, "out_of_stock")!;
  assert.equal(row.listings, 1);
  assert.equal(row.status, "not_available");
  assert.equal(row.range, null);
  assert.equal(lineFromListings(est, "map_leakage")!.status, "none");
});

test("A+ row wording is singular for one listing and takes the place the central rank gives it", () => {
  assert.equal(aplusActionText(1), "Add A+ content to 1 listing.");
  assert.equal(aplusActionText(12), "Add A+ content to 12 listings.");
  const est = buildClientEstimates(
    [{ asin: "A1", aplusState: "absent" }, { asin: "A2", aplusState: "present" }],
    { rankCategory: null, dataAsOf: "2026-11-18" },
  );
  const row = (id: string, kind: string, affected: number | null, base: number | null) => ({
    id,
    kind,
    action: `Fix ${id}.`,
    needsAction: true,
    noReading: false,
    inputs: { affected, base, unit: affected == null ? null : "listings", monthly: null, effort: "S", dependsOn: [], tier: "action" },
  });
  const base = [
    row("finding:buy_box", "finding", 5, 100),
    row("signal:missing_specs", "signal", 60, 100),
    row("own:pages", "own_page", null, null),
  ] as never[];
  const item = aplusPlanItem(est);
  assert.ok(item, "an unpriced A+ listing gets a row");
  assert.equal(item.action, "Add A+ content to 1 listing.");
  assert.deepEqual([item.inputs.affected, item.inputs.base, item.inputs.unit], [1, 1, "listings"]);
  const plan = planWithAplus(base, est);
  // A+ at 1 of 1 estimated listing (100%), then 60%, then 5%, then the row with no count.
  assert.deepEqual(plan.map((entry) => entry.id), [APLUS_ROW_ID, "signal:missing_specs", "finding:buy_box", "own:pages"]);
  assert.deepEqual(plan.map((entry) => entry.rank), [1, 2, 3, 4]);
  assert.equal(planWithAplus(base, null), base);
});

test("the tabs read the lines their constants name, from one template", () => {
  assert.equal(STOCK_LOSS_ESTIMATE_LINE, "out_of_stock");
  assert.equal(MAP_ESTIMATE_LINE, "map_leakage");
  const card = readFileSync(new URL("../components/v3/live/estimates/EstimateLineFigure.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(card, /["'`](fender|ledlenser)["'`]|activeClient\(\)\.key/i);
  assert.match(card, /FIX_ESTIMATE_LABEL/);
  for (const [file, line] of [
    ["StockLossPanel.tsx", "STOCK_LOSS_ESTIMATE_LINE"],
    ["MapChannelPanel.tsx", "MAP_ESTIMATE_LINE"],
    ["CatalogReadinessSpec.tsx", '"missing_specs"'],
    ["AplusMatrixPanel.tsx", '"aplus"'],
  ]) {
    const source = readFileSync(new URL(`../components/v3/live/${file}`, import.meta.url), "utf8");
    assert.match(source, new RegExp(`<EstimateLineCard lineId=\\{?${line}`), file);
  }
});
