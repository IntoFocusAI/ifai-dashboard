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
import { amazonFieldLabel, requiredAmazonSpecList } from "../lib/fender-canvas/spec-missing-fields.ts";
import { WEEKLY_CHECK_DAYS, weeklyCheckStale } from "../lib/findability/last-checked.ts";
import { outcomeShareTone } from "../lib/findability/lead.ts";
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
  assert.match(stale.missing, /official-page check runs weekly and has not run since Oct 12, 2026/);
  assert.match(stale.effect ?? "", /outcome shares show the last check/);
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
  assert.equal(aplus.partial?.coverage, "3 of 4 live Amazon listings");
  assert.match(aplus.partial?.effect ?? "", /not counted as missing A\+/);
});

test("content shares carry the asterisk when a listing's own check is past twice its weekly schedule (X-25)", () => {
  const summary = summarizeListingContent([
    content("L1", "present", "live_page", "2026-10-20T00:00:00Z"),
    content("L2", "present", "live_page", "2026-11-09T00:00:00Z"),
  ]);
  const partial = contentSharePartial(summary, "aplus", NOW);
  assert.equal(partial?.reason, "coverage");
  assert.equal(partial?.coverage, "1 of 2 listings checked in the last 14 days");
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
  assert.equal(specPagesStale(summary, NOW)?.coverage, "0 of 1 pages checked in the last 14 days");
  assert.equal(specPagesStale(summary, Date.parse("2026-10-05T00:00:00Z")), null);
  assert.equal(specPagesStale(null, NOW), null);
});

test("Amazon Specs names its required-spec list, marked placeholder, with plain field names (D-05)", () => {
  const list = requiredAmazonSpecList();
  assert.equal(list.name, "guitar and instrument list");
  assert.equal(list.fieldCount, 13);
  assert.match(list.tooltip, /^Placeholder:/);
  assert.match(list.tooltip, /scale length/);
  assert.equal(amazonFieldLabel("scale_length"), "Scale length");
  assert.equal(amazonFieldLabel("light_output_maximum"), "Max lumens");
  const lead = read("components/v3/live/AiReadinessLead.tsx");
  assert.match(lead, /fields, placeholder\)/);
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
