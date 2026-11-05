// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/page-found-findability-link.test.ts
// FDD D-08: a not-found row's Findability result links to that listing's Findability row.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildPageFoundEvidence, type PageFoundSourceRow } from "../lib/fender-canvas/page-found-evidence.ts";
import { notFoundReasons } from "../lib/fender-canvas/page-found-reasons.ts";
import type { FindabilityRead } from "../lib/findability/copy.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";
import {
  clearFindabilityRowFocus,
  consumeFindabilityRowFocus,
  findabilityRowLink,
  findabilityRowTarget,
  formatFindabilityRowFocus,
  parseFindabilityRowFocus,
  peekFindabilityRowFocus,
  setFindabilityRowFocus,
} from "../lib/findability/row-focus.ts";
import { parseEvidence } from "../lib/ai-search/evidence-focus.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function spec(asin: string, found: boolean | null, missing: string | null = null): PageFoundSourceRow {
  return {
    asin,
    title: `Model ${asin}`,
    fender_url: found ? `https://www.fender.com/products/${asin.toLowerCase()}` : null,
    fender_found: found,
    fender_missing_fields: missing,
    checked_at: "2026-11-03T01:02:06Z",
  };
}

function finding(asin: string, state: string | null, flags: Partial<FindabilityRow> = {}): FindabilityRow {
  return {
    asin,
    title: null,
    category: null,
    product_kind: null,
    latest_state: state,
    latest_canonical_url: null,
    latest_variant_sku: null,
    confidence: null,
    explanation: null,
    source_method: null,
    http_status: null,
    latest_attempt_at: null,
    jsonld_status: null,
    counts_as_confirmed: null,
    counts_as_finished_search: null,
    counts_as_ambiguous: null,
    counts_as_unchecked: null,
    counts_as_completed_not_found: null,
    counts_as_blocked: null,
    counts_as_timeout: null,
    counts_as_parse_failure: null,
    counts_as_unsupported: null,
    ...flags,
  };
}

const EVIDENCE = buildPageFoundEvidence([
  spec("B0FOUND001", true),
  spec("B0NOPAGE01", false),
  spec("B0FAMILY01", false),
  spec("B0UNCHECK1", false),
  spec("B0STORED01", false, "not_found_on_fender.com"),
  spec("B0BLOCKED1", false),
  spec("B0NOROW001", false),
]);

const READY: FindabilityRead = {
  phase: "ready",
  dealerBundleLoaded: true,
  rows: [
    finding("B0FOUND001", "exact_official_product"),
    finding("B0NOPAGE01", "completed_not_found"),
    finding("B0FAMILY01", "official_family_page"),
    finding("B0UNCHECK1", "not_checked", { counts_as_unchecked: true }),
    finding("B0STORED01", "completed_not_found"),
    finding("B0BLOCKED1", "blocked", { counts_as_blocked: true }),
  ],
};

test("a listing with a Findability row links to that row, matched by ASIN", () => {
  const reasons = notFoundReasons(EVIDENCE.rows, READY);
  for (const asin of ["B0NOPAGE01", "B0FAMILY01", "B0UNCHECK1", "B0STORED01", "B0BLOCKED1"]) {
    assert.deepEqual(reasons.get(asin)?.link, {
      spokeId: "specs",
      tab: "Findability",
      asin,
      evidence: `asin:${asin}`,
    });
  }
  assert.equal(reasons.has("B0FOUND001"), false, "found rows have no reason and no link");
});

test("a listing with no Findability row stays plain text, and so do loading and failed reads", () => {
  const ready = notFoundReasons(EVIDENCE.rows, READY).get("B0NOROW001")!;
  assert.deepEqual(ready.findability, { kind: "no_row" });
  assert.equal(ready.link, null);
  assert.equal(ready.group, "Reason not recorded");

  for (const findability of [{ phase: "loading" }, { phase: "error", message: "boom" }] as FindabilityRead[]) {
    for (const reason of notFoundReasons(EVIDENCE.rows, findability).values()) {
      assert.equal(reason.link, null);
    }
  }
});

test("the link target opens the outcome table that holds the row", () => {
  assert.deepEqual(findabilityRowTarget(READY, "B0NOPAGE01"), { asin: "B0NOPAGE01", bucket: "completed_not_found" });
  assert.deepEqual(findabilityRowTarget(READY, "B0FAMILY01"), { asin: "B0FAMILY01", bucket: "official_family_page" });
  assert.deepEqual(findabilityRowTarget(READY, "B0UNCHECK1"), { asin: "B0UNCHECK1", bucket: "not_checked" });
  assert.deepEqual(findabilityRowTarget(READY, "B0BLOCKED1"), { asin: "B0BLOCKED1", bucket: "other" });
  assert.equal(findabilityRowTarget(READY, "B0NOROW001"), null);
  assert.equal(findabilityRowTarget(READY, null), null);
  assert.equal(findabilityRowTarget({ phase: "loading" }, "B0NOPAGE01"), null);
  assert.equal(findabilityRowTarget({ phase: "error", message: "x" }, "B0NOPAGE01"), null);
});

test("the row rides the spoke's evidence parameter as asin:<ASIN>, which AI Search ignores", () => {
  assert.equal(formatFindabilityRowFocus("B0NOPAGE01"), "asin:B0NOPAGE01");
  assert.equal(parseFindabilityRowFocus("asin:B0NOPAGE01"), "B0NOPAGE01");
  assert.equal(parseFindabilityRowFocus("asin: B0NOPAGE01 "), "B0NOPAGE01");
  assert.equal(parseFindabilityRowFocus("asin:"), null);
  assert.equal(parseFindabilityRowFocus("asin:B0<script>"), null);
  assert.equal(parseFindabilityRowFocus("sim:1161"), null);
  assert.equal(parseFindabilityRowFocus(null), null);
  assert.equal(parseEvidence("asin:B0NOPAGE01"), null);
  assert.equal(findabilityRowLink("B0NOPAGE01", false), null);
  assert.equal(findabilityRowLink("", true), null);
});

test("the landing is taken once, and a choice on the tab clears it", () => {
  setFindabilityRowFocus("B0NOPAGE01");
  assert.equal(peekFindabilityRowFocus(), "B0NOPAGE01");
  assert.equal(peekFindabilityRowFocus(), "B0NOPAGE01", "peeking does not take it");
  consumeFindabilityRowFocus();
  assert.equal(peekFindabilityRowFocus(), null);
  setFindabilityRowFocus("B0FAMILY01");
  clearFindabilityRowFocus();
  assert.equal(peekFindabilityRowFocus(), null);
});

test("the link is a keyboard button on the panel's data-ifai-open path, with custom tooltips", () => {
  const cell = read("components/v3/live/PageFoundReason.tsx");
  assert.match(cell, /<button\s+type="button"/);
  assert.match(cell, /data-ifai-open=\{link\.spokeId\}/);
  assert.match(cell, /data-ifai-tab=\{link\.tab\}/);
  assert.match(cell, /onClickCapture=\{\(\) => setFindabilityRowFocus\(link\.asin\)\}/);
  assert.match(cell, /"data-ifai-tooltip-desc": `\$\{definition\} \$\{opens\}`/);
  assert.match(cell, /aria-label=/);
  assert.doesNotMatch(cell, /(?<![\w-])title=/);
  assert.doesNotMatch(cell, /href=/);

  const panel = read("components/v3/live/findability/FindabilityPanel.tsx");
  assert.match(panel, /useFindabilityRowLanding\(read, setSelected\)/);
  assert.match(panel, /landAsin=\{landAsin\}/);
  assert.match(panel, /clearLanding\(\);/);
  const table = read("components/v3/live/findability/FindabilityTable.tsx");
  assert.match(table, /useLandOnFindabilityRow\(landAsin, rows, CLIENT_TABLE_PAGE_SIZE, population\.setPage\)/);
  assert.match(table, /data-findability-landed=/);
  const landing = read("components/v3/live/findability/useFindabilityRowLanding.ts");
  assert.match(landing, /requestAnimationFrame/);
  assert.match(landing, /scrollIntoView\(\{ block: "center" \}\)/);
  const css = read("components/v3/live/findability/findability-landing.css");
  assert.match(css, /tr\[data-findability-landed\] > td/);
  assert.match(css, /prefers-reduced-motion/);

  for (const path of [
    "components/v3/live/PageFoundReason.tsx",
    "components/v3/live/findability/FindabilityPanel.tsx",
    "components/v3/live/findability/FindabilityTable.tsx",
  ]) {
    const lines = read(path).replace(/\n$/, "").split("\n").length;
    assert.ok(lines <= 400, `${path} is ${lines} lines`);
  }
});
