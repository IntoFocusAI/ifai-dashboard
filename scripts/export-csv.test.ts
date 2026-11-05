// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/export-csv.test.ts
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { exportFile } from "../lib/export/file.ts";
import { loadTableExport } from "../lib/export/load-table.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const BUTTONS: Array<[string, string]> = [
  ["components/v3/live/MapListingsTable.tsx", 'table="map"'],
  ["components/v3/live/StockLossPanel.tsx", 'table="stock-loss"'],
  ["components/v3/live/CatalogGovernancePanel.tsx", 'table="catalog-splintered"'],
  ["components/v3/live/CatalogGovernanceSpecTable.tsx", 'table="catalog-specs"'],
  ["components/v3/live/FenderSpecPanel.tsx", 'table="amazon-specs"'],
  ["components/v3/live/MachineReadabilityPageTable.tsx", 'table="brand-site-pages"'],
  ["components/v3/live/PageFoundTable.tsx", 'table="brand-site-page-found"'],
  ["components/v3/live/ListingContentTable.tsx", 'table="aplus"'],
  ["components/v3/live/ai-search/CompetitorWinsPanel.tsx", 'table="competitor-wins"'],
  ["components/v3/live/ai-search/EngineComparisonPanel.tsx", 'table="engine-comparison"'],
  ["components/v3/live/ai-search/CategoryBattlecardsPanel.tsx", 'table="category-battlecards"'],
  ["components/v3/live/ai-search/FactCheckTable.tsx", 'table="fact-checks"'],
];

const NOT_DONE = [
  "components/v3/live/findability/FindabilityPanel.tsx",
  "components/v3/live/ai-search/CitationEcosystemPanel.tsx",
  "components/v3/live/ai-search/SimulationsExplorer.tsx",
  "components/v3/live/SuppressedListingsPanel.tsx",
  "components/v3/live/RoadmapFindingsPanel.tsx",
];

test("the standalone export page is gone", () => {
  assert.equal(existsSync(join(root, "app/(canvas)/dashboard/export/page.tsx")), false);
  assert.match(read("lib/export/load-table.ts"), /loadMapExport/);
  assert.match(read("lib/export/map-export.ts"), /listingsQuery/);
  assert.doesNotMatch(read("lib/export/map-export.ts"), /\.from\("canvas_retail_listings"\)/);
});

test("Export sits on the tables that are free to edit", () => {
  for (const [file, marker] of BUTTONS) {
    const source = read(file);
    assert.match(source, /TableExportButton/, file);
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), file);
    assert.doesNotMatch(source, /\u2014/, file);
  }
  assert.match(read("components/v3/live/TableExportButton.tsx"), />\s*Export\s*</);
});

test("Findability, Citation Ecosystem, Run Details, Suppressed Listings, and Strategy Roadmap have no Export button", () => {
  for (const file of NOT_DONE) {
    assert.doesNotMatch(read(file), /TableExportButton/, file);
  }
});

test("a CSV states filter, sort, as-of, and population, and a failed read has no file", async () => {
  const built = exportFile(
    "map",
    {
      filter: "Priced below MAP.",
      sort: "Worst leakage, lowest first.",
      asOf: "Nov 5, 2026, 6:16 PM UTC",
      population: "120 of 633 listings with a stored MAP price.",
    },
    ["Listing", "ASIN"],
    [["Player", "B000000001"]],
  );
  assert.equal(built.model.ok, true);
  assert.match(built.csv ?? "", /Filter,Priced below MAP/);
  assert.match(built.csv ?? "", /Sort,"Worst leakage, lowest first."/);
  assert.match(built.csv ?? "", /As of,"Nov 5, 2026, 6:16 PM UTC"/);
  assert.match(built.csv ?? "", /Population,120 of 633 listings with a stored MAP price\./);
  assert.match(built.csv ?? "", /Player,B000000001/);
  assert.equal(await loadTableExport("not-a-table", new URLSearchParams()), null);
});

test("export copy stays off fees and em dashes", () => {
  const files = [
    "components/v3/live/TableExportButton.tsx",
    "lib/export/map-export.ts",
    "lib/export/retail-export.ts",
    "lib/export/ai-export.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /\u2014/, file);
    assert.doesNotMatch(source, /\b(fees?|retainers?)\b/i, file);
    assert.doesNotMatch(source, /\$680|680K|\$38M/, file);
  }
});

test("static export still stashes the server CSV routes", () => {
  assert.match(read("scripts/prepare-static-export.mjs"), /app\/\(canvas\)\/dashboard\/export/);
});
