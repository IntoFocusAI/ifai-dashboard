// node --experimental-strip-types --import ./scripts/register-ts-extensions.mjs --test scripts/portfolio-retail-findings.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { tabSlug } from "../lib/canvas-sdk/canvas-url-state.ts";
import {
  amazonSpecGapsFinding,
  FENDER_RETAIL_HEADLINE_RANK,
  loadPortfolioRetailSnapshot,
  mapLeakageFinding,
  readPages,
  RETAIL_AMAZON_SPEC_COLUMNS,
  RETAIL_CATALOG_GOVERNANCE_COLUMNS,
  RETAIL_FINDING_LABELS,
  RETAIL_MAP_LEAKAGE_COLUMNS,
  RETAIL_SUPPRESSION_COLUMNS,
  selectRetailHeadline,
  suppressedListingsFinding,
  unnestedBundlesFinding,
  usableParentAsin,
  type AmazonSpecRow,
  type CatalogBundleRow,
  type MapLeakageRow,
  type PortfolioRetailFindings,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";

/** Recent enough that the reading counts as current whenever the suite runs. */
const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

/** Confirmed withheld, above a benchmark from the same observation. */
function suppression(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return {
    asin: "B0EQ000000",
    offer_price: 949.99,
    featured_offer_state: "withheld",
    featured_offer_withheld: true,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 84999,
    featured_offer_observed_price_cents: 94999,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: null,
    ...overrides,
  };
}

/** Featured Offer present, with a benchmark from the same observation. */
function present(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return suppression({
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_observed_price_cents: 84999,
    featured_offer_observed_seller: "ATVPDKIKX0DER",
    ...overrides,
  });
}

/** No v11 reading at all. Not a zero. */
function notChecked(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return suppression({
    featured_offer_state: null,
    featured_offer_withheld: null,
    featured_offer_source: null,
    featured_offer_checked_at: null,
    featured_offer_attempted_at: null,
    competitive_external_price_state: null,
    competitive_price_threshold_cents: null,
    featured_offer_observed_price_cents: null,
    ...overrides,
  });
}

function mapRow(overrides: Partial<MapLeakageRow> = {}): MapLeakageRow {
  return {
    map_price: 100,
    offer_price: 80,
    amz_leakage: -20,
    wmt_leakage: null,
    mf_leakage: null,
    ...overrides,
  };
}

function bundle(overrides: Partial<CatalogBundleRow> & Pick<CatalogBundleRow, "asin">): CatalogBundleRow {
  return {
    model_name: "Player II Stratocaster",
    title: "Fender Player II Stratocaster",
    bundle_name: "Starter kit",
    parent_asin: null,
    product_url: "https://www.amazon.com/dp/B0D8TFXHHT",
    is_bundle: true,
    featured_offer_state: "present",
    ...overrides,
  };
}

function findings(overrides: Partial<PortfolioRetailFindings> = {}): PortfolioRetailFindings {
  const zero = suppressedListingsFinding([present()]);
  const mapZero = mapLeakageFinding([mapRow({ amz_leakage: 0, offer_price: 100 })]);
  const bundlesZero = unnestedBundlesFinding([
    bundle({ asin: "B000000001", parent_asin: "B0000000ZZ" }),
  ]);
  return {
    suppressedListings: zero,
    mapLeakage: mapZero,
    unnestedBundles: bundlesZero,
    amazonSpecGaps: amazonSpecGapsFinding([
      { asin: "B000000001", title: "Strat", amazon_checked: true, amazon_missing_fields: "" },
    ]),
    ...overrides,
  };
}

test("coverage counts current classifications, not the older withheld boolean", () => {
  const reading = suppressedListingsFinding([
    suppression(),
    present(),
    notChecked(),
    suppression({ featured_offer_state: "check_failed", featured_offer_withheld: null, featured_offer_last_error: "missing_from_keepa" }),
    suppression({ featured_offer_state: "no_active_offer", featured_offer_withheld: null, featured_offer_source: "catalog.current_price", featured_offer_observed_price_cents: null }),
  ]);

  assert.equal(reading.status, "incomplete");
  assert.equal(reading.detail?.counts.population, 5);
  assert.equal(reading.detail?.counts.present, 1);
  assert.equal(reading.detail?.counts.withheld, 1);
  assert.equal(reading.detail?.counts.noActiveOffer, 1);
  assert.equal(reading.detail?.counts.checkFailed, 1);
  assert.equal(reading.detail?.counts.notChecked, 1);
  // Unchecked and failed stay in the denominator instead of being hidden.
  assert.equal(reading.detail?.audited, 3);
  assert.equal(reading.detail?.population, 5);
  assert.equal(reading.detail?.counts.catalogNoActiveOffer, 1);
  assert.equal(reading.detail?.counts.requiresKeepa, 4);
  assert.match(reading.missingMessage ?? "", /not been checked yet/);
  assert.match(reading.missingMessage ?? "", /failed/);
  assert.doesNotMatch(reading.missingMessage ?? "", /partner-led/i);
});

test("the older withheld boolean on its own is not coverage", () => {
  const legacy = suppressedListingsFinding([
    notChecked({ featured_offer_withheld: false }),
    notChecked({ featured_offer_withheld: true, competitive_price_threshold_cents: 84999 }),
  ]);
  assert.equal(legacy.status, "unavailable");
  assert.equal(legacy.issueCount, null);
  assert.equal(legacy.detail?.counts.legacyBooleanOnly, 2);
  assert.equal(legacy.detail?.counts.classified, 0);
  assert.equal(legacy.detail?.counts.withheld, 0);
  assert.equal(legacy.detail?.counts.confirmedHighPrice, 0);
});

test("a stored zero suppression is separate from an absent reading", () => {
  const storedZero = suppressedListingsFinding([
    present({ featured_offer_observed_price_cents: 8000, competitive_price_threshold_cents: 9000 }),
    present({ competitive_external_price_state: "unavailable", competitive_price_threshold_cents: null }),
  ]);
  assert.equal(storedZero.status, "available_with_zero");
  assert.equal(storedZero.issueCount, 0);
  assert.equal(storedZero.missingMessage, null);

  const emptyPopulation = suppressedListingsFinding([]);
  assert.equal(emptyPopulation.status, "available_with_zero");
  assert.equal(emptyPopulation.issueCount, 0);

  const absent = suppressedListingsFinding(null);
  assert.equal(absent.status, "unavailable");
  assert.equal(absent.issueCount, null);
  assert.equal(absent.detail, null);
  assert.match(absent.missingMessage ?? "", /has not stored a reading/);

  const neverWritten = suppressedListingsFinding([notChecked(), notChecked()]);
  assert.equal(neverWritten.status, "unavailable");
  assert.equal(neverWritten.issueCount, null);
});

test("a finished reading with a confirmed suppression is available", () => {
  const reading = suppressedListingsFinding([
    suppression({ featured_offer_observed_price_cents: 10000, competitive_price_threshold_cents: 9000 }),
    present({ featured_offer_observed_price_cents: 5000, competitive_price_threshold_cents: 4000 }),
  ]);
  assert.equal(reading.status, "available_with_issues");
  assert.equal(reading.issueCount, 1);
  assert.equal(reading.missingMessage, null);
  assert.equal(reading.detail?.audited, reading.detail?.population);
  // Every withheld listing has a benchmark here, so the stronger label applies.
  assert.equal(reading.headlineLabel, "Buy Box withheld above Amazon's outside price");
});

test("a withheld listing with no benchmark keeps the plain withheld headline", () => {
  const reading = suppressedListingsFinding([
    suppression({ featured_offer_observed_price_cents: 10000, competitive_price_threshold_cents: 9000 }),
    suppression({ competitive_external_price_state: "unavailable", competitive_price_threshold_cents: null }),
  ]);
  assert.equal(reading.headlineLabel, "Buy Box withheld");
  // The headline is the confirmed withheld count, not the comparable subset.
  assert.equal(reading.issueCount, 2);
  assert.equal(reading.detail?.counts.confirmedHighPrice, 1);
  assert.equal(reading.detail?.counts.withheldWithoutBenchmark, 1);
});

test("MAP violations are stored leakage below zero, and a missing price is not zero", () => {
  const reading = mapLeakageFinding([
    mapRow({ amz_leakage: -20, wmt_leakage: -30, mf_leakage: null }),
    mapRow({ amz_leakage: 5, wmt_leakage: null, mf_leakage: null }),
    mapRow({ map_price: null, offer_price: 40, amz_leakage: null, wmt_leakage: null, mf_leakage: null }),
    mapRow({ amz_leakage: "0", wmt_leakage: null }),
  ]);

  assert.equal(reading.status, "incomplete");
  assert.equal(reading.issueCount, 1);
  assert.equal(reading.detail?.violations, 1);
  assert.equal(reading.detail?.undecided, 1);
  assert.equal(reading.detail?.averageLeakage, -30);
  assert.match(reading.missingMessage ?? "", /not counted as zero/);
  assert.doesNotMatch(reading.missingMessage ?? "", /partner-led/i);
});

test("MAP average leakage is omitted when no violation stores a leakage", () => {
  const reading = mapLeakageFinding([
    mapRow({ amz_leakage: 0, offer_price: 100, map_price: 100 }),
    mapRow({ amz_leakage: 4, wmt_leakage: 2, mf_leakage: null }),
  ]);
  assert.equal(reading.status, "available_with_zero");
  assert.equal(reading.issueCount, 0);
  assert.equal(reading.detail?.averageLeakage, null);
});

test("MAP ignores bundle membership and does not invent an impact", () => {
  const withBundleFlag = mapLeakageFinding([
    mapRow({ amz_leakage: -10, wmt_leakage: -4 }),
    mapRow({ amz_leakage: -2 }),
  ]);
  assert.equal(withBundleFlag.status, "available_with_issues");
  assert.equal(withBundleFlag.issueCount, 2);
  assert.equal(withBundleFlag.detail?.averageLeakage, -6);

  const absent = mapLeakageFinding(null);
  assert.equal(absent.status, "unavailable");
  assert.equal(absent.issueCount, null);
  assert.equal(absent.detail, null);

  const neverStored = mapLeakageFinding([
    mapRow({ map_price: null, offer_price: null, amz_leakage: null, wmt_leakage: null, mf_leakage: null }),
  ]);
  assert.equal(neverStored.status, "unavailable");
  assert.equal(neverStored.issueCount, null);
  assert.equal(neverStored.missingMessage, "Fender MAP prices have not been stored.");
});

test("an empty MAP price is not zero listings below MAP", () => {
  const reading = mapLeakageFinding([
    mapRow({
      map_price: null,
      offer_price: 599.99,
      amz_leakage: null,
      wmt_leakage: null,
      mf_leakage: null,
    }),
    mapRow({
      map_price: null,
      offer_price: 287.93,
      amz_leakage: null,
      wmt_leakage: null,
      mf_leakage: null,
    }),
    mapRow({ map_price: 0, offer_price: 10, amz_leakage: -10, wmt_leakage: null, mf_leakage: null }),
  ]);

  assert.equal(reading.status, "unavailable");
  assert.equal(reading.issueCount, null);
  assert.equal(reading.detail, null);
  assert.equal(reading.missingMessage, "Fender MAP prices have not been stored.");
  assert.doesNotMatch(reading.missingMessage ?? "", /\d|below MAP|gap/);
});

test("a bundle with a usable parent is not an unnested opportunity", () => {
  assert.equal(usableParentAsin("B0000000ZZ", "B000000001"), true);
  assert.equal(usableParentAsin("b0000000zz", "B000000001"), true);
  assert.equal(usableParentAsin("B000000001", "B000000001"), false);
  assert.equal(usableParentAsin("not-an-asin", "B000000001"), false);
  assert.equal(usableParentAsin("  ", "B000000001"), false);
  assert.equal(usableParentAsin(null, "B000000001"), false);

  const reading = unnestedBundlesFinding([
    bundle({ asin: "B000000002", parent_asin: "B0000000ZZ" }),
    bundle({ asin: "B000000001", parent_asin: null, bundle_name: "Gear kit", model_name: null, title: "Tele" }),
    bundle({ asin: "B000000003", parent_asin: "pending", bundle_name: "  " }),
    bundle({ asin: "B000000004", is_bundle: false, parent_asin: null }),
    bundle({ asin: "B000000005", parent_asin: "B000000005" }),
  ]);

  assert.equal(reading.status, "available_with_issues");
  assert.equal(reading.issueCount, 3);
  assert.deepEqual(
    reading.detail?.opportunities.map((row) => row.asin),
    ["B000000001", "B000000003", "B000000005"],
  );
  const missing = reading.detail?.opportunities[0];
  assert.equal(missing?.modelOrTitle, "Tele");
  assert.equal(missing?.bundleName, "Gear kit");
  assert.equal(missing?.parentAsin, null);
  assert.equal(missing?.productUrl, "https://www.amazon.com/dp/B0D8TFXHHT");
  assert.deepEqual(missing?.justification, {
    isBundle: true,
    parentAsin: null,
    reason: "missing_parent_asin",
  });
  assert.equal(reading.detail?.opportunities[1]?.justification.reason, "unusable_parent_asin");
  assert.equal(reading.detail?.opportunities[1]?.bundleName, null);
  assert.equal("seller" in (reading.detail?.opportunities[0] ?? {}), false);
});

test("the catalog's wider bundle flag count does not make the live-offer figure incomplete", () => {
  const reading = unnestedBundlesFinding(
    [bundle({ asin: "B000000001", parent_asin: null })],
    { catalogBundleCount: 4 },
  );
  assert.equal(reading.status, "available_with_issues");
  assert.equal(reading.issueCount, 1);
  assert.equal(reading.detail?.bundlesInRead, 1);
  assert.equal(reading.detail?.catalogBundles, 4);
  assert.equal(reading.missingMessage, null);
  assert.doesNotMatch(JSON.stringify(reading), /partner-led|authorized seller/i);
});

test("a complete catalog with every bundle nested is a stored zero", () => {
  const reading = unnestedBundlesFinding(
    [
      bundle({ asin: "B000000001", parent_asin: "B0000000ZZ" }),
      bundle({ asin: "B000000002", is_bundle: false, parent_asin: null }),
    ],
    { catalogBundleCount: 1 },
  );
  assert.equal(reading.status, "available_with_zero");
  assert.equal(reading.issueCount, 0);
  assert.equal(reading.detail?.opportunities.length, 0);
});

test("a failed bundle read is unavailable and is not replaced by the catalog count", () => {
  const reading = unnestedBundlesFinding(null, { catalogBundleCount: 941 });
  assert.equal(reading.status, "unavailable");
  assert.equal(reading.issueCount, null);
  assert.equal(reading.detail, null);
});

test("Amazon spec gaps come from the stored semicolon list", () => {
  const rows: AmazonSpecRow[] = [
    {
      asin: "B000000002",
      title: "Tele",
      amazon_checked: true,
      amazon_missing_fields: "neck_material_type; fretboard_material_type; ;color",
    },
    {
      asin: "B000000001",
      title: "Strat",
      amazon_checked: true,
      amazon_missing_fields: "",
    },
    {
      asin: "B000000003",
      title: "Jazz",
      amazon_checked: false,
      amazon_missing_fields: null,
    },
  ];
  const reading = amazonSpecGapsFinding(rows);
  assert.equal(reading.status, "incomplete");
  assert.equal(reading.issueCount, 1);
  assert.equal(reading.detail?.checked, 2);
  assert.equal(reading.detail?.unchecked, 1);
  assert.deepEqual(reading.detail?.gaps, [
    {
      asin: "B000000002",
      modelOrTitle: "Tele",
      missingFields: ["neck_material_type", "fretboard_material_type", "color"],
    },
  ]);
  assert.match(reading.missingMessage ?? "", /not counted as zero/);
});

test("a finished spec read with no missing fields is a stored zero", () => {
  const reading = amazonSpecGapsFinding([
    { asin: "B000000001", title: "Strat", amazon_checked: true, amazon_missing_fields: null },
  ]);
  assert.equal(reading.status, "available_with_zero");
  assert.equal(reading.issueCount, 0);
  assert.equal(reading.detail?.gaps.length, 0);
});

test("an empty spec source is unavailable rather than zero gaps", () => {
  const reading = amazonSpecGapsFinding([]);
  assert.equal(reading.status, "unavailable");
  assert.equal(reading.issueCount, null);
});

test("headline rank prefers suppressed Featured Offers, then MAP, then unnested bundles", () => {
  assert.deepEqual(FENDER_RETAIL_HEADLINE_RANK, [
    "suppressed_listings",
    "map_leakage",
    "unnested_bundles",
  ]);

  const selected = selectRetailHeadline(
    findings({
      suppressedListings: suppressedListingsFinding([suppression(), present()]),
      mapLeakage: mapLeakageFinding([mapRow()]),
      unnestedBundles: unnestedBundlesFinding([bundle({ asin: "B000000009" })]),
    }),
  );
  assert.equal(selected?.findingId, "suppressed_listings");
  assert.equal(selected?.label, "Suppressed Listings");
  assert.equal(selected?.tabSlug, tabSlug("Suppressed Listings"));
  assert.equal(selected?.tabSlug, "suppressed-listings");
  assert.equal(selected?.reading.issueCount, 1);
});

test("a confirmed zero is skipped and the next finding is used", () => {
  const selected = selectRetailHeadline(
    findings({
      mapLeakage: mapLeakageFinding([mapRow({ amz_leakage: -12 })]),
      unnestedBundles: unnestedBundlesFinding([bundle({ asin: "B000000009" })]),
    }),
  );
  assert.equal(selected?.findingId, "map_leakage");
  assert.equal(selected?.tabSlug, "map");
  assert.equal(selected?.label, RETAIL_FINDING_LABELS.map_leakage);

  const bundles = selectRetailHeadline(
    findings({
      unnestedBundles: unnestedBundlesFinding([bundle({ asin: "B000000009", parent_asin: null })]),
    }),
  );
  assert.equal(bundles?.findingId, "unnested_bundles");
  assert.equal(bundles?.label, "Catalog Governance");
  assert.equal(bundles?.tabSlug, "catalog-governance");
});

test("all confirmed zeros select nothing", () => {
  assert.equal(selectRetailHeadline(findings()), null);
});

test("a missing top reading is returned and does not fall through", () => {
  const absent = selectRetailHeadline(
    findings({
      suppressedListings: suppressedListingsFinding(null),
      mapLeakage: mapLeakageFinding([mapRow()]),
      unnestedBundles: unnestedBundlesFinding([bundle({ asin: "B000000009" })]),
    }),
  );
  assert.equal(absent?.findingId, "suppressed_listings");
  assert.equal(absent?.reading.status, "unavailable");
  assert.equal(absent?.reading.issueCount, null);
  assert.match(absent?.reading.missingMessage ?? "", /has not stored a reading/);

  const partial = selectRetailHeadline(
    findings({
      suppressedListings: suppressedListingsFinding([notChecked(), present()]),
      mapLeakage: mapLeakageFinding([mapRow({ amz_leakage: -50 })]),
    }),
  );
  assert.equal(partial?.findingId, "suppressed_listings");
  assert.equal(partial?.reading.status, "incomplete");
  assert.equal(partial?.reading.issueCount, 0);

  const mapMissing = selectRetailHeadline(
    findings({
      mapLeakage: mapLeakageFinding(null),
      unnestedBundles: unnestedBundlesFinding([bundle({ asin: "B000000009" })]),
    }),
  );
  assert.equal(mapMissing?.findingId, "map_leakage");
  assert.equal(mapMissing?.reading.status, "unavailable");
});

test("headline selection ignores 1P share, active listings, and unknown sellers", () => {
  const selected = selectRetailHeadline({
    ...findings({
      unnestedBundles: unnestedBundlesFinding([bundle({ asin: "B000000009" })]),
    }),
    amazon1pShare: 8.3,
    activeListingCount: 1029,
    unknownSellerPercentage: 92.6,
  } as PortfolioRetailFindings);
  assert.equal(selected?.findingId, "unnested_bundles");
  assert.equal(selected?.tabSlug, tabSlug(RETAIL_FINDING_LABELS.unnested_bundles));
  assert.notEqual(selected?.findingId, "amazon1pShare");
});

test("query columns stay on the stored finding fields", () => {
  assert.match(RETAIL_SUPPRESSION_COLUMNS, /competitive_price_threshold_cents/);
  assert.match(RETAIL_SUPPRESSION_COLUMNS, /featured_offer_withheld/);
  assert.match(RETAIL_SUPPRESSION_COLUMNS, /featured_offer_state/);
  assert.match(RETAIL_SUPPRESSION_COLUMNS, /featured_offer_checked_at/);
  assert.match(RETAIL_SUPPRESSION_COLUMNS, /featured_offer_observed_price_cents/);
  assert.match(RETAIL_SUPPRESSION_COLUMNS, /competitive_external_price_state/);
  assert.doesNotMatch(RETAIL_SUPPRESSION_COLUMNS, /map_price/);
  assert.match(RETAIL_MAP_LEAKAGE_COLUMNS, /amz_leakage/);
  assert.doesNotMatch(RETAIL_MAP_LEAKAGE_COLUMNS, /is_bundle|parent_asin|buybox/);
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /parent_asin/);
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /bundle_name/);
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /product_url/);
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /category/);
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /buybox_seller_name/);
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /buybox_seller_id/);
  assert.match(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /buybox_status/);
  assert.doesNotMatch(RETAIL_CATALOG_GOVERNANCE_COLUMNS, /authorized/);
  assert.match(RETAIL_AMAZON_SPEC_COLUMNS, /amazon_missing_fields/);
  assert.doesNotMatch(RETAIL_AMAZON_SPEC_COLUMNS, /fender_missing_fields/);
});

test("a failed page read is unavailable and a stored page zero stays zero", async () => {
  const failed = await loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({ ok: false }),
    mapRows: async () => ({ ok: true, rows: [mapRow({ amz_leakage: -5 })], truncated: false }),
    catalogRows: async () => ({ ok: true, rows: [bundle({ asin: "B000000009" })], truncated: false }),
    catalogBundleCount: async () => 941,
    specRows: async () => ({ ok: false }),
  });
  assert.equal(failed.suppressedListings.status, "unavailable");
  assert.equal(failed.headline?.findingId, "suppressed_listings");
  assert.equal(failed.amazonSpecGaps.status, "unavailable");
  assert.equal(failed.unnestedBundles.status, "available_with_issues");
  assert.notEqual(failed.headline?.findingId, "map_leakage");

  const storedZero = await loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({ ok: true, rows: [present()], truncated: false }),
    mapRows: async () => ({ ok: true, rows: [], truncated: false }),
    catalogRows: async () => ({ ok: true, rows: [], truncated: false }),
    catalogBundleCount: async () => null,
    specRows: async () => ({
      ok: true,
      rows: [{ asin: "B000000001", title: "Strat", amazon_checked: true, amazon_missing_fields: "color" }],
      truncated: false,
    }),
  });
  assert.equal(storedZero.suppressedListings.status, "available_with_zero");
  assert.equal(storedZero.mapLeakage.status, "available_with_zero");
  assert.equal(storedZero.mapLeakage.issueCount, 0);
  assert.equal(storedZero.unnestedBundles.status, "available_with_zero");
  assert.equal(storedZero.headline, null);
  assert.equal(storedZero.amazonSpecGaps.status, "available_with_issues");
  assert.equal(storedZero.amazonSpecGaps.issueCount, 1);
});

test("page reads stop at a short page and report a full final page as truncated", async () => {
  const short = await readPages(async (page) => {
    assert.equal(page, 0);
    return { data: [{ asin: "B000000001" }], error: null };
  });
  assert.deepEqual(short, { ok: true, rows: [{ asin: "B000000001" }], truncated: false });

  let calls = 0;
  const full = await readPages(async () => {
    calls += 1;
    return { data: new Array(1000).fill({ asin: "B000000001" }), error: null };
  });
  assert.equal(full.ok, true);
  if (full.ok) assert.equal(full.truncated, true);
  assert.equal(calls, 20);

  const broken = await readPages(async () => ({ data: null, error: { message: "relation is missing" } }));
  assert.deepEqual(broken, { ok: false });
});

test("the Buy Box read keeps seller names and still scores the placeholder partners", async () => {
  const snapshot = await loadPortfolioRetailSnapshot({
    suppressionRows: async () => ({ ok: true, rows: [present()], truncated: false }),
    mapRows: async () => ({ ok: true, rows: [], truncated: false }),
    catalogRows: async () => ({
      ok: true,
      rows: [
        bundle({
          asin: "B000000001",
          is_bundle: false,
          buybox_status: "Amazon 1P",
          buybox_seller_name: null,
        }),
        bundle({
          asin: "B000000002",
          is_bundle: false,
          buybox_status: "3P Confirmed",
          buybox_seller_name: "Austin Bazaar",
        }),
        bundle({
          asin: "B000000003",
          is_bundle: false,
          buybox_status: "3P Confirmed",
          buybox_seller_name: "Amazon.com",
        }),
        bundle({
          asin: "B000000004",
          is_bundle: false,
          buybox_status: "Unknown/Not Harvested",
          buybox_seller_name: null,
        }),
      ],
      truncated: false,
    }),
    catalogBundleCount: async () => null,
    specRows: async () => ({ ok: true, rows: [], truncated: false }),
  });

  assert.deepEqual(snapshot.buyBoxSellers, {
    amazonRetail: 2,
    sellers: [{ name: "Austin Bazaar", listings: 1 }],
    known: 3,
    population: 4,
  });
  assert.deepEqual(snapshot.controlledBuyBox, { controlled: 3, known: 3, population: 4 });
});
