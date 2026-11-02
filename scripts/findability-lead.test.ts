// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/findability-lead.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  EXACT_PAGE_SHARE_BANDS,
  exactPageFigure,
  exactPageLeadPie,
  exactPageLeadTip,
  exactPageShareColor,
  findabilityLeadBuckets,
  outcomeLeadPie,
  outcomeRatioFigure,
  outcomeShareColor,
  outcomeShareFigure,
  outcomeSharePct,
} from "../lib/findability/lead.ts";
import { FINDABILITY_OUTCOMES, countFindability, type FindabilityRow } from "../lib/findability/outcomes.ts";
import { OUTCOME_LABEL } from "../lib/findability/copy.ts";
import { formatPct } from "../lib/fender-canvas/format.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), "utf8");

function row(partial: Partial<FindabilityRow> & Pick<FindabilityRow, "asin" | "latest_state">): FindabilityRow {
  return {
    title: partial.title ?? "Listing",
    category: partial.category ?? "Solid Body",
    product_kind: partial.product_kind ?? "instrument",
    latest_canonical_url: partial.latest_canonical_url ?? null,
    latest_variant_sku: partial.latest_variant_sku ?? null,
    confidence: partial.confidence ?? null,
    explanation: partial.explanation ?? null,
    source_method: partial.source_method ?? null,
    http_status: partial.http_status ?? null,
    latest_attempt_at: partial.latest_attempt_at ?? null,
    jsonld_status: partial.jsonld_status ?? "not_checked",
    counts_as_confirmed: partial.counts_as_confirmed ?? false,
    counts_as_finished_search: partial.counts_as_finished_search ?? false,
    counts_as_ambiguous: partial.counts_as_ambiguous ?? false,
    counts_as_unchecked: partial.counts_as_unchecked ?? false,
    counts_as_completed_not_found: partial.counts_as_completed_not_found ?? false,
    counts_as_blocked: partial.counts_as_blocked ?? false,
    counts_as_timeout: partial.counts_as_timeout ?? false,
    counts_as_parse_failure: partial.counts_as_parse_failure ?? false,
    counts_as_unsupported: partial.counts_as_unsupported ?? false,
    ...partial,
  };
}

test("hero figure is outcome share percentage with N of M beside it", () => {
  const counts = countFindability([
    row({ asin: "E1", latest_state: "exact_official_product", counts_as_confirmed: true }),
    row({ asin: "E2", latest_state: "exact_official_product", counts_as_confirmed: true }),
    row({ asin: "F1", latest_state: "official_family_page", counts_as_confirmed: true }),
    row({ asin: "N1", latest_state: "completed_not_found", counts_as_completed_not_found: true }),
    row({ asin: "A1", latest_state: "ambiguous_candidate", counts_as_ambiguous: true }),
    row({ asin: "U1", latest_state: "not_checked", counts_as_unchecked: true }),
  ]);
  assert.equal(counts.exact_official_product, 2);
  assert.equal(counts.total, 6);
  assert.equal(outcomeSharePct(counts, "exact_official_product"), (100 * 2) / 6);
  assert.equal(outcomeShareFigure(counts, "exact_official_product"), formatPct((100 * 2) / 6));
  assert.equal(outcomeRatioFigure(counts, "exact_official_product"), "2 of 6");
  assert.equal(exactPageFigure(counts), "2 of 6");
  assert.equal(exactPageLeadTip(counts), "2 of 6");
  assert.equal(outcomeShareFigure(counts, "official_family_page"), formatPct((100 * 1) / 6));
  assert.equal(outcomeRatioFigure(counts, "completed_not_found"), "1 of 6");
});

test("each outcome disc is that outcome versus the rest; family stays out of exact", () => {
  const counts = countFindability([
    row({ asin: "E1", latest_state: "exact_official_product", counts_as_confirmed: true }),
    row({ asin: "F1", latest_state: "official_family_page", counts_as_confirmed: true }),
    row({ asin: "F2", latest_state: "official_family_page", counts_as_confirmed: true }),
    row({ asin: "U1", latest_state: "not_checked", counts_as_unchecked: true }),
  ]);
  const pie = exactPageLeadPie(counts);
  assert.ok(pie);
  assert.equal(pie.total, 4);
  assert.equal(pie.title, OUTCOME_LABEL.exact_official_product);
  assert.deepEqual(
    pie.slices.map((s) => [s.key, s.count, s.label]),
    [
      ["matched", 1, OUTCOME_LABEL.exact_official_product],
      ["none", 3, "Rest of this read"],
    ],
  );
  const family = outcomeLeadPie(counts, "official_family_page");
  assert.ok(family);
  assert.equal(family.title, OUTCOME_LABEL.official_family_page);
  assert.deepEqual(
    family.slices.map((s) => [s.key, s.count]),
    [
      ["owned", 2],
      ["none", 2],
    ],
  );
  assert.equal(counts.official_family_page, 2);
  assert.notEqual(counts.exact_official_product, counts.official_family_page + counts.exact_official_product);
});

test("empty and zero-total reads invent no figure and no disc", () => {
  const empty = countFindability([]);
  assert.equal(exactPageFigure(empty), null);
  assert.equal(outcomeShareFigure(empty, "exact_official_product"), null);
  assert.equal(exactPageLeadPie(empty), null);
  assert.equal(exactPageShareColor(empty), null);
  assert.equal(outcomeShareColor(empty, "completed_not_found"), null);
});

test("low exact-page share uses the gap color; other outcomes use tokens", () => {
  const low = countFindability([
    row({ asin: "E1", latest_state: "exact_official_product", counts_as_confirmed: true }),
    ...Array.from({ length: 9 }, (_, i) =>
      row({ asin: `U${i}`, latest_state: "not_checked", counts_as_unchecked: true }),
    ),
  ]);
  assert.ok((100 * low.exact_official_product) / low.total < EXACT_PAGE_SHARE_BANDS.redBelow);
  assert.equal(exactPageShareColor(low), "var(--danger-red)");
  assert.equal(outcomeShareColor(low, "exact_official_product"), "var(--danger-red)");
  assert.equal(outcomeShareColor(low, "official_family_page"), "var(--success-green)");
  assert.equal(outcomeShareColor(low, "completed_not_found"), "var(--danger-red)");
  assert.equal(outcomeShareColor(low, "ambiguous_candidate"), "var(--warning-amber)");
  assert.equal(outcomeShareColor(low, "not_checked"), "var(--warning-amber)");

  const high = countFindability([
    ...Array.from({ length: 7 }, (_, i) =>
      row({ asin: `E${i}`, latest_state: "exact_official_product", counts_as_confirmed: true }),
    ),
    row({ asin: "U1", latest_state: "not_checked", counts_as_unchecked: true }),
  ]);
  assert.ok((100 * high.exact_official_product) / high.total > EXACT_PAGE_SHARE_BANDS.greenAbove);
  assert.equal(exactPageShareColor(high), "var(--success-green)");
});

test("lead buckets are FINDABILITY_OUTCOMES order; Other only when above zero", () => {
  const five = countFindability([
    row({ asin: "E1", latest_state: "exact_official_product", counts_as_confirmed: true }),
  ]);
  assert.deepEqual(findabilityLeadBuckets(five), [...FINDABILITY_OUTCOMES]);
  assert.equal(five.other, 0);

  const withOther = countFindability([
    row({ asin: "E1", latest_state: "exact_official_product", counts_as_confirmed: true }),
    row({
      asin: "B1",
      latest_state: "blocked",
      counts_as_blocked: true,
      counts_as_unchecked: false,
    }),
  ]);
  assert.ok(withOther.other > 0);
  assert.deepEqual(findabilityLeadBuckets(withOther), [...FINDABILITY_OUTCOMES, "other"]);
});

test("Findability panel leads with five outcome heroes and drops the count sentence", () => {
  const panel = read("components/v3/live/findability/FindabilityPanel.tsx");
  const hero = read("components/v3/live/findability/FindabilityLead.tsx");
  const lead = read("lib/findability/lead.ts");
  const css = read("lib/canvas-sdk/canvas-sdk.css");
  assert.match(panel, /FindabilityLead/);
  assert.doesNotMatch(panel, /findabilityHeadline/);
  assert.doesNotMatch(panel, /data-findability-headline/);
  assert.doesNotMatch(panel, /findability-headline/);
  assert.match(hero, /ai-lead-figure/);
  assert.match(hero, /CitationPieDisc/);
  assert.match(hero, /OUTCOME_LABEL/);
  assert.match(hero, /FINDABILITY_OUTCOMES|findabilityLeadBuckets/);
  assert.match(hero, /citation-pie-disc-findability/);
  assert.match(hero, /data-findability-lead-pct/);
  assert.match(hero, /data-findability-lead-ratio/);
  assert.match(hero, /data-findability-last-checked/);
  assert.match(hero, /newestCheckedAttemptAt/);
  assert.match(panel, /FindabilityLead counts=\{counts!\} rows=\{read\.rows\}/);
  assert.match(lead, /outcomeLeadPie/);
  assert.match(lead, /outcomeShareFigure/);
  assert.match(lead, /formatPct/);
  assert.match(lead, /OUTCOME_LABEL/);
  assert.match(css, /\.citation-pie-disc-findability\s*\{[^}]*width:\s*62px/s);
  assert.match(css, /\.citation-pie-disc-accuracy\s*\{[^}]*width:\s*48px/s);
  assert.match(css, /\.findability-last-checked/);
  assert.match(panel, /Each listing is one outcome/);
  assert.doesNotMatch(hero, /\u2014/);
  assert.doesNotMatch(hero, /\stitle=/);
  assert.doesNotMatch(lead, /\u2014/);
  const lines = hero.split("\n").length;
  assert.ok(lines <= 400, `FindabilityLead.tsx is ${lines} lines`);
});
