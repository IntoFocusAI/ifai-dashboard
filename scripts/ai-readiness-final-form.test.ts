// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/ai-readiness-final-form.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { shareFigureTone } from "../lib/fender-canvas/ai-readiness-lead.ts";
import {
  contentSharePartial,
  contentStateLabel,
  listingContentHeroes,
  summarizeListingContent,
  type ListingContentRow,
} from "../lib/fender-canvas/listing-content.ts";
import { specPagesStale, type SpecPageSummary } from "../lib/fender-canvas/machine-readability.ts";
import { amazonFieldLabel } from "../lib/fender-canvas/spec-missing-fields.ts";
import { WEEKLY_CHECK_DAYS, weeklyCheckStale } from "../lib/findability/last-checked.ts";
import { findabilityExportColumns } from "../lib/findability/findability-export.ts";
import { outcomeShareTone } from "../lib/findability/lead.ts";
import {
  categoryListingLabel,
  categoryRequiredTooltip,
  requiredSpecListsByCategory,
} from "../lib/findability/required-spec-fields.ts";
import { emptyOutcomeCounts } from "../lib/findability/outcomes.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");
const DAY = 86_400_000;
const NOW = Date.parse("2026-11-10T20:00:00Z");

const CHECK = { check: "official-page check", source: "canvas_spec_findability", figure: "outcome shares" };

test("a weekly check is stale past 14 days and names the source, last check, and effect", () => {
  assert.equal(WEEKLY_CHECK_DAYS, 7);
  assert.equal(weeklyCheckStale(new Date(NOW - 13 * DAY).toISOString(), CHECK, NOW), null);
  assert.equal(weeklyCheckStale(null, CHECK, NOW), null);
  const stale = weeklyCheckStale("2026-10-12T20:27:46Z", CHECK, NOW);
  assert.ok(stale);
  assert.equal(stale.reason, "stale");
  assert.equal(stale.source, "canvas_spec_findability");
  assert.equal(stale.lastCheck, "2026-10-12T20:27:46Z");
  assert.equal(stale.missing, "The official-page check has not run in 14 days");
});

function content(asin: string, aplus: string, source: string | null, checkedAt = "2026-11-10T12:00:00Z"): ListingContentRow {
  return {
    asin,
    title: asin,
    bullet_count: 5,
    image_count: 7,
    aplus_state: aplus,
    aplus_module_count: null,
    video_state: aplus,
    video_count: null,
    checked_at: checkedAt,
    content_checked_at: checkedAt,
    aplus_source: source,
    video_source: source,
  };
}

test("A+ unchecked listings show as Unchecked, never as a fail (R-03)", () => {
  assert.equal(contentStateLabel("present"), "Present");
  assert.equal(contentStateLabel("absent"), "None");
  assert.equal(contentStateLabel("none_reported"), "Unchecked");
  assert.equal(contentStateLabel("not_collected"), "Unchecked");
  assert.equal(contentStateLabel(null), "Unchecked");

  const summary = summarizeListingContent([
    content("L1", "present", "live_page"),
    content("L2", "absent", "live_page"),
    content("L3", "absent", "live_page"),
    content("K1", "none_reported", "keepa"),
  ]);
  const [bullets, aplus] = listingContentHeroes(summary);
  assert.equal(aplus.ratio, "1 of 3");
  assert.equal(aplus.explainer, "1 of 4 live listings unchecked.");
  assert.equal(bullets.partial ?? null, null);
  assert.equal(aplus.partial?.reason, "coverage");
  assert.equal(aplus.partial?.missing, "1 of 4 live Amazon listings have no A+ check on the listing page yet");
});

test("content shares carry the asterisk when a listing's own check is past twice its weekly schedule (X-25)", () => {
  const summary = summarizeListingContent([
    content("L1", "present", "live_page", "2026-10-20T00:00:00Z"),
    content("L2", "present", "live_page", "2026-11-09T00:00:00Z"),
  ]);
  const partial = contentSharePartial(summary, "aplus", NOW);
  assert.equal(partial?.reason, "coverage");
  assert.equal(partial?.missing, "1 of 2 listings has no Amazon listing check in 14 days");
  assert.equal(contentSharePartial(summary, "aplus", Date.parse("2026-10-25T00:00:00Z")), null);
});

test("no A+ dollar figure and no on-screen sales qualifier on the A+ Matrix (D-06, decision 45)", () => {
  const panel = read("components/v3/live/AplusMatrixPanel.tsx");
  assert.doesNotMatch(panel, /not estimated|\$|analyst estimate/);
});

test("brand-site page figures count each page against its own latest read (X-25)", () => {
  const summary: SpecPageSummary = {
    pages: [
      {
        url: "https://www.brand.example/products/a",
        model: "A",
        asins: ["B000000001"],
        missingFields: ["additionalProperty"],
        hasSpecBlock: false,
        basicsPresent: 7,
        missingBasics: [],
        checkedAt: "2026-10-01T00:00:00Z",
      },
    ],
    withSpecBlock: 0,
    withAllBasics: 1,
    listings: 1,
  };
  assert.equal(specPagesStale(summary, NOW)?.missing, "1 of 1 page has no fender.com product check in 14 days");
  assert.equal(specPagesStale(summary, Date.parse("2026-10-05T00:00:00Z")), null);
  assert.equal(specPagesStale(null, NOW), null);
});

test("Amazon Specs required fields are each category's top 10 by fill rate, with no hand-kept list (D-05)", () => {
  const fields = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
  const row = (category: string | null, filled: string[], checked: boolean | null = true) => ({
    category,
    amazon_checked: checked,
    amazon_spec_values: Object.fromEntries(filled.map((field) => [field, "x"])),
    amazon_missing_fields: fields.filter((field) => !filled.includes(field)).join(";"),
  });
  const rows = [
    row("Headlamps", ["l", "k", "a"]),
    row("Headlamps", ["l", "b"]),
    row("Headlamps", ["l", "k"]),
    row("Lanterns", ["a"]),
    row("Headlamps", fields, false),
    row(null, ["c"]),
  ];
  const lists = requiredSpecListsByCategory(rows);
  assert.deepEqual(lists.map((list) => [list.category, list.listings]), [
    ["Headlamps", 3],
    ["Lanterns", 1],
    ["No category recorded", 1],
  ]);
  const headlamps = lists[0];
  // Only fields the category fills: l, k, a, b.
  assert.equal(headlamps.fields.length, 4);
  assert.deepEqual(headlamps.fields.slice(0, 4).map((fill) => [fill.field, fill.filled]), [
    ["l", 3],
    ["k", 2],
    ["a", 1],
    ["b", 1],
  ]);
  // A blank value is not a filled field; the unchecked row is not a listing.
  assert.equal(requiredSpecListsByCategory([{ category: "X", amazon_spec_values: { a: " " } }])[0].fields.length, 0);
  const many = requiredSpecListsByCategory([row("Big", fields)]);
  assert.equal(many[0].fields.length, 10);
  assert.equal(categoryListingLabel(headlamps), "Headlamps (3 listings)");
  assert.equal(categoryListingLabel(lists[1]), "Lanterns (1 listing)");
  assert.match(categoryRequiredTooltip(headlamps), /^The 4 spec fields filled most often across the 3 checked Headlamps listings/);
  assert.match(categoryRequiredTooltip(headlamps), /L 100\.0% \(3 of 3\)/);
  assert.equal(amazonFieldLabel("scale_length"), "Scale length");
  assert.equal(amazonFieldLabel("light_output_maximum"), "Max lumens");
  const line = read("components/v3/live/AmazonSpecsRequiredFields.tsx");
  assert.match(line, /by fill rate in/);
  assert.doesNotMatch(line + read("components/v3/live/AiReadinessLead.tsx"), /placeholder/i);
});

test("only the graded exact-page share carries a status; a figure without a population has none", () => {
  const counts = { ...emptyOutcomeCounts(), exact_official_product: 8, official_family_page: 92, total: 100 };
  assert.equal(outcomeShareTone(counts, "exact_official_product"), "danger");
  assert.equal(outcomeShareTone(counts, "official_family_page"), null);
  assert.equal(outcomeShareTone({ ...counts, exact_official_product: 70, official_family_page: 30 }, "exact_official_product"), "success");

  assert.equal(shareFigureTone("var(--danger-red)", 1, 10), "danger");
  assert.equal(shareFigureTone("var(--success-green)", 9, 10), "success");
  assert.equal(shareFigureTone("var(--warning-amber)", null, null), null);
  assert.equal(shareFigureTone("var(--text-main)", 1, 10), null);
});

test("the Dealer bundle caveat lives in the header tooltip, not on screen", () => {
  const panel = read("components/v3/live/findability/FindabilityPanel.tsx");
  assert.doesNotMatch(panel, /DEALER_BUNDLE_NOTE|correlation/);
  const table = read("components/v3/live/findability/FindabilityTable.tsx");
  assert.match(table, /headerTooltip: \{\s*title: "Dealer bundle",\s*description: bundleLoaded \? DEALER_BUNDLE_NOTE : DEALER_BUNDLE_NOT_LOADED/);
});

test("the three AI Readiness tables with their own sort handler pass the toolbar controls (X-33)", () => {
  for (const path of [
    "components/v3/live/ListingContentTable.tsx",
    "components/v3/live/MachineReadabilityPageTable.tsx",
    "components/v3/live/PageFoundTable.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /controls=\{sorted\.controls\}/, path);
    assert.match(source, /total=\{sorted\.rows\.length\}/, path);
  }
});

test("the Findability CSV keeps the on-screen columns for each outcome (X-10)", () => {
  const table = read("components/v3/live/findability/FindabilityTable.tsx");
  for (const outcome of ["exact_official_product", "not_checked"] as const) {
    for (const [id, name] of findabilityExportColumns(outcome)) {
      if (id === "bundle") continue;
      assert.match(table, new RegExp(`clientColumn\\("${id}", "${name}"`));
    }
  }
  assert.match(table, /exportScope=\{exportScope\}/);
});
