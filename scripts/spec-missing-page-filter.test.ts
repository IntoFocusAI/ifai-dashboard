// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/spec-missing-page-filter.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { specRowsFilter, specRowsQuery } from "../lib/canvasData.ts";

type SpecRow = {
  asin: string;
  fender_found: boolean | null;
  amazon_completeness_pct: number;
};

function memoryClient(rows: SpecRow[]) {
  const eqs: Array<[string, unknown]> = [];

  function ordered(eqFilters: Array<[string, false]>) {
    let from = 0;
    let to = Math.max(rows.length - 1, 0);
    const builder = {
      eq(column: "fender_found", value: false) {
        assert.equal(column, "fender_found");
        assert.equal(value, false);
        eqs.push([column, value]);
        return ordered([...eqFilters, [column, value]]);
      },
      range(nextFrom: number, nextTo: number) {
        from = nextFrom;
        to = nextTo;
        return builder;
      },
      then(
        onFulfilled: (value: { data: SpecRow[]; count: number; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        const matched = rows
          .filter((row) => eqFilters.every(([column, value]) => row[column] === value))
          .sort((a, b) => a.amazon_completeness_pct - b.amazon_completeness_pct);
        return Promise.resolve({
          data: matched.slice(from, to + 1),
          count: matched.length,
          error: null,
        }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    eqs,
    client: {
      from(table: string) {
        assert.equal(table, "canvas_spec_readiness");
        return {
          select(_columns: string, options: { count: "exact" }) {
            assert.equal(options.count, "exact");
            return {
              order(column: string, options: { ascending: boolean }) {
                assert.equal(column, "amazon_completeness_pct");
                assert.equal(options.ascending, true);
                return ordered([]);
              },
            };
          },
        };
      },
    },
  };
}

test("the missing-page filter keeps the false row, and clearing brings both back", async () => {
  const rows: SpecRow[] = [
    { asin: "B00FOUND", fender_found: true, amazon_completeness_pct: 30 },
    { asin: "B00MISSING", fender_found: false, amazon_completeness_pct: 20 },
  ];
  const { client, eqs } = memoryClient(rows);

  const filtered = await specRowsQuery(0, 50, specRowsFilter(true, true), client);
  assert.deepEqual(eqs, [["fender_found", false]]);
  assert.equal(filtered.count, 1);
  assert.equal(filtered.data?.length, 1);
  assert.equal(filtered.data?.[0]?.asin, "B00MISSING");
  assert.equal(filtered.data?.[0]?.fender_found, false);

  eqs.length = 0;
  const cleared = await specRowsQuery(0, 50, specRowsFilter(true, false), client);
  assert.deepEqual(eqs, []);
  assert.deepEqual(
    cleared.data?.map((row) => (row as SpecRow).asin),
    ["B00MISSING", "B00FOUND"],
  );

  const schema = await specRowsQuery(0, 50, specRowsFilter(false, true), client);
  assert.equal(specRowsFilter(false, true), undefined);
  assert.deepEqual(eqs, []);
  assert.deepEqual(
    schema.data?.map((row) => (row as SpecRow).fender_found),
    [false, true],
  );
});

test("a null flag is not in the missing-page list", async () => {
  const { client } = memoryClient([
    { asin: "B00FOUND", fender_found: true, amazon_completeness_pct: 30 },
    { asin: "B00MISSING", fender_found: false, amazon_completeness_pct: 20 },
    { asin: "B00UNCHECKED", fender_found: null, amazon_completeness_pct: 10 },
  ]);
  const filtered = await specRowsQuery(0, 50, { missingFenderPage: true }, client);
  assert.deepEqual(
    filtered.data?.map((row) => (row as SpecRow).asin),
    ["B00MISSING"],
  );
});

test("the filter counts every missing page, not the current page of 50", async () => {
  const found: SpecRow = { asin: "B00FOUND", fender_found: true, amazon_completeness_pct: 1 };
  const missing = Array.from({ length: 51 }, (_, index): SpecRow => ({
    asin: `B00M${index}`,
    fender_found: false,
    amazon_completeness_pct: index + 2,
  }));
  const { client } = memoryClient([found, ...missing]);

  const firstPage = await specRowsQuery(0, 50, undefined, client);
  const firstPageRows = (firstPage.data ?? []) as SpecRow[];
  assert.equal(firstPageRows[0]?.asin, "B00FOUND");
  assert.equal(firstPageRows.filter((row) => row.fender_found === false).length, 49);

  const filtered = await specRowsQuery(0, 50, { missingFenderPage: true }, client);
  const filteredRows = (filtered.data ?? []) as SpecRow[];
  assert.equal(filtered.count, 51);
  assert.equal(filteredRows.length, 50);
  assert.equal(filteredRows.every((row) => row.fender_found === false), true);
  assert.equal(filteredRows.some((row) => row.asin === "B00FOUND"), false);
});

test("the catalog control copy stays on the live rollup and the custom tooltip", () => {
  const root = new URL("..", import.meta.url);
  const read = (path: string) => readFileSync(new URL(path, root), "utf8");
  const lead = read("components/v3/live/AiReadinessLead.tsx");
  const narrative = read("components/v3/live/FenderSpecNarratives.tsx");
  const panel = read("components/v3/live/FenderSpecPanel.tsx");
  const catalog = read("components/v3/live/CatalogReadinessSpec.tsx");
  const spokes = read("components/v3/build-live-spokes.tsx");
  const forbidden = /\b(123|802|925)\b/;

  assert.doesNotMatch(lead, /data-spec-filter/);
  assert.doesNotMatch(lead, /spec-found-pill/);
  assert.doesNotMatch(lead, /missingPageControl|Show\/Hide|Show all/);
  assert.doesNotMatch(lead, /content-box-title/);
  assert.doesNotMatch(lead, /<th>Metric<\/th>/);
  assert.doesNotMatch(lead, /<th>Result<\/th>/);
  assert.doesNotMatch(lead, /ai-readiness-lead-note/);
  assert.doesNotMatch(lead, /older spec read/);
  assert.doesNotMatch(lead, /Official-page outcomes are on the Findability tab/);
  assert.doesNotMatch(lead, /(?<![\w-])title=/);
  assert.doesNotMatch(lead, forbidden);
  assert.doesNotMatch(narrative, /data-spec-filter/);
  assert.doesNotMatch(narrative, /(?<![\w-])title=/);
  assert.doesNotMatch(narrative, forbidden);

  // Two-bar preview with a title chevron; Amazon-only fields; no text button under the bars.
  assert.match(panel, /MISSING_FIELD_PREVIEW = 2/);
  assert.match(panel, /amazonOnly\.slice\(0, MISSING_FIELD_PREVIEW\)/);
  assert.match(panel, /Top missing Amazon fields/);
  assert.match(panel, /data-spec-missing-fields-toggle/);
  assert.match(panel, /aria-expanded=\{showAll\}/);
  assert.match(panel, /retail-explore-chevron/);
  assert.match(panel, /spec-missing-fields-preview/);
  assert.doesNotMatch(panel, /fender\.com found/);
  assert.doesNotMatch(panel, /Show all \$\{formatInt\(missing\.length\)\} fields/);
  assert.doesNotMatch(panel, /Show fewer fields/);
  assert.doesNotMatch(panel, /missingPagesOnly/);
  assert.doesNotMatch(panel, /MISSING_PAGE_DESC/);
  assert.doesNotMatch(panel, /slice\(0, 8\)/);
  assert.doesNotMatch(panel, /(?<![\w-])title=/);
  assert.doesNotMatch(panel, forbidden);

  assert.match(catalog, /AiReadinessLead/);
  assert.match(catalog, /catalogReadiness/);
  assert.doesNotMatch(catalog, /missingPagesOnly/);
  assert.doesNotMatch(catalog, forbidden);

  assert.match(spokes, /<CatalogReadinessSpec bundle=\{bundle\} \/>/);
  assert.match(
    spokes,
    /<MachineReadabilityPanel summary=\{bundle\.specPages \?\? null\} metrics=\{bundle\.m\} \/>/,
  );
  assert.doesNotMatch(spokes, /<FenderSpecPanel/);
  assert.doesNotMatch(spokes, forbidden);

  const schemaList = read("components/v3/live/MachineReadabilityPanel.tsx");
  const governance = read("components/v3/live/CatalogGovernancePanel.tsx");
  assert.doesNotMatch(schemaList, /Spec readiness by ASIN/);
  assert.doesNotMatch(schemaList, /Top missing schema fields/);
  assert.doesNotMatch(schemaList, /\stitle=/);
  assert.doesNotMatch(schemaList, forbidden);
  assert.match(schemaList, /dataAttr="data-machine-hero"/);
  assert.match(governance, /data-ifai-open="specs"/);
  assert.match(governance, /data-ifai-tab="Amazon Specs"/);
  assert.match(governance, /Splintered listings/);
  assert.doesNotMatch(governance, /catalog-specs/);
  assert.doesNotMatch(governance, /Missing Amazon spec fields/);
  assert.doesNotMatch(governance, /\b435\b/);
  assert.doesNotMatch(governance, /(?<![\w-])title=/);
});
