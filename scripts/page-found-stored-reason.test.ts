// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/page-found-stored-reason.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildPageFoundEvidence,
  REASON_NOT_RECORDED,
  type PageFoundSourceRow,
} from "../lib/fender-canvas/page-found-evidence.ts";
import { notFoundReasons, reasonGroups } from "../lib/fender-canvas/page-found-reasons.ts";
import {
  pagesCheckedNote,
  STORED_REASON_ORDER,
  STORED_REASONS,
  storedNotFoundReason,
  storedReasonTooltip,
} from "../lib/fender-canvas/page-found-stored-reason.ts";
import type { FindabilityRead } from "../lib/findability/copy.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

/** fender_missing_fields as the 4 Nov 2026 fender.com spec check stored them. */
const LIVE = {
  B09BTVN81S:
    "not_found: search_results_no_matching_model (affinity-series-stratocaster-fmt-hss:handle_rejected | affinity-stratocaster-fmt-hss:handle_rejected | squier-affinity-stratocaster-fmt-hss:handle_rejected)",
  B09R6WBMG9:
    "not_found: search_candidate_page_missing (fender-digital-gift-card:handle_rejected | fender-play-prepaid-cards:handle_rejected | affinity-jazzmaster:page_not_found | squier-affinity-jazzmaster:page_not_found)",
  B0B625Q97M:
    "not_found: search_page_lacks_this_sku (american-vintage-ii-1972-telecaster-thinline:no_variant_match | american-vintage-ii-1972-thinline-telecaster:page_not_found | squier-american-vintage-ii-1972-thinline-telecaster:handle_rejected)",
  B09R6ZQNN5:
    "not_found: search_page_lacks_part_number (limited-edition-affinity-series-stratocaster-hh-metallic-black:handle_rejected | affinity-series-stratocaster-hss-pack:handle_rejected | affinity-series-stratocaster:part_number_not_on_page | affinity-series-stratocaster-fmt-hss:handle_rejected | affinity-series-stratocaster-junior-hss:handle_rejected | affinity-series-stratocaster-mustang-micro-pack:handle_rejected | affinity-stratocaster:page_not_found | squier-affinity-stratocaster:page_not_found)",
  B0B621WX38:
    "not_found: findability_page_not_read (findability:page_not_read | american-vintage-ii-1957-stratocaster-left-hand:handle_rejected | american-vintage-ii-1957-left-handed-stratocaster-2-color-sunburst:handle_rejected | squier-american-vintage-ii-1957-left-handed-stratocaster-2-color-sunburst:handle_rejected)",
  B09W8LLFNK:
    "not_found: findability_page_not_read (findability:page_not_read | classic-vibe-60s-stratocaster:handle_rejected | squier-classic-vibe-60s-stratocaster:handle_rejected)",
  // Cut at the collector's 600-character limit, mid-handle.
  B09TPVQJML:
    "not_found: search_results_no_matching_model (fender-spaghetti-logo-t-shirt-shell-pink:handle_rejected | fender-spaghetti-logo-t-shirt-surf-green:handle_rejected | fender-spaghetti-logo-t-shirt-daphne-blue:handle_rejected | fender-spaghetti-logo-t-shirt-butterscotch-blonde:handle_rejected | fender-spaghetti-logo-t-shirt-dakota-red:handle_rejected | fender-spaghetti-logo-t-shirt-black:handle_rejected | fender-spaghetti-logo-tie-dye-t-shirt-mustard:handle_rejected | fender-spaghetti-logo-tie-dye-t-shirt:handle_rejected | fender-spaghetti-logo-long-sleeve-t-shirt-black:handle_rejected | fender-spa",
} as const;

function spec(asin: string, missing: string | null): PageFoundSourceRow {
  return { asin, title: `Model ${asin}`, fender_url: null, fender_found: false, fender_missing_fields: missing, checked_at: null };
}

function finding(asin: string, state: string): FindabilityRow {
  return { asin, latest_state: state } as FindabilityRow;
}

test("each live collector code reads as one plain reason", () => {
  const cases: Array<[keyof typeof LIVE, string, number, boolean]> = [
    ["B09BTVN81S", "No matching fender.com product page", 3, false],
    ["B09R6WBMG9", "Matching fender.com page is missing", 4, false],
    ["B0B625Q97M", "Matching page has no variant for this SKU", 3, false],
    ["B09R6ZQNN5", "Matching page does not list this part number", 8, false],
    ["B0B621WX38", "fender.com page did not load", 4, false],
    ["B09TPVQJML", "No matching fender.com product page", 10, true],
  ];
  for (const [asin, label, pages, cut] of cases) {
    const stored = storedNotFoundReason(LIVE[asin]);
    assert.equal(stored?.label, label, asin);
    assert.equal(stored?.pagesChecked, pages, asin);
    assert.equal(stored?.pagesCut, cut, asin);
  }
  assert.deepEqual(Object.keys(STORED_REASONS).sort(), [...STORED_REASON_ORDER].sort());
});

test("the tried pages become a short count in the tooltip, never a list", () => {
  const stored = storedNotFoundReason(LIVE.B09R6WBMG9)!;
  assert.equal(pagesCheckedNote(stored), "4 fender.com pages checked.");
  assert.equal(
    storedReasonTooltip(stored),
    "fender.com search pointed to a page for this model, but that page does not exist on fender.com. 4 fender.com pages checked.",
  );
  assert.equal(pagesCheckedNote(storedNotFoundReason(LIVE.B09TPVQJML)!), "At least 10 fender.com pages checked.");
  assert.equal(pagesCheckedNote({ pagesChecked: 1, pagesCut: false }), "1 fender.com page checked.");
  const legacy = storedNotFoundReason("not_found_on_fender.com")!;
  assert.equal(pagesCheckedNote(legacy), null);
  assert.equal(storedReasonTooltip(legacy), STORED_REASONS.no_matching_model.definition);
  for (const value of Object.values(LIVE)) {
    const stored = storedNotFoundReason(value)!;
    for (const text of [stored.label, storedReasonTooltip(stored)]) {
      assert.doesNotMatch(text, /handle|rejected|_|\(|\||stratocaster|telecaster|t-shirt/i);
    }
  }
});

test("unknown codes fall back to the Findability result, then Reason not recorded", () => {
  assert.equal(storedNotFoundReason("not_found: search_timed_out (x:handle_rejected)"), null);
  assert.equal(storedNotFoundReason("not_found:"), null);
  const evidence = buildPageFoundEvidence([
    spec("B0UNKNOWN1", "not_found: search_timed_out (x:handle_rejected)"),
    spec("B0UNKNOWN2", "not_found: search_timed_out"),
    spec("B0B621WX38", LIVE.B0B621WX38),
  ]);
  const reasons = notFoundReasons(evidence.rows, {
    phase: "ready",
    dealerBundleLoaded: true,
    rows: [finding("B0UNKNOWN1", "completed_not_found"), finding("B0B621WX38", "official_family_page")],
  } as FindabilityRead);
  assert.equal(reasons.get("B0UNKNOWN1")?.stored, null);
  assert.equal(reasons.get("B0UNKNOWN1")?.group, "No Defensible Page");
  assert.equal(reasons.get("B0UNKNOWN2")?.group, REASON_NOT_RECORDED);
  assert.equal(reasons.get("B0UNKNOWN2")?.link, null);
  const stored = reasons.get("B0B621WX38")!;
  assert.equal(stored.group, "fender.com page did not load");
  assert.equal(stored.findability.kind === "outcome" && stored.findability.label, "Official family page");
  assert.equal(stored.link?.evidence, "asin:B0B621WX38");
});

test("the live samples group into a handful of plain reasons, in a fixed order, adding up to the rows", () => {
  const evidence = buildPageFoundEvidence(
    Object.entries(LIVE).map(([asin, value]) => spec(asin, value)).concat(spec("B0NOREASON", null)),
  );
  const groups = reasonGroups(
    notFoundReasons(evidence.rows, {
      phase: "ready",
      dealerBundleLoaded: true,
      rows: [finding("B0NOREASON", "not_checked")],
    } as FindabilityRead).values(),
  );
  assert.deepEqual(groups, [
    { key: "No matching fender.com product page", count: 2 },
    { key: "Matching fender.com page is missing", count: 1 },
    { key: "fender.com page did not load", count: 2 },
    { key: "Matching page has no variant for this SKU", count: 1 },
    { key: "Matching page does not list this part number", count: 1 },
    { key: "Unchecked", count: 1 },
  ]);
  assert.equal(
    groups.reduce((sum, group) => sum + group.count, 0),
    evidence.notFound,
  );
});

test("the cell shows the plain reason with its count in a custom tooltip", () => {
  const cell = read("components/v3/live/PageFoundReason.tsx");
  assert.match(cell, /data-page-found-stored-reason=\{stored\.code\}/);
  assert.match(cell, /<Term name=\{stored\.label\} description=\{storedReasonTooltip\(stored\)\}>/);
  assert.doesNotMatch(cell, /pagesChecked|fender_missing_fields/);
  const evidence = read("lib/fender-canvas/page-found-evidence.ts");
  assert.doesNotMatch(evidence, /sentenceCase/);
});
