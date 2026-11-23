// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/own-pages-count.test.ts
//
// Worker 32.13 / 32.18. The own-pages "completeness" item counts LISTINGS whose found page misses a
// field (never found pages x the missing share), the same unit the central rank measures against all
// monitored listings; names the one field when one accounts for the gap; carries the one count (the
// figure's N equals the rank reason's N); and keeps the same gap in pages for the tooltip. And the
// ranked list waits for every read.
import assert from "node:assert/strict";
import { test } from "node:test";
import { brandSite } from "../lib/brand-copy.ts";
import type { SpecPage, SpecPageSummary } from "../lib/fender-canvas/machine-readability.ts";
import { isPlanPending, pendingPlanReads, planSettled, PLAN_PENDING } from "../lib/fender-canvas/plan-settled.ts";
import {
  completenessGap,
  completenessPagesTip,
  completenessShort,
  factorTask,
  urgentOwnPagesAction,
  type OwnPageFactor,
} from "../lib/fender-canvas/roadmap-own-pages.ts";
import { buildPlan, planFigure } from "../lib/fender-canvas/roadmap-plan.ts";

function page(i: number, missingFields: string[], asins = 1): SpecPage {
  return {
    url: `https://site.example/products/p${i}`,
    model: `P${i}`,
    asins: Array.from({ length: asins }, (_, k) => `A${i}-${k}`),
    missingFields,
    hasSpecBlock: !missingFields.includes("additionalProperty"),
    basicsPresent: 7,
    missingBasics: [],
    checkedAt: null,
  };
}

function summary(pages: SpecPage[]): SpecPageSummary {
  return {
    pages,
    withSpecBlock: pages.filter((p) => p.hasSpecBlock).length,
    withAllBasics: pages.length,
    listings: pages.reduce((sum, p) => sum + p.asins.length, 0),
  };
}

test("counts LISTINGS whose page misses a field (several listings share a page), never found pages times a share", () => {
  // 197 pages serve 713 listings (the Fender shape): every page misses the spec block.
  const pages = Array.from({ length: 197 }, (_, i) => page(i, ["additionalProperty"], i < 125 ? 4 : 3));
  const s = summary(pages);
  assert.equal(s.listings, 125 * 4 + 72 * 3);
  const gap = completenessGap(s)!;
  assert.deepEqual(gap, { listings: s.listings, base: s.listings, pages: 197, pageBase: 197, field: "additionalProperty" });
  assert.equal(completenessShort(gap), `Listings whose ${brandSite()} page lacks machine-readable specs`);
  assert.equal(completenessPagesTip(gap), `${brandSite()} pages without machine-readable specs: 197 of 197 found pages. One page can serve several listings.`);
  assert.equal(factorTask("completeness", gap), `Add machine-readable specs to ${brandSite()} product pages`);
});

test("each listing counts by its own stored read when the summary carries it (the rows AI Readiness counts)", () => {
  // The Ledlenser shape: 69 pages, 98 listings; the page read says 65 pages miss the spec block,
  // and 92 listings' own reads miss it (6 more read no JSON-LD).
  const pages = Array.from({ length: 69 }, (_, i) => page(i, i < 65 ? ["additionalProperty"] : [], i < 29 ? 2 : 1));
  const s = summary(pages);
  assert.equal(s.listings, 98);
  const foundListings = s.pages.flatMap((p, i) =>
    p.asins.map((asin, k) => ({ asin, missingFields: i < 65 && !(i < 2 && k === 1) ? ["additionalProperty"] : ["jsonld_not_read"] })),
  );
  const gap = completenessGap({ ...s, foundListings })!;
  assert.deepEqual(gap, { listings: 92, base: 98, pages: 65, pageBase: 69, field: "additionalProperty" });
});

test("pages with different gaps keep the general label and title; healthy pages are not counted", () => {
  const pages = [page(1, ["additionalProperty"]), page(2, ["description"], 2), page(3, []), page(4, [])];
  const gap = completenessGap(summary(pages))!;
  assert.deepEqual(gap, { listings: 3, base: 5, pages: 2, pageBase: 4, field: null });
  assert.equal(completenessShort(gap), `Listings whose ${brandSite()} page has empty spec fields`);
  assert.equal(factorTask("completeness", gap), `Fill the empty spec fields on ${brandSite()} product pages`);
});

test("a field missing for nearly every gap listing is named, and N counts the listings missing it", () => {
  // 94 listings miss the spec block (some also miss another field); 4 are healthy.
  const pages = Array.from({ length: 98 }, (_, i) => page(i, i < 94 ? (i < 20 ? ["additionalProperty", "gtin12"] : ["additionalProperty"]) : []));
  assert.deepEqual(completenessGap(summary(pages)), { listings: 94, base: 98, pages: 94, pageBase: 98, field: "additionalProperty" });
  // Two fields each missing for about half the gap listings: no field accounts for the gap.
  const split = [page(1, ["additionalProperty"]), page(2, ["gtin12"]), page(3, ["gtin12", "additionalProperty"]), page(4, ["description"])];
  assert.equal(completenessGap(summary(split))!.field, null);
});

test("one other missing field is named in the count label; the title stays general", () => {
  const gap = completenessGap(summary([page(1, ["description"]), page(2, ["description"]), page(3, [])]))!;
  assert.equal(completenessShort(gap), `Listings whose ${brandSite()} page is missing description`);
  assert.equal(factorTask("completeness", gap), `Fill the empty spec fields on ${brandSite()} product pages`);
});

test("no page read gives no count", () => {
  assert.equal(completenessGap(null), null);
  assert.equal(completenessGap(summary([])), null);
  assert.equal(completenessShort(null), `Listings whose ${brandSite()} page has empty spec fields`);
  assert.equal(completenessPagesTip(null), null);
});

test("figure N equals the rank reason's N, both in listings, and the tooltip carries the pages", () => {
  const gap = completenessGap(summary(Array.from({ length: 69 }, (_, i) => page(i, i < 65 ? ["additionalProperty"] : [], i < 29 ? 2 : 1))))!;
  const factor: OwnPageFactor = {
    id: "completeness",
    label: "Spec fields filled",
    percent: "90.0%",
    ratio: "x of y",
    tone: "danger",
    open: { spokeId: "specs", tab: "Brand-Site Specs" },
    affected: gap.listings,
    base: gap.base,
    short: completenessShort(gap),
    tip: completenessPagesTip(gap),
    task: factorTask("completeness", gap),
    effort: "M",
  };
  const action = urgentOwnPagesAction([factor])!;
  const plan = buildPlan({ findings: [], signals: [], sources: [], ownPages: action, focus: [], reach: { answers: null, listings: 208 } });
  const item = plan.find((entry) => entry.id === "own:pages")!;
  assert.equal(item.title, `Add machine-readable specs to ${brandSite()} product pages`);
  assert.equal(item.count!.label, `Listings whose ${brandSite()} page lacks machine-readable specs`);
  assert.equal(item.count!.unit, "listings");
  assert.equal(item.count!.affected, 94);
  assert.equal(planFigure(item).ratio, "94 of 98");
  assert.match(item.reason, /^Touches 94 of 208 monitored listings /);
  assert.equal(item.tip, `${brandSite()} pages without machine-readable specs: 65 of 69 found pages. One page can serve several listings.`);
});

test("loading gate: no ranking while a source is pending; a failed read is settled", () => {
  const ready = {
    retail: { phase: "ready" },
    bundle: { estimates: { phase: "ready" } },
    findability: { phase: "ready" },
    ai: { phase: "ready" },
    stock: { phase: "ready" },
    sources: { phase: "ready" },
    windows: { phase: "ready" },
  } as unknown as Parameters<typeof planSettled>[0];
  assert.equal(planSettled(ready), true);
  const pending = (patch: Record<string, unknown>) => ({ ...ready, ...patch }) as unknown as Parameters<typeof planSettled>[0];
  assert.deepEqual(pendingPlanReads(pending({ sources: { phase: "loading" } })), ["source runs"]);
  assert.deepEqual(pendingPlanReads(pending({ bundle: { estimates: { phase: "loading" } } })), ["analyst estimates"]);
  assert.deepEqual(pendingPlanReads(pending({ bundle: null })), ["canvas metrics"]);
  assert.equal(planSettled(pending({ windows: { phase: "loading" } })), false);
  assert.equal(planSettled(pending({ ai: { phase: "loading" }, stock: { phase: "loading" } })), false);
  // Failed reads are settled: the plan builds with the existing failed-read handling.
  assert.equal(planSettled(pending({ retail: { phase: "error" }, ai: { phase: "error", message: "x" }, stock: { phase: "error" } })), true);
  assert.equal(isPlanPending(PLAN_PENDING), true);
  assert.equal(isPlanPending([]), false);
});
