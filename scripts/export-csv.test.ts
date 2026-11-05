// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/export-csv.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { AiSearchRead } from "../lib/ai-search/types.ts";
import {
  BRIEFING_POPULATION,
  BRIEFING_SORT,
  briefingFilter,
  briefingPopulationSentence,
  buildBriefingExport,
} from "../lib/export/briefing-export.ts";
import { SUPPRESSED_FILTER, SUPPRESSED_SORT, buildSuppressedExport } from "../lib/export/suppressed-export.ts";
import { BRIEFING_LOST_REVENUE_LABEL, briefingFindingsLead } from "../lib/fender-canvas/briefing-retail-lead.ts";
import {
  countFeaturedOffer,
  withheldListings,
  type FeaturedOfferRow,
} from "../lib/fender-canvas/featured-offer.ts";
import { confirmedSuppressionSentence, formatCheckedAt } from "../lib/fender-canvas/featured-offer-copy.ts";
import { formatUsd } from "../lib/fender-canvas/format.ts";
import {
  mapLeakageFinding,
  suppressedListingsFinding,
  unnestedBundlesFinding,
  type CatalogBundleRow,
  type MapLeakageRow,
  type PortfolioRetailSnapshot,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import type { RetailCanvasRead } from "../lib/fender-canvas/portfolio-retail-display.ts";
import type { FindabilityRead } from "../lib/findability/copy.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function suppressed(asin = "B0EQ000000"): SuppressionSupportRow {
  return {
    asin,
    model_name: asin,
    offer_price: 200,
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 10000,
    featured_offer_observed_price_cents: 20000,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
  };
}

function present(): SuppressionSupportRow {
  return {
    ...suppressed("B0PRESENT01"),
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_observed_price_cents: 9000,
  };
}

function mapRow(leak: number | null): MapLeakageRow {
  return {
    map_price: 100,
    offer_price: 80,
    amz_leakage: leak,
    wmt_leakage: null,
    mf_leakage: null,
  };
}

function bundle(asin: string, parent: string | null): CatalogBundleRow {
  return {
    asin,
    model_name: asin,
    title: null,
    bundle_name: null,
    parent_asin: parent,
    product_url: null,
    is_bundle: true,
    featured_offer_state: "present",
  };
}

function snapshot(): PortfolioRetailSnapshot {
  return {
    suppressedListings: suppressedListingsFinding([suppressed(), present()]),
    mapLeakage: mapLeakageFinding([mapRow(-5), mapRow(4)]),
    unnestedBundles: unnestedBundlesFinding([
      bundle("B000000001", null),
      bundle("B000000002", "B000000099"),
    ]),
    amazonSpecGaps: {
      status: "unavailable",
      issueCount: null,
      missingMessage: "Amazon spec-field readings have not been stored.",
      detail: null,
    },
    headline: null,
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const COMMERCIAL =
  /\b(fees?|retainers?|monthly|per month|charges?|billing|invoices?|subscriptions?)\b/i;

test("briefing CSV uses briefingFindingsLead counts and states the four facts", () => {
  const retail: RetailCanvasRead = { phase: "ready", snapshot: snapshot() };
  const findability: FindabilityRead = { phase: "error", message: "down" };
  const ai: AiSearchRead = { phase: "no-run" };
  const asOf = "Oct 12, 2026, 12:41 PM UTC";
  const built = buildBriefingExport({ retail, findability, ai, asOf, freshnessFailed: false });
  const lead = briefingFindingsLead(retail, findability, ai);

  assert.equal(built.model.ok, true);
  assert.ok(built.csv);
  if (!built.model.ok || built.csv == null) return;

  assert.equal(built.model.provenance.filter, "No filter.");
  assert.equal(built.model.provenance.sort, BRIEFING_SORT);
  assert.equal(built.model.provenance.asOf, asOf);
  assert.equal(built.model.provenance.population, briefingPopulationSentence(lead.findings));
  assert.deepEqual(built.model.failures, [
    "The Findability read could not be loaded.",
    "No published AI Search run is stored.",
  ]);

  const rows = parseCsv(built.csv);
  assert.deepEqual(rows[0], ["Filter", built.model.provenance.filter]);
  assert.deepEqual(rows[1], ["Sort", BRIEFING_SORT]);
  assert.deepEqual(rows[2], ["As of", asOf]);
  assert.deepEqual(rows[3], ["Population", built.model.provenance.population]);
  assert.deepEqual(rows[4], ["Finding", "Percent", "Numerator", "Denominator", "Population"]);
  assert.equal(rows.length, 10);

  lead.findings.forEach((finding, index) => {
    const line = rows[5 + index];
    assert.equal(line[0], finding.label);
    assert.equal(line[1], finding.percent);
    assert.equal(line[2], finding.numerator == null ? "" : String(finding.numerator));
    assert.equal(line[3], finding.denominator == null ? "" : String(finding.denominator));
    if (finding.numerator == null) {
      assert.equal(line[2], "");
      assert.equal(line[4], finding.explainer);
    } else {
      assert.equal(line[4], BRIEFING_POPULATION[finding.id]);
      assert.match(built.model.ok ? built.model.provenance.population : "", new RegExp(finding.label));
    }
  });

  assert.equal(lead.findings[0].numerator, 1);
  assert.equal(lead.findings[0].denominator, 2);
  assert.match(built.model.provenance.population, /Buy Box withheld: .+ current Buy Box readings/);
  assert.doesNotMatch(built.csv, /\$680|680K|\$38M|38,000,000/);
  assert.doesNotMatch(built.csv, new RegExp(BRIEFING_LOST_REVENUE_LABEL));
  assert.equal(lead.findings.length, 5);
});

test("an approved MAP exception is named in the briefing filter", () => {
  const base = snapshot();
  const filtered = briefingFilter({
    phase: "ready",
    snapshot: {
      ...base,
      mapLeakage: mapLeakageFinding(
        [
          { ...mapRow(-5), asin: "B000000001" },
          { ...mapRow(4), asin: "B000000002" },
        ],
        { approvedExceptions: new Set(["B000000001"]) },
      ),
    },
  });
  assert.match(filtered, /^No filter on Buy Box withheld/);
  assert.match(filtered, /1 listing set aside as an approved exception is left out of this count/);
});

test("a failed briefing read offers no CSV", () => {
  const built = buildBriefingExport({
    retail: { phase: "error" },
    findability: { phase: "error", message: "down" },
    ai: { phase: "error", message: "down" },
    asOf: "Not available*",
    freshnessFailed: true,
  });
  assert.equal(built.csv, null);
  assert.equal(built.model.ok, false);
  if (built.model.ok) return;
  assert.match(built.model.message, /retail read could not be loaded/);
  assert.match(built.model.message, /Findability read could not be loaded/);
  assert.match(built.model.message, /AI Search read could not be loaded/);
  assert.match(built.model.message, /freshness read could not be loaded/);
  assert.doesNotMatch(built.model.message, /0 of 0/);
});

test("suppressed CSV keeps the query's withheld rows in the table's sort", () => {
  const low: FeaturedOfferRow = {
    ...suppressed("B0LOW00001"),
    model_name: "Low gap",
    featured_offer_observed_price_cents: 11000,
  };
  const high: FeaturedOfferRow = {
    ...suppressed("B0HIGH0001"),
    model_name: "High gap",
    featured_offer_observed_price_cents: 20000,
  };
  const open: FeaturedOfferRow = {
    ...suppressed("B0OPEN0001"),
    model_name: "Present",
    featured_offer_state: "present",
    featured_offer_observed_price_cents: 9000,
  };
  const blank: FeaturedOfferRow = {
    ...suppressed("B0BLANK001"),
    model_name: "No benchmark",
    competitive_external_price_state: "unavailable",
    competitive_price_threshold_cents: null,
    featured_offer_observed_price_cents: null,
  };
  const counts = countFeaturedOffer([low, high, open, blank]);
  const built = buildSuppressedExport({
    rows: [low, open, blank, high],
    counts,
    missingMessage: null,
  });
  assert.equal(built.model.ok, true);
  assert.ok(built.csv);
  if (!built.model.ok || built.csv == null) return;

  assert.equal(built.model.provenance.filter, SUPPRESSED_FILTER);
  assert.equal(built.model.provenance.sort, SUPPRESSED_SORT);
  assert.equal(built.model.provenance.asOf, formatCheckedAt(counts.newestCheckedAt));
  assert.equal(built.model.provenance.population, confirmedSuppressionSentence(counts));
  assert.deepEqual(built.model.failures, []);

  const rows = parseCsv(built.csv);
  assert.deepEqual(rows[0], ["Filter", SUPPRESSED_FILTER]);
  assert.deepEqual(rows[1], ["Sort", SUPPRESSED_SORT]);
  assert.deepEqual(rows[2], ["As of", built.model.provenance.asOf]);
  assert.deepEqual(rows[3], ["Population", confirmedSuppressionSentence(counts)]);
  assert.deepEqual(rows[4], [
    "Listing",
    "ASIN",
    "Observed offer",
    "Competitive External Price",
    "Above benchmark",
    "Checked",
  ]);

  const ordered = withheldListings([low, open, blank, high]);
  assert.deepEqual(
    rows.slice(5).map((line) => line[1]),
    ordered.map((row) => row.asin),
  );
  assert.equal(rows[5][1], "B0HIGH0001");
  assert.equal(rows[5][4], formatUsd(100, { signed: true }));
  const blankLine = rows.find((line) => line[1] === "B0BLANK001");
  assert.ok(blankLine);
  assert.equal(blankLine[2], "Not observed");
  assert.equal(blankLine[3], "Not published by Amazon");
  assert.equal(blankLine[4], "No comparable pair");
  assert.equal(rows.some((line) => line[1] === "B0OPEN0001"), false);
  assert.doesNotMatch(built.csv, /\$680|680K|\$38M/);
});

test("a missing Buy Box reading does not invent a suppressed population", () => {
  const built = buildSuppressedExport({
    rows: [suppressed("B0EQ000000")],
    counts: null,
    missingMessage: "The Buy Box reading could not be loaded.",
  });
  assert.equal(built.model.ok, true);
  if (!built.model.ok || built.csv == null) return;
  assert.equal(built.model.provenance.population, "The Buy Box reading could not be loaded.");
  assert.equal(built.model.provenance.asOf, "Not available*");
  assert.deepEqual(built.model.failures, ["The Buy Box reading could not be loaded."]);
  assert.match(built.csv, /B0EQ000000/);
  assert.doesNotMatch(built.csv, /0 of 0/);
});

test("the suppressed loader imports the existing query", () => {
  const loader = read("lib/export/load-suppressed.ts");
  assert.match(loader, /suppressedListingsQuery/);
  assert.match(loader, /featuredOfferColumnProbe/);
  assert.match(loader, /featuredOfferReadingCountQuery/);
  assert.doesNotMatch(loader, /canvas_retail_listings/);
  assert.doesNotMatch(loader, /\.eq\(/);
  const briefing = read("lib/export/load-briefing.ts");
  assert.match(briefing, /loadPortfolioRetailSnapshot/);
  assert.match(briefing, /loadFindabilityRead/);
  assert.match(briefing, /loadAiSearchRead/);
  assert.match(briefing, /withMapApprovedExceptions/);
  assert.match(read("lib/export/briefing-export.ts"), /briefingFindingsLead/);
  const ai = read("lib/export/briefing-ai.ts");
  assert.match(ai, /displayedAiRead/);
  assert.match(ai, /loadHistoryCatalog/);
  assert.match(ai, /loadHistorySnapshot/);
  assert.match(ai, /defaultWindowRuns/);
  assert.match(ai, /clientWindowSnapshots/);
});

test("export copy stays off fees, dollar estimates, and em dashes", () => {
  const files = [
    "app/(canvas)/dashboard/export/page.tsx",
    "app/(canvas)/dashboard/export/ExportCard.tsx",
    "app/(canvas)/dashboard/export/ExportThemeRoot.tsx",
    "app/(canvas)/dashboard/export/export.css",
    "lib/export/briefing-export.ts",
    "lib/export/suppressed-export.ts",
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /\u2014/, file);
    assert.doesNotMatch(source, COMMERCIAL, file);
    assert.doesNotMatch(source, /\$680|680K|\$38,?000,?000|\$38M/, file);
    assert.doesNotMatch(source, /<(span|a|button|p|dt|dd|h1|h2)[^>]*\stitle=/, file);
  }
  const card = read("app/(canvas)/dashboard/export/ExportCard.tsx");
  assert.match(card, /model\.ok \?/);
  assert.match(card, /data-export-unavailable/);
  assert.match(card, /data-export-population/);
  assert.match(card, /data-export-as-of/);
  assert.match(card, /DASHBOARD_PATH/);
  assert.doesNotMatch(read("app/(canvas)/dashboard/export/page.tsx"), /redirect\(/);
});

test("static export stashes the server CSV routes", () => {
  const stash = read("scripts/prepare-static-export.mjs");
  assert.match(stash, /app\/\(canvas\)\/dashboard\/export/);
});
