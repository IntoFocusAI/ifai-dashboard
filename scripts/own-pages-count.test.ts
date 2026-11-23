// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/own-pages-count.test.ts
//
// Worker 32.13. The own-pages "completeness" item counts PAGES that miss at least one field (never
// found pages x the missing share), names the one field when one accounts for the gap, and carries
// the one count: the figure's N equals the rank reason's N. And the ranked list waits for every read.
import assert from "node:assert/strict";
import { test } from "node:test";
import { brandSite } from "../lib/brand-copy.ts";
import type { SpecPage, SpecPageSummary } from "../lib/fender-canvas/machine-readability.ts";
import { isPlanPending, pendingPlanReads, planSettled, PLAN_PENDING } from "../lib/fender-canvas/plan-settled.ts";
import {
  completenessGap,
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

test("counts pages that miss a field, not found pages times a share; names the one missing field", () => {
  // 713 pages (714 listings: one page serves two) that all miss the same field.
  const pages = Array.from({ length: 713 }, (_, i) => page(i, ["additionalProperty"], i === 0 ? 2 : 1));
  const s = summary(pages);
  assert.equal(s.listings, 714);
  const gap = completenessGap(s)!;
  assert.deepEqual(gap, { pages: 713, base: 713, field: "additionalProperty" });
  assert.equal(completenessShort(gap), `${brandSite()} pages without machine-readable specs`);
  assert.equal(factorTask("completeness", gap), `Add machine-readable specs to ${brandSite()} product pages`);
});

test("pages with different gaps keep the general label and title; healthy pages are not counted", () => {
  const pages = [page(1, ["additionalProperty"]), page(2, ["description"]), page(3, []), page(4, [])];
  const gap = completenessGap(summary(pages))!;
  assert.deepEqual(gap, { pages: 2, base: 4, field: null });
  assert.equal(completenessShort(gap), `${brandSite()} pages with empty spec fields`);
  assert.equal(factorTask("completeness", gap), `Fill the empty spec fields on ${brandSite()} product pages`);
});

test("one other missing field is named in the count label; the title stays general", () => {
  const gap = completenessGap(summary([page(1, ["description"]), page(2, ["description"]), page(3, [])]))!;
  assert.equal(completenessShort(gap), `${brandSite()} pages missing description`);
  assert.equal(factorTask("completeness", gap), `Fill the empty spec fields on ${brandSite()} product pages`);
});

test("no page read gives no count", () => {
  assert.equal(completenessGap(null), null);
  assert.equal(completenessGap(summary([])), null);
  assert.equal(completenessShort(null), `${brandSite()} pages with empty spec fields`);
});

test("figure N equals the rank reason's N for the completeness item", () => {
  const gap = completenessGap(summary(Array.from({ length: 98 }, (_, i) => page(i, i < 94 ? ["additionalProperty"] : []))))!;
  const factor: OwnPageFactor = {
    id: "completeness",
    label: "Spec fields filled",
    percent: "90.0%",
    ratio: "x of y",
    tone: "danger",
    open: { spokeId: "specs", tab: "Brand-Site Specs" },
    affected: gap.pages,
    base: gap.base,
    short: completenessShort(gap),
    task: factorTask("completeness", gap),
    effort: "M",
  };
  const action = urgentOwnPagesAction([factor])!;
  const plan = buildPlan({ findings: [], signals: [], sources: [], ownPages: action, focus: [], reach: { answers: null, listings: 1198 } });
  const item = plan.find((entry) => entry.id === "own:pages")!;
  assert.equal(item.title, `Add machine-readable specs to ${brandSite()} product pages`);
  assert.equal(item.count!.label, `${brandSite()} pages without machine-readable specs`);
  assert.equal(item.count!.affected, 94);
  assert.equal(planFigure(item).ratio, "94 of 98");
  assert.match(item.reason, /Touches 94 of /);
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
