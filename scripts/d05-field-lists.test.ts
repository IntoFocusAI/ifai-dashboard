// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/d05-field-lists.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { AMAZON_FIELD_LISTS, amazonFieldList, competitorFillPct } from "../lib/findability/amazon-field-lists.ts";
import { loadAmazonProductTypes, productTypeMap } from "../lib/findability/amazon-product-types.ts";
import {
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

test("each draft list keeps fields at least 30% of competitors fill, with no identifiers (D-05)", () => {
  assert.match(read("lib/findability/amazon-field-lists.ts"), /Draft, awaiting IntoFocus staff approval/);
  for (const list of Object.values(AMAZON_FIELD_LISTS)) {
    assert.equal(list.status, "draft");
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

test("Amazon Specs names the product type list and keeps no placeholder wording", () => {
  const line = read("components/v3/live/AmazonSpecsRequiredFields.tsx");
  assert.match(line, /Required fields by Amazon product type: /);
  assert.match(line, /PartialFigureMark/);
  assert.doesNotMatch(line, /placeholder/i);
  // SC-01 stays on the fields the spec check stores.
  assert.doesNotMatch(read("lib/fender-canvas/ai-readiness-lead.ts"), /amazon-field-lists|product-type-required/);
});
