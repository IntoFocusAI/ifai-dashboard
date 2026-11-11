// node --experimental-strip-types --import ./scripts/register-alias.mjs --import ./scripts/register-ts-extensions.mjs --test scripts/page-found-brand-site.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PAGE_FOUND_DEFINITION,
  pageFoundHero,
} from "../lib/fender-canvas/ai-readiness-lead.ts";
import {
  brandSitePageFoundHero,
  PAGE_FOUND_ANCHOR,
  PAGE_FOUND_UNAVAILABLE,
} from "../lib/fender-canvas/page-found-hero.ts";
import type { CanvasBundle, CanvasMetricsRow } from "../lib/fender-canvas/types.ts";
import { buildLiveNodes } from "../lib/fender-canvas/nodes-from-live.ts";
import { buildLiveMetrics } from "../lib/fender-canvas/metrics-from-live.ts";
import { fenderStaticNodes } from "../components/v3/fender-static-nodes.ts";
import { PAGE_FOUND_BUBBLE_ID } from "../components/v3/live/useLandOnPageFoundHero.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function metrics(partial: Partial<CanvasMetricsRow>): CanvasMetricsRow {
  return {
    spec_checked: 1036,
    spec_fender_found: 609,
    spec_fender_found_pct: 58.8,
    ...partial,
  } as CanvasMetricsRow;
}

test("the Brand-Site Specs hero shows the bubble's page-found figure with N of M and a pie", () => {
  const m = metrics({});
  const bubble = pageFoundHero(m);
  const hero = brandSitePageFoundHero(m);
  assert.equal(hero.id, "page_found");
  assert.equal(hero.label, "fender.com page found");
  assert.equal(hero.percent, "58.8%");
  assert.equal(hero.percent, bubble.percent);
  assert.equal(hero.ratio, "609 of 1,036");
  assert.equal(hero.ratio, bubble.ratio);
  assert.equal(hero.color, bubble.color);
  assert.equal(hero.color, "var(--danger-red)");
  assert.equal(hero.numerator, 609);
  assert.equal(hero.denominator, 1036);
  assert.ok(hero.pie);
  assert.equal(hero.pie.total, 1036);
  assert.deepEqual(
    hero.pie.slices.map((slice) => [slice.key, slice.label, slice.count]),
    [
      ["matched", "Page found", 609],
      ["contradicted", "No page found", 427],
    ],
  );
  assert.equal(hero.tip, "609 of 1,036 checked SKUs");
  assert.equal(hero.explainer, "427 checked SKUs have no matching fender.com product page.");
  assert.equal(hero.figureTip, null);
});

test("the page-found hero keeps the bubble's bands: under 85 red, 85 through 95 yellow, above 95 green", () => {
  const tone = (found: number, pct: number) =>
    brandSitePageFoundHero(metrics({ spec_checked: 1000, spec_fender_found: found, spec_fender_found_pct: pct })).color;
  assert.equal(tone(849, 84.9), "var(--danger-red)");
  assert.equal(tone(850, 85), "var(--warning-amber)");
  assert.equal(tone(950, 95), "var(--warning-amber)");
  assert.equal(tone(951, 95.1), "var(--success-green)");
  const all = brandSitePageFoundHero(metrics({ spec_checked: 10, spec_fender_found: 10, spec_fender_found_pct: 100 }));
  assert.equal(all.explainer, "Every checked SKU has a matching fender.com product page.");
});

test("the fender.com product check and Findability caveat stays in the tooltip, not on screen", () => {
  const hero = brandSitePageFoundHero(metrics({}));
  assert.equal(hero.definition, PAGE_FOUND_DEFINITION);
  assert.match(hero.definition, /fender\.com product check; the Findability tab runs its own official-page check, so the two can differ\./);
  assert.match(hero.definition, /Findability/);
  for (const visible of [hero.label, hero.percent, hero.ratio ?? "", hero.explainer]) {
    assert.doesNotMatch(visible, /older|Findability|not a |\u2014/i, visible);
  }
});

test("missing inputs show Not available* with a tooltip and invent no share", () => {
  for (const m of [
    null,
    metrics({ spec_checked: null }),
    metrics({ spec_fender_found: null }),
    metrics({ spec_fender_found_pct: null }),
    metrics({ spec_checked: 0, spec_fender_found: 0 }),
    metrics({ spec_checked: 5, spec_fender_found: 6 }),
  ]) {
    const hero = brandSitePageFoundHero(m);
    assert.equal(hero.percent, PAGE_FOUND_UNAVAILABLE);
    assert.equal(hero.ratio, null);
    assert.equal(hero.pie, null);
    assert.equal(hero.denominator, null);
    assert.ok(hero.figureTip);
  }
});

test("Brand-Site Specs renders the page-found hero first with the shared card and an anchor", () => {
  const panel = read("components/v3/live/MachineReadabilityPanel.tsx");
  const card = read("components/v3/live/ShareHeroCard.tsx");
  const spokes = read("components/v3/build-live-spokes.tsx");
  assert.match(spokes, /<MachineReadabilityPanel summary=\{bundle\.specPages \?\? null\} metrics=\{bundle\.m\} \/>/);
  assert.match(panel, /brandSitePageFoundHero\(metrics, useSpecCheckRunAt\(\)\)/);
  const pageFoundAt = panel.indexOf("hero={pageFound}");
  const othersAt = panel.indexOf("heroes.map(");
  assert.ok(pageFoundAt > 0 && othersAt > pageFoundAt, "page-found hero leads the row");
  assert.match(panel, /anchorId=\{PAGE_FOUND_ANCHOR\}/);
  assert.equal(PAGE_FOUND_ANCHOR, "brand-site-page-found");
  assert.match(card, /data-ifai-tooltip-desc/);
  assert.doesNotMatch(card, /(?<![\w-])title=/);
  assert.doesNotMatch(panel, /(?<![\w-])title=/);
});

test("the AI Readiness bubble's page-found figure opens Brand-Site Specs at that hero", () => {
  const specTabs = JSON.parse(read("data/fender-v3-spec.json")).spokes.specs.tabs as string[];
  const resolve = (subTab: string) =>
    specTabs.findIndex((tab) => tab.toLowerCase().includes(subTab.toLowerCase()));
  const m = metrics({});
  const bundle = { m, divisions: [], cats: [], engines: [], sov: [], missing: [], fresh: [] } as unknown as CanvasBundle;
  const live = buildLiveNodes(bundle, buildLiveMetrics(bundle)).find((node) => node.id === PAGE_FOUND_BUBBLE_ID);
  const fixed = fenderStaticNodes.find((node) => node.id === PAGE_FOUND_BUBBLE_ID);
  for (const node of [live, fixed]) {
    assert.ok(node?.subTab);
    assert.equal(node.spokeId, "specs");
    assert.equal(specTabs[resolve(node.subTab)], "Brand-Site Specs");
  }
  const hero = brandSitePageFoundHero(m);
  assert.deepEqual(live?.heroValue, { value: hero.percent, label: "Page found" }, "the same figure, with a two-word label on the map");

  const panel = read("components/v3/live/MachineReadabilityPanel.tsx");
  const land = read("components/v3/live/useLandOnPageFoundHero.ts");
  assert.match(panel, /useLandOnPageFoundHero\(PAGE_FOUND_ANCHOR, \(\) => setOpenTable\(PAGE_FOUND_HERO_ID\)\)/);
  assert.match(panel, /openedFromPageFoundBubble\(\) \? PAGE_FOUND_HERO_ID : "missing_specs"/);
  assert.match(land, /usePanelLanding\(PAGE_FOUND_BUBBLE_ID, /);
  assert.match(land, /scrollIntoView/);
});
