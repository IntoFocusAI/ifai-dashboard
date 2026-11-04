// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/page-found-reasons.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildPageFoundEvidence,
  REASON_NOT_RECORDED,
  type PageFoundSourceRow,
} from "../lib/fender-canvas/page-found-evidence.ts";
import {
  FINDABILITY_LOADING,
  FINDABILITY_UNAVAILABLE,
  notFoundReasons,
  REASON_COLUMN_TOOLTIP,
  reasonGroups,
} from "../lib/fender-canvas/page-found-reasons.ts";
import { OUTCOME_DEFINITION, OUTCOME_LABEL, type FindabilityRead } from "../lib/findability/copy.ts";
import type { FindabilityRow } from "../lib/findability/outcomes.ts";

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
  spec("B0FOUND002", true),
  spec("B0EXACT001", false),
  spec("B0FAMILY01", false),
  spec("B0NOPAGE01", false),
  spec("B0NOPAGE02", null, "additionalProperty"),
  spec("B0AMBIG001", false),
  spec("B0UNCHECK1", false),
  spec("B0STORED01", false, "not_found_on_fender.com"),
  spec("B0NOROW001", false),
]);

const READY: FindabilityRead = {
  phase: "ready",
  dealerBundleLoaded: true,
  rows: [
    finding("B0FOUND001", "official_family_page"),
    finding("B0EXACT001", "exact_official_product"),
    finding("B0FAMILY01", "official_family_page"),
    finding("B0NOPAGE01", "completed_not_found"),
    finding("B0NOPAGE02", "completed_not_found"),
    finding("B0AMBIG001", "ambiguous_candidate"),
    finding("B0UNCHECK1", "not_checked", { counts_as_unchecked: true }),
    finding("B0STORED01", "not_checked", { counts_as_unchecked: true }),
    finding("B0NOTSPEC1", "completed_not_found"),
  ],
};

test("each not-found SKU shows its Findability outcome with that tab's name and definition", () => {
  const reasons = notFoundReasons(EVIDENCE.rows, READY);
  assert.equal(reasons.size, EVIDENCE.notFound);
  assert.equal(reasons.has("B0FOUND001"), false);

  const cases: Array<[string, keyof typeof OUTCOME_LABEL]> = [
    ["B0EXACT001", "exact_official_product"],
    ["B0FAMILY01", "official_family_page"],
    ["B0NOPAGE01", "completed_not_found"],
    ["B0NOPAGE02", "completed_not_found"],
    ["B0AMBIG001", "ambiguous_candidate"],
    ["B0UNCHECK1", "not_checked"],
  ];
  for (const [asin, outcome] of cases) {
    const reason = reasons.get(asin)!;
    assert.equal(reason.stored, null, asin);
    assert.deepEqual(reason.findability, {
      kind: "outcome",
      bucket: outcome,
      label: OUTCOME_LABEL[outcome],
      definition: OUTCOME_DEFINITION[outcome],
    });
    assert.equal(reason.group, OUTCOME_LABEL[outcome]);
  }
  assert.deepEqual(Object.values(OUTCOME_LABEL), [
    "Exact official product page",
    "Official family page",
    "No Defensible Page",
    "Ambiguous match",
    "Unchecked",
  ]);
});

test("a stored spec-check reason leads, and a SKU Findability has no row for reads Reason not recorded", () => {
  const reasons = notFoundReasons(EVIDENCE.rows, READY);
  const stored = reasons.get("B0STORED01")!;
  assert.equal(stored.stored?.label, "No matching fender.com product page");
  assert.equal(stored.group, "No matching fender.com product page");
  assert.equal(stored.findability.kind, "outcome");
  assert.equal(stored.findability.kind === "outcome" && stored.findability.label, "Unchecked");

  const noRow = reasons.get("B0NOROW001")!;
  assert.equal(noRow.stored, null);
  assert.deepEqual(noRow.findability, { kind: "no_row" });
  assert.equal(noRow.group, REASON_NOT_RECORDED);
});

test("the reason groups split the not-found rows, stored reasons first, without changing the counts", () => {
  const groups = reasonGroups(notFoundReasons(EVIDENCE.rows, READY).values());
  assert.deepEqual(groups, [
    { key: "No matching fender.com product page", count: 1 },
    { key: "Exact official product page", count: 1 },
    { key: "Official family page", count: 1 },
    { key: "No Defensible Page", count: 2 },
    { key: "Ambiguous match", count: 1 },
    { key: "Unchecked", count: 1 },
    { key: REASON_NOT_RECORDED, count: 1 },
  ]);
  assert.equal(
    groups.reduce((sum, group) => sum + group.count, 0),
    EVIDENCE.notFound,
  );
  assert.equal(EVIDENCE.found, 2);
  assert.equal(EVIDENCE.notFound, 8);
  assert.equal(EVIDENCE.checked, 10);
});

test("an unread Findability read never claims a reason was not recorded", () => {
  const loading = notFoundReasons(EVIDENCE.rows, { phase: "loading" });
  assert.equal(loading.get("B0NOROW001")?.group, FINDABILITY_LOADING);
  assert.equal(loading.get("B0STORED01")?.group, "No matching fender.com product page");

  const failed = notFoundReasons(EVIDENCE.rows, { phase: "error", message: "down" });
  assert.equal(failed.get("B0NOPAGE01")?.group, FINDABILITY_UNAVAILABLE);
  assert.equal(FINDABILITY_UNAVAILABLE, "Not available*");
  for (const reason of [...loading.values(), ...failed.values()]) {
    assert.notEqual(reason.group, REASON_NOT_RECORDED);
  }
});

test("an outcome outside the five reads Other result with no invented definition", () => {
  const other = notFoundReasons(buildPageFoundEvidence([spec("B0BLOCKED1", false)]).rows, {
    phase: "ready",
    dealerBundleLoaded: false,
    rows: [finding("B0BLOCKED1", "blocked", { counts_as_blocked: true })],
  }).get("B0BLOCKED1")!;
  assert.deepEqual(other.findability, { kind: "outcome", bucket: "other", label: "Other result", definition: null });
});

test("the table reads the shared Findability loader and keeps caveats in tooltips", () => {
  const table = read("components/v3/live/PageFoundTable.tsx");
  const cell = read("components/v3/live/PageFoundReason.tsx");
  const lib = read("lib/fender-canvas/page-found-reasons.ts");
  assert.match(table, /const findability = useFindability\(\);/);
  assert.match(table, /from "@\/components\/v3\/live\/findability\/FindabilityContext"/);
  for (const source of [table, cell, lib]) {
    assert.doesNotMatch(source, /loadFindabilityRead|canvas_spec_findability"\)/);
  }
  assert.match(table, /headerTooltip: REASON_COLUMN_TOOLTIP/);
  assert.match(REASON_COLUMN_TOOLTIP.description, /runs its own official-page check, so the two can differ\./);
  assert.match(table, /<ReasonFilter/);
  assert.match(cell, /className="ifai-term"/);
  assert.match(cell, /data-ifai-tooltip-desc=\{description\}/);
  assert.match(cell, /tabIndex=\{0\}/);
  for (const source of [table, cell, lib]) {
    assert.doesNotMatch(source, /(?<![\w-])title=/);
    assert.doesNotMatch(source, /\u2014/);
  }
  assert.doesNotMatch(cell, /separate|different|differ/i);
  for (const path of ["components/v3/live/PageFoundTable.tsx", "components/v3/live/PageFoundReason.tsx"]) {
    const lines = read(path).replace(/\n$/, "").split("\n").length;
    assert.ok(lines <= 400, `${path} is ${lines} lines`);
  }
});
