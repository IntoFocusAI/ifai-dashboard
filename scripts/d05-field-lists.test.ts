// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/d05-field-lists.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  AMAZON_FIELD_LISTS,
  AMAZON_NO_LIST_PRODUCT_TYPES,
  amazonFieldList,
  competitorFillPct,
} from "../lib/findability/amazon-field-lists.ts";
import { loadAmazonProductTypes, productTypeMap } from "../lib/findability/amazon-product-types.ts";
import {
  noListTooltip,
  productTypeCoverageLabel,
  productTypeCoveragePartial,
  productTypeListingLabel,
  productTypeRequiredTooltip,
  requiredFieldsByProductType,
} from "../lib/findability/product-type-required-fields.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

const IDENTIFIERS = [
  "upc",
  "ean",
  "manufacturer_part_number",
  "model_number",
  "asin",
  "brand_name",
  "manufacturer",
  "item_dimensions",
  "item_weight",
  "number_of_items",
  "customer_reviews",
  "warranty_description",
];

test("each approved list keeps fields at least 30% of competitors fill, with no identifiers (D-05, decision 100)", () => {
  const source = read("lib/findability/amazon-field-lists.ts");
  assert.match(source, /Approved 16 Nov 2026 by Brian Magazu \(decision 100\)/);
  assert.doesNotMatch(source, /draft|placeholder|awaiting/i);
  assert.deepEqual(Object.keys(AMAZON_FIELD_LISTS).sort(), ["FLASHLIGHT", "GUITARS"]);
  for (const list of Object.values(AMAZON_FIELD_LISTS)) {
    assert.ok(!("status" in list));
    assert.ok(list.sampled >= 10, list.productType);
    assert.equal(list.sourceDate, "2026-11-11");
    for (const field of list.fields) {
      assert.ok(!IDENTIFIERS.includes(field.field), `${list.productType} ${field.field}`);
      assert.ok(competitorFillPct(list, field) >= 30, `${list.productType} ${field.field}`);
      assert.ok(field.filled <= list.sampled);
      assert.ok(field.label.length > 0);
    }
  }
  assert.equal(amazonFieldList("guitars")?.fields.length, 17);
  assert.equal(amazonFieldList(" FLASHLIGHT ")?.productType, "FLASHLIGHT");
  assert.equal(amazonFieldList("SHIRT"), null);
  // Decision 100: no list for these two types, and no fallback to the flashlight list.
  assert.equal(amazonFieldList("ELECTRIC_LIGHT"), null);
  assert.equal(amazonFieldList("ELECTRIC_LANTERN"), null);
  assert.deepEqual(Object.keys(AMAZON_NO_LIST_PRODUCT_TYPES), ["ELECTRIC_LIGHT", "ELECTRIC_LANTERN"]);
  // Brightness and max lumens are one entry; beam distance and variation fields stay off.
  const flashlight = amazonFieldList("FLASHLIGHT");
  assert.equal(flashlight?.fields.length, 22);
  const ids = flashlight?.fields.map((field) => field.field) ?? [];
  assert.ok(!ids.includes("light_output_maximum"));
  assert.ok(!ids.some((id) => ["beam_distance", "light_path_distance", "style_name", "size"].includes(id)));
  assert.deepEqual(flashlight?.fields.find((field) => field.field === "white_brightness")?.alsoCounts, [
    "light_output_maximum",
  ]);
  assert.equal(amazonFieldList(null), null);
});

const row = (asin: string, values: string[], missing: string[], checked: boolean | null = true) => ({
  asin,
  category: "Solid Body",
  amazon_checked: checked,
  amazon_spec_values: Object.fromEntries(values.map((field) => [field, "x"])),
  amazon_missing_fields: missing.join(";"),
});

test("a required field the check does not record is named unchecked, never missing", () => {
  const rows = [
    row("A1", ["color", "body_material_type", "upc"], ["scale_length"]),
    row("A2", ["color", "scale_length"], ["body_material_type", "upc"]),
    row("A3", ["color"], []),
    row("A4", ["color"], ["scale_length"], false),
    row("B1", ["color"], ["scale_length"]),
  ];
  const types = productTypeMap([
    { asin: "A1", product_type: "GUITARS" },
    { asin: "A2", product_type: "GUITARS" },
    { asin: "A3", product_type: "GUITARS" },
    { asin: "A4", product_type: "GUITARS" },
    { asin: "B1", product_type: "SHIRT" },
    { asin: "C1", product_type: null },
  ]);
  const split = requiredFieldsByProductType(rows, types);
  assert.deepEqual(split.unlisted.map((r) => r.asin), ["B1"]);
  assert.equal(split.coverage.length, 1);
  const guitars = split.coverage[0];
  assert.equal(guitars.listings, 3);
  assert.deepEqual(guitars.checked.map((field) => [field.field, field.missing]), [
    ["body_material_type", 1],
    ["color", 0],
    ["scale_length", 1],
  ]);
  assert.equal(guitars.unchecked.length, 14);
  assert.equal(guitars.listingsMissing, 2);
  assert.equal(productTypeListingLabel(guitars), "guitars (3 listings)");
  assert.equal(productTypeCoverageLabel(guitars), "checks 3 of 17 required fields");
  const tip = productTypeRequiredTooltip(guitars);
  assert.match(tip, /^2 of 3 checked guitars listings miss at least one checked required field\./);
  assert.match(tip, /Body missing on 1 of 3 \(competitors 100\.0%\)/);
  assert.match(tip, /at least 30% of 15 best-selling guitars listings from other brands on Amazon, read Nov 11, 2026\./);
  assert.doesNotMatch(tip, /UPC/);
  const partial = productTypeCoveragePartial(guitars);
  assert.ok(partial);
  assert.equal(partial.reason, "coverage");
  assert.equal(partial.coverage, "3 of 17 required fields");
  assert.match(partial.missing, /does not record 14 of the 17 required fields for guitars, so they are not judged: Back material \(competitors 100\.0%\)/);
});

test("brightness and max lumens count as one field, filled when either is", () => {
  const types = productTypeMap([
    { asin: "F1", product_type: "FLASHLIGHT" },
    { asin: "F2", product_type: "FLASHLIGHT" },
    { asin: "F3", product_type: "FLASHLIGHT" },
    { asin: "F4", product_type: "FLASHLIGHT" },
  ]);
  const rows = [
    row("F1", ["color", "light_output_maximum"], []),
    row("F2", ["color"], ["light_output_maximum"]),
    row("F3", ["color", "light_output_maximum"], []),
    // Both ids recorded: brightness filled, max lumens missing, so the one field is filled.
    row("F4", ["color", "white_brightness"], ["light_output_maximum"]),
  ];
  const flashlights = requiredFieldsByProductType(rows, types).coverage[0];
  const lumens = flashlights.checked.filter((field) => ["white_brightness", "light_output_maximum"].includes(field.field));
  assert.deepEqual(lumens.map((field) => [field.field, field.missing]), [["white_brightness", 1]]);
  // color and the one lumens entry: 2 checked of 22 required.
  assert.equal(flashlights.checked.length, 2);
  assert.equal(flashlights.listingsMissing, 1);
  assert.equal(productTypeCoverageLabel(flashlights), "checks 2 of 22 required fields");
  assert.doesNotMatch(productTypeRequiredTooltip(flashlights), /Max lumens/);
  assert.doesNotMatch(productTypeCoveragePartial(flashlights)?.missing ?? "", /Max lumens/);
});

test("ELECTRIC_LIGHT and ELECTRIC_LANTERN listings read Not available*, with no fallback and no complete count", () => {
  const rows = [
    row("L1", ["color", "light_output_maximum"], []),
    row("L2", ["color"], []),
    row("N1", ["color"], []),
    row("L3", ["color"], [], false),
    row("F1", ["color"], []),
  ];
  const types = productTypeMap([
    { asin: "L1", product_type: "ELECTRIC_LIGHT" },
    { asin: "L2", product_type: "ELECTRIC_LIGHT" },
    { asin: "L3", product_type: "ELECTRIC_LIGHT" },
    { asin: "N1", product_type: "ELECTRIC_LANTERN" },
    { asin: "F1", product_type: "FLASHLIGHT" },
  ]);
  const split = requiredFieldsByProductType(rows, types);
  assert.deepEqual(split.noList, [
    { productType: "ELECTRIC_LIGHT", label: "work and utility lights", listings: 2 },
    { productType: "ELECTRIC_LANTERN", label: "lanterns", listings: 1 },
  ]);
  assert.deepEqual(split.coverage.map((entry) => entry.list.productType), ["FLASHLIGHT"]);
  assert.equal(split.coverage[0].listings, 1);
  assert.deepEqual(split.unlisted, []);
  assert.match(noListTooltip(split.noList), /no approved required field list for work and utility lights and lanterns yet/);
});

test("the product type read falls back to unavailable when the view is missing", async () => {
  const client = (error: { message: string } | null, data: unknown[]) => ({
    from: () => ({
      select: () => ({
        order: () => ({ range: async () => ({ data, count: data.length, error }) }),
      }),
    }),
  });
  assert.deepEqual(await loadAmazonProductTypes(client({ message: "relation does not exist" }, [])), {
    phase: "unavailable",
  });
  const ready = await loadAmazonProductTypes(client(null, [{ asin: "A1", product_type: "GUITARS" }]));
  assert.equal(ready.phase, "ready");
  assert.equal(ready.phase === "ready" ? ready.types.get("A1") : null, "GUITARS");
});

test("Amazon Specs names the product type list, shows Not available* for types without one, and keeps no placeholder wording", () => {
  const line = read("components/v3/live/AmazonSpecsRequiredFields.tsx");
  assert.match(line, /Required fields by Amazon product type: /);
  assert.match(line, /PartialFigureMark/);
  assert.match(line, /READ_NOT_AVAILABLE/);
  assert.doesNotMatch(line, /placeholder/i);
  // SC-01 stays on the fields the spec check stores.
  assert.doesNotMatch(read("lib/fender-canvas/ai-readiness-lead.ts"), /amazon-field-lists|product-type-required/);
});
