// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/catalog-governance-lead.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  listingMatchesSpecFilters,
  specFieldFindings,
  specFieldLabel,
  specGapFieldsCell,
} from "../lib/fender-canvas/catalog-governance-findings.ts";
import { formatPct, formatRatio } from "../lib/fender-canvas/format.ts";
import {
  catalogBundleLineLabel,
  catalogBundleBuyBoxLabel,
  catalogBundleSellerIdLabel,
  LIVE_OFFER_BUNDLES,
  mapLeakageFinding,
  RETAIL_FINDING_LABELS,
  selectRetailHeadline,
  suppressedListingsFinding,
  unnestedBundleOpportunities,
  unnestedBundlesFinding,
  type AmazonSpecGap,
  type AmazonSpecGapDetail,
  type CatalogBundleRow,
  type MapLeakageRow,
  type PortfolioRetailSnapshot,
  type RetailReading,
  type SuppressionSupportRow,
} from "../lib/fender-canvas/portfolio-retail.ts";
import { catalogHero, specHero } from "../lib/fender-canvas/retail-overview-lead.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const CHECKED_AT = new Date(Date.now() - 60_000).toISOString();

function present(overrides: Partial<SuppressionSupportRow> = {}): SuppressionSupportRow {
  return {
    asin: "B0EQ000000",
    offer_price: 949.99,
    featured_offer_state: "present",
    featured_offer_withheld: false,
    featured_offer_source: "keepa",
    featured_offer_checked_at: CHECKED_AT,
    featured_offer_attempted_at: CHECKED_AT,
    featured_offer_last_error: null,
    competitive_external_price_state: "present",
    competitive_price_threshold_cents: 84999,
    featured_offer_observed_price_cents: 84999,
    featured_offer_observed_shipping_cents: null,
    featured_offer_observed_seller: "ATVPDKIKX0DER",
    ...overrides,
  };
}

function mapRow(overrides: Partial<MapLeakageRow> = {}): MapLeakageRow {
  return {
    map_price: 100,
    offer_price: 100,
    amz_leakage: 0,
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

function amazonSpecs(
  checked: number,
  issueCount: number,
  overrides: Partial<RetailReading<AmazonSpecGapDetail | null>> = {},
): RetailReading<AmazonSpecGapDetail | null> {
  return {
    status: issueCount === 0 ? "available_with_zero" : "available_with_issues",
    issueCount,
    missingMessage: null,
    detail: { gaps: [], checked, unchecked: 0 },
    ...overrides,
  };
}

function snapshot(overrides: Partial<PortfolioRetailSnapshot> = {}): PortfolioRetailSnapshot {
  const findings = {
    suppressedListings: suppressedListingsFinding([present()]),
    mapLeakage: mapLeakageFinding([mapRow()]),
    unnestedBundles: unnestedBundlesFinding([
      bundle({ asin: "B000000001", parent_asin: "B0000000ZZ" }),
    ]),
    amazonSpecGaps: {
      status: "unavailable" as const,
      issueCount: null,
      missingMessage: "Amazon spec-field readings have not been stored.",
      detail: null,
    },
  };
  const merged = { ...findings, ...overrides };
  return { ...merged, headline: selectRetailHeadline(merged) };
}

test("ready Catalog Governance lead strings match catalogHero percent and ratio", () => {
  const reading = unnestedBundlesFinding(
    [
      bundle({ asin: "B0000000A1", parent_asin: null }),
      bundle({ asin: "B0000000A2", parent_asin: "B0000000ZZ" }),
      bundle({ asin: "B0000000A3", parent_asin: "B0000000YY" }),
    ],
    { catalogBundleCount: 20 },
  );
  const snap = snapshot({ unnestedBundles: reading });
  const hero = catalogHero(snap);

  assert.equal(hero.numerator, 1);
  assert.equal(hero.denominator, 3);
  assert.equal(hero.percent, formatPct(100 / 3));
  assert.equal(hero.ratio, `${formatRatio(1, 3)} ${LIVE_OFFER_BUNDLES}`);
  assert.equal(hero.percent, catalogHero(snap).percent);
  assert.equal(hero.ratio, catalogHero(snap).ratio);
  assert.ok(hero.pie);
  assert.equal(hero.pie.total, 3);
  assert.doesNotMatch(hero.percent, /^0/);
  assert.doesNotMatch(hero.explainer, /448 of 946|this read includes/i);
});

test("missing Catalog Governance reading shows Not available* with no zero share", () => {
  const hero = catalogHero(snapshot({ unnestedBundles: unnestedBundlesFinding(null) }));
  assert.equal(hero.percent, "Not available*");
  assert.equal(hero.ratio, null);
  assert.equal(hero.pie, null);
  assert.equal(hero.numerator, null);
  assert.doesNotMatch(hero.percent, /^0%?$/);
});

test("spec hero 100 complete of 100 is 100.0% green success", () => {
  const hero = specHero(snapshot({ amazonSpecGaps: amazonSpecs(100, 0) }));
  assert.equal(hero.numerator, 100);
  assert.equal(hero.denominator, 100);
  assert.equal(hero.percent, "100.0%");
  assert.equal(hero.color, "var(--success-green)");
  assert.equal(hero.tone, "success");
  assert.equal(hero.label, "Specs complete");
  assert.match(hero.explainer, /Every Amazon spec field is filled/);
  assert.ok(hero.explainer.length < 48);
});

test("spec hero 98 complete of 100 is green", () => {
  const hero = specHero(snapshot({ amazonSpecGaps: amazonSpecs(100, 2) }));
  assert.equal(hero.numerator, 98);
  assert.equal(hero.percent, formatPct(9800 / 100));
  assert.equal(hero.color, "var(--success-green)");
  assert.equal(hero.tone, "success");
});

test("spec hero 97 complete of 100 is yellow warning", () => {
  const hero = specHero(snapshot({ amazonSpecGaps: amazonSpecs(100, 3) }));
  assert.equal(hero.numerator, 97);
  assert.equal(hero.color, "var(--warning-amber)");
  assert.equal(hero.tone, "warning");
});

test("spec hero 95 complete of 100 is yellow", () => {
  const hero = specHero(snapshot({ amazonSpecGaps: amazonSpecs(100, 5) }));
  assert.equal(hero.numerator, 95);
  assert.equal(hero.color, "var(--warning-amber)");
  assert.equal(hero.tone, "warning");
});

test("spec hero 94 complete of 100 is red danger", () => {
  const hero = specHero(snapshot({ amazonSpecGaps: amazonSpecs(100, 6) }));
  assert.equal(hero.numerator, 94);
  assert.equal(hero.color, "var(--danger-red)");
  assert.equal(hero.tone, "danger");
});

test("spec hero 541 complete of 1052 matches live reading shape", () => {
  const hero = specHero(snapshot({ amazonSpecGaps: amazonSpecs(1052, 511) }));
  assert.equal(hero.numerator, 541);
  assert.equal(hero.denominator, 1052);
  assert.equal(hero.percent, formatPct(54100 / 1052));
  assert.equal(hero.ratio, formatRatio(541, 1052));
  assert.equal(hero.color, "var(--danger-red)");
  assert.equal(hero.tone, "danger");
  assert.ok(hero.pie);
  assert.equal(hero.pie.total, 1052);
  assert.equal(hero.pie.totalLabel, "checked listings");
  const missing = hero.pie.slices.find((slice) => slice.key === "contradicted");
  const filled = hero.pie.slices.find((slice) => slice.key === "matched");
  assert.ok(missing);
  assert.equal(missing.count, 511);
  assert.equal(missing.label, "Missing a field");
  assert.ok(filled);
  assert.equal(filled.count, 541);
  assert.equal(filled.label, "Specs filled");
  assert.match(hero.tip ?? "", /511 of 1,052 checked listings are missing an Amazon spec field/);
});

test("unavailable spec reading shows Not available* with no pie and no 0%", () => {
  const hero = specHero(snapshot());
  assert.equal(hero.percent, "Not available*");
  assert.equal(hero.ratio, null);
  assert.equal(hero.pie, null);
  assert.equal(hero.numerator, null);
  assert.doesNotMatch(hero.percent, /^0/);
  assert.doesNotMatch(hero.percent, /0%/);
});

test("specFieldFindings ranks Fill first and How close from gap listings", () => {
  // Count-1 companions sort after "Weight" so Fill first stays Scale / Handedness / Weight.
  const eleven = [
    "scale_length",
    "wiring_type",
    "wood_species",
    "wrap_tailpiece",
    "yoke_width",
    "zinc_finish",
    "zebra_wood",
    "zz_bridge_gap",
    "zz_field_a",
    "zz_field_b",
    "zz_field_c",
  ];
  const gaps: AmazonSpecGap[] = [
    { asin: "B0000000A1", modelOrTitle: "One", missingFields: ["scale_length"] },
    { asin: "B0000000A2", modelOrTitle: "Two", missingFields: ["hand_orientation", "item_weight"] },
    { asin: "B0000000A3", modelOrTitle: "Eleven", missingFields: eleven },
    {
      asin: "B0000000A4",
      modelOrTitle: "Three a",
      missingFields: ["scale_length", "zz_extra_a", "zz_extra_b"],
    },
    {
      asin: "B0000000A5",
      modelOrTitle: "Three b",
      missingFields: ["scale_length", "hand_orientation", "zz_extra_c"],
    },
  ];
  const findings = specFieldFindings(gaps);
  assert.deepEqual(
    findings.fillFirst.map((line) => [line.label, line.count]),
    [
      ["Scale length", 4],
      ["Handedness", 2],
      ["Weight", 1],
    ],
  );
  assert.deepEqual(findings.howClose, { oneField: 1, twoFields: 1, mostOfTheSpec: 1 });
  assert.equal(specFieldLabel("scale_length"), "Scale length");
  assert.equal(specFieldLabel("hand_orientation"), "Handedness");
  assert.equal(specFieldLabel("item_weight"), "Weight");
  assert.equal(specFieldLabel("unusual_custom_field_name_here"), "Unusual Custom Field...");
  assert.ok(specFieldLabel("unusual_custom_field_name_here").length <= 24);

  // Repeated field names on one listing count once for how-close.
  const dup = specFieldFindings([
    { asin: "B0000000D1", modelOrTitle: "Dup", missingFields: ["scale_length", "scale_length"] },
  ]);
  assert.deepEqual(dup.howClose, { oneField: 1, twoFields: 0, mostOfTheSpec: 0 });
});

test("listingMatchesSpecFilters ANDs field buttons with how-close", () => {
  const onlyScale: AmazonSpecGap = {
    asin: "B0000000S1",
    modelOrTitle: "Only scale",
    missingFields: ["scale_length"],
  };
  const scaleAndHand: AmazonSpecGap = {
    asin: "B0000000S2",
    modelOrTitle: "Scale and hand",
    missingFields: ["scale_length", "hand_orientation"],
  };
  const eleven: AmazonSpecGap = {
    asin: "B0000000S3",
    modelOrTitle: "Most",
    missingFields: [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
    ],
  };

  assert.equal(listingMatchesSpecFilters(onlyScale, ["scale_length"], "one"), true);
  assert.equal(listingMatchesSpecFilters(scaleAndHand, ["scale_length"], "two"), true);
  assert.equal(listingMatchesSpecFilters(scaleAndHand, ["scale_length"], "one"), false);
  assert.equal(listingMatchesSpecFilters(eleven, [], "most"), true);
  assert.equal(listingMatchesSpecFilters(eleven, [], "one"), false);
  assert.equal(listingMatchesSpecFilters(eleven, [], "two"), false);
  // Two field buttons plus One field: nothing is missing only those two.
  assert.equal(
    listingMatchesSpecFilters(scaleAndHand, ["scale_length", "hand_orientation"], "one"),
    false,
  );
  assert.equal(
    listingMatchesSpecFilters(onlyScale, ["scale_length", "hand_orientation"], "one"),
    false,
  );

  assert.equal(specGapFieldsCell(["scale_length"]), "Scale length");
  assert.equal(specGapFieldsCell(["scale_length", "hand_orientation"]), "Scale length, Handedness");
  assert.equal(specGapFieldsCell(["scale_length", "hand_orientation", "item_weight"]), "3 fields");
  assert.equal(
    specGapFieldsCell([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
    ]),
    "Most of the spec",
  );
});

test("Catalog Governance places notes beside the share and the table under that row", () => {
  const panel = read("components/v3/live/CatalogGovernancePanel.tsx");

  assert.match(panel, /catalogHero/);
  assert.match(panel, /specHero/);
  assert.match(panel, /from "@\/lib\/fender-canvas\/retail-overview-lead"/);
  assert.match(panel, /data-catalog-governance-lead/);
  assert.match(panel, /data-catalog-governance-lead-row/);
  assert.match(panel, /data-catalog-governance-notes/);
  assert.match(panel, /data-catalog-governance-table/);
  assert.match(panel, /data-catalog-spec-hero/);
  assert.match(panel, /RetailShareDisc/);
  assert.match(read("components/v3/live/RetailOverviewFigure.tsx"), /citation-pie-disc citation-pie-disc-retail/);
  assert.match(panel, /hero\.label/);
  assert.match(panel, /hero\.percent/);
  assert.match(panel, /hero\.ratio/);
  assert.match(panel, /hero\.explainer/);
  assert.match(panel, /hero\.tip/);
  assert.match(panel, /width:\s*["']fit-content["']/);
  assert.match(panel, /alignItems:\s*["']flex-start["']/);
  assert.match(panel, /alignItems:\s*["']stretch["']/);
  assert.match(panel, /What is catalog governance\?/);
  assert.match(panel, /CATALOG_GOVERNANCE_EXPLAINER/);
  assert.doesNotMatch(panel, /data-amazon-spec-gap-count/);
  assert.doesNotMatch(panel, /AmazonSpecGapCount/);

  assert.doesNotMatch(panel, /Unnested bundles/);
  assert.doesNotMatch(panel, /Bundles in this retail read with no usable parent ASIN/);
  assert.doesNotMatch(
    panel,
    /This group lists the bundles this retail read can show\. It is not the full catalog\./,
  );
  assert.doesNotMatch(panel, /function CountLine/);

  const renderStart = panel.indexOf("export function CatalogGovernancePanel");
  const render = panel.slice(renderStart);
  const rowAt = render.indexOf("data-catalog-governance-lead-row");
  const leadAt = render.indexOf("<CatalogGovernanceLead");
  const specAt = render.indexOf("<CatalogSpecHero");
  const notesAt = render.indexOf("<CatalogGovernanceNotes");
  const tableAt = render.indexOf("data-catalog-governance-table");
  const specsTableAt = render.indexOf("<CatalogGovernanceSpecTable");
  assert.ok(rowAt >= 0 && leadAt > rowAt, "lead sits in the lead row");
  assert.ok(specAt > rowAt && specAt < notesAt, "spec hero sits in the lead row before notes");
  assert.ok(notesAt > leadAt, "notes sit beside the lead in the same row");
  assert.ok(tableAt > notesAt, "bundle table sits under the lead row");
  assert.ok(specsTableAt > notesAt, "specs table sits under the lead row");
  assert.ok(panel.indexOf("data-catalog-spec-hero") < panel.indexOf("data-catalog-governance-notes"));

  const leadBlock = panel.slice(
    panel.indexOf("function CatalogGovernanceLead"),
    panel.indexOf("function CatalogGovernanceNotes"),
  );
  assert.doesNotMatch(leadBlock, /data-ifai-open/);
  assert.doesNotMatch(leadBlock, /data-ifai-tab/);
  assert.match(leadBlock, /SPLINTERED_LISTINGS_LABEL/);
  assert.match(leadBlock, /retail-explore/);
  assert.match(leadBlock, /aria-expanded=\{open\}/);

  const notesBlock = panel.slice(
    panel.indexOf("function CatalogGovernanceNotes"),
    panel.indexOf("export function CatalogGovernancePanel"),
  );
  assert.doesNotMatch(notesBlock, /AmazonSpecGapCount/);
  assert.match(notesBlock, /What is catalog governance\?/);
  assert.match(notesBlock, /missingMessage/);

  assert.doesNotMatch(panel, /\u2014/);
  assert.doesNotMatch(panel, /retainer|service-fee/i);

  const lines = panel.split("\n").length;
  assert.ok(lines <= 400, `CatalogGovernancePanel.tsx is ${lines} lines`);
});

test("Catalog Governance panel source shows Splintered Listings chevrons and specs table", () => {
  const panel = read("components/v3/live/CatalogGovernancePanel.tsx");
  const specs = read("components/v3/live/CatalogGovernanceSpecTable.tsx");
  assert.match(panel, /Splintered Listings/);
  assert.match(panel, /Specs complete/);
  assert.match(panel, /retail-explore-chevron/);
  assert.match(panel, /aria-expanded=\{open\}/);
  assert.match(panel, /useState<OpenTable>\("splintered"\)/);
  assert.match(panel, /<CatalogGovernanceSpecTable/);
  assert.match(panel, /aria-controls=\{SPLINTERED_TABLE_ID\}/);
  assert.match(panel, /aria-controls=\{SPECS_TABLE_ID\}/);
  assert.doesNotMatch(panel, /data-catalog-governance-findings/);
  assert.doesNotMatch(panel, /CatalogSpecFindings/);
  assert.doesNotMatch(panel, /Fill first/);
  assert.doesNotMatch(specs, /data-catalog-governance-findings/);
  assert.match(specs, /segmented-btn/);
  assert.match(specs, /data-catalog-governance-specs-table/);
  assert.match(specs, /specFieldFindings/);
  assert.match(specs, /listingMatchesSpecFilters/);
  assert.match(specs, /Most of the spec/);
  assert.match(specs, /data-ifai-tooltip-title="Most of the spec"/);
  assert.match(specs, /data-ifai-tooltip-desc=\{MOST_OF_THE_SPEC_DESC\}/);
  assert.match(specs, /className="ifai-term"/);
  assert.match(specs, /Not available\*/);
  assert.match(specs, /No listing matches these filters\./);
  assert.doesNotMatch(panel, /(?<![\w-])title=\{|(?<![\w-])title="/);
  assert.doesNotMatch(specs, /(?<![\w-])title=\{|(?<![\w-])title="/);
  assert.equal(RETAIL_FINDING_LABELS.unnested_bundles, "Catalog Governance");

  const render = panel.slice(panel.indexOf("export function CatalogGovernancePanel"));
  const leadRowAt = render.indexOf("data-catalog-governance-lead-row");
  const tableAt = render.indexOf("data-catalog-governance-table");
  const specsAt = render.indexOf("<CatalogGovernanceSpecTable");
  assert.ok(leadRowAt >= 0 && tableAt > leadRowAt, "bundle table sits after the lead row");
  assert.ok(specsAt > leadRowAt, "specs table sits after the lead row");
});

test("bundle Buy Box and Line cells use short brand-facing labels", () => {
  const [row] = unnestedBundleOpportunities([
    bundle({
      asin: "B0000000K1",
      parent_asin: null,
      buybox_seller_name: "Liberty Music Inc",
      buybox_seller_id: "A1B2C3D4E5F6G",
      buybox_status: "3P Confirmed",
      category: "Electric Guitar Kits",
    }),
  ]);
  assert.ok(row);
  assert.equal(catalogBundleBuyBoxLabel(row.buyboxStatus, row.buyboxSellerName), "Liberty Music Inc");
  assert.equal(catalogBundleSellerIdLabel(row.buyboxStatus, row.buyboxSellerId), "A1B2C3D4E5F6G");
  assert.equal(catalogBundleLineLabel(row.category), "Kits");

  assert.equal(catalogBundleBuyBoxLabel("3P Confirmed", "  "), "Unknown");
  assert.equal(catalogBundleBuyBoxLabel("3P Confirmed", null), "Unknown");
  assert.equal(catalogBundleBuyBoxLabel("Amazon 1P", "Amazon.com"), "Amazon");
  assert.equal(catalogBundleBuyBoxLabel("No Active Offer", null), "No active offer");
  assert.equal(catalogBundleBuyBoxLabel(null, null), "Unknown");
  assert.equal(catalogBundleSellerIdLabel("3P Confirmed", "  "), null);
  assert.equal(catalogBundleSellerIdLabel("3P Confirmed", null), null);
  assert.equal(catalogBundleSellerIdLabel("Amazon 1P", "ATVPDKIKX0DER"), null);

  assert.equal(catalogBundleLineLabel("Hollow & Semi-Hollow Body"), "Hollow");
  assert.equal(catalogBundleLineLabel("Solid Body"), "Solid Body");

  for (const label of [
    catalogBundleBuyBoxLabel("3P Confirmed", "Liberty Music Inc"),
    catalogBundleBuyBoxLabel("3P Confirmed", "A seller name that is far too long for the cell"),
    catalogBundleSellerIdLabel("3P Confirmed", "ATVPDKIKX0DERTOOLONGTOFITCELL") ?? "",
    catalogBundleBuyBoxLabel("Amazon 1P", null),
    catalogBundleBuyBoxLabel("No Active Offer", null),
    catalogBundleLineLabel("Electric Guitar Kits"),
    catalogBundleLineLabel("Hollow & Semi-Hollow Body"),
    catalogBundleLineLabel("A very long category name that exceeds"),
  ]) {
    assert.ok(label.length <= 24, `"${label}" exceeds 24 characters`);
  }
});

test("Catalog Governance table drops Parent ASIN and Why it is here", () => {
  // The bundle table lives beside the panel so both files stay under 400 lines.
  const panel = read("components/v3/live/CatalogGovernanceBundleTable.tsx");
  assert.doesNotMatch(panel, /Parent ASIN/);
  assert.doesNotMatch(panel, /Why it is here/);
  assert.doesNotMatch(panel, /Partner/);
  assert.match(panel, /label:\s*"Buy Box"/);
  assert.doesNotMatch(panel, /label:\s*"Seller"/);
  assert.doesNotMatch(panel, /label:\s*"Offer"/);
  assert.match(panel, /label:\s*"Line"/);
});
